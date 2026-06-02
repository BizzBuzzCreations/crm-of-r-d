require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const socketHandler = require('./src/socket/socketHandler');
const { Server } = require('socket.io');
const { QueueEvents } = require('bullmq');
const { emailQueue } = require('./src/queues/emailQueue');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.io
const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, '') : null;
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5000',
  'http://127.0.0.1',
  clientUrl,
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile apps, same-origin)
      if (!origin) return callback(null, true);
      
      const normalizedOrigin = origin.replace(/\/$/, '');
      if (ALLOWED_ORIGINS.includes(normalizedOrigin)) return callback(null, true);
      if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(normalizedOrigin)) return callback(null, true);
      
      callback(new Error(`CORS blocked by Socket: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize socket handler
socketHandler(io);

// Make io accessible in routes
app.set('io', io);

// ── BullMQ QueueEvents: forward email job results to the triggering user via socket ──
const redisConn = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const emailQueueEvents = new QueueEvents('email-queue', { connection: redisConn });

emailQueueEvents.on('completed', async ({ jobId }) => {
  try {
    const job = await emailQueue.getJob(jobId);
    if (!job) return;
    const { triggeredBy, recipientEmail, emailType } = job.data;
    if (!triggeredBy) return;
    io.to(`user:${triggeredBy}`).emit('email:sent', {
      jobId,
      emailType,
      to: recipientEmail,
      message: `Email delivered to ${recipientEmail}`,
    });
  } catch {}
});

emailQueueEvents.on('failed', async ({ jobId, failedReason }) => {
  try {
    const job = await emailQueue.getJob(jobId);
    if (!job) return;
    const { triggeredBy, recipientEmail, emailType } = job.data;
    if (!triggeredBy) return;
    const isFinal = (job.attemptsMade >= (job.opts?.attempts || 3));
    io.to(`user:${triggeredBy}`).emit('email:failed', {
      jobId,
      emailType,
      to: recipientEmail,
      reason: failedReason,
      willRetry: !isFinal,
      message: isFinal
        ? `Email to ${recipientEmail} failed after all retries`
        : `Email to ${recipientEmail} failed — retrying…`,
    });
  } catch {}
});

// 2. UPDATED BINDING: Force the server to listen on '0.0.0.0' to accept external network traffic
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 AgencyOS Backend running network-wide on port ${PORT}`);
  console.log(`📡 API:    http://0.0.0.0:${PORT}/api`);
  console.log(`🔌 Socket: ws://0.0.0.0:${PORT}`);
  console.log(`📁 Mode:   ${process.env.NODE_ENV || 'production'}\n`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

// restarted by antigravity at 2026-06-02
