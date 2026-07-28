'use strict';
// Latest-known metadata for a campaign/adset/ad (name, status, budget) — NOT
// date-scoped, unlike MetaAdInsight. Refreshed on every sync tick. Budget is
// stored already converted to whole currency units (see metaAdsClient.js's
// currency-aware minor-unit divisor — Meta returns these in the account
// currency's smallest unit, e.g. cents for USD, but NOT for zero-decimal
// currencies like JPY).
const mongoose = require('mongoose');

const MetaAdEntitySchema = new mongoose.Schema({
  level:          { type: String, enum: ['campaign', 'adset', 'ad'], required: true },
  entityId:       { type: String, required: true },
  name:           { type: String, default: '' },
  status:         { type: String, default: '' },   // effective_status: ACTIVE, PAUSED, ARCHIVED, ...
  objective:      { type: String, default: '' },    // campaign-level only
  campaignId:     { type: String, default: null },
  campaignName:   { type: String, default: '' },
  adsetId:        { type: String, default: null },  // ad-level only
  adsetName:      { type: String, default: '' },
  dailyBudget:    { type: Number, default: null },
  lifetimeBudget: { type: Number, default: null },
}, { timestamps: true });

MetaAdEntitySchema.index({ level: 1, entityId: 1 }, { unique: true });
MetaAdEntitySchema.index({ level: 1, campaignId: 1 });
MetaAdEntitySchema.index({ level: 1, adsetId: 1 });

module.exports = mongoose.model('MetaAdEntity', MetaAdEntitySchema);
