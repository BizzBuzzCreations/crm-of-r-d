const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: {
    type: String,
    enum: [
      'task_assigned', 'task_approved', 'task_ready_approval',
      'meeting_scheduled', 'message_dm', 'client_update', 'todo_submitted',
    ],
    required: true,
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  link:    { type: String, default: '' },
  read:    { type: Boolean, default: false, index: true },
  metadata: { type: mongoose.Schema.Types.Map, of: String },
}, { timestamps: true });

NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
