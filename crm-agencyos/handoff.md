# Handoff — 2026-08-21

Context dump of everything covered in this session, for whoever (human or AI)
picks this up next. Written from the CRM repo root
(`crm-of-r-d/crm-agencyos`), backend at `backend/`.

---

## 1. Production incidents fixed (start of session)

- **`prospect-audit-worker` crash-looping in production**: `ReferenceError:
  File is not defined` from `undici` (pulled in transitively by the `cheerio`
  dependency). Root cause: production's Node version predates the native
  `File` global. Fixed with a polyfill at the top of
  `backend/src/workers/prospectAuditWorker.js` — safe no-op on any Node
  version that already has `File`.
- **CSV upload failing at 4MB**: nginx's default `client_max_body_size` (1MB)
  was silently rejecting uploads before they reached the app. Fixed by adding
  `client_max_body_size 15M;` to `/etc/nginx/sites-available/rndCRM` on the
  VPS (not tracked in this repo — a manual server-side change).
- **"Only 10k of 19k rows imported"**: not a bug — confirmed via the toast
  message that the missing rows were legitimate duplicates (same email/
  business+phone), common with Maps-scraped lists covering overlapping
  search areas.
- **PM2 process chaos after a VM reboot**: two PM2 entries (`worker` and
  `email-worker`) were misconfigured to run `server.js` instead of their
  real scripts, both fighting over port 5000 (`EADDRINUSE`), which is why
  `rndCRM-backend` kept crash-looping. Fixed by deleting/recreating those
  entries pointed at the correct scripts, then `pm2 save`.

---

## 2. Social Media Management module (major feature, built this session)

Full new CRM section: **Social Media** → Connected Accounts / Composer /
Calendar / Posts. Real OAuth, real publishing, no mocked success anywhere.

### Architecture
- Provider interface (`backend/src/modules/social/providers/base/SocialProvider.js`)
  implemented by `MetaProvider` (covers both `facebook_page` and
  `instagram_business` — one Meta App, one OAuth flow), `LinkedInProvider`,
  `XProvider`, `YouTubeProvider`, `TikTokProvider`.
- `socialService.js` is the only thing controllers/workers touch — resolves
  `platform → provider` via a small registry. Adding a new platform later is
  "write a provider, add one registry line," no other changes needed.
- Models: `SocialAccount`, `SocialPost`, `SocialPublication` (one
  publication row per platform per post — this is what makes retry correct:
  retrying a failed LinkedIn post never re-triggers an already-succeeded
  Facebook one).
- Scheduling: BullMQ, **one job per publication**, using BullMQ's native
  `delay` option directly (no polling dispatcher needed, unlike
  campaign/prospect-audit sending).
- New worker process: `social-publish-worker` (`npm run
  social-publish-worker`), added to `deploy.sh`'s PM2 management the same
  way `prospect-audit-worker` is.
- Errors are normalized (`{platform, code, message, retryable}`) — non-
  retryable errors (bad token, permission denied, bad media) are saved as
  permanently failed without letting BullMQ auto-retry them; only transient
  ones (rate limit, network, 5xx) get BullMQ's exponential backoff.
- New `social.log` + a "Social" tab in System Logs.

### Credentials — Settings → Social Media Platforms (admin only)
App ID/Secret for all 5 platforms are entered in the CRM itself (**not**
`.env`) — Meta App, LinkedIn App, X App, YouTube App, TikTok App. Each card
shows the exact OAuth callback URL to register with that platform, computed
from the request's own host so it's correct in both dev and prod.

