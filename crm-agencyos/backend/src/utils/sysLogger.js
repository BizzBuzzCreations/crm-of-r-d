'use strict';
/**
 * sysLogger — Structured file logger for the CRM backend.
 *
 * Writes JSON-newline records to rotating log files in backend/logs/ AND
 * passes through to stdout/stderr (so PM2 captures them too).
 *
 * No external dependencies — pure Node.js built-ins only.
 */
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Paths ──────────────────────────────────────────────────────────────────
const LOG_DIR = path.join(process.cwd(), 'logs');
const PM2_DIR = path.join(process.env.PM2_HOME || path.join(os.homedir(), '.pm2'), 'logs');

// Ensure custom log directory exists on first import
try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}

// ── File targets ───────────────────────────────────────────────────────────
const FILES = {
  combined:      path.join(LOG_DIR, 'combined.log'),
  error:         path.join(LOG_DIR, 'error.log'),
  system:        path.join(LOG_DIR, 'system.log'),
  email:         path.join(LOG_DIR, 'email.log'),
  queue:         path.join(LOG_DIR, 'queue.log'),
  http:          path.join(LOG_DIR, 'http.log'),
  // Own dedicated files — separate from combined.log's firehose — so each
  // background worker's activity can be watched on its own tab in System
  // Logs (Settings → System Monitor) without it getting lost in everything
  // else. Written to on every dispatcher tick (not just errors), so a quiet
  // file with recent timestamps still tells you "it's alive, just idle"
  // instead of leaving that ambiguous.
  campaign:      path.join(LOG_DIR, 'campaign.log'),
  prospectAudit: path.join(LOG_DIR, 'prospect-audit.log'),
  social:        path.join(LOG_DIR, 'social.log'),
};

// PM2 captured files (read-only — written by PM2 itself)
const PM2_FILES = {
  'backend-out':   path.join(PM2_DIR, 'rndCRM-backend-out.log'),
  'backend-error': path.join(PM2_DIR, 'rndCRM-backend-error.log'),
  'worker-out':    path.join(PM2_DIR, 'email-worker-out.log'),
  'worker-error':  path.join(PM2_DIR, 'email-worker-error.log'),
};

module.exports.LOG_DIR   = LOG_DIR;
module.exports.PM2_DIR   = PM2_DIR;
module.exports.FILES     = FILES;
module.exports.PM2_FILES = PM2_FILES;

// ── Internal write helper ──────────────────────────────────────────────────
function writeRaw(filePaths, line) {
  const safeFilePaths = Array.isArray(filePaths) ? filePaths : [filePaths];
  for (const fp of safeFilePaths) {
    try { fs.appendFileSync(fp, line + '\n'); } catch {}
  }
}

function write(level, source, message, meta) {
  const ts  = new Date().toISOString();
  const obj = { ts, level, source, message, pid: process.pid };
  if (meta) obj.meta = meta;
  const jsonLine = JSON.stringify(obj);

  // Combined always gets everything
  writeRaw(FILES.combined, jsonLine);

  // Level-specific
  if (level === 'ERROR') writeRaw(FILES.error, jsonLine);

  // Source-specific
  const src = (source || '').toUpperCase();
  if (['EMAIL', 'SMTP', 'MAILER'].includes(src)) writeRaw(FILES.email, jsonLine);
  if (['QUEUE', 'BULLMQ', 'WORKER'].includes(src)) writeRaw(FILES.queue, jsonLine);
  if (['SERVER', 'DB', 'MONGO', 'REDIS', 'SOCKET', 'AUTH'].includes(src)) writeRaw(FILES.system, jsonLine);
  if (src === 'HTTP') writeRaw(FILES.http, jsonLine);
  if (src === 'CAMPAIGN') writeRaw(FILES.campaign, jsonLine);
  if (src === 'PROSPECT_AUDIT') writeRaw(FILES.prospectAudit, jsonLine);
  if (src === 'SOCIAL') writeRaw(FILES.social, jsonLine);
}

// ── Public API ─────────────────────────────────────────────────────────────
const logger = {
  info:  (source, message, meta) => write('INFO',  source, message, meta),
  warn:  (source, message, meta) => write('WARN',  source, message, meta),
  error: (source, message, meta) => write('ERROR', source, message, meta),
  debug: (source, message, meta) => write('DEBUG', source, message, meta),
};

module.exports.logger = logger;
module.exports.default = logger;
