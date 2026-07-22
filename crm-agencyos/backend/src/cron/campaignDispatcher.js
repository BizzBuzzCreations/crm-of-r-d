'use strict';
// Paces bulk campaign sending. Runs every minute in the main API process
// (does not need its own daemon — it only ever enqueues jobs, the actual
// SMTP work happens in campaignWorker.js). For each active campaign this
// decides *whether* it's time to release the next email, respecting:
//   - settings.sendingHoursEnabled — only sends within the configured hours/days/timezone
//   - settings.dailyLimit / settings.maxNewLeadsPerDay (whichever is lower)
//   - settings.minGapMinutes + a random 0..randomGapMinutes jitter between sends
//   - each account's warm-up-ramped daily cap, shared across ALL campaigns
//     using that account (see utils/warmup.js)
//   - round-robins across settings.accounts so load is spread across senders
// One send per campaign per tick, max — the 1-minute tick interval is itself
// a safety ceiling even if minGapMinutes is set to 0.

const cron = require('node-cron');
const Campaign     = require('../models/Campaign');
const CampaignLead = require('../models/CampaignLead');
const EmailAccount = require('../models/EmailAccount');
const { addCampaignEmailToQueue } = require('../queues/campaignQueue');
const { effectiveDailyLimit } = require('../utils/warmup');
const { isWithinSendingWindow } = require('../utils/sendingWindow');
const { checkCampaignReady } = require('../utils/campaignReadiness');

