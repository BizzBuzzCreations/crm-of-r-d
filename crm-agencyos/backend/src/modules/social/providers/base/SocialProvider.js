'use strict';
// Common contract every platform provider implements. SocialService
// (../../services/socialService.js) is the only thing controllers/workers
// call — it resolves `platform -> provider instance` and never contains
// platform-specific API logic itself, so adding a new platform later is
// "write a provider implementing this contract, add one registry line."
class SocialProvider {
  /** @returns {string} the platform's OAuth authorize URL for this `state` */
  getAuthUrl(_state, _redirectUri) {
    throw new Error('getAuthUrl() not implemented');
  }

  /** @returns {Promise<{accessToken, refreshToken, expiresAt, scopes}>} */
  async exchangeCode(_code, _redirectUri) {
    throw new Error('exchangeCode() not implemented');
  }

  /** @returns {Promise<Array<{platformAccountId, accountName, username, profileImage, metadata}>>} */
  async getAccountInfo(_accessToken) {
    throw new Error('getAccountInfo() not implemented');
  }

  /** Cheap liveness check — used by the "reconnect needed?" UI state. */
  async validateAccount(_account) {
    throw new Error('validateAccount() not implemented');
  }

  /**
   * Best-effort — not every platform supports a real refresh-token grant
   * (see MetaProvider/LinkedInProvider notes). Returns the updated token
   * fields, or throws SocialPublishError({code:'TOKEN_EXPIRED'}) if the
   * account genuinely needs the user to reconnect.
   */
  async refreshToken(_account) {
    throw new Error('refreshToken() not implemented');
  }

  /** @returns {Promise<{platformPostId, publishedUrl}>} throws SocialPublishError on failure */
  async publishPost(_account, _post) {
    throw new Error('publishPost() not implemented');
  }

  /** @returns {{requiresMedia:boolean, maxTextLength:number, supportedMediaTypes:string[], maxMediaCount:number, maxVideoSizeMb:number}} */
  getCapabilities() {
    throw new Error('getCapabilities() not implemented');
  }
}

module.exports = SocialProvider;
