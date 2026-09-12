import { getIntervalWorkSummary, intervalScheduleMinutes } from "../lib/interval-schedule.js";
import React, { useMemo } from "react";
import { useReminderMenus } from "../hooks/use-reminder-menus.js";
import { useDueReminders } from "../hooks/use-due-reminders.js";
import { useReminderComposerState } from "../hooks/use-reminder-composer-state.js";
import { useReminderComposerActions } from "../hooks/use-reminder-composer-actions.js";
import { createPortal } from "react-dom";
import { useReminderGroups } from "../hooks/use-reminder-groups.js";
import { usePushNotifications } from "../../notifications/push/hooks/use-push-notifications.js";
import { useReminderStore } from "../hooks/use-reminder-store.js";
import { useTelegramConnection } from "../hooks/use-telegram-connection.js";
import { useReminderStats } from "../hooks/use-reminder-stats.js";
import { useActivityContextMenu } from "../hooks/use-activity-context-menu.js";
import { logReminderEvent } from "../lib/reminder-telemetry.js";
import { useReminderOmnibar } from "../hooks/use-reminder-omnibar.js";
import { useReminderFilters } from "../hooks/use-reminder-filters.js";
import ReminderSidebar from "./reminder-sidebar.jsx";
import ReminderStatsPanel from "./reminder-stats-panel.jsx";
import ActivityPopup from "../../activity/components/activity-popup.jsx";
import AutoShrinkText from "../../../shared/ui/auto-shrink-text.jsx";
import { activityDate } from "../../../shared/lib/date-utils.js";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import { useLanguage } from "../../../shared/i18n/i18n.jsx";
import { reminderSlotsOnDate, localDateKey } from "../lib/reminder-date-view.js";
import { useReminderExport } from "../hooks/use-reminder-export.js";
import { useReminderTimeline, ROW_HEIGHT_PX, ZOOM_LEVELS_MINUTES } from "../hooks/use-reminder-timeline.js";
import "../styles/reminder-material.css";
import "../styles/reminder-mode.css";
import {
  REMINDER_TYPE,
  isOneShotType,
  intervalMs,
  hasWindow,
  minuteOfDayAt,
  minutesFromHHMM,
  isMinuteWithinWindow,
  computeNextDueAt
} from "../lib/reminder-due-logic.js";

const STORAGE_KEY = "times-reminders-v1";

// ฟิลด์วัน/เวลาที่ sync ขึ้น Firebase — ต้องตรงกับ ALLOWED_FIELDS ใน
// backend/routes/reminders.js เป๊ะๆ (ฝั่ง backend มี allow-list ของตัวเอง
// อยู่แล้ว ตัดฟิลด์ที่ไม่อยู่ในนี้ทิ้งเงียบๆ — รายการนี้ฝั่ง frontend มีไว้
// เพื่อความชัดเจนตอนอ่านโค้ด ไม่ใช่ security boundary จริง) ไม่รวม runtime
// field เช่น startedAt/accumulatedMs/currentIndex/lastTriggeredAt — ยกเว้น
// completedAt/completionCount ของ routine ซึ่ง sync เพื่อเก็บประวัติการทำครบ
// (เพิ่มเข้ามาเฟส 4) — nextDueAt เป็นข้อยกเว้นในเฟส 5 เพราะ scheduler
// ฝั่ง Cloud Function ต้องอ่านมันได้แม้ผู้ใช้ปิดแท็บอยู่
const SCHEDULE_FIELD_KEYS = [
  "type", "title", "enabled", "amount", "unit", "windowStart", "windowEnd",
  "days", "time", "times", "atMs", "afterAmount", "afterUnit", "durationMs",
  "lineColor", "eventName", "steps",
  // migration plan v2 เฟส 3 — groupId ผูก reminder เข้ากับกลุ่ม/โปรเจกต์
  // (one-to-one, null = ไม่มีกลุ่ม) ต้องส่งค่า null อย่างชัดเจนเสมอ (ไม่ใช่
  // undefined) เมื่อไม่มีกลุ่ม เพื่อให้ extractScheduleFields ด้านล่างส่ง
  // ค่านี้ขึ้น backend ทุกครั้ง — มิฉะนั้นตอนผู้ใช้เอา reminder ออกจากกลุ่ม
  // (groupId: null) การ sync จะไม่ส่งฟิลด์นี้ไปเลย (เพราะ !== undefined
  // เช็คไม่ผ่าน) ทำให้ backend ไม่รู้ว่าต้องเคลียร์ค่าเดิมทิ้ง
  "groupId",
  // 1:1 link กับ Google Calendar activity; Activity เป็นเจ้าของ title/เวลา
  // ร่วม ส่วน reminder เก็บกติกาการแจ้งเตือนของตัวเอง
  "activityId",
  "nextDueAt",
  // การ Snooze เป็นข้อยกเว้นชั่วคราวของตารางปกติ (โดยเฉพาะ weekly ที่
  // อาจเลื่อนข้ามวันได้) จึงต้อง mirror คู่กับ nextDueAt ด้วย มิฉะนั้น
  // ตอน reload/merge จาก Firebase ตัวตรวจ weekly จะเข้าใจผิดว่าเป็นค่า
  // ค้างและเขียน nextDueAt กลับเป็นรอบปกติ
  "snoozedUntil"
];

function extractScheduleFields(reminder) {
  const fields = {};
  for (const key of SCHEDULE_FIELD_KEYS) {
    if (reminder[key] !== undefined) {
      // Firestore ไม่ควรเก็บ Infinity: มันไม่มีความหมายว่า "ครบกำหนด" และ
      // query <= now จะไม่ต้องพบมันอยู่แล้ว ใช้ null แทนสถานะไม่มี due-date
      // (event ที่ยังไม่ trigger, routine, stopwatch, one-shot ที่จบแล้ว)
      fields[key] = key === "nextDueAt" && !Number.isFinite(reminder[key]) ? null : reminder[key];
    }
  }
  // เก็บสถานะและจำนวนครั้งเฉพาะ Checklist/Routine เพื่อรองรับข้ามอุปกรณ์.
  if (reminder.type === REMINDER_TYPE.ROUTINE) {
    fields.completedAt = reminder.completedAt ?? null;
    fields.completionCount = Number.isInteger(reminder.completionCount)
      ? reminder.completionCount
      : 0;
  }
  return fields;
}



// ค่า tab เฉพาะสำหรับรายการ Reminder — ตั้งชื่อตามสถานะที่กรองจริง ไม่ใช้
// string "active" กว้าง ๆ เพื่อให้อ่าน handler และปุ่มแต่ละตัวได้ตรงกัน.
const REMINDER_STATUS_TAB = Object.freeze({
  ENABLED: "enabled",
  PAUSED: "paused",
  COMPLETED: "completed"
});

// REMINDER_TYPE ย้ายไป ../reminder-due-logic.js แล้ว (migration plan v2
// เฟส 5, import ไว้ด้านบนของไฟล์) — ดูคอมเมนต์ในไฟล์นั้นสำหรับเหตุผล

// สีประจำแต่ละประเภท reminder — ใช้เป็น border-left accent ของการ์ด +
// พื้นหลัง icon กล่อง (ตาม reminder-dashboard-mockup.jsx, migration plan v2
// เฟส 1.4) อ้างอิงตัวแปร CSS --g-* ที่มีอยู่แล้วในไฟล์นี้ (ไม่ผูกกับสถานะ
// enabled/disabled ของ reminder — นั่นยังคงสื่อผ่าน .reminder-card.active
// เดิมที่คุม background/border ทั้งใบแยกต่างหาก) --g-purple/--g-teal เป็น
// ตัวแปรใหม่ที่เพิ่มเข้ามาคู่กับ map นี้ (ดู reminder-mode.css) ใช้ hex
// เดียวกับ "ม่วง"/"ฟ้าอมเขียว" ใน LINE_COLOR_OPTIONS เพื่อไม่เพิ่มโทนสีใหม่
// เข้ามาในระบบโดยไม่จำเป็น
const TYPE_ACCENT_COLOR = {
  [REMINDER_TYPE.INTERVAL]: "var(--g-blue)",
  [REMINDER_TYPE.WEEKLY]: "var(--g-green)",
  [REMINDER_TYPE.EVENT_ANCHORED]: "var(--g-purple)",
  [REMINDER_TYPE.ROUTINE]: "var(--g-teal)",
  [REMINDER_TYPE.ONCE_AT]: "var(--g-red)",
  [REMINDER_TYPE.COUNTDOWN]: "var(--g-yellow)",
  [REMINDER_TYPE.STOPWATCH]: "var(--g-on-surface-variant)"
};

/** ตัวอักษร/สีตัวอักษรของ icon กล่องต่อประเภท — เหลือง (countdown) ใช้ตัวอักษรเข้มเพื่อ contrast ที่พอเหมาะ ประเภทอื่นใช้ขาว */
function getTypeIconTextColor(type) {
  return type === REMINDER_TYPE.COUNTDOWN ? "#202124" : "#fff";
}

// ตัวเลือก snooze บน due-banner (migration plan v2 เฟส 1.3)
const SNOOZE_OPTIONS_MINUTES = [5, 10, 15, 30];

// ตัวเลือกตัวกรองประเภทใน left nav (migration plan v2 เฟส 2) — module-level
// เพื่อให้ใช้ label เดียวกันได้ทั้งใน nav list และหัวข้อ toolbar เมื่อกรองอยู่
// ไม่ต้อง duplicate ข้อความ
const TYPE_FILTER_OPTIONS = [
  { type: REMINDER_TYPE.INTERVAL, labelKey: "reminder.type.interval" },
  { type: REMINDER_TYPE.WEEKLY, labelKey: "reminder.type.weekly" },
  { type: REMINDER_TYPE.EVENT_ANCHORED, labelKey: "reminder.type.event-anchored" },
  { type: REMINDER_TYPE.ROUTINE, labelKey: "reminder.type.routine" },
  { type: REMINDER_TYPE.ONCE_AT, labelKey: "reminder.type.once-at" },
  { type: REMINDER_TYPE.COUNTDOWN, labelKey: "reminder.type.countdown" },
  { type: REMINDER_TYPE.STOPWATCH, labelKey: "reminder.type.stopwatch" }
];

