// backend/src/workers/socialPublishWorker.js
// ── Standalone daemon — run via: npm run social-publish-worker ────────────
// Publishes one SocialPublication per job (see queues/socialPublishQueue.js
// for why it's per-publication, not per-post). Same skeleton as
// campaignWorker.js/prospectAuditWorker.js: own mongoose connection, own
// BullMQ Worker, graceful shutdown.
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('dns').setDefaultResultOrder('ipv4first');

const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const SocialPublication = require('../models/SocialPublication');
const SocialPost = require('../models/SocialPost');
const SocialAccount = require('../models/SocialAccount');
const socialService = require('../modules/social/services/socialService');
const { recomputePostStatus } = require('../modules/social/services/socialPostService');

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 })
  .then(() => console.log('✅ MongoDB connected (social publish worker)'))
  .catch((e) => console.error('⚠️  MongoDB connection failed:', e.message));

const redisConn = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

console.log('\n══════════════════════════════════════════════════');
console.log('  BizzBuzz CRM — Social Publish Worker v1.0');
console.log('══════════════════════════════════════════════════');
console.log(`  Redis   : ${redisConn.host}:${redisConn.port}`);
console.log('══════════════════════════════════════════════════\n');

const ts  = () => new Date().toISOString().replace('T', ' ').slice(0, 23);
const log = (...a) => console.log(`[${ts()}]`, ...a);
const err = (...a) => console.error(`[${ts()}] ❌`, ...a);

let sysLog = { info: () => {}, warn: () => {}, error: () => {} };
try { sysLog = require('../utils/sysLogger').logger; } catch {}

const worker = new Worker('social-publish-queue', async (job) => {
  const { publicationId } = job.data;

  const publication = await SocialPublication.findById(publicationId);
  if (!publication) { log(`Job ${job.id} — publication ${publicationId} not found, discarding`); return { skipped: true }; }
  if (publication.status === 'cancelled') {
    log(`Job ${job.id} — publication ${publicationId} was cancelled, skipping`);
    return { skipped: true, reason: 'cancelled' };
  }

  const [post, account] = await Promise.all([
    SocialPost.findById(publication.socialPost),
    SocialAccount.findById(publication.socialAccount).select('+accessTokenEncrypted +refreshTokenEncrypted'),
  ]);
  if (!post || post.status === 'cancelled') {
    publication.status = 'cancelled';
    await publication.save();
    log(`Job ${job.id} — parent post cancelled, skipping publication ${publicationId}`);
    return { skipped: true, reason: 'post_cancelled' };
  }
  if (!account) {
    publication.status = 'failed';
    publication.errorCode = 'VALIDATION_ERROR';
    publication.errorMessage = 'The connected account no longer exists.';
    publication.retryable = false;
    publication.lastAttemptAt = new Date();
    await publication.save();
    await recomputePostStatus(post._id);
    return { failed: true };
  }

  publication.status = 'publishing';
  publication.lastAttemptAt = new Date();
  publication.retryCount = job.attemptsMade;
  await publication.save();

  log(`📤 Job ${job.id} | ${account.accountName} (${account.platform}) | attempt=${job.attemptsMade + 1}/${job.opts?.attempts || 3}`);

  try {
    const result = await socialService.publish(account, post);
    publication.status = 'published';
    publication.platformPostId = result.platformPostId || '';
    publication.publishedUrl = result.publishedUrl || '';
    publication.publishedAt = new Date();
    publication.errorCode = '';
    publication.errorMessage = '';
    publication.retryable = null;
    await publication.save();
    await recomputePostStatus(post._id);

    log(`✅ Published — job ${job.id} | ${account.platform} | ${publication.publishedUrl || publication.platformPostId}`);
    sysLog.info('SOCIAL', `Published to ${account.platform} (${account.accountName}) — post ${post._id}`);
    return { published: true };
  } catch (publishErr) {
    const code = publishErr.code || 'UNKNOWN_ERROR';
    const retryable = typeof publishErr.retryable === 'boolean' ? publishErr.retryable : true;

    publication.status = 'failed';
    publication.errorCode = code;
    publication.errorMessage = String(publishErr.message || 'Unknown error').slice(0, 500);
    publication.retryable = retryable;
    await publication.save();
    await recomputePostStatus(post._id);

    err(`Publish failed — job ${job.id} | ${account.platform}: ${publishErr.message} (${code}, retryable=${retryable})`);
    sysLog.error('SOCIAL', `Failed to publish to ${account.platform} (${account.accountName}) — ${code}: ${publishErr.message}`);

    // Non-retryable (token/permission/media/validation) errors are saved as
    // permanently failed above and we return normally here — NOT throwing —
    // so BullMQ's automatic attempts/backoff never blindly hammers a dead
    // token. Only transient errors (rate limit/network/platform/unknown)
    // throw, letting BullMQ's exponential backoff retry.
    if (!retryable) return { failed: true, retryable: false };
    throw publishErr;
  }
}, { connection: redisConn, concurrency: 3 });

worker.on('ready', () => { log('✅ Worker ready — listening on "social-publish-queue"'); sysLog.info('SOCIAL', 'Worker started and listening for jobs'); });
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
