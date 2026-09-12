import { applyReminderTypeFields, buildReminderBase } from "../lib/reminder-composer-payload.js";
import { REMINDER_TYPE, computeNextDueAt, hasWindow } from "../lib/reminder-due-logic.js";
import { logReminderEvent } from "../lib/reminder-telemetry.js";

function toLocalDateInputValue(ms) {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Composer commands; persistence goes through the existing reminder store. */
export function useReminderComposerActions({
  draft, setDraft, editingId, setEditingId, isComposerOpen, setIsComposerOpen,
  reminders, updateReminders, createBlankDraft, defaultLineColor
}) {
  const DEFAULT_LINE_COLOR = defaultLineColor;
  const toggleDayInDraft = (dayVal) => {
    setDraft((prev) => {
      const exists = prev.days.includes(dayVal);
      return {
        ...prev,
        days: exists ? prev.days.filter((d) => d !== dayVal) : [...prev.days, dayVal]
      };
    });
  };

  const submitReminderForm = (event) => {
    event.preventDefault();
    if (!draft.title.trim()) return;

    const existingReminder = editingId
      ? reminders.find((reminder) => reminder.id === editingId)
      : null;
    // Base identity/status fields are pure form data; type-specific schedule
    // fields and UI-only validation remain below during this migration step.
    let newReminder = buildReminderBase({ draft, editingId, existingReminder });

    if (draft.type === REMINDER_TYPE.ONCE_AT) {
      if (!draft.atDate || !draft.atTime) {
        alert("กรุณากำหนดวันที่และเวลา");
        return;
      }
      const atMs = new Date(`${draft.atDate}T${draft.atTime}:00`).getTime();
      if (!editingId && atMs <= Date.now()) {
        alert("เวลาที่เลือกผ่านไปแล้ว กรุณาเลือกวันที่และเวลาในอนาคต");
        return;
      }
    }
    applyReminderTypeFields(newReminder, { draft, editingId, existingReminder, defaultLineColor: DEFAULT_LINE_COLOR });

    // Interval เวอร์ชันพื้นฐานเก็บเพียงความถี่เพื่อใช้อ้างอิงใน UI ยังไม่
    // เข้าระบบ due/push จึงไม่สร้างงาน Cloud Run หรือ notification.
    newReminder.nextDueAt = newReminder.type === REMINDER_TYPE.INTERVAL
      ? null
      : computeNextDueAt(newReminder, Date.now());

    // migration plan v2 เฟส 4 — completedAt เป็น runtime field (ไม่ sync
    // backend, ดู SCHEDULE_FIELD_KEYS) ต้องคงค่าเดิมไว้ตอนแก้ไข reminder
    // (เช่นแค่แก้ชื่อ) ไม่ให้หลุดออกจาก tab "ทำเสร็จแล้ว" โดยไม่ตั้งใจ —
    // เหมือน pattern ที่ accumulatedMs/startedAt ของ stopwatch ทำไว้ข้างบน
    // reminder สร้างใหม่เริ่มต้นที่ null เสมอ (ยังไม่เคยทำเสร็จ)
    if (editingId) {
      newReminder.completedAt = existingReminder?.completedAt ?? null;
      if (newReminder.type === REMINDER_TYPE.ROUTINE) {
        newReminder.completionCount = Number.isInteger(existingReminder?.completionCount) ? existingReminder.completionCount : 0;
      }
    } else {
      newReminder.completedAt = null;
      if (newReminder.type === REMINDER_TYPE.ROUTINE) newReminder.completionCount = 0;
    }

    if (editingId) {
      updateReminders((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...newReminder } : r)));
      setEditingId(null);
    } else {
      updateReminders((prev) => [...prev, newReminder]);
      logReminderEvent("reminder_created", { reminder_type: newReminder.type });
    }

    // updateReminders sends only the changed reminder from this user action.

    setDraft(createBlankDraft());
    setIsComposerOpen(false); // บันทึกเสร็จแล้วพับ composer กลับ คืนพื้นที่ให้ list
  };

  const deleteReminder = (reminderId) => {
    updateReminders((prev) => prev.filter((r) => r.id !== reminderId));
  };

  const deleteEditingReminder = () => {
    if (!editingId) return;
    const reminder = reminders.find((item) => item.id === editingId);
    if (!window.confirm(`ลบ reminder “${reminder?.title || "รายการนี้"}” ใช่หรือไม่?`)) return;
    deleteReminder(editingId);
    cancelEditing();
  };

  const startEdit = (reminder) => {
    setIsComposerOpen(true); // แก้ไข reminder ต้องเปิด composer ให้เห็นฟอร์มด้วย
    setEditingId(reminder.id);
    setDraft({
      title: reminder.title,
      type: reminder.type,
      amount: String(reminder.amount || 30),
      unit: reminder.unit || "minutes",
      runAllDay: !hasWindow(reminder),
      windowStart: reminder.windowStart || "",
      windowEnd: reminder.windowEnd || "",
      atTime: reminder.atMs ? new Date(reminder.atMs).toTimeString().slice(0, 5) : "",
      atDate: reminder.atMs ? toLocalDateInputValue(reminder.atMs) : "",
      countdownMinutes: reminder.durationMs ? String(reminder.durationMs / 60000) : "20",
      days: reminder.days || [1, 3, 5],
      time: reminder.time || "08:00",
      times: reminder.times?.length ? reminder.times : [reminder.time || "08:00"],
      eventName: reminder.eventName || "",
      afterAmount: String(reminder.afterAmount || 2),
      afterUnit: reminder.afterUnit || "hours",
      routineSteps: reminder.steps ? reminder.steps.join(", ") : "แปรงฟัน, ยืดตัว, กินวิตามิน",
      lineColor: reminder.lineColor || DEFAULT_LINE_COLOR,
      groupId: reminder.groupId ?? null
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraft(createBlankDraft());
    setIsComposerOpen(false); // ยกเลิกแล้วพับ composer กลับ
  };

  const toggleComposer = () => {
    if (isComposerOpen) {
      // กำลังเปิดอยู่แล้วกดปุ่มซ้ำ = ปิด และล้าง draft/สถานะแก้ไขทิ้งไปด้วย
      cancelEditing();
    } else {
      // เปิด composer สำหรับสร้างใหม่ (ไม่ใช่แก้ไข — กรณีแก้ไขเรียก
      // setIsComposerOpen(true) เองแยกต่างหากพร้อม draft ของ reminder เดิม
      // อยู่แล้ว ดู startEditingReminder) — รีเฟรช atDate/atTime ให้เป็นวัน/
      // เวลาจริง ณ ตอนนี้เสมอ ไม่ใช่ค่าที่ค้างมาจากตอนหน้าเว็บโหลดครั้งแรก
      // (ถ้าเปิดหน้าทิ้งไว้นานแล้วเพิ่งมาเปิด composer เวลาที่ค้างอยู่จะ
      // เพี้ยนจากเวลาปัจจุบันจริง)
      setDraft((prev) => {
        const now = new Date();
        return { ...prev, atTime: now.toTimeString().slice(0, 5), atDate: toLocalDateInputValue(now.getTime()) };
      });
      setIsComposerOpen(true);
    }
  };


  return { toggleDayInDraft, submitReminderForm, deleteReminder, deleteEditingReminder, startEdit, cancelEditing, toggleComposer };
}
