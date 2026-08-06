'use strict';
// Forwards campaign-engagement events (open / call request / reply) to the
// IVA CRM (crms.bizzbuzzcreations.com) so ITS users get notified too — via
// POST /api/external/leads/notify-activity/, documented separately. Always
// called ALONGSIDE notificationService.dispatchByRouting('campaign', ...),
// never instead of it — this is a second, independent notification target,
// not a replacement for the local one.
//
// Fire-and-forget by design, same principle as every other trigger in this
// codebase: an outbound HTTP call to a THIRD-PARTY system (less reliable
// than our own DB) must never delay or risk the response/flow that
// triggered it. Every failure mode here — missing API key, network error,
// non-2xx response — is logged and swallowed, never thrown.
//
// Credentials come from Settings → IVA CRM Integration
// (SystemSettings.mainCrmIntegration, admin-configurable, encrypted at
// rest) first, falling back to MAIN_CRM_API_KEY/MAIN_CRM_NOTIFY_URL in
// backend/.env if nothing's been configured there yet — so an existing
// .env-only setup keeps working with no forced migration.
const { SystemSettings } = require('../models/index');

const DEFAULT_NOTIFY_URL = 'https://crms.bizzbuzzcreations.com/api/external/leads/notify-activity/';

// rndCRM's local notification `type` -> IVA CRM's `activity_type` enum.
// Only the three that already trigger a local dispatchByRouting('campaign',
// ...) call are mapped — link-click and unsubscribe tracking exist locally
// but don't fire a local notification today, so they aren't forwarded here
// either (both are valid IVA CRM activity_types — marketing_email_clicked /
// marketing_email_unsubscribed — just not wired up yet).
//
// NOT a uniform marketing_<type> pattern — call-request deliberately has no
// "_email_" in it (marketing_call_request, not marketing_email_call_request)
// while every other type does. Verified against IVA CRM's documented enum,
// not guessed — don't "clean up" this asymmetry, it's intentional on their side.
const ACTIVITY_TYPE_MAP = {
  email_opened:   'marketing_email_opened',
  call_requested: 'marketing_call_request',
  email_replied:  'marketing_email_replied',
};

async function resolveCredentials() {
  // Not .lean() — same reasoning as authorizeFeature.js/dispatchByRouting:
  // a lean query skips schema-default hydration and would silently return
  // undefined for a document that predates this field.
  const settings = await SystemSettings.findOne().select('+mainCrmIntegration.apiKeyEncrypted');
  const cfg = settings?.mainCrmIntegration;
  const apiKey = cfg?.apiKey || process.env.MAIN_CRM_API_KEY || '';
  // notifyUrl only comes from Settings once a real apiKey has actually been
  // saved there — cfg.notifyUrl otherwise always has ITS OWN schema default
  // (the same production URL) applied by Mongoose hydration even on a
  // never-configured document, which would silently make
  // MAIN_CRM_NOTIFY_URL unreachable (e.g. for pointing at a test server)
  // if this checked cfg.notifyUrl unconditionally.
  const notifyUrl = (cfg?.apiKey ? cfg?.notifyUrl : null) || process.env.MAIN_CRM_NOTIFY_URL || DEFAULT_NOTIFY_URL;
  return { apiKey, notifyUrl };
}

async function notifyMainCrm({ type, email, subject, campaignName, detail }) {
  try {
    const activityType = ACTIVITY_TYPE_MAP[type];
    if (!activityType) return;

    if (!email) return; // one of lead_id/uid/phone/email is required by the endpoint; email is all we have

    const { apiKey, notifyUrl } = await resolveCredentials();
    if (!apiKey) {
      console.warn('[MainCRM] Not configured (Settings → IVA CRM Integration, or MAIN_CRM_API_KEY in .env) — skipping activity notification');
      return;
    }

    const body = { email, activity_type: activityType };
    if (subject) body.subject = subject;
    if (campaignName) body.campaign_name = campaignName;
    if (detail) body.detail = detail;

    const res = await fetch(notifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      // Opportunistic health tracking — every successful send (not just a
      // manual Test Connection click) keeps the Settings status card
      // accurate, same passive-verification idea as MetaAdsAccount's
      // lastSyncOkAt.
      SystemSettings.findOneAndUpdate({}, {
        $set: { 'mainCrmIntegration.lastVerifiedAt': new Date(), 'mainCrmIntegration.lastVerifyError': '' },
      }).catch(() => {});
    } else {
      const text = await res.text().catch(() => '');
      console.error(`[MainCRM] notify-activity failed (${res.status}):`, text.slice(0, 300));
      SystemSettings.findOneAndUpdate({}, {
        $set: { 'mainCrmIntegration.lastVerifyError': `HTTP ${res.status}: ${text.slice(0, 200)}` },
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[MainCRM] notify-activity request error:', err.message);
    SystemSettings.findOneAndUpdate({}, {
      $set: { 'mainCrmIntegration.lastVerifyError': err.message },
    }).catch(() => {});
  }
}

module.exports = { notifyMainCrm };
