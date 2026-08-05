'use strict';
// Rate limiters for the two classes of unauthenticated endpoint in this app:
// credential guessing (login) and public tracking-snippet abuse (wit). Both
// rely on `trust proxy` (set in app.js) so the limiter keys on the real
// visitor IP from X-Forwarded-For, not nginx's own loopback address.
//
// Request-count caps (loginMax/witPublicMax) are configurable from
// Settings → Security at runtime, no redeploy needed — see
// SystemSettings.rateLimits. windowMs is NOT configurable: express-rate-
// limit's MemoryStore bakes windowMs into its internal cleanup timer at
// creation time, so changing it at runtime wouldn't actually take effect
// without recreating the whole limiter — that's a footgun disguised as a
// setting, not a real one. The count cap is the lever that matters
// day-to-day anyway (it's what a legitimate automation like n8n can run
// into, same as what a credential-guessing bot runs into).
const rateLimit = require('express-rate-limit');
const { SystemSettings } = require('../models/index');

const DEFAULTS = { loginMax: 30, witPublicMax: 100 };
const CACHE_TTL_MS = 15 * 1000;
let cache = { at: 0, ...DEFAULTS };

async function getCurrentLimits() {
  if (Date.now() - cache.at < CACHE_TTL_MS) return cache;
  try {
    const settings = await SystemSettings.findOne().select('rateLimits').lean();
    cache = {
      at: Date.now(),
      loginMax: settings?.rateLimits?.loginMax || DEFAULTS.loginMax,
      witPublicMax: settings?.rateLimits?.witPublicMax || DEFAULTS.witPublicMax,
    };
  } catch {
    // DB hiccup — keep serving the last-known values rather than letting a
    // transient Mongo error break the rate limiter itself; just retry sooner.
    cache.at = Date.now() - CACHE_TTL_MS + 5000;
  }
  return cache;
}

// Called by settingsController.updateSystemSettings right after a save that
// touches rateLimits, so a changed cap takes effect immediately instead of
// waiting out the cache TTL.
exports.invalidateLimitsCache = () => { cache.at = 0; };

exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: async () => (await getCurrentLimits()).loginMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in a few minutes.' },
});

// Public wit tracking endpoints (pageview/pageend/ping/form-event/lead):
// real traffic from many genuine visitors can share one IP (NAT, corporate
// network, mobile carrier CGNAT), and an active tab pings every 20s — so
// this caps sustained flooding/abuse without tripping on legitimate use.
exports.witPublicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: async () => (await getCurrentLimits()).witPublicMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests.' },
});

// Public lead-capture endpoints (external-api/leadCapture) — no API key
// required, so for an anonymous caller this rate limit IS the primary abuse
// defense, not a backstop like the other two limiters above. Skipped
// entirely for a caller that presented a valid API key (see
// optionalApiKeyAuth, mounted before this) — a trusted, admin-issued
// integration (e.g. a Netlify Function proxying a form submission)
// shouldn't share a 20/min cap meant to contain anonymous/unknown traffic.
// Fixed rather than SystemSettings-configurable like witPublicMax/loginMax
// for now: no admin UI for this domain's limits yet — revisit if that changes.
exports.publicLeadCaptureLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !!req.apiKey,
  message: { success: false, message: 'Too many requests.' },
});
