'use strict';
// Admin-issued credentials for server-to-server callers (currently: the main
// CRM pulling lead email activity via /api/lead-sync/*). Replaces the old
// single hardcoded LEAD_SYNC_WEBHOOK_SECRET env var — keys are created and
// revoked from the UI (Admin → API Keys) instead of a .env edit + restart.
//
// The raw key is only ever known at creation time (returned once in the
// create response, never stored). What's persisted is a SHA-256 hash — not
// reversible encryption like TrackedWebsite.apiSecret — because unlike that
// secret, nothing ever needs to redisplay this value later, and a one-way
// hash means even a DB dump can't recover a live credential. SHA-256 (not
// bcrypt) is deliberate too: these are high-entropy random tokens, not
// low-entropy user passwords, so there's no brute-force-slowdown need, and
// a fast deterministic hash lets a request just be looked up, not compared
// against every stored key one by one.
const mongoose = require('mongoose');
const crypto = require('crypto');

const ApiKeySchema = new mongoose.Schema({
  name:        { type: String, required: [true, 'Name is required'], trim: true },
  // First segment of the key, kept in plaintext so the UI can show "which
  // key is this" (e.g. rndcrm_a1b2c3d4...) without ever re-deriving or
  // storing the full secret.
  keyPrefix:   { type: String, required: true },
  hashedKey:   { type: String, required: true, unique: true, select: false },
  lastUsedAt:  { type: Date, default: null },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

ApiKeySchema.statics.generateKey = function () {
  return 'rndcrm_' + crypto.randomBytes(24).toString('hex');
};

ApiKeySchema.statics.hash = function (rawKey) {
  return crypto.createHash('sha256').update(String(rawKey)).digest('hex');
};

// Shared lookup used by both external-api/middleware/apiKeyAuth.js (key
// required) and leadCapture's optional variant (key checked only if
// present) — one place for "hash it, look it up, bump lastUsedAt" so the
// two auth paths can't drift apart. Returns null for a missing/unknown
// key; never throws for a bad key, that's the caller's job to reject.
ApiKeySchema.statics.resolve = async function (providedSecret) {
  if (!providedSecret) return null;
  const key = await this.findOne({ hashedKey: this.hash(providedSecret) });
  if (key) this.updateOne({ _id: key._id }, { lastUsedAt: new Date() }).catch(() => {});
  return key;
};

module.exports = mongoose.model('ApiKey', ApiKeySchema);
