'use strict';
// TikTok — OAuth 2.0 with PKCE, Content Posting API (Direct Post, video
// only). Pulls the video straight from our own public /uploads/... URL
// (source: PULL_FROM_URL) rather than uploading bytes ourselves — TikTok
// fetches it server-to-server, same trick Instagram's container API uses.
//
// IMPORTANT, real platform constraint (not a bug in this code): TikTok
// restricts apps that haven't completed their Content Posting API audit to
// `privacy_level: SELF_ONLY` — posts land as private, visible only to the
// connected creator, until the app is audited and approved for public
// posting. This defaults to SELF_ONLY for exactly that reason; once your
// TikTok app is audited, this can be changed to a public privacy level.
const { SocialPublishError } = require('../../utils/socialErrors');

const AUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const API_BASE = 'https://open.tiktokapis.com/v2';
const SCOPES = ['user.info.basic', 'video.publish'];

async function tt(path, { method = 'GET', token, body } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new SocialPublishError({ platform: 'tiktok', code: 'NETWORK_ERROR', message: err.message });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error?.code === 'error') throw classifyTikTokError(data, res.status);
  return data;
}

function classifyTikTokError(data = {}, httpStatus) {
  const err = data.error || {};
  const message = err.message || `TikTok API error (HTTP ${httpStatus})`;
  const code = err.code;
  if (code === 'access_token_invalid' || httpStatus === 401) return new SocialPublishError({ platform: 'tiktok', code: 'TOKEN_EXPIRED', message, retryable: false });
  if (code === 'scope_not_authorized' || code === 'permission_denied' || httpStatus === 403) return new SocialPublishError({ platform: 'tiktok', code: 'PERMISSION_DENIED', message, retryable: false });
  if (code === 'rate_limit_exceeded' || httpStatus === 429) return new SocialPublishError({ platform: 'tiktok', code: 'RATE_LIMITED', message, retryable: true });
  if (code === 'spam_risk_too_many_posts' || code === 'video_pull_failed' || httpStatus === 400) return new SocialPublishError({ platform: 'tiktok', code: 'VALIDATION_ERROR', message, retryable: false });
  if (httpStatus >= 500) return new SocialPublishError({ platform: 'tiktok', code: 'PLATFORM_ERROR', message, retryable: true });
  return new SocialPublishError({ platform: 'tiktok', code: 'UNKNOWN_ERROR', message, retryable: true });
}

function base64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

class TikTokProvider {
  constructor({ clientKey, clientSecret } = {}) {
    this.clientKey = clientKey;
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
    url.searchParams.set('client_key', this.clientKey);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async exchangeCode(code, redirectUri, codeVerifier) {
    const body = new URLSearchParams({
      client_key: this.clientKey, client_secret: this.clientSecret,
      code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: codeVerifier,
    });
    let res;
    try {
      res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body, signal: AbortSignal.timeout(20000) });
    } catch (err) {
      throw new SocialPublishError({ platform: 'tiktok', code: 'NETWORK_ERROR', message: err.message });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw classifyTikTokError(data, res.status);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: (data.scope || '').split(',').filter(Boolean),
    };
  }

  async getAccountInfo(accessToken) {
    const result = await tt('/user/info/?fields=open_id,display_name,avatar_url', { token: accessToken });
    const user = result.data?.user || {};
    return [{
      platform: 'tiktok',
      platformAccountId: user.open_id,
      accountName: user.display_name || 'TikTok Account',
      username: '',
      profileImage: user.avatar_url || '',
      accessToken,
      metadata: {},
    }];
  }

  async validateAccount(account) {
    try { await tt('/user/info/?fields=open_id', { token: account.accessToken }); return true; } catch { return false; }
  }

  async refreshToken(account) {
    if (!account.refreshToken) {
      throw new SocialPublishError({ platform: 'tiktok', code: 'TOKEN_EXPIRED', message: 'Reconnect required — no refresh token on file for this TikTok account.', retryable: false });
    }
    const body = new URLSearchParams({ client_key: this.clientKey, client_secret: this.clientSecret, grant_type: 'refresh_token', refresh_token: account.refreshToken });
    let res;
    try {
      res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body, signal: AbortSignal.timeout(20000) });
    } catch (err) {
      throw new SocialPublishError({ platform: 'tiktok', code: 'NETWORK_ERROR', message: err.message });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw classifyTikTokError(data, res.status);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || account.refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  async publishPost(account, post) {
    const media = post.media?.[0];
    if (!media || media.type !== 'video') {
      throw new SocialPublishError({ platform: 'tiktok', code: 'INVALID_MEDIA', message: 'TikTok requires a video file.', retryable: false });
    }

    const init = await tt('/post/publish/video/init/', {
      method: 'POST',
      token: account.accessToken,
      body: {
        post_info: {
          title: (post.content || '').slice(0, 150),
          privacy_level: 'SELF_ONLY', // see file-level note — public posting requires TikTok's Content Posting API audit
          disable_duet: false, disable_comment: false, disable_stitch: false,
        },
        source_info: { source: 'PULL_FROM_URL', video_url: media.url },
      },
    });
    const publishId = init.data?.publish_id;

    // Async — poll until the fetch/publish finishes.
    let status = 'PROCESSING_DOWNLOAD';
    for (let i = 0; i < 20 && ['PROCESSING_DOWNLOAD', 'PROCESSING_UPLOAD', 'SEND_TO_USER_INBOX'].includes(status); i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 3000));
      const check = await tt('/post/publish/status/fetch/', { method: 'POST', token: account.accessToken, body: { publish_id: publishId } });
      status = check.data?.status;
    }
    if (status === 'FAILED') {
      throw new SocialPublishError({ platform: 'tiktok', code: 'INVALID_MEDIA', message: 'TikTok rejected the video during processing.', retryable: false });
    }

    // TikTok's Content Posting API doesn't return a direct public post URL
    // synchronously (especially for SELF_ONLY posts) — publish_id is the
    // durable reference; the creator can find the actual post in their app.
    return { platformPostId: publishId || '', publishedUrl: '' };
  }

  getCapabilities() {
    return { requiresMedia: true, maxTextLength: 2200, supportedMediaTypes: ['video'], maxMediaCount: 1, maxVideoSizeMb: 100, requiresTitle: false };
  }
}

module.exports = TikTokProvider;
