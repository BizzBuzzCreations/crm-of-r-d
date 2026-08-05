'use strict';
const ApiKey = require('../../models/ApiKey');

// Like apiKeyAuth.js, but the key is optional rather than required — for
// domains that must stay reachable from callers with NO way to hold a
// secret (leadCapture's frontend-only sites) while still recognizing
// callers that DO have one (e.g. a Netlify Function proxying a form
// submission server-side, which can safely hold a real API key).
//
// - No `secret` sent at all → treated as anonymous, `next()` with
//   `req.apiKey` left undefined. This is the expected path for a
//   backend-less site; do not reject it.
// - A `secret` IS sent but doesn't match any key → `401`, not a silent
//   fallback to anonymous. Someone who bothered to send a credential
//   expects it to be checked; treating a typo'd/revoked key as "no key"
//   would hide a real integration bug from whoever's debugging it.
// - Valid `secret` → `req.apiKey` is set, same as the mandatory
//   `apiKeyAuth`, so downstream code can tell trusted callers apart
//   (leadCapture uses this to skip its own rate limit for them).
module.exports = async function optionalApiKeyAuth(req, res, next) {
  try {
    const provided = req.query?.secret || req.body?.secret;
    if (!provided) return next();
    const key = await ApiKey.resolve(provided);
    if (!key) {
      return res.status(401).json({ success: false, message: 'Invalid or revoked API key' });
    }
    req.apiKey = key;
    next();
  } catch (err) { next(err); }
};
