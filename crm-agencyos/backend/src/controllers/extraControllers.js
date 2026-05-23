const path    = require('path');
const { Message, Task, Todo, WorkLog } = require('../models/index');

// ═══════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════
exports.getThreadMessages = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const messages = await Message.find({ threadId })
      .populate('userId', 'name color initials status')
      .sort({ createdAt: 1 })
      .limit(200);
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { text } = req.body;

    // Handle file attachments
    const attachments = (req.files || []).map((f) => ({
      name:     f.originalname,
      size:     f.size,
      type:     f.mimetype,
      filename: f.filename,
      url:      `/uploads/${f.filename}`,
    }));

    if (!text?.trim() && attachments.length === 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const msg = await Message.create({
      threadId,
      userId: req.user._id,
      text:   text?.trim() || '',
      attachments,
    });
    const populated = await msg.populate('userId', 'name color initials status');

    // Emit via socket
    req.app.get('io')?.to(threadId).emit('message:new', populated);

    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    // Only owner or admin can delete
    if (String(msg.userId) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { threadId } = msg;
    await msg.deleteOne();
    req.app.get('io')?.to(threadId).emit('message:deleted', { id: req.params.id, threadId });

    res.json({ success: true, message: 'Message deleted' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════
exports.getReport = async (req, res, next) => {
  try {
    const { period = 'month', userId, from, to } = req.query;

    const now   = new Date();
    let dateFrom, dateTo;

    if (period === 'today') {
      dateFrom = new Date(now.toDateString());
      dateTo   = new Date(now.toDateString());
    } else if (period === 'week') {
      const day  = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      dateFrom   = new Date(now.setDate(diff));
      dateTo     = new Date(dateFrom); dateTo.setDate(dateFrom.getDate() + 6);
    } else if (period === 'month') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      dateTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (period === 'custom' && from && to) {
      dateFrom = new Date(from);
      dateTo   = new Date(to);
    } else {
      dateFrom = new Date(0);
      dateTo   = new Date();
    }

    const taskFilter = {
      $or: [
        { createdAt: { $gte: dateFrom, $lte: dateTo } },
        { dueDate:   { $gte: from || '', $lte: to || '9999' } },
      ],
    };
    const todoFilter = { createdAt: { $gte: dateFrom, $lte: dateTo } };

    if (userId && req.user.role !== 'member') {
      taskFilter.assignedTo = userId;
      todoFilter.userId     = userId;
    } else if (req.user.role === 'member') {
      taskFilter.assignedTo = req.user._id;
      todoFilter.userId     = req.user._id;
    }

    const [tasks, todos] = await Promise.all([
      Task.find(taskFilter).populate('assignedTo', 'name color'),
      Todo.find(todoFilter).populate('userId', 'name color'),
    ]);

    res.json({
      success: true,
      data: {
        tasks,
        todos,
        period: { from: dateFrom, to: dateTo, label: period },
        summary: {
          totalTasks:     tasks.length,
          completedTasks: tasks.filter((t) => t.status === 'completed').length,
          totalTodos:     todos.length,
          completedTodos: todos.filter((t) => t.status === 'completed').length,
        },
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════
// WORK LOG
// ═══════════════════════════════════════════════════
exports.getWorkLog = async (req, res, next) => {
  try {
    let filter = {};
    if (req.user.role === 'member') filter.userId = req.user._id;
    if (req.query.userId && req.user.role !== 'member') filter.userId = req.query.userId;

    const logs = await WorkLog.find(filter)
      .populate('userId', 'name color initials status role')
      .sort({ date: -1 })
      .limit(100);
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
};

exports.upsertWorkLog = async (req, res, next) => {
  try {
    const { date, workSeconds, sessionStart, breaks, active } = req.body;
    const log = await WorkLog.findOneAndUpdate(
      { userId: req.user._id, date },
      { userId: req.user._id, date, workSeconds, sessionStart, breaks, active },
      { upsert: true, new: true, runValidators: true }
    ).populate('userId', 'name color initials status');
    res.json({ success: true, data: log });
  } catch (err) { next(err); }
};

exports.setUserActive = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await WorkLog.findOneAndUpdate(
      { userId: req.user._id, date: today },
      { active: req.body.active },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};
