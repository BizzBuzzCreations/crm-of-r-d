'use strict';
// One document per page visited within a session. Drives Page Analytics
// (views, time on page, scroll depth, exit rate) independent of the
// session-level rollup in WitSession.
const mongoose = require('mongoose');

const WitPageviewSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  visitorId: { type: String, required: true },
  websiteId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackedWebsite', required: true },

  url:   { type: String, required: true },
  path:  { type: String, required: true }, // pathname only, for grouping across query-string variants
  title: { type: String, default: '' },

  order: { type: Number, default: 0 }, // position within the session (0 = landing page)
  enteredAt: { type: Date, default: Date.now },
  exitedAt:  { type: Date, default: null },
  duration:  { type: Number, default: 0 }, // seconds
  maxScrollDepth: { type: Number, default: 0 }, // 0-100 %
  isExit: { type: Boolean, default: false }, // true once we know this was the session's last page
}, { timestamps: true });

WitPageviewSchema.index({ websiteId: 1, path: 1, enteredAt: -1 });
WitPageviewSchema.index({ sessionId: 1, order: 1 });

module.exports = mongoose.model('WitPageview', WitPageviewSchema);
