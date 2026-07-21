'use strict';
const mongoose = require('mongoose');

const EmailTemplateSchema = new mongoose.Schema({
  name:      { type: String, required: [true, 'Template name is required'], trim: true },
  subject:   { type: String, default: '' },
  bodyHtml:  { type: String, default: '' },

  owner:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

EmailTemplateSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('EmailTemplate', EmailTemplateSchema);
