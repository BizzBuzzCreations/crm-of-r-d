const express     = require('express');
const cors        = require('cors');
const morgan      = require('morgan');
const path        = require('path');
const cookieParser= require('cookie-parser');
const errorHandler= require('./middleware/errorHandler');

const app = express();

// ── CORS — allow dev (localhost:5173), configured CLIENT_URL, and any LAN IP ──
const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, '') : null;
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  clientUrl,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, same-origin production requests)
    if (!origin) return callback(null, true);
    
    // Normalize trailing slashes for resilient comparison
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    // Allow any configured origin exactly
    if (ALLOWED_ORIGINS.includes(normalizedOrigin)) return callback(null, true);
    // Allow any LAN IP (192.168.x.x or 10.x.x.x) on any port
    if (/^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(normalizedOrigin)) return callback(null, true);
    
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
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
app.use('/api/revenue',  require('./routes/revenue'));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ── Serve built React frontend in production ─────────────────
// dist/ lives at crm-agencyos/dist/ — two levels up from backend/src/
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));
// SPA fallback — must come AFTER all /api routes
app.get('*', (req, res) => {
  // Don't intercept actual API calls that reached here somehow
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;

