'use strict';
// Linear ramp from warmupStartLimit up to dailySendLimit over warmupDays,
// starting at warmupStartDate. Once the ramp period has elapsed, the
// account's full dailySendLimit applies as normal.
function effectiveDailyLimit(account) {
  const cap = Number.isFinite(account.dailySendLimit) ? account.dailySendLimit : Infinity;
  if (!account.warmupEnabled || !account.warmupStartDate) return cap;

  const daysElapsed = Math.floor((Date.now() - new Date(account.warmupStartDate).getTime()) / 86400000);
  if (daysElapsed >= account.warmupDays) return cap;
  if (daysElapsed < 0) return account.warmupStartLimit; // start date in the future — shouldn't normally happen

  const progress = account.warmupDays > 0 ? daysElapsed / account.warmupDays : 1;
  const ramped = Math.round(account.warmupStartLimit + (cap - account.warmupStartLimit) * progress);
  return Math.max(account.warmupStartLimit, Math.min(cap, ramped));
}

module.exports = { effectiveDailyLimit };
