'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');

const OpenEventSchema = new mongoose.Schema({
  at:        { type: Date, default: Date.now },
  ip:        { type: String, default: '' },
  userAgent: { type: String, default: '' },
}, { _id: false });

const ClickEventSchema = new mongoose.Schema({
  at:  { type: Date, default: Date.now },
  url: { type: String, default: '' },
}, { _id: false });

const CampaignLeadSchema = new mongoose.Schema({
  campaign:   { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },

  email:      { type: String, required: [true, 'Email is required'], trim: true, lowercase: true },
  firstName:  { type: String, default: '' },
  lastName:   { type: String, default: '' },
  // Optional — imported alongside email/first/last name. Sent together with
  // email when reporting engagement to IVA CRM (see utils/mainCrmNotify.js),
  // giving their lead-matcher both identifiers to work with instead of just one.
  phone:      { type: String, default: '', trim: true },

  status: {
    type: String,
    enum: ['pending', 'scheduled', 'sending', 'sent', 'failed', 'bounced', 'replied', 'unsubscribed'],
    default: 'pending',
  },

  accountUsed: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailAccount', default: null },

  // Email verification — syntax + MX record check (see utils/emailVerify.js).
  // Not a full SMTP mailbox-exists check; see that file for why.
  verificationStatus: { type: String, enum: ['unverified', 'valid', 'invalid', 'risky'], default: 'unverified' },
  verificationDetail: { type: String, default: '' },
  provider:           { type: String, default: '' }, // e.g. "Gmail", "Google Workspace", "Microsoft 365"
  verifiedAt:         { type: Date, default: null },

  sentAt:         { type: Date, default: null },
  openedAt:       { type: Date, default: null }, // most recent open — kept for fast sort/filter
  openCount:      { type: Number, default: 0 },
  // Full history of opens (capped — see trackingController). openedAt/openCount
  // above are denormalized copies of this for cheap queries/stats.
  opens:          { type: [OpenEventSchema], default: [] },
  clickedAt:      { type: Date, default: null }, // most recent click — kept for fast sort/filter
  clickCount:     { type: Number, default: 0 },
  clicks:         { type: [ClickEventSchema], default: [] }, // full history, capped — see trackingController
  repliedAt:      { type: Date, default: null },
  unsubscribedAt: { type: Date, default: null },
  // Clicked the "Request a Call" button in the email (see trackingController
  // .requestCall) — a deliberate, purpose-built CTA distinct from a generic
  // link click, so it can trigger the pipeline sync as its own strong signal
  // (same tier as an actual reply) instead of just adding to clickCount.
  callRequested:   { type: Boolean, default: false },
  callRequestedAt: { type: Date, default: null },
  error:          { type: String, default: '' },

  // Single opaque token used for the open pixel, click redirects, and the
  // unsubscribe link — unguessable, unrelated to the Mongo _id.
  token: { type: String, unique: true, default: () => crypto.randomBytes(16).toString('hex') },
}, { timestamps: true });

CampaignLeadSchema.index({ campaign: 1, status: 1 });
CampaignLeadSchema.index({ campaign: 1, email: 1 }, { unique: true }); // no duplicate import within a campaign

module.exports = mongoose.model('CampaignLead', CampaignLeadSchema);
