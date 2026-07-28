'use strict';
// One document per anonymous browser (visitorId persisted client-side in
// localStorage by the tracking snippet). Survives across sessions so we can
// tell new vs returning visitors. Gets linked to a real CRM Lead the moment
// the visitor submits a tracked lead form (see witPublicController.js).
const mongoose = require('mongoose');

const WitVisitorSchema = new mongoose.Schema({
  visitorId:   { type: String, required: true },
  websiteId:   { type: mongoose.Schema.Types.ObjectId, ref: 'TrackedWebsite', required: true },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt:  { type: Date, default: Date.now },
  totalSessions: { type: Number, default: 0 },
  country:  { type: String, default: '' },
  region:   { type: String, default: '' },
  city:     { type: String, default: '' },
  leadId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
  leadIdentifiedAt: { type: Date, default: null },
}, { timestamps: true });

WitVisitorSchema.index({ websiteId: 1, visitorId: 1 }, { unique: true });
WitVisitorSchema.index({ websiteId: 1, firstSeenAt: 1 });
WitVisitorSchema.index({ leadId: 1 });

module.exports = mongoose.model('WitVisitor', WitVisitorSchema);
