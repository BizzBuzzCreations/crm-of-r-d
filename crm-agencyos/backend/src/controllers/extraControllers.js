const path    = require('path');
const { Message, Task, Todo, WorkLog, Channel } = require('../models/index');
const notifService = require('../services/notificationService');

// ═══════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════
const getCanonicalThreadId = (threadId, reqUser) => {
  if (threadId && threadId.startsWith('dm-')) {
    const otherUserId = threadId.replace('dm-', '');
    const myId = String(reqUser._id || reqUser.id);
    const sorted = [myId, otherUserId].sort();
    return `dm-${sorted[0]}-${sorted[1]}`;
  }
  return threadId;
};

exports.getThreadMessages = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const canonicalId = getCanonicalThreadId(threadId, req.user);
    const messages = await Message.find({ threadId: canonicalId })
      .populate('userId', 'name color initials status')
      .populate('reactions.userId', 'name')
      .sort({ createdAt: 1 })
      .limit(200);
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const canonicalId = getCanonicalThreadId(threadId, req.user);
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
      threadId: canonicalId,
      userId: req.user._id,
      text:   text?.trim() || '',
      attachments,
    });
    const populated = await msg.populate('userId', 'name color initials status');

    const io = req.app.get('io');
    io?.to(canonicalId).emit('message:new', populated);

    // Notify DM recipient (not channel messages)
    if (canonicalId.startsWith('dm-')) {
      const [, id1, id2] = canonicalId.split('-');
      const myId = String(req.user._id);
      const recipientId = id1 === myId ? id2 : id1;
      notifService.dispatch(io, {
        recipient: recipientId,
        sender:    req.user._id,
        type:      'message_dm',
        title:     `New message from ${req.user.name}`,
        message:   msg.text || '📎 Sent an attachment',
        link:      '/messages',
        metadata:  { threadId: canonicalId, senderId: myId },
      });
    }

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
    msg.isDeleted = true;
    await msg.save();

    req.app.get('io')?.to(threadId).emit('message:deleted', { id: req.params.id, threadId });

    res.json({ success: true, message: 'Message deleted', data: msg });
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
    if (req.query.date) filter.date = req.query.date;

    const logs = await WorkLog.find(filter)
      .populate('userId', 'name color initials status role')
      .sort({ date: -1 })
      .limit(100);
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
};

