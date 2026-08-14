'use strict';
// YouTube — standard Google OAuth 2.0 via the `googleapis` package (already
// a dependency in this backend, no new package added). Real refresh tokens
// (Google's own, well-documented grant) — unlike Meta, refreshToken() here
// genuinely renews access rather than just re-validating.
//
// YouTube is fundamentally video-only — there's no "text post" concept, so
// getCapabilities().requiresMedia is always true and supportedMediaTypes is
// video-only. post.title (SocialPost.title, ignored by every other
// provider) becomes the video title; post.content becomes the description.
const { google } = require('googleapis');
const { Readable } = require('stream');
const { SocialPublishError } = require('../../utils/socialErrors');

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];

function classifyGoogleError(err) {
  const status = err.code || err.response?.status;
  const message = err.errors?.[0]?.message || err.message || 'YouTube API error';
  if (status === 401) return new SocialPublishError({ platform: 'youtube', code: 'TOKEN_EXPIRED', message, retryable: false });
  if (status === 403) return new SocialPublishError({ platform: 'youtube', code: 'PERMISSION_DENIED', message, retryable: false });
  if (status === 429) return new SocialPublishError({ platform: 'youtube', code: 'RATE_LIMITED', message, retryable: true });
  if (status === 400 || status === 422) return new SocialPublishError({ platform: 'youtube', code: 'VALIDATION_ERROR', message, retryable: false });
  if (status >= 500) return new SocialPublishError({ platform: 'youtube', code: 'PLATFORM_ERROR', message, retryable: true });
  return new SocialPublishError({ platform: 'youtube', code: 'UNKNOWN_ERROR', message, retryable: true });
}

class YouTubeProvider {
  constructor({ clientId, clientSecret } = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  #client(redirectUri) {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, redirectUri);
  }

  getAuthUrl(state, redirectUri) {
    const client = this.#client(redirectUri);
    return client.generateAuthUrl({
      access_type: 'offline', // required to receive a refresh_token
      prompt: 'consent',      // forces a refresh_token even on repeat connects
      scope: SCOPES,
      state,
    });
  }

  async exchangeCode(code, redirectUri) {
    const client = this.#client(redirectUri);
    let tokens;
    try {
      ({ tokens } = await client.getToken(code));
    } catch (err) {
      throw classifyGoogleError(err);
    }
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: SCOPES,
    };
  }

  async getAccountInfo(accessToken) {
    const client = this.#client();
    client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth: client });
    let res;
    try {
      res = await youtube.channels.list({ part: 'snippet', mine: true });
    } catch (err) {
      throw classifyGoogleError(err);
    }
    const channel = res.data.items?.[0];
    if (!channel) throw new SocialPublishError({ platform: 'youtube', code: 'VALIDATION_ERROR', message: 'No YouTube channel found on this Google account.', retryable: false });
    return [{
      platform: 'youtube',
      platformAccountId: channel.id,
      accountName: channel.snippet?.title || 'YouTube Channel',
      username: '',
      profileImage: channel.snippet?.thumbnails?.default?.url || '',
      accessToken,
      metadata: {},
    }];
  }

  async validateAccount(account) {
    const client = this.#client();
    client.setCredentials({ access_token: account.accessToken });
    try {
      await google.youtube({ version: 'v3', auth: client }).channels.list({ part: 'id', mine: true });
      return true;
    } catch {
      return false;
    }
  }

  async refreshToken(account) {
    if (!account.refreshToken) {
      throw new SocialPublishError({ platform: 'youtube', code: 'TOKEN_EXPIRED', message: 'Reconnect required — no refresh token on file for this YouTube account.', retryable: false });
    }
    const client = this.#client();
    client.setCredentials({ refresh_token: account.refreshToken });
    try {
      const { credentials } = await client.refreshAccessToken();
      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || account.refreshToken,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      };
    } catch (err) {
      throw classifyGoogleError(err);
    }
  }

  async publishPost(account, post) {
    const media = post.media?.[0];
    if (!media || media.type !== 'video') {
      throw new SocialPublishError({ platform: 'youtube', code: 'INVALID_MEDIA', message: 'YouTube requires a video file.', retryable: false });
    }

    let fileRes;
    try { fileRes = await fetch(media.url, { signal: AbortSignal.timeout(30000) }); }
    catch (err) { throw new SocialPublishError({ platform: 'youtube', code: 'INVALID_MEDIA', message: `Could not fetch video: ${err.message}`, retryable: false }); }
    if (!fileRes.ok) throw new SocialPublishError({ platform: 'youtube', code: 'INVALID_MEDIA', message: 'Could not fetch video for upload.', retryable: false });
    const buf = Buffer.from(await fileRes.arrayBuffer());

    const client = this.#client();
    client.setCredentials({ access_token: account.accessToken });
    const youtube = google.youtube({ version: 'v3', auth: client });

    let res;
    try {
      res = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
          snippet: {
            title: (post.title || post.content || 'Untitled').slice(0, 100),
            description: post.content || '',
          },
          status: { privacyStatus: 'public' },
        },
        media: { body: Readable.from(buf) },
      });
    } catch (err) {
      throw classifyGoogleError(err);
    }

    const videoId = res.data.id;
    return { platformPostId: videoId, publishedUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '' };
  }

  getCapabilities() {
    return { requiresMedia: true, maxTextLength: 5000, supportedMediaTypes: ['video'], maxMediaCount: 1, maxVideoSizeMb: 100, requiresTitle: true };
  }
}

module.exports = YouTubeProvider;
