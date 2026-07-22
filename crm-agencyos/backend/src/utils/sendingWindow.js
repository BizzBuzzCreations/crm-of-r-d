'use strict';
// Restricts sending to specific hours/days in a configured timezone —
// avoids the robotic look of 3am sends, which hurts engagement-based
// reputation scoring (real humans don't get email replies at 3am).
// Uses Intl.DateTimeFormat (built into Node via ICU) rather than a
// timezone library — no extra dependency needed for this.
function getLocalHourAndDay(timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'Asia/Kolkata',
    hour: 'numeric', hour12: false, weekday: 'short',
  }).formatToParts(new Date());

  const hourPart = parts.find((p) => p.type === 'hour').value;
  const hour = Number(hourPart) % 24; // Intl can return "24" for midnight
  const weekdayStr = parts.find((p) => p.type === 'weekday').value; // 'Sun'..'Sat'
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hour, day: dayMap[weekdayStr] };
}

// settings: { sendingHoursEnabled, sendingHourStart, sendingHourEnd, sendingDays, timezone }
function isWithinSendingWindow(settings) {
  if (!settings?.sendingHoursEnabled) return true;

  const { hour, day } = getLocalHourAndDay(settings.timezone);
  const days = settings.sendingDays?.length ? settings.sendingDays : [0, 1, 2, 3, 4, 5, 6];
  if (!days.includes(day)) return false;

  const start = settings.sendingHourStart ?? 0;
  const end = settings.sendingHourEnd ?? 24;
  // Overnight windows (e.g. 22 -> 6) wrap past midnight; same-day windows don't.
  return start <= end ? (hour >= start && hour < end) : (hour >= start || hour < end);
}

module.exports = { isWithinSendingWindow, getLocalHourAndDay };
