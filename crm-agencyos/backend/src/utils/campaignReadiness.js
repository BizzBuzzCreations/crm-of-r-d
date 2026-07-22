'use strict';
const CampaignLead = require('../models/CampaignLead');

// Single source of truth for "is this campaign actually sendable right now" —
// used by the manual Start button, the Schedule action, and the scheduled-
// campaign promotion step in the dispatcher cron. A campaign that passed
// this check at schedule time gets re-checked with the exact same rules at
// trigger time, since accounts/leads can change in between.
async function checkCampaignReady(campaign) {
  if (!campaign.subject?.trim() || !campaign.bodyHtml?.trim()) {
    return { ready: false, reason: 'Add a subject and email body before starting the campaign' };
  }
  if (!campaign.settings.accounts?.length) {
    return { ready: false, reason: 'Select at least one sending account in campaign settings' };
  }
  const pendingCount = await CampaignLead.countDocuments({ campaign: campaign._id, status: 'pending' });
  if (pendingCount === 0) {
    return { ready: false, reason: 'Import at least one lead before starting the campaign' };
  }
  return { ready: true, reason: '' };
}

module.exports = { checkCampaignReady };