exports.upsertWorkLog = async (req, res, next) => {
  try {
    const { date, workSeconds, sessionStart, breaks, active, breakActive, targetSeconds } = req.body;
    const log = await WorkLog.findOneAndUpdate(
      { userId: req.user._id, date },
      { userId: req.user._id, date, workSeconds, sessionStart, breaks, active, breakActive, targetSeconds },
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

exports.toggleReaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { emoji = '👍' } = req.body;
    const myId = req.user._id;

    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    if (!msg.reactions) msg.reactions = [];
    const existingIdx = msg.reactions.findIndex((r) => String(r.userId) === String(myId) && r.emoji === emoji);
    if (existingIdx >= 0) {
      msg.reactions.splice(existingIdx, 1);
    } else {
      msg.reactions.push({ userId: myId, emoji });
    }
    await msg.save();

    const populated = await Message.findById(id)
      .populate('userId', 'name color initials status')
      .populate('reactions.userId', 'name');

    req.app.get('io')?.to(msg.threadId).emit('message:updated', populated);

    res.json({ success: true, data: populated });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════
// CHANNELS
// ═══════════════════════════════════════════════════
exports.getChannels = async (req, res, next) => {
  try {
    let filter = { isDeleted: { $ne: true } };
    if (req.user.role !== 'admin') {
      filter = {
        isDeleted: { $ne: true },
        $or: [
          { isPrivate: false },
          { isPrivate: true, members: req.user._id }
        ]
      };
    }
    const channels = await Channel.find(filter)
      .populate('members', 'name color initials position status role')
      .sort({ name: 1 });
    res.json({ success: true, data: channels });
  } catch (err) { next(err); }
};

exports.createChannel = async (req, res, next) => {
  try {
    const { name, description, isPrivate, members } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Channel name is required' });
    }
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');
    
    // Process members if private
    let groupMembers = [];
    if (isPrivate) {
      const parsedMembers = Array.isArray(members) ? members : [];
      // Ensure creator is always in the private group
      const creatorIdStr = String(req.user._id);
      if (!parsedMembers.includes(creatorIdStr)) {
        parsedMembers.push(creatorIdStr);
      }
      groupMembers = parsedMembers;
    }

    const channel = await Channel.create({
      name: cleanName,
      description: description?.trim() || '',
      isPrivate: !!isPrivate,
      members: groupMembers,
      createdBy: req.user._id,
    });

    const populated = await channel.populate('members', 'name color initials position status role');

    const io = req.app.get('io');
    if (populated.isPrivate) {
      // Emit socket event to members of the private group only
      populated.members.forEach((m) => {
        io?.to(`user:${String(m._id || m)}`).emit('channel:created', populated);
      });
      // Also emit to active Admins who are not explicitly listed in members
      // (Admins have access to see and join everything)
      io?.to('admin').emit('channel:created', populated);
    } else {
      io?.emit('channel:created', populated);
    }

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Channel name already exists' });
    }
    next(err);
  }
};

exports.updateChannel = async (req, res, next) => {
  try {
    const { name, description, isPrivate, members } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Channel name is required' });
    }
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');
    
    // Get existing channel to know prior member list
    const existing = await Channel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    // Process members if private
    let groupMembers = [];
    if (isPrivate) {
      const parsedMembers = Array.isArray(members) ? members : [];
      const creatorIdStr = String(existing.createdBy || req.user._id);
      if (!parsedMembers.includes(creatorIdStr)) {
        parsedMembers.push(creatorIdStr);
      }
      groupMembers = parsedMembers;
    }

    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      { 
        name: cleanName, 
        description: description?.trim() || '',
        isPrivate: !!isPrivate,
        members: groupMembers,
      },
      { new: true, runValidators: true }
    ).populate('members', 'name color initials position status role');

    const io = req.app.get('io');
    
    // Clean up visibility sync on update:
    // Some users might have been removed, some added.
    // For simplicity and complete reactive reliability, we can broadcast:
    // - channel:deleted to the old member list (to cleanly wipe it from their client view if removed)
    // - channel:created or channel:updated to the new list
    const oldMembers = (existing.members || []).map(m => String(m));
    const newMembers = (channel.members || []).map(m => String(m._id || m));

    const allInvolved = Array.from(new Set([...oldMembers, ...newMembers]));

    allInvolved.forEach((userId) => {
      const hadAccess = !existing.isPrivate || oldMembers.includes(userId);
      const hasAccess = !channel.isPrivate || newMembers.includes(userId);

      if (hadAccess && !hasAccess) {
        // User was removed
        io?.to(`user:${userId}`).emit('channel:deleted', channel._id);
      } else if (!hadAccess && hasAccess) {
        // User was added
        io?.to(`user:${userId}`).emit('channel:created', channel);
      } else if (hasAccess) {
        // User kept access
        io?.to(`user:${userId}`).emit('channel:updated', channel);
      }
    });

    // Also notify active admins who are not in group
    io?.to('admin').emit('channel:updated', channel);

    res.json({ success: true, data: channel });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Channel name already exists' });
    }
    next(err);
  }
};

exports.deleteChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    if (channel.name === 'general') {
      return res.status(400).json({ success: false, message: 'Cannot delete the general channel' });
    }

    // Dynamic Production-grade Soft delete backup
    channel.isDeleted = true;
    await channel.save();
    
    // Soft delete all messages inside this channel's thread ID
    await Message.updateMany({ threadId: req.params.id }, { isDeleted: true });

    const io = req.app.get('io');
    if (channel.isPrivate) {
      const members = (channel.members || []).map(m => String(m));
      members.forEach((mId) => {
        io?.to(`user:${mId}`).emit('channel:deleted', req.params.id);
      });
      io?.to('admin').emit('channel:deleted', req.params.id);
    } else {
      io?.emit('channel:deleted', req.params.id);
    }

    res.json({ success: true, message: 'Channel deleted successfully' });
  } catch (err) { next(err); }
};

