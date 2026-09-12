import { REMINDER_TYPE } from "./reminder-due-logic.js";

export function buildReminderBase({ draft, editingId, existingReminder }) {
  return {
    id: editingId || `reminder-${Date.now()}`,
    title: draft.title,
    type: draft.type,
    enabled: existingReminder ? existingReminder.enabled : true,
    groupId: draft.groupId ?? null
  };
}

export function applyReminderTypeFields(reminder, { draft, editingId, existingReminder, defaultLineColor }) {
  if (draft.type === REMINDER_TYPE.INTERVAL) {
    reminder.amount = parseInt(draft.amount) || 30; reminder.unit = draft.unit;
    reminder.windowStart = !draft.runAllDay && draft.windowStart && draft.windowEnd ? draft.windowStart : null;
    reminder.windowEnd = !draft.runAllDay && draft.windowStart && draft.windowEnd ? draft.windowEnd : null;
  } else if (draft.type === REMINDER_TYPE.WEEKLY) {
    reminder.days = draft.days; reminder.times = [...new Set((draft.times || [draft.time]).filter(Boolean))].sort(); reminder.time = reminder.times[0] || "08:00";
  } else if (draft.type === REMINDER_TYPE.EVENT_ANCHORED) {
    reminder.eventName = draft.eventName || "เหตุการณ์หลัก"; reminder.afterAmount = parseInt(draft.afterAmount) || 1; reminder.afterUnit = draft.afterUnit; reminder.lastTriggeredAt = null; reminder.enabled = false;
  } else if (draft.type === REMINDER_TYPE.ROUTINE) {
    reminder.steps = draft.routineSteps.split(",").map((s) => s.trim()).filter(Boolean); reminder.currentIndex = 0;
  } else if (draft.type === REMINDER_TYPE.ONCE_AT) {
    reminder.atMs = new Date(`${draft.atDate}T${draft.atTime}:00`).getTime();
  } else if (draft.type === REMINDER_TYPE.COUNTDOWN) {
    reminder.durationMs = (parseInt(draft.countdownMinutes) || 20) * 60000; reminder.startedAt = Date.now(); reminder.lineColor = draft.lineColor || defaultLineColor;
  } else if (draft.type === REMINDER_TYPE.STOPWATCH) {
    reminder.lineColor = draft.lineColor || defaultLineColor;
    reminder.accumulatedMs = editingId ? existingReminder?.accumulatedMs || 0 : 0;
    reminder.startedAt = editingId ? existingReminder?.startedAt || null : null;
    reminder.enabled = editingId ? existingReminder?.enabled || false : false;
  }
  return reminder;
}
