const User = require('../models/User');
const { Task, Todo, Meeting, Project, Client } = require('../models/index');

// GET /api/portal/overview
// Returns aggregated stats + client info for the portal dashboard
exports.getOverview = async (req, res, next) => {
  try {
    const clientId = req.user.clientId;
    if (!clientId) {
      return res.status(403).json({ success: false, message: 'No client account linked to this user' });
    }

    const [tasks, projects, meetings, todos, client] = await Promise.all([
      Task.find({ clientId, isDeleted: { $ne: true } }).lean(),
      Project.find({ clientId }).populate('assignedTeam', 'name color initials').lean(),
      Meeting.find({ clientId }).lean(),
      Todo.find({ clientId, isDeleted: { $ne: true } }).lean(),
      Client.findOne({ _id: clientId, isDeleted: { $ne: true } }).lean(),
    ]);

    if (!client) return res.status(403).json({ success: false, message: 'Portal access has been deactivated.' });

    const taskStats = {
      total:         tasks.length,
      completed:     tasks.filter((t) => t.status === 'completed').length,
      inProgress:    tasks.filter((t) => t.status === 'in-progress').length,
      pending:       tasks.filter((t) => t.status === 'pending').length,
      forApproval:   tasks.filter((t) => t.status === 'sent-for-approval').length,
      avgProgress:   tasks.length
        ? Math.round(tasks.reduce((a, t) => a + (t.progress || 0), 0) / tasks.length)
        : 0,
    };

    const upcomingMeetings = meetings
      .filter((m) => m.status === 'upcoming')
      .sort((a, b) => {
        const da = a.date + (a.time ? 'T' + a.time : '');
        const db = b.date + (b.time ? 'T' + b.time : '');
        return da.localeCompare(db);
      })
      .slice(0, 5);

    const recentTasks = tasks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    res.json({
      success: true,
      data: {
        client,
        taskStats,
        projects,
        upcomingMeetings,
        recentTasks,
        todoCount: todos.length,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/portal/contacts
// Returns all users the client is allowed to message:
// admins + every user assigned to the client's projects or tasks
exports.getContacts = async (req, res, next) => {
  try {
    const clientId = req.user.clientId;
    if (!clientId) {
      return res.status(403).json({ success: false, message: 'No client account linked' });
    }

    const userFields = 'name color initials status position role';

    const [admins, projects, tasks] = await Promise.all([
      User.find({ role: 'admin' }, userFields).lean(),
      Project.find({ clientId }, 'assignedTeam').populate('assignedTeam', userFields).lean(),
      Task.find({ clientId }, 'assignedTo').populate('assignedTo', userFields).lean(),
    ]);

    const seen     = new Set();
    const contacts = [];

    const addUser = (u) => {
      if (!u) return;
      const id = String(u._id);
      if (seen.has(id)) return;
      // Never include the client user themselves
      if (id === String(req.user._id)) return;
      seen.add(id);
      contacts.push(u);
    };

    admins.forEach(addUser);
    projects.forEach((p) => (p.assignedTeam || []).forEach(addUser));
    tasks.forEach((t) => addUser(t.assignedTo));

    res.json({ success: true, data: contacts });
  } catch (err) { next(err); }
};

// GET /api/portal/me — returns the client record tied to the logged-in portal user
exports.getMyClient = async (req, res, next) => {
  try {
    const clientId = req.user.clientId;
    if (!clientId) {
      return res.status(403).json({ success: false, message: 'No client account linked' });
    }
    const client = await Client.findOne({ _id: clientId, isDeleted: { $ne: true } }).lean();
    if (!client) return res.status(403).json({ success: false, message: 'Portal access has been deactivated.' });
    res.json({ success: true, data: client });
  } catch (err) { next(err); }
};

// GET /api/portal/invoices
exports.getInvoices = async (req, res, next) => {
  try {
    const { Invoice } = require('../models/Invoice');
    const invoices = await Invoice.find({
      clientId: req.user.clientId,
      isDeleted: { $ne: true },
      status: { $ne: 'draft' }, // Hide drafts from portal clients
    })
    .sort({ createdAt: -1 })
    .lean();
    res.json({ success: true, data: invoices });
  } catch (err) { next(err); }
};

// GET /api/portal/invoices/:id/pdf
exports.downloadPDF = async (req, res, next) => {
  try {
    const { Invoice } = require('../models/Invoice');
    const billingCtrl = require('./billingController');
    const invoice = await Invoice.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).lean();
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (String(invoice.clientId) !== String(req.user.clientId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return billingCtrl.downloadPDF(req, res, next);
  } catch (err) { next(err); }
};

// GET /api/portal/invoices/:id
exports.getInvoice = async (req, res, next) => {
  try {
    const { Invoice, Payment } = require('../models/Invoice');
    const invoice = await Invoice.findOne({ _id: req.params.id, clientId: req.user.clientId, isDeleted: { $ne: true } })
      .populate('clientId', 'name email contact phone address billingProfile')
      .lean();
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const payments = await Payment.find({ invoiceId: req.params.id })
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();

    res.json({ success: true, data: invoice, payments });
  } catch (err) { next(err); }
};


