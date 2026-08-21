# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Frontend (from `crm-agencyos/`)
```bash
npm run dev       # Vite dev server → http://localhost:5173
npm run build     # Production build → /dist
npm run preview   # Preview the production build
```

### Backend (from `crm-agencyos/backend/`)
```bash
npm run dev       # nodemon dev server → http://localhost:5000
npm start         # Production server
npm run seed      # Seed MongoDB with demo accounts
npm run worker    # Start BullMQ email worker (separate process)
npm run worker:dev
```

Full-stack dev needs: MongoDB running + Redis on `127.0.0.1:6379` + both servers.

---

## Architecture

### Single Zustand Store (`src/store/useAppStore.js`)

Everything lives here — auth, users, messages/channels/DMs, tasks, todos, clients, leads, meetings, notifications, timer, UI state. It is ~1500 lines and is the most important file in the frontend. Key patterns:

- **Socket lifecycle** lives in the store. `connectSocket(store)` is called after login/session restore. The socket URL auto-detects dev (`:5000`) vs production (same origin). Auth token is read fresh on every reconnect attempt via a callback (`auth: (cb) => cb({ token: localStorage.getItem('crm_access_token') })`), so token refreshes don't break socket auth.
- **`activeThread`** drives the entire Messages UI. It defaults to `'general'` but real channel IDs are MongoDB ObjectIds — after `loadAllData()` runs, `activeThread` is resolved to the actual `general` channel ID.
- **Unread counts** are persisted in `localStorage` keyed `crm_unread_{userId}` (JSON map of `threadId → count`) so badge counts survive page reloads.
- **Timer/worklog** is synced to `/api/worklog` via `navigator.sendBeacon()` on `beforeunload` so work time isn't lost on tab close.
- **OS notifications** use `navigator.serviceWorker.ready.then(reg => reg.showNotification(...))` for Chrome/Brave/Edge (required when a SW is registered), falling back to `new Notification()` for Firefox/Safari. The public SW file is `public/sw-notify.js`.

### API Service (`src/services/api.js`)

Axios instance with:
- Dynamic base URL: dev → `http://localhost:5000/api`, prod → `{origin}/api`
- Bearer token injected from `localStorage.getItem('crm_access_token')`
- **401 intercept + auto-refresh**: queues concurrent failed requests, calls `/api/auth/refresh`, replays all queued requests. Dispatches `crm:logout` window event on refresh failure.
- `withCredentials: true` on all requests (refresh token is an httpOnly cookie)

### Routing (`src/routes/AppRouter.jsx`)

`BrowserRouter` → `RequireAuth` → `DashboardLayout` (sidebar + navbar) → page routes. `RequireRole` gates `/clients`, `/leads`, `/team`, `/logs`, `/system-logs` by role. All protected routes are children of the `/` layout route.

`DashboardLayout.jsx` does more than layout — it registers `sw-notify.js`, listens for `crm:navigate-thread` DOM events (from in-app toast clicks) and `crm:navigate` SW messages (from OS notification clicks), and calls `navigate()` for both.

### Backend Structure (`backend/src/`)

```
app.js              — Express app, CORS (allows localhost + configured CLIENT_URL + any 192.168/10.x LAN IP), routes mount
server.js           — HTTP server + Socket.io init + BullMQ queue event listeners
socket/
  socketHandler.js  — All socket auth + room join logic + event handlers
controllers/        — One file per domain (auth, users, tasks, messages, channels, ...)
routes/             — One file per domain, mounted in app.js
models/             — Mongoose schemas (User, Task, Message, Channel, Notification, Lead, AuditLog, ...)
services/
  notificationService.js  — dispatch(io, { recipient, type, title, message, link }) → saves to DB + socket emit to user:{id}
  emailService.js         — Nodemailer wrapper
middleware/
  auth.js           — protect (JWT verify, reads from Bearer header → cookie → _token query param) + authorize(...roles)
  upload.js         — Multer config (stores in /uploads/)
queues/emailQueue.js + workers/emailWorker.js  — BullMQ email jobs, 3 retries
utils/logWatcher.js — Watches log files, streams new lines to admin:syslog socket room
```

### Real-time (Socket.io)

**Room naming conventions:**
- `user:{userId}` — personal notifications
- `{channelObjectId}` — channel messages
- `dm-{sortedId1}-{sortedId2}` — DM threads (IDs sorted to guarantee both users share the same room name)
- `admin` — admin-only broadcasts
- `admin:syslog` — live system log streaming

Frontend thread IDs use a shorthand: `dm-{otherUserId}` (not the canonical two-part form). The store normalizes the incoming canonical form to the shorthand in the `message:new` socket handler.

### Notification System

1. Backend: `notificationService.dispatch(io, {...})` saves a `Notification` doc and emits `notification:new` to `user:{recipientId}`.
2. Frontend store: `sock.on('notification:new', ...)` handles in-app toast + OS browser notification + Web Audio chime.
3. `message:new` events are handled *separately* from `notification:new` — the store deduplicates and skips the toast/OS notification for DMs that arrive via `message:new` (type `message_dm`) to avoid duplicates.
4. OS notifications require user to click **"Enable notifications"** in the Messages page sidebar (permission requires a user gesture — cannot be auto-requested on load).

### `localStorage` Keys
| Key | Purpose |
|-----|---------|
| `crm_access_token` | JWT access token (short-lived, 15m) |
| `crm_unread_{userId}` | JSON map of threadId → unread count |
| `crm_timer_v2_{userId}` | Timer state (workSeconds, sessionDate, breaks, ...) |
| `crm_worklog_{userId}` | Local worklog buffer |

---

## Environment Variables

### Backend (`backend/.env`)
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/agencyos
JWT_SECRET=...
JWT_EXPIRE=15m
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRE=30d
CLIENT_URL=http://localhost:5173
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=noreply@agencyos.com
```

### Frontend (`.env`)
```
# Usually not needed — URLs are auto-detected from browser origin
VITE_API_URL=http://localhost:5000/api
```
