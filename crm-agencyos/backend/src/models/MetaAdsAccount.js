'use strict';
// Singleton — one document holding the connected Meta Ad Account's
// credentials (entered via Settings → Meta Ads, not backend/.env — same
// self-service pattern as EmailAccount's SMTP/IMAP passwords: encrypted at
// rest with utils/crypto.js, exposed to callers via a plaintext virtual so
// the rest of the code never touches the encrypted field directly), its
// identity, and the sync job's last-run status.
const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/crypto');

const MetaAdsAccountSchema = new mongoose.Schema({
  // ── Credentials (entered in Settings → Meta Ads) ──────────────────
  adAccountId:        { type: String, default: '' }, // act_XXXXXXXXXX — not secret
  appId:               { type: String, default: '' }, // not secret
  accessTokenEncrypted: { type: String, default: '', select: false },
  appSecretEncrypted:   { type: String, default: '', select: false },

  // ── Identity (refreshed on every successful sync/test) ─────────────
  accountId:      { type: String, default: '' },   // act_XXXXXXXXXX, as confirmed by Meta
  accountName:    { type: String, default: '' },
  currency:       { type: String, default: 'USD' },
  timezoneName:   { type: String, default: '' },
  accountStatus:  { type: Number, default: null },

  // ── Sync status ──────────────────────────────────────────────────
  lastSyncedAt:   { type: Date, default: null },
  lastSyncError:  { type: String, default: '' },
  lastSyncOkAt:   { type: Date, default: null },
}, { timestamps: true });

MetaAdsAccountSchema.virtual('accessToken')
  .set(function (val) { this.accessTokenEncrypted = encrypt(val); })
  .get(function () { return decrypt(this.accessTokenEncrypted); });

MetaAdsAccountSchema.virtual('appSecret')
  .set(function (val) { this.appSecretEncrypted = encrypt(val); })
  .get(function () { return decrypt(this.appSecretEncrypted); });

module.exports = mongoose.model('MetaAdsAccount', MetaAdsAccountSchema);
