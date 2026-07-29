// ── This file exports all routers ──────────────────────────────
// Each section creates its own express.Router() and exports it.
// The app.js imports these.

const express = require('express');
const { protect, authorize, authorizeRoles, authorizeOrFlag, denyClientWrites } = require('../middleware/auth');
const upload  = require('../middleware/upload');
const { loginLimiter, witPublicLimiter } = require('../middleware/rateLimiters');

const auth = require('../controllers/authController');
const ctrl = require('../controllers/mainControllers');
const xtra = require('../controllers/extraControllers');
const revenue = require('../controllers/revenueController');
const meetingScheduler = require('../controllers/meetingSchedulerController');
const serviceCtr = require('../controllers/serviceController');
const billing = require('../controllers/billingController');

// ── Auth routes ───────────────────────────────────────────────
const authRouter = express.Router();
authRouter.post('/login',    loginLimiter, auth.login);
authRouter.post('/logout',   auth.logout);
authRouter.post('/refresh',  auth.refresh);
authRouter.get('/me',        protect, auth.me);
authRouter.put('/profile',   protect, auth.updateProfile);
authRouter.put('/password',  protect, auth.changePassword);
module.exports.auth = authRouter;

// ── Users routes ──────────────────────────────────────────────
const usersRouter = express.Router();
usersRouter.use(protect);
usersRouter.get('/',        ctrl.getUsers);
usersRouter.post('/',       authorize('admin','manager'), ctrl.createUser);
usersRouter.put('/:id',     authorize('admin','manager'), ctrl.updateUser);
usersRouter.delete('/:id',  authorize('admin','manager'), ctrl.deleteUser);
module.exports.users = usersRouter;

// ── Clients routes ────────────────────────────────────────────
const clientsRouter = express.Router();
clientsRouter.use(protect);
clientsRouter.get('/',             ctrl.getClients);
clientsRouter.get('/:id',          ctrl.getClient);
clientsRouter.post('/',            authorize('admin','manager'), ctrl.createClient);
clientsRouter.put('/:id',          authorize('admin','manager'), ctrl.updateClient);
clientsRouter.delete('/:id',       authorize('admin','manager'), ctrl.deleteClient);
clientsRouter.post('/:id/notes',              ctrl.addClientNote);
clientsRouter.post('/:id/reset-portal-password', authorize('admin'), ctrl.resetPortalPassword);
module.exports.clients = clientsRouter;

// ── Tasks routes ──────────────────────────────────────────────
const tasksRouter = express.Router();
tasksRouter.use(protect);
tasksRouter.use(denyClientWrites); // clients are read-only
tasksRouter.get('/',    ctrl.getTasks);
tasksRouter.post('/',   upload.array('files', 10), ctrl.createTask);
tasksRouter.put('/:id', upload.array('files', 10), ctrl.updateTask);
tasksRouter.delete('/:id', authorize('admin','manager'), ctrl.deleteTask);
module.exports.tasks = tasksRouter;

// ── Todos routes ──────────────────────────────────────────────
const todosRouter = express.Router();
todosRouter.use(protect);
todosRouter.get('/',    ctrl.getTodos);
todosRouter.post('/',   upload.array('files', 10), ctrl.createTodo);
todosRouter.put('/:id', upload.array('files', 10), ctrl.updateTodo);
todosRouter.delete('/:id', ctrl.deleteTodo);
module.exports.todos = todosRouter;

// ── Meetings routes ───────────────────────────────────────────
const meetingsRouter = express.Router();
meetingsRouter.use(protect);
meetingsRouter.use(denyClientWrites); // clients are read-only
meetingsRouter.get('/',    ctrl.getMeetings);
meetingsRouter.post('/',   authorize('admin','manager'), ctrl.createMeeting);
meetingsRouter.put('/:id', authorize('admin','manager'), ctrl.updateMeeting);
meetingsRouter.delete('/:id', authorize('admin','manager'), ctrl.deleteMeeting);

// Invitation-based scheduler additions
meetingsRouter.post('/schedule',           meetingScheduler.scheduleMeeting);
meetingsRouter.put('/rsvp/:invitationId',  meetingScheduler.updateRSVP);
meetingsRouter.get('/my-schedule',         meetingScheduler.getMySchedule);

module.exports.meetings = meetingsRouter;

// ── Messages routes ───────────────────────────────────────────
const messagesRouter = express.Router();
messagesRouter.use(protect);
messagesRouter.get('/:threadId',  xtra.getThreadMessages);
messagesRouter.post('/:threadId', upload.array('files', 5), xtra.sendMessage);
messagesRouter.delete('/:id',     xtra.deleteMessage);
messagesRouter.post('/:id/react', xtra.toggleReaction);
module.exports.messages = messagesRouter;

