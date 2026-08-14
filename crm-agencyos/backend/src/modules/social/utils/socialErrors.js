'use strict';
// Normalized publishing error shape every provider throws instead of
// leaking raw platform SDK/HTTP errors up to the worker. `retryable` is the
// single source of truth the worker uses to decide "let BullMQ's
// attempts/backoff retry this" (transient — timeouts, 5xx, rate limits) vs
// "save as permanently failed, only a manual Retry can re-attempt it, and
// only after whatever's actually wrong is fixed" (token/permission/media/
// validation errors — retrying blindly just burns rate-limit budget).
const RETRYABLE_CODES = new Set(['RATE_LIMITED', 'NETWORK_ERROR', 'PLATFORM_ERROR', 'UNKNOWN_ERROR']);
const NON_RETRYABLE_CODES = new Set(['TOKEN_EXPIRED', 'PERMISSION_DENIED', 'INVALID_MEDIA', 'VALIDATION_ERROR']);

class SocialPublishError extends Error {
  constructor({ platform, code = 'UNKNOWN_ERROR', message, retryable }) {
    super(message || code);
    this.name = 'SocialPublishError';
    this.platform = platform;
    this.code = code;
    this.retryable = typeof retryable === 'boolean' ? retryable : !NON_RETRYABLE_CODES.has(code);
  }

  toJSON() {
    return { platform: this.platform, code: this.code, message: this.message, retryable: this.retryable };
  }
}

module.exports = { SocialPublishError, RETRYABLE_CODES, NON_RETRYABLE_CODES };
