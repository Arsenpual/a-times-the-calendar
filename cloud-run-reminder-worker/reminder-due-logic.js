// CommonJS scheduler logic. Keep this in sync with frontend/src/reminder-due-logic.js.
const REMINDER_TYPE = {
  INTERVAL: "interval", WEEKLY: "weekly", EVENT_ANCHORED: "event-anchored",
  ROUTINE: "routine", ONCE_AT: "once-at", COUNTDOWN: "countdown", STOPWATCH: "stopwatch"
};

function isOneShotType(type) {
  return type === REMINDER_TYPE.ONCE_AT || type === REMINDER_TYPE.COUNTDOWN;
}
function intervalMs(reminder) {
  return reminder.amount * (reminder.unit === "hours" ? 3600000 : 60000);
}
function hasWindow(reminder) {
  return Boolean(reminder.windowStart && reminder.windowEnd);
}
function minutesFromHHMM(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return h * 60 + m;
}
function minuteOfDayAt(ms) {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
}
function isMinuteWithinWindow(minute, startText, endText) {
  const start = minutesFromHHMM(startText);
  const end = minutesFromHHMM(endText);
  if (start === end) return true;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}
function snapToNextWindowStart(ms, windowStart, windowEnd) {
  if (isMinuteWithinWindow(minuteOfDayAt(ms), windowStart, windowEnd)) return ms;
  const dayStart = new Date(ms);
  dayStart.setHours(0, 0, 0, 0);
  let candidate = dayStart.getTime() + minutesFromHHMM(windowStart) * 60000;
  if (candidate < ms) candidate += 86400000;
  return candidate;
}
function nextAllDayIntervalDue(reminder, from) {
  const step = intervalMs(reminder);
  if (!Number.isFinite(step) || step <= 0) return Infinity;
  const dayStart = new Date(from);
  dayStart.setHours(0, 0, 0, 0);
  const offset = (Math.floor((from - dayStart.getTime()) / step) + 1) * step;
  return offset >= 86400000 ? dayStart.getTime() + 86400000 : dayStart.getTime() + offset;
}
function computeNextDueAt(reminder, from) {
  if (reminder.type === REMINDER_TYPE.WEEKLY) {
    const times = (reminder.times?.length ? reminder.times : [reminder.time]).filter(Boolean).sort();
    if (!reminder.days?.length || !times.length) return Infinity;
    const base = new Date(from);
    for (let offset = 0; offset < 8; offset += 1) {
      const candidate = new Date(base);
      candidate.setDate(base.getDate() + offset);
      if (!reminder.days.includes(candidate.getDay())) continue;
      for (const time of times) {
        const minutes = minutesFromHHMM(time);
        candidate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        if (candidate.getTime() > from) return candidate.getTime();
      }
    }
    return Infinity;
  }
  if (reminder.type === REMINDER_TYPE.EVENT_ANCHORED) return Infinity;
  if (reminder.type === REMINDER_TYPE.INTERVAL) {
    const step = intervalMs(reminder);
    if (!Number.isFinite(step) || step <= 0) return Infinity;
    const next = from + step;
    return hasWindow(reminder)
      ? snapToNextWindowStart(next, reminder.windowStart, reminder.windowEnd)
      : nextAllDayIntervalDue(reminder, from);
  }
  return Infinity;
}

module.exports = { REMINDER_TYPE, isOneShotType, computeNextDueAt };
