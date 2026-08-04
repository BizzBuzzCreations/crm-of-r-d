const AuditLog = require('../models/AuditLog');

/**
 * Write an audit log entry. Fire-and-forget — never throws so log
 * failures cannot break the main request cycle.
 *
 * @param {object} context   Express req (protect middleware must have run),
 *                           or a plain { user, ip, headers } object for
 *                           routes that bypass protect (login/logout).
 * @param {object} entry
 * @param {string}  entry.action       - 'create'|'update'|'delete'|'login'|…
 * @param {string}  entry.category     - 'task'|'lead'|'auth'|…
 * @param {*}      [entry.targetId]    - ObjectId of the affected document
 * @param {string} [entry.targetModel] - Mongoose model name e.g. 'Task'
 * @param {string} [entry.targetTitle] - Human-readable label
 * @param {string} [entry.targetRef]   - Short reference e.g. '#42' or 'LD-AB12'
 * @param {object} [entry.changes]     - { field: { from, to } } diff object
 * @param {object} [entry.metadata]    - Any extra structured info
 */
async function log(
  context,
  { action, category, targetId, targetModel, targetTitle, targetRef, changes, metadata } = {}
) {
  try {
    const user = context?.user ?? null;
    const ip   = context?.ip
      ?? context?.connection?.remoteAddress
      ?? context?.socket?.remoteAddress
      ?? '';
    const ua   = context?.headers?.['user-agent'] ?? '';

    await AuditLog.create({
      actor: {
        id:   user?._id   ?? null,
        name: user?.name  ?? 'System',
        role: user?.role  ?? 'system',
      },
      action,
      category,
      target: {
        id:    targetId    ?? null,
        model: targetModel ?? '',
        title: targetTitle ?? '',
        ref:   targetRef   ?? '',
      },
      changes:  changes  ?? null,
      metadata: metadata ?? null,
      ip,
      userAgent: ua,
    });
  } catch (err) {
    console.error('[AuditLog] Write failed:', err.message);
  }
}

/**
 * Build a lightweight diff — only fields that differ between prev and next.
 * Skips noisy internals (attachments, embedded arrays, Mongoose meta).
 *
 * @param {object} prev  - Plain JS object (lean() output)
 * @param {object} next  - Plain JS object (req.body or updated doc)
 * @param {string[]} skip - Additional field names to ignore
 * @returns {object|null} changes map or null if nothing changed
 */
function diff(prev = {}, next = {}, skip = []) {
  const SKIP = new Set([
    '__v', 'updatedAt', 'createdAt', 'attachments',
    'activities', 'notes', '_id', 'password', ...skip,
  ]);
  const changes = {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    if (SKIP.has(k)) continue;
    const a = JSON.stringify(prev[k]);
    const b = JSON.stringify(next[k]);
    if (a !== b) changes[k] = { from: prev[k] ?? null, to: next[k] ?? null };
  }
  return Object.keys(changes).length ? changes : null;
}

module.exports = { log, diff };
