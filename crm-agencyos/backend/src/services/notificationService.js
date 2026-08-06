const Notification = require('../models/Notification');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');

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
  email_opened:        'email_opened',
  call_requested:      'call_requested',
  email_replied:       'email_replied',
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
  lead_mentioned: true,
  email_opened: true,
  call_requested: true,
  email_replied: true,
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

/**
 * Resolves recipients for `routingKey` from SystemSettings.notificationRouting
 * (configured in Settings → Notification Routing) and dispatches to the
 * UNION of "everyone whose role is in the configured roles[]" OR "these
 * specific userIds" — the two are independent, so a specific user can be
 * granted the notification with no role selected at all, and role selection
 * works with zero specific users added. Falls back to admin+manager if this
 * event has never been configured (SystemSettings doc/key doesn't exist
 * yet), so behavior is unchanged until someone actually edits it — an
 * explicitly saved empty rule (no roles, no users) means "notify nobody",
 * a deliberate admin choice, not a bug. Never throws.
 */
async function dispatchByRouting(io, routingKey, event) {
  try {
    // Deliberately NOT .lean() — a lean query returns the raw stored BSON
    // and skips Mongoose's schema-default hydration, so on any SystemSettings
    // document that predates this field it would silently come back
    // undefined instead of the schema's default rule. A real (hydrated)
    // document + Map#get() applies the schema default correctly either way.
    const settings = await SystemSettings.findOne().select('notificationRouting');
    const rule = settings?.notificationRouting?.get(routingKey);

    const roles   = rule ? (rule.roles   || []) : ['admin', 'manager'];
    const userIds = rule ? (rule.userIds || []) : [];

    const orClauses = [];
    if (roles.length)   orClauses.push({ role: { $in: roles } });
    if (userIds.length) orClauses.push({ _id: { $in: userIds } });
    if (!orClauses.length) return; // nobody configured to receive this — respected as-is

    const recipients = await User.find({ $or: orClauses }).select('_id');
    await Promise.all(recipients.map((u) => dispatch(io, { ...event, recipient: u._id })));
  } catch (err) {
    console.error(`[Notif] ❌ dispatchByRouting failed (${routingKey}):`, err.message);
  }
}

module.exports = { dispatch, dispatchByRouting };

