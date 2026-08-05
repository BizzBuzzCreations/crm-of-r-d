'use strict';
const ApiKey = require('../../models/ApiKey');

// Shared auth for every external/partner-facing router under external-api/
// (lead-sync today; more domains later — see external-api/README.md). Mount
// with `router.use(apiKeyAuth)` once per domain router, same way internal
// routers do `router.use(protect)` — every route on that router then
// requires a valid key, no per-handler check needed.
//
// The key travels as `secret` on the query string (GET) or JSON body
// (POST) — every domain here accepts either, so a new domain never has to
// invent its own transport. lastUsedAt is bumped fire-and-forget so
// Admin → API Keys can show which keys are actually still in use.
module.exports = async function apiKeyAuth(req, res, next) {
  try {
    const provided = req.query?.secret || req.body?.secret;
    if (!provided) {
      return res.status(401).json({ success: false, message: 'API key required' });
    }
    const key = await ApiKey.resolve(provided);
    if (!key) {
      return res.status(401).json({ success: false, message: 'Invalid or revoked API key' });
    }
    req.apiKey = key;
    next();
  } catch (err) { next(err); }
};
