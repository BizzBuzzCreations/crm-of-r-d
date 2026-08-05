'use strict';
// Optional friendly-name lookup for the `:source` slug in
// POST /api/lead-capture/:source — purely cosmetic (used as utmSource on
// the created lead), NOT an allowlist or access control. Any slug works
// whether or not it's listed here (see leadCapture.controller.js) — this
// endpoint is intentionally open to any external site, no registration
// required. Add an entry here only to get a nicer label than the raw slug
// shows up in reporting; skipping it just means the lead's utmSource is
// the raw slug instead (e.g. "debtfreepath" instead of "DebtFreePath").
module.exports = {
  debtfreepath: 'DebtFreePath', // https://debtfreepath.co.uk — reference only, not enforced anywhere
};
