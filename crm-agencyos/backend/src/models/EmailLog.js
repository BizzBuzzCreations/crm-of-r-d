'use strict';
const mongoose = require('mongoose');

const EmailLogSchema = new mongoose.Schema({
  leadId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
  recipientEmail: { type: String, required: true },
  cc:             { type: String, default: null },
  emailType:      { type: String, required: true },
  subject:        { type: String, required: true },
  bodyText:       { type: String, default: '' },
  bodyHtml:       { type: String, default: '' },
  status:         { type: String, enum: ['sent', 'failed'], default: 'sent' },
  messageId:      { type: String, default: '' },
  triggeredBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sentAt:         { type: Date, default: Date.now },
}, { timestamps: true });

EmailLogSchema.index({ leadId: 1, sentAt: -1 });
EmailLogSchema.index({ recipientEmail: 1, sentAt: -1 });

module.exports = mongoose.model('EmailLog', EmailLogSchema);
