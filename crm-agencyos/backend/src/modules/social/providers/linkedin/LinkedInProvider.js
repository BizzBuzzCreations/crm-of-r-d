'use strict';
// Posts to a LinkedIn Company Page (w_organization_social — requires the
// LinkedIn App to have the Community Management API product approved, per
// the plan). Uses LinkedIn's versioned REST API (LinkedIn-Version header) —
// LinkedIn bumps this version string periodically; LI_VERSION below should
// be checked against developer.linkedin.com/docs when real credentials are
// available and this gets tested against the live API for the first time.
const { SocialPublishError } = require('../../utils/socialErrors');

const LI_VERSION = '202401';
const AUTH_BASE = 'https://www.linkedin.com/oauth/v2';
const API_BASE = 'https://api.linkedin.com/rest';
const SCOPES = ['w_organization_social', 'r_organization_admin'];

async function li(path, { method = 'GET', token, body, headers, restBase = API_BASE } = {}) {
  let res;
  try {
    res = await fetch(`${restBase}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'LinkedIn-Version': LI_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new SocialPublishError({ platform: 'linkedin', code: 'NETWORK_ERROR', message: err.message });
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw classifyLinkedInError(data, res.status);
  return { data, headers: res.headers };
}

function classifyLinkedInError(data = {}, httpStatus) {
  const message = data.message || `LinkedIn API error (HTTP ${httpStatus})`;
  if (httpStatus === 401) return new SocialPublishError({ platform: 'linkedin', code: 'TOKEN_EXPIRED', message, retryable: false });
  if (httpStatus === 403) return new SocialPublishError({ platform: 'linkedin', code: 'PERMISSION_DENIED', message, retryable: false });
  if (httpStatus === 429) return new SocialPublishError({ platform: 'linkedin', code: 'RATE_LIMITED', message, retryable: true });
  if (httpStatus === 422 || httpStatus === 400) return new SocialPublishError({ platform: 'linkedin', code: 'VALIDATION_ERROR', message, retryable: false });
  if (httpStatus >= 500) return new SocialPublishError({ platform: 'linkedin', code: 'PLATFORM_ERROR', message, retryable: true });
  return new SocialPublishError({ platform: 'linkedin', code: 'UNKNOWN_ERROR', message, retryable: true });
}

class LinkedInProvider {
  constructor({ clientId, clientSecret } = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  getAuthUrl(state, redirectUri) {
    const url = new URL(`${AUTH_BASE}/authorization`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', SCOPES.join(' '));
    return url.toString();
  }

  async exchangeCode(code, redirectUri) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    let res;
    try {
      res = await fetch(`${AUTH_BASE}/accessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      throw new SocialPublishError({ platform: 'linkedin', code: 'NETWORK_ERROR', message: err.message });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw classifyLinkedInError(data, res.status);
    return {
      accessToken: data.access_token,
      // Only present if the app has been granted refresh-token rotation —
      // typically bundled with Community Management API approval. Absent
      // otherwise; refreshToken() falls back to "needs reconnect" in that case.
      refreshToken: data.refresh_token || '',
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: (data.scope || '').split(',').filter(Boolean),
    };
  }

  // Lists the Company Pages the connected user administers.
  async getAccountInfo(accessToken) {
    const { data } = await li('/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationTarget~(localizedName,vanityName)))', { token: accessToken });
    const elements = data.elements || [];
    return elements.map((el) => {
      const org = el['organizationTarget~'] || {};
      const orgUrn = el.organizationTarget || '';
      const orgId = orgUrn.split(':').pop();
      return {
        platform: 'linkedin_organization',
        platformAccountId: orgId,
        accountName: org.localizedName || `Organization ${orgId}`,
        username: org.vanityName || '',
        profileImage: '',
        accessToken,
        metadata: { organizationUrn: orgUrn },
      };
    });
  }

  async validateAccount(account) {
    try {
      await li(`/organizations/${account.platformAccountId}`, { token: account.accessToken });
      return true;
    } catch {
      return false;
    }
  }

  async refreshToken(account) {
    if (!account.refreshToken) {
      throw new SocialPublishError({ platform: 'linkedin', code: 'TOKEN_EXPIRED', message: 'Reconnect required — no refresh token on file for this LinkedIn account.', retryable: false });
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    let res;
    try {
      res = await fetch(`${AUTH_BASE}/accessToken`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      throw new SocialPublishError({ platform: 'linkedin', code: 'NETWORK_ERROR', message: err.message });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw classifyLinkedInError(data, res.status);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || account.refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  async publishPost(account, post) {
    const orgUrn = account.metadata?.organizationUrn || `urn:li:organization:${account.platformAccountId}`;
    const media = post.media?.[0];

    const body = {
      author: orgUrn,
      commentary: post.content || '',
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    if (media) {
      const assetUrn = await this.#uploadMedia(account, orgUrn, media);
      body.content = { media: { id: assetUrn, altText: '' } };
    }

    const { headers } = await li('/posts', { method: 'POST', token: account.accessToken, body });
    const postUrn = headers.get('x-restli-id') || headers.get('x-linkedin-id') || '';
    const shareId = postUrn.split(':').pop();
    return {
      platformPostId: postUrn,
      publishedUrl: shareId ? `https://www.linkedin.com/feed/update/${postUrn}/` : '',
    };
  }

  async #uploadMedia(account, orgUrn, media) {
    const kind = media.type === 'video' ? 'videos' : 'images';
    const { data: init } = await li(`/${kind}?action=initializeUpload`, {
      method: 'POST',
      token: account.accessToken,
      body: { initializeUploadRequest: { owner: orgUrn } },
    });
    const uploadUrl = init.value.uploadUrl;
    const assetUrn = init.value.image || init.value.video;

    let fileRes;
    try {
      fileRes = await fetch(media.url, { signal: AbortSignal.timeout(30000) });
    } catch (err) {
      throw new SocialPublishError({ platform: 'linkedin', code: 'INVALID_MEDIA', message: `Could not fetch media for upload: ${err.message}`, retryable: false });
    }
    if (!fileRes.ok) {
      throw new SocialPublishError({ platform: 'linkedin', code: 'INVALID_MEDIA', message: 'Could not fetch media for upload.', retryable: false });
    }
    const fileBuffer = Buffer.from(await fileRes.arrayBuffer());

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${account.accessToken}` },
      body: fileBuffer,
      signal: AbortSignal.timeout(60000),
    }).catch((err) => { throw new SocialPublishError({ platform: 'linkedin', code: 'NETWORK_ERROR', message: err.message }); });
    if (!putRes.ok) {
      throw new SocialPublishError({ platform: 'linkedin', code: 'INVALID_MEDIA', message: `LinkedIn rejected the media upload (HTTP ${putRes.status}).`, retryable: false });
    }
    return assetUrn;
  }

  getCapabilities() {
    return { requiresMedia: false, maxTextLength: 3000, supportedMediaTypes: ['image', 'video'], maxMediaCount: 1, maxVideoSizeMb: 200 };
  }
}

module.exports = LinkedInProvider;
