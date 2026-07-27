'use strict';
// Bridges Campaigns and the B2B Leads Pipeline. The two are otherwise
// unrelated collections — CampaignLead has no ref to Lead — matched here
// only by email address. Called when a campaign recipient shows a strong
// buying signal (repeat opens or an actual reply) so sales can work them
// as a real Lead instead of the signal staying trapped inside the campaign.
//
// Designed to be called on EVERY qualifying open, not just the first —
// rapid-fire opens (an email client re-rendering, a prefetch burst) fire
// concurrent fire-and-forget calls for the same recipient. Lead.email has
// no unique index (bulk CSV import can legitimately create rows that share
// an email), so two concurrent "no existing lead found" checks can both
// decide to create — an upsert-style atomic update can't be used instead
// because it would bypass the pre-save hook that assigns leadId/slaDeadline.
// Fixed here with a per-email in-process queue: every call for the same
// email is chained onto the previous one, so only one create ever runs.
// This assumes a single backend process (see PM2 config — fork mode, not
// cluster); a multi-instance deployment would need a DB-level lock instead.
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const { autoAssignLead } = require('./leadAssignment');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const queues = new Map(); // lowercase email -> tail of the pending chain

async function findLeadByEmail(email) {
  if (!email) return null;
  return Lead.findOne({ email: { $regex: new RegExp(`^${escapeRegExp(email)}$`, 'i') } });
}

function displayName(campaignLead) {
  const name = `${campaignLead.firstName || ''} ${campaignLead.lastName || ''}`.trim();
  return name || campaignLead.email.split('@')[0];
}

function companyGuess(campaignLead) {
  const domain = (campaignLead.email.split('@')[1] || '').split('.')[0];
  return domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : 'Unknown Company';
}

// reason: 'hot' (3+ opens, safe to call repeatedly) | 'replied' (fires once, on the status transition)
async function doSync(campaignLead, reason) {
  const campaign = await Campaign.findById(campaignLead.campaign).select('name').lean();
  const campaignName = campaign?.name || 'a campaign';
  const existing = await findLeadByEmail(campaignLead.email);

  if (!existing) {
    const assignedTo = await autoAssignLead();
    return Lead.create({
      companyName: companyGuess(campaignLead),
      contactPerson: displayName(campaignLead),
      email: campaignLead.email,
      source: 'Campaign',
      status: reason === 'replied' ? 'First Contact' : 'New Lead',
      assignedTo,
      emailOpens: campaignLead.openCount || 0,
      interactionsCount: reason === 'replied' ? 1 : 0,
      tags: reason === 'replied' ? ['Campaign', 'Replied'] : ['Campaign', 'Hot'],
      lastContactDate: new Date(),
      notes: [{
        text: reason === 'replied'
          ? `Auto-created — replied to campaign "${campaignName}".`
          : `Auto-created — opened campaign "${campaignName}" ${campaignLead.openCount}+ times.`,
        authorName: 'System',
      }],
      activities: [
        {
          type: 'create',
          text: reason === 'replied'
            ? '📨 Auto-added to pipeline from campaign reply'
            : '🔥 Auto-added to pipeline as Hot from campaign engagement',
          performedBy: 'System',
        },
        ...(assignedTo ? [{ type: 'assign', text: 'Auto-assigned via Lead Distribution rules', performedBy: 'System' }] : []),
      ],
    });
  }

  // Already in the pipeline — reinforce the signal instead of duplicating.
  if (reason === 'hot') {
    const alreadyHot = existing.tags?.includes('Hot');
    await Lead.updateOne({ _id: existing._id }, {
      $set: { lastContactDate: new Date() },
      $max: { emailOpens: campaignLead.openCount || 0 },
      $addToSet: { tags: { $each: alreadyHot ? ['Campaign'] : ['Campaign', 'Hot'] } },
    });
    if (!alreadyHot) {
      // Only the crossing itself is logged — later opens just refresh the count above.
      await Lead.updateOne({ _id: existing._id }, {
        $push: { activities: {
          type: 'status_change',
          text: `🔥 Reached ${campaignLead.openCount}+ opens on campaign "${campaignName}"`,
          performedBy: 'System',
        } },
      });
    }
    return existing;
  }

  // reason === 'replied'
  const alreadyReplied = existing.tags?.includes('Replied');
  await Lead.updateOne({ _id: existing._id }, {
    $set: { lastContactDate: new Date() },
    $addToSet: { tags: { $each: ['Campaign', 'Replied'] } },
  });
  if (!alreadyReplied) {
    // Only the first reply bumps the interaction count and logs a note —
    // repeat calls (e.g. a re-run of the historical backfill script) must
    // not keep incrementing, same as the "hot" branch's alreadyHot guard.
    await Lead.updateOne({ _id: existing._id }, {
      $inc: { interactionsCount: 1 },
      $push: { activities: {
        type: 'note',
        text: `📨 Replied to campaign "${campaignName}"`,
        performedBy: 'System',
      } },
    });
  }
  return existing;
}

async function syncCampaignLeadToPipeline(campaignLead, reason) {
  const key = String(campaignLead.email || '').toLowerCase();
  if (!key) return null;

  // Chain onto whatever's already pending for this email — a rejected prior
  // call is swallowed here so it can't break the chain for calls behind it.
  const prior = queues.get(key) || Promise.resolve();
  const settled = prior.catch(() => {}).then(() => doSync(campaignLead, reason));
  queues.set(key, settled);

  try {
    return await settled;
  } catch (err) {
    console.error('[LeadPipelineSync] failed:', err.message);
    return null;
  } finally {
    // Only drop the map entry if nothing queued behind us while we ran.
    if (queues.get(key) === settled) queues.delete(key);
  }
}

module.exports = { syncCampaignLeadToPipeline };
