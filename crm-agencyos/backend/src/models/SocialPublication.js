'use strict';
// One row per (SocialPost, SocialAccount) pair — the unit of publishing,
// retrying, and BullMQ job scheduling (one job per publication, not per
// post, so retrying a failed LinkedIn publication never re-triggers an
// already-succeeded Facebook one — see socialPublishQueue.js).
const mongoose = require('mongoose');

const SocialPublicationSchema = new mongoose.Schema({
  socialPost:    { type: mongoose.Schema.Types.ObjectId, ref: 'SocialPost', required: true },
  socialAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialAccount', required: true },
  platform:      { type: String, required: true }, // denormalized from socialAccount for fast filtering

  status: {
    type: String,
    enum: ['pending', 'publishing', 'published', 'failed', 'cancelled'],
    default: 'pending',
  },

  platformPostId: { type: String, default: '' },
  publishedUrl:   { type: String, default: '' },
  publishedAt:    { type: Date, default: null },

  // Normalized error fields — see utils/socialErrors.js. `retryable` is what
  // the worker/manual-retry-endpoint check before re-enqueuing; permanent
  // errors (token/permission/media) are never auto-retried by BullMQ.
  errorCode:    { type: String, default: '' },
  errorMessage: { type: String, default: '' },
  retryable:    { type: Boolean, default: null },
  retryCount:   { type: Number, default: 0 },
  lastAttemptAt: { type: Date, default: null },

  // The BullMQ job currently responsible for this publication (delayed or
  // active) — tracked so cancel() can best-effort remove a still-pending
  // delayed job instead of only relying on the worker's own status re-check.
  bullJobId: { type: String, default: '' },
}, { timestamps: true });

SocialPublicationSchema.index({ socialPost: 1 });
SocialPublicationSchema.index({ status: 1 });

module.exports = mongoose.model('SocialPublication', SocialPublicationSchema);
