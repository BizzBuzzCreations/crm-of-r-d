require('dotenv').config();
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
const io = new Server(server, {
  cors: {
    // 1. UPDATED CORS: Allow dev environment, Nginx frontend root, and any local network IP connection
    origin: [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://127.0.0.1',
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/
    ],
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
