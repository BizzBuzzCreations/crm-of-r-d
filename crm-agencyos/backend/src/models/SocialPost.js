'use strict';
// A composed social post — the content + media + target accounts a user
// creates once, published/scheduled to N accounts via N SocialPublication
// rows (see SocialPublication.js). No platform-specific IDs live here (those
// belong on the publication, since one post can succeed on one platform and
// fail on another).
const mongoose = require('mongoose');

const SocialMediaItemSchema = new mongoose.Schema({
  url:      { type: String, required: true }, // public /uploads/... URL
  type:     { type: String, enum: ['image', 'video'], required: true },
  width:    { type: Number, default: null },
  height:   { type: Number, default: null },
  duration: { type: Number, default: null }, // seconds, video only
}, { _id: false });

const SocialPostSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:   { type: String, default: '' }, // plain text — used as caption/commentary/description across every platform
  title:     { type: String, default: '' }, // YouTube video title only — ignored by every other provider
  media:     { type: [SocialMediaItemSchema], default: [] },

  status: {
    type: String,
    enum: ['draft', 'scheduled', 'publishing', 'partially_published', 'published', 'failed', 'cancelled'],
    default: 'draft',
  },

  scheduledAt: { type: Date, default: null },
  timezone:    { type: String, default: 'Asia/Kolkata' },

  // Chosen at compose time, before SocialPublication rows exist. Once
  // published/scheduled, the authoritative per-account state lives on the
  // publications — this stays as the record of original intent.
  selectedAccounts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SocialAccount' }],

  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

SocialPostSchema.index({ status: 1, scheduledAt: 1 });
SocialPostSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('SocialPost', SocialPostSchema);