// ── Reports routes ────────────────────────────────────────────
const reportsRouter = express.Router();
reportsRouter.use(protect);
reportsRouter.get('/', xtra.getReport);
module.exports.reports = reportsRouter;

// ── WorkLog routes ────────────────────────────────────────────
const worklogRouter = express.Router();
worklogRouter.use(protect);
worklogRouter.get('/',      xtra.getWorkLog);
worklogRouter.post('/',     xtra.upsertWorkLog);
worklogRouter.patch('/active', xtra.setUserActive);
worklogRouter.delete('/bulk', authorize('admin'), xtra.bulkDeleteWorkLogs); // /bulk before /:id
worklogRouter.delete('/:id',  authorize('admin'), xtra.deleteWorkLog);
module.exports.worklog = worklogRouter;

// ── Revenue routes ────────────────────────────────────────────
const revenueRouter = express.Router();
revenueRouter.use(protect);
revenueRouter.get('/summary', authorizeRoles('admin', 'manager'), revenue.getRevenueSummary);
revenueRouter.post('/record', authorizeRoles('admin'), revenue.recordRevenue);
module.exports.revenue = revenueRouter;

// ── Services routes ───────────────────────────────────────────
const servicesRouter = express.Router();
servicesRouter.use(protect);
servicesRouter.get('/',     serviceCtr.getServices);
servicesRouter.post('/',    authorize('admin'), serviceCtr.createService);
servicesRouter.put('/:id',  authorize('admin'), serviceCtr.updateService);
servicesRouter.delete('/:id', authorize('admin'), serviceCtr.deleteService);
module.exports.services = servicesRouter;

// ── Leads routes ──────────────────────────────────────────────
const leadCtrl = require('../controllers/leadController');
const leadsRouter = express.Router();
leadsRouter.use(protect);
leadsRouter.get('/',            leadCtrl.getLeads);
leadsRouter.post('/bulk',       leadCtrl.bulkCreateLeads);   // /bulk before /:id
leadsRouter.post('/merge',      authorize('admin','manager'), leadCtrl.mergeLeads);
leadsRouter.post('/',           leadCtrl.createLead);
leadsRouter.put('/:id',         leadCtrl.updateLead);
leadsRouter.post('/:id/email',  leadCtrl.sendLeadEmail);
leadsRouter.get('/:id/emails',  leadCtrl.getLeadEmails);     // email history log
leadsRouter.delete('/:id',      authorize('admin','manager'), leadCtrl.deleteLead);
module.exports.leads = leadsRouter;

// ── Lead sync — public webhook from the main CRM (not a browser, no user
// session; own shared-secret auth inside the controller). Deliberately its
// own router at a distinct base path, not nested under /api/leads, so it
// never inherits leadsRouter's `protect`.
const leadSyncRouter = express.Router();
leadSyncRouter.post('/status', leadCtrl.syncLeadStatus);
module.exports.leadSync = leadSyncRouter;

// ── Client Portal routes (role: client only) ──────────────────
const portalCtrl = require('../controllers/portalController');
const portalRouter = express.Router();
portalRouter.use(protect);
portalRouter.use(authorize('client'));
portalRouter.get('/overview', portalCtrl.getOverview);
portalRouter.get('/contacts', portalCtrl.getContacts);
portalRouter.get('/me',       portalCtrl.getMyClient);
portalRouter.get('/invoices', portalCtrl.getInvoices);
portalRouter.get('/invoices/:id', portalCtrl.getInvoice);
portalRouter.get('/invoices/:id/pdf', portalCtrl.downloadPDF);
module.exports.portal = portalRouter;

// ── Audit Log routes ──────────────────────────────────────────
const auditCtrl = require('../controllers/auditController');
const auditRouter = express.Router();
auditRouter.use(protect);
auditRouter.use(authorize('admin'));
auditRouter.get('/',       auditCtrl.getLogs);
auditRouter.get('/stats',  auditCtrl.getStats);
module.exports.audit = auditRouter;

// ── System / Server Logs routes (admin only) ──────────────────
const sysCtrl = require('../controllers/systemLogsController');
const adminLogsRouter = express.Router();
adminLogsRouter.use(protect);
adminLogsRouter.use(authorize('admin'));
adminLogsRouter.get('/status',              sysCtrl.getSystemStatus);
adminLogsRouter.get('/sources',             sysCtrl.listSources);
adminLogsRouter.get('/:source/download',    sysCtrl.downloadLog);
adminLogsRouter.get('/:source',             sysCtrl.getLogs);
module.exports.adminLogs = adminLogsRouter;

