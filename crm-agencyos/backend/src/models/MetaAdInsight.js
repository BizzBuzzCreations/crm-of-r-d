'use strict';
// One row per (level, entity, day) — the raw counters only. Ratios (CTR, CPC,
// CPM) are deliberately NOT stored here: averaging Meta's per-row ratios
// across a date range or rolling up campaign->adset->ad would be statistically
// wrong ("average of averages"). Always derive them from summed
// spend/clicks/impressions at query time (see metaAdsController.js).
const mongoose = require('mongoose');

const MetaAdInsightSchema = new mongoose.Schema({
  level:            { type: String, enum: ['campaign', 'adset', 'ad'], required: true },
  entityId:         { type: String, required: true },
  entityName:       { type: String, default: '' },
  campaignId:       { type: String, default: null },
  campaignName:     { type: String, default: '' },
  adsetId:          { type: String, default: null },
  adsetName:        { type: String, default: '' },
  date:             { type: String, required: true }, // YYYY-MM-DD, account timezone
  spend:            { type: Number, default: 0 },
  impressions:      { type: Number, default: 0 },
  reach:             { type: Number, default: 0 },
  clicks:            { type: Number, default: 0 }, // all clicks
  linkClicks:        { type: Number, default: 0 }, // inline_link_clicks — outbound clicks specifically
  landingPageViews:  { type: Number, default: 0 },
  conversions:        { type: Number, default: 0 }, // Meta-reported lead/conversion actions — see metaAdsClient.js CONVERSION_ACTION_MATCH
}, { timestamps: true });

MetaAdInsightSchema.index({ level: 1, entityId: 1, date: 1 }, { unique: true });
MetaAdInsightSchema.index({ level: 1, date: 1 });
MetaAdInsightSchema.index({ campaignId: 1, date: 1 });

module.exports = mongoose.model('MetaAdInsight', MetaAdInsightSchema);
