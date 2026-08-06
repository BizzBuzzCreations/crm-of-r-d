'use strict';
// Settings → IVA CRM Integration — configures the outbound call rndCRM
// makes to the main CRM's activity-notification endpoint whenever a
// campaign email is opened/call-requested/replied to (see
// utils/mainCrmNotify.js, which reads SystemSettings.mainCrmIntegration
// first and falls back to MAIN_CRM_API_KEY/MAIN_CRM_NOTIFY_URL in .env if
// nothing's configured here yet). Mirrors the Meta Ads integration pattern
// (getStatus/saveCredentials/testConnection/clearCredentials, encrypted
// secret via utils/crypto, lastVerifiedAt/lastVerifyError naming from
// EmailAccount's SMTP/IMAP test fields) rather than inventing a new shape.
const { SystemSettings } = require('../models/index');

// @GET /api/main-crm-integration/status
exports.getStatus = async (req, res, next) => {
  try {
    // Not .lean() — see the identical comment in middleware/authorizeFeature.js
    // and notificationService.dispatchByRouting: a lean query skips schema-
    // default hydration, so on a document that predates this field it would
    // come back undefined instead of the schema default.
    const settings = await SystemSettings.findOne().select('mainCrmIntegration');
    const cfg = settings?.mainCrmIntegration;
    res.json({
      success: true,
      data: {
        configured: !!cfg?.apiKeyEncrypted,
        notifyUrl: cfg?.notifyUrl || '',
        lastVerifiedAt: cfg?.lastVerifiedAt || null,
        lastVerifyError: cfg?.lastVerifyError || '',
      },
    });
  } catch (err) { next(err); }
};

// @PUT /api/main-crm-integration/credentials — blank apiKey means "keep the
// existing value" (frontend never receives the real key back to
// redisplay, so it can't round-trip it — same as Meta Ads/EmailAccount).
exports.saveCredentials = async (req, res, next) => {
  try {
    const { notifyUrl, apiKey } = req.body;

    let settings = await SystemSettings.findOne().select('+mainCrmIntegration.apiKeyEncrypted');
    if (!settings) settings = await SystemSettings.create({});

    if (notifyUrl !== undefined && notifyUrl.trim()) settings.mainCrmIntegration.notifyUrl = notifyUrl.trim();
    if (apiKey && apiKey.trim()) settings.mainCrmIntegration.apiKey = apiKey.trim();

    if (!settings.mainCrmIntegration.apiKeyEncrypted) {
      return res.status(400).json({ success: false, message: 'API Key is required.' });
    }

    // Edited credentials invalidate any previous verification — same
    // invalidate-on-edit behavior as EmailAccount.updateAccount, so a stale
    // "verified" badge can't survive an unverified change.
    settings.mainCrmIntegration.lastVerifiedAt = null;
    settings.mainCrmIntegration.lastVerifyError = '';
    await settings.save();

    res.json({ success: true, message: 'Saved. Use Test Connection to verify.' });
  } catch (err) { next(err); }
};

// @DELETE /api/main-crm-integration/credentials
exports.clearCredentials = async (req, res, next) => {
  try {
    await SystemSettings.findOneAndUpdate({}, {
      $set: {
        'mainCrmIntegration.apiKeyEncrypted': '',
        'mainCrmIntegration.lastVerifiedAt': null,
        'mainCrmIntegration.lastVerifyError': '',
      },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// @POST /api/main-crm-integration/test-connection — a genuine round trip to
// the configured endpoint, not just a format check. There's no dedicated
// health-check route on IVA CRM's side (per its documented API), so this
// calls the real notify-activity endpoint with an email that can't match a
// real lead, clearly identifiable as a connectivity test rather than real
// campaign activity — it MAY still notify whatever "Additional Activity
// Notification Recipients" are configured on IVA CRM's side (Settings v3 →
// Marketing), since that's how that endpoint is documented to behave for
// any unmatched email.
exports.testConnection = async (req, res, next) => {
  try {
    const settings = await SystemSettings.findOne().select('+mainCrmIntegration.apiKeyEncrypted');
    const cfg = settings?.mainCrmIntegration;
    const apiKey = cfg?.apiKey;
    if (!apiKey) {
      return res.status(400).json({ success: false, message: "IVA CRM Integration isn't configured yet — add an API key above." });
    }
    const notifyUrl = cfg.notifyUrl || 'https://crms.bizzbuzzcreations.com/api/external/leads/notify-activity/';

    let response;
    try {
      const httpRes = await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({
          email: 'connection-test@rndcrm.internal',
          activity_type: 'marketing_email_opened',
          subject: 'rndCRM Connection Test',
          campaign_name: 'rndCRM Connection Test',
        }),
      });
      const text = await httpRes.text();
      let body; try { body = JSON.parse(text); } catch { body = null; }
      response = { ok: httpRes.ok, status: httpRes.status, body };
    } catch (networkErr) {
      response = { ok: false, status: 0, body: null, networkError: networkErr.message };
    }

    if (response.ok && response.body?.success) {
      await SystemSettings.findOneAndUpdate({}, {
        $set: { 'mainCrmIntegration.lastVerifiedAt': new Date(), 'mainCrmIntegration.lastVerifyError': '' },
      });
      return res.json({ success: true, data: response.body });
    }

    const reason = response.networkError
      || response.body?.error
      || response.body?.message
      || `HTTP ${response.status}`;
    await SystemSettings.findOneAndUpdate({}, { $set: { 'mainCrmIntegration.lastVerifyError': reason } });
    res.status(400).json({ success: false, message: `Could not reach IVA CRM — ${reason}` });
  } catch (err) { next(err); }
};
