require('dotenv').config({ path: require('path').join(__dirname, '.env') });
// Some VPS/bare-metal hosts get an IPv6 address assigned without real
// outbound IPv6 routing — a hostname resolving to both A and AAAA records
// can then get connected over IPv6 and fail with ENETUNREACH (seen on SMTP
// connection tests and IMAP checks, which run in this process). Prefer
// IPv4 resolution process-wide; virtually every mail provider still serves it.
require('dns').setDefaultResultOrder('ipv4first');
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const socketHandler = require('./src/socket/socketHandler');
const { Server } = require('socket.io');
const { QueueEvents } = require('bullmq');
const { emailQueue } = require('./src/queues/emailQueue');
const { logger }   = require('./src/utils/sysLogger');
const { LogWatcher } = require('./src/utils/logWatcher');
const notifService = require('./src/services/notificationService');

const { startBillingCron } = require('./src/cron/billingReminders');
const { startCampaignDispatcher } = require('./src/cron/campaignDispatcher');
const { startReplySyncCron } = require('./src/cron/replySync');
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

// ── Start real-time log file watcher (emits to 'admin:syslog' room) ───────
const logWatcher = new LogWatcher(io);
logWatcher.start();
io._logWatcher = logWatcher;           // accessible from socket handler
app.set('logWatcher', logWatcher);

// ── BullMQ QueueEvents: forward email job results + log them ──────────────
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
    logger.info('QUEUE', `Job ${jobId} completed — ${emailType} → ${recipientEmail}`);
    if (!triggeredBy) return;
    io.to(`user:${triggeredBy}`).emit('email:sent', {
      jobId, emailType, to: recipientEmail,
      message: `Email delivered to ${recipientEmail}`,
    });
    // In-app notification for the user who triggered the send
    notifService.dispatch(io, {
      recipient: triggeredBy, sender: null,
      type: 'email_sent', priority: 'success',
      title: '✅ Email Delivered',
      message: `${emailType.replace(/_/g, ' ')} sent successfully to ${recipientEmail}`,
      link: '/leads',
    });
  } catch {}
});

emailQueueEvents.on('failed', async ({ jobId, failedReason }) => {
  try {
    const job = await emailQueue.getJob(jobId);
    if (!job) return;
    const { triggeredBy, recipientEmail, emailType } = job.data;
    const isFinal = (job.attemptsMade >= (job.opts?.attempts || 3));
    logger.error('QUEUE', `Job ${jobId} failed — ${emailType} → ${recipientEmail}: ${failedReason}`, { isFinal });
    if (!triggeredBy) return;
    io.to(`user:${triggeredBy}`).emit('email:failed', {
      jobId, emailType, to: recipientEmail,
      reason: failedReason, willRetry: !isFinal,
      message: isFinal
        ? `Email to ${recipientEmail} failed after all retries`
        : `Email to ${recipientEmail} failed — retrying…`,
    });
    // Only notify on final failure (not transient retries)
    if (isFinal) {
      notifService.dispatch(io, {
        recipient: triggeredBy, sender: null,
        type: 'email_failed', priority: 'error',
        title: '❌ Email Delivery Failed',
        message: `Failed to send ${emailType.replace(/_/g, ' ')} to ${recipientEmail} after all retries`,
        link: '/leads',
      });
    }
  } catch {}
});

startBillingCron();
startCampaignDispatcher();
startReplySyncCron();

server.listen(PORT, '0.0.0.0', () => {
  const msg = `BBC CRM Backend running on port ${PORT} (${process.env.NODE_ENV || 'production'})`;
  console.log(`\n🚀 ${msg}`);
  console.log(`📡 API:    http://0.0.0.0:${PORT}/api`);
  console.log(`🔌 Socket: ws://0.0.0.0:${PORT}`);
  console.log(`📁 Mode:   ${process.env.NODE_ENV || 'production'}\n`);
  logger.info('SERVER', msg, { port: PORT, pid: process.pid });
});

process.on('unhandledRejection', (err) => {
  logger.error('SERVER', `Unhandled Rejection: ${err.message}`, { stack: err.stack?.slice(0, 300) });
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

// restarted by antigravity at 2026-06-02
