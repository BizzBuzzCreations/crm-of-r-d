// backend/src/workers/campaignWorker.js
// ── Standalone daemon — run via: npm run campaign-worker  OR  pm2 start ────
// Sends bulk campaign emails. Deliberately separate from emailWorker.js
// (transactional mail) — different reputation risk, different rate limits,
// and supports multiple sender accounts instead of one global SMTP config.
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { Worker } = require('bullmq');
const nodemailer  = require('nodemailer');
const mongoose    = require('mongoose');
const Campaign     = require('../models/Campaign');
const CampaignLead = require('../models/CampaignLead');
const EmailAccount = require('../models/EmailAccount');

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 })
  .then(() => console.log('✅ MongoDB connected (campaign worker)'))
  .catch((e) => console.error('⚠️  MongoDB connection failed:', e.message));

const redisConn = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

console.log('\n══════════════════════════════════════════════════');
console.log('  BizzBuzz CRM — Campaign Worker v1.0');
console.log('══════════════════════════════════════════════════');
console.log(`  Redis   : ${redisConn.host}:${redisConn.port}`);
console.log('══════════════════════════════════════════════════\n');

const ts  = () => new Date().toISOString().replace('T', ' ').slice(0, 23);
const log = (...a) => console.log(`[${ts()}]`, ...a);
const err = (...a) => console.error(`[${ts()}] ❌`, ...a);

let sysLog = { info: () => {}, warn: () => {}, error: () => {} };
try { sysLog = require('../utils/sysLogger').logger; } catch {}

// ── Per-account transporter cache ────────────────────────────────────────
// Pooled connections reused across sends (same deliverability rationale as
// emailWorker.js), keyed by EmailAccount id so each sender account gets its
// own connection pool and its own ~5msg/sec throttle.
const transporterCache = new Map();

function getTransporter(account) {
  const key = String(account._id);
  if (transporterCache.has(key)) return transporterCache.get(key);

  const transporter = nodemailer.createTransport({
    host:   account.smtpHost,
    port:   account.smtpPort,
    secure: account.smtpSecure,
    auth:   { user: account.smtpUser, pass: (account.smtpPass || '').replace(/\s/g, '') },
    pool:   true,
    maxConnections: 2,
    maxMessages:    100,
    rateDelta:      1000,
    rateLimit:      5, // max 5 messages/sec per account
    tls: { rejectUnauthorized: !account.smtpAllowInsecureTLS, minVersion: 'TLSv1.2' },
    socketTimeout: 10000,
    greetingTimeout: 10000,
    connectionTimeout: 10000,
  });
  transporterCache.set(key, transporter);
  return transporter;
}

// ── Merge tags ────────────────────────────────────────────────────────────
function renderMergeTags(template, lead) {
  return String(template || '')
    .replace(/\{\{\s*first_?name\s*\}\}/gi, lead.firstName || 'there')
    .replace(/\{\{\s*last_?name\s*\}\}/gi, lead.lastName || '')
    .replace(/\{\{\s*email\s*\}\}/gi, lead.email || '');
}

// ── Tracking / unsubscribe injection ─────────────────────────────────────
const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const apiBase   = process.env.CAMPAIGN_TRACK_BASE_URL
  ? process.env.CAMPAIGN_TRACK_BASE_URL.replace(/\/$/, '')
  : clientUrl; // frontend origin proxies /api to the backend in both dev + prod (see app.js SPA fallback)

function rewriteLinksForClickTracking(html, token) {
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (_m, url) => {
    const redirect = `${apiBase}/api/campaigns/track/click/${token}?url=${encodeURIComponent(url)}`;
    return `href="${redirect}"`;
  });
}

function appendOpenPixel(html, token) {
  // No `display:none` — a hidden 1x1 image is a well-known spam-filter
  // signature (real senders don't hide their pixel, spammers do). A plain
  // 1x1 image is already visually negligible without needing to hide it.
  return `${html}<img src="${apiBase}/api/campaigns/track/open/${token}.png" width="1" height="1" alt="" style="border:0;" />`;
}

function appendUnsubscribeFooter(html, token, account) {
  const unsubUrl = `${apiBase}/api/campaigns/unsubscribe/${token}`;
  return `${html}
    <p style="margin:24px 0 0;font-size:11px;color:#94a3b8;font-family:Arial,sans-serif;">
      You are receiving this because ${account.fromName || account.email} contacted you.
      <a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
    </p>`;
}

