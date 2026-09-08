// Wall-clock intervals anchored to the configured window, including an end
// boundary only when the frequency lands on it. Overnight windows retain
// their phase across midnight. An all-day schedule resets at midnight.
function intervalScheduleMinutes(reminder) {
  const step = Number(reminder.amount) * (reminder.unit === 'hours' ? 60 : 1);
  if (!Number.isFinite(step) || step < 1) return [];
  const parse = value => {
    if (!/^\d{2}:\d{2}$/.test(value || '')) return null;
    const [h, m] = value.split(':').map(Number);
    return h < 24 && m < 60 ? h * 60 + m : null;
  };
  const start = parse(reminder.windowStart);
  const end = parse(reminder.windowEnd);
  const allDay = start === null || end === null || start === end;
  const anchor = allDay ? 0 : start;
  const duration = allDay ? 1440 : (end - start + 1440) % 1440;
  const slots = [];
  for (let offset = 0; allDay ? offset < duration : offset <= duration; offset += step) {
    slots.push((anchor + offset) % 1440);
  }
  return [...new Set(slots)].sort((a, b) => a - b);
}

function nextIntervalDue(reminder, from) {
  const slots = intervalScheduleMinutes(reminder);
  for (let day = 0; day < 2; day++) {
    for (const minute of slots) {
      const target = new Date(from);
      target.setDate(target.getDate() + day);
      target.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      if (+target > from) return +target;
    }
  }
  return Infinity;
}

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
    return nextIntervalDue(reminder, from);
  }
  return Infinity;
}

module.exports = { REMINDER_TYPE, isOneShotType, computeNextDueAt };
