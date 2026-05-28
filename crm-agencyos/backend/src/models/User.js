const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name:       { type: String, required: [true, 'Name is required'], trim: true },
  email:      { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
  password:   { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
  role:       { type: String, enum: ['admin','manager','member','client_relations'], default: 'member' },
  position:   { type: String, default: 'Team Member' },
  department: { type: String, default: 'General' },
  phone:      { type: String, default: '' },
  color:      { type: String, default: '#6366f1' },
  initials:   { type: String, default: '' },
  status:     { type: String, enum: ['online','away','offline'], default: 'offline' },
  joinDate:   { type: String, default: '' },
  bio:        { type: String, default: '' },
  avatar:     { type: String, default: null },
  emailSync: {
    provider: { type: String, default: 'none' },
    email: { type: String, default: '' },
    imapHost: { type: String, default: '' },
    imapPort: { type: Number, default: 993 },
    smtpHost: { type: String, default: '' },
    smtpPort: { type: Number, default: 465 }
  },
  calendarSyncEnabled: { type: Boolean, default: false },
  notificationPrefs: {
    type: Map,
    of: Boolean,
    default: {
      task_assigned: true,
      task_approved: true,
      meeting_reminder: true,
      client_update: false,
      message_dm: true,
      weekly_report: false,
      deal_closed: true,
      new_comment: true
    }
  },
  personalSignature: { type: String, default: '' },
  defaultLandingView: { type: String, default: 'dashboard' },
}, { timestamps: true });

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.initials && this.name) {
    this.initials = this.name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
  }
  next();
});

// Compare password
UserSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

// Sign access token
UserSchema.methods.getAccessToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '15m' });
};

// Sign refresh token
UserSchema.methods.getRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' });
};

module.exports = mongoose.model('User', UserSchema);