### Real platform constraints worth remembering
- **Meta**: Facebook Page + linked Instagram Business account connect in one
  OAuth grant. An Instagram account can only be linked to **one** Facebook
  Page at a time (Meta's own rule, not ours) — a second Instagram account
  needs its own dedicated Page.
- **X**: meaningful posting volume needs a paid X API tier — the free tier
  is very limited.
- **YouTube**: video-only, no text-only posts. Composer shows a separate
  Title field only when a YouTube account is selected.
- **TikTok**: video-only. Until the TikTok app completes their Content
  Posting API audit, posts publish as **private** (visible only to the
  connected creator) — that's TikTok's own restriction.

### Current connection status (as of this session)
- **Meta (Facebook/Instagram): working.** Had to create a *second*,
  dedicated Meta App — the first one only had ads/Marketing API use cases
  attached and couldn't be extended to Pages/Instagram after the fact
  ("create a new app" was Meta's own suggestion). The working app has both
  "Manage everything on your Page" and "Manage messaging & content on
  Instagram" use cases, with `pages_manage_posts`/`instagram_content_publish`
  etc. explicitly added under each use case's Permissions tab (adding the
  use case alone isn't enough — the individual permissions need enabling
  too). Connected: 3 Facebook Pages, 2 linked Instagram accounts.
- **LinkedIn, X, YouTube, TikTok: not yet configured** — no App credentials
  entered yet.
- **Known follow-up**: a second Instagram account (`@thatsbizzbuzzcreations_`)
  still needs its own dedicated Facebook Page before it can be connected —
  it currently has no Page link on Meta's side at all.

### Two real bugs found and fixed during live OAuth testing
1. **`redirect_uri` sent as `http://` instead of `https://`** — nginx
   terminates HTTPS but doesn't forward that to the Node backend, so
   `req.protocol` always read `http`. Facebook (correctly) refuses non-HTTPS
   redirect URIs. Fixed in `socialAccountController.js` by deriving the
   scheme from the host instead of trusting `req.protocol` (assumes `https`
   for anything that isn't literally `localhost`/`127.0.0.1`).
2. **OAuth callback route sat behind the same `protect` auth middleware as
   the rest of the router** — but the callback is hit by the *platform's*
   redirect (the browser navigating back from Facebook with just
   `?code=&state=`), which can never carry the CRM's Bearer token. Every
   real OAuth completion 401'd before reaching the handler. Fixed by
   registering `/:platform/callback` **before** the `protect`/
   `authorizeFeature` middleware in `routes/index.js` — its actual security
   comes from verifying the signed `state` JWT inside the controller, not
   from a login session.

### Settings navigation restructure
Split the old flat "Global Admin" list into three sections:
- **Global Admin** — Company Profile, Auth Controls, Sales Pipelines,
  Feature Access Control, Services Dir.
- **Integrations** — IVA CRM Integration, PageSpeed Insights, Meta Ads,
  Websites. (Meta Ads and Websites moved here from Operations.)
- **Social Media Platforms** — the 5 per-platform app-credential cards.

### Still to deploy
Everything above is committed locally but the exact deploy state as of the
end of this session should be double-checked (`git status`, `git log`) before
assuming production has all of it — walk through `git diff` against the
deployed commit if picking this up cold.

---

## 3. Timer / hours-log system

### Final state — exactly 5 ways the timer stops
1. **Pause** button (`pauseTimer()`)
2. **Break** start (`startBreak()`)
3. **Logout** (`logout()`)
4. **10-hour daily ceiling** — automatic safety net, the only time-based
   auto-stop. Deliberately kept (see below) as protection against a
   forgotten logout running 24+ hours.
5. **Server restart** — boot-time sweep in `backend/src/config/db.js` flips
   any worklog still `active`/`breakActive` back to `false` (does not touch
   `workSeconds`, only fixes the flags).

Tab close/refresh/backgrounding/network loss/socket disconnect are all
**deliberately not** stop triggers — this is intentional, documented in code
comments in `useAppStore.js` and `socketHandler.js`.

### Real bugs found and fixed
1. **Logout race**: `logout()`'s two calls that tell the backend "stop the
   timer" (`worklogAPI.upsert(...)` and `worklogAPI.setActive(false)`) were
   fire-and-forget, not awaited. If a page navigation/reload happened right
   after logout, the browser could cancel the in-flight request before it
   reached the server — leaving the `WorkLog` stuck at `active:true`. On the
   next login, the app trusts the DB as the source of truth for
   `active`/`breakActive`, so it would silently resume the timer with no
   "Start Timer" click. **Fixed** by awaiting both calls before `logout()`
   proceeds.
2. **Refresh token too short for a silent background failure**:
   `tickTimer`'s automatic 15s sync keeps firing from a background tab
   regardless of focus. If the 15-min access token expired and the
   automatic refresh failed, the app would silently force-logout with zero
   user action (`crm:logout` window event → `logout()` → timer stops) — this
   is what was happening to a team member whose timer stopped despite never
   touching Pause/Logout. **Fixed** by extending `JWT_REFRESH_EXPIRE` from
   `7d` to `30d` (in `backend/.env`, plus the fallback default in
   `User.js`'s `getRefreshToken()`, plus the cookie `maxAge` in
   `authController.js`'s `sendTokens()` — all three had to move together or
   the cookie would get deleted before the longer-lived JWT inside it
   expired). **Production's `.env` needs this same change — `.env` is not
   part of the deploy, must be edited on the VPS directly.**

### A cron that was built, then fully reverted
Briefly built `backend/src/cron/worklogInactivityCron.js` — a 5-minute cron
that force-stopped any timer that hadn't synced in over an hour. **Explicitly
reverted per instruction** — the user decided the 10h ceiling should remain
the only time-based auto-stop, and didn't want a separate 1-hour inactivity
rule. If this file or any reference to `startWorklogInactivityCron`
resurfaces in a diff, that's leftover from this reverted attempt — it should
stay removed.

---

## 4. Deployment checklist

- [ ] `backend/.env` on the VPS: bump `JWT_REFRESH_EXPIRE` from `7d` to `30d`
      (manual edit, `.env` isn't deployed by the pipeline).
- [ ] Confirm `deploy.sh` starts/restarts `social-publish-worker` via PM2
      (added this session, mirrors `prospect-audit-worker`'s pattern).
- [ ] Confirm nginx's `client_max_body_size 15M;` fix is still in place on
      the VPS (manual nginx edit, not tracked in this repo).
- [ ] Once LinkedIn/X/YouTube/TikTok Apps are created, their App ID/Secret
      go into Settings → Social Media Platforms in the running app itself —
      no deploy needed for that part.

---

## 5. Open items / known follow-ups

- Link `@thatsbizzbuzzcreations_` (Instagram) to its own dedicated Facebook
  Page on Meta's side, then reconnect in the CRM.
- LinkedIn, X, YouTube, TikTok Apps not yet created — Social Media
  Management only actually works end-to-end for Facebook/Instagram right
  now.
- Deep engagement analytics (pulling each platform's own Insights API) and
  a social inbox (comments/DMs) were explicitly scoped out of this build —
  noted as future work in the original plan, not started.
