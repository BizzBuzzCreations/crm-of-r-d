const mongoose = require('mongoose');

// ── Client ────────────────────────────────────────────────────
const NoteSchema = new mongoose.Schema({
  text:   { type: String, required: true },
  author: { type: String },
  date:   { type: String },
}, { timestamps: true });

const ClientSchema = new mongoose.Schema({
  name:             { type: String, required: [true,'Company name is required'], trim: true },
  contact:          { type: String, required: [true,'Contact person is required'] },
  email:            { type: String, default: '' },
  phone:            { type: String, default: '' },
  website:          { type: String, default: '' },
  industry:         { type: String, default: '' },
  address:          { type: String, default: '' },
  services:         [{ type: String }],
  budget:           { type: String, default: '' },
  contractDuration: { type: String, default: '12 months' },
  status:           { type: String, enum: ['active','on-hold','inactive'], default: 'active' },
  paymentStatus:    { type: String, enum: ['paid','pending','overdue'], default: 'pending' },
  projectCount:     { type: Number, default: 0 },
  onboardingDate:   { type: String, default: '' },
  assignedTeam:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notes:            [NoteSchema],
  createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// ── Task ──────────────────────────────────────────────────────
const CounterSchema = new mongoose.Schema({
  id:  { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', CounterSchema);

const TaskAttachmentSchema = new mongoose.Schema({
  type:     { type: String, enum: ['file', 'link'], default: 'file' },
  name:     { type: String, default: '' },
  url:      { type: String, required: true },
  size:     { type: Number, default: 0 },
  mimeType: { type: String, default: '' },
  filename: { type: String, default: '' },
}, { _id: false });

const TaskSchema = new mongoose.Schema({
  taskNumber:  { type: Number },
  title:       { type: String, required: [true,'Title is required'], trim: true },
  description: { type: String, default: '' },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  type:        { type: String, enum: ['inhouse','client'], default: 'inhouse' },
  startDate:   { type: String, default: '' },
  startTime:   { type: String, default: '' },
  dueDate:     { type: String, default: '' },
  dueTime:     { type: String, default: '' },
  eta:         { type: String, default: '' },
  priority:    { type: String, enum: ['urgent','high','medium','low'], default: 'medium' },
  status:      { type: String, enum: ['pending','in-progress','sent-for-approval','completed'], default: 'pending' },
  progress:    { type: Number, default: 0, min: 0, max: 100 },
  tags:        [{ type: String }],
  attachments: { type: [TaskAttachmentSchema], default: [] },
  readyForApproval: { type: Boolean, default: false },
}, { timestamps: true });

TaskSchema.pre('save', async function (next) {
  if (this.isNew) {
    const counter = await Counter.findOneAndUpdate(
      { id: 'taskNumber' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.taskNumber = counter.seq;
  }
  next();
});

// ── Todo ──────────────────────────────────────────────────────
const TodoSchema = new mongoose.Schema({
  title:       { type: String, required: [true,'Title is required'], trim: true },
  description: { type: String, default: '' },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  taskId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  startDate:   { type: String, default: '' },
  startTime:   { type: String, default: '' },
  dueDate:     { type: String, default: '' },
  dueTime:     { type: String, default: '' },
  eta:         { type: String, default: '' },
  priority:    { type: String, enum: ['urgent','high','medium','low'], default: 'medium' },
  status:      { type: String, enum: ['pending','in-progress','sent-for-approval','completed'], default: 'pending' },
  readyForApproval: { type: Boolean, default: false },
  attachments: { type: [TaskAttachmentSchema], default: [] },
}, { timestamps: true });

// ── Meeting ───────────────────────────────────────────────────
const MeetingSchema = new mongoose.Schema({
  title:         { type: String, required: [true,'Title is required'], trim: true },
  description:   { type: String, default: '' },
  type:          { type: String, enum: ['client','internal','lead'], default: 'internal' },
  date:          { type: String, default: '' }, // Made optional to support general schedulers
  time:          { type: String, default: '' }, // Made optional
  duration:      { type: String, default: '60 min' },
  startTime:     { type: Date },
  endTime:       { type: Date },
  status:        { type: String, enum: ['upcoming','completed'], default: 'upcoming' },
  participants:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  clientId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  location:      { type: String, default: '' },
  notes:         { type: String, default: '' },
  meetingLink:   { type: String, default: '' },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  emergencyFlag: { type: Boolean, default: false },
}, { timestamps: true });

// ── MeetingInvitation ──────────────────────────────────────────
const MeetingInvitationSchema = new mongoose.Schema({
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:    { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
}, { timestamps: true });

MeetingInvitationSchema.index({ meetingId: 1, userId: 1 }, { unique: true });

// ── Revenue ───────────────────────────────────────────────────
const RevenueSchema = new mongoose.Schema({
  amount:      { type: Number, required: [true, 'Amount is required'] },
  currency:    { type: String, default: 'INR' },
  source:      { type: String, required: [true, 'Source is required'] },
  status:      { type: String, enum: ['pending', 'received', 'refunded'], default: 'pending' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date:        { type: Date, default: Date.now },
}, { timestamps: true });

// ── Message ───────────────────────────────────────────────────
const AttachmentSchema = new mongoose.Schema({
  name:     String,
  size:     Number,
  type:     String,
  url:      String,
  filename: String,
});

const MessageSchema = new mongoose.Schema({
  threadId:    { type: String, required: true }, // channel id or 'dm-userId'
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:        { type: String, default: '' },
  attachments: [AttachmentSchema],
  isDeleted:   { type: Boolean, default: false },
  reactions:   [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji:  { type: String, default: '👍' }
  }],
}, { timestamps: true });

MessageSchema.index({ threadId: 1, createdAt: 1 });

// ── WorkLog ───────────────────────────────────────────────────
const BreakEntrySchema = new mongoose.Schema({
  type:    String,
  reason:  String,
  planned: Number,
  actual:  Number,
  endedAt: String,
});

const WorkLogSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:         { type: String, required: true }, // YYYY-MM-DD
  workSeconds:  { type: Number, default: 0 },
  sessionStart: { type: String, default: '' },
  breaks:       [BreakEntrySchema],
  active:       { type: Boolean, default: false },
  breakActive:  { type: Boolean, default: false },
  targetSeconds:{ type: Number, default: 8 * 3600 },
}, { timestamps: true });

WorkLogSchema.index({ userId: 1, date: -1 });

const ChannelSchema = new mongoose.Schema({
  name:        { type: String, required: [true, 'Channel name is required'], unique: true, trim: true },
  description: { type: String, default: '' },
  isPrivate:   { type: Boolean, default: false },
  members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted:   { type: Boolean, default: false }, // Soft deletion support
}, { timestamps: true });

const ProjectSchema = new mongoose.Schema({
  name:         { type: String, required: [true, 'Project name is required'], trim: true },
  description:  { type: String, default: '' },
  clientId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  assignedTeam: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status:       { type: String, enum: ['pending', 'in-progress', 'completed', 'on-hold'], default: 'pending' },
  startDate:    { type: String, default: '' },
  endDate:      { type: String, default: '' },
  budget:       { type: String, default: '' },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = {
  Client:            mongoose.model('Client',            ClientSchema),
  Task:              mongoose.model('Task',              TaskSchema),
  Todo:              mongoose.model('Todo',              TodoSchema),
  Meeting:           mongoose.model('Meeting',           MeetingSchema),
  MeetingInvitation: mongoose.model('MeetingInvitation', MeetingInvitationSchema),
  Revenue:           mongoose.model('Revenue',           RevenueSchema),
  Message:           mongoose.model('Message',           MessageSchema),
  WorkLog:           mongoose.model('WorkLog',           WorkLogSchema),
  Channel:           mongoose.model('Channel',           ChannelSchema),
  Project:           mongoose.model('Project',           ProjectSchema),
  SystemSettings:    require('./SystemSettings'),
  Counter,
};

