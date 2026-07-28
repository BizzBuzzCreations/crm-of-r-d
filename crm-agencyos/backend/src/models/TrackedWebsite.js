'use strict';
// A website registered for Website Intelligence tracking (Settings → Websites).
// trackingId is public — it ships inside the embedded JS snippet on the site,
// so anyone can technically see it in page source. That's fine for the
// low-stakes event-collection endpoint (worst case: noise pageviews), but the
// lead-capture endpoint additionally requires apiSecret, which is only ever
// shown once at creation/regeneration and never round-tripped afterward —
// same "never re-displayed" pattern as EmailAccount/MetaAdsAccount secrets.
const mongoose = require('mongoose');
const crypto = require('crypto');
const { encrypt, decrypt } = require('../utils/crypto');

const TrackedWebsiteSchema = new mongoose.Schema({
  name:        { type: String, required: [true, 'Website name is required'], trim: true },
  domain:      { type: String, required: [true, 'Domain is required'], trim: true },
  trackingId:  { type: String, required: true, unique: true },
  apiSecretEncrypted: { type: String, default: '', select: false },
  isActive:    { type: Boolean, default: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

TrackedWebsiteSchema.virtual('apiSecret')
  .set(function (val) { this.apiSecretEncrypted = encrypt(val); })
  .get(function () { return decrypt(this.apiSecretEncrypted); });

TrackedWebsiteSchema.statics.generateTrackingId = function () {
  return 'wit_' + crypto.randomBytes(12).toString('hex');
};
TrackedWebsiteSchema.statics.generateApiSecret = function () {
  return crypto.randomBytes(24).toString('hex');
};

module.exports = mongoose.model('TrackedWebsite', TrackedWebsiteSchema);
