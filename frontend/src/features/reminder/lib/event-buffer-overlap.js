import { REMINDER_TYPE, eventAnchorMinutes, hasEventAnchorSession } from "./reminder-due-logic.js";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function startOfLocalDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function occurrenceRanges(reminder, from, horizon) {
  if (!hasEventAnchorSession(reminder)) return [];
  const before = eventAnchorMinutes(reminder, "countdown") || 0;
  const after = eventAnchorMinutes(reminder, "stopwatch") || 0;
  const addRange = (primaryAt) => ({
    reminderId: reminder.id,
    title: reminder.title,
    startAt: primaryAt - before * MINUTE_MS,
    endAt: primaryAt + after * MINUTE_MS
  });

  if (reminder.type === REMINDER_TYPE.ONCE_AT) {
    const range = addRange(reminder.atMs);
    return Number.isFinite(reminder.atMs) && range.endAt > from && range.startAt < horizon ? [range] : [];
  }
  if (reminder.type !== REMINDER_TYPE.WEEKLY) return [];

  const times = [...new Set((reminder.times?.length ? reminder.times : [reminder.time]).filter(Boolean))];
  const days = new Set(reminder.days || []);
  const ranges = [];
  for (let dayStart = startOfLocalDay(from); dayStart < horizon; dayStart += DAY_MS) {
    const day = new Date(dayStart).getDay();
    if (!days.has(day)) continue;
    for (const time of times) {
      const [hours, minutes] = String(time).split(":").map(Number);
      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) continue;
      const range = addRange(dayStart + (hours * 60 + minutes) * MINUTE_MS);
      if (range.endAt > from && range.startAt < horizon) ranges.push(range);
    }
  }
  return ranges;
}

function rangesOverlap(first, second) {
  // Touching exactly at the primary time is valid: countdown ends where the
  // stopwatch begins. Any shared duration is rejected.
  return first.startAt < second.endAt && second.startAt < first.endAt;
}

/**
 * Detects overlapping Countdown/Stopwatch windows across the candidate's
 * recurring week and other enabled reminders. The caller uses it before save,
 * before a problematic schedule reaches Firestore or the notification queue.
 */
export function findEventBufferOverlap(candidate, reminders, from = Date.now()) {
  if (!hasEventAnchorSession(candidate)) return null;
  const horizon = startOfLocalDay(from) + 8 * DAY_MS;
  const candidateRanges = occurrenceRanges(candidate, from, horizon);

  for (let index = 0; index < candidateRanges.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < candidateRanges.length; otherIndex += 1) {
      if (rangesOverlap(candidateRanges[index], candidateRanges[otherIndex])) {
        return { candidate: candidateRanges[index], conflict: candidateRanges[otherIndex], sameReminder: true };
      }
    }
  }

  const otherRanges = reminders
    .filter((reminder) => reminder.id !== candidate.id && reminder.enabled && !reminder.completedAt)
    .flatMap((reminder) => occurrenceRanges(reminder, from, horizon));
  for (const candidateRange of candidateRanges) {
    const conflict = otherRanges.find((otherRange) => rangesOverlap(candidateRange, otherRange));
    if (conflict) return { candidate: candidateRange, conflict, sameReminder: false };
  }
  return null;
}
