# Graph Report - crm-of-r-d  (2026-08-17)

## Corpus Check
- Large corpus: 259 files · ~643,285 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2167 nodes · 3830 edges · 211 communities (105 shown, 106 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 105 edges (avg confidence: 0.56)
- Token cost: 0 input · 589,483 output

## Community Hubs (Navigation)
- Email Accounts & Templates UI
- Backend Route Registry
- Email Templates & Rich Text UI
- Meta Ads Controller
- Rich Text Editor Extensions
- Social Account Controller
- Notification Drawer UI
- Settings Page UI
- Frontend App Shell & Store
- Campaign Controller
- External API Docs & Auth
- Leads Kanban & Form Views
- Main Controllers (Clients/Tasks/Meetings)
- Website Intelligence Public Controller
- Dashboard & Reports Pages
- Website Intelligence Page UI
- Extra Controllers (Channels/WorkLogs)
- Messages Page UI
- Billing Page UI
- Todo & Assignment Sheet Sync
- Campaign Tracking Controller
- Campaign Dispatcher Cron
- Campaign Email Worker
- Backend Server Entry Point
- Auth Middleware
- Prospect Audit Worker
- Follow-Up Email Dispatcher
- Email Account Controller
- Meta Ads Page UI
- Prospect Audit Controller
- System Logs Controller
- Mongoose Models Index
- Social Post Controller
- Prospect Audit Dispatcher Cron
- Billing Controller
- Lead Controller
- Settings Controller & Rate Limiting
- Website Intelligence Controller
- Notification Service & Model
- X (Twitter) Social Provider
- Email Worker (BullMQ)
- Frontend Dependencies
- Lead Pipeline Sync Backfill
- DB Config & Error Handling
- Lead Sync External API Controller
- System Logs Page UI
- Billing Reminders Cron
- Website Intelligence Analytics Endpoints
- Campaign Reply Sync Cron
- Lead Capture External API
- Meta Social Provider
- TikTok Social Provider
- Backend Dependencies
- Admin Data Seeding
- LinkedIn Social Provider
- Database Seed Script
- Calendar Pages UI
- Backend NPM Scripts
- Social Publish Worker
- API Docs Modal & Auth Refresh
- Frontend Mock Data
- Audit Logs Page UI
- Service Controller
- Website Intelligence Tracking Snippet
- Express App Setup
- Auth Controller
- Invoice Model & Portal
- Feature Authorization Middleware
- Social Post Publishing Service
- Social Provider Registry
- Frontend Build Tooling
- Revenue Controller & Integration Test
- YouTube Provider Error Handling
- YouTube Social Provider
- Gantt Chart View Component
- API Key Controller & Audit Service
- Email Verification Utility
- Email Template Controller
- Domain Auth Checker (SPF/DKIM/DMARC)
- Lead Pipeline Sync Utility
- Gantt Chart Page
- File Upload Middleware
- Social Provider Base Class
- Frontend Package Manifest
- Backend Package Manifest
- Social Media Upload Middleware
- Log Watcher Utility
- Deployment Shell Script
- Audit Log Model & Controller
- Notification Controller
- Worklog Inactivity Cron
- Social Platform Settings Controller
- Main CRM Integration Controller
- Meeting Scheduler Controller
- PageSpeed Integration Controller
- Client Portal Controller
- Social Publish Queue
- Notification Delivery Architecture (Proposed)
- Socket.IO Handler
- Prospect Scoring Utility
- SMTP Verification Test Script
- Social Post Model
- Email Service (Nodemailer)
- Redis Connection Test Script
- Graphify Tool Dependency
- CRM Sidebar Branding Asset
- Uploaded Next.js Screenshot
- Prospect Audit Model
- Prospect Audit Batch Model
- Social Publication Model
- Website Intelligence Form Event Model
- Website Intelligence Pageview Model
- Website Intelligence Session Model
- Website Intelligence Visitor Model
- Debt Free Path Client Logo
- GitHub Deploy Workflow
- Axios Dependency
- BullMQ Dependency
- Cheerio Dependency
- Cookie-Parser Dependency
- CORS Dependency
- CSV-Parse Dependency
- Express Dependency
- Express-Validator Dependency
- Google APIs Dependency
- ImapFlow Dependency
- Mongoose Dependency
- Morgan Dependency
- Multer Dependency
- Node-Cron Dependency
- PDFKit Dependency
- Socket.IO Dependency
- Admin Logs Route
- API Keys Route
- Audit Route
- Auth Route
- Billing Route
- Campaign Public Route
- Campaigns Route
- Clients Route
- Email Accounts Route
- Email Templates Route
- Leads Route
- Main CRM Integration Route
- Meetings Route
- Messages Route
- Meta Ads Route
- PageSpeed Integration Route
- Portal Route
- Prospect Audits Route
- Reports Route
- Revenue Route
- Services Route
- Social Accounts Route
- Social Analytics Route
- Social Calendar Route
- Social Platform Settings Route
- Social Posts Route
- Social Publications Route
- Tasks Route
- Todos Route
- Users Route
- Website Intelligence Route
- Public Website Intelligence Route
- Worklog Route
- Debt Free Path Logo (Duplicate Upload)
- Frontend HTML Entry Point
- Date-fns Dependency
- Framer Motion Dependency
- Lucide React Dependency
- Moment Dependency
- React Dependency
- React Big Calendar Dependency
- React Hot Toast Dependency
- React Router DOM Dependency
- Tiptap Color Extension
- Tiptap Image Extension
- Tiptap Link Extension
- Tiptap Placeholder Extension
- Tiptap Underline Extension
- Tiptap ProseMirror Dependency
- Tiptap React Dependency
- Tiptap Starter Kit
- XLSX Dependency
- Zustand Dependency
- Serena Project Configuration
- Lead Capture Controller (Docs Ref)
- Lead Capture Sources (Docs Ref)
- Lead Sync Controller (Docs Ref)
- Unrecognized HEIF Upload Asset
- Unrecognized HEIF Upload Asset
- Unrecognized HEIF Upload Asset
- Firewatch-style Wallpaper Upload
- Firewatch-style Wallpaper Upload
- Firewatch-style Wallpaper Upload
- Firewatch-style Wallpaper Upload
- Firewatch-style Wallpaper Upload
- Firewatch-style Wallpaper Upload
- MongoDB Compass Install Screenshot
- MongoDB Compass Install Screenshot
- Tab Logo Upload Asset
- Notification Email Channel (Proposed)
- Notification Web Push Channel (Proposed)
- Notification Preference Schema (Proposed)
- AgencyOS Tab Logo Asset
- README Tech Stack Overview

## God Nodes (most connected - your core abstractions)
1. `cn()` - 157 edges
2. `useAppStore` - 108 edges
3. `getId()` - 44 edges
4. `sameId()` - 38 edges
5. `canManage()` - 31 edges
6. `Page()` - 28 edges
7. `Button` - 27 edges
8. `Avatar()` - 19 edges
9. `Modal()` - 17 edges
10. `EmptyState()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Redis + BullMQ Queueing for Notification Delivery` --semantically_similar_to--> `emailQueue`  [INFERRED] [semantically similar]
  crm-agencyos/NOTIFICATION_ARCHITECTURE.md → crm-agencyos/backend/src/queues/emailQueue.js
- `AgencyOS Backend REST API Documentation` --references--> `app`  [INFERRED]
  crm-agencyos/backend/API_DOCUMENTATION.md → crm-agencyos/backend/src/app.js
- `HTTP Server + Socket.io Init (server.js)` --shares_data_with--> `app`  [INFERRED]
  crm-agencyos/CLAUDE.md → crm-agencyos/backend/src/app.js
- `emailService.js (Nodemailer wrapper)` --shares_data_with--> `emailQueue`  [INFERRED]
  crm-agencyos/CLAUDE.md → crm-agencyos/backend/src/queues/emailQueue.js
- `OS Notification Delivery (Service Worker + Notification API)` --references--> `useAppStore`  [EXTRACTED]
  crm-agencyos/CLAUDE.md → crm-agencyos/src/store/useAppStore.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **End-to-End Notification Delivery Flow (Current System)** — crm_agencyos_claude_notification_system_flow, crm_agencyos_backend_src_services_notificationservice_dispatch, crm_agencyos_backend_src_socket_sockethandler_sockethandler, crm_agencyos_claude_os_notification_delivery, crm_agencyos_claude_socket_room_naming_conventions [INFERRED 0.85]
- **Proposed Notification Blueprint Delivery Channels** — crm_agencyos_notification_architecture_channel_socketio, crm_agencyos_notification_architecture_channel_webpush, crm_agencyos_notification_architecture_channel_email [EXTRACTED 1.00]
- **External API Authentication Models** — crm_agencyos_backend_external_api_documentation_auth_api_key_model, crm_agencyos_backend_external_api_documentation_auth_optional_key_model, crm_agencyos_backend_external_api_documentation_auth_persite_credential_model [EXTRACTED 1.00]

## Communities (211 total, 106 thin omitted)

### Community 0 - "Email Accounts & Templates UI"
Cohesion: 0.07
Nodes (58): ApiDocsModal(), EmailAccountsManager(), EMPTY_FORM, warmupProgress(), Avatar(), AvatarGroup(), Badge(), Button (+50 more)

### Community 1 - "Backend Route Registry"
Cohesion: 0.03
Nodes (65): adminLogsRouter, apiKeyCtrl, apiKeyRouter, auditCtrl, auditRouter, auth, { authorizeFeature }, authRouter (+57 more)

### Community 2 - "Email Templates & Rich Text UI"
Cohesion: 0.06
Nodes (57): EmailTemplatesManager(), EMPTY_FORM, EmailTemplatesModal(), RichTextEditor, DropdownMenu(), PriorityBadge(), StatusBadge(), ViewToggle() (+49 more)

### Community 3 - "Meta Ads Controller"
Cohesion: 0.06
Nodes (50): buildEntityTable(), defaultRange(), deriveAttributionMetrics(), deriveMetrics(), fetchAttributedLeads(), getAds(), getAdSets(), getCampaigns() (+42 more)

### Community 4 - "Rich Text Editor Extensions"
Cohesion: 0.05
Nodes (45): EmailAccountsModal(), COLORS, ImageExt, LinkExt, parseStyleStr(), positionFloatingEl(), ResizableImageView(), SnippetExpander (+37 more)

### Community 5 - "Social Account Controller"
Cohesion: 0.05
Nodes (42): ALLOWED_PLATFORMS, callback(), connect(), frontendOrigin(), jwt, redirectUriFor(), schemeFor(), SocialAccount (+34 more)

### Community 6 - "Notification Drawer UI"
Cohesion: 0.07
Nodes (44): fmtTime(), getGroup(), NotificationDrawer(), NotifItem(), PRIORITY_BORDER, TYPE_FILTERS, TYPE_MAP, apiKeysAPI (+36 more)

### Community 7 - "Settings Page UI"
Cohesion: 0.05
Nodes (31): AddServiceModal(), buildRoutingFromSettings(), buildRulesFromSettings(), COLOR_SWATCHES, downloadCSV(), downloadJSON(), FEATURE_DEFS, FEATURE_ROUTABLE_ROLES (+23 more)

### Community 8 - "Frontend App Shell & Store"
Cohesion: 0.09
Nodes (35): activeThread State Resolution, DashboardLayout Notification Bridge, localStorage Key Schema, App Routing Structure (RequireAuth/RequireRole), Single Zustand Store Pattern, Socket Lifecycle Management in Store, Timer/Worklog Sync via sendBeacon, Unread Count Persistence via localStorage (+27 more)

### Community 9 - "Campaign Controller"
Cohesion: 0.07
Nodes (30): audit, Campaign, CampaignLead, { checkCampaignReady }, { effectiveDailyLimit }, EmailAccount, { fetchGoogleSheetCsv }, fs (+22 more)

### Community 10 - "External API Docs & Auth"
Cohesion: 0.06
Nodes (33): AgencyOS Backend REST API Documentation, API Key Auth Model, Optional API Key Auth Model, Per-Site trackingId/apiSecret Auth Model, Lead Capture API Domain (optional key), Lead Sync API Domain, Website Intelligence — Lead Capture API (wit), app (+25 more)

### Community 11 - "Leads Kanban & Form Views"
Cohesion: 0.08
Nodes (29): ConfettiCanvas(), EmailLeadsView(), ExternalFormLeadsSummary(), ExternalFormLeadsView(), LeadsKanbanView(), STAGE_COLORS, STAGES, EMAIL_TYPE_LABELS (+21 more)

### Community 12 - "Main Controllers (Clients/Tasks/Meetings)"
Cohesion: 0.06
Nodes (13): audit, { Client, Task, Todo, Meeting, Project, Channel, Message, Notification }, crypto, emailService, generatePassword(), { Invoice }, meetPopulate, notifService (+5 more)

### Community 13 - "Website Intelligence Public Controller"
Cohesion: 0.09
Nodes (28): { autoAssignLead }, captureLead(), { categorize, domainOf }, formEvent(), Lead, { lookupGeo }, notifService, pageend() (+20 more)

### Community 14 - "Dashboard & Reports Pages"
Cohesion: 0.11
Nodes (20): buildYearData(), DashboardPage(), DOW, getGreeting(), heatColor(), MONTHS, YearHeatmap(), downloadCSV() (+12 more)

### Community 15 - "Website Intelligence Page UI"
Cohesion: 0.14
Nodes (25): CountriesTable(), DETAIL_TABS, DevicesPanel(), downloadCSV(), downloadExcel(), fmtCurrency(), fmtDateTime(), fmtDuration() (+17 more)

### Community 16 - "Extra Controllers (Channels/WorkLogs)"
Cohesion: 0.08
Nodes (11): audit, createProject(), createProjectChannel(), getCanonicalThreadId(), getThreadMessages(), { Message, Task, Todo, WorkLog, Channel, Project, Client }, notifService, path (+3 more)

### Community 17 - "Messages Page UI"
Cohesion: 0.11
Nodes (16): AttachmentCard(), AttachmentPill(), fileIconCfg(), fmtSize(), handleDownload(), isImageFile(), isVideoFile(), MessagesPage() (+8 more)

### Community 18 - "Billing Page UI"
Cohesion: 0.12
Nodes (24): AttachmentView(), BillingPage(), BillingProfilesTab(), BUCKET_CFG, CollectionsTab(), emptyItem(), fmt(), fmtShort() (+16 more)

### Community 19 - "Todo & Assignment Sheet Sync"
Cohesion: 0.15
Nodes (23): createTodo(), deleteTodo(), updateTodo(), testAssignmentSheet(), colLetter(), COLUMN_ALIASES, deleteTodoFromSheet(), findHeaderRow() (+15 more)

### Community 20 - "Campaign Tracking Controller"
Cohesion: 0.13
Nodes (21): markReplied(), Campaign, CampaignLead, { HOT_OPEN_THRESHOLD }, notifService, { notifyMainCrm }, PAGE(), PIXEL (+13 more)

### Community 21 - "Campaign Dispatcher Cron"
Cohesion: 0.11
Nodes (21): scheduleCampaign(), startCampaign(), { addCampaignEmailToQueue }, Campaign, CampaignLead, { checkCampaignReady }, cron, dispatchOne() (+13 more)

### Community 22 - "Campaign Email Worker"
Cohesion: 0.13
Nodes (23): appendOpenPixel(), appendUnsubscribeFooter(), buildResponseOptionsHtml(), Campaign, CampaignLead, clientUrl, EmailAccount, err() (+15 more)

### Community 23 - "Backend Server Entry Point"
Cohesion: 0.09
Nodes (21): ALLOWED_ORIGINS, app, connectDB, { emailQueue }, emailQueueEvents, http, io, { logger } (+13 more)

### Community 24 - "Auth Middleware"
Cohesion: 0.11
Nodes (17): authorize(), authorizeRoles(), { Client }, jwt, protect(), User, express, { protect, authorize } (+9 more)

### Community 25 - "Prospect Audit Worker"
Cohesion: 0.15
Nodes (20): { calculateProspectScores }, checkPathExists(), cheerio, CMS_SIGNATURES, countBrokenLinks(), err(), fetchWithTimeout(), getPsiKey() (+12 more)

### Community 26 - "Follow-Up Email Dispatcher"
Cohesion: 0.14
Nodes (18): diagnoseCampaign(), startOfToday(), { addFollowUpEmailToQueue }, Campaign, CampaignLead, cron, dispatchOneFollowUp(), { effectiveDailyLimit } (+10 more)

### Community 27 - "Email Account Controller"
Cohesion: 0.14
Nodes (18): audit, checkDomain(), { checkDomainAuth }, deleteAccount(), EmailAccount, getAccounts(), { ImapFlow }, isPrivileged() (+10 more)

### Community 28 - "Meta Ads Page UI"
Cohesion: 0.14
Nodes (19): downloadCSV(), downloadExcel(), ENTITY_TABS, fmtCurrency(), fmtDateTime(), fmtISO(), fmtNum(), fmtPct() (+11 more)

### Community 29 - "Prospect Audit Controller"
Cohesion: 0.12
Nodes (11): audit, { fetchGoogleSheetCsv }, fs, HEADER_ALIASES, importProspects(), mapRow(), normalizeHeader(), normalizeUrl() (+3 more)

### Community 30 - "System Logs Controller"
Cohesion: 0.13
Nodes (15): { ALL_SOURCES, parseLine }, { FILES, PM2_FILES, LOG_DIR }, fs, getLogs(), mongoose, os, path, readLastN() (+7 more)

### Community 31 - "Mongoose Models Index"
Cohesion: 0.11
Nodes (17): mongoose, AttachmentSchema, BreakEntrySchema, ChannelSchema, ClientSchema, CounterSchema, MeetingInvitationSchema, MeetingSchema (+9 more)

### Community 32 - "Social Post Controller"
Cohesion: 0.13
Nodes (11): createPost(), getCalendar(), getPosts(), loadSelectedAccounts(), schedulePost(), SocialAccount, SocialPost, socialPostService (+3 more)

### Community 33 - "Prospect Audit Dispatcher Cron"
Cohesion: 0.15
Nodes (17): { addProspectAuditToQueue }, autoCompleteFinishedBatches(), cron, dailyCounts, ProspectAudit, ProspectAuditBatch, recordUsage(), remainingBudget() (+9 more)

### Community 34 - "Billing Controller"
Cohesion: 0.12
Nodes (6): audit, { Client }, computeTotals(), createInvoice(), { Invoice, Payment }, updateInvoice()

### Community 35 - "Lead Controller"
Cohesion: 0.16
Nodes (15): { addEmailToQueue, EMAIL_TYPES }, audit, { autoAssignLead }, autoCheckSLA(), bulkCreateLeads(), calculateHealthScore(), createLead(), EmailLog (+7 more)

### Community 36 - "Settings Controller & Rate Limiting"
Cohesion: 0.13
Nodes (13): FIELD_DEFAULTS, { getSheetsClient, isConfigured }, { invalidateFeatureAccessCache }, { invalidateLimitsCache }, { SystemSettings }, updateSystemSettings(), User, invalidateFeatureAccessCache() (+5 more)

### Community 37 - "Website Intelligence Controller"
Cohesion: 0.12
Nodes (11): FREQUENCY_BUCKETS, Lead, TrackedWebsite, { TRAFFIC_SOURCE_LABELS }, WitFormEvent, WitPageview, WitSession, WitVisitor (+3 more)

### Community 38 - "Notification Service & Model"
Cohesion: 0.13
Nodes (17): Notification Mongoose Model (current), defaults, dispatch(), dispatchByRouting(), Notification, SystemSettings, typeToPrefKey, User (+9 more)

### Community 39 - "X (Twitter) Social Provider"
Cohesion: 0.18
Nodes (7): base64url(), basicAuth(), classifyXError(), SCOPES, { SocialPublishError }, xFetch(), XProvider

### Community 40 - "Email Worker (BullMQ)"
Cohesion: 0.16
Nodes (15): cfg, createTransporter(), EmailLog, err(), log(), mongoose, nodemailer, { resolveIPv4 } (+7 more)

### Community 41 - "Frontend Dependencies"
Cohesion: 0.12
Nodes (17): clsx, dependencies, clsx, react-dom, react-hook-form, recharts, socket.io-client, @tiptap/extension-text-align (+9 more)

### Community 42 - "Lead Pipeline Sync Backfill"
Cohesion: 0.12
Nodes (14): CampaignLead, DRY_RUN, { HOT_OPEN_THRESHOLD }, Lead, mongoose, path, run(), { syncCampaignLeadToPipeline } (+6 more)

### Community 43 - "DB Config & Error Handling"
Cohesion: 0.14
Nodes (12): { logger }, mongoose, { logger }, FILES, fs, LOG_DIR, logger, os (+4 more)

### Community 44 - "Lead Sync External API Controller"
Cohesion: 0.12
Nodes (11): CampaignLead, DISPOSITION_STATUS_MAP, EmailLog, Lead, EmailLogSchema, mongoose, LeadActivitySchema, LeadContactSchema (+3 more)

### Community 45 - "System Logs Page UI"
Cohesion: 0.17
Nodes (16): fmtBytes(), fmtTs(), fmtUptime(), HealthPanel(), LEVEL_STYLE, LEVELS, levelStyle(), LogLine() (+8 more)

### Community 46 - "Billing Reminders Cron"
Cohesion: 0.18
Nodes (13): sendLeadEmail(), { addEmailToQueue, EMAIL_TYPES }, cron, { Invoice }, runReminders(), startBillingCron(), addEmailToQueue(), connection (+5 more)

### Community 47 - "Website Intelligence Analytics Endpoints"
Cohesion: 0.37
Nodes (16): defaultRange(), getCountries(), getDevices(), getForms(), getFunnel(), getLandingPages(), getLeadAttribution(), getPages() (+8 more)

### Community 48 - "Campaign Reply Sync Cron"
Cohesion: 0.13
Nodes (14): Campaign, CampaignLead, cron, EmailAccount, { ImapFlow }, notifService, { notifyMainCrm }, { resolveIPv4 } (+6 more)

### Community 49 - "Lead Capture External API"
Cohesion: 0.17
Nodes (13): { autoAssignLead }, captureLead(), Lead, notifService, SOURCE_NAMES, Counter, autoAssignLead(), getEligibleReps() (+5 more)

### Community 50 - "Meta Social Provider"
Cohesion: 0.20
Nodes (5): classifyMetaError(), graphFetch(), MetaProvider, SCOPES, { SocialPublishError }

### Community 51 - "TikTok Social Provider"
Cohesion: 0.18
Nodes (6): base64url(), classifyTikTokError(), SCOPES, { SocialPublishError }, TikTokProvider, tt()

### Community 52 - "Backend Dependencies"
Cohesion: 0.13
Nodes (15): bcryptjs, dependencies, bcryptjs, dotenv, express-rate-limit, helmet, jsonwebtoken, nodemailer (+7 more)

### Community 53 - "Admin Data Seeding"
Cohesion: 0.13
Nodes (11): ADMINS, {
  Client, Task, Todo, Meeting, MeetingInvitation, Revenue, WorkLog, Message
}, mongoose, Notification, path, Service, User, mongoose (+3 more)

### Community 54 - "LinkedIn Social Provider"
Cohesion: 0.21
Nodes (5): classifyLinkedInError(), li(), LinkedInProvider, SCOPES, { SocialPublishError }

### Community 55 - "Database Seed Script"
Cohesion: 0.13
Nodes (13): AuditLog, {
  Client, Task, Todo, Meeting, MeetingInvitation, Revenue, WorkLog, Message, Channel, Project, Counter
}, CLIENTS_DATA, EmailLog, Lead, mongoose, Notification, path (+5 more)

### Community 56 - "Calendar Pages UI"
Cohesion: 0.18
Nodes (13): CalendarPage(), DAYS, EVENT_ICONS, MONTHS, statusDot(), DAYS, MONTHS, PLATFORM_ICON (+5 more)

### Community 57 - "Backend NPM Scripts"
Cohesion: 0.14
Nodes (14): scripts, admin, backfill-lead-sync, campaign-worker, campaign-worker:dev, dev, prospect-audit-worker, prospect-audit-worker:dev (+6 more)

### Community 58 - "Social Publish Worker"
Cohesion: 0.20
Nodes (13): err(), log(), mongoose, { recomputePostStatus }, redisConn, shutdown(), SocialAccount, SocialPost (+5 more)

### Community 59 - "API Docs Modal & Auth Refresh"
Cohesion: 0.14
Nodes (8): API 401 Intercept + Auto-Refresh, Project Structure Overview, ALL_ENDPOINTS, ENDPOINT_GROUPS, GETTING_STARTED, MethodBadge(), STATUS_CODES, api

### Community 60 - "Frontend Mock Data"
Cohesion: 0.14
Nodes (12): GANTT_PROJECTS, MOCK_CLIENTS, MOCK_MEETINGS, MOCK_MESSAGES, MOCK_NOTIFICATIONS, MOCK_TASKS, MOCK_TODOS, MOCK_USERS (+4 more)

### Community 61 - "Audit Logs Page UI"
Cohesion: 0.21
Nodes (11): ActionBadge(), ACTIONS, CATEGORIES, CategoryBadge(), fmtAbs(), getCfg(), LogRow(), LogsPage() (+3 more)

### Community 62 - "Service Controller"
Cohesion: 0.15
Nodes (7): notifService, Service, User, bcrypt, jwt, mongoose, UserSchema

### Community 63 - "Website Intelligence Tracking Snippet"
Cohesion: 0.30
Nodes (10): getSession(), getVisitorId(), onLocationChange(), parseUtm(), scanForms(), send(), sendPageEnd(), sendPageview() (+2 more)

### Community 64 - "Express App Setup"
Cohesion: 0.17
Nodes (10): ALLOWED_ORIGINS, cookieParser, cors, distPath, errorHandler, express, externalApi, helmet (+2 more)

### Community 65 - "Auth Controller"
Cohesion: 0.20
Nodes (7): audit, { Client }, jwt, login(), refresh(), sendTokens(), User

### Community 66 - "Invoice Model & Portal"
Cohesion: 0.23
Nodes (10): downloadPDF(), getInvoice(), getInvoices(), Invoice, InvoiceSchema, InvoiceVersionSchema, LineItemSchema, mongoose (+2 more)

### Community 67 - "Feature Authorization Middleware"
Cohesion: 0.20
Nodes (10): denyClientWrites(), authorizeFeature(), cache, getFeatureAccessMap(), { SystemSettings }, { authorizeFeature }, express, { protect, denyClientWrites } (+2 more)

### Community 68 - "Social Post Publishing Service"
Cohesion: 0.24
Nodes (10): { addSocialPublishToQueue }, createPublicationsAndEnqueue(), publishNow(), recomputePostStatus(), retryPublication(), schedulePost(), SocialPost, SocialPublication (+2 more)

### Community 69 - "Social Provider Registry"
Cohesion: 0.18
Nodes (10): APP_CONFIG_FOR_ACCOUNT_PLATFORM, getProvider(), LinkedInProvider, MetaProvider, publish(), REGISTRY, { SystemSettings }, TikTokProvider (+2 more)

### Community 70 - "Frontend Build Tooling"
Cohesion: 0.18
Nodes (11): autoprefixer, devDependencies, autoprefixer, postcss, tailwindcss, vite, @vitejs/plugin-react, tailwindcss (+3 more)

### Community 71 - "Revenue Controller & Integration Test"
Cohesion: 0.18
Nodes (6): meetingSchedulerController, mongoose, { Revenue, Meeting, MeetingInvitation }, revenueController, User, { Revenue }

### Community 72 - "YouTube Provider Error Handling"
Cohesion: 0.20
Nodes (7): { google }, { Readable }, SCOPES, { SocialPublishError }, NON_RETRYABLE_CODES, RETRYABLE_CODES, SocialPublishError

### Community 74 - "Gantt Chart View Component"
Cohesion: 0.38
Nodes (10): addDays(), daysDiff(), fmtMonth(), GanttView(), monthEnd(), monthStart(), pd(), PeriodNav() (+2 more)

### Community 75 - "API Key Controller & Audit Service"
Cohesion: 0.20
Nodes (3): ApiKey, audit, AuditLog

### Community 76 - "Email Verification Utility"
Cohesion: 0.27
Nodes (9): verifyLead(), CONSUMER_PROVIDERS, DISPOSABLE_DOMAINS, dns, providerFromMx(), resolveDomain(), worker(), verifyEmail() (+1 more)

### Community 77 - "Email Template Controller"
Cohesion: 0.24
Nodes (6): deleteTemplate(), EmailTemplate, isPrivileged(), updateTemplate(), EmailTemplateSchema, mongoose

### Community 78 - "Domain Auth Checker (SPF/DKIM/DMARC)"
Cohesion: 0.38
Nodes (9): checkDkim(), checkDmarc(), checkDomainAuth(), checkSpf(), COMMON_DKIM_SELECTORS, dns, resolver, resolveTxtFlat() (+1 more)

### Community 79 - "Lead Pipeline Sync Utility"
Cohesion: 0.29
Nodes (9): { autoAssignLead }, Campaign, companyGuess(), displayName(), doSync(), escapeRegExp(), findLeadByEmail(), Lead (+1 more)

### Community 80 - "Gantt Chart Page"
Cohesion: 0.31
Nodes (9): addDays(), DAY_ABBR, diffDays(), GanttPage(), MONTH_ABB, PALETTE, parseDate(), startOfDay() (+1 more)

### Community 81 - "File Upload Middleware"
Cohesion: 0.22
Nodes (7): fs, multer, path, storage, upload, uploadDir, Test Upload — Academic Transcript PDF Sample

### Community 83 - "Frontend Package Manifest"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, preview, type, version

### Community 84 - "Backend Package Manifest"
Cohesion: 0.25
Nodes (7): description, devDependencies, nodemon, main, name, version, nodemon

### Community 85 - "Social Media Upload Middleware"
Cohesion: 0.25
Nodes (6): fs, multer, path, socialUpload, storage, uploadDir

### Community 87 - "Deployment Shell Script"
Cohesion: 0.46
Nodes (5): check_pm2(), fail(), ok(), deploy.sh script, step()

### Community 88 - "Audit Log Model & Controller"
Cohesion: 0.29
Nodes (3): AuditLog, AuditLogSchema, mongoose

### Community 90 - "Worklog Inactivity Cron"
Cohesion: 0.33
Nodes (6): cron, runInactivityTick(), startWorklogInactivityCron(), sysLog, User, { WorkLog }

### Community 91 - "Social Platform Settings Controller"
Cohesion: 0.43
Nodes (6): assertPlatform(), clearCredentials(), FIELD, getStatus(), saveCredentials(), { SystemSettings }

### Community 96 - "Social Publish Queue"
Cohesion: 0.50
Nodes (4): cancelPost(), connection, { Queue }, socialPublishQueue

### Community 97 - "Notification Delivery Architecture (Proposed)"
Cohesion: 0.40
Nodes (5): emailQueue, emailService.js (Nodemailer wrapper), emailWorker.js (BullMQ worker, 3 retries), Redis + BullMQ Queueing for Notification Delivery, Rate Limiting & Digest Aggregation

### Community 98 - "Socket.IO Handler"
Cohesion: 0.40
Nodes (4): { Channel, Task, Project }, disconnectTimeouts, jwt, User

### Community 99 - "Prospect Scoring Utility"
Cohesion: 0.70
Nodes (4): buildFlags(), calculateOpportunityScore(), calculateProspectScores(), calculateTechnicalScore()

### Community 100 - "SMTP Verification Test Script"
Cohesion: 0.40
Nodes (4): nodemailer, pass, path, transporter

### Community 101 - "Social Post Model"
Cohesion: 0.50
Nodes (3): mongoose, SocialMediaItemSchema, SocialPostSchema

### Community 102 - "Email Service (Nodemailer)"
Cohesion: 0.67
Nodes (3): createTransporter(), nodemailer, sendClientWelcome()

### Community 103 - "Redis Connection Test Script"
Cohesion: 0.50
Nodes (3): path, port, Redis

### Community 104 - "Graphify Tool Dependency"
Cohesion: 0.50
Nodes (3): graphifyy, dependencies, graphifyy

### Community 105 - "CRM Sidebar Branding Asset"
Cohesion: 0.67
Nodes (3): BizzBuzz Creations Branding, CRM Sidebar Navigation UI, BizzBuzz Creations CRM Sidebar Logo

### Community 106 - "Uploaded Next.js Screenshot"
Cohesion: 1.00
Nodes (3): BizzBuzz Next.js Project, Next.js App Router Directory Convention, VS Code Explorer Screenshot: BizzBuzz Project Structure

### Community 114 - "Debt Free Path Client Logo"
Cohesion: 0.67
Nodes (3): Debt Free Path (Brand), Debt Free Path Logo Image, User-Uploaded File Asset (Multer /uploads)

## Knowledge Gaps
- **874 isolated node(s):** `mongoose`, `User`, `{ Revenue, Meeting, MeetingInvitation }`, `revenueController`, `meetingSchedulerController` (+869 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **106 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAppStore` connect `Frontend App Shell & Store` to `Email Accounts & Templates UI`, `Email Templates & Rich Text UI`, `Rich Text Editor Extensions`, `Notification Service & Model`, `Notification Drawer UI`, `Settings Page UI`, `Leads Kanban & Form Views`, `Dashboard & Reports Pages`, `Gantt Chart Page`, `Messages Page UI`, `Billing Page UI`, `Calendar Pages UI`, `API Docs Modal & Auth Refresh`, `Audit Logs Page UI`?**
  _High betweenness centrality (0.341) - this node is a cross-community bridge._
- **What connects `mongoose`, `User`, `{ Revenue, Meeting, MeetingInvitation }` to the rest of the system?**
  _874 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Email Accounts & Templates UI` be split into smaller, more focused modules?**
  _Cohesion score 0.0687719298245614 - nodes in this community are weakly interconnected._
- **Should `Backend Route Registry` be split into smaller, more focused modules?**
  _Cohesion score 0.030303030303030304 - nodes in this community are weakly interconnected._
- **Should `Email Templates & Rich Text UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06490384615384616 - nodes in this community are weakly interconnected._
- **Should `Meta Ads Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.05649717514124294 - nodes in this community are weakly interconnected._
- **Should `Rich Text Editor Extensions` be split into smaller, more focused modules?**
  _Cohesion score 0.05241090146750524 - nodes in this community are weakly interconnected._