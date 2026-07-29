'use strict';
// Constant-time secret comparison, shared by every public/webhook endpoint
// that authenticates via a shared secret instead of a user JWT (Website
// Intelligence lead capture, the main-CRM lead status-sync webhook, ...).
const crypto = require('crypto');

function secretsMatch(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  // timingSafeEqual throws on length mismatch — bail out first so a
  // wrong-length secret still takes the same code path (leaking only
  // "wrong", never "wrong length"; length itself isn't the secret).
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { secretsMatch };
