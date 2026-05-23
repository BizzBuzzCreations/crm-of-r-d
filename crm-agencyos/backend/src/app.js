const express     = require('express');
const cors        = require('cors');
const morgan      = require('morgan');
const path        = require('path');
const cookieParser= require('cookie-parser');
const errorHandler= require('./middleware/errorHandler');

const app = express();

// ── Core middleware ─────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Static files (uploaded attachments) ────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/clients',  require('./routes/clients'));
app.use('/api/tasks',    require('./routes/tasks'));
app.use('/api/todos',    require('./routes/todos'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/reports',  require('./routes/reports'));
app.use('/api/worklog',  require('./routes/worklog'));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
