import { useEffect, useRef, useState } from "react";
import { REMINDER_TYPE, computeNextDueAt, isReminderDue, isOneShotType, hasEventAnchorSession, advanceEventAnchorSchedule, eventAnchorNotificationLabel, eventAnchorNotificationTitle } from "../lib/reminder-due-logic.js";
import { intervalScheduleMinutes } from "../lib/interval-schedule.js";
import { localDateKey } from "../lib/reminder-date-view.js";
import { logReminderEvent } from "../lib/reminder-telemetry.js";
import { sendTelegramReminder } from "../../notifications/telegram/api.js";
import { areTelegramNotificationsEnabled } from "../../notifications/telegram/telegram-notification-preferences.js";

// Interval stays intentionally outside the normal due-banner/checklist flow.
// This helper only identifies the current visual interval slot so the open
// Reminder Mode can send one Telegram message when that slot changes.
function getIntervalTelegramSlot(reminder, nowMs) {
  if (!reminder.enabled || reminder.completedAt || reminder.type !== REMINDER_TYPE.INTERVAL) return null;
  const now = new Date(nowMs);
  const minute = now.getHours() * 60 + now.getMinutes();
  const slots = intervalScheduleMinutes(reminder);
  const scheduleSignature = `${reminder.amount}:${reminder.unit}:${reminder.windowStart || "all-day"}:${reminder.windowEnd || "all-day"}`;
  const active = slots.includes(minute);
  return { active, scheduleSignature, slotKey: active ? `${scheduleSignature}:${localDateKey(now)}:${minute}` : "idle" };
}


/** Owns the mounted Reminder view's clock, due state, delivery and due actions.
 * Scheduling rules remain in the shared reminder-due-logic module.
 */
