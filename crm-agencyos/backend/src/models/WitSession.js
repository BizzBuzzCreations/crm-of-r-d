'use strict';
// One document per browsing session (30-minute inactivity timeout, tracked
// client-side). Aggregates what a single visit looked like — device,
// referrer, UTM params, landing/exit page, bounce — so most dashboard
// queries can read this collection alone without joining pageviews.
const mongoose = require('mongoose');

const WitSessionSchema = new mongoose.Schema({
  sessionId:  { type: String, required: true, unique: true },
  visitorId:  { type: String, required: true },
  websiteId:  { type: mongoose.Schema.Types.ObjectId, ref: 'TrackedWebsite', required: true },
  isNewVisitor: { type: Boolean, default: true },

  startedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  endedAt:   { type: Date, default: null },
  duration:  { type: Number, default: 0 }, // seconds

  pageCount: { type: Number, default: 0 },
  isBounce:  { type: Boolean, default: true }, // recomputed as pages come in

  deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'], default: 'unknown' },
  browser:    { type: String, default: '' },
  os:         { type: String, default: '' },

  referrer:       { type: String, default: '' },
  referrerDomain: { type: String, default: '' },
  utmSource:   { type: String, default: '' },
  utmMedium:   { type: String, default: '' },
  utmCampaign: { type: String, default: '' },
  utmTerm:     { type: String, default: '' },
  utmContent:  { type: String, default: '' },
  trafficSource: {
    type: String,
    enum: ['organic', 'direct', 'paid-meta', 'paid-google', 'linkedin', 'social', 'email', 'referral'],
    default: 'direct',
  },

  landingPage: { type: String, default: '' },
  exitPage:    { type: String, default: '' },

  country: { type: String, default: '' },
  region:  { type: String, default: '' },
  city:    { type: String, default: '' },
  ip:      { type: String, default: '' },

  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
}, { timestamps: true });

WitSessionSchema.index({ websiteId: 1, startedAt: -1 });
WitSessionSchema.index({ websiteId: 1, trafficSource: 1, startedAt: -1 });
WitSessionSchema.index({ visitorId: 1 });

module.exports = mongoose.model('WitSession', WitSessionSchema);