// ── Billing routes (admin + manager only) ─────────────────────
const billingRouter = express.Router();
billingRouter.use(protect);
billingRouter.use(authorize('admin', 'manager'));
billingRouter.get('/collections',                         billing.getCollections);
billingRouter.get('/invoices',                            billing.getInvoices);
billingRouter.post('/invoices',                           billing.createInvoice);
billingRouter.get('/invoices/:id',                        billing.getInvoice);
billingRouter.put('/invoices/:id',                        billing.updateInvoice);
billingRouter.delete('/invoices/:id',                     billing.deleteInvoice);
billingRouter.get('/invoices/:id/pdf',                    billing.downloadPDF);
billingRouter.get('/invoices/:invoiceId/payments',        billing.getPayments);
billingRouter.post('/invoices/:invoiceId/payments',       upload.single('attachment'), billing.recordPayment);
billingRouter.put('/payments/:id',                        upload.single('attachment'), billing.updatePayment);
billingRouter.delete('/payments/:id',                     billing.deletePayment);
billingRouter.put('/clients/:clientId/billing-profile',   billing.updateBillingProfile);
module.exports.billing = billingRouter;

// ── Email Accounts routes (any authenticated user — manages their OWN
// connected mailboxes; admins/managers can additionally see/manage everyone
// else's for building company campaigns — enforced inside the controller) ──
const emailAccountCtrl = require('../controllers/emailAccountController');
const emailAccountsRouter = express.Router();
emailAccountsRouter.use(protect);
emailAccountsRouter.get('/',           emailAccountCtrl.getAccounts);
emailAccountsRouter.post('/',          emailAccountCtrl.createAccount);
emailAccountsRouter.put('/:id',        emailAccountCtrl.updateAccount);
emailAccountsRouter.delete('/:id',     emailAccountCtrl.deleteAccount);
emailAccountsRouter.post('/:id/test',  emailAccountCtrl.testAccount);
emailAccountsRouter.get('/:id/domain-check', emailAccountCtrl.checkDomain);
module.exports.emailAccounts = emailAccountsRouter;

// ── Campaign public tracking routes (NO auth — hit by email clients) ──
// Mounted at the SAME /api/campaigns prefix but registered before the
// protected campaigns router in app.js, so these specific sub-paths never
// hit the `protect` middleware. Identity comes from the unguessable token.
const trackCtrl = require('../controllers/trackingController');
const campaignPublicRouter = express.Router();
campaignPublicRouter.get('/track/open/:token',  trackCtrl.trackOpen);
campaignPublicRouter.get('/track/click/:token', trackCtrl.trackClick);
campaignPublicRouter.get('/unsubscribe/:token',  trackCtrl.unsubscribeConfirm); // shows a confirm page, doesn't mutate
campaignPublicRouter.post('/unsubscribe/:token', trackCtrl.unsubscribe);        // actually unsubscribes
module.exports.campaignPublic = campaignPublicRouter;

// ── Campaigns routes (admin + manager only — external bulk email sending) ──
const campaignCtrl = require('../controllers/campaignController');
const campaignsRouter = express.Router();
campaignsRouter.use(protect);
campaignsRouter.use(authorizeOrFlag(['admin', 'manager'], 'campaignsAccess'));
campaignsRouter.post('/upload-image',             upload.single('image'), campaignCtrl.uploadImage); // before /:id
campaignsRouter.get('/',                          campaignCtrl.getCampaigns);
campaignsRouter.post('/',                         campaignCtrl.createCampaign);
campaignsRouter.get('/:id',                       campaignCtrl.getCampaign);
campaignsRouter.put('/:id',                       campaignCtrl.updateCampaign);
campaignsRouter.delete('/:id',                    campaignCtrl.deleteCampaign);
campaignsRouter.post('/:id/start',                campaignCtrl.startCampaign);
campaignsRouter.post('/:id/schedule',             campaignCtrl.scheduleCampaign);
campaignsRouter.post('/:id/unschedule',           campaignCtrl.unscheduleCampaign);
campaignsRouter.post('/:id/pause',                campaignCtrl.pauseCampaign);
campaignsRouter.get('/:id/diagnose',              campaignCtrl.diagnoseCampaign);
campaignsRouter.post('/:id/resolve-stuck',        campaignCtrl.resolveStuckLeads);
campaignsRouter.get('/:id/leads',                 campaignCtrl.getCampaignLeads);
campaignsRouter.post('/:id/leads/import',         upload.single('file'), campaignCtrl.importLeads);
campaignsRouter.post('/:id/leads/verify-all',     campaignCtrl.verifyAllLeads);   // before /:leadId routes
campaignsRouter.delete('/:id/leads/:leadId',      campaignCtrl.deleteCampaignLead);
campaignsRouter.post('/:id/leads/:leadId/verify', campaignCtrl.verifyLead);
campaignsRouter.post('/:id/leads/:leadId/mark-replied', campaignCtrl.markReplied);
module.exports.campaigns = campaignsRouter;

