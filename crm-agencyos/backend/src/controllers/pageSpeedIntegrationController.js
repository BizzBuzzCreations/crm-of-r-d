'use strict';
// Settings → PageSpeed Insights Integration — configures the Google API
// key(s) used to audit prospect websites (see
// workers/prospectAuditWorker.js). Mirrors the IVA CRM integration pattern
// (getStatus/saveCredentials/testConnection/clearCredentials, encrypted
// secret via utils/crypto) rather than inventing a new shape.
const { SystemSettings } = require('../models/index');

const PSI_TEST_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// @GET /api/pagespeed-integration/status
exports.getStatus = async (req, res, next) => {
  try {
    // Not .lean() — see the identical comment in mainCrmController.js.
    const settings = await SystemSettings.findOne().select('pageSpeedIntegration');
    const cfg = settings?.pageSpeedIntegration;
    res.json({
      success: true,
      data: {
        configured: !!cfg?.apiKeyEncrypted,
        hasSecondKey: !!cfg?.apiKey2Encrypted,
        lastVerifiedAt: cfg?.lastVerifiedAt || null,
        lastVerifyError: cfg?.lastVerifyError || '',
      },
    });
  } catch (err) { next(err); }
};

// @PUT /api/pagespeed-integration/credentials — blank apiKey/apiKey2 means
// "keep the existing value" (frontend never receives the real key back).
exports.saveCredentials = async (req, res, next) => {
  try {
    const { apiKey, apiKey2 } = req.body;

    let settings = await SystemSettings.findOne().select('+pageSpeedIntegration.apiKeyEncrypted +pageSpeedIntegration.apiKey2Encrypted');
    if (!settings) settings = await SystemSettings.create({});

    if (apiKey && apiKey.trim()) settings.pageSpeedIntegration.apiKey = apiKey.trim();
    if (apiKey2 && apiKey2.trim()) settings.pageSpeedIntegration.apiKey2 = apiKey2.trim();

    if (!settings.pageSpeedIntegration.apiKeyEncrypted) {
      return res.status(400).json({ success: false, message: 'API Key is required.' });
    }

    settings.pageSpeedIntegration.lastVerifiedAt = null;
    settings.pageSpeedIntegration.lastVerifyError = '';
    await settings.save();

    res.json({ success: true, message: 'Saved. Use Test Connection to verify.' });
  } catch (err) { next(err); }
};

// @DELETE /api/pagespeed-integration/credentials
exports.clearCredentials = async (req, res, next) => {
  try {
    await SystemSettings.findOneAndUpdate({}, {
      $set: {
        'pageSpeedIntegration.apiKeyEncrypted': '',
        'pageSpeedIntegration.apiKey2Encrypted': '',
        'pageSpeedIntegration.lastVerifiedAt': null,
        'pageSpeedIntegration.lastVerifyError': '',
      },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// @POST /api/pagespeed-integration/test-connection — a genuine round trip
// against a harmless, always-reachable URL, not just a format check.
exports.testConnection = async (req, res, next) => {
  try {
    const settings = await SystemSettings.findOne().select('+pageSpeedIntegration.apiKeyEncrypted');
    const apiKey = settings?.pageSpeedIntegration?.apiKey;
    if (!apiKey) {
      return res.status(400).json({ success: false, message: "PageSpeed Insights isn't configured yet — add an API key above." });
    }

    let response;
    try {
      const url = `${PSI_TEST_URL}?url=${encodeURIComponent('https://example.com')}&key=${encodeURIComponent(apiKey)}&category=performance`;
      const httpRes = await fetch(url);
      const text = await httpRes.text();
      let body; try { body = JSON.parse(text); } catch { body = null; }
      response = { ok: httpRes.ok, status: httpRes.status, body };
    } catch (networkErr) {
      response = { ok: false, status: 0, body: null, networkError: networkErr.message };
    }

    if (response.ok && response.body?.lighthouseResult) {
      await SystemSettings.findOneAndUpdate({}, {
        $set: { 'pageSpeedIntegration.lastVerifiedAt': new Date(), 'pageSpeedIntegration.lastVerifyError': '' },
      });
      return res.json({ success: true, message: 'Connected — PageSpeed Insights API key is valid.' });
    }

    const reason = response.networkError
      || response.body?.error?.message
      || `HTTP ${response.status}`;
    await SystemSettings.findOneAndUpdate({}, { $set: { 'pageSpeedIntegration.lastVerifyError': reason } });
    res.status(400).json({ success: false, message: `Could not verify PageSpeed Insights key — ${reason}` });
  } catch (err) { next(err); }
};
