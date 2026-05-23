const jwt  = require('jsonwebtoken');
const User = require('../models/User');

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

  io.on('connection', (socket) => {
    const userId = String(socket.user._id);
    console.log(`🔌 Socket connected: ${socket.user.name} (${userId})`);

    // ── Mark user online ──────────────────────────────────
    User.findByIdAndUpdate(userId, { status: 'online' }).exec();
    socket.broadcast.emit('user:online', { userId, name: socket.user.name });

    // ── Join rooms ────────────────────────────────────────
    socket.on('join:thread', (threadId) => {
      socket.join(threadId);
    });

    socket.on('leave:thread', (threadId) => {
      socket.leave(threadId);
    });

    // ── Typing indicators ─────────────────────────────────
    socket.on('typing:start', ({ threadId }) => {
      socket.to(threadId).emit('typing:start', {
        userId,
        name: socket.user.name,
        threadId,
      });
    });

    socket.on('typing:stop', ({ threadId }) => {
      socket.to(threadId).emit('typing:stop', { userId, threadId });
    });

    // ── Status updates ────────────────────────────────────
    socket.on('status:update', async ({ status }) => {
      try {
        await User.findByIdAndUpdate(userId, { status });
        io.emit('user:status', { userId, status });
      } catch {}
    });

    // ── Disconnect ────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔌 Disconnected: ${socket.user.name}`);
      try {
        await User.findByIdAndUpdate(userId, { status: 'offline' });
        io.emit('user:offline', { userId });
      } catch {}
    });
  });
};
