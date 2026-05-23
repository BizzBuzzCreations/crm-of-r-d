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
const TaskSchema = new mongoose.Schema({
  title:       { type: String, required: [true,'Title is required'], trim: true },
  description: { type: String, default: '' },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  type:        { type: String, enum: ['inhouse','client'], default: 'inhouse' },
  dueDate:     { type: String, default: '' },
  eta:         { type: String, default: '' },
  priority:    { type: String, enum: ['urgent','high','medium','low'], default: 'medium' },
  status:      { type: String, enum: ['pending','in-progress','sent-for-approval','completed'], default: 'pending' },
  progress:    { type: Number, default: 0, min: 0, max: 100 },
  tags:        [{ type: String }],
}, { timestamps: true });

// ── Todo ──────────────────────────────────────────────────────
const TodoSchema = new mongoose.Schema({
  title:       { type: String, required: [true,'Title is required'], trim: true },
  description: { type: String, default: '' },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eta:         { type: String, default: '' },
  priority:    { type: String, enum: ['urgent','high','medium','low'], default: 'medium' },
  status:      { type: String, enum: ['pending','in-progress','sent-for-approval','completed'], default: 'pending' },
}, { timestamps: true });

// ── Meeting ───────────────────────────────────────────────────
const MeetingSchema = new mongoose.Schema({
  title:       { type: String, required: [true,'Title is required'], trim: true },
  type:        { type: String, enum: ['client','internal','lead'], default: 'internal' },
  date:        { type: String, required: [true,'Date is required'] },
  time:        { type: String, required: [true,'Time is required'] },
  duration:    { type: String, default: '60 min' },
  status:      { type: String, enum: ['upcoming','completed'], default: 'upcoming' },
  participants:[{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  clientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  location:    { type: String, default: '' },
  notes:       { type: String, default: '' },
  meetingLink: { type: String, default: '' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
}, { timestamps: true });

WorkLogSchema.index({ userId: 1, date: -1 });

module.exports = {
  Client:  mongoose.model('Client',  ClientSchema),
  Task:    mongoose.model('Task',    TaskSchema),
  Todo:    mongoose.model('Todo',    TodoSchema),
  Meeting: mongoose.model('Meeting', MeetingSchema),
  Message: mongoose.model('Message', MessageSchema),
  WorkLog: mongoose.model('WorkLog', WorkLogSchema),
};
