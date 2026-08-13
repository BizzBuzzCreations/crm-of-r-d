'use strict';
const mongoose = require('mongoose');

// One import batch of prospect businesses to audit — mirrors Campaign.js's
// role relative to CampaignLead (this file's counterpart is ProspectAudit.js).
const ProspectAuditBatchSchema = new mongoose.Schema({
  name:   { type: String, required: [true, 'Batch name is required'], trim: true },
  status: { type: String, enum: ['draft', 'crawling', 'paused', 'completed'], default: 'draft' },

  totalCount:   { type: Number, default: 0 },
  crawledCount: { type: Number, default: 0 }, // crawlStatus: 'ok' | 'dead' | 'blocked' | 'timeout'
  failedCount:  { type: Number, default: 0 }, // crawlStatus: 'dead' | 'blocked' | 'timeout' (subset of crawledCount)

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

ProspectAuditBatchSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('ProspectAuditBatch', ProspectAuditBatchSchema);
