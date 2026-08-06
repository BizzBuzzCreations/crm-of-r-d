# External API — developer guide

This folder holds every endpoint that an **outside system** (the main CRM,
a frontend-only lead-capture site, later: whatever else) calls into
rndCRM. It's kept separate from `controllers/` + `routes/` on purpose:

- **Different auth.** Internal routes use `protect` (JWT, a logged-in
  rndCRM user). Domains here use one of two auth models depending on who's
  calling — see [Auth models](#auth-models) — but neither is JWT. Mixing
  either with internal routes in one controller file makes it easy to
  accidentally leave a partner-facing route unprotected or JWT-gated by
  mistake.
- **Different audience.** Internal endpoints can change shape whenever the
  frontend that calls them changes too, in the same PR. External endpoints
  are a contract with a system you don't control — changing one means
  coordinating with whoever owns the main CRM's side. Keeping them
  physically separate makes that blast radius obvious at a glance.
- **Different docs.** Internal endpoints are self-documenting to anyone
  reading the frontend code that calls them. External ones need to be
  documented for a human on the other team — see
  `../../EXTERNAL_API_DOCUMENTATION.md`.

> **Not everything external-facing lives in this folder.** Website
> Intelligence's `POST /api/wit/lead` (`controllers/witPublicController.js`,
> mounted via `routes/witPublic.js`) predates this folder and is currently
> the **primary, actually-in-production** lead-capture path (DebtFreePath
> and similar tracked sites) — it just uses a third auth model (per-site
> `trackingId`/`apiSecret` from Settings → Websites, not `ApiKey`) that
> doesn't fit the pattern here. It's fully documented in
> `../../EXTERNAL_API_DOCUMENTATION.md` §3 alongside everything in this
> folder — don't forget it exists just because it's not physically here.

## Layout

```
external-api/
  README.md                        ← this file
  index.js                         ← collects every domain's router, one require for app.js
  middleware/
    apiKeyAuth.js                  ← required-key auth, mount once per API-key domain router
    optionalApiKeyAuth.js          ← key checked only if sent, for mixed-trust public domains
  leadSync/                        ← API-key domain (trusted server, e.g. the main CRM)
    leadSync.routes.js             ← router: apiKeyAuth + endpoint list
    leadSync.controller.js         ← handlers
  leadCapture/                     ← public domain, key optional (many external sites, mixed trust)
    sources.js                     ← optional display-name lookup, NOT an allowlist
    leadCapture.routes.js          ← router: open CORS + optionalApiKeyAuth + rate limit
    leadCapture.controller.js      ← handlers
```

Each domain is a sibling folder. Which shape to copy depends on who's
calling — see [Auth models](#auth-models).

## Adding a new domain (e.g. `campaignSync`)

0. **Decide who's calling.** A trusted server you issue a credential to
   (like the main CRM) → follow `leadSync`'s shape, API-key-gated. An
   untrusted browser with no backend of its own (like a lead-capture form
   embedded on a marketing site) → follow `leadCapture`'s shape, public +
   origin-restricted. See [Auth models](#auth-models) for the reasoning;
   don't invent a third pattern without a real reason to.
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

That's the whole pattern for an API-key domain — no new auth mechanism to
design, no new model (every such domain reuses `ApiKey`), no new admin UI.

## Auth models

Two, chosen per-domain based on who's actually calling — don't mix them
inside one domain.

### 1. API key (`leadSync` — trusted server caller)

For a system you control the relationship with and can hand a credential
to over a secure channel (the main CRM's own backend).

- Keys are created/revoked from **Admin → API Keys** (`ApiKeysPage.jsx` →
  `/api/api-keys`, admin-only, JWT-protected — that management API is
  *internal*, not part of this folder).
- Keys are stored hashed (SHA-256) in `models/ApiKey.js`; the raw value is
  shown exactly once, at creation.
- `middleware/apiKeyAuth.js` reads `secret` from the query string (GET) or
  JSON body (POST), hashes it, and looks it up. No match → `401`.
- Every API-key domain's routes are wide open to *any* valid key — there's
  no concept of "this key can only call lead-sync" yet. Fine while there's
  one external caller (the main CRM) with one key. If a second,
  less-trusted caller shows up, or a domain needs to restrict which keys
  can hit it, that's the point to add a `scopes: [String]` field to
  `ApiKey` and check it in `apiKeyAuth` — don't add that now, it's pure
  speculation until there's a second caller.
- **Known limitation:** the key travels in the query string on GET
  requests (`?secret=...`), which means it can end up in server access
  logs / proxy logs, not just request bodies. Fine for the current
  trusted-network setup; worth moving to an `Authorization` or `X-API-Key`
  header if this ever crosses an untrusted network or a stricter
  compliance bar.

### 2. Public with an OPTIONAL key (`leadCapture` — many sites, mixed trust)

For sites with **no backend of their own** — there is nowhere safe to put
an API key; anything shipped to that site's JS is readable by anyone who
opens devtools. Requiring a secret here would just create a fake sense of
security for those callers. But not every caller is like that: a site that
proxies its form submission through its own serverless function (a Netlify
Function, a Vercel API route, etc.) genuinely CAN hold a secret safely,
same as `leadSync`'s callers. So this domain accepts a key but doesn't
require one — `middleware/optionalApiKeyAuth.js` instead of `apiKeyAuth`.

- **No key sent** → treated as anonymous. Still works, still subject to
  the rate limiter and honeypot below. This is the path for a genuinely
  frontend-only site — do not require a key to reach this path, that's the
  whole point of this domain existing.
- **Valid key sent** → `req.apiKey` is set, same shape as `leadSync`. The
  controller notes it in the lead's activity log for traceability, and the
  rate limiter (`publicLeadCaptureLimiter`) skips authenticated requests
  entirely — a trusted, admin-issued integration shouldn't share the same
  cap meant to contain anonymous/unknown traffic.
- **Invalid/revoked key sent** → `401`, not a silent fallback to
  anonymous. A caller that bothered to send a credential expects it
  checked; silently downgrading a bad key to "anonymous" would hide a real
  bug (typo'd env var, revoked key nobody updated) from whoever owns that
  integration.
- Whether or not a key is used, CORS is still wide open (`cors()`, no
  origin restriction) — a server-to-server caller with a key doesn't hit
  CORS at all (that's a browser mechanism), and the anonymous browser path
  still needs to work from any site with zero registration. The `:source`
  path segment stays a free-form label either way (optionally mapped to a
  nicer display name in `leadCapture/sources.js`) — never a credential.
- For genuinely anonymous callers, accept that this endpoint stays
  spammable by a motivated actor. The mitigation is that a fake lead here
  is low-value junk to delete, not a data exposure — that's *why* this
  tradeoff is acceptable for the no-key path and wouldn't be for anything
  higher-stakes.
