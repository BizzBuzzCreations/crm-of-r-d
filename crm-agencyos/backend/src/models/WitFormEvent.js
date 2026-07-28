'use strict';
// Form funnel events — the tracking snippet tags a form with
// data-wit-form="quote-request" (falls back to the form's id/name/action)
// and reports view/start/field_blur/submit so Form Analytics can compute
// starts, submissions, abandonment, and field-level drop-off.
const mongoose = require('mongoose');

const WitFormEventSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  visitorId: { type: String, required: true },
  websiteId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackedWebsite', required: true },

  formId: { type: String, required: true },
  url:    { type: String, default: '' },
  path:   { type: String, default: '' },

  type: { type: String, enum: ['view', 'start', 'field_blur', 'submit'], required: true },
  fieldName: { type: String, default: '' }, // only for field_blur
  fieldOrder: { type: Number, default: null }, // position of the field in the form, for drop-off ordering

  createdAt: { type: Date, default: Date.now },
});

WitFormEventSchema.index({ websiteId: 1, formId: 1, type: 1, createdAt: -1 });
WitFormEventSchema.index({ sessionId: 1, formId: 1 });

module.exports = mongoose.model('WitFormEvent', WitFormEventSchema);
