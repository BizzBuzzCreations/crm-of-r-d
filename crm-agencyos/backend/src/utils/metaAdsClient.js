'use strict';
// Thin wrapper around the Meta Marketing API (Graph API). Read-only — this
// module never writes anything back to Meta.
//
// Credentials come from the MetaAdsAccount singleton in MongoDB (entered via
// Settings → Meta Ads), encrypted at rest — not from backend/.env. Callers
// resolve credentials once via loadCredentials() and pass them into every
// fetch* call explicitly, rather than each call re-hitting the DB.
const MetaAdsAccount = require('../models/MetaAdsAccount');

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function normalizeAdAccountId(raw) {
  const trimmed = (raw || '').trim();
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

// Resolves the currently-saved credentials, decrypted. Returns null if
// nothing (or an incomplete set) has been saved yet.
async function loadCredentials() {
  const doc = await MetaAdsAccount.findOne().select('+accessTokenEncrypted +appSecretEncrypted adAccountId appId');
  if (!doc) return null;
  const accessToken = doc.accessToken; // virtual getter — decrypts
  if (!accessToken || !doc.adAccountId) return null;
  return {
    accessToken,
    adAccountId: normalizeAdAccountId(doc.adAccountId),
    appId: doc.appId || '',
    appSecret: doc.appSecret || '',
  };
}

async function isConfigured() {
  return !!(await loadCredentials());
}

async function graphGet(path, params, accessToken) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) {
    const err = new Error(json.error.message || 'Meta Graph API error');
    err.metaError = json.error;
    err.status = res.status;
    throw err;
  }
  return json;
}

async function graphGetUrl(fullUrl) {
  const res = await fetch(fullUrl);
  const json = await res.json();
  if (json.error) {
    const err = new Error(json.error.message || 'Meta Graph API error');
    err.metaError = json.error;
    throw err;
  }
  return json;
}

// Follows cursor pagination (paging.next, which already embeds the access
// token from the original request) until exhausted. Capped at 50 pages as a
// runaway-loop guard.
async function graphGetAllPages(path, params, accessToken) {
  let results = [];
  let json = await graphGet(path, params, accessToken);
  results = results.concat(json.data || []);
  let guard = 0;
  while (json.paging?.next && guard < 50) {
    guard++;
    json = await graphGetUrl(json.paging.next);
    results = results.concat(json.data || []);
  }
  return results;
}

async function getAccountInfo(creds) {
  return graphGet(`/${creds.adAccountId}`, {
    fields: 'name,currency,timezone_name,account_status',
  }, creds.accessToken);
}

async function fetchCampaigns(creds) {
  return graphGetAllPages(`/${creds.adAccountId}/campaigns`, {
    fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
    limit: 200,
  }, creds.accessToken);
}

async function fetchAdSets(creds) {
  return graphGetAllPages(`/${creds.adAccountId}/adsets`, {
    fields: 'id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget',
    limit: 200,
  }, creds.accessToken);
}

async function fetchAds(creds) {
  return graphGetAllPages(`/${creds.adAccountId}/ads`, {
    fields: 'id,name,adset_id,campaign_id,status,effective_status',
    limit: 200,
  }, creds.accessToken);
}

// Best-effort default for "Conversions" — sums any Meta action_type that
// looks like a lead event, since this module targets lead-gen advertisers.
// Not a substitute for real per-advertiser pixel/event configuration; the
// KPI is labeled "Meta-reported leads" in the UI so it's never presented as
// ground truth CRM data.
const CONVERSION_ACTION_MATCH = /lead/i;

function extractAction(actions, matcher) {
  if (!Array.isArray(actions)) return 0;
  return actions.reduce((sum, a) => {
    if (typeof matcher === 'string') return sum + (a.action_type === matcher ? Number(a.value) || 0 : 0);
    return sum + (matcher.test(a.action_type || '') ? Number(a.value) || 0 : 0);
  }, 0);
}

async function fetchInsights(creds, { level, since, until }) {
  const rows = await graphGetAllPages(`/${creds.adAccountId}/insights`, {
    level,
    fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,clicks,inline_link_clicks,actions',
    time_range: JSON.stringify({ since, until }),
    time_increment: 1,
    limit: 500,
  }, creds.accessToken);

  return rows.map((r) => ({
    campaignId: r.campaign_id || null,
    campaignName: r.campaign_name || '',
    adsetId: r.adset_id || null,
    adsetName: r.adset_name || '',
    adId: r.ad_id || null,
    adName: r.ad_name || '',
    date: r.date_start,
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    reach: Number(r.reach) || 0,
    clicks: Number(r.clicks) || 0,
    linkClicks: Number(r.inline_link_clicks) || 0,
    landingPageViews: extractAction(r.actions, 'landing_page_view'),
    conversions: extractAction(r.actions, CONVERSION_ACTION_MATCH),
  }));
}

// Meta returns budget fields in the account currency's smallest unit (cents
// for USD/INR/etc.) EXCEPT for zero-decimal currencies, which it returns as
// whole units already. Per Meta's documented zero-decimal currency list.
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

function toMajorUnits(minorValue, currency) {
  if (minorValue == null) return null;
  const n = Number(minorValue);
  if (Number.isNaN(n)) return null;
  return ZERO_DECIMAL_CURRENCIES.has((currency || '').toUpperCase()) ? n : n / 100;
}

module.exports = {
  GRAPH_VERSION,
  normalizeAdAccountId,
  loadCredentials,
  isConfigured,
  getAccountInfo,
  fetchCampaigns,
  fetchAdSets,
  fetchAds,
  fetchInsights,
  toMajorUnits,
};
