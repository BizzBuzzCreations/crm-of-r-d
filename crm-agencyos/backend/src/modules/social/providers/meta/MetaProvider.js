'use strict';
// Handles BOTH facebook_page and instagram_business — one Meta App, one
// OAuth flow (Facebook Login for Business). An Instagram Business account
// is only reachable through its linked Facebook Page's access token (Meta's
// API design, not a choice made here), so getAccountInfo() returns one
// SocialAccount candidate per Page PLUS one more for each Page's linked IG
// account when present.
//
// Real Graph API calls throughout — no mocked success. Requires a real Meta
// App ID/Secret (Settings -> Social Media Platforms) to actually run; see
// the module's top-level plan for what to register and why.
const { SocialPublishError } = require('../../utils/socialErrors');

const GRAPH_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const SCOPES = [
  'pages_show_list', 'pages_read_engagement', 'pages_manage_posts',
  'instagram_basic', 'instagram_content_publish', 'business_management',
];

async function graphFetch(path, { method = 'GET', params, body } = {}) {
  const url = new URL(path.startsWith('http') ? path : `${GRAPH}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new SocialPublishError({ platform: 'meta', code: 'NETWORK_ERROR', message: err.message });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw classifyMetaError(data.error, res.status);
  }
  return data;
}

function classifyMetaError(error = {}, httpStatus) {
  const code = error.code;
  const subcode = error.error_subcode;
  const message = error.message || `Meta API error (HTTP ${httpStatus})`;
  // OAuthException codes 190 (expired/invalid token) and 102/463 (session
  // expired) — reconnect required, never auto-retry.
  if (code === 190 || [458, 459, 460, 463, 467].includes(subcode)) {
    return new SocialPublishError({ platform: 'meta', code: 'TOKEN_EXPIRED', message, retryable: false });
  }
  if (code === 10 || (code >= 200 && code < 300)) {
    return new SocialPublishError({ platform: 'meta', code: 'PERMISSION_DENIED', message, retryable: false });
  }
  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return new SocialPublishError({ platform: 'meta', code: 'RATE_LIMITED', message, retryable: true });
  }
  if (code === 100 && /image|video|media/i.test(message)) {
    return new SocialPublishError({ platform: 'meta', code: 'INVALID_MEDIA', message, retryable: false });
  }
  if (code === 100) {
    return new SocialPublishError({ platform: 'meta', code: 'VALIDATION_ERROR', message, retryable: false });
  }
  if (httpStatus >= 500) {
    return new SocialPublishError({ platform: 'meta', code: 'PLATFORM_ERROR', message, retryable: true });
  }
  return new SocialPublishError({ platform: 'meta', code: 'UNKNOWN_ERROR', message, retryable: true });
}

class MetaProvider {
  constructor({ appId, appSecret } = {}) {
    this.appId = appId;
    this.appSecret = appSecret;
  }

  getAuthUrl(state, redirectUri) {
    const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set('client_id', this.appId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('response_type', 'code');
    return url.toString();
  }

  async exchangeCode(code, redirectUri) {
    // Step 1: short-lived user token
    const short = await graphFetch('/oauth/access_token', {
      params: { client_id: this.appId, client_secret: this.appSecret, redirect_uri: redirectUri, code },
    });
    // Step 2: exchange for a long-lived (~60 day) user token — Page tokens
    // minted from this are themselves long-lived/effectively non-expiring
    // as long as the grant isn't revoked, which is what we actually store.
    const long = await graphFetch('/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: this.appId,
        client_secret: this.appSecret,
        fb_exchange_token: short.access_token,
      },
    });
    return {
      accessToken: long.access_token,
      refreshToken: '', // no refresh-token grant on Meta — see refreshToken() below
      expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
      scopes: SCOPES,
    };
  }

  // One Meta connect grant can surface multiple publishable accounts: every
  // Page the user granted access to, plus each Page's linked Instagram
  // Business account (if any). Page access tokens (not the user token) are
  // what actually gets stored per-account, since publishing happens as the
  // Page, not the user.
  async getAccountInfo(userAccessToken) {
    const { data: pages = [] } = await graphFetch('/me/accounts', {
      params: { access_token: userAccessToken, fields: 'id,name,access_token,picture,instagram_business_account' },
    });

    // TEMP DIAGNOSTIC — remove once the "IG account missing for one Page"
    // issue is root-caused. Logs which Pages Meta actually returned and
    // whether each one carries a linked instagram_business_account, with no
    // tokens included.
    try {
      let sysLog = { info: () => {} };
      try { sysLog = require('../../../../utils/sysLogger').logger; } catch {}
      sysLog.info('SOCIAL', `getAccountInfo: ${pages.length} page(s) — ${pages.map((p) => `${p.name}(${p.id}) ig=${p.instagram_business_account?.id || 'none'}`).join(' | ')}`);
    } catch {}

    const accounts = [];
    for (const page of pages) {
      accounts.push({
        platform: 'facebook_page',
        platformAccountId: page.id,
        accountName: page.name,
        username: '',
        profileImage: page.picture?.data?.url || '',
        accessToken: page.access_token, // long-lived Page token
        metadata: {},
      });

      if (page.instagram_business_account?.id) {
        const igId = page.instagram_business_account.id;
        const ig = await graphFetch(`/${igId}`, {
          params: { access_token: page.access_token, fields: 'username,profile_picture_url,name' },
        }).catch(() => ({}));
        accounts.push({
          platform: 'instagram_business',
          platformAccountId: igId,
          accountName: ig.name || ig.username || page.name,
          username: ig.username || '',
          profileImage: ig.profile_picture_url || '',
          accessToken: page.access_token, // IG publishing uses the linked Page's token
          metadata: { linkedFacebookPageId: page.id },
        });
      }
    }
    return accounts;
  }

  async validateAccount(account) {
    try {
      await graphFetch(`/${account.platformAccountId}`, {
        params: { access_token: account.accessToken, fields: 'id' },
      });
      return true;
    } catch {
      return false;
    }
  }

  // Meta Page tokens have no OAuth refresh_token grant — they're long-lived
  // by construction (see exchangeCode). "Refreshing" here just means
  // re-validating; a genuinely expired/revoked token needs the user to
  // reconnect via the OAuth flow again, surfaced in the UI as status:'expired'.
  async refreshToken(account) {
    const ok = await this.validateAccount(account);
    if (!ok) {
      throw new SocialPublishError({ platform: 'meta', code: 'TOKEN_EXPIRED', message: 'Reconnect required — Meta access has expired or been revoked.', retryable: false });
    }
    return { accessToken: account.accessToken, refreshToken: '', expiresAt: account.tokenExpiresAt };
  }

  async publishPost(account, post) {
    if (account.platform === 'facebook_page') return this.#publishToFacebookPage(account, post);
    if (account.platform === 'instagram_business') return this.#publishToInstagram(account, post);
    throw new SocialPublishError({ platform: 'meta', code: 'VALIDATION_ERROR', message: `Unsupported Meta platform: ${account.platform}`, retryable: false });
  }

  async #publishToFacebookPage(account, post) {
    const media = post.media?.[0];
    let result;
    if (!media) {
      result = await graphFetch(`/${account.platformAccountId}/feed`, {
        method: 'POST',
        body: { message: post.content, access_token: account.accessToken },
      });
    } else if (media.type === 'image') {
      result = await graphFetch(`/${account.platformAccountId}/photos`, {
        method: 'POST',
        body: { url: media.url, caption: post.content, access_token: account.accessToken },
      });
    } else {
      result = await graphFetch(`/${account.platformAccountId}/videos`, {
        method: 'POST',
        body: { file_url: media.url, description: post.content, access_token: account.accessToken },
      });
    }
    const postId = result.post_id || result.id;
    return { platformPostId: postId, publishedUrl: `https://www.facebook.com/${postId}` };
  }

  async #publishToInstagram(account, post) {
    const media = post.media?.[0];
    if (!media) {
      throw new SocialPublishError({ platform: 'meta', code: 'INVALID_MEDIA', message: 'Instagram requires an image or video.', retryable: false });
    }

    const containerParams = { caption: post.content, access_token: account.accessToken };
    if (media.type === 'image') containerParams.image_url = media.url;
    else { containerParams.video_url = media.url; containerParams.media_type = 'REELS'; }

    const container = await graphFetch(`/${account.platformAccountId}/media`, { method: 'POST', body: containerParams });

    // Video containers process asynchronously — poll until ready (max ~60s).
    let status = 'IN_PROGRESS';
    for (let i = 0; i < 20 && status === 'IN_PROGRESS'; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 3000));
      const check = await graphFetch(`/${container.id}`, { params: { fields: 'status_code', access_token: account.accessToken } });
      status = check.status_code;
    }
    if (status === 'ERROR') {
      throw new SocialPublishError({ platform: 'meta', code: 'INVALID_MEDIA', message: 'Instagram rejected the media during processing.', retryable: false });
    }

    const published = await graphFetch(`/${account.platformAccountId}/media_publish`, {
      method: 'POST',
      body: { creation_id: container.id, access_token: account.accessToken },
    });
    const permalink = await graphFetch(`/${published.id}`, { params: { fields: 'permalink', access_token: account.accessToken } }).catch(() => ({}));
    return { platformPostId: published.id, publishedUrl: permalink.permalink || '' };
  }

  getCapabilities(platform) {
    if (platform === 'instagram_business') {
      return { requiresMedia: true, maxTextLength: 2200, supportedMediaTypes: ['image', 'video'], maxMediaCount: 1, maxVideoSizeMb: 100 };
    }
    return { requiresMedia: false, maxTextLength: 63206, supportedMediaTypes: ['image', 'video'], maxMediaCount: 1, maxVideoSizeMb: 25 };
  }
}

module.exports = MetaProvider;
