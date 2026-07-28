'use strict';
// Pulls Meta Ads entity metadata (campaigns/adsets/ads: name, status, budget)
// and daily insights (spend, impressions, reach, clicks, ...) into local
// Mongo caches (MetaAdEntity, MetaAdInsight) so the dashboard never waits on
// a live Graph API round trip and survives Meta rate limits / brief outages.
//
// Re-pulls the last SYNC_WINDOW_DAYS on every tick (not just "since last
// sync") because Meta's own reporting is adjusted for a few days after the
// fact (attribution windows, delayed conversion events) — a narrower
// incremental pull would silently miss those corrections.
//
// Credentials live in the MetaAdsAccount singleton (DB), not backend/.env —
// entered via Settings → Meta Ads. Always scheduled (like the other crons);
// each tick checks for credentials itself and no-ops quietly if unset,
// since the DB isn't guaranteed connected yet at server-boot schedule time.
const cron = require('node-cron');
const MetaAdEntity = require('../models/MetaAdEntity');
const MetaAdInsight = require('../models/MetaAdInsight');
const MetaAdsAccount = require('../models/MetaAdsAccount');
const metaAdsClient = require('../utils/metaAdsClient');

const SYNC_WINDOW_DAYS = 30;
let tickRunning = false;

function startMetaAdsSyncCron() {
  cron.schedule('0 * * * *', runMetaAdsSyncTick); // hourly
  console.log('✅ Meta Ads sync cron scheduled (hourly)');
  // Kick off an initial sync shortly after boot (give Mongo a moment to
  // finish connecting) so the dashboard isn't empty for an hour if
  // credentials are already saved.
  setTimeout(() => {
    runMetaAdsSyncTick().catch((e) => console.error('[MetaAdsSync] initial sync failed:', e.message));
  }, 5000);
}

function fmtDate(d) {
  return d.toISOString().split('T')[0];
}

async function runMetaAdsSyncTick() {
  if (tickRunning) { console.warn('[MetaAdsSync] previous tick still running — skipping this one'); return; }
  tickRunning = true;
  try {
    const creds = await metaAdsClient.loadCredentials();
    if (!creds) return; // not configured yet — quiet no-op, not an error
    await syncNow(creds);
  } finally {
    tickRunning = false;
  }
}

// Exported separately from the tick so the "Sync Now" button can await a
// real result (success/error) instead of firing into a background tick.
async function syncNow(creds) {
  const resolvedCreds = creds || await metaAdsClient.loadCredentials();
  if (!resolvedCreds) throw new Error('Meta Ads is not configured yet.');

  const account = await metaAdsClient.getAccountInfo(resolvedCreds);
  const currency = account.currency || 'USD';

  await MetaAdsAccount.findOneAndUpdate(
    {},
    {
      accountId: resolvedCreds.adAccountId,
      accountName: account.name || '',
      currency,
      timezoneName: account.timezone_name || '',
      accountStatus: account.account_status ?? null,
      lastSyncedAt: new Date(),
    }
  );

  try {
    await syncEntities(resolvedCreds, currency);
    await syncInsights(resolvedCreds);

    await MetaAdsAccount.findOneAndUpdate({}, { lastSyncOkAt: new Date(), lastSyncError: '' });
  } catch (err) {
    await MetaAdsAccount.findOneAndUpdate({}, { lastSyncError: err.metaError?.message || err.message });
    throw err;
  }
}

async function syncEntities(creds, currency) {
  const [campaigns, adsets, ads] = await Promise.all([
    metaAdsClient.fetchCampaigns(creds),
    metaAdsClient.fetchAdSets(creds),
    metaAdsClient.fetchAds(creds),
  ]);

  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));
  const adsetById = new Map(adsets.map((a) => [a.id, a]));

  const ops = [];

  campaigns.forEach((c) => {
    ops.push({
      updateOne: {
        filter: { level: 'campaign', entityId: c.id },
        update: {
          $set: {
            name: c.name || '',
            status: c.effective_status || c.status || '',
            objective: c.objective || '',
            dailyBudget: metaAdsClient.toMajorUnits(c.daily_budget, currency),
            lifetimeBudget: metaAdsClient.toMajorUnits(c.lifetime_budget, currency),
            campaignId: c.id,
            campaignName: c.name || '',
          },
        },
        upsert: true,
      },
    });
  });

  adsets.forEach((a) => {
    ops.push({
      updateOne: {
        filter: { level: 'adset', entityId: a.id },
        update: {
          $set: {
            name: a.name || '',
            status: a.effective_status || a.status || '',
            dailyBudget: metaAdsClient.toMajorUnits(a.daily_budget, currency),
            lifetimeBudget: metaAdsClient.toMajorUnits(a.lifetime_budget, currency),
            campaignId: a.campaign_id || null,
            campaignName: campaignNameById.get(a.campaign_id) || '',
            adsetId: a.id,
            adsetName: a.name || '',
          },
        },
        upsert: true,
      },
    });
  });

  ads.forEach((ad) => {
    const parentAdset = adsetById.get(ad.adset_id);
    ops.push({
      updateOne: {
        filter: { level: 'ad', entityId: ad.id },
        update: {
          $set: {
            name: ad.name || '',
            status: ad.effective_status || ad.status || '',
            campaignId: ad.campaign_id || null,
            campaignName: campaignNameById.get(ad.campaign_id) || '',
            adsetId: ad.adset_id || null,
            adsetName: parentAdset?.name || '',
          },
        },
        upsert: true,
      },
    });
  });

  if (ops.length) await MetaAdEntity.bulkWrite(ops, { ordered: false });
  console.log(`[MetaAdsSync] entities: ${campaigns.length} campaigns, ${adsets.length} adsets, ${ads.length} ads`);
}

async function syncInsights(creds) {
  const until = fmtDate(new Date());
  const since = fmtDate(new Date(Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000));

  for (const level of ['campaign', 'adset', 'ad']) {
    const rows = await metaAdsClient.fetchInsights(creds, { level, since, until });
    const idKey = level === 'campaign' ? 'campaignId' : level === 'adset' ? 'adsetId' : 'adId';

    const ops = rows
      .filter((r) => r[idKey])
      .map((r) => ({
        updateOne: {
          filter: { level, entityId: r[idKey], date: r.date },
          update: {
            $set: {
              entityName: level === 'campaign' ? r.campaignName : level === 'adset' ? r.adsetName : r.adName,
              campaignId: r.campaignId,
              campaignName: r.campaignName,
              adsetId: r.adsetId,
              adsetName: r.adsetName,
              spend: r.spend,
              impressions: r.impressions,
              reach: r.reach,
              clicks: r.clicks,
              linkClicks: r.linkClicks,
              landingPageViews: r.landingPageViews,
              conversions: r.conversions,
            },
          },
          upsert: true,
        },
      }));

    if (ops.length) await MetaAdInsight.bulkWrite(ops, { ordered: false });
    console.log(`[MetaAdsSync] insights (${level}): ${ops.length} day-rows upserted`);
  }
}

module.exports = { startMetaAdsSyncCron, runMetaAdsSyncTick, syncNow };
