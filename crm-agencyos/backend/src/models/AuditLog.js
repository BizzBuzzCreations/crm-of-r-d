const mongoose = require('mongoose');
const { Schema } = mongoose;

const AuditLogSchema = new Schema(
  {
    actor: {
      id:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, default: 'System' },
      role: { type: String, default: 'system' },
    },
    action: {
      type: String,
      enum: [
        'login', 'logout',
        'create', 'update', 'delete',
        'assign', 'status_change',
        'email_sent', 'approve',
        'submit_approval', 'bulk_create', 'merge',
      ],
      required: true,
    },
    category: {
      type: String,
      enum: ['auth', 'lead', 'task', 'todo', 'client', 'user', 'settings', 'meeting', 'revenue', 'worklog'],
      required: true,
    },
    target: {
      id:    { type: Schema.Types.ObjectId, default: null },
      model: { type: String, default: '' },
      title: { type: String, default: '' },
      ref:   { type: String, default: '' },
    },
    changes:   { type: Schema.Types.Mixed, default: null },
    metadata:  { type: Schema.Types.Mixed, default: null },
    ip:        { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false }
);

AuditLogSchema.index({ 'actor.id': 1, createdAt: -1 });
AuditLogSchema.index({ category: 1,   createdAt: -1 });
AuditLogSchema.index({ action: 1,     createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
