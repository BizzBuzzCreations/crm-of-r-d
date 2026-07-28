const express     = require('express');
const cors        = require('cors');
const morgan      = require('morgan');
const path        = require('path');
const cookieParser= require('cookie-parser');
const errorHandler= require('./middleware/errorHandler');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── Website Intelligence public tracking endpoints — mounted BEFORE the
// app-wide CORS allowlist below (with their own permissive CORS applied in
// routes/witPublic.js) since these are called from the 5 monitored
// websites' own origins, not from this CRM's own frontend. Analogous to how
// the campaign tracking pixel is public, except this one needs real CORS
// headers (fetch/sendBeacon calls, not an <img> tag).
app.use('/api/wit', require('./routes/witPublic'));

// ── CORS — allow dev (localhost:5173, 5174), configured CLIENT_URL, and any LAN IP ──
const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, '') : null;
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
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
    if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(normalizedOrigin)) return callback(null, true);
    
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Static files (uploaded attachments) ────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Website Intelligence tracking snippet — embedded on the 5 tracked
// sites via <script src=".../wit.js" data-tracking-id="..." async>. Served
// with CORS wide open (any site can load it — that's the point of a
// tracking snippet) and short caching so a fix ships to every site quickly.
app.get('/wit.js', (req, res) => {
  res.set({
    'Content-Type': 'application/javascript; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300',
  });
  res.sendFile(path.join(__dirname, '../public/wit.js'));
});

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/clients',  require('./routes/clients'));
app.use('/api/tasks',    require('./routes/tasks'));
app.use('/api/todos',    require('./routes/todos'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/reports',  require('./routes/reports'));
app.use('/api/worklog',        require('./routes/worklog'));
app.use('/api/revenue',        require('./routes/revenue'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/services',       require('./routes/services'));
app.use('/api/channels',       require('./routes/channels'));
app.use('/api/projects',       require('./routes/projects'));
app.use('/api/leads',          require('./routes/leads'));
app.use('/api/settings',       require('./routes/settings'));
app.use('/api/audit',          require('./routes/audit'));
app.use('/api/admin/logs',     require('./routes/adminLogs'));
app.use('/api/portal',         require('./routes/portal'));
app.use('/api/billing',        require('./routes/billing'));
app.use('/api/email-accounts', require('./routes/emailAccounts'));
app.use('/api/email-templates', require('./routes/emailTemplates'));
app.use('/api/meta-ads',       require('./routes/metaAds'));
app.use('/api/website-intelligence', require('./routes/websiteIntelligence'));
// Public tracking (open pixel / click redirect / unsubscribe) MUST be
// mounted before the protected campaigns router — both share the
// /api/campaigns prefix, and Express matches in registration order.
app.use('/api/campaigns',      require('./routes/campaignPublic'));
app.use('/api/campaigns',      require('./routes/campaigns'));

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

