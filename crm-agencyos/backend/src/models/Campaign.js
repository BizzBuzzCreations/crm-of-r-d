'use strict';
const mongoose = require('mongoose');

const CampaignSettingsSchema = new mongoose.Schema({
  accounts:           [{ type: mongoose.Schema.Types.ObjectId, ref: 'EmailAccount' }],
  stopOnReply:        { type: Boolean, default: true },
  openTracking:       { type: Boolean, default: true },
  linkTracking:       { type: Boolean, default: false },
  // Off by choice, not by accident: commercial email is legally required to
  // carry an opt-out mechanism in most jurisdictions (CAN-SPAM etc.), and
  // Gmail/Yahoo increasingly penalize bulk senders that lack List-Unsubscribe.
  // Defaults true so disabling it is always a deliberate, informed action.
  includeUnsubscribeLink: { type: Boolean, default: true },
  textOnly:           { type: Boolean, default: false },
  firstEmailTextOnly: { type: Boolean, default: false },
  dailyLimit:         { type: Number, default: 30 },
  minGapMinutes:      { type: Number, default: 9 },
  randomGapMinutes:   { type: Number, default: 5 },
  maxNewLeadsPerDay:  { type: Number, default: null }, // null = no limit

  // Sending hours window — avoids the robotic look of off-hours sends,
  // which hurts engagement-based reputation scoring. See utils/sendingWindow.js.
  sendingHoursEnabled: { type: Boolean, default: false },
  sendingHourStart:    { type: Number, default: 9 },  // 0-23, local to `timezone`
  sendingHourEnd:      { type: Number, default: 18 }, // 0-23, local to `timezone`
  sendingDays:         { type: [Number], default: [1, 2, 3, 4, 5] }, // 0=Sun..6=Sat
  timezone:            { type: String, default: 'Asia/Kolkata' },
}, { _id: false });

const CampaignSchema = new mongoose.Schema({
  name:        { type: String, required: [true, 'Campaign name is required'], trim: true },
  status:      { type: String, enum: ['draft', 'active', 'paused', 'completed'], default: 'draft' },

  subject:     { type: String, default: '' },
  bodyHtml:    { type: String, default: '' }, // supports {{firstName}} {{lastName}} {{email}} merge tags

  settings:    { type: CampaignSettingsSchema, default: () => ({}) },

  // Pacing state — read/written by the dispatcher cron, not user-editable
  lastSentAt:      { type: Date, default: null },
  nextEligibleAt:  { type: Date, default: null },
  lastAccountIndex: { type: Number, default: -1 },

  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted:   { type: Boolean, default: false },
}, { timestamps: true });

CampaignSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);
