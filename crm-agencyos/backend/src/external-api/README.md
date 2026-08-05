# External API — developer guide

This folder holds every endpoint that an **outside system** (today: the
main CRM; later: whatever else) calls into rndCRM. It's kept separate from
`controllers/` + `routes/` on purpose:

- **Different auth.** Internal routes use `protect` (JWT, a logged-in
  rndCRM user). Everything here uses `apiKeyAuth` (an admin-issued API key —
  see `models/ApiKey.js` and the Admin → API Keys page). Mixing the two in
  one controller file makes it easy to accidentally leave a partner-facing
  route unprotected or JWT-gated by mistake.
- **Different audience.** Internal endpoints can change shape whenever the
  frontend that calls them changes too, in the same PR. External endpoints
  are a contract with a system you don't control — changing one means
  coordinating with whoever owns the main CRM's side. Keeping them
  physically separate makes that blast radius obvious at a glance.
- **Different docs.** Internal endpoints are self-documenting to anyone
  reading the frontend code that calls them. External ones need to be
  documented for a human on the other team — see
  `../../EXTERNAL_API_DOCUMENTATION.md`.

## Layout

```
external-api/
  README.md                        ← this file
  index.js                         ← collects every domain's router, one require for app.js
  middleware/
    apiKeyAuth.js                  ← shared auth, mount once per domain router
  leadSync/
    leadSync.routes.js             ← router: apiKeyAuth + endpoint list
    leadSync.controller.js         ← handlers
```

Each domain (`leadSync` today; `campaignSync`, `todoSync`, `taskSync`, ...
later) is a sibling folder with the same two-file shape.

## Adding a new domain (e.g. `campaignSync`)

1. **Create the folder**: `external-api/campaignSync/`.
2. **Write the controller** — `campaignSync.controller.js`. Plain Express
   handlers, `exports.xyz = async (req, res, next) => {...}`. No auth check
   inside the handler — that's the middleware's job (see below), so
   `req.apiKey` is already verified by the time your code runs.
3. **Write the router** — `campaignSync.routes.js`:
   ```js
   'use strict';
   const express = require('express');
   const apiKeyAuth = require('../middleware/apiKeyAuth');
   const ctrl = require('./campaignSync.controller');

   const router = express.Router();
   router.use(apiKeyAuth);
   router.get('/whatever', ctrl.getWhatever);

   module.exports = router;
   ```
4. **Register it** in `external-api/index.js`:
   ```js
   module.exports = {
     leadSync:     require('./leadSync/leadSync.routes'),
     campaignSync: require('./campaignSync/campaignSync.routes'),
   };
   ```
5. **Mount it** in `app.js`, next to the existing `leadSync` line:
   ```js
   app.use('/api/campaign-sync', externalApi.campaignSync);
   ```
6. **Document it** in `../../EXTERNAL_API_DOCUMENTATION.md` — copy the
   Lead Sync section's structure (auth reminder + one subsection per
   endpoint with method/path/params/example request/example response).

That's the whole pattern — no new auth mechanism to design, no new model
(every domain reuses `ApiKey`), no new admin UI (every domain's keys are
managed from the same Admin → API Keys page; keys aren't scoped per-domain
today, any valid key works on every external-api route — see "Key scoping"
below if a domain needs to restrict that).

## Auth model

- Keys are created/revoked from **Admin → API Keys** (`ApiKeysPage.jsx` →
  `/api/api-keys`, admin-only, JWT-protected — that management API is
  *internal*, not part of this folder).
- Keys are stored hashed (SHA-256) in `models/ApiKey.js`; the raw value is
  shown exactly once, at creation.
- `middleware/apiKeyAuth.js` reads `secret` from the query string (GET) or
  JSON body (POST), hashes it, and looks it up. No match → `401`.
- Every domain's routes are wide open to *any* valid key — there's no
  concept of "this key can only call lead-sync" yet. Fine while there's one
  external caller (the main CRM) with one key. If a second, less-trusted
  caller shows up, or a domain needs to restrict which keys can hit it,
  that's the point to add a `scopes: [String]` field to `ApiKey` and check
  it in `apiKeyAuth` (or a per-domain wrapper around it) — don't add that
  now, it's pure speculation until there's a second caller.

## Known limitation

The key travels in the query string on GET requests (`?secret=...`), which
means it can end up in server access logs / proxy logs, not just request
bodies. Fine for the current trusted-network setup; worth moving to an
`Authorization` or `X-API-Key` header if this ever crosses an untrusted
network or a stricter compliance bar.
