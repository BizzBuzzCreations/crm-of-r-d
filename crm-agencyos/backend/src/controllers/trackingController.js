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

const PAGE = (title, body) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8" /><title>${title}</title>
<style>body{font-family:Arial,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
.card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.07);padding:40px;max-width:420px;text-align:center;}
h1{font-size:18px;color:#0f172a;margin:0 0 8px;}p{font-size:13.5px;color:#64748b;margin:0 0 16px;}
button{background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:10px 24px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:Arial,sans-serif;}
button:hover{background:#4338ca;}</style></head>
<body><div class="card">${body}</div></body></html>`;

// GET /api/campaigns/unsubscribe/:token — shows a confirmation page WITHOUT
// unsubscribing yet. Email security scanners (Microsoft Safe Links,
// Proofpoint, Mimecast, Gmail's own link-checker) pre-fetch every link in
// an email with a plain GET before a human ever opens it — if GET itself
// mutated state, those automated scans would silently unsubscribe every
// recipient who never clicked anything. Only the POST below (a real form
// submit, or Gmail/Yahoo's RFC 8058 one-click header) actually unsubscribes.
exports.unsubscribeConfirm = async (req, res) => {
  const { token } = req.params;
  const lead = await CampaignLead.findOne({ token }).select('email status').lean().catch(() => null);

  res.set('Content-Type', 'text/html');
  if (!lead) {
    return res.send(PAGE('Link no longer valid', `<h1>Link no longer valid</h1><p>This unsubscribe link has already been used or has expired.</p>`));
  }
  if (lead.status === 'unsubscribed') {
    return res.send(PAGE('Already unsubscribed', `<h1>You're already unsubscribed</h1><p>${lead.email} will not receive further emails from this campaign.</p>`));
  }
  res.send(PAGE('Unsubscribe', `
    <h1>Unsubscribe ${lead.email}?</h1>
    <p>You will stop receiving emails from this campaign.</p>
    <form method="POST" action="/api/campaigns/unsubscribe/${token}">
      <button type="submit">Confirm unsubscribe</button>
    </form>`));
};

// POST /api/campaigns/unsubscribe/:token — performs the actual unsubscribe.
// Reached two ways: the confirm page's form submit (human clicked the
// button above), or an RFC 8058 one-click POST sent directly by Gmail/
// Yahoo when the recipient clicks their native "Unsubscribe" button next
// to the sender name — enabled by the List-Unsubscribe-Post header set in
// campaignWorker.js, which requires this endpoint to actually accept POST.
exports.unsubscribe = async (req, res) => {
  const { token } = req.params;
  const lead = await CampaignLead.findOneAndUpdate(
    { token },
    { status: 'unsubscribed', unsubscribedAt: new Date() },
    { new: true }
  ).catch(() => null);

  res.set('Content-Type', 'text/html');
  res.send(PAGE('Unsubscribed', `
    <h1>${lead ? "You've been unsubscribed" : 'Link no longer valid'}</h1>
    <p>${lead ? `${lead.email} will not receive further emails from this campaign.` : 'This unsubscribe link has already been used or has expired.'}</p>`));
};
