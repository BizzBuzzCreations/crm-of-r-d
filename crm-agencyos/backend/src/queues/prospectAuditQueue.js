// backend/src/queues/prospectAuditQueue.js
// Separate BullMQ queue from campaigns/email — prospect-site crawling has
// its own pacing constraint (PageSpeed Insights' rate limit) and shouldn't
// compete with or risk campaign sending.
'use strict';
const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const prospectAuditQueue = new Queue('prospect-audit-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail:     { count: 200 },
  },
});

/**
 * Enqueue a single prospect website audit. The dispatcher cron is the only
 * caller — it decides *when* (respecting PageSpeed Insights' rate limit)
 * and *which* configured API key to use for this job, so the worker itself
 * never has to make pacing decisions.
 *
 * @param {string} prospectId - ProspectAudit _id
 * @param {'key1'|'key2'} psiKey - which configured PageSpeed Insights key to use
 * @returns {string} BullMQ job ID
 */
const addProspectAuditToQueue = async (prospectId, psiKey = 'key1') => {
  const job = await prospectAuditQueue.add('PROSPECT_AUDIT', {
    prospectId: String(prospectId),
    psiKey,
    queuedAt: new Date().toISOString(),
  });
  return job.id;
};

module.exports = { prospectAuditQueue, addProspectAuditToQueue };
