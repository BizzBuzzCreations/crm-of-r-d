// backend/src/queues/campaignQueue.js
// Separate BullMQ queue from the transactional email-queue — bulk campaign
// sends are a different reputation/rate-limit domain and shouldn't compete
// with (or risk) transactional mail (welcome emails, invoice reminders, ...).
'use strict';
const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const campaignQueue = new Queue('campaign-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail:     { count: 200 },
  },
});

/**
 * Enqueue a single campaign email send. The dispatcher cron is the only
 * caller — it decides *when* (respecting the campaign's pacing settings)
 * and this just performs the actual send + tracking-aware rendering.
 *
 * @param {string} campaignLeadId - CampaignLead _id (identifies recipient + tokens)
 * @returns {string} BullMQ job ID
 */
const addCampaignEmailToQueue = async (campaignLeadId) => {
  const job = await campaignQueue.add('CAMPAIGN_EMAIL', {
    campaignLeadId: String(campaignLeadId),
    queuedAt: new Date().toISOString(),
  });
  return job.id;
};

/**
 * Enqueue a single auto-follow-up email for a lead that's gone "hot" (see
 * cron/followUpDispatcher.js). Same queue/worker as the original send —
 * campaignWorker.js branches on the job name to render/track the follow-up
 * fields (followUpStatus/followUpSentAt/...) instead of the original ones.
 *
 * @param {string} campaignLeadId - CampaignLead _id
 * @returns {string} BullMQ job ID
 */
const addFollowUpEmailToQueue = async (campaignLeadId) => {
  const job = await campaignQueue.add('CAMPAIGN_FOLLOWUP_EMAIL', {
    campaignLeadId: String(campaignLeadId),
    queuedAt: new Date().toISOString(),
  });
  return job.id;
};

module.exports = { campaignQueue, addCampaignEmailToQueue, addFollowUpEmailToQueue };
