'use strict';
const MetaAdEntity = require('../models/MetaAdEntity');
const MetaAdInsight = require('../models/MetaAdInsight');
const MetaAdsAccount = require('../models/MetaAdsAccount');
const metaAdsClient = require('../utils/metaAdsClient');
const { syncNow } = require('../cron/metaAdsSync');

function defaultRange() {
  const to = new Date();
  const from = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}

function resolveRange(req) {
  const { from, to } = req.query;
  const d = defaultRange();
  return { from: from || d.from, to: to || d.to };
}

// Rolls raw counters up into the derived-metric shape the frontend renders.
// CTR/CPC/CPM are ALWAYS computed from summed counters, never averaged from
// per-row ratios — see MetaAdInsight.js for why.
function deriveMetrics(agg) {
  const spend = agg.spend || 0;
  const impressions = agg.impressions || 0;
  const clicks = agg.clicks || 0;
  const linkClicks = agg.linkClicks || 0;
  return {
    spend: round2(spend),
    impressions,
    reach: agg.reach || 0,
    clicks,
    linkClicks,
    landingPageViews: agg.landingPageViews || 0,
    conversions: agg.conversions || 0,
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
    cpc: clicks > 0 ? round2(spend / clicks) : 0,
    cpm: impressions > 0 ? round2((spend / impressions) * 1000) : 0,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Fields that require CRM lead-attribution data we don't collect yet — always
// present in every response so the frontend can render them as a clearly
// labeled "coming soon" state instead of silently omitting the KPI tile.
const ATTRIBUTION_PLACEHOLDER = {
  totalLeads: null,
  qualifiedLeads: null,
  wonCustomers: null,
  revenueGenerated: null,
  roi: null,
  roas: null,
  costPerLead: null,
  costPerCustomer: null,
};

// @GET /api/meta-ads/status
exports.getStatus = async (req, res, next) => {
  try {
    const configured = await metaAdsClient.isConfigured();
    const account = await MetaAdsAccount.findOne().lean();
    res.json({
      success: true,
      data: {
        configured,
        attributionEnabled: false,
        account: account ? {
          accountId: account.accountId,
          accountName: account.accountName,
          currency: account.currency,
          timezoneName: account.timezoneName,
          lastSyncedAt: account.lastSyncedAt,
          lastSyncOkAt: account.lastSyncOkAt,
          lastSyncError: account.lastSyncError,
          // Not secrets themselves — safe to echo back so the form can show
          // "already set" without ever returning the access token/app secret.
          adAccountId: account.adAccountId,
          appId: account.appId,
        } : null,
      },
    });
  } catch (err) { next(err); }
};

// @PUT /api/meta-ads/credentials — entered via Settings → Meta Ads. Blank
// accessToken/appSecret fields mean "keep the existing value" (the frontend
// never receives the real secret back to redisplay, so it can't round-trip
// it — this is how EmailAccount's password fields behave too).
exports.saveCredentials = async (req, res, next) => {
  try {
    const { accessToken, adAccountId, appId, appSecret } = req.body;
    if (!adAccountId || !String(adAccountId).trim()) {
      return res.status(400).json({ success: false, message: 'Ad Account ID is required.' });
    }

    let doc = await MetaAdsAccount.findOne().select('+accessTokenEncrypted +appSecretEncrypted');
    if (!doc) doc = new MetaAdsAccount();

    if (accessToken && accessToken.trim()) doc.accessToken = accessToken.trim();
    if (!doc.accessTokenEncrypted) {
      return res.status(400).json({ success: false, message: 'Access Token is required.' });
    }
    doc.adAccountId = metaAdsClient.normalizeAdAccountId(String(adAccountId).trim());
    if (appId !== undefined) doc.appId = appId.trim();
    if (appSecret && appSecret.trim()) doc.appSecret = appSecret.trim();
    await doc.save();

    // Verify immediately so the admin gets instant feedback instead of
    // silently saving a typo'd token and finding out an hour later.
    try {
      const creds = await metaAdsClient.loadCredentials();
      const account = await metaAdsClient.getAccountInfo(creds);
      await MetaAdsAccount.findOneAndUpdate({}, {
        accountId: creds.adAccountId,
        accountName: account.name || '',
        currency: account.currency || 'USD',
        timezoneName: account.timezone_name || '',
        accountStatus: account.account_status ?? null,
        lastSyncError: '',
      });
      res.json({ success: true, verified: true, data: { accountName: account.name, currency: account.currency } });
    } catch (verifyErr) {
      const reason = verifyErr.metaError?.message || verifyErr.message;
      await MetaAdsAccount.findOneAndUpdate({}, { lastSyncError: reason });
      res.json({ success: true, verified: false, message: `Saved, but couldn't verify — ${reason}` });
    }
  } catch (err) { next(err); }
};

// @DELETE /api/meta-ads/credentials — disconnect. Insight/entity cache is
// left in place (it's just historical numbers, not a secret) so switching
// ad accounts back doesn't lose sync history.
exports.clearCredentials = async (req, res, next) => {
  try {
    await MetaAdsAccount.findOneAndUpdate({}, {
      accessTokenEncrypted: '', appSecretEncrypted: '', appId: '', adAccountId: '',
      accountId: '', accountName: '', lastSyncError: '',
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// @POST /api/meta-ads/test-connection — live round trip, not the cache.
exports.testConnection = async (req, res, next) => {
  try {
    const creds = await metaAdsClient.loadCredentials();
    if (!creds) {
      return res.status(400).json({ success: false, message: 'Meta Ads isn\'t configured yet — add your credentials above.' });
    }
    const account = await metaAdsClient.getAccountInfo(creds);
    res.json({
      success: true,
      data: {
        accountId: creds.adAccountId,
        accountName: account.name,
        currency: account.currency,
        timezoneName: account.timezone_name,
        accountStatus: account.account_status,
      },
    });
  } catch (err) {
    const reason = err.metaError?.message || err.message;
    res.status(400).json({ success: false, message: `Could not reach the Meta Ad Account — ${reason}` });
  }
};

// @POST /api/meta-ads/sync-now
exports.triggerSync = async (req, res, next) => {
  try {
    if (!(await metaAdsClient.isConfigured())) {
      return res.status(400).json({ success: false, message: 'Meta Ads is not configured yet.' });
    }
    await syncNow();
    const account = await MetaAdsAccount.findOne().lean();
    res.json({ success: true, data: account });
  } catch (err) {
    res.status(500).json({ success: false, message: err.metaError?.message || err.message });
  }
};

// @GET /api/meta-ads/summary?from&to
exports.getSummary = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    // Sum at campaign level = account total, without double-counting via adset/ad rows.
    const rows = await MetaAdInsight.find({ level: 'campaign', date: { $gte: from, $lte: to } }).lean();
    const agg = rows.reduce((acc, r) => {
      acc.spend += r.spend || 0;
      acc.impressions += r.impressions || 0;
      acc.reach += r.reach || 0;
      acc.clicks += r.clicks || 0;
      acc.linkClicks += r.linkClicks || 0;
      acc.landingPageViews += r.landingPageViews || 0;
      acc.conversions += r.conversions || 0;
      return acc;
    }, { spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0, conversions: 0 });

    const account = await MetaAdsAccount.findOne().lean();

    res.json({
      success: true,
      data: {
        range: { from, to },
        currency: account?.currency || 'USD',
        ...deriveMetrics(agg),
        ...ATTRIBUTION_PLACEHOLDER,
        attributionEnabled: false,
      },
    });
  } catch (err) { next(err); }
};

// @GET /api/meta-ads/trends?from&to&granularity=daily|weekly|monthly
exports.getTrends = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const granularity = ['daily', 'weekly', 'monthly'].includes(req.query.granularity) ? req.query.granularity : 'daily';

    const rows = await MetaAdInsight.find({ level: 'campaign', date: { $gte: from, $lte: to } })
      .select('date spend impressions reach clicks linkClicks landingPageViews conversions')
      .sort({ date: 1 })
      .lean();

    const bucketKey = (dateStr) => {
      if (granularity === 'daily') return dateStr;
      const d = new Date(dateStr + 'T00:00:00Z');
      if (granularity === 'monthly') return dateStr.slice(0, 7); // YYYY-MM
      // weekly — bucket by the Monday of that week (ISO-ish, UTC)
      const day = d.getUTCDay();
      const diff = (day === 0 ? -6 : 1) - day;
      d.setUTCDate(d.getUTCDate() + diff);
      return d.toISOString().split('T')[0];
    };

    const buckets = new Map();
    rows.forEach((r) => {
      const key = bucketKey(r.date);
      const b = buckets.get(key) || { date: key, spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0, conversions: 0 };
      b.spend += r.spend || 0;
      b.impressions += r.impressions || 0;
      b.reach += r.reach || 0;
      b.clicks += r.clicks || 0;
      b.linkClicks += r.linkClicks || 0;
      b.landingPageViews += r.landingPageViews || 0;
      b.conversions += r.conversions || 0;
      buckets.set(key, b);
    });

    const trend = Array.from(buckets.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((b) => ({ ...b, ...deriveMetrics(b) }));

    res.json({ success: true, data: { granularity, range: { from, to }, trend } });
  } catch (err) { next(err); }
};

// Shared aggregation for campaign/adset/ad tables: entity metadata JOINed
// with insight counters summed over the date range.
async function buildEntityTable({ level, from, to, filter }) {
  const insightMatch = { level, date: { $gte: from, $lte: to }, ...filter };
  const insightAgg = await MetaAdInsight.aggregate([
    { $match: insightMatch },
    {
      $group: {
        _id: '$entityId',
        spend: { $sum: '$spend' },
        impressions: { $sum: '$impressions' },
        reach: { $sum: '$reach' },
        clicks: { $sum: '$clicks' },
        linkClicks: { $sum: '$linkClicks' },
        landingPageViews: { $sum: '$landingPageViews' },
        conversions: { $sum: '$conversions' },
      },
    },
  ]);
  const insightById = new Map(insightAgg.map((r) => [r._id, r]));

  const entityFilter = { level };
  if (filter.campaignId) entityFilter.campaignId = filter.campaignId;
  if (filter.adsetId) entityFilter.adsetId = filter.adsetId;
  const entities = await MetaAdEntity.find(entityFilter).lean();

  // Union of entities we know about + entities that have spend but weren't
  // in the latest metadata pull (e.g. deleted between syncs) — never silently
  // drop spend from the table.
  const seen = new Set();
  const rows = [];
  entities.forEach((e) => {
    seen.add(e.entityId);
    const agg = insightById.get(e.entityId) || { spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0, conversions: 0 };
    rows.push({
      id: e.entityId,
      name: e.name,
      status: e.status,
      objective: e.objective,
      campaignId: e.campaignId,
      campaignName: e.campaignName,
      adsetId: e.adsetId,
      adsetName: e.adsetName,
      dailyBudget: e.dailyBudget,
      lifetimeBudget: e.lifetimeBudget,
      ...deriveMetrics(agg),
      ...ATTRIBUTION_PLACEHOLDER,
    });
  });
  insightAgg.forEach((r) => {
    if (seen.has(r._id)) return;
    rows.push({
      id: r._id,
      name: '(unknown — removed from Meta since last sync)',
      status: 'UNKNOWN',
      campaignId: null,
      campaignName: '',
      adsetId: null,
      adsetName: '',
      dailyBudget: null,
      lifetimeBudget: null,
      ...deriveMetrics(r),
      ...ATTRIBUTION_PLACEHOLDER,
    });
  });

  return rows.sort((a, b) => b.spend - a.spend);
}

// @GET /api/meta-ads/campaigns?from&to
exports.getCampaigns = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const rows = await buildEntityTable({ level: 'campaign', from, to, filter: {} });
    res.json({ success: true, data: { range: { from, to }, campaigns: rows } });
  } catch (err) { next(err); }
};

// @GET /api/meta-ads/adsets?from&to&campaignId
exports.getAdSets = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const filter = req.query.campaignId ? { campaignId: req.query.campaignId } : {};
    const rows = await buildEntityTable({ level: 'adset', from, to, filter });
    res.json({ success: true, data: { range: { from, to }, adsets: rows } });
  } catch (err) { next(err); }
};

// @GET /api/meta-ads/ads?from&to&adsetId
exports.getAds = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const filter = req.query.adsetId ? { adsetId: req.query.adsetId } : {};
    const rows = await buildEntityTable({ level: 'ad', from, to, filter });
    res.json({ success: true, data: { range: { from, to }, ads: rows } });
  } catch (err) { next(err); }
};
