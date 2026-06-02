'use strict';
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const mongoose = require('mongoose');
const { FILES, PM2_FILES, LOG_DIR } = require('../utils/sysLogger');
const { ALL_SOURCES, parseLine }    = require('../utils/logWatcher');

// ── Helpers ───────────────────────────────────────────────────────────────

function readLastN(fp, fileKey, n = 500) {
  try {
    const stat = fs.statSync(fp);
    if (stat.size === 0) return [];
    const CHUNK = Math.min(stat.size, Math.max(n * 250, 131072));
    const start = Math.max(0, stat.size - CHUNK);
    const buf   = Buffer.alloc(stat.size - start);
    const fd    = fs.openSync(fp, 'r');
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    return buf.toString('utf8').split('\n').map(l => parseLine(l, fileKey)).filter(Boolean).slice(-n);
  } catch {
    return [];
  }
}

// ── GET /api/admin/logs/:source ───────────────────────────────────────────
exports.getLogs = (req, res, next) => {
  try {
    const { source }                = req.params;
    const { lines = 500, search, level } = req.query;
    const n = Math.min(2000, Math.max(10, Number(lines) || 500));

    const fp = ALL_SOURCES[source];
    if (!fp) return res.status(404).json({ success: false, message: `Unknown log source: ${source}` });

    let entries = readLastN(fp, source, n);

    if (level)  entries = entries.filter(e => e.level  === level.toUpperCase());
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(e =>
        e.message.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q)
      );
    }

    const exists = fs.existsSync(fp);
    let fileSize = 0;
    try { fileSize = fs.statSync(fp).size; } catch {}

    res.json({ success: true, source, filePath: fp, exists, fileSize, data: entries });
  } catch (err) { next(err); }
};

// ── GET /api/admin/logs — list available sources ──────────────────────────
exports.listSources = (req, res) => {
  const sources = Object.entries(ALL_SOURCES).map(([key, fp]) => {
    let exists = false, size = 0, modified = null;
    try { const s = fs.statSync(fp); exists = true; size = s.size; modified = s.mtime; } catch {}
    return { key, filePath: fp, exists, size, modified };
  });
  res.json({ success: true, data: sources });
};

// ── GET /api/admin/logs/:source/download ─────────────────────────────────
exports.downloadLog = (req, res, next) => {
  try {
    const { source } = req.params;
    const fp = ALL_SOURCES[source];
    if (!fp) return res.status(404).json({ success: false, message: `Unknown log source: ${source}` });
    if (!fs.existsSync(fp)) return res.status(404).json({ success: false, message: 'Log file not found or not yet created' });

    const filename = `${source}-${new Date().toISOString().slice(0, 10)}.log`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/plain');
    fs.createReadStream(fp).pipe(res);
  } catch (err) { next(err); }
};

// ── GET /api/admin/system-status ─────────────────────────────────────────
exports.getSystemStatus = async (req, res, next) => {
  try {
    const mem   = process.memoryUsage();
    const cpus  = os.cpus();

    // MongoDB state: 0=disc 1=connected 2=connecting 3=disconnecting
    const mongoState = mongoose.connection.readyState;
    const mongoStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState] ?? 'unknown';

    // Redis check — try to reach the configured Redis host
    let redisStatus = 'unknown';
    try {
      const { createClient } = require('redis');
      const host = process.env.REDIS_HOST || '127.0.0.1';
      const port = parseInt(process.env.REDIS_PORT || '6379', 10);
      const client = createClient({ socket: { host, port, connectTimeout: 1500 } });
      await client.connect();
      await client.ping();
      await client.quit();
      redisStatus = 'connected';
    } catch {
      // Try BullMQ's internal ioredis connection instead
      try {
        const { emailQueue } = require('../queues/emailQueue');
        const client = emailQueue.client ?? emailQueue._client;
        if (client && client.status === 'ready') redisStatus = 'connected';
        else redisStatus = 'disconnected';
      } catch {
        redisStatus = 'disconnected';
      }
    }

    // PM2 process list — optional, non-blocking
    let pm2Processes = [];
    try {
      const { execSync } = require('child_process');
      const raw = execSync('pm2 jlist', { timeout: 2000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      pm2Processes = JSON.parse(raw).map(p => ({
        name:      p.name,
        pid:       p.pid,
        status:    p.pm2_env?.status,
        restarts:  p.pm2_env?.restart_time,
        uptime:    p.pm2_env?.pm_uptime,
        memory:    p.monit?.memory,
        cpu:       p.monit?.cpu,
      }));
    } catch { /* PM2 not available */ }

    res.json({
      success: true,
      data: {
        server: {
          pid:       process.pid,
          uptime:    Math.floor(process.uptime()),
          nodeVersion: process.version,
          platform:  process.platform,
          env:       process.env.NODE_ENV || 'development',
        },
        memory: {
          heapUsed:  mem.heapUsed,
          heapTotal: mem.heapTotal,
          rss:       mem.rss,
          external:  mem.external,
          sysFree:   os.freemem(),
          sysTotal:  os.totalmem(),
        },
        cpu: {
          count:  cpus.length,
          model:  cpus[0]?.model ?? 'unknown',
          loadAvg: os.loadavg(),
        },
        services: {
          backend:  'online',
          mongodb:  mongoStatus,
          redis:    redisStatus,
        },
        pm2: pm2Processes,
        logDir: LOG_DIR,
        ts: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
};
