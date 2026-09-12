import { useMemo } from "react";
import { getIntervalWorkSummary, intervalScheduleMinutes } from "../lib/interval-schedule.js";
import { REMINDER_TYPE } from "../lib/reminder-due-logic.js";
import { reminderSlotsOnDate, localDateKey } from "../lib/reminder-date-view.js";
import { activityDate } from "../../../shared/lib/date-utils.js";

/** Read-only Composer summary and the daily notification budget. */
export function useReminderComposerPreview({ draft, editingId, reminders, activities, t, typeOptions, daysOfWeek }) {
  return useMemo(() => {
    const title = draft.title.trim() || "Reminder ใหม่";
    const typeLabel = t(typeOptions.find((option) => option.type === draft.type)?.labelKey);
    const field = (label, value) => ({ label, value });
    const quotaDate = new Date();
    const quotaDateKey = localDateKey(quotaDate);
    const existingReminderCount = reminders
      .filter((reminder) => reminder.id !== editingId && reminder.enabled && !reminder.completedAt)
      .reduce((total, reminder) => total + reminderSlotsOnDate(reminder, quotaDate).length, 0);
    const activityNotificationCount = activities.filter((activity) => {
      if (!activity.start?.dateTime) return false;
      const start = activityDate(activity.start);
      return start && localDateKey(start) === quotaDateKey;
    }).length;
    const amount = Math.max(1, Number(draft.amount) || 1);
    const unit = draft.unit === "hours" ? "ชม." : "นาที";
    const draftForQuota = {
      type: draft.type, amount, unit: draft.unit,
      windowStart: draft.runAllDay ? null : draft.windowStart,
      windowEnd: draft.runAllDay ? null : draft.windowEnd,
      days: draft.days, time: draft.time, times: draft.times,
      atMs: draft.atDate && draft.atTime ? new Date(`${draft.atDate}T${draft.atTime}:00`).getTime() : null,
      startedAt: draft.type === REMINDER_TYPE.COUNTDOWN ? Date.now() : null,
      durationMs: Math.max(1, Number(draft.countdownMinutes) || 1) * 60 * 1000,
      eventAnchorCountdownMinutes: draft.eventAnchorCountdownEnabled ? Math.max(1, Number(draft.eventAnchorCountdownAmount) || 1) * (draft.eventAnchorCountdownUnit === "hours" ? 60 : 1) : null,
      eventAnchorStopwatchMinutes: draft.eventAnchorStopwatchEnabled ? Math.max(1, Number(draft.eventAnchorStopwatchAmount) || 1) * (draft.eventAnchorStopwatchUnit === "hours" ? 60 : 1) : null
    };
    const notificationQuota = {
      limit: 720,
      existingReminderCount,
      activityNotificationCount,
      draftNotificationCount: reminderSlotsOnDate(draftForQuota, quotaDate).length
    };
    notificationQuota.projectedNotificationCount = notificationQuota.existingReminderCount + notificationQuota.activityNotificationCount + notificationQuota.draftNotificationCount;
    notificationQuota.isAtLimit = notificationQuota.projectedNotificationCount >= notificationQuota.limit;
    const withQuota = (preview) => ({ ...preview, notificationQuota });
    if (draft.type === REMINDER_TYPE.INTERVAL) {
      const intervalDraft = { amount, unit: draft.unit, windowStart: draft.runAllDay ? null : draft.windowStart, windowEnd: draft.runAllDay ? null : draft.windowEnd };
      const schedule = getIntervalWorkSummary(intervalDraft);
      const slots = intervalScheduleMinutes(intervalDraft);
      const clock = (minute) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      return withQuota({ title, typeLabel, fields: [
        field("ช่วงทำงาน", schedule.range || "ตลอดวัน (24 ชม.)"),
        field("ความถี่", `ทุก ${amount} ${unit}`),
        field("แจ้งเตือน", `${schedule.notificationCount} รอบ/การทำงาน`)
      ], footnote: `เวลา: ${slots.slice(0, 6).map(clock).join(" · ")}${slots.length > 6 ? ` · +${slots.length - 6}` : ""}${schedule.range ? ` (${schedule.workMinutes / 60} ชม.)` : ""}` });
    }
    const eventAnchorSummary = [
      draft.eventAnchorCountdownEnabled && `Countdown ก่อน ${Math.max(1, Number(draft.eventAnchorCountdownAmount) || 1)} ${draft.eventAnchorCountdownUnit === "hours" ? "ชม." : "นาที"}`,
      draft.eventAnchorStopwatchEnabled && `Stopwatch หลัง ${Math.max(1, Number(draft.eventAnchorStopwatchAmount) || 1)} ${draft.eventAnchorStopwatchUnit === "hours" ? "ชม." : "นาที"}`
    ].filter(Boolean).join(" · ");
    if (draft.type === REMINDER_TYPE.WEEKLY) {
      const days = daysOfWeek.filter((day) => draft.days.includes(day.value)).map((day) => t(day.labelKey));
      const times = (draft.times || []).filter(Boolean);
      return withQuota({ title, typeLabel, fields: [field("วัน", days.length ? days.join(" · ") : "ยังไม่ได้เลือก"), field("เวลา", times.length ? times.join(" · ") : "ยังไม่ได้กำหนด"), field("Event session", eventAnchorSummary || "ไม่มี"), field("รวม", `${days.length * times.length} รอบ/สัปดาห์`)] });
    }
    if (draft.type === REMINDER_TYPE.EVENT_ANCHORED) return withQuota({ title, typeLabel, fields: [field("เหตุการณ์", draft.eventName.trim() || "ยังไม่ได้ระบุ"), field("แจ้งเตือน", `หลังเหตุการณ์ ${Math.max(1, Number(draft.afterAmount) || 1)} ${draft.afterUnit === "hours" ? "ชม." : "นาที"}`)] });
    if (draft.type === REMINDER_TYPE.ROUTINE) {
      const count = draft.routineSteps.split(",").map((item) => item.trim()).filter(Boolean).length;
      return withQuota({ title, typeLabel, fields: [field("ขั้นตอน", count ? `${count} ขั้นตอน` : "ยังไม่ได้ระบุ")], footnote: draft.routineSteps || undefined });
    }
    if (draft.type === REMINDER_TYPE.ONCE_AT) return withQuota({ title, typeLabel, fields: [field("กำหนด", `${draft.atDate || "ยังไม่ได้เลือกวัน"} · ${draft.atTime || "ยังไม่ได้เลือกเวลา"}`), field("Event session", eventAnchorSummary || "ไม่มี")] });
    if (draft.type === REMINDER_TYPE.COUNTDOWN) return withQuota({ title, typeLabel, fields: [field("ระยะเวลา", `${Math.max(1, Number(draft.countdownMinutes) || 1)} นาที`), field("เริ่ม", "ทันทีหลังบันทึก"), field("Event session", eventAnchorSummary || "ไม่มี")] });
    return withQuota({ title, typeLabel, fields: [field("การทำงาน", "เริ่มจับเวลาเมื่อกด Start")], footnote: "หยุดและเริ่มใหม่ได้โดยไม่รีเซ็ตเวลาสะสม" });
  }, [activities, daysOfWeek, draft, editingId, reminders, t, typeOptions]);
}
