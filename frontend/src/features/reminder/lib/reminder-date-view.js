import { hasWindow, isMinuteWithinWindow, minutesFromHHMM } from './reminder-due-logic.js';

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Shared by the date view, live timeline and PNG; no changes to due state.
export function reminderSlotsOnDate(reminder, date) {
  const key = localDateKey(date);
  const at = (timestamp) => {
    if (!Number.isFinite(timestamp)) return [];
    const value = new Date(timestamp);
    return localDateKey(value) === key ? [value.getHours() * 60 + value.getMinutes()] : [];
  };
  if (Number.isFinite(reminder.snoozedUntil) && reminder.snoozedUntil === reminder.nextDueAt) return at(reminder.nextDueAt);
  switch (reminder.type) {
    case 'weekly':
      return reminder.days?.includes(date.getDay())
        ? [...new Set((reminder.times?.length ? reminder.times : [reminder.time]).filter(Boolean).map(minutesFromHHMM))] : [];
    case 'interval': {
      const step = Number(reminder.amount) * (reminder.unit === 'hours' ? 60 : 1);
      if (!Number.isFinite(step) || step < 1) return [];
      const slots = [];
      for (let minute = 0; minute < 1440; minute += step) {
        if (!hasWindow(reminder) || isMinuteWithinWindow(minute, reminder.windowStart, reminder.windowEnd)) slots.push(minute);
      }
      return slots;
    }
    case 'once-at': return at(reminder.atMs);
    case 'countdown': return at(reminder.startedAt ? reminder.startedAt + reminder.durationMs : null);
    case 'event-anchored': return at(reminder.nextDueAt);
    default: return [];
  }
}
