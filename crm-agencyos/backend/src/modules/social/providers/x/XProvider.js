'use strict';
// X (Twitter) — OAuth 2.0 with PKCE (required by X for the authorize step),
// tweet creation via API v2, media upload via the still-v1.1
// INIT/APPEND/FINALIZE chunked endpoint (X has never moved media upload to
// v2 — this is not a mistake, it's how X's own API is actually shaped).
// Unlike Meta, X issues real OAuth refresh tokens (with the offline.access
// scope) — refreshToken() here is a genuine token refresh, not just a
// liveness re-check.
const { SocialPublishError } = require('../../utils/socialErrors');

const AUTH_BASE = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const API_BASE = 'https://api.twitter.com/2';
const UPLOAD_BASE = 'https://upload.twitter.com/1.1/media/upload.json';
const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

function basicAuth(id, secret) {
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

async function xFetch(path, { method = 'GET', token, body, isForm = false } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new SocialPublishError({ platform: 'x', code: 'NETWORK_ERROR', message: err.message });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw classifyXError(data, res.status);
  return data;
}

function classifyXError(data = {}, httpStatus) {
  const message = data.detail || data.title || data.errors?.[0]?.message || `X API error (HTTP ${httpStatus})`;
  if (httpStatus === 401) return new SocialPublishError({ platform: 'x', code: 'TOKEN_EXPIRED', message, retryable: false });
  if (httpStatus === 403) return new SocialPublishError({ platform: 'x', code: 'PERMISSION_DENIED', message, retryable: false });
  if (httpStatus === 429) return new SocialPublishError({ platform: 'x', code: 'RATE_LIMITED', message, retryable: true });
  if (httpStatus === 422 || httpStatus === 400) return new SocialPublishError({ platform: 'x', code: 'VALIDATION_ERROR', message, retryable: false });
  if (httpStatus >= 500) return new SocialPublishError({ platform: 'x', code: 'PLATFORM_ERROR', message, retryable: true });
  return new SocialPublishError({ platform: 'x', code: 'UNKNOWN_ERROR', message, retryable: true });
}

// PKCE — X requires a code_challenge on the authorize URL and the matching
// code_verifier on token exchange. We generate the verifier at /connect
// time and smuggle it through inside the signed `state` JWT (see
// socialAccountController.js) rather than server-side session storage —
// same stateless approach used for the state nonce itself.
function base64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

class XProvider {
  constructor({ clientId, clientSecret } = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  static generatePkce() {
    const crypto = require('crypto');
    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    return { verifier, challenge };
  }

  getAuthUrl(state, redirectUri, codeChallenge) {
    const url = new URL(AUTH_BASE);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', SCOPES.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async exchangeCode(code, redirectUri, codeVerifier) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: redirectUri,
      client_id: this.clientId, code_verifier: codeVerifier,
    });
    let res;
    try {
      res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuth(this.clientId, this.clientSecret) },
        body, signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      throw new SocialPublishError({ platform: 'x', code: 'NETWORK_ERROR', message: err.message });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw classifyXError(data, res.status);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: (data.scope || '').split(' ').filter(Boolean),
    };
  }

  async getAccountInfo(accessToken) {
    const { data: user } = await xFetch('/users/me?user.fields=profile_image_url', { token: accessToken });
    return [{
      platform: 'x',
      platformAccountId: user.id,
      accountName: user.name || user.username,
      username: user.username || '',
      profileImage: user.profile_image_url || '',
      accessToken,
      metadata: {},
    }];
  }

  async validateAccount(account) {
    try { await xFetch('/users/me', { token: account.accessToken }); return true; } catch { return false; }
  }

  async refreshToken(account) {
    if (!account.refreshToken) {
      throw new SocialPublishError({ platform: 'x', code: 'TOKEN_EXPIRED', message: 'Reconnect required — no refresh token on file for this X account.', retryable: false });
    }
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: account.refreshToken, client_id: this.clientId });
    let res;
    try {
      res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuth(this.clientId, this.clientSecret) },
        body, signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      throw new SocialPublishError({ platform: 'x', code: 'NETWORK_ERROR', message: err.message });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw classifyXError(data, res.status);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || account.refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  async publishPost(account, post) {
    const body = { text: post.content || '' };
    const media = post.media?.[0];
    if (media) {
      const mediaId = await this.#uploadMedia(account, media);
      body.media = { media_ids: [mediaId] };
    }
    const result = await xFetch('/tweets', { method: 'POST', token: account.accessToken, body });
    const tweetId = result.data?.id;
    return { platformPostId: tweetId, publishedUrl: tweetId ? `https://x.com/${account.username || 'i'}/status/${tweetId}` : '' };
  }

  async #uploadMedia(account, media) {
    let fileRes;
    try { fileRes = await fetch(media.url, { signal: AbortSignal.timeout(30000) }); }
    catch (err) { throw new SocialPublishError({ platform: 'x', code: 'INVALID_MEDIA', message: `Could not fetch media: ${err.message}`, retryable: false }); }
    if (!fileRes.ok) throw new SocialPublishError({ platform: 'x', code: 'INVALID_MEDIA', message: 'Could not fetch media for upload.', retryable: false });
    const buf = Buffer.from(await fileRes.arrayBuffer());
    const mediaType = media.type === 'video' ? 'video/mp4' : (fileRes.headers.get('content-type') || 'image/jpeg');
    const mediaCategory = media.type === 'video' ? 'tweet_video' : 'tweet_image';

    const authHeader = { Authorization: `Bearer ${account.accessToken}` };

    // INIT
    const initForm = new URLSearchParams({ command: 'INIT', total_bytes: String(buf.length), media_type: mediaType, media_category: mediaCategory });
    const initRes = await fetch(UPLOAD_BASE, { method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/x-www-form-urlencoded' }, body: initForm, signal: AbortSignal.timeout(20000) });
    const initData = await initRes.json().catch(() => ({}));
    if (!initRes.ok) throw classifyXError(initData, initRes.status);
    const mediaId = initData.media_id_string;

    // APPEND — single chunk is fine for our realistic size ceiling (see getCapabilities)
    const appendForm = new FormData();
    appendForm.append('command', 'APPEND');
    appendForm.append('media_id', mediaId);
    appendForm.append('segment_index', '0');
    appendForm.append('media', new Blob([buf]), media.type === 'video' ? 'video.mp4' : 'image.jpg');
    const appendRes = await fetch(UPLOAD_BASE, { method: 'POST', headers: authHeader, body: appendForm, signal: AbortSignal.timeout(60000) });
    if (!appendRes.ok) {
      const appendData = await appendRes.json().catch(() => ({}));
      throw classifyXError(appendData, appendRes.status);
    }

    // FINALIZE
    const finalizeForm = new URLSearchParams({ command: 'FINALIZE', media_id: mediaId });
    const finalizeRes = await fetch(UPLOAD_BASE, { method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/x-www-form-urlencoded' }, body: finalizeForm, signal: AbortSignal.timeout(20000) });
    const finalizeData = await finalizeRes.json().catch(() => ({}));
    if (!finalizeRes.ok) throw classifyXError(finalizeData, finalizeRes.status);

    // Video processing is async — poll STATUS until succeeded/failed.
    let info = finalizeData.processing_info;
    for (let i = 0; i < 20 && info && info.state === 'in_progress'; i++) {
      await new Promise((r) => setTimeout(r, (info.check_after_secs || 3) * 1000));
      const statusRes = await fetch(`${UPLOAD_BASE}?command=STATUS&media_id=${mediaId}`, { headers: authHeader, signal: AbortSignal.timeout(20000) });
      const statusData = await statusRes.json().catch(() => ({}));
      info = statusData.processing_info;
      if (info?.state === 'failed') {
        throw new SocialPublishError({ platform: 'x', code: 'INVALID_MEDIA', message: info.error?.message || 'X rejected the media during processing.', retryable: false });
      }
    }

    return mediaId;
  }

  getCapabilities() {
    return { requiresMedia: false, maxTextLength: 280, supportedMediaTypes: ['image', 'video'], maxMediaCount: 1, maxVideoSizeMb: 512, requiresTitle: false };
  }
}

module.exports = XProvider;
