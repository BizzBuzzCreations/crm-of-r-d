'use strict';

// A lead that opens a campaign email this many times or more is a strong
// repeat-engagement signal — used to flag a lead "hot" for the B2B pipeline
// sync and for the auto-follow-up dispatcher. Keep in sync with the
// display-only copy of this same value in CampaignDetailPage.jsx (frontend
// badge) — that one can't easily share this module across the FE/BE boundary.
exports.HOT_OPEN_THRESHOLD = 3;

// Known automated fetchers that hit the open-tracking pixel while scanning
// or pre-rendering an inbound email — before a human ever opens it. Used
// only to gate the "Email opened" notification in trackingController.js;
// the raw open is still recorded regardless of UA. Extend this list as new
// false-positive sources are identified — no controller changes needed.
// Note: some prefetchers (notably Apple Mail Privacy Protection) don't
// self-identify with a distinctive UA, so they aren't reliably catchable
// here — OPEN_NOTIFICATION_DELAY_GATE_MS below is the main defense for those.
exports.SCANNER_UA_PATTERNS = [
  /GoogleImageProxy/i,
  /Mimecast/i,
  /Proofpoint|pp-/i,
  /Barracuda/i,
  /OutlookImageProxy/i,
  /bot|crawler|spider|scanner/i,
];

// A pixel hit this soon after send is far more likely to be an automated
// prefetch (Gmail Image Proxy, corporate security gateways scanning inbound
// mail at delivery time) than a human actually reading the email — see the
// gating comment in trackingController.js.
exports.OPEN_NOTIFICATION_DELAY_GATE_MS = 15 * 1000;
