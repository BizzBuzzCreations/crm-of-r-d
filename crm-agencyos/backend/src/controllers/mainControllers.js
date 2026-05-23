const User            = require('../models/User');
const { Client, Task, Todo, Meeting } = require('../models/index');

// ═══════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: 1 });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
};

exports.createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { password, ...rest } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, rest, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    if (String(req.user._id) === req.params.id)
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User removed' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════
exports.getClients = async (req, res, next) => {
  try {
    const clients = await Client.find()
      .populate('assignedTeam', 'name email color initials status position')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: clients });
  } catch (err) { next(err); }
};

exports.getClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('assignedTeam', 'name email color initials status position');
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    res.json({ success: true, data: client });
  } catch (err) { next(err); }
};

exports.createClient = async (req, res, next) => {
  try {
    const client = await Client.create({ ...req.body, createdBy: req.user._id });
    const populated = await client.populate('assignedTeam', 'name email color initials status position');
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

exports.updateClient = async (req, res, next) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('assignedTeam', 'name email color initials status position');
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    res.json({ success: true, data: client });
  } catch (err) { next(err); }
};

exports.deleteClient = async (req, res, next) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Client deleted' });
  } catch (err) { next(err); }
};

exports.addClientNote = async (req, res, next) => {
  try {
    const { text } = req.body;
    const note = {
      text,
      author: req.user.name,
      date:   new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: note } },
      { new: true }
    ).populate('assignedTeam', 'name email color initials status position');
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    res.json({ success: true, data: client });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════
const taskPopulate = [
  { path: 'assignedTo', select: 'name email color initials status' },
  { path: 'assignedBy', select: 'name' },
  { path: 'clientId',   select: 'name' },
];

exports.getTasks = async (req, res, next) => {
  try {
    let filter = {};
    if (req.user.role === 'member') filter.assignedTo = req.user._id;
    const tasks = await Task.find(filter).populate(taskPopulate).sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (err) { next(err); }
};

exports.createTask = async (req, res, next) => {
  try {
    const task = await Task.create({ ...req.body, assignedBy: req.user._id });
    const populated = await task.populate(taskPopulate);
    const io = req.app.get('io');
    io?.emit('task:created', populated);
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate(taskPopulate);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    const io = req.app.get('io');
    io?.emit('task:updated', task);
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
};

exports.deleteTask = async (req, res, next) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    req.app.get('io')?.emit('task:deleted', req.params.id);
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════
// TODOS
// ═══════════════════════════════════════════════════
exports.getTodos = async (req, res, next) => {
  try {
    let filter = {};
    if (req.user.role === 'member') filter.userId = req.user._id;
    const todos = await Todo.find(filter)
      .populate('userId', 'name color initials status')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: todos });
  } catch (err) { next(err); }
};

exports.createTodo = async (req, res, next) => {
  try {
    const todo = await Todo.create({ ...req.body, userId: req.user._id });
    const populated = await todo.populate('userId', 'name color initials status');
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

exports.updateTodo = async (req, res, next) => {
  try {
    const todo = await Todo.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('userId', 'name color initials status');
    if (!todo) return res.status(404).json({ success: false, message: 'Todo not found' });
    res.json({ success: true, data: todo });
  } catch (err) { next(err); }
};

exports.deleteTodo = async (req, res, next) => {
  try {
    await Todo.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Todo deleted' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════
// MEETINGS
// ═══════════════════════════════════════════════════
const meetPopulate = [
  { path: 'participants', select: 'name color initials status' },
  { path: 'clientId',     select: 'name' },
];

exports.getMeetings = async (req, res, next) => {
  try {
    const meetings = await Meeting.find().populate(meetPopulate).sort({ date: 1, time: 1 });
    res.json({ success: true, data: meetings });
  } catch (err) { next(err); }
};

exports.createMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.create({ ...req.body, createdBy: req.user._id });
    const populated = await meeting.populate(meetPopulate);
    req.app.get('io')?.emit('meeting:created', populated);
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

exports.updateMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate(meetPopulate);
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    res.json({ success: true, data: meeting });
  } catch (err) { next(err); }
};

exports.deleteMeeting = async (req, res, next) => {
  try {
    await Meeting.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Meeting deleted' });
  } catch (err) { next(err); }
};
