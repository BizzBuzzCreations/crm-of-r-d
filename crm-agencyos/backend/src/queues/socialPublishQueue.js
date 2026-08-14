'use strict';
// One BullMQ job per SocialPublication, not per SocialPost — this is what
// makes retry correct: re-enqueuing a failed LinkedIn publication must
// never re-trigger an already-succeeded Facebook one. Scheduled posts use
// BullMQ's native `delay` option directly (no polling dispatcher needed —
// unlike campaign/prospect-audit sending, there's no external rate-limit
// budget to pace against here, just "fire at this exact time").
const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const socialPublishQueue = new Queue('social-publish-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

const addSocialPublishToQueue = async (publicationId, { delay = 0 } = {}) => {
  const job = await socialPublishQueue.add(
    'SOCIAL_PUBLISH',
    { publicationId: String(publicationId), queuedAt: new Date().toISOString() },
    { delay: Math.max(0, delay) }
  );
  return job.id;
};

module.exports = { socialPublishQueue, addSocialPublishToQueue };
