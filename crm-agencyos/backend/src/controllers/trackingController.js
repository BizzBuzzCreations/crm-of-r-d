'use strict';
// Public, unauthenticated endpoints — hit directly by email clients
// (tracking pixel image load, link clicks) and by recipients (unsubscribe
// page). No `protect` middleware on this router; identity comes entirely
// from the unguessable per-lead `token`.
const CampaignLead = require('../models/CampaignLead');

// 1x1 transparent PNG
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

// GET /api/campaigns/track/open/:token.png
exports.trackOpen = async (req, res) => {
  const token = String(req.params.token || '').replace(/\.png$/i, '');
  const now = new Date();
  CampaignLead.updateOne(
    { token },
    {
      $inc: { openCount: 1 },
      $set: { openedAt: now },
      // Keep a bounded history (last 50) — enough to distinguish a genuine
      // repeat-open pattern from a single prefetch, without unbounded growth.
      $push: { opens: { $each: [{ at: now, ip: req.ip || '', userAgent: req.headers['user-agent'] || '' }], $slice: -50 } },
    }
  ).catch(() => {}); // fire-and-forget — never delay/fail the pixel response

  res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'no-store, no-cache, must-revalidate' });
  res.send(PIXEL);
};

// GET /api/campaigns/track/click/:token?url=...
exports.trackClick = async (req, res) => {
  const { token } = req.params;
  const rawUrl = req.query.url || '';

  let dest = null;
  try {
    const parsed = new URL(rawUrl);
    if (['http:', 'https:'].includes(parsed.protocol)) dest = parsed.toString();
  } catch { /* invalid URL — fall through to safe fallback below */ }

  const now = new Date();
  CampaignLead.updateOne(
    { token },
    {
      $inc: { clickCount: 1 },
      $set: { clickedAt: now },
      $push: { clicks: { $each: [{ at: now, url: dest || rawUrl }], $slice: -50 } },
    }
  ).catch(() => {});

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  res.redirect(302, dest || clientUrl);
};

// GET /api/campaigns/unsubscribe/:token
exports.unsubscribe = async (req, res) => {
  const { token } = req.params;
  const lead = await CampaignLead.findOneAndUpdate(
    { token },
    { status: 'unsubscribed', unsubscribedAt: new Date() },
    { new: true }
  ).catch(() => null);

  res.set('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8" /><title>Unsubscribed</title>
<style>body{font-family:Arial,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
.card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.07);padding:40px;max-width:420px;text-align:center;}
h1{font-size:18px;color:#0f172a;margin:0 0 8px;}p{font-size:13.5px;color:#64748b;margin:0;}</style></head>
<body><div class="card">
  <h1>${lead ? "You've been unsubscribed" : 'Link no longer valid'}</h1>
  <p>${lead ? `${lead.email} will not receive further emails from this campaign.` : 'This unsubscribe link has already been used or has expired.'}</p>
</div></body></html>`);
};