const DAYS_OF_WEEK = [
  { labelKey: "reminder.day.sun", value: 0 },
  { labelKey: "reminder.day.mon", value: 1 },
  { labelKey: "reminder.day.tue", value: 2 },
  { labelKey: "reminder.day.wed", value: 3 },
  { labelKey: "reminder.day.thu", value: 4 },
  { labelKey: "reminder.day.fri", value: 5 },
  { labelKey: "reminder.day.sat", value: 6 }
];

// ตัวเลือกสีเส้นสำหรับ Timer/Stopwatch ที่กำลังทำงาน (ผู้ใช้เลือกได้ตอนสร้าง/แก้ไข)
// เผื่อสีให้เลือกได้หลากหลายครอบคลุมทุกโทนสี (ยังเลือกสีอิสระเพิ่มเติมได้จาก color picker ในฟอร์ม)
const LINE_COLOR_OPTIONS = [
  { label: "เหลือง", value: "#fbbc04" },
  { label: "เหลืองทอง", value: "#f9ab00" },
  { label: "ส้ม", value: "#ff8c42" },
  { label: "ส้มเข้ม", value: "#e8710a" },
  { label: "แดง", value: "#ea4335" },
  { label: "แดงเข้ม", value: "#c5221f" },
  { label: "ชมพู", value: "#e91e63" },
  { label: "ชมพูอ่อน", value: "#f06292" },
  { label: "ม่วง", value: "#a142f4" },
  { label: "ม่วงเข้ม", value: "#7627bb" },
  { label: "น้ำเงิน", value: "#4285f4" },
  { label: "น้ำเงินเข้ม", value: "#1a73e8" },
  { label: "ฟ้าอมเขียว", value: "#00bcd4" },
  { label: "เขียว", value: "#34a853" },
  { label: "เขียวสด", value: "#7cb342" },
  { label: "น้ำตาล", value: "#8d6e63" },
  { label: "เทา", value: "#78909c" },
  { label: "ดำ", value: "#3c4043" }
];
const DEFAULT_LINE_COLOR = LINE_COLOR_OPTIONS[0].value;

// Palette สำหรับกลุ่ม/โปรเจกต์ (migration plan v2 เฟส 3) — สุ่ม/วนสีให้
// อัตโนมัติตอนสร้างกลุ่มใหม่แทนที่จะให้ผู้ใช้เลือกเอง (ลดขั้นตอนเหลือแค่
// พิมพ์ชื่อ + Enter) หยิบมาจาก LINE_COLOR_OPTIONS ชุดย่อยที่แยกสีกันชัดเจน
// ไม่ใช้ทั้ง 18 สีเพราะบางคู่ใกล้กันเกินไปสำหรับ list สั้นๆ แบบนี้


// isOneShotType ย้ายไป ../reminder-due-logic.js แล้ว (migration plan v2 เฟส 5)

