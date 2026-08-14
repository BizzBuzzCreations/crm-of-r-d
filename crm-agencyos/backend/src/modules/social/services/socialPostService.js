'use strict';
// Business logic behind SocialPost create/schedule/publish/cancel/retry —
// kept out of the controller so both the HTTP layer and the worker can call
// the same aggregate-status recompute logic. See the module's plan for the
// full flow description.
const SocialPost = require('../../../models/SocialPost');
const SocialPublication = require('../../../models/SocialPublication');
const { addSocialPublishToQueue } = require('../../../queues/socialPublishQueue');
const socialService = require('./socialService');

// Pre-flight check, run before anything is created/queued — e.g. Instagram
// requires media, so a text-only post targeting an IG account is rejected
// outright with a clear per-account reason rather than silently producing a
// publication that's guaranteed to fail. This is a "fix your submission"
// gate, not the same thing as a runtime partial failure after publish is
// attempted (which is allowed and expected — see recomputePostStatus).
async function validateSelection(accounts, post) {
  const errors = [];
  const media = post.media || [];
  for (const account of accounts) {
    const caps = socialService.getCapabilities(account.platform);
    if (caps.requiresMedia && !media.length) {
      errors.push({ accountId: String(account._id), platform: account.platform, message: `${account.accountName} (${account.platform.replace('_', ' ')}) requires ${caps.supportedMediaTypes.length === 1 ? `a ${caps.supportedMediaTypes[0]}` : 'an image or video'}.` });
    } else if (media.length && !caps.supportedMediaTypes.includes(media[0].type)) {
      errors.push({ accountId: String(account._id), platform: account.platform, message: `${account.accountName} only supports ${caps.supportedMediaTypes.join('/')} — the attached ${media[0].type} won't work here.` });
    }
    if (caps.requiresTitle && !post.title?.trim()) {
      errors.push({ accountId: String(account._id), platform: account.platform, message: `${account.accountName} requires a title.` });
    }
    if ((post.content || '').length > caps.maxTextLength) {
      errors.push({ accountId: String(account._id), platform: account.platform, message: `${account.accountName}: content exceeds the ${caps.maxTextLength}-character limit.` });
    }
  }
  return { valid: errors.length === 0, errors };
}

// Creates SocialPublication rows for every selected account and enqueues
// one BullMQ job per publication. `delay` in ms — 0 for publish-now,
// (scheduledAt - now) for a scheduled post.
async function createPublicationsAndEnqueue(post, accounts, delayMs) {
  const publications = await SocialPublication.insertMany(
    accounts.map((a) => ({ socialPost: post._id, socialAccount: a._id, platform: a.platform, status: 'pending' }))
  );
  for (const pub of publications) {
    const jobId = await addSocialPublishToQueue(pub._id, { delay: delayMs });
    pub.bullJobId = jobId;
    await pub.save();
  }
  return publications;
}

async function publishNow(post, accounts) {
  post.status = 'publishing';
  await post.save();
  await createPublicationsAndEnqueue(post, accounts, 0);
  return post;
}

async function schedulePost(post, accounts) {
  const delayMs = Math.max(0, new Date(post.scheduledAt).getTime() - Date.now());
  post.status = 'scheduled';
  await post.save();
  await createPublicationsAndEnqueue(post, accounts, delayMs);
  return post;
}

// Called by the worker after every publication attempt resolves (success or
// terminal failure), and by cancel()/retry() so the parent post's status
// stays in sync with its publications at every transition.
async function recomputePostStatus(postId) {
  const pubs = await SocialPublication.find({ socialPost: postId });
  if (!pubs.length) return;

  let status;
  if (pubs.every((p) => p.status === 'cancelled')) status = 'cancelled';
  else if (pubs.every((p) => p.status === 'published')) status = 'published';
  else if (pubs.every((p) => ['published', 'failed', 'cancelled'].includes(p.status)) && pubs.some((p) => p.status === 'failed') && pubs.some((p) => p.status === 'published')) status = 'partially_published';
  else if (pubs.every((p) => p.status === 'failed')) status = 'failed';
  else if (pubs.some((p) => ['pending', 'publishing'].includes(p.status))) status = 'publishing';
  else status = 'partially_published'; // mixed failed/cancelled with no successes yet decided

  await SocialPost.updateOne({ _id: postId }, { $set: { status } });
  return status;
}

async function cancelPost(post) {
  const nonTerminal = await SocialPublication.find({ socialPost: post._id, status: { $in: ['pending', 'publishing'] } });
  for (const pub of nonTerminal) {
    if (pub.bullJobId) {
      try {
        const { socialPublishQueue } = require('../../../queues/socialPublishQueue');
        const job = await socialPublishQueue.getJob(pub.bullJobId);
        if (job) await job.remove();
      } catch { /* best-effort — the worker's own status re-check backstops this */ }
    }
    pub.status = 'cancelled';
    await pub.save();
  }
  post.status = 'cancelled';
  await post.save();
  return post;
}

// Manual retry — only for a publication currently `failed` with
// `retryable !== false`. Re-enqueues a fresh immediate job for that
// publication ONLY (never touches its siblings).
async function retryPublication(publication) {
  publication.status = 'pending';
  publication.retryCount += 1;
  const jobId = await addSocialPublishToQueue(publication._id, { delay: 0 });
  publication.bullJobId = jobId;
  await publication.save();
  await recomputePostStatus(publication.socialPost);
  return publication;
}

module.exports = {
  validateSelection,
  publishNow,
  schedulePost,
  recomputePostStatus,
  cancelPost,
  retryPublication,
};