function startCampaignDispatcher() {
  cron.schedule('* * * * *', runDispatchTick);
  console.log('✅ Campaign dispatcher cron scheduled (every minute)');
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// node-cron does not skip overlapping runs on its own — if a tick ever took
// longer than a minute (slow DB, many active campaigns), the next scheduled
// tick would start concurrently and could double-process the same campaign
// (two ticks racing to pick the same "next pending lead"). This flag makes
// a slow tick just get skipped rather than overlap.
let tickRunning = false;

async function runDispatchTick() {
  if (tickRunning) { console.warn('[CampaignDispatcher] previous tick still running — skipping this one'); return; }
  tickRunning = true;
  try {
    // Promote any scheduled campaign(s) whose time has come BEFORE fetching
    // the active list below, so a campaign that just got promoted this tick
    // also gets its first send this same tick instead of waiting a full
    // extra minute.
    await promoteScheduledCampaigns();

    const campaigns = await Campaign.find({ status: 'active', isDeleted: { $ne: true } });
    for (const campaign of campaigns) {
      await dispatchOne(campaign).catch((e) => console.error(`[CampaignDispatcher] ${campaign._id}:`, e.message));
    }
  } catch (err) {
    console.error('[CampaignDispatcher] tick error:', err.message);
  } finally {
    tickRunning = false;
  }
}

// Campaign.status === 'scheduled' with scheduledAt in the past → promote to
// 'active'. Re-validates readiness with the exact same rules used at
// schedule time (checkCampaignReady) — settings.accounts or the lead list
// can change between when a campaign was scheduled and when it fires, and a
// campaign that's no longer actually sendable should never just silently
// sit stuck "scheduled" forever with its trigger time in the past. If it's
// not ready, it's reverted to 'draft' with scheduleFailedReason set so the
// UI can explain why instead of leaving it a silent mystery.
async function promoteScheduledCampaigns() {
  const due = await Campaign.find({ status: 'scheduled', scheduledAt: { $lte: new Date() }, isDeleted: { $ne: true } });
  for (const campaign of due) {
    try {
      const { ready, reason } = await checkCampaignReady(campaign);
      if (!ready) {
        campaign.status = 'draft';
        campaign.scheduledAt = null;
        campaign.scheduleFailedReason = `Scheduled send did not start: ${reason}`;
        await campaign.save();
        console.warn(`[CampaignDispatcher] Scheduled campaign "${campaign.name}" (${campaign._id}) reverted to draft — ${reason}`);
        continue;
      }
      campaign.status = 'active';
      campaign.nextEligibleAt = null;
      campaign.scheduledAt = null;
      campaign.scheduleFailedReason = '';
      await campaign.save();
      console.log(`[CampaignDispatcher] Scheduled campaign "${campaign.name}" (${campaign._id}) promoted to active`);
    } catch (e) {
      console.error(`[CampaignDispatcher] Failed to promote scheduled campaign ${campaign._id}:`, e.message);
    }
  }
}

async function dispatchOne(campaign) {
  const settings = campaign.settings || {};

  // ── Gap pacing ──────────────────────────────────────────────────────
  if (campaign.nextEligibleAt && new Date() < campaign.nextEligibleAt) return;

  // ── Sending hours window ──────────────────────────────────────────────
  if (!isWithinSendingWindow(settings)) return; // outside allowed hours/days — retried next tick

  // ── Active, verified sending accounts ──────────────────────────────
  const accountIds = (settings.accounts || []).map(String);
  if (!accountIds.length) return; // nothing configured — dispatcher no-ops silently, surfaced in UI instead

  const accounts = await EmailAccount.find({ _id: { $in: accountIds }, isActive: true, isDeleted: { $ne: true } });
  if (!accounts.length) return;

  // ── Daily cap (lower of dailyLimit / maxNewLeadsPerDay) ─────────────
  const cap = Math.min(
    Number.isFinite(settings.dailyLimit) ? settings.dailyLimit : Infinity,
    Number.isFinite(settings.maxNewLeadsPerDay) ? settings.maxNewLeadsPerDay : Infinity
  );
  if (Number.isFinite(cap)) {
    // `updatedAt` alone is unsafe here: opens/clicks push events onto an
    // already-`sent` lead (bumping its updatedAt) and a recipient can
    // unsubscribe/reply days after the actual send — none of that is a
    // send that happened *today*. Use `sentAt` for delivered mail (set once,
    // at send time, never touched again) and fall back to `updatedAt` only
    // for statuses that don't have a `sentAt` (failed/bounced/in-flight),
    // whose updatedAt is exactly their one-time send-attempt timestamp.
    const sentToday = await CampaignLead.countDocuments({
      campaign: campaign._id,
      $or: [
        { sentAt: { $gte: startOfToday() } },
        { status: { $in: ['scheduled', 'sending', 'failed', 'bounced'] }, sentAt: null, updatedAt: { $gte: startOfToday() } },
      ],
    });
    if (sentToday >= cap) return;
  }

  // ── Per-account daily cap ────────────────────────────────────────────
  // Shared across ALL campaigns using this account, not just this one —
  // an account's inbox reputation doesn't care which campaign sent from
  // it, so three campaigns sharing a mailbox must not collectively blow
  // past what's safe for that single mailbox.
  const accountSentToday = await CampaignLead.aggregate([
    { $match: { accountUsed: { $in: accounts.map((a) => a._id) }, status: 'sent', sentAt: { $gte: startOfToday() } } },
    { $group: { _id: '$accountUsed', count: { $sum: 1 } } },
  ]);
  const sentTodayByAccount = new Map(accountSentToday.map((r) => [String(r._id), r.count]));
  const availableAccounts = accounts.filter(
    (a) => (sentTodayByAccount.get(String(a._id)) || 0) < (effectiveDailyLimit(a) || Infinity)
  );
  if (!availableAccounts.length) return; // every selected account is maxed out for today

  // ── Next lead in line ────────────────────────────────────────────────
  // Leads already known to be undeliverable (invalid MX) are flipped to
  // 'failed' at verification time, not left 'pending' — this query only
  // ever sees leads actually worth attempting.
  const lead = await CampaignLead.findOne({ campaign: campaign._id, status: 'pending' }).sort({ createdAt: 1 });
  if (!lead) {
    // Nothing left to send — auto-complete once no in-flight leads remain either
    const inFlight = await CampaignLead.countDocuments({ campaign: campaign._id, status: { $in: ['scheduled', 'sending'] } });
    if (inFlight === 0) await Campaign.updateOne({ _id: campaign._id }, { status: 'completed' });
    return;
  }

  // ── Round-robin account selection (within accounts that have headroom) ──
  const nextIndex = (campaign.lastAccountIndex + 1) % availableAccounts.length;
  const account = availableAccounts[nextIndex];

  lead.status = 'scheduled';
  lead.accountUsed = account._id;
  await lead.save();

  try {
    await addCampaignEmailToQueue(lead._id);
  } catch (queueErr) {
    // Enqueueing failed (e.g. a Redis blip) — revert instead of leaving
    // this lead stuck in "scheduled" forever with no job ever created for
    // it, which would also block the campaign from ever auto-completing
    // (its own in-flight check would count this lead permanently).
    lead.status = 'pending';
    lead.accountUsed = null;
    await lead.save();
    throw queueErr;
  }

  const gapMinutes = (settings.minGapMinutes || 0) + Math.random() * (settings.randomGapMinutes || 0);
  await Campaign.updateOne(
    { _id: campaign._id },
    {
      lastSentAt: new Date(),
      nextEligibleAt: new Date(Date.now() + gapMinutes * 60000),
      lastAccountIndex: nextIndex,
    }
  );
}

module.exports = { startCampaignDispatcher, runDispatchTick, promoteScheduledCampaigns };
