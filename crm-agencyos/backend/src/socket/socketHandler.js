const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const { WorkLog, Channel } = require('../models/index');

module.exports = (io) => {
  // Auth middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = String(socket.user._id);
    console.log(`🔌 Socket connected: ${socket.user.name} (${userId})`);

    // ── Mark user online ──────────────────────────────────
    User.findByIdAndUpdate(userId, { status: 'online' }).exec();
    socket.broadcast.emit('user:online', { userId, name: socket.user.name });

    // ── Join personal user room (for cross-session timer sync) ──
    socket.join(`user:${userId}`);
    if (socket.user.role === 'admin') {
      socket.join('admin');
    }
 
    // ── Auto-join channels and DM rooms ───────────────────
    try {
      let filter = { isDeleted: { $ne: true } };
      if (socket.user.role !== 'admin') {
        filter = {
          isDeleted: { $ne: true },
          $or: [
            { isPrivate: false },
            { isPrivate: true, members: userId }
          ]
        };
      }
      const dbChannels = await Channel.find(filter, '_id').exec();
      dbChannels.forEach((ch) => {
        socket.join(String(ch._id));
      });
      // Also join legacy / old hardcoded string channels just in case some clients are in transition
      const legacyChannels = ['general', 'design', 'dev', 'marketing', 'client-updates'];
      legacyChannels.forEach((chId) => socket.join(chId));
    } catch (err) {
      console.error('Error auto-joining database channels:', err);
    }

    try {
      const allUsers = await User.find({}, '_id').exec();
      allUsers.forEach((otherUser) => {
        const otherId = String(otherUser._id);
        if (otherId !== userId) {
          const sorted = [userId, otherId].sort();
          socket.join(`dm-${sorted[0]}-${sorted[1]}`);
        }
      });
    } catch (err) {
      console.error('Error joining DM rooms on socket connection:', err);
    }

    // ── Canonical DM helper ──────────────────────────────
    const getCanonicalRoom = (threadId, socketUser) => {
      if (threadId && threadId.startsWith('dm-')) {
        const otherUserId = threadId.replace('dm-', '');
        const myId = String(socketUser._id);
        const sorted = [myId, otherUserId].sort();
        return `dm-${sorted[0]}-${sorted[1]}`;
      }
      return threadId;
    };

    // ── Join rooms ────────────────────────────────────────
    socket.on('join:thread', (threadId) => {
      const room = getCanonicalRoom(threadId, socket.user);
      socket.join(room);
    });

    socket.on('leave:thread', (threadId) => {
      // Keep user in the room to allow background unread notifications and cache updates
    });

    // ── Typing indicators ─────────────────────────────────
    socket.on('typing:start', ({ threadId }) => {
      const room = getCanonicalRoom(threadId, socket.user);
      socket.to(room).emit('typing:start', {
        userId,
        name: socket.user.name,
        threadId: room,
      });
    });

    socket.on('typing:stop', ({ threadId }) => {
      const room = getCanonicalRoom(threadId, socket.user);
      socket.to(room).emit('typing:stop', { userId, threadId: room, name: socket.user.name });
    });

    // ── Status updates ────────────────────────────────────
    socket.on('status:update', async ({ status }) => {
      try {
        await User.findByIdAndUpdate(userId, { status });
        io.emit('user:status', { userId, status });
      } catch {}
    });

    // ── Timer cross-session sync ──────────────────────────
    // Relay the authoritative timer state to all other sessions of this user
    socket.on('timer:sync', (payload) => {
      // Broadcast to all other sockets in this user's personal room (not back to sender)
      socket.to(`user:${userId}`).emit('timer:sync', payload);
      // Broadcast to all connected clients (admins and managers) for team tracking
      io.emit('member:timer:update', { userId, ...payload });
    });

    // ── Disconnect ────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔌 Disconnected: ${socket.user.name}`);
      try {
        const userRoom = io.sockets.adapter.rooms.get(`user:${userId}`);
        const hasActiveConnections = userRoom && userRoom.size > 0;

        if (!hasActiveConnections) {
          await User.findByIdAndUpdate(userId, { status: 'offline' });
          io.emit('user:offline', { userId });

          const today = new Date().toISOString().split('T')[0];
          await WorkLog.findOneAndUpdate(
            { userId, date: today },
            { active: false, breakActive: false }
          );

          io.emit('member:timer:update', { userId, active: false, breakActive: false });
        }
      } catch (err) {
        console.error('Error on socket disconnect cleanup:', err);
      }
    });
  });
};
