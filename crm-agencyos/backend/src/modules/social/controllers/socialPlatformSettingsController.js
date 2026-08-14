'use strict';
// Settings → Social Media Platforms — App ID/Secret for the Meta App
// (Facebook Pages + Instagram, one app) and LinkedIn App (Company Page
// posting). Mirrors pageSpeedIntegrationController.js's structure exactly.
// No "Test Connection" here (unlike PageSpeed) — there's no unauthenticated
// endpoint to validate an App ID/Secret pair against before a real OAuth
// grant exists; the real test is the Connect flow itself succeeding from
// the Connected Accounts page.
const { SystemSettings } = require('../../../models/index');

const FIELD = {
  meta:     { doc: 'metaApp',     id: 'appId',     idLabel: 'App ID',     secret: 'appSecret',    secretLabel: 'App Secret',    secretEnc: 'appSecretEncrypted' },
  linkedin: { doc: 'linkedinApp', id: 'clientId',   idLabel: 'Client ID',  secret: 'clientSecret', secretLabel: 'Client Secret', secretEnc: 'clientSecretEncrypted' },
  x:        { doc: 'xApp',        id: 'clientId',   idLabel: 'Client ID',  secret: 'clientSecret', secretLabel: 'Client Secret', secretEnc: 'clientSecretEncrypted' },
  youtube:  { doc: 'youtubeApp',  id: 'clientId',   idLabel: 'Client ID',  secret: 'clientSecret', secretLabel: 'Client Secret', secretEnc: 'clientSecretEncrypted' },
  tiktok:   { doc: 'tiktokApp',   id: 'clientKey',  idLabel: 'Client Key', secret: 'clientSecret', secretLabel: 'Client Secret', secretEnc: 'clientSecretEncrypted' },
};

function assertPlatform(req, res) {
  const cfg = FIELD[req.params.platform];
  if (!cfg) {
    res.status(400).json({ success: false, message: `Unknown platform: ${req.params.platform}` });
    return null;
  }
  return cfg;
}

// @GET /api/social-platforms/:platform/status
exports.getStatus = async (req, res, next) => {
  try {
    const cfg = assertPlatform(req, res);
    if (!cfg) return;
    const settings = await SystemSettings.findOne().select(cfg.doc);
    const doc = settings?.[cfg.doc];
    res.json({
      success: true,
      data: {
        configured: !!doc?.[cfg.secretEnc],
        [cfg.id]: doc?.[cfg.id] || '', // not secret — safe to echo back
      },
    });
  } catch (err) { next(err); }
};

// @PUT /api/social-platforms/:platform/credentials — blank secret means
// "keep the existing value" (frontend never receives the real secret back).
exports.saveCredentials = async (req, res, next) => {
  try {
    const cfg = assertPlatform(req, res);
    if (!cfg) return;
    const idValue = req.body[cfg.id];
    const secretValue = req.body[cfg.secret];

    if (!idValue || !String(idValue).trim()) {
      return res.status(400).json({ success: false, message: `${cfg.idLabel} is required.` });
    }

    let settings = await SystemSettings.findOne().select(`+${cfg.doc}.${cfg.secretEnc}`);
    if (!settings) settings = await SystemSettings.create({});
    if (!settings[cfg.doc]) settings[cfg.doc] = {};

    settings[cfg.doc][cfg.id] = String(idValue).trim();
    if (secretValue && secretValue.trim()) settings[cfg.doc][cfg.secret] = secretValue.trim();

    if (!settings[cfg.doc][cfg.secretEnc]) {
      return res.status(400).json({ success: false, message: `${cfg.secretLabel} is required.` });
    }

    await settings.save();
    res.json({ success: true, message: 'Saved.' });
  } catch (err) { next(err); }
};

// @DELETE /api/social-platforms/:platform/credentials
exports.clearCredentials = async (req, res, next) => {
  try {
    const cfg = assertPlatform(req, res);
    if (!cfg) return;
    await SystemSettings.findOneAndUpdate({}, {
      $set: {
        [`${cfg.doc}.${cfg.id}`]: '',
        [`${cfg.doc}.${cfg.secretEnc}`]: '',
      },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};
