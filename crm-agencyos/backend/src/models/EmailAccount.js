'use strict';
const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/crypto');

const EmailAccountSchema = new mongoose.Schema({
  name:       { type: String, required: [true, 'Account name is required'], trim: true },
  email:      { type: String, required: [true, 'Email address is required'], trim: true, lowercase: true },
  fromName:   { type: String, default: '' },
  replyTo:    { type: String, default: '' },

  // Every account is connected by (and owned by) a specific user. Admins/
  // managers can see and use everyone's accounts (needed to build company
  // campaigns); everyone else only ever sees their own — this is what
  // makes "multiple mail server connections" work per-person instead of
  // one shared/global config.
  owner:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ── SMTP (sending) — required, this is the account's core capability ──
  smtpHost:   { type: String, required: [true, 'SMTP host is required'] },
  smtpPort:   { type: Number, default: 587 },
  smtpSecure: { type: Boolean, default: false },
  smtpUser:   { type: String, required: [true, 'SMTP username is required'] },
  smtpPassEncrypted: { type: String, required: true, select: false },
  // Off (secure) by default — only for internal/self-hosted mail servers
  // presenting a self-signed or otherwise untrusted certificate.
  smtpAllowInsecureTLS: { type: Boolean, default: false },
  lastSmtpVerifiedAt: { type: Date, default: null },
  lastSmtpVerifyError: { type: String, default: '' },

  // ── IMAP (receiving / inbox sync) — optional ───────────────────────────
  imapEnabled: { type: Boolean, default: false },
  imapHost:    { type: String, default: '' },
  imapPort:    { type: Number, default: 993 },
  imapSecure:  { type: Boolean, default: true },
  imapUser:    { type: String, default: '' },
  imapPassEncrypted: { type: String, default: '', select: false },
  imapAllowInsecureTLS: { type: Boolean, default: false },
  lastImapVerifiedAt: { type: Date, default: null },
  lastImapVerifyError: { type: String, default: '' },
  // Reply-sync watermark (see cron/replySync.js) — the highest INBOX UID
  // already scanned, so each poll only looks at mail that arrived since the
  // last check instead of re-scanning the whole mailbox. Left null until
  // the first successful poll, which intentionally only records the current
  // UID as a baseline without processing anything — a newly IMAP-connected
  // mailbox can have years of history, and none of it are actual campaign
  // replies just because IMAP was switched on today.
  imapLastUid: { type: Number, default: null },

  dailySendLimit: { type: Number, default: 100 }, // per-account safety ceiling, separate from per-campaign dailyLimit — this is the RAMP TARGET once warm-up (below) finishes
  isActive:   { type: Boolean, default: true },

  // ── Warm-up ramp ─────────────────────────────────────────────────────
  // New accounts/domains have no sending history — receiving servers treat
  // a sudden burst of volume from an unfamiliar sender as suspicious.
  // Ramps the effective daily cap from warmupStartLimit up to
  // dailySendLimit linearly over warmupDays. See utils/warmup.js.
  warmupEnabled:    { type: Boolean, default: false },
  warmupStartDate:  { type: Date, default: null },
  warmupDays:       { type: Number, default: 14 },
  warmupStartLimit: { type: Number, default: 5 },

  totalSent:  { type: Number, default: 0 }, // lifetime counter, informational

  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // kept for audit trail; owner is the access-control field
  isDeleted:  { type: Boolean, default: false },
}, { timestamps: true });

// Virtual setters/getters so callers can work with plaintext `smtpPass` /
// `imapPass` while they're transparently encrypted at rest.
EmailAccountSchema.virtual('smtpPass')
  .set(function (val) { this.smtpPassEncrypted = encrypt(val); })
  .get(function () { return decrypt(this.smtpPassEncrypted); });

EmailAccountSchema.virtual('imapPass')
  .set(function (val) { this.imapPassEncrypted = encrypt(val); })
  .get(function () { return decrypt(this.imapPassEncrypted); });

EmailAccountSchema.set('toJSON',   { virtuals: false });
EmailAccountSchema.set('toObject', { virtuals: false });

EmailAccountSchema.index({ isDeleted: 1, isActive: 1 });
EmailAccountSchema.index({ owner: 1 });

module.exports = mongoose.model('EmailAccount', EmailAccountSchema);
