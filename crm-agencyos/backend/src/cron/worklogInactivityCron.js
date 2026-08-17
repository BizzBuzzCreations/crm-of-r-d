'use strict';
// Auto-stops the hours timer for anyone who's gone quiet — the CRM has no
// server-side session revocation (access/refresh tokens are pure JWTs, see
// authController.js), so this can't force a real re-login. What it *can*
// do, and what this exists for: if a user's WorkLog hasn't synced in over
// an hour (worklogAPI.upsert normally fires every ~15s while the timer is
// active OR on a break — see tickTimer/tickBreak in useAppStore.js), that's
// a reliable signal their tab crashed/closed/lost network rather than them
// still genuinely working. Flip their timer off and mark them offline so
// hours/presence don't silently keep counting forever.
//
// Deliberately keyed off WorkLog.updatedAt (already auto-maintained by
// { timestamps: true }) rather than a new "lastActiveAt" field on User —
// no schema change needed, and it's scoped to exactly the rows that matter
// (only WorkLogs currently marked active/breakActive can go stale in a way
// worth correcting).
const cron = require('node-cron');
const User = require('../models/User');
const { WorkLog } = require('../models/index');

let sysLog = { info: () => {}, warn: () => {}, error: () => {} };
try { sysLog = require('../utils/sysLogger').logger; } catch {}

const INACTIVITY_MS = 60 * 60 * 1000; // 1 hour

function startWorklogInactivityCron() {
  cron.schedule('*/5 * * * *', runInactivityTick);
  console.log('✅ Worklog inactivity cron scheduled (every 5 minutes)');
  sysLog.info('SERVER', 'Worklog inactivity cron scheduled (every 5 minutes, 1h threshold)');
}

let tickRunning = false;
async function runInactivityTick() {
  if (tickRunning) return; // previous tick still running — skip, next one is 5 min away anyway
  tickRunning = true;
  try {
    const cutoff = new Date(Date.now() - INACTIVITY_MS);
    const stale = await WorkLog.find({
      $or: [{ active: true }, { breakActive: true }],
      updatedAt: { $lt: cutoff },
    }).select('_id userId');

    if (!stale.length) return;

    const staleIds = stale.map((w) => w._id);
    const userIds = [...new Set(stale.map((w) => String(w.userId)))];

    await WorkLog.updateMany({ _id: { $in: staleIds } }, { active: false, breakActive: false });
    await User.updateMany({ _id: { $in: userIds } }, { status: 'offline' });

    console.log(`🧹 Worklog inactivity: stopped ${stale.length} idle timer(s) for ${userIds.length} user(s)`);
    sysLog.info('SERVER', `Worklog inactivity: stopped ${stale.length} idle timer(s) for ${userIds.length} user(s) (no sync in over 1h)`);
  } catch (err) {
    sysLog.error('SERVER', `Worklog inactivity tick error: ${err.message}`);
  } finally {
    tickRunning = false;
  }
}

module.exports = { startWorklogInactivityCron, runInactivityTick };
