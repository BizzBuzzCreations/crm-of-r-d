// ── This file exports all routers ──────────────────────────────
// Each section creates its own express.Router() and exports it.
// The app.js imports these.

const express = require('express');
const { protect, authorize, authorizeRoles } = require('../middleware/auth');
const upload  = require('../middleware/upload');

const auth = require('../controllers/authController');
const ctrl = require('../controllers/mainControllers');
const xtra = require('../controllers/extraControllers');
const revenue = require('../controllers/revenueController');
const meetingScheduler = require('../controllers/meetingSchedulerController');
const serviceCtr = require('../controllers/serviceController');

// ── Auth routes ───────────────────────────────────────────────
const authRouter = express.Router();
authRouter.post('/login',    auth.login);
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
clientsRouter.post('/:id/notes',   ctrl.addClientNote);
module.exports.clients = clientsRouter;

// ── Tasks routes ──────────────────────────────────────────────
const tasksRouter = express.Router();
tasksRouter.use(protect);
tasksRouter.get('/',    ctrl.getTasks);
tasksRouter.post('/',   ctrl.createTask);
tasksRouter.put('/:id', ctrl.updateTask);
tasksRouter.delete('/:id', authorize('admin','manager'), ctrl.deleteTask);
module.exports.tasks = tasksRouter;

// ── Todos routes ──────────────────────────────────────────────
const todosRouter = express.Router();
todosRouter.use(protect);
todosRouter.get('/',    ctrl.getTodos);
todosRouter.post('/',   ctrl.createTodo);
todosRouter.put('/:id', ctrl.updateTodo);
todosRouter.delete('/:id', ctrl.deleteTodo);
module.exports.todos = todosRouter;

// ── Meetings routes ───────────────────────────────────────────
const meetingsRouter = express.Router();
meetingsRouter.use(protect);
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
