'use strict';
// Polls each IMAP-enabled EmailAccount's INBOX for new mail and, when the
// sender matches a lead this account has already sent to, marks that lead
// 'replied' (stopping further campaign sends to them). Runs in the main API
// process — same pattern as campaignDispatcher.js — no separate PM2 process
// needed. Auto-detect + auto-stop only: this does NOT pull reply content
// into the CRM, it only flips the lead's status. Read the actual reply in
// the mailbox itself (Hostinger webmail, Outlook, etc.).

const cron = require('node-cron');
const { ImapFlow } = require('imapflow');
const EmailAccount = require('../models/EmailAccount');
const CampaignLead = require('../models/CampaignLead');
const { resolveIPv4 } = require('../utils/ipv4');

let tickRunning = false;

function startReplySyncCron() {
  cron.schedule('*/5 * * * *', runReplySyncTick);
  console.log('✅ Reply-sync cron scheduled (every 5 minutes)');
}

async function runReplySyncTick() {
  if (tickRunning) { console.warn('[ReplySync] previous tick still running — skipping this one'); return; }
  tickRunning = true;
  try {
    const accounts = await EmailAccount.find({
      imapEnabled: true, isActive: true, isDeleted: { $ne: true },
    }).select('+imapPassEncrypted');
    for (const account of accounts) {
      await syncAccount(account).catch((e) => console.error(`[ReplySync] ${account.email}:`, e.message));
    }
  } catch (err) {
    console.error('[ReplySync] tick error:', err.message);
  } finally {
    tickRunning = false;
  }
}

async function syncAccount(account) {
  const ip = await resolveIPv4(account.imapHost);
  const client = new ImapFlow({
    host: ip || account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: { user: account.imapUser, pass: (account.imapPass || '').replace(/\s/g, '') },
    tls: { rejectUnauthorized: !account.imapAllowInsecureTLS, servername: account.imapHost },
    logger: false,
    connectionTimeout: 10000,
  });

  try {
    await client.connect();
  } catch (e) {
    // Same "don't let a broken mailbox fail silently forever" treatment as
    // the Test-connection button — surfaces in the UI without needing a
    // manual test click.
    await EmailAccount.updateOne(
      { _id: account._id },
      { lastImapVerifiedAt: new Date(), lastImapVerifyError: (e.message || 'IMAP connection failed').slice(0, 300) }
    );
    throw e;
  }

  try {
    const box = await client.getMailboxLock('INBOX');
    try {
      const status = await client.status('INBOX', { uidNext: true });
      const currentMaxUid = (status.uidNext || 1) - 1;

      if (account.imapLastUid == null) {
        // First-ever poll for this account — record the current watermark
        // without processing anything. See the model comment: a mailbox can
        // have years of history that were never campaign replies.
        await EmailAccount.updateOne({ _id: account._id }, { imapLastUid: currentMaxUid });
        return;
      }

      if (currentMaxUid <= account.imapLastUid) return; // nothing new

      const range = `${account.imapLastUid + 1}:*`;
      const fromAddresses = new Map(); // lowercase email -> true, deduped
      for await (const msg of client.fetch(range, { envelope: true, uid: true })) {
        const from = msg.envelope?.from?.[0]?.address;
        if (from) fromAddresses.set(from.toLowerCase(), true);
      }

      if (fromAddresses.size) {
        const result = await CampaignLead.updateMany(
          { accountUsed: account._id, status: 'sent', email: { $in: [...fromAddresses.keys()] } },
          { status: 'replied', repliedAt: new Date() }
        );
        if (result.modifiedCount) {
          console.log(`[ReplySync] ${account.email}: ${result.modifiedCount} lead(s) marked replied`);
        }
      }

      await EmailAccount.updateOne({ _id: account._id }, { imapLastUid: currentMaxUid });
    } finally {
      box.release();
    }
  } finally {
    client.logout().catch(() => {});
  }
}

module.exports = { startReplySyncCron, runReplySyncTick };