function stripToPlain(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const spamSafeHeaders = (account, unsubUrl) => ({
  'X-Priority':     '3',
  'X-Mailer':       'BizzBuzz CRM Campaign Service',
  'Importance':     'Normal',
  'List-Unsubscribe':      `<${unsubUrl}>, <mailto:${account.smtpUser}?subject=unsubscribe>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  'Precedence': 'bulk',
});

// ── Worker ───────────────────────────────────────────────────────────────
const worker = new Worker('campaign-queue', async (job) => {
  const { campaignLeadId } = job.data;

  const lead = await CampaignLead.findById(campaignLeadId);
  if (!lead) { log(`Job ${job.id} — lead ${campaignLeadId} not found, discarding`); return { skipped: true }; }

  // Re-check status — the lead may have been unsubscribed / marked replied
  // between the dispatcher scheduling it and the worker picking it up.
  if (!['scheduled', 'sending'].includes(lead.status)) {
    log(`Job ${job.id} — lead ${lead.email} status is "${lead.status}", skipping send`);
    return { skipped: true, reason: lead.status };
  }

  const campaign = await Campaign.findById(lead.campaign);
  if (!campaign) { lead.status = 'failed'; lead.error = 'Campaign not found'; await lead.save(); return { skipped: true }; }

  const account = await EmailAccount.findById(lead.accountUsed).select('+smtpPassEncrypted');
  if (!account) {
    lead.status = 'failed'; lead.error = 'Sending account not found'; await lead.save();
    throw new Error('Sending account not found');
  }

  lead.status = 'sending';
  await lead.save();

  const subject = renderMergeTags(campaign.subject, lead);
  let html = renderMergeTags(campaign.bodyHtml, lead);
  const unsubUrl = `${apiBase}/api/campaigns/unsubscribe/${lead.token}`;

  // Campaigns here send a single email (no multi-step sequence yet), so
  // "first email" and "every email" are the same thing — both settings
  // drive the same text-only decision until sequences exist.
  const sendAsTextOnly = !!(campaign.settings.textOnly || campaign.settings.firstEmailTextOnly);

  if (campaign.settings.linkTracking) html = rewriteLinksForClickTracking(html, lead.token);
  html = appendUnsubscribeFooter(html, lead.token, account);
  if (campaign.settings.openTracking && !sendAsTextOnly) html = appendOpenPixel(html, lead.token);

  const text = stripToPlain(html);

  log(`📨 Job ${job.id} | campaign="${campaign.name}" → ${lead.email} via ${account.email} | attempt=${job.attemptsMade + 1}/${job.opts?.attempts || 3}`);

  const transporter = getTransporter(account);
  const mailOptions = {
    from:    `"${account.fromName || account.name}" <${account.email}>`,
    to:      lead.email,
    replyTo: account.replyTo || account.email,
    subject,
    text,
    headers: spamSafeHeaders(account, unsubUrl),
  };
  if (!sendAsTextOnly) mailOptions.html = html;

  try {
    const info = await transporter.sendMail(mailOptions);
    lead.status = 'sent';
    lead.sentAt = new Date();
    lead.error = '';
    await lead.save();
    EmailAccount.updateOne({ _id: account._id }, { $inc: { totalSent: 1 } }).catch(() => {});
    log(`✅ Delivered — job ${job.id} | msgId=${info.messageId}`);
    sysLog.info('CAMPAIGN', `Campaign "${campaign.name}" email delivered to ${lead.email} via ${account.email}`);
    return { messageId: info.messageId };
  } catch (smtpErr) {
    // 5xx SMTP response = permanent rejection (bad/nonexistent mailbox) —
    // a hard bounce. Retrying won't help, so don't throw (which would make
    // BullMQ retry 3x with backoff) — just record it and move on. Anything
    // else (4xx, connection errors, timeouts) is transient — throw to retry.
    const code = smtpErr.responseCode;
    const isHardBounce = typeof code === 'number' && code >= 500 && code < 600;
    lead.status = isHardBounce ? 'bounced' : 'failed';
    lead.error = smtpErr.message?.slice(0, 500) || 'Unknown SMTP error';
    await lead.save();
    err(`SMTP send failed — job ${job.id} | ${lead.email}: ${smtpErr.message}${isHardBounce ? ' (hard bounce, not retrying)' : ''}`);
    sysLog.error('CAMPAIGN', `Job ${job.id} ${isHardBounce ? 'bounced' : 'failed'} — ${lead.email}: ${smtpErr.message}`);
    if (isHardBounce) return { bounced: true };
    throw smtpErr;
  }
}, { connection: redisConn, concurrency: 5 });

worker.on('ready', () => { log('✅ Worker ready — listening on "campaign-queue"'); sysLog.info('WORKER', 'Campaign worker ready'); });
worker.on('failed', (job, e) => {
  const attempts = job?.attemptsMade ?? '?';
  const max = job?.opts?.attempts ?? 3;
  err(`Job ${job?.id} FAILED (${attempts}/${max}) — ${e.message}`);
});
worker.on('error', (e) => err('Worker error:', e.message));

const shutdown = async (sig) => {
  log(`${sig} — closing worker gracefully…`);
  await worker.close();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
