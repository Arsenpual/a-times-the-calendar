import { REMINDER_TYPE, eventAnchorMinutes, hasEventAnchorSession } from "./reminder-due-logic.js";

const MINUTE_MS = 60 * 1000;

function sourceOccurrenceAt(reminder, now) {
  if (Number.isFinite(reminder.eventAnchorStartedAt)) return reminder.eventAnchorStartedAt;
  // The browser may render the primary due state a second before the sync
  // writes it back. Use that primary instant as a harmless local fallback.
  return Number.isFinite(reminder.nextDueAt) && reminder.nextDueAt <= now
    ? reminder.nextDueAt
    : null;
}

/**
 * Creates view-only Countdown/Stopwatch records from a scheduled reminder.
 * They are never sent to Firestore and all mutations still target sourceId.
 */
export function deriveEventAnchorSessions(reminders, now = Date.now()) {
  return reminders.flatMap((source) => {
    if (!hasEventAnchorSession(source)) return [];
    const derived = [];
    const countdownMinutes = eventAnchorMinutes(source, "countdown");
    const stopwatchMinutes = eventAnchorMinutes(source, "stopwatch");
    const nextPrimaryAt = Number.isFinite(source.eventAnchorPrimaryDueAt)
      ? source.eventAnchorPrimaryDueAt
      : source.nextDueAt;

    if (source.enabled && !source.completedAt && countdownMinutes && Number.isFinite(nextPrimaryAt)) {
      const startedAt = nextPrimaryAt - countdownMinutes * MINUTE_MS;
      if (startedAt <= now && now < nextPrimaryAt) {
        derived.push({
          id: `event-anchor:${source.id}:${nextPrimaryAt}:countdown`,
          sourceReminderId: source.id,
          sourceReminder: source,
          isEventAnchorDerived: true,
          eventAnchorPhase: "countdown",
          type: REMINDER_TYPE.COUNTDOWN,
          title: source.eventAnchorCountdownTitle || `Countdown · ${source.title}`,
          enabled: true,
          startedAt,
          durationMs: countdownMinutes * MINUTE_MS,
          nextDueAt: nextPrimaryAt,
          lineColor: source.lineColor,
          groupId: source.groupId
        });
      }
    }

    const primaryAt = sourceOccurrenceAt(source, now);
    if (stopwatchMinutes && Number.isFinite(primaryAt)) {
      const endsAt = primaryAt + stopwatchMinutes * MINUTE_MS;
      if (primaryAt <= now && now < endsAt) {
        derived.push({
          id: `event-anchor:${source.id}:${primaryAt}:stopwatch`,
          sourceReminderId: source.id,
          sourceReminder: source,
          isEventAnchorDerived: true,
          eventAnchorPhase: "stopwatch",
          type: REMINDER_TYPE.STOPWATCH,
          title: source.eventAnchorStopwatchTitle || `Stopwatch · ${source.title}`,
          enabled: true,
          startedAt: primaryAt,
          accumulatedMs: 0,
          eventAnchorEndsAt: endsAt,
          lineColor: source.lineColor,
          groupId: source.groupId
        });
      }
    }
    return derived;
  });
}