// แปลง timestamp เป็น "YYYY-MM-DD" ตามเวลาท้องถิ่นของเครื่อง (ไม่ใช้ toISOString() เพราะแปลงเป็น UTC
// ทำให้วันที่เพี้ยนได้เมื่อเวลาใกล้เที่ยงคืนในโซนเวลาที่ต่างจาก UTC เช่น ไทย +7)
function toLocalDateInputValue(ms) {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * ค่าเริ่มต้นของ draft สำหรับ composer ตอนยังไม่ได้แก้ไข reminder ใดอยู่
 * (สร้างใหม่/ล้างฟอร์มหลังบันทึก/ยกเลิกแก้ไข) — รวมไว้ที่ฟังก์ชันเดียวแทนที่
 * จะก็อปปี้ object literal ซ้ำ 3 จุด (initial useState, submitReminderForm's
 * reset, cancelEditing) เพื่อไม่ให้จุดใดจุดหนึ่งลืมอัปเดตตามถ้าค่าเริ่มต้น
 * เปลี่ยนในอนาคต
 *
 * atDate/atTime (ใช้กับ ONCE_AT) ตั้งเป็นวันที่/เวลาปัจจุบันของเครื่องเสมอ
 * แทนที่จะปล่อยว่าง — ผู้ใช้ที่จะตั้งเตือนแบบ "ครั้งเดียว" ส่วนใหญ่ตั้งเวลา
 * ใกล้ๆ ตอนนี้อยู่แล้ว (เช่น อีก 20 นาที) การมีวันที่/เวลาปัจจุบันโชว์ไว้ก่อน
 * ให้แค่ปรับเวลาต่อจากนั้นเร็วกว่าต้องเปิด date/time picker มาเลือกเองทั้งหมด
 * ตั้งใจคำนวณใหม่ทุกครั้งที่เรียกฟังก์ชันนี้ (ไม่ใช่ค่าคงที่ตอน module
 * โหลด) เพื่อให้ตรงกับเวลาจริง ณ ตอนเปิด/ล้างฟอร์มเสมอ ไม่ใช่เวลาที่หน้าเว็บ
 * ถูกโหลดครั้งแรก
 */
function createBlankDraft() {
  const now = new Date();
  return {
    title: "",
    type: REMINDER_TYPE.INTERVAL,
    amount: "30",
    unit: "minutes",
    // true = ไม่มีช่วงพัก, interval ทำงาน 24 ชั่วโมง; เก็บช่วงเวลาไว้
    // เฉพาะเมื่อผู้ใช้ปิดตัวเลือกนี้เท่านั้น
    runAllDay: true,
    windowStart: "",
    windowEnd: "",
    atTime: now.toTimeString().slice(0, 5),
    atDate: toLocalDateInputValue(now.getTime()),
    countdownMinutes: "20",
    days: [1, 3, 5],
    time: "08:00",
    times: ["08:00"],
    eventName: "",
    afterAmount: "2",
    afterUnit: "hours",
    routineSteps: "แปรงฟัน, ยืดตัว, กินวิตามิน",
    lineColor: DEFAULT_LINE_COLOR,
    groupId: null // migration plan v2 เฟส 3
  };
}

const DEFAULT_REMINDERS = [
  { id: "water", type: REMINDER_TYPE.INTERVAL, title: "ดื่มน้ำ", amount: 30, unit: "minutes", enabled: true },
  { id: "stretch", type: REMINDER_TYPE.INTERVAL, title: "ยืดตัว 30 วินาที", amount: 60, unit: "minutes", enabled: true },
  { id: "eyes", type: REMINDER_TYPE.INTERVAL, title: "พักสายตา มองไกล 20 ฟุต", amount: 20, unit: "minutes", enabled: true }
];

// intervalMs ย้ายไป ../reminder-due-logic.js แล้ว (migration plan v2 เฟส 5)

function intervalLabel(reminder) {
  const unit = reminder.unit === "hours" ? "ชั่วโมง" : "นาที";
  const base = `ทุก ${reminder.amount} ${unit}`;
  return hasWindow(reminder) ? `${base} (${reminder.windowStart}-${reminder.windowEnd})` : base;
}

// hasWindow ย้ายไป ../reminder-due-logic.js แล้ว (migration plan v2 เฟส 5)

// จัดรูปแบบวินาทีทั้งหมดเป็น "mm:ss" หรือ "h:mm:ss" ถ้าเกิน 1 ชั่วโมง ใช้ร่วมกันทั้ง stopwatch และ countdown
function formatDurationClock(totalSeconds) {
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  if (hh > 0) {
    return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function formatDigitalClock(timestamp) {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

// minuteOfDayAt/minutesFromHHMM/isMinuteWithinWindow/snapToNextWindowStart/
// computeNextDueAt ทั้งหมดย้ายไป ../reminder-due-logic.js แล้ว (migration
// plan v2 เฟส 5, import ไว้ด้านบนของไฟล์) — เป็น prerequisite ของ FCM
// scheduler ฝั่ง Cloud Function ที่ต้องคำนวณ due-date ตรงกับ client เป๊ะๆ
// ดูคอมเมนต์ท้ายไฟล์นั้นสำหรับรายละเอียด

function describeReminder(reminder, nowMs) {
  // While snoozed, the temporary due time is the active schedule. Showing
  // the normal weekly/interval description here made it look as though the
  // countdown still started from the old scheduled time.
  if (reminder.snoozedUntil === reminder.nextDueAt && Number.isFinite(reminder.snoozedUntil)) {
    const remainingMs = reminder.snoozedUntil - (nowMs ?? Date.now());
    if (remainingMs > 0) return `เลื่อนเตือน · เหลือ ${formatDurationClock(Math.ceil(remainingMs / 1000))}`;
  }
  switch (reminder.type) {
    case REMINDER_TYPE.WEEKLY: {
      return `วนสัปดาห์ · เวลา ${reminder.time}`;
    }
    case REMINDER_TYPE.EVENT_ANCHORED: {
      const unit = reminder.afterUnit === "hours" ? "ชม." : "นาที";
      return `เหตุการณ์ · +${reminder.afterAmount} ${unit} หลัง "${reminder.eventName}"`;
    }
    case REMINDER_TYPE.ROUTINE: {
      const total = reminder.steps?.length || 0;
      const current = (reminder.currentIndex || 0) + 1;
      const stepName = reminder.steps?.[reminder.currentIndex] || "เสร็จสิ้นแล้ว";
      return `Routine (${current}/${total}) · ถัดไป: ${stepName}`;
    }
    case REMINDER_TYPE.ONCE_AT: {
      const d = new Date(reminder.atMs);
      const dateLabel = d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
      const timeLabel = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return `ครั้งเดียว · ${dateLabel} ${timeLabel}`;
    }
    case REMINDER_TYPE.COUNTDOWN: {
      if (!reminder.enabled || reminder.completedAt || !reminder.startedAt) {
        const mins = Math.round(reminder.durationMs / 60000);
        return `นับถอยหลัง · ตั้งไว้ ${mins} นาที`;
      }
      const endMs = reminder.startedAt + reminder.durationMs;
      const remainingMs = endMs - (nowMs ?? Date.now());
      if (remainingMs <= 0) return "นับถอยหลัง · ถึงเวลาแล้ว";
      const totalSeconds = Math.ceil(remainingMs / 1000);
      return `นับถอยหลัง · เหลือ ${formatDurationClock(totalSeconds)}`;
    }
    case REMINDER_TYPE.STOPWATCH: {
      if (!reminder.enabled || !reminder.startedAt) {
        // หยุดอยู่: โชว์เวลาที่สะสมไว้ล่าสุด (accumulatedMs) ถ้ามี ไม่งั้นแสดง 0
        const totalSeconds = Math.floor((reminder.accumulatedMs || 0) / 1000);
        return `จับเวลา · หยุดที่ ${formatDurationClock(totalSeconds)}`;
      }
      // กำลังทำงาน: เวลาที่ผ่านไป = เวลาที่สะสมไว้ก่อนหน้า + เวลาตั้งแต่ startedAt ล่าสุดจนถึงตอนนี้
      const elapsedMs = (reminder.accumulatedMs || 0) + ((nowMs ?? Date.now()) - reminder.startedAt);
      const totalSeconds = Math.floor(elapsedMs / 1000);
      return `จับเวลา · ${formatDurationClock(totalSeconds)}`;
    }
    case REMINDER_TYPE.INTERVAL:
    default:
      return intervalLabel(reminder);
  }
}

// คืนค่ารายการ "นาทีของวัน" (0-1439) ที่ reminder ประเภทนี้ควรถูกปักหมุดแสดงบน timeline
// ใช้แสดงผลบน timeline โดยไม่สนใจว่า enabled/nextDueAt ถึงกำหนดหรือยัง (โชว์ทุกประเภทเสมอเวลาเลื่อนดู)
// - INTERVAL: ปักซ้ำทุก ๆ N นาที (จำกัดในช่วง window ถ้ามีกำหนด)
// - WEEKLY: ปักทุกเวลาที่ตั้งไว้ของวันนั้น
// - ONCE_AT: ปักที่เวลาของวันนั้น เฉพาะกรณีเป็นวันเดียวกับวันนี้ (เพราะเป็น timeline วันเดียว)
// - COUNTDOWN: ปักที่เวลาสิ้นสุดของการนับถอยหลัง (ถ้าอยู่ในวันเดียวกับวันนี้)
// - STOPWATCH: จับเวลาต่อเนื่องไม่มีเวลาตายตัว จึงไม่ปักหมุดตามเวลาเช่นกัน (เหมือน EVENT_ANCHORED/ROUTINE)
// - EVENT_ANCHORED / ROUTINE: ไม่มีเวลาตายตัวในแต่ละวัน (ขึ้นกับ event ภายนอก) จึงไม่ปักหมุดตามเวลา


// แยก component แถว timeline ออกมาต่างหากแล้วครอบด้วย React.memo พร้อม custom comparator
// เพราะ parent (ReminderDashboard) re-render ทุกวินาทีจาก nowTick (ให้ countdown/stopwatch tick แบบ live)
// ถ้าไม่แยก จะทำให้ React ต้อง reconcile แถวทั้งหมด (สูงสุด 1440 แถวที่ซูม 1 นาที/ช่อง) ทุกวินาทีโดยไม่จำเป็น ทำให้ scroll กระตุก
// เปรียบเทียบเฉพาะ tapeRows (reference จาก useMemo เปลี่ยนเมื่อ reminders/zoom เปลี่ยนจริง ๆ) ไม่สน nowTick ที่เปลี่ยนทุกวินาที
// ผลคือ tooltip (title) ของ event-chip อาจไม่ได้อัปเดตวินาทีต่อวินาที แต่แลกกับ scroll ที่ลื่นขึ้นมาก ซึ่งคุ้มกว่ามาก
const TimelineRows = React.memo(
  function TimelineRows({ tapeRows, nowTick, onEditReminder }) {
    return tapeRows.map(({ key, isMajor, label, flags }) => (
      <div key={key} className={`time-row${isMajor ? " major-hour" : ""}`} style={{ height: `${ROW_HEIGHT_PX}px`, "--row-height": `${ROW_HEIGHT_PX}px` }}>
        <span className="time-label">{label}</span>
        {flags.length > 0 && (
          <span className="event-chip-group">
            {flags.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`event-chip${r.enabled ? "" : " disabled"}`}
                title={`แก้ไข: ${r.title} · ${describeReminder(r, nowTick)}`}
                onClick={() => onEditReminder(r)}
              >
                <span className="chip-dot" />{r.title}
              </button>
            ))}
          </span>
        )}
      </div>
    ));
  },
  (prevProps, nextProps) => prevProps.tapeRows === nextProps.tapeRows
);

export default function ReminderDashboard({
  firebaseUser,
  activities = [],
  categories = [],
  activityCategoryMap = {},
  lockedActivities = {},
  onEditActivity,
  onToggleActivityLock,
  timelineColors
}) {
  const { t } = useLanguage();
  // Runtime reminder state belongs to a person, not to this browser. The
  // previous shared key exposed the prior account's reminders after logout.
  const userStorageKey = `${STORAGE_KEY}:${firebaseUser?.uid || "guest"}`;
  const { reminders, setReminders, updateReminders, getExportReminders, syncError } = useReminderStore({
    firebaseUser,
    storageKey: userStorageKey,
    defaultReminders: DEFAULT_REMINDERS,
    extractScheduleFields
  });
  const { groups, groupsError, addGroup, removeGroup } = useReminderGroups({ firebaseUser });
  const {
    isEnabled: isPushEnabled
  } = usePushNotifications({ firebaseUser });

  const { telegramConnection, areTelegramAlertsEnabled, handleTelegramAlertToggle } = useTelegramConnection(firebaseUser);
  const { activityContextMenu, openActivityContextMenu, closeActivityContextMenu } = useActivityContextMenu();
  const { reminderStats, recordStatsEvent, isStatsOpen, openStats, closeStats } = useReminderStats({ firebaseUser, reminders });
  const { dueReminders, nowTick, scheduleNext, markCompleted } = useDueReminders({
    reminders, setReminders, updateReminders, firebaseUser, recordStatsEvent
  });

  const { draft, setDraft, editingId, setEditingId, isComposerOpen, setIsComposerOpen, composerCardRef } = useReminderComposerState(createBlankDraft);
  const { omnibarEnabled, omnibarInput, setOmnibarInput, omnibarPreview, submitOmnibar } = useReminderOmnibar({
    setDraft, setEditingId, setIsComposerOpen, createBlankDraft,
    updateReminders, defaultLineColor: DEFAULT_LINE_COLOR
  });


  const composerPreview = useMemo(() => {
    const title = draft.title.trim() || "Reminder ใหม่";
    const typeLabel = t(TYPE_FILTER_OPTIONS.find((option) => option.type === draft.type)?.labelKey);
    const field = (label, value) => ({ label, value });
    // This is a schedule estimate, not the delivery counter itself.  The
    // backend remains the final guard because another open device can send a
    // notification between opening this form and saving it.
    const quotaDate = new Date();
    const quotaDateKey = localDateKey(quotaDate);
    const existingReminderCount = reminders
      .filter((reminder) => reminder.id !== editingId && reminder.enabled && !reminder.completedAt)
      .reduce((total, reminder) => total + reminderSlotsOnDate(reminder, quotaDate).length, 0);
    // Activity notifications are sent only for timed activities, never
    // all-day items. `activities` has already excluded archived activities
    // in App, so the same collection drives the estimate and live delivery.
    const activityNotificationCount = activities.filter((activity) => {
      if (!activity.start?.dateTime) return false;
      const start = activityDate(activity.start);
      return start && localDateKey(start) === quotaDateKey;
    }).length;
    const amount = Math.max(1, Number(draft.amount) || 1);
    const unit = draft.unit === "hours" ? "ชม." : "นาที";
    const draftForQuota = {
      type: draft.type,
      amount,
      unit: draft.unit,
      windowStart: draft.runAllDay ? null : draft.windowStart,
      windowEnd: draft.runAllDay ? null : draft.windowEnd,
      days: draft.days,
      time: draft.time,
      times: draft.times,
      atMs: draft.atDate && draft.atTime ? new Date(`${draft.atDate}T${draft.atTime}:00`).getTime() : null,
      startedAt: draft.type === REMINDER_TYPE.COUNTDOWN ? Date.now() : null,
      durationMs: Math.max(1, Number(draft.countdownMinutes) || 1) * 60 * 1000
    };
    const draftNotificationCount = reminderSlotsOnDate(draftForQuota, quotaDate).length;
    const projectedNotificationCount = existingReminderCount + activityNotificationCount + draftNotificationCount;
    const notificationQuota = {
      limit: 720,
      existingReminderCount,
      activityNotificationCount,
      draftNotificationCount,
      projectedNotificationCount,
      isAtLimit: projectedNotificationCount >= 720
    };
    const withNotificationQuota = (preview) => ({ ...preview, notificationQuota });
    if (draft.type === REMINDER_TYPE.INTERVAL) {
      const intervalDraft = { amount, unit: draft.unit, windowStart: draft.runAllDay ? null : draft.windowStart, windowEnd: draft.runAllDay ? null : draft.windowEnd };
      const schedule = getIntervalWorkSummary(intervalDraft);
      const slots = intervalScheduleMinutes(intervalDraft);
      const hours = schedule.workMinutes / 60;
      const clock = (minute) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      return withNotificationQuota({ title, typeLabel, fields: [
        field("ช่วงทำงาน", schedule.range || "ตลอดวัน (24 ชม.)"),
        field("ความถี่", `ทุก ${amount} ${unit}`),
        field("แจ้งเตือน", `${schedule.notificationCount} รอบ/การทำงาน`)
      ], footnote: `เวลา: ${slots.slice(0, 6).map(clock).join(" · ")}${slots.length > 6 ? ` · +${slots.length - 6}` : ""}${schedule.range ? ` (${hours} ชม.)` : ""}` });
    }
    if (draft.type === REMINDER_TYPE.WEEKLY) {
      const days = DAYS_OF_WEEK.filter((day) => draft.days.includes(day.value)).map((day) => t(day.labelKey));
      const times = (draft.times || []).filter(Boolean);
      return withNotificationQuota({ title, typeLabel, fields: [field("วัน", days.length ? days.join(" · ") : "ยังไม่ได้เลือก"), field("เวลา", times.length ? times.join(" · ") : "ยังไม่ได้กำหนด"), field("รวม", `${days.length * times.length} รอบ/สัปดาห์`)] });
    }
    if (draft.type === REMINDER_TYPE.EVENT_ANCHORED) return withNotificationQuota({ title, typeLabel, fields: [field("เหตุการณ์", draft.eventName.trim() || "ยังไม่ได้ระบุ"), field("แจ้งเตือน", `หลังเหตุการณ์ ${Math.max(1, Number(draft.afterAmount) || 1)} ${draft.afterUnit === "hours" ? "ชม." : "นาที"}`)] });
    if (draft.type === REMINDER_TYPE.ROUTINE) { const count = draft.routineSteps.split(",").map((item) => item.trim()).filter(Boolean).length; return withNotificationQuota({ title, typeLabel, fields: [field("ขั้นตอน", count ? `${count} ขั้นตอน` : "ยังไม่ได้ระบุ")], footnote: draft.routineSteps || undefined }); }
    if (draft.type === REMINDER_TYPE.ONCE_AT) return withNotificationQuota({ title, typeLabel, fields: [field("กำหนด", `${draft.atDate || "ยังไม่ได้เลือกวัน"} · ${draft.atTime || "ยังไม่ได้เลือกเวลา"}`)] });
    if (draft.type === REMINDER_TYPE.COUNTDOWN) return withNotificationQuota({ title, typeLabel, fields: [field("ระยะเวลา", `${Math.max(1, Number(draft.countdownMinutes) || 1)} นาที`), field("เริ่ม", "ทันทีหลังบันทึก")] });
    return withNotificationQuota({ title, typeLabel, fields: [field("การทำงาน", "เริ่มจับเวลาเมื่อกด Start")], footnote: "หยุดและเริ่มใหม่ได้โดยไม่รีเซ็ตเวลาสะสม" });
  }, [activities, draft, editingId, reminders, t]);

  // Tab ของรายการ reminder (migration plan v2 เฟส 1.2) — เดิมแสดง
  // active/paused พร้อมกันทั้งคู่คั่นด้วย section header, ตอนนี้เลือกดูได้
  // ทีละ tab แบบ mockup "completed" ยังเป็น placeholder เฉยๆ (รอ field
  // completedAt จริงจากเฟส 4) กด disabled ไว้ก่อน
  // สถานะของรายการที่กำลังแสดง ไม่ใช่ "active" ของ UI ทั่วไป.
  const { dateView, setDateView, selectedDateKey, selectedDate, selectDate, reminderStatusTab, setReminderStatusTab, activeTypeFilter, setActiveTypeFilter, activeGroupFilter, setActiveGroupFilter, toggleTypeFilter, toggleGroupFilter, enabledReminders, pausedReminders, completedReminders, visibleEnabledReminders, visiblePausedReminders, visibleCompletedReminders } = useReminderFilters(reminders);

  // ฟอร์มสร้างกลุ่มใหม่แบบ inline ใน nav sidebar — เปิด/ปิดด้วยปุ่ม "+
  // เพิ่มกลุ่มใหม่" เก็บแค่ชื่อ (สีสุ่ม/วนจาก GROUP_COLOR_PALETTE อัตโนมัติ
  // ไม่ให้ผู้ใช้เลือกเอง เพื่อลดขั้นตอนเหลือแค่พิมพ์ชื่อ + Enter)
  /**
   * ลบกลุ่ม — backend เคลียร์ groupId ของ reminder ที่เคยผูกไว้เป็น null
   * ให้แล้ว (ดู routes/reminder-groups.js) แต่ local `reminders` state ที่
   * นี่ยังไม่รู้เรื่อง ต้อง patch เองให้ตรงกัน (useReminderGroups ไม่รู้จัก
   * reminders state จึงทำให้ไม่ได้ — ดู hook's module comment) พร้อมเคลียร์
   * activeGroupFilter ถ้ากำลังกรองด้วยกลุ่มที่เพิ่งถูกลบไปพอดี
   */
  const handleDeleteGroup = async (groupId) => {
    try {
      await removeGroup(groupId);
      setReminders((prev) => prev.map((r) => (r.groupId === groupId ? { ...r, groupId: null } : r)));
      setActiveGroupFilter((prev) => (prev === groupId ? null : prev));
    } catch {
      // groupsError จาก hook แสดงผลอยู่แล้ว
    }
  };

  // เมนู "⋮" บนการ์ด (แทนปุ่ม edit/delete แยก) + เมนู snooze บน due-banner
  // (migration plan v2 เฟส 1.3/1.4) — เก็บเป็น id เดียวต่อเมนู เพราะเปิด
  // ได้ทีละอันในแต่ละกลุ่มเสมออยู่แล้ว ไม่ต้องเป็น Set
  const {
    cardMenu, snoozeMenuForId, toggleCardMenu, toggleSnoozeMenu,
    closeCardMenu, closeSnoozeMenu, closeAllMenus
  } = useReminderMenus();
  const {
    zoomIndex, zoomIn, zoomOut, minutesPerRow, tapeRows, tapeScrollRef,
    timelineTrackMinWidth, calendarTimelineBlocks, runningReminderSpans,
    activityNowStatus, handleUserInteraction, focusReminderOnTimeline, SPACER_HEIGHT_PX
  } = useReminderTimeline({
    reminders, activities, categories, activityCategoryMap, selectedDate, selectedDateKey,
    activeTypeFilter, activeGroupFilter, nowTick,
    defaultLineColor: DEFAULT_LINE_COLOR, formatDurationClock
  });
  const { isExporting, exportTimelineImage } = useReminderExport({
    getExportReminders, selectedDate, activities, categories, activityCategoryMap,
    groups, activeTypeFilter, activeGroupFilter
  });

  const triggerAnchorEvent = (reminderId) => {
    const now = Date.now();
    updateReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;
        const updated = { ...r, lastTriggeredAt: now, enabled: true };
        return { ...updated, nextDueAt: computeNextDueAt(updated, now) };
      })
    );
  };

  const advanceRoutine = (reminderId) => {
    updateReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;
        const nextIdx = (r.currentIndex || 0) + 1;
        if (nextIdx >= r.steps.length) {
          // ทำครบทุก step แล้ว — เข้า tab "ทำเสร็จแล้ว" เหมือน one-shot
          // type (migration plan v2 เฟส 4.3) แทนที่จะแค่ enabled: false
          // เฉยๆ แบบเดิม — ผู้ใช้ยังเปิดสวิตช์กลับเองได้ตามปกติ (toggle()
          // จะเคลียร์ completedAt คืนเป็น null ให้ ดูฟังก์ชันนั้นด้านล่าง)
          logReminderEvent("reminder_completed", { reminder_type: r.type });
          recordStatsEvent("completed", { title: r.title, reminderType: r.type });
          return {
            ...r,
            currentIndex: 0,
            enabled: false,
            completedAt: Date.now(),
            completionCount: (Number.isInteger(r.completionCount) ? r.completionCount : 0) + 1
          };
        }
        return { ...r, currentIndex: nextIdx };
      })
    );
  };

  // Start/Stop สำหรับ stopwatch โดยเฉพาะ (แยกจาก toggle() ทั่วไปเพราะ semantics ต่างกัน)
  // - Start: enabled=true, startedAt=ตอนนี้ (นับเวลาต่อจาก accumulatedMs เดิม)
  // - Stop: บวกเวลาที่ผ่านไปตั้งแต่ startedAt เข้ากับ accumulatedMs แล้วหยุด (enabled=false, startedAt=null)
  //   ทำให้กด Start ใหม่ได้และเวลานับต่อจากเดิมได้ ไม่รีเซ็ตทุกครั้งที่หยุด
  const toggleStopwatch = (reminderId) => {
    updateReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId || r.type !== REMINDER_TYPE.STOPWATCH) return r;

        if (!r.enabled) {
          return { ...r, enabled: true, startedAt: Date.now() };
        }

        const elapsedSinceStart = r.startedAt ? Date.now() - r.startedAt : 0;
        recordStatsEvent("stopwatch-session", { title: r.title, durationMs: elapsedSinceStart });
        return {
          ...r,
          enabled: false,
          accumulatedMs: (r.accumulatedMs || 0) + elapsedSinceStart,
          startedAt: null
        };
      })
    );
  };

  // รีเซ็ต stopwatch กลับเป็น 0 (หยุดด้วย ถ้ากำลังทำงานอยู่)
  const resetStopwatch = (reminderId) => {
    updateReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId || r.type !== REMINDER_TYPE.STOPWATCH) return r;
        return { ...r, enabled: false, accumulatedMs: 0, startedAt: null };
      })
    );
  };

  const toggle = (reminderId) => {
    updateReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;

        if (!r.enabled) {
          // เปิดสวิตช์กลับ (ไม่ว่าจะเคย "ทำเสร็จแล้ว" มาก่อนหรือแค่ปิดไว้
          // เฉยๆ) ต้องเคลียร์ completedAt กลับเป็น null เสมอ — migration
          // plan v2 เฟส 4: reminder ที่กำลัง enabled ไม่ควรค้างอยู่ tab
          // "ทำเสร็จแล้ว" พร้อมกัน (ทั้งสองสถานะไม่ควรจริงพร้อมกัน)

          // Countdown ประเภทเดียวที่ "เปิดใหม่" ควรหมายถึงเริ่มนับใหม่ทั้งหมด
          // (ถ้าใช้ startedAt เดิม endMs จะเป็นอดีตไปแล้ว ทำให้ยิงแจ้งเตือนทันทีที่เปิด)
          if (r.type === REMINDER_TYPE.COUNTDOWN) {
            const restarted = { ...r, enabled: true, startedAt: Date.now(), completedAt: null };
            return { ...restarted, nextDueAt: computeNextDueAt(restarted, Date.now()) };
          }

          // Once-at ที่เวลาผ่านไปแล้ว เปิดสวิตช์กลับไม่มีประโยชน์ (จะยิงทันที) ต้องให้ผู้ใช้แก้ไขวันที่/เวลาใหม่แทน
          if (r.type === REMINDER_TYPE.ONCE_AT && r.atMs && r.atMs <= Date.now()) {
            alert("เวลาที่ตั้งไว้ผ่านไปแล้ว กรุณาแก้ไขวันที่และเวลาใหม่ก่อนเปิดใช้งานอีกครั้ง");
            return r;
          }

          const nextDue = r.type === REMINDER_TYPE.INTERVAL ? null : computeNextDueAt(r, Date.now());
          return { ...r, enabled: true, nextDueAt: nextDue, completedAt: null };
        }
        return { ...r, enabled: false };
      })
    );
  };

  const { toggleDayInDraft, submitReminderForm, deleteReminder, deleteEditingReminder, startEdit, cancelEditing, toggleComposer } = useReminderComposerActions({
    draft, setDraft, editingId, setEditingId, isComposerOpen, setIsComposerOpen,
    reminders, updateReminders, createBlankDraft, defaultLineColor: DEFAULT_LINE_COLOR
  });

  // Filter ตามประเภท (เฟส 2) ใช้ร่วมกันทั้ง active/paused — reminders ที่
  // enabled/paused คำนวณจาก reminders เต็มชุดก่อน (ไม่ใช่ผลลัพธ์ที่กรอง
  // แล้ว) เพราะ toolbar-subtitle ด้านบนยังต้องโชว์ยอดรวมทั้งหมดแยกจากที่
  // กำลังกรองอยู่ — ตัวแปรสองชุดนี้แทน "รายการทั้งหมดของ tab นั้น" ส่วน
  // ตัวที่ map ขึ้นจอจริงจะกรองซ้ำอีกชั้นด้วย activeTypeFilter ที่จุด render
  //
  // migration plan v2 เฟส 4 — เพิ่มเงื่อนไข !r.completedAt เข้า
  // enabledReminders/pausedReminders ทั้งคู่ (reminder ที่ทำเสร็จแล้วต้อง
  // ไม่ปรากฏใน tab เดิมอีกต่อไป ย้ายไป completedReminders แทน) และเพิ่ม
  // completedReminders เป็น tab ที่ 3
  /** ข้อความอธิบาย filter ที่กำลังเปิดอยู่ (ทั้งคู่พร้อมกันได้) สำหรับ empty-state — คืน "" ถ้าไม่มี filter ใดเปิดอยู่เลย */
  const describeActiveFilters = () => {
    const parts = [];
    if (activeTypeFilter) {
      const type = TYPE_FILTER_OPTIONS.find((option) => option.type === activeTypeFilter);
      parts.push(t("reminder.filterType", { type: t(type?.labelKey) }));
    }
    if (activeGroupFilter) parts.push(t("reminder.filterGroup", { group: groups.find((group) => group.id === activeGroupFilter)?.name }));
    return parts.join(" ");
  };



  const getReminderPriority = (reminder) => {
    if (reminder.completedAt) return { label: t("reminder.completed"), tone: "completed" };
    if (!reminder.enabled) return { label: t("reminder.status.paused"), tone: "paused" };
    if (Number.isFinite(reminder.nextDueAt)) {
      const remainingSeconds = Math.ceil((reminder.nextDueAt - nowTick) / 1000);
      if (remainingSeconds <= 0) return { label: t("reminder.status.due"), tone: "due" };
      return { label: t("reminder.status.next", { time: formatDurationClock(remainingSeconds) }), tone: "next" };
    }
    if (reminder.type === REMINDER_TYPE.EVENT_ANCHORED) return { label: t("reminder.status.waiting"), tone: "waiting" };
    return { label: t("reminder.status.active"), tone: "active" };
  };

  const renderReminder = (reminder) => {
    const priority = getReminderPriority(reminder);
    const typeLabel = t(TYPE_FILTER_OPTIONS.find((option) => option.type === reminder.type)?.labelKey);
    const group = reminder.groupId ? groups.find((item) => item.id === reminder.groupId) : null;
    const weeklyDaysLabel = reminder.type === REMINDER_TYPE.WEEKLY
      ? DAYS_OF_WEEK.filter((day) => reminder.days?.includes(day.value)).map((day) => t(day.labelKey)).join(" · ")
      : null;
    const intervalWorkSummary = reminder.type === REMINDER_TYPE.INTERVAL
      ? getIntervalWorkSummary(reminder)
      : null;
    const intervalHours = intervalWorkSummary && intervalWorkSummary.workMinutes / 60;
    const intervalWorkLabel = intervalHours % 1 === 0 ? `${intervalHours} ชม.` : `${intervalWorkSummary.workMinutes} นาที`;
    return (
      <div
      key={reminder.id}
      className={`reminder-card ${reminder.enabled ? "active" : ""}${cardMenu?.id === reminder.id ? " menu-open" : ""}`}
      style={{ borderLeftColor: TYPE_ACCENT_COLOR[reminder.type] }}
    >
      <button
        type="button"
        className="reminder-type-icon"
        style={{ backgroundColor: TYPE_ACCENT_COLOR[reminder.type], color: getTypeIconTextColor(reminder.type) }}
        onClick={() => focusReminderOnTimeline(reminder)}
        title="เลื่อน Timeline มาที่เวลาของ Reminder"
        aria-label={`เลื่อน Timeline มาที่ ${reminder.title}`}
      >
        {reminder.type === REMINDER_TYPE.WEEKLY ? "📅" :
         reminder.type === REMINDER_TYPE.EVENT_ANCHORED ? "⚓" :
         reminder.type === REMINDER_TYPE.ROUTINE ? "📋" :
         reminder.type === REMINDER_TYPE.ONCE_AT ? "1x" : 
         reminder.type === REMINDER_TYPE.COUNTDOWN ? "⏱" :
         reminder.type === REMINDER_TYPE.STOPWATCH ? "⏱️" : "↻"}
      </button>
      <div
        className="reminder-info"
        role="button"
        tabIndex={0}
        onClick={() => startEdit(reminder)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            startEdit(reminder);
          }
        }}
        title="คลิกเพื่อแก้ไข Reminder"
      >
        <div className="reminder-card-title-row">
          <p className="title">{reminder.title}</p>
          <span className={`reminder-priority reminder-priority--${priority.tone}`}>{priority.label}</span>
        </div>
        <p className="reminder-schedule-detail">{describeReminder(reminder, nowTick)}</p>
        {weeklyDaysLabel && (
          <p className="reminder-weekly-days-detail">
            <span>{t("reminder.weeklyDays")}</span>{weeklyDaysLabel}
          </p>
        )}
        {/* Badge "ทำเสร็จแล้ว" (migration plan v2 เฟส 4) — ทำให้การ์ดใน tab
            "ทำเสร็จแล้ว" ดูต่างจาก "ปิดใช้งาน" เฉยๆ ชัดเจน (ทั้งคู่มี
            enabled: false เหมือนกัน แต่ความหมายต่างกันคนละเรื่อง) กด
            toggle-switch/stopwatch ปกติเพื่อ "เปิดใช้งานใหม่" ได้เหมือนเดิม
            ซึ่งจะเคลียร์ completedAt ให้อัตโนมัติ (ดู toggle() function) */}
        {reminder.completedAt && (
          <span className="reminder-completed-badge">
            ✓ ทำเสร็จแล้ว{reminder.type === REMINDER_TYPE.ROUTINE ? ` · ทำครบ ${reminder.completionCount || 0} ครั้ง` : ""}
          </span>
        )}
        {intervalWorkSummary && (
          <p
            className="reminder-interval-summary"
            title={`ช่วงทำงาน ${intervalWorkSummary.range || "ตลอดวัน"} · แจ้งเตือน ${intervalWorkSummary.notificationCount} ครั้ง`}
          >
            <span>{intervalWorkLabel}</span>
            <span aria-hidden="true">·</span>
            <strong>{intervalWorkSummary.notificationCount} รอบ</strong>
          </p>
        )}
        <div className="reminder-card-metadata">
          <span className="reminder-type-chip">{typeLabel}</span>
          {group && (
          <span className="reminder-group-chip">
            <span
              className="reminder-group-chip-dot"
              style={{ background: group.color }}
            />
            {group.name}
          </span>
          )}
        </div>

        {reminder.type === REMINDER_TYPE.EVENT_ANCHORED && (
          <button type="button" className="btn-action-small" onClick={(event) => { event.stopPropagation(); triggerAnchorEvent(reminder.id); }}>
            ⚡ เริ่มเหตุการณ์ "{reminder.eventName}"
          </button>
        )}

        {reminder.type === REMINDER_TYPE.ROUTINE && reminder.enabled && (
          <button type="button" className="btn-action-small" onClick={(event) => { event.stopPropagation(); advanceRoutine(reminder.id); }}>
            ✓ ทำเสร็จแล้ว ({reminder.steps[reminder.currentIndex]})
          </button>
        )}
      </div>

      {reminder.type === REMINDER_TYPE.STOPWATCH ? (
        // Stopwatch ใช้ปุ่ม Start/Stop (+ Reset) แทน toggle switch ทั่วไป เพราะไม่ใช่ enable/disable
        // แบบ on-off เฉย ๆ แต่มี semantics ของการนับเวลาสะสมที่ต้องจัดการเฉพาะ
        <div className="stopwatch-controls">
          <button type="button" className={`btn-stopwatch ${reminder.enabled ? "stop" : "start"}`} onClick={() => toggleStopwatch(reminder.id)}>
            {reminder.enabled ? "⏸ Stop" : "▶ Start"}
          </button>
          <button type="button" className="icon-btn" onClick={() => resetStopwatch(reminder.id)} title="รีเซ็ตเป็น 0">
            ↺
          </button>
        </div>
      ) : (
        <button type="button" className={`toggle-switch ${reminder.enabled ? "on" : ""}`} onClick={() => toggle(reminder.id)} aria-label="สวิตช์เปิดปิด" />
      )}

      <div className={`reminder-card-actions ${cardMenu?.id === reminder.id ? "menu-open" : ""}`}>
        <button
          type="button"
          className="icon-btn"
          onClick={(event) => toggleCardMenu(event, reminder.id)}
          title="ตัวเลือกเพิ่มเติม"
          aria-haspopup="true"
          aria-expanded={cardMenu?.id === reminder.id}
        >
          ⋮
        </button>
        {cardMenu?.id === reminder.id && createPortal(
          <div className="card-dropdown-menu" role="menu" onPointerDown={(event) => event.stopPropagation()} style={{ "--card-menu-x": `${cardMenu.position.x}px`, "--card-menu-y": `${cardMenu.position.y}px` }}>
            <button type="button" role="menuitem" onClick={() => { closeCardMenu(); startEdit(reminder); }}>
              ✏️ แก้ไข
            </button>
            {/* migration plan v2 เฟส 4 — mark เสร็จเองได้โดยไม่ต้องรอถึงเวลา
                due-banner จำกัดเฉพาะ one-shot type (once-at/countdown)
                เท่านั้น เพราะ type วนซ้ำ "ทำเสร็จแล้ว" มีความหมายเท่ากับ
                "เตือนอีกครั้ง" อยู่แล้ว (ดู markCompleted's comment) กด
                ก่อนถึงเวลาจริงจากตรงนี้จึงจะดูสมเหตุสมผลเฉพาะ type ที่จบ
                แบบถาวรได้เท่านั้น ไม่แสดงถ้าทำเสร็จไปแล้ว (ป้องกันกดซ้ำ) */}
            {isOneShotType(reminder.type) && !reminder.completedAt && (
              <button type="button" role="menuitem" onClick={() => { closeCardMenu(); markCompleted(reminder.id); }}>
                ✓ ทำเสร็จแล้ว
              </button>
            )}
            <button type="button" role="menuitem" className="is-danger" onClick={() => { closeCardMenu(); deleteReminder(reminder.id); }}>
              🗑️ ลบ
            </button>
          </div>,
          document.body
        )}
      </div>
      </div>
    );
  };

  return (
    <div
      className="reminder-app-container"
      style={{
        "--timeline-now-color": timelineColors?.nowIndicator || "#ea4335"
      }}
    >

      {/* Top Bar — Omnibar แบบ rule-based (Phase 6); สถิติยังรอ Phase 7 */}
      <header className="app-topbar">
        <div className="topbar-logo">
          <span className="topbar-logo-icon" aria-hidden="true">⏰</span>
          <span className="topbar-logo-text">ReminderOS</span>
        </div>
        <div className="topbar-omnibar-wrap">
          <input
            type="text"
            className="topbar-omnibar"
            value={omnibarInput}
            onChange={(event) => setOmnibarInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitOmnibar();
              }
            }}
            placeholder={t("reminder.omnibarPlaceholder")}
            disabled={!omnibarEnabled}
            title={omnibarEnabled ? t("reminder.omnibarCreateHint") : t("reminder.omnibarDisabledHint")}
          />
          {omnibarEnabled && omnibarInput.trim() && (
            <div className={`omnibar-preview ${omnibarPreview.matched ? "is-matched" : ""}`}>
              <span>{omnibarPreview.matched ? `→ ${omnibarPreview.description}` : t("reminder.omnibarUnknown")}</span>
              <button type="button" onClick={submitOmnibar}>{omnibarPreview.matched ? t("reminder.create") : t("reminder.openForm")}</button>
            </div>
          )}
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className={`topbar-icon-btn topbar-telegram-btn${areTelegramAlertsEnabled ? " is-active" : " is-muted"}`}
            disabled={telegramConnection.isLoading}
            onClick={handleTelegramAlertToggle}
            aria-pressed={telegramConnection.isConnected ? areTelegramAlertsEnabled : undefined}
            title={telegramConnection.statusMessage || (telegramConnection.isConnected ? (areTelegramAlertsEnabled ? "ปิดการแจ้งเตือน Telegram" : "เปิดการแจ้งเตือน Telegram") : t("reminder.connectTelegram"))}
            aria-label={telegramConnection.isConnected ? (areTelegramAlertsEnabled ? "ปิดการแจ้งเตือน Telegram" : "เปิดการแจ้งเตือน Telegram") : t("reminder.connectTelegram")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M21.4 3.2 2.9 10.3c-1.26.5-1.25 1.2-.23 1.51l4.75 1.48 1.84 5.64c.22.61.11.85.76.85.5 0 .72-.23 1-.5l2.3-2.24 4.78 3.53c.88.49 1.52.24 1.74-.82l3.15-14.85c.33-1.3-.5-1.89-1.57-1.42ZM8.4 12.8l10.72-6.77c.54-.33 1.03-.15.62.22l-9.19 8.3-.36 3.87-1.79-5.62Z" />
            </svg>
          </button>
          {/* เก็บปุ่ม Push เดิมไว้เพื่อรักษา layout แต่หยุดการทำงานชั่วคราว:
              Telegram เป็นช่องทางแจ้งเตือนหลักในระยะนี้. */}
          <button
            type="button"
            className={`topbar-icon-btn ${isPushEnabled ? "is-active" : ""}`}
            disabled
            title={t("reminder.pushPaused")}
            aria-label={t("reminder.pushPaused")}
          >
            {isPushEnabled ? "🔔" : "🔕"}
          </button>
          <button type="button" className="topbar-icon-btn" onClick={() => openStats()} title={t("reminder.viewStats")}>📊</button>
        </div>
      </header>

      {telegramConnection.statusMessage && (
        <div className={`telegram-connection-toast${telegramConnection.isConnected ? " is-connected" : ""}`} role="status">
          <span className="telegram-connection-toast-icon" aria-hidden="true">{telegramConnection.isConnected ? "✓" : "✈"}</span>
          <div>
            <strong>Telegram</strong>
            <p>{telegramConnection.statusMessage}</p>
            {!telegramConnection.isConnected && telegramConnection.linkExpiresAt && <small>หน้าต่างนี้จะยืนยันการเชื่อมต่อให้อัตโนมัติ</small>}
          </div>
          <button
            type="button"
            className="telegram-connection-toast-close"
            aria-label="ปิดข้อความ Telegram"
            onClick={() => setTelegramConnection((previous) => ({ ...previous, statusMessage: "", linkExpiresAt: null }))}
          >×</button>
        </div>
      )}

      <ReminderStatsPanel isOpen={isStatsOpen} onClose={() => closeStats()} stats={reminderStats} />

      {/* Backdrop ปิดเมนู "⋮" การ์ด / snooze dropdown เมื่อคลิกนอกเมนู —
          ใช้ตัวเดียวร่วมกันทั้งสองระบบเมนู (migration plan v2 เฟส 1.3/1.4)
          เพราะเปิดได้ทีละเมนูอยู่แล้วในทางปฏิบัติ ไม่ต้อง portal/listener
          แยกต่างหาก */}
      {(cardMenu || snoozeMenuForId) && (
        <div className="dropdown-backdrop" onClick={closeAllMenus} />
      )}

      {/* Alert Banner */}
      {dueReminders.length > 0 && (
        <div className="due-alert-banner" role="alert">
          <span>🔔 {t("reminder.due", { titles: dueReminders.map((r) => r.title).join(", ") })}</span>
          <div className="due-alert-actions">
            {dueReminders.map((r) => (
              <span key={r.id} className="due-alert-item-actions">
                <div className="snooze-dropdown-wrap">
                  <button
                    type="button"
                    className="btn-snooze"
                    onClick={() => toggleSnoozeMenu(r.id)}
                    aria-haspopup="true"
                    aria-expanded={snoozeMenuForId === r.id}
                  >
                    {t("reminder.snooze", { title: r.title })}
                  </button>
                  {snoozeMenuForId === r.id && (
                    <div className="snooze-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => { scheduleNext(r.id); closeSnoozeMenu(); }}>
                        {t("reminder.normalSchedule")}
                      </button>
                      {SNOOZE_OPTIONS_MINUTES.map((m) => (
                        <button key={m} type="button" role="menuitem" onClick={() => { scheduleNext(r.id, m); closeSnoozeMenu(); }}>
                          {t("reminder.snoozeMinutes", { minutes: m })}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* migration plan v2 เฟส 4 — ผูก markCompleted() จริงแล้ว
                    (เดิมเป็น placeholder disabled รอ field completedAt) */}
                <button type="button" className="btn-mark-done" onClick={() => markCompleted(r.id)}>
                  ✓ {t("reminder.complete")}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Body Grid — 3 คอลัมน์: nav ซ้าย / list กลาง / timeline ขวา
          (เดิม 2 คอลัมน์: timeline ซ้าย / list ขวา — ย้าย timeline ไปขวาสุด
          ตาม reminder-dashboard-mockup.jsx, migration plan v2 เฟส 1.1) */}
      {syncError && <p className="error-banner" role="alert">{syncError}</p>}
      <div className="dashboard-body">
        {/* Left Nav — "ตัวกรองประเภท" (เฟส 2) และ "กลุ่ม/โปรเจกต์" (เฟส 3)
            wired จริงทั้งคู่แล้ว "ของวันนี้" ยังเป็น placeholder รอระบบ
            มุมมองในอนาคต count ทุกจุดคำนวณจาก reminders/groups จริงเสมอ */}
        <ReminderSidebar
          dateView={dateView}
          setDateView={setDateView}
          selectedDateKey={selectedDateKey}
          selectDate={selectDate}
          reminders={reminders}
          groups={groups}
          groupsError={groupsError}
          addGroup={addGroup}
          handleDeleteGroup={handleDeleteGroup}
          activeTypeFilter={activeTypeFilter}
          setActiveTypeFilter={setActiveTypeFilter}
          activeGroupFilter={activeGroupFilter}
          setActiveGroupFilter={setActiveGroupFilter}
          toggleGroupFilter={toggleGroupFilter}
          toggleTypeFilter={toggleTypeFilter}
          typeFilterOptions={TYPE_FILTER_OPTIONS}
        />

        {/* Reminders Dashboard */}
        <section className="main-panel">
          <div className="main-panel-toolbar">
            <div>
              <h2>
                {t("reminder.allReminders")}
                {activeTypeFilter && (
                  <span className="active-filter-chip">
                    {t(TYPE_FILTER_OPTIONS.find((o) => o.type === activeTypeFilter)?.labelKey)}
                    <button type="button" onClick={() => setActiveTypeFilter(null)} aria-label={t("reminder.clearTypeFilter")}>✕</button>
                  </span>
                )}
                {activeGroupFilter && (
                  <span className="active-filter-chip">
                    {groups.find((g) => g.id === activeGroupFilter)?.name}
                    <button type="button" onClick={() => setActiveGroupFilter(null)} aria-label={t("reminder.clearGroupFilter")}>✕</button>
                  </span>
                )}
              </h2>
              <p className="toolbar-subtitle">{t("reminder.summary", { total: reminders.length, enabled: enabledReminders.length, paused: pausedReminders.length, completed: completedReminders.length })}</p>
            </div>
            <button type="button" className={`add-reminder-btn ${isComposerOpen ? "is-open" : ""}`} onClick={toggleComposer}>
              <span className="add-reminder-btn-icon">+</span> {isComposerOpen ? t("reminder.closeForm") : t("reminder.addReminder")}
            </button>
          </div>

          {/* Tabs — แทน section header คั่นหัวข้อแบบเดิมที่โชว์ active/paused
              พร้อมกันตลอด (migration plan v2 เฟส 1.2) "ทำเสร็จแล้ว" ผูก
              completedAt จริงแล้ว (เฟส 4) */}
          <div className="tab-bar" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={reminderStatusTab === REMINDER_STATUS_TAB.ENABLED}
              className={`reminder-status-tab reminder-status-tab--enabled ${reminderStatusTab === REMINDER_STATUS_TAB.ENABLED ? "is-active" : ""}`}
              onClick={() => setReminderStatusTab(REMINDER_STATUS_TAB.ENABLED)}
            >
              {t("reminder.enabled")} <span className="reminder-status-tab-count">{visibleEnabledReminders.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={reminderStatusTab === REMINDER_STATUS_TAB.PAUSED}
              className={`reminder-status-tab reminder-status-tab--paused ${reminderStatusTab === REMINDER_STATUS_TAB.PAUSED ? "is-active" : ""}`}
              onClick={() => setReminderStatusTab(REMINDER_STATUS_TAB.PAUSED)}
            >
              {t("reminder.paused")} <span className="reminder-status-tab-count">{visiblePausedReminders.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={reminderStatusTab === REMINDER_STATUS_TAB.COMPLETED}
              className={`reminder-status-tab reminder-status-tab--completed ${reminderStatusTab === REMINDER_STATUS_TAB.COMPLETED ? "is-active" : ""}`}
              onClick={() => setReminderStatusTab(REMINDER_STATUS_TAB.COMPLETED)}
            >
              {t("reminder.completed")} <span className="reminder-status-tab-count">{visibleCompletedReminders.length}</span>
            </button>
          </div>

          <div className="reminders-scroll-area">
            {/* Composer แบบ inline expand/collapse: พับเก็บเป็นค่าเริ่มต้นเพื่อประหยัดพื้นที่
                เมื่อกด "เพิ่ม Reminder" หรือกด "แก้ไข" การ์ดใดการ์ดหนึ่ง จะดันลงมาแสดงแทนที่ */}
            {isComposerOpen && (
              <div className="composer-backdrop" onMouseDown={cancelEditing}>
              <form ref={composerCardRef} className="composer-card" onMouseDown={(event) => event.stopPropagation()} onSubmit={submitReminderForm}>
              <div className="form-field">
                <label htmlFor="reminder-title">{t("reminder.title")}</label>
                <input id="reminder-title" className="form-input" value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder={t("reminder.titlePlaceholder")} />
              </div>

              <div className="form-field">
                <label htmlFor="reminder-type">{t("reminder.type")}</label>
                <select id="reminder-type" className="form-select" value={draft.type} onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value={REMINDER_TYPE.INTERVAL}>{t("reminder.type.interval")}</option>
                  <option value={REMINDER_TYPE.WEEKLY}>{t("reminder.type.weekly")}</option>
                  <option value={REMINDER_TYPE.EVENT_ANCHORED}>{t("reminder.type.event-anchored")}</option>
                  <option value={REMINDER_TYPE.ROUTINE}>{t("reminder.type.routine")}</option>
                  <option value={REMINDER_TYPE.ONCE_AT}>{t("reminder.type.once-at")}</option>
                  <option value={REMINDER_TYPE.COUNTDOWN}>{t("reminder.type.countdown")}</option>
                  <option value={REMINDER_TYPE.STOPWATCH}>{t("reminder.type.stopwatch")}</option>
                </select>
              </div>

              {/* migration plan v2 เฟส 3 — เลือกกลุ่ม/โปรเจกต์ที่ reminder
                  นี้จะผูกด้วย (optional, one-to-one) ซ่อนตัวเลือกนี้ไปเลย
                  ถ้ายังไม่มีกลุ่มไหนถูกสร้างไว้เลย แทนที่จะโชว์ dropdown
                  ว่างๆ ที่มีแค่ตัวเลือกเดียว ("ไม่มีกลุ่ม") ซึ่งไม่มีประโยชน์ */}
              {groups.length > 0 && (
                <div className="form-field">
                  <label htmlFor="reminder-group">{t("reminder.groupOptional")}</label>
                  <select
                    id="reminder-group"
                    className="form-select"
                    value={draft.groupId ?? ""}
                    onChange={(e) => setDraft((prev) => ({ ...prev, groupId: e.target.value || null }))}
                  >
                    <option value="">{t("reminder.noGroup")}</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {draft.type === REMINDER_TYPE.INTERVAL && (
                <>
                  <div className="form-field">
                    <label htmlFor="reminder-amount">{t("reminder.frequency")}</label>
                    <div className="freq-inline-group">
                      <input id="reminder-amount" className="form-input" type="number" min="1" value={draft.amount} onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))} />
                      <select className="form-select" value={draft.unit} onChange={(e) => setDraft((prev) => ({ ...prev, unit: e.target.value }))}>
                        <option value="minutes">{t("reminder.minutes")}</option>
                        <option value="hours">{t("reminder.hours")}</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <button type="button" role="switch" aria-checked={draft.runAllDay} className={`interval-window-toggle${draft.runAllDay ? " is-active" : ""}`} onClick={() => setDraft((prev) => ({ ...prev, runAllDay: !prev.runAllDay, ...(!prev.runAllDay ? { windowStart: "", windowEnd: "" } : {}) }))}>
                      <span className="interval-window-toggle-track" aria-hidden="true" />
                      <span>{t("reminder.runAllDay")}</span>
                    </button>
                    {!draft.runAllDay && <>
                    <label>{t("reminder.activeWindow")}</label>
                    <div className="composer-row">
                      <input className="form-input" type="time" value={draft.windowStart} onChange={(e) => setDraft((prev) => ({ ...prev, windowStart: e.target.value }))} />
                      <input className="form-input" type="time" value={draft.windowEnd} onChange={(e) => setDraft((prev) => ({ ...prev, windowEnd: e.target.value }))} />
                    </div>
                    </>}
                  </div>
                </>
              )}

              {draft.type === REMINDER_TYPE.WEEKLY && (
                <>
                  <div className="form-field">
                    <label>{t("reminder.selectWeekdays")}</label>
                    <div className="day-selector">
                      {DAYS_OF_WEEK.map((d) => (
                        <button key={d.value} type="button" className={`day-btn ${draft.days.includes(d.value) ? "selected" : ""}`} onClick={() => toggleDayInDraft(d.value)}>
                          {t(d.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-field">
                    <label>{t("reminder.time")}</label>
                    {(draft.times || [draft.time]).map((time, index) => (
                      <div className="weekly-time-row" key={`${time}-${index}`}>
                        <input className="form-input" type="time" value={time} onChange={(event) => setDraft((prev) => ({ ...prev, times: prev.times.map((value, itemIndex) => itemIndex === index ? event.target.value : value) }))} />
                        <button type="button" className="icon-btn" disabled={draft.times.length === 1} onClick={() => setDraft((prev) => ({ ...prev, times: prev.times.filter((_, itemIndex) => itemIndex !== index) }))}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn-text weekly-add-time" onClick={() => setDraft((prev) => ({ ...prev, times: [...prev.times, "12:00"] }))}>{t("reminder.addTime")}</button>
                  </div>
                </>
              )}

              {draft.type === REMINDER_TYPE.EVENT_ANCHORED && (
                <>
                  <div className="form-field">
                    <label>{t("reminder.eventReference")}</label>
                    <input className="form-input" value={draft.eventName} onChange={(e) => setDraft((prev) => ({ ...prev, eventName: e.target.value }))} placeholder={t("reminder.eventReferencePlaceholder")} />
                  </div>
                  <div className="form-field">
                    <label>{t("reminder.afterEvent")}</label>
                    <div className="freq-inline-group">
                      <input className="form-input" type="number" min="1" value={draft.afterAmount} onChange={(e) => setDraft((prev) => ({ ...prev, afterAmount: e.target.value }))} />
                      <select className="form-select" value={draft.afterUnit} onChange={(e) => setDraft((prev) => ({ ...prev, afterUnit: e.target.value }))}>
                        <option value="minutes">{t("reminder.minutes")}</option>
                        <option value="hours">{t("reminder.hours")}</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {draft.type === REMINDER_TYPE.ROUTINE && (
                <div className="form-field">
                  <label>{t("reminder.steps")}</label>
                  <input className="form-input" value={draft.routineSteps} onChange={(e) => setDraft((prev) => ({ ...prev, routineSteps: e.target.value }))} placeholder={t("reminder.stepsPlaceholder")} />
                </div>
              )}

              {draft.type === REMINDER_TYPE.ONCE_AT && (
                <div className="composer-row form-field">
                  <div>
                    <label htmlFor="at-date">{t("reminder.date")}</label>
                    <input id="at-date" className="form-input" type="date" value={draft.atDate} onChange={(e) => setDraft((prev) => ({ ...prev, atDate: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="at-time">{t("reminder.time")}</label>
                    <input id="at-time" className="form-input" type="time" value={draft.atTime} onChange={(e) => setDraft((prev) => ({ ...prev, atTime: e.target.value }))} />
                  </div>
                </div>
              )}

              {draft.type === REMINDER_TYPE.COUNTDOWN && (
                <>
                  <div className="form-field">
                    <label htmlFor="countdown-minutes">{t("reminder.durationMinutes")}</label>
                    <input id="countdown-minutes" className="form-input" type="number" min="1" max="1440" value={draft.countdownMinutes} onChange={(e) => setDraft((prev) => ({ ...prev, countdownMinutes: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label>{t("reminder.timelineColor")}</label>
                    <div className="color-picker-group">
                      {LINE_COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          className={`color-swatch-btn ${draft.lineColor === c.value ? "selected" : ""}`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                          aria-label={c.label}
                          onClick={() => setDraft((prev) => ({ ...prev, lineColor: c.value }))}
                        />
                      ))}
                      <label className="color-swatch-btn color-swatch-custom" title="เลือกสีเอง" style={{ backgroundColor: draft.lineColor }}>
                        <input type="color" value={draft.lineColor} onChange={(e) => setDraft((prev) => ({ ...prev, lineColor: e.target.value }))} />
                      </label>
                    </div>
                  </div>
                </>
              )}

              {draft.type === REMINDER_TYPE.STOPWATCH && (
                <>
                  <p className="form-hint">{t("reminder.stopwatchHint")}</p>
                  <div className="form-field">
                    <label>{t("reminder.timelineColor")}</label>
                    <div className="color-picker-group">
                      {LINE_COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          className={`color-swatch-btn ${draft.lineColor === c.value ? "selected" : ""}`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                          aria-label={c.label}
                          onClick={() => setDraft((prev) => ({ ...prev, lineColor: c.value }))}
                        />
                      ))}
                      <label className="color-swatch-btn color-swatch-custom" title="เลือกสีเอง" style={{ backgroundColor: draft.lineColor }}>
                        <input type="color" value={draft.lineColor} onChange={(e) => setDraft((prev) => ({ ...prev, lineColor: e.target.value }))} />
                      </label>
                    </div>
                  </div>
                </>
              )}

              <section className="reminder-composer-preview" aria-live="polite">
                <p className="reminder-composer-preview-label">สรุปก่อนบันทึก</p>
                <div className="reminder-composer-preview-heading">
                  <strong>{composerPreview.title}</strong>
                  <span>{composerPreview.typeLabel}</span>
                </div>
                <div className="reminder-composer-preview-fields">
                  {composerPreview.fields.map(({ label, value }) => (
                    <div key={label}><span>{label}</span><strong>{value}</strong></div>
                  ))}
                </div>
                {composerPreview.footnote && <p className="reminder-composer-preview-note">{composerPreview.footnote}</p>}
                <div className={`reminder-composer-quota${composerPreview.notificationQuota.isAtLimit ? " is-at-limit" : ""}`} role={composerPreview.notificationQuota.isAtLimit ? "alert" : undefined}>
                  <div className="reminder-composer-quota-heading">
                    <span>โควตาแจ้งเตือนวันนี้</span>
                    <strong>{composerPreview.notificationQuota.projectedNotificationCount} / {composerPreview.notificationQuota.limit}</strong>
                  </div>
                  <p>
                    Reminder เดิม {composerPreview.notificationQuota.existingReminderCount} · Activity {composerPreview.notificationQuota.activityNotificationCount} · รายการนี้ {composerPreview.notificationQuota.draftNotificationCount}
                  </p>
                  {composerPreview.notificationQuota.isAtLimit && (
                    <p className="reminder-composer-quota-warning">
                      {composerPreview.notificationQuota.projectedNotificationCount > composerPreview.notificationQuota.limit
                        ? `เกินขีดจำกัด ${composerPreview.notificationQuota.projectedNotificationCount - composerPreview.notificationQuota.limit} ครั้ง — ระบบจะไม่ส่งรายการที่เกิน 720 ครั้ง/วัน`
                        : "ถึงขีดจำกัด 720 ครั้ง/วันแล้ว — การแจ้งเตือนรายการถัดไปอาจไม่ถูกส่ง"}
                    </p>
                  )}
                </div>
              </section>

              <div className="composer-actions">
                {editingId && (
                  <button className="btn-text btn-delete-reminder" type="button" onClick={deleteEditingReminder}>{t("reminder.delete")}</button>
                )}
                <button className="btn-text" type="button" onClick={cancelEditing}>{t("reminder.cancel")}</button>
                <button className="btn-contained" type="submit">
                  {editingId ? t("reminder.save") : t("reminder.addReminder")}
                </button>
              </div>
              </form>
              </div>
            )}

            {reminders.length === 0 && !isComposerOpen ? (
              <p className="empty-state">{t("reminder.empty")}</p>
            ) : (
              <>
                {reminderStatusTab === REMINDER_STATUS_TAB.ENABLED && (
                  visibleEnabledReminders.length > 0 ? (
                    visibleEnabledReminders.map(renderReminder)
                  ) : (
                    !isComposerOpen && (
                      <p className="empty-state">
                        {describeActiveFilters()
                          ? t("reminder.emptyFilteredEnabled", { filters: describeActiveFilters() })
                          : t("reminder.emptyEnabled")}
                      </p>
                    )
                  )
                )}

                {reminderStatusTab === REMINDER_STATUS_TAB.PAUSED && (
                  visiblePausedReminders.length > 0 ? (
                    visiblePausedReminders.map(renderReminder)
                  ) : (
                    !isComposerOpen && (
                      <p className="empty-state">
                        {describeActiveFilters()
                          ? t("reminder.emptyFilteredPaused", { filters: describeActiveFilters() })
                          : t("reminder.emptyPaused")}
                      </p>
                    )
                  )
                )}

                {reminderStatusTab === REMINDER_STATUS_TAB.COMPLETED && (
                  visibleCompletedReminders.length > 0 ? (
                    visibleCompletedReminders.map(renderReminder)
                  ) : (
                    <p className="empty-state">
                      {describeActiveFilters()
                        ? t("reminder.emptyFilteredCompleted", { filters: describeActiveFilters() })
                        : t("reminder.emptyCompleted")}
                    </p>
                  )
                )}
              </>
            )}
          </div>
        </section>

        {/* Timeline Section — ย้ายมาขวาสุด (เดิมอยู่ซ้ายสุด) เนื้อหา/logic
            ข้างในไม่เปลี่ยนแปลงเลยจากของเดิม แค่ย้ายตำแหน่งใน DOM order
            ให้ตรงกับ 3-column grid ใหม่เท่านั้น */}
        <aside className="timeline-panel">
          <div className="timeline-header">
            <p className="timeline-title">{t("reminder.timeline24h")} · {selectedDateKey}</p>
            <div className="timeline-header-actions">
              <button
                type="button"
                className="timeline-export-btn"
                title="บันทึกภาพ timeline reminder"
                disabled={isExporting}
                onClick={exportTimelineImage}
              >
                ⇩ <span>{isExporting ? "…" : "PNG"}</span>
              </button>
              <div className="zoom-controls">
                <button type="button" className="zoom-btn" onClick={zoomOut} disabled={zoomIndex === 0} title={t("reminder.zoomOut")}>−</button>
                <span className="zoom-display">{t("reminder.minutesPerSlot", { minutes: minutesPerRow })}</span>
                <button type="button" className="zoom-btn" onClick={zoomIn} disabled={zoomIndex === ZOOM_LEVELS_MINUTES.length - 1} title={t("reminder.zoomIn")}>+</button>
              </div>
            </div>
          </div>

          <div className="timeline-viewport">
            {selectedDateKey === localDateKey() && activityNowStatus && (
              <div
                className="timeline-activity-status"
                title={activityNowStatus.title}
                style={{ "--timeline-status-color": activityNowStatus.color.border }}
              >
                  <AutoShrinkText
                    text={activityNowStatus.title}
                    minScale={0.5}
                    className="timeline-activity-status-title"
                  />
                  <strong>{activityNowStatus.text}</strong>
              </div>
            )}
            <div hidden={selectedDateKey !== localDateKey()} className="now-indicator" aria-label={`เวลาปัจจุบัน ${formatDigitalClock(nowTick)}`}>
              <span className="now-indicator-clock">{formatDigitalClock(nowTick)}</span>
            </div>

            <div
              className="tape-scroll-container"
              ref={tapeScrollRef}
              onScroll={handleUserInteraction}
              onWheel={handleUserInteraction}
              onTouchMove={handleUserInteraction}
            >
              <div
                className="tape-track-wrapper"
                style={{ minWidth: `max(100%, ${timelineTrackMinWidth}px)` }}
              >
                {/* Spacer บน: ยืดขอบออกจากแถว 00:00 ไม่ให้ now-indicator ชนขอบ container
                    เป็น slot เปิดไว้ เผื่อใส่ contentอื่นในอนาคต (เช่น แบนเนอร์/โฆษณา) */}
                <div className="tape-spacer tape-spacer-top" style={{ height: `${SPACER_HEIGHT_PX}px` }}>
                  {/* TODO: ใส่ content เพิ่มเติมได้ที่นี่ในอนาคต เช่น <AdSlot position="timeline-top" /> */}
                </div>

                <TimelineRows tapeRows={tapeRows} nowTick={nowTick} onEditReminder={startEdit} />

                <div className="running-reminder-layer" aria-label="Timer และ Stopwatch ที่กำลังทำงาน">
                  {runningReminderSpans.map((span) => (
                    <div
                      key={span.id}
                      className={`running-reminder-span is-${span.type}`}
                      style={{ top: `${span.top}px`, height: `${span.height}px`, "--running-reminder-color": span.color }}
                      title={`${span.type === REMINDER_TYPE.COUNTDOWN ? "Timer" : "Stopwatch"}: ${span.title}`}
                    />
                  ))}
                </div>

                <div className="calendar-timeline-layer" aria-label="กิจกรรมในปฏิทินของวันนี้">
                  {calendarTimelineBlocks.filter((block) => !block.hidden).map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      className={`calendar-timeline-block${block.isActive ? " is-current" : ""}${block.titleBelow ? " has-stacked-title" : ""}`}
                      style={{
                        top: `${block.top}px`,
                        height: `${block.height}px`,
                        left: "84px",
                        width: `calc(100% - ${92 + block.stackIndex * 10}px)`,
                        right: "auto",
                        zIndex: block.stackZ,
                        "--calendar-activity-border": block.color.border,
                        "--calendar-activity-bg": block.color.bg
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditActivity?.(block.activity);
                      }}
                      onContextMenu={(event) => openActivityContextMenu(event, block)}
                      title={`แก้ไขกิจกรรม: ${block.title}`}
                      aria-label={`แก้ไขกิจกรรม: ${block.title}`}
                    >
                      <span className={`calendar-timeline-block-title${block.titleBelow ? " is-stacked" : ""}${block.titleOffsetMinutes > 0 ? " is-relocated" : ""}`} style={block.titleOffsetMinutes > 0 ? { top: `${(block.titleOffsetMinutes / Math.max(1, block.endMin - block.startMin)) * 100}%` } : undefined}>{block.title}</span>
                      {block.hiddenCount > 0 && <small className="calendar-timeline-overflow-count">+{block.hiddenCount}</small>}
                    </button>
                  ))}
                </div>

                {/* Spacer ล่าง: ยืดขอบออกจากแถว 24:00 ไม่ให้ now-indicator ชนขอบ container
                    เป็น slot เปิดไว้ เผื่อใส่ content อื่นในอนาคตเช่นกัน */}
                <div className="tape-spacer tape-spacer-bottom" style={{ height: `${SPACER_HEIGHT_PX}px` }}>
                  {/* TODO: ใส่ content เพิ่มเติมได้ที่นี่ในอนาคต เช่น <AdSlot position="timeline-bottom" /> */}
                </div>
              </div>
            </div>
          </div>
        </aside>
        {activityContextMenu && (
          <ActivityPopup
            activity={activityContextMenu.block.activity}
            start={new Date(activityContextMenu.block.actualStartMs)}
            end={new Date(activityContextMenu.block.actualEndMs)}
            position={activityContextMenu.position}
            locked={Boolean(lockedActivities[normalizeActivityId(activityContextMenu.block.activity.id)])}
            categories={categories}
            categoryId={activityCategoryMap[normalizeActivityId(activityContextMenu.block.activity.id)] || null}
            tags={[]}
            displayColor={activityContextMenu.block.color.border}
            onClose={closeActivityContextMenu}
            onToggleLock={(isLocked) => onToggleActivityLock?.(normalizeActivityId(activityContextMenu.block.activity.id), isLocked)}
            restrictedToLock
          />
        )}
      </div>
    </div>
  );
}
