'use strict';
// A connected Facebook Page / Instagram Business account / LinkedIn Company
// Page. CRM-wide (no workspace/tenant concept in this app — see the Social
// Media Management plan), gated by role via Feature Access Control
// (featureKey 'social_media'), same shared-pool model as MetaAdsAccount/
// EmailAccount. `connectedBy` is audit-only, not an access-control field —
// any admin/manager can see and use any connected account.
//
// Tokens are encrypted at rest via utils/crypto.js (same virtual
// getter/setter pattern as EmailAccount.smtpPass) and NEVER serialize to
// JSON even if accidentally `.select('+...')`-fetched — see the
// `toJSON`/`toObject` overrides at the bottom.
const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/crypto');

const SocialAccountSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['facebook_page', 'instagram_business', 'linkedin_organization', 'x', 'youtube', 'tiktok'],
    required: true,
  },
  platformAccountId: { type: String, required: true }, // Page ID / IG Business Account ID / LinkedIn org URN / X user id / YouTube channel id / TikTok open_id
  accountName:        { type: String, default: '' },
  username:            { type: String, default: '' }, // IG @handle, if applicable
  profileImage:        { type: String, default: '' },

  connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  accessTokenEncrypted:  { type: String, default: '', select: false },
  refreshTokenEncrypted: { type: String, default: '', select: false },
  tokenExpiresAt:         { type: Date, default: null },
  scopes:                 { type: [String], default: [] },

  // 'active' = usable; 'expired'/'revoked' surfaced in the UI as "reconnect
  // needed" rather than silently retried (see MetaProvider/LinkedInProvider
  // refreshToken() notes in the plan — Meta Page tokens have no refresh
  // grant, LinkedIn's requires Community Management API approval).
  status: { type: String, enum: ['active', 'expired', 'revoked', 'error'], default: 'active' },

  // Platform-specific extras that don't warrant their own column — e.g. the
  // Facebook Page ID an Instagram account is linked through, or the
  // LinkedIn organization URN's numeric id.
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

SocialAccountSchema.virtual('accessToken')
  .set(function (val) { this.accessTokenEncrypted = encrypt(val); })
  .get(function () { return decrypt(this.accessTokenEncrypted); });

SocialAccountSchema.virtual('refreshToken')
  .set(function (val) { this.refreshTokenEncrypted = encrypt(val); })
  .get(function () { return decrypt(this.refreshTokenEncrypted); });

SocialAccountSchema.set('toJSON',   { virtuals: false });
SocialAccountSchema.set('toObject', { virtuals: false });

SocialAccountSchema.index({ platform: 1, platformAccountId: 1 }, { unique: true });

module.exports = mongoose.model('SocialAccount', SocialAccountSchema);
