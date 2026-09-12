import { useCallback } from "react";
import { REMINDER_TYPE, computeNextDueAt, initializeEventAnchorSchedule } from "../lib/reminder-due-logic.js";
import { logReminderEvent } from "../lib/reminder-telemetry.js";

/** Runtime commands for a reminder card. UI components only invoke these actions. */
export function useReminderActions({ updateReminders, recordStatsEvent, onWarning }) {
  const triggerAnchorEvent = useCallback((reminderId) => {
    const now = Date.now();
    updateReminders((previous) => previous.map((reminder) => {
      if (reminder.id !== reminderId) return reminder;
      const next = { ...reminder, lastTriggeredAt: now, enabled: true };
      return { ...next, nextDueAt: computeNextDueAt(next, now) };
    }));
  }, [updateReminders]);

  const advanceRoutine = useCallback((reminderId) => {
    updateReminders((previous) => previous.map((reminder) => {
      if (reminder.id !== reminderId) return reminder;
      const nextIndex = (reminder.currentIndex || 0) + 1;
      if (nextIndex < reminder.steps.length) return { ...reminder, currentIndex: nextIndex };
      logReminderEvent("reminder_completed", { reminder_type: reminder.type });
      recordStatsEvent("completed", { title: reminder.title, reminderType: reminder.type });
      return {
        ...reminder, currentIndex: 0, enabled: false, completedAt: Date.now(),
        completionCount: (Number.isInteger(reminder.completionCount) ? reminder.completionCount : 0) + 1
      };
    }));
  }, [recordStatsEvent, updateReminders]);

  const toggleStopwatch = useCallback((reminderId) => {
    updateReminders((previous) => previous.map((reminder) => {
      if (reminder.id !== reminderId || reminder.type !== REMINDER_TYPE.STOPWATCH) return reminder;
      if (!reminder.enabled) return { ...reminder, enabled: true, startedAt: Date.now() };
      const elapsed = reminder.startedAt ? Date.now() - reminder.startedAt : 0;
      recordStatsEvent("stopwatch-session", { title: reminder.title, durationMs: elapsed });
      return { ...reminder, enabled: false, accumulatedMs: (reminder.accumulatedMs || 0) + elapsed, startedAt: null };
    }));
  }, [recordStatsEvent, updateReminders]);

  const resetStopwatch = useCallback((reminderId) => {
    updateReminders((previous) => previous.map((reminder) =>
      reminder.id === reminderId && reminder.type === REMINDER_TYPE.STOPWATCH
        ? { ...reminder, enabled: false, accumulatedMs: 0, startedAt: null }
        : reminder
    ));
  }, [updateReminders]);

  const toggleReminder = useCallback((reminderId) => {
    updateReminders((previous) => previous.map((reminder) => {
      if (reminder.id !== reminderId) return reminder;
      if (reminder.enabled) return { ...reminder, enabled: false };
      if (reminder.type === REMINDER_TYPE.ONCE_AT && reminder.atMs && reminder.atMs <= Date.now()) {
        onWarning?.("เวลาที่ตั้งไว้ผ่านไปแล้ว กรุณาแก้ไขวันที่และเวลาใหม่ก่อนเปิดใช้งานอีกครั้ง");
        return reminder;
      }
      if (reminder.type === REMINDER_TYPE.COUNTDOWN) {
        const restarted = { ...reminder, enabled: true, startedAt: Date.now(), completedAt: null };
        return { ...restarted, nextDueAt: computeNextDueAt(restarted, Date.now()) };
      }
      const reenabled = { ...reminder, enabled: true, completedAt: null };
      return reminder.type === REMINDER_TYPE.INTERVAL
        ? { ...reenabled, nextDueAt: null }
        : { ...reenabled, ...initializeEventAnchorSchedule(reenabled, Date.now()) };
    }));
  }, [onWarning, updateReminders]);

  return { triggerAnchorEvent, advanceRoutine, toggleStopwatch, resetStopwatch, toggleReminder };
}
