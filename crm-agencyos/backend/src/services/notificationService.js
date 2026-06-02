const Notification = require('../models/Notification');
const User = require('../models/User');

const typeToPrefKey = {
  task_assigned: 'task_assigned',
  task_ready_approval: 'task_assigned',
  task_approved: 'task_approved',
  meeting_scheduled: 'meeting_reminder',
  message_dm: 'message_dm',
  lead_assigned: 'lead_assigned',
  lead_mentioned: 'lead_mentioned',
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
async function dispatch(io, { recipient, sender = null, type, title, message, link = '', metadata = {} }) {
  try {
    // Safely extract ObjectId from either a raw ID string, ObjectId, or a populated Mongoose document
    const recipientId = recipient?._id ?? recipient;

    // Check recipient's notification preferences from DB
    const user = await User.findById(recipientId).select('notificationPrefs');
    if (user) {
      const prefKey = typeToPrefKey[type];
      if (prefKey) {
        let isAllowed = defaults[prefKey] !== false;
        if (user.notificationPrefs) {
          if (typeof user.notificationPrefs.get === 'function') {
            if (user.notificationPrefs.has(prefKey)) {
              isAllowed = user.notificationPrefs.get(prefKey);
            }
          } else if (user.notificationPrefs[prefKey] !== undefined) {
            isAllowed = user.notificationPrefs[prefKey];
          }
        }
        if (!isAllowed) {
          console.log(`[Notif] 🚫 Skipped dispatch (${type}) - disabled in user preferences for user:${String(recipientId)}`);
          return null;
        }
      }
    }

    const doc = await Notification.create({ recipient: recipientId, sender, type, title, message, link, metadata });
    const populated = await Notification.findById(doc._id).populate('sender', 'name color initials');

    console.log(`[Notif] ✅ ${type} → user:${String(recipientId)}`);
    io?.to(`user:${String(recipientId)}`).emit('notification:new', populated);
    return populated;
  } catch (err) {
    console.error(`[Notif] ❌ dispatch failed (${type}):`, err.message);
  }
}

module.exports = { dispatch };

