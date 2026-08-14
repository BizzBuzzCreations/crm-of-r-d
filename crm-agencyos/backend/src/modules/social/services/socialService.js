'use strict';
// The only thing controllers/workers touch for anything provider-specific —
// resolves `platform -> provider instance` (with that platform's App
// ID/Secret injected from SystemSettings, see Settings -> Social Media
// Platforms) from a small registry, so adding another platform later is
// "write a provider implementing SocialProvider, add one registry line"
// with zero changes to controllers/workers.
const { SystemSettings } = require('../../../models/index');
const MetaProvider = require('../providers/meta/MetaProvider');
const LinkedInProvider = require('../providers/linkedin/LinkedInProvider');
const XProvider = require('../providers/x/XProvider');
const YouTubeProvider = require('../providers/youtube/YouTubeProvider');
const TikTokProvider = require('../providers/tiktok/TikTokProvider');

// App-config platform key (what's configured once in Settings) vs the
// SocialAccount.platform enum (one app-config can back multiple account
// platforms — Meta backs both facebook_page and instagram_business).
const APP_CONFIG_FOR_ACCOUNT_PLATFORM = {
  facebook_page: 'meta',
  instagram_business: 'meta',
  linkedin_organization: 'linkedin',
  x: 'x',
  youtube: 'youtube',
  tiktok: 'tiktok',
};

// One entry per app-config platform: how to load its credentials from
// SystemSettings, and its provider class. This is the "one registry line"
// referenced above — everything else (routes, worker, UI capability
// lookups) is generic over this map.
const REGISTRY = {
  meta: {
    ProviderClass: MetaProvider,
    loadCredentials: async () => {
      const settings = await SystemSettings.findOne().select('+metaApp.appSecretEncrypted');
      const cfg = settings?.metaApp;
      if (!cfg?.appId || !cfg?.appSecretEncrypted) return null;
      return { appId: cfg.appId, appSecret: cfg.appSecret };
    },
  },
  linkedin: {
    ProviderClass: LinkedInProvider,
    loadCredentials: async () => {
      const settings = await SystemSettings.findOne().select('+linkedinApp.clientSecretEncrypted');
      const cfg = settings?.linkedinApp;
      if (!cfg?.clientId || !cfg?.clientSecretEncrypted) return null;
      return { clientId: cfg.clientId, clientSecret: cfg.clientSecret };
    },
  },
  x: {
    ProviderClass: XProvider,
    loadCredentials: async () => {
      const settings = await SystemSettings.findOne().select('+xApp.clientSecretEncrypted');
      const cfg = settings?.xApp;
      if (!cfg?.clientId || !cfg?.clientSecretEncrypted) return null;
      return { clientId: cfg.clientId, clientSecret: cfg.clientSecret };
    },
  },
  youtube: {
    ProviderClass: YouTubeProvider,
    loadCredentials: async () => {
      const settings = await SystemSettings.findOne().select('+youtubeApp.clientSecretEncrypted');
      const cfg = settings?.youtubeApp;
      if (!cfg?.clientId || !cfg?.clientSecretEncrypted) return null;
      return { clientId: cfg.clientId, clientSecret: cfg.clientSecret };
    },
  },
  tiktok: {
    ProviderClass: TikTokProvider,
    loadCredentials: async () => {
      const settings = await SystemSettings.findOne().select('+tiktokApp.clientSecretEncrypted');
      const cfg = settings?.tiktokApp;
      if (!cfg?.clientKey || !cfg?.clientSecretEncrypted) return null;
      return { clientKey: cfg.clientKey, clientSecret: cfg.clientSecret };
    },
  },
};

// `platformOrAccountPlatform` accepts either an app-config key ('meta',
// 'linkedin', 'x', 'youtube', 'tiktok') used by the OAuth connect/callback
// routes, or a SocialAccount platform value ('facebook_page',
// 'instagram_business', etc.) used everywhere publishing happens.
async function getProvider(platformOrAccountPlatform) {
  const appConfigPlatform = APP_CONFIG_FOR_ACCOUNT_PLATFORM[platformOrAccountPlatform] || platformOrAccountPlatform;
  const entry = REGISTRY[appConfigPlatform];
  if (!entry) return null;
  const credentials = await entry.loadCredentials();
  if (!credentials) return null;
  return new entry.ProviderClass(credentials);
}

async function publish(account, post) {
  const provider = await getProvider(account.platform);
  if (!provider) {
    const { SocialPublishError } = require('../utils/socialErrors');
    throw new SocialPublishError({
      platform: account.platform,
      code: 'VALIDATION_ERROR',
      message: `${APP_CONFIG_FOR_ACCOUNT_PLATFORM[account.platform]} is no longer configured in Settings.`,
      retryable: false,
    });
  }
  return provider.publishPost(account, post);
}

// Capabilities are static per platform — no credentials needed, so this
// never has to hit the DB. MetaProvider.getCapabilities() takes the account
// platform since one Meta provider instance covers two account platforms.
function getCapabilities(accountPlatform) {
  if (accountPlatform === 'facebook_page' || accountPlatform === 'instagram_business') {
    return new MetaProvider().getCapabilities(accountPlatform);
  }
  const appConfigPlatform = APP_CONFIG_FOR_ACCOUNT_PLATFORM[accountPlatform];
  const entry = REGISTRY[appConfigPlatform];
  if (!entry) throw new Error(`Unknown platform: ${accountPlatform}`);
  return new entry.ProviderClass().getCapabilities();
}

module.exports = { getProvider, publish, getCapabilities, APP_CONFIG_FOR_ACCOUNT_PLATFORM, REGISTRY };