// ── Email Templates routes (shared library, campaigns-access gated) ────
const emailTemplateCtrl = require('../controllers/emailTemplateController');
const emailTemplatesRouter = express.Router();
emailTemplatesRouter.use(protect);
emailTemplatesRouter.use(authorizeOrFlag(['admin', 'manager'], 'campaignsAccess'));
emailTemplatesRouter.get('/',       emailTemplateCtrl.getTemplates);
emailTemplatesRouter.post('/',      emailTemplateCtrl.createTemplate);
emailTemplatesRouter.put('/:id',    emailTemplateCtrl.updateTemplate);
emailTemplatesRouter.delete('/:id', emailTemplateCtrl.deleteTemplate);
module.exports.emailTemplates = emailTemplatesRouter;

// ── Meta Ads Analytics routes (admin/manager only — spend & ROI data) ──
const metaAdsCtrl = require('../controllers/metaAdsController');
const metaAdsRouter = express.Router();
metaAdsRouter.use(protect);
metaAdsRouter.use(authorize('admin', 'manager'));
metaAdsRouter.get('/status',          metaAdsCtrl.getStatus);
metaAdsRouter.put('/credentials',     metaAdsCtrl.saveCredentials);
metaAdsRouter.delete('/credentials',  metaAdsCtrl.clearCredentials);
metaAdsRouter.post('/test-connection', metaAdsCtrl.testConnection);
metaAdsRouter.post('/sync-now',       metaAdsCtrl.triggerSync);
metaAdsRouter.get('/summary',         metaAdsCtrl.getSummary);
metaAdsRouter.get('/trends',          metaAdsCtrl.getTrends);
metaAdsRouter.get('/campaigns',       metaAdsCtrl.getCampaigns);
metaAdsRouter.get('/adsets',          metaAdsCtrl.getAdSets);
metaAdsRouter.get('/ads',             metaAdsCtrl.getAds);
module.exports.metaAds = metaAdsRouter;

// ── Website Intelligence — public tracking endpoints ────────────────
// Called from the 5 monitored websites' own origins (arbitrary third-party
// domains) via the embedded snippet (public/wit.js) — needs its own
// wide-open CORS, applied here rather than relying on the app-wide
// allowlist in app.js (which this router is deliberately mounted BEFORE).
const cors = require('cors');
const witPublicCtrl = require('../controllers/witPublicController');
const witPublicRouter = express.Router();
// credentials: true is required here even though these routes don't use
// cookie auth — navigator.sendBeacon() (used by pageend) always sends with
// credentials mode "include" per spec, so without Access-Control-Allow-
// Credentials: true in the response, every cross-origin pageend beacon
// silently fails CORS preflight and is never sent (sendBeacon has no error
// callback, so this is invisible from the page). origin:true still reflects
// the exact request origin rather than "*", which is required alongside
// credentials:true anyway.
witPublicRouter.use(cors({ origin: true, credentials: true }));
witPublicRouter.use(witPublicLimiter);
witPublicRouter.post('/pageview',   witPublicCtrl.pageview);
witPublicRouter.post('/pageend',    witPublicCtrl.pageend);
witPublicRouter.post('/ping',       witPublicCtrl.ping);
witPublicRouter.post('/form-event', witPublicCtrl.formEvent);
witPublicRouter.post('/lead',       witPublicCtrl.captureLead);
module.exports.witPublic = witPublicRouter;

// ── Website Intelligence — staff dashboard (admin/manager only) ────
const witCtrl = require('../controllers/witController');
const witRouter = express.Router();
witRouter.use(protect);
witRouter.use(authorize('admin', 'manager'));
witRouter.get('/websites',                     witCtrl.getWebsites);
witRouter.post('/websites',                    witCtrl.createWebsite);
witRouter.put('/websites/:id',                 witCtrl.updateWebsite);
witRouter.post('/websites/:id/regenerate-secret', witCtrl.regenerateSecret);
witRouter.delete('/websites/:id',              witCtrl.deleteWebsite);
witRouter.get('/summary',           witCtrl.getSummary);
witRouter.get('/trends',            witCtrl.getTrends);
witRouter.get('/traffic-sources',   witCtrl.getTrafficSources);
witRouter.get('/countries',         witCtrl.getCountries);
witRouter.get('/devices',           witCtrl.getDevices);
witRouter.get('/pages',             witCtrl.getPages);
witRouter.get('/landing-pages',     witCtrl.getLandingPages);
witRouter.get('/forms',             witCtrl.getForms);
witRouter.get('/funnel',            witCtrl.getFunnel);
witRouter.get('/lead-attribution',  witCtrl.getLeadAttribution);
witRouter.get('/repeat-visitors',   witCtrl.getRepeatVisitors);
module.exports.websiteIntelligence = witRouter;
