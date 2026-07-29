'use strict';
// Rate limiters for the two classes of unauthenticated endpoint in this app:
// credential guessing (login) and public tracking-snippet abuse (wit). Both
// rely on `trust proxy` (set in app.js) so the limiter keys on the real
// visitor IP from X-Forwarded-For, not nginx's own loopback address.
const rateLimit = require('express-rate-limit');

// Login: unauthenticated, credential-guessable — kept tight. Counts only
// failed/attempted requests, not a general traffic cap.
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests.' },
});
