require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const socketHandler = require('./src/socket/socketHandler');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.io
const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, '') : null;
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
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
