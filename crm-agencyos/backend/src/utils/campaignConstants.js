'use strict';

// A lead that opens a campaign email this many times or more is a strong
// repeat-engagement signal — used to flag a lead "hot" for the B2B pipeline
// sync and for the auto-follow-up dispatcher. Keep in sync with the
// display-only copy of this same value in CampaignDetailPage.jsx (frontend
// badge) — that one can't easily share this module across the FE/BE boundary.
exports.HOT_OPEN_THRESHOLD = 3;
