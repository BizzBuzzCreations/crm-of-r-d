const Notification = require('../models/Notification');

/**
 * Save a notification to MongoDB and push it live via socket to the recipient.
 * Never throws — failure is logged and swallowed so the calling controller still responds.
 */
async function dispatch(io, { recipient, sender = null, type, title, message, link = '', metadata = {} }) {
  try {
    // Safely extract ObjectId from either a raw ID string, ObjectId, or a populated Mongoose document
    const recipientId = recipient?._id ?? recipient;

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