export function useDueReminders({ reminders, setReminders, updateReminders, firebaseUser, recordStatsEvent }) {
  const [dueReminders, setDueReminders] = useState([]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const sentTelegramReminderKeysRef = useRef(new Set());
  const intervalTelegramSlotRef = useRef(new Map());
  const autoAdvancedBufferKeysRef = useRef(new Set());

  useEffect(() => {
    // Repair stale weekly nextDueAt values after a schedule was edited or a
    // remote mirror returned an older date. A deliberate snooze is runtime
    // state and is allowed to land on a day outside the weekly selection.
    setReminders((previous) => {
      let changed = false;
      const next = previous.map((reminder) => {
        if (
          reminder.type !== REMINDER_TYPE.WEEKLY ||
          !reminder.enabled ||
          reminder.snoozedUntil === reminder.nextDueAt ||
          !Number.isFinite(reminder.nextDueAt) ||
          reminder.days?.includes(new Date(reminder.nextDueAt).getDay())
        ) return reminder;
        changed = true;
        return { ...reminder, nextDueAt: computeNextDueAt(reminder, Date.now()) };
      });
      return changed ? next : previous;
    });
  }, [reminders, setReminders]);

  useEffect(() => {
    const checkDue = () => {
      const now = Date.now();
      setNowTick(now); // อัปเดตเวลา "ตอนนี้" ทุกวินาที ให้ countdown บนการ์ด tick แบบ live
      // migration plan v2 เฟส 5 — ใช้ isReminderDue() จาก ../reminder-due-logic.js
      // แทนการเขียนเงื่อนไข filter เองตรงนี้ (เดิมเฟส 4 เขียนไว้ตรงนี้) เพื่อ
      // ให้เงื่อนไข "ถึงกำหนดหรือยัง" มีจุดเดียวที่ Cloud Function (เฟส 5)
      // เรียกใช้ตรงกันได้เป๊ะๆ ในอนาคต ไม่ต้องคัดลอกเงื่อนไข if ซ้ำอีกที่
      const due = reminders.filter((r) => isReminderDue(r, now));
      setDueReminders(due);
      // Persist the primary instant once, even if the user leaves the due
      // banner open. That is the hand-off point from the main reminder to a
      // derived Stopwatch; it is not an additional due notification.
      const anchorStarts = due.filter((reminder) => hasEventAnchorSession(reminder) && reminder.eventAnchorNotificationPhase === "main" && reminder.eventAnchorStartedAt !== reminder.eventAnchorPrimaryDueAt);
      if (anchorStarts.length) {
        const byId = new Map(anchorStarts.map((reminder) => [reminder.id, reminder.eventAnchorPrimaryDueAt]));
        updateReminders((previous) => previous.map((reminder) => (
          byId.get(reminder.id) === reminder.eventAnchorPrimaryDueAt
            ? { ...reminder, eventAnchorStartedAt: reminder.eventAnchorPrimaryDueAt }
            : reminder
        )));
      }
      // ไม่มี scheduler: ส่งได้เฉพาะเมื่อหน้า Reminder Mode เปิดอยู่เท่านั้น.
      // ใช้ due timestamp เป็น key เพื่อกัน tick ทุกวินาทีส่งข้อความซ้ำ.
      due.forEach((reminder) => {
        const key = `${reminder.id}:${reminder.nextDueAt || reminder.atMs || reminder.startedAt || 0}`;
        if (!areTelegramNotificationsEnabled(firebaseUser?.uid) || sentTelegramReminderKeysRef.current.has(key)) return;
        sentTelegramReminderKeysRef.current.add(key);
        sendTelegramReminder(`${eventAnchorNotificationLabel(reminder)} · ${eventAnchorNotificationTitle(reminder)}`, "reminder", key).catch(() => {
          // ยังไม่เชื่อม Telegram/เน็ตขัดข้อง ไม่ควรรบกวน reminder UI หลัก.
        });
      });
      // Buffer phases are automatic: they notify, then immediately move to
      // the next phase. They never wait in the due banner for completion.
      const automaticBufferPhases = due.filter((reminder) => (
        reminder.eventAnchorNotificationPhase === "countdown" ||
        reminder.eventAnchorNotificationPhase === "stopwatch"
      ));
      if (automaticBufferPhases.length) {
        const keys = automaticBufferPhases.map((reminder) => `${reminder.id}:${reminder.eventAnchorNotificationPhase}:${reminder.nextDueAt}`);
        const fresh = automaticBufferPhases.filter((_, index) => !autoAdvancedBufferKeysRef.current.has(keys[index]));
        keys.forEach((key) => autoAdvancedBufferKeysRef.current.add(key));
        if (fresh.length) {
          const phasesById = new Map(fresh.map((reminder) => [reminder.id, `${reminder.eventAnchorNotificationPhase}:${reminder.nextDueAt}`]));
          updateReminders((previous) => previous.map((reminder) => (
            phasesById.get(reminder.id) === `${reminder.eventAnchorNotificationPhase}:${reminder.nextDueAt}`
              ? { ...reminder, ...advanceEventAnchorSchedule(reminder, now) }
              : reminder
          )));
        }
      }

      // Interval is deliberately Telegram-only: it does not join `due`, so
      // it never produces a due banner, browser notification, completion
      // checklist, or server-side schedule. Seed its current slot on mount to
      // avoid sending a stale alert merely because the user opened the page
      // halfway through an already-running interval.
      const activeIntervalIds = new Set();
      reminders.forEach((reminder) => {
        const slot = getIntervalTelegramSlot(reminder, now);
        if (!slot) return;
        activeIntervalIds.add(reminder.id);
        const previousSlot = intervalTelegramSlotRef.current.get(reminder.id);
        if (!previousSlot || previousSlot.scheduleSignature !== slot.scheduleSignature) {
          intervalTelegramSlotRef.current.set(reminder.id, slot);
          return;
        }
        if (!areTelegramNotificationsEnabled(firebaseUser?.uid) || previousSlot.slotKey === slot.slotKey) return;
        intervalTelegramSlotRef.current.set(reminder.id, slot);
        if (!slot.active) return;
        sendTelegramReminder(reminder.title, "interval", `interval:${reminder.id}:${slot.slotKey}`).catch(() => {
          // Telegram is optional; an unavailable bot must not alter the
          // interval schedule or interrupt the timeline.
        });
      });
      for (const reminderId of intervalTelegramSlotRef.current.keys()) {
        if (!activeIntervalIds.has(reminderId)) intervalTelegramSlotRef.current.delete(reminderId);
      }
    };

    checkDue();
    const interval = setInterval(checkDue, 1000);
    return () => clearInterval(interval);
  }, [reminders, firebaseUser?.uid]);


  /**
   * @param {string} reminderId
   * @param {number} [snoozeMinutes] ถ้าระบุ — เลื่อน nextDueAt ไปตามจำนวน
   *   นาทีนี้ตรงๆ (snooze แบบกำหนดเวลาเอง, migration plan v2 เฟส 1.3) แทน
   *   การคำนวณรอบถัดไปตาม logic ปกติของ type นั้นๆ — ใช้ได้แม้กับ one-shot
   *   type (เดิมจะปิด enabled ไปเลยถ้าไม่ระบุ snoozeMinutes) เพราะ "เลื่อน
   *   เตือนภายหลัง" ควรคงเปิดอยู่ต่อไม่ว่า type ไหน ไม่แก้ schedule fields
   *   เดิม (เช่น interval ไม่ขยับ amount/unit) แค่เขียนทับ nextDueAt ครั้งเดียว
   */
  const scheduleNext = (reminderId, snoozeMinutes) => {
    // จับ "ตอนกดปุ่ม" เพียงครั้งเดียวก่อนเข้าตัว state updater เพื่อให้
    // nextDueAt เป็น now + นาทีที่ผู้ใช้เลือกจริง ๆ ไม่ขึ้นกับจังหวะ React
    // เรียก updater ซ้ำในโหมด development.
    const snoozedUntil = typeof snoozeMinutes === "number"
      ? Date.now() + snoozeMinutes * 60 * 1000
      : null;
    updateReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;
        if (typeof snoozeMinutes === "number") {
          logReminderEvent("reminder_snoozed", { reminder_type: r.type, snooze_minutes: snoozeMinutes });
          recordStatsEvent("snoozed", { title: r.title, reminderType: r.type, minutes: snoozeMinutes });
          return { ...r, enabled: true, nextDueAt: snoozedUntil, snoozedUntil };
        }
        if (hasEventAnchorSession(r)) return { ...r, ...advanceEventAnchorSchedule(r, Date.now()) };
        const eventAnchorStartedAt = r.eventAnchorStartedAt;
        if (isOneShotType(r.type)) return { ...r, eventAnchorStartedAt, enabled: false, nextDueAt: Infinity };
        return { ...r, eventAnchorStartedAt, snoozedUntil: null, nextDueAt: computeNextDueAt(r, Date.now()) };
      })
    );
  };

  /**
   * "ทำเสร็จแล้ว" บน due-banner (migration plan v2 เฟส 4) — เรียกได้เฉพาะ
   * type ที่ปรากฏใน dueReminders เท่านั้น (interval/weekly/event-anchored/
   * once-at/countdown — checkDue() กรอง routine/stopwatch ออกไปแต่ต้นอยู่
   * แล้ว ทั้งสอง type นี้จึงไม่มีทางถูกเรียกฟังก์ชันนี้ผ่าน due-banner):
   *   - one-shot (once-at/countdown): completedAt = ตอนนี้, ปิด enabled,
   *     เข้า tab "ทำเสร็จแล้ว" ถาวร — แยกจาก scheduleNext ตรงที่ scheduleNext
   *     ไม่เคยเซ็ต completedAt เลย (ปิดเฉยๆ ไม่นับว่า "ทำเสร็จ" อย่างเป็น
   *     ทางการ ผู้ใช้อาจแค่ปิดเพราะเปลี่ยนใจ ไม่ใช่ทำสำเร็จ)
   *   - ประเภทวนซ้ำ (interval/weekly/event-anchored): "ทำเสร็จแล้ว" หมายถึง
   *     จบรอบนี้แล้วเข้ารอบถัดไปทันที ไม่ค้างอยู่ tab ทำเสร็จแล้วถาวร —
   *     completedAt จึงยังเป็น null เสมอสำหรับกลุ่มนี้ พฤติกรรมเดียวกับ
   *     scheduleNext(id) แบบไม่ระบุ snooze
   */
  const markCompleted = (reminderId) => {
    updateReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;
        if (hasEventAnchorSession(r)) return { ...r, ...advanceEventAnchorSchedule(r, Date.now()), snoozedUntil: null };
        const eventAnchorStartedAt = r.eventAnchorStartedAt;
        if (isOneShotType(r.type)) {
          logReminderEvent("reminder_completed", { reminder_type: r.type });
          recordStatsEvent("completed", { title: r.title, reminderType: r.type });
          return { ...r, eventAnchorStartedAt, completedAt: Date.now(), enabled: false, nextDueAt: Infinity, snoozedUntil: null };
        }
        logReminderEvent("reminder_completed", { reminder_type: r.type });
        recordStatsEvent("completed", { title: r.title, reminderType: r.type });
        return { ...r, eventAnchorStartedAt, snoozedUntil: null, nextDueAt: computeNextDueAt(r, Date.now()) };
      })
    );
  };


  return { dueReminders, nowTick, scheduleNext, markCompleted };
}
