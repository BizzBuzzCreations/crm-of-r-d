const Notification = require('../models/Notification');
const User = require('../models/User');

const typeToPrefKey = {
  task_assigned:       'task_assigned',
  task_ready_approval: 'task_assigned',
  task_approved:       'task_approved',
  meeting_scheduled:   'meeting_reminder',
  message_dm:          'message_dm',
  lead_assigned:       'lead_assigned',
  lead_mentioned:      'lead_mentioned',
  lead_won:            'deal_closed',
  lead_lost:           'deal_closed',
  new_comment:         'new_comment',
  email_sent:          'message_dm',
  email_failed:        'task_assigned',
  auth:                'task_assigned',
};

const defaults = {
  task_assigned: true,
  task_approved: true,
  meeting_reminder: true,
  client_update: false,
  message_dm: true,
  weekly_report: false,
  deal_closed: true,
  new_comment: true,
  lead_assigned: true,
  lead_mentioned: true
};

/**
 * Save a notification to MongoDB and push it live via socket to the recipient.
 * Never throws — failure is logged and swallowed so the calling controller still responds.
 */
async function dispatch(io, {
  recipient, sender = null,
  type, title, message,
  link = '', metadata = {},
  priority = 'info',
}) {
  try {
    const recipientId = recipient?._id ?? recipient;

    const user = await User.findById(recipientId).select('notificationPrefs');
    if (user) {
      const prefKey = typeToPrefKey[type];
      if (prefKey) {
        let isAllowed = defaults[prefKey] !== false;
        if (user.notificationPrefs) {
          if (typeof user.notificationPrefs.get === 'function') {
            if (user.notificationPrefs.has(prefKey)) isAllowed = user.notificationPrefs.get(prefKey);
          } else if (user.notificationPrefs[prefKey] !== undefined) {
            isAllowed = user.notificationPrefs[prefKey];
          }
        }
        if (!isAllowed) return null;
      }
    }

    const doc = await Notification.create({
      recipient: recipientId, sender, type, title, message, link, metadata, priority,
    });
    const populated = await Notification.findById(doc._id).populate('sender', 'name color initials');

    io?.to(`user:${String(recipientId)}`).emit('notification:new', populated);
    return populated;
  } catch (err) {
    console.error(`[Notif] ❌ dispatch failed (${type}):`, err.message);
  }
}

module.exports = { dispatch };

