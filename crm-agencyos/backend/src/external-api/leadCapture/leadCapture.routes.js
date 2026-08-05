'use strict';
const express = require('express');
const cors = require('cors');
const optionalApiKeyAuth = require('../middleware/optionalApiKeyAuth');
const { publicLeadCaptureLimiter } = require('../../middleware/rateLimiters');
const ctrl = require('./leadCapture.controller');

const router = express.Router();

// Open CORS on purpose — this endpoint is meant to be called from ANY of
// many external sites, not a pre-registered allowlist (see sources.js).
// For a caller with no way to hold a secret (a truly frontend-only site,
// browser JS calling directly) this is the only boundary there is.
router.use(cors());

// Key is OPTIONAL, not required — this endpoint must stay reachable from
// callers with nowhere safe to keep a secret (a frontend-only site's own
// browser JS), while still recognizing callers that DO have somewhere safe
// to hold one (e.g. a Netlify Function proxying a form submission
// server-side). No key → treated as anonymous, still works, still subject
// to the rate limit + honeypot below. Valid key → req.apiKey is set,
// exempts the caller from publicLeadCaptureLimiter (see rateLimiters.js).
// Invalid key → 401, not a silent fallback to anonymous.
router.post('/:source', optionalApiKeyAuth, publicLeadCaptureLimiter, ctrl.captureLead);

module.exports = router;
