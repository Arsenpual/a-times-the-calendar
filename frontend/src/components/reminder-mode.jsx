import React, { useEffect, useMemo, useRef, useState } from "react";
import { useReminderGroups } from "../hooks/use-reminder-groups.js";
import { usePushNotifications } from "../hooks/use-push-notifications.js";
import { useReminderStore } from "../hooks/use-reminder-store.js";
import { getReminderFeatureFlags, logReminderEvent } from "../reminder-telemetry.js";
import { parseReminderQuickInput } from "../reminder-quick-parse.js";
import ReminderStatsPanel from "./reminder-stats-panel.jsx";
import AutoShrinkText from "./auto-shrink-text.jsx";
import { appendReminderStat, buildReminderStats, loadReminderStats, saveReminderStats } from "../reminder-stats.js";
import { activityDate } from "../date-utils.js";
import { getDisplayColor } from "../activity-colors.js";
import { layoutOverlaps } from "../timeline-layout.js";
import "../styles/reminder-material.css";
import {
  REMINDER_TYPE,
  isOneShotType,
  intervalMs,
  hasWindow,
  minuteOfDayAt,
  minutesFromHHMM,
  isMinuteWithinWindow,
  computeNextDueAt,
  isReminderDue
} from "../reminder-due-logic.js";

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

const ZOOM_LEVELS_MINUTES = [60, 15, 5, 1];
const DEFAULT_ZOOM_INDEX = ZOOM_LEVELS_MINUTES.indexOf(15);

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
// ตัวแปรใหม่ที่เพิ่มเข้ามาคู่กับ map นี้ (ดูใน <style> ด้านล่าง) ใช้ hex
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
  { type: REMINDER_TYPE.INTERVAL, label: "ทำซ้ำเป็นช่วง" },
  { type: REMINDER_TYPE.WEEKLY, label: "รายสัปดาห์" },
  { type: REMINDER_TYPE.EVENT_ANCHORED, label: "อิงเหตุการณ์" },
  { type: REMINDER_TYPE.ROUTINE, label: "รูทีน" },
  { type: REMINDER_TYPE.ONCE_AT, label: "ครั้งเดียว" },
  { type: REMINDER_TYPE.COUNTDOWN, label: "นับถอยหลัง" },
  { type: REMINDER_TYPE.STOPWATCH, label: "จับเวลา" }
];

const DAYS_OF_WEEK = [
  { label: "อา", value: 0 },
  { label: "จ", value: 1 },
  { label: "อ", value: 2 },
  { label: "พ", value: 3 },
  { label: "พฤ", value: 4 },
  { label: "ศ", value: 5 },
  { label: "ส", value: 6 }
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
const GROUP_COLOR_PALETTE = ["#4285f4", "#34a853", "#ea4335", "#f9ab00", "#a142f4", "#00bcd4", "#e91e63", "#8d6e63"];

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
      const dayNames = reminder.days?.map(d => DAYS_OF_WEEK.find(x => x.value === d)?.label).join(" ");
      return `วนสัปดาห์ · [${dayNames}] เวลา ${reminder.time}`;
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
      if (!reminder.enabled || !reminder.startedAt) {
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
function getReminderTimeSlots(reminder, startOfTodayMs) {
  // Snooze is a temporary replacement for the normal schedule. For example,
  // a weekly 09:00 reminder snoozed at 09:12 for 5 minutes must appear at
  // 09:17, not continue showing its original 09:00 slot on the timeline.
  if (reminder.snoozedUntil === reminder.nextDueAt && Number.isFinite(reminder.nextDueAt)) {
    const dueDay = new Date(reminder.nextDueAt);
    dueDay.setHours(0, 0, 0, 0);
    return dueDay.getTime() === startOfTodayMs ? [minuteOfDayAt(reminder.nextDueAt)] : [];
  }
  switch (reminder.type) {
    case REMINDER_TYPE.INTERVAL: {
      const stepMinutes = reminder.amount * (reminder.unit === "hours" ? 60 : 1);
      if (!stepMinutes || stepMinutes <= 0) return [];
      const slots = [];
      for (let m = 0; m < 1440; m += stepMinutes) {
        if (!hasWindow(reminder) || isMinuteWithinWindow(m, reminder.windowStart, reminder.windowEnd)) {
          slots.push(m);
        }
      }
      return slots;
    }
    case REMINDER_TYPE.WEEKLY: {
      return (reminder.times?.length ? reminder.times : [reminder.time]).filter(Boolean).map(minutesFromHHMM);
    }
    case REMINDER_TYPE.ONCE_AT: {
      if (!reminder.atMs) return [];
      const dayStart = new Date(reminder.atMs);
      dayStart.setHours(0, 0, 0, 0);
      if (dayStart.getTime() !== startOfTodayMs) return [];
      return [minuteOfDayAt(reminder.atMs)];
    }
    case REMINDER_TYPE.COUNTDOWN: {
      if (!reminder.startedAt || !reminder.durationMs) return [];
      const endMs = reminder.startedAt + reminder.durationMs;
      const dayStart = new Date(endMs);
      dayStart.setHours(0, 0, 0, 0);
      if (dayStart.getTime() !== startOfTodayMs) return [];
      return [minuteOfDayAt(endMs)];
    }
    case REMINDER_TYPE.EVENT_ANCHORED:
    case REMINDER_TYPE.ROUTINE:
    case REMINDER_TYPE.STOPWATCH:
    default:
      return [];
  }
}

const ROW_HEIGHT_PX = 32;

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
  onEditActivity,
  timelineColors
}) {
  // Runtime reminder state belongs to a person, not to this browser. The
  // previous shared key exposed the prior account's reminders after logout.
  const userStorageKey = `${STORAGE_KEY}:${firebaseUser?.uid || "guest"}`;
  const { reminders, setReminders, syncScheduleFields, deleteRemoteReminder } = useReminderStore({
    firebaseUser,
    storageKey: userStorageKey,
    defaultReminders: DEFAULT_REMINDERS,
    extractScheduleFields
  });
  const { groups, groupsError, addGroup, removeGroup } = useReminderGroups({ firebaseUser });
  const {
    permission: pushPermission,
    isEnabled: isPushEnabled,
    error: pushError,
    isRequesting: isPushRequesting,
    requestPermission: requestPushPermission,
    disableNotifications
  } = usePushNotifications({ firebaseUser });

  const [dueReminders, setDueReminders] = useState([]);
  const [omnibarEnabled, setOmnibarEnabled] = useState(false);
  const [omnibarInput, setOmnibarInput] = useState("");
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [statsEvents, setStatsEvents] = useState(() => loadReminderStats(firebaseUser?.uid));
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);

  useEffect(() => {
    getReminderFeatureFlags().then(({ omnibarEnabled: enabled }) => setOmnibarEnabled(enabled));
  }, []);

  const omnibarPreview = useMemo(() => parseReminderQuickInput(omnibarInput), [omnibarInput]);
  const reminderStats = useMemo(() => buildReminderStats(reminders, statsEvents), [reminders, statsEvents]);

  useEffect(() => {
    saveReminderStats(statsEvents, firebaseUser?.uid);
  }, [statsEvents, firebaseUser?.uid]);

  const recordStatsEvent = (type, payload) => {
    setStatsEvents((previous) => appendReminderStat(previous, type, payload));
  };

  const [draft, setDraft] = useState(createBlankDraft);

  const [editingId, setEditingId] = useState(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false); // composer เริ่มต้นแบบพับเก็บ ประหยัดพื้นที่

  // Tab ของรายการ reminder (migration plan v2 เฟส 1.2) — เดิมแสดง
  // active/paused พร้อมกันทั้งคู่คั่นด้วย section header, ตอนนี้เลือกดูได้
  // ทีละ tab แบบ mockup "completed" ยังเป็น placeholder เฉยๆ (รอ field
  // completedAt จริงจากเฟส 4) กด disabled ไว้ก่อน
  // สถานะของรายการที่กำลังแสดง ไม่ใช่ "active" ของ UI ทั่วไป.
  const [reminderStatusTab, setReminderStatusTab] = useState(REMINDER_STATUS_TAB.ENABLED);

  // ตัวกรองประเภทใน left nav (migration plan v2 เฟส 2) — null = ไม่กรอง
  // (แสดงทุกประเภท) client-side ล้วนๆ ไม่กระทบ backend หรือ query ใด ๆ
  const [activeTypeFilter, setActiveTypeFilter] = useState(null);
  const toggleTypeFilter = (type) => {
    setActiveTypeFilter((prev) => (prev === type ? null : type));
  };

  // ตัวกรองกลุ่ม/โปรเจกต์ (migration plan v2 เฟส 3) — ทำงานคู่ขนานกับ
  // activeTypeFilter (AND กัน ถ้าเปิดทั้งคู่พร้อมกัน) client-side เช่นกัน
  const [activeGroupFilter, setActiveGroupFilter] = useState(null);
  const toggleGroupFilter = (groupId) => {
    setActiveGroupFilter((prev) => (prev === groupId ? null : groupId));
  };

  // ฟอร์มสร้างกลุ่มใหม่แบบ inline ใน nav sidebar — เปิด/ปิดด้วยปุ่ม "+
  // เพิ่มกลุ่มใหม่" เก็บแค่ชื่อ (สีสุ่ม/วนจาก GROUP_COLOR_PALETTE อัตโนมัติ
  // ไม่ให้ผู้ใช้เลือกเอง เพื่อลดขั้นตอนเหลือแค่พิมพ์ชื่อ + Enter)
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLOR_PALETTE[0]);
  const submitNewGroup = async (event) => {
    event.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    try {
      await addGroup(trimmed, newGroupColor);
      setNewGroupName("");
      setIsAddingGroup(false);
    } catch {
      // groupsError จาก hook แสดงผลอยู่แล้วใน nav sidebar — ไม่ต้องทำอะไร
      // เพิ่มตรงนี้ แค่ไม่ปิดฟอร์มทิ้งเพื่อให้ผู้ใช้ลองใหม่ได้จากค่าที่พิมพ์ไว้เดิม
    }
  };

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
  const [cardMenuOpenId, setCardMenuOpenId] = useState(null);
  const [snoozeMenuForId, setSnoozeMenuForId] = useState(null);
  const closeAllMenus = () => {
    setCardMenuOpenId(null);
    setSnoozeMenuForId(null);
  };
  const [nowTick, setNowTick] = useState(() => Date.now()); // อัปเดตทุกวินาที เพื่อให้ countdown แสดงเวลานับถอยหลังแบบ live

  const tapeScrollRef = useRef(null);
  const isUserInteractingRef = useRef(false);
  const idleTimeoutRef = useRef(null);
  const hasSnappedInitiallyRef = useRef(false); // true = เคย sync ตำแหน่งกับเวลาจริงแล้ว รอบต่อไปให้ไหลต่อเนื่อง ไม่สแนปซ้ำ

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
    };

    checkDue();
    const interval = setInterval(checkDue, 1000);
    return () => clearInterval(interval);
  }, [reminders]);


  const minutesPerRow = ZOOM_LEVELS_MINUTES[zoomIndex];
  const totalRows = 1440 / minutesPerRow;
  const singleDayHeight = totalRows * ROW_HEIGHT_PX;

  // แสดงวันเดียว (00:00 - 24:00) ต่อ track เดียวเท่านั้น (ไม่ duplicate ข้อมูล/ไม่มีปัญหาสับสนวัน-เวลา)
  // แต่เพิ่ม "spacer" ว่างไว้ก่อนแถว 00:00 และหลังแถว 24:00 เพื่อยืดขอบออกไป
  // ทำให้ now-indicator เลื่อนเข้าใกล้ 00:00/24:00 ได้โดยไม่ชนขอบ scroll container จริง ๆ
  // spacer นี้เป็นพื้นที่เปิด (slot) เผื่อไว้ใส่ content อื่นในอนาคตได้ เช่น แบนเนอร์/โฆษณา
  const SPACER_HEIGHT_PX = 240; // ความสูง spacer แต่ละด้าน ปรับได้ตามพื้นที่ viewport

  const tapeRows = useMemo(() => {
    const rows = [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // เตรียม slot เวลาของ reminder ทุกตัวไว้ล่วงหน้า (ไม่สนใจ enabled/nextDueAt)
    // เพื่อให้ทุกประเภทที่มีเวลาตายตัวในแต่ละวัน ถูกปักหมุดให้เห็นบน timeline เสมอเวลาเลื่อนดู
    const reminderSlots = reminders.map((r) => ({
      reminder: r,
      minutes: getReminderTimeSlots(r, startOfToday)
    }));

    for (let i = 0; i < totalRows; i++) {
      const startMinute = i * minutesPerRow;
      const isMajor = startMinute % 60 === 0;
      const hours = Math.floor(startMinute / 60);
      const mins = startMinute % 60;
      const endMinute = startMinute + minutesPerRow;

      const label = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

      const flags = [];
      for (const { reminder, minutes } of reminderSlots) {
        for (const slotMinute of minutes) {
          if (slotMinute >= startMinute && slotMinute < endMinute) {
            flags.push(reminder);
            break; // กันไม่ให้ reminder เดียวกันถูกนับซ้ำในแถวเดียวกัน (เช่น interval ถี่กว่า minutesPerRow)
          }
        }
      }

      rows.push({
        key: `row-${startMinute}`,
        startMinute,
        isMajor,
        label,
        flags
      });
    }

    return rows;
  }, [reminders, minutesPerRow, totalRows]);

  // ให้ track กว้างตามจำนวน reminder ที่อยู่เวลาเดียวกัน เพื่อให้ผู้ใช้
  // เลื่อนดูทุก chip ทางแนวนอนได้ แทนการซ่อนรายการส่วนเกินในแต่ละแถว.
  const maxConcurrentReminderChips = useMemo(
    () => Math.max(1, ...tapeRows.map((row) => row.flags.length)),
    [tapeRows]
  );
  const timelineTrackMinWidth = 84 + (maxConcurrentReminderChips * 204) + 8;

  // Activity Mode และ Reminder Mode ใช้ข้อมูล Google Calendar ชุดเดียวกัน:
  // timeline นี้จึงแสดงเฉพาะกิจกรรมที่ทับกับ "วันนี้" และคำนวณตำแหน่งจาก
  // เวลาเริ่ม/จบจริง (รองรับกิจกรรมข้ามเที่ยงคืนด้วย) โดยไม่สร้างสำเนาข้อมูล
  // activity ไว้ใน reminder store อีกชุดหนึ่ง
  const calendarTimelineBlocks = useMemo(() => {
    const dayStart = new Date(nowTick);
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
    const pixelsPerMinute = ROW_HEIGHT_PX / minutesPerRow;

    const blocks = activities
      .map((activity) => {
        const start = activityDate(activity.start);
        if (!start || Number.isNaN(start.getTime())) return null;

        const parsedEnd = activityDate(activity.end);
        const end = parsedEnd && !Number.isNaN(parsedEnd.getTime())
          ? parsedEnd
          : new Date(start.getTime() + 30 * 60 * 1000);
        const actualStartMs = start.getTime();
        const actualEndMs = Math.max(end.getTime(), actualStartMs + 60 * 1000);
        const startMs = Math.max(actualStartMs, dayStartMs);
        const endMs = Math.min(actualEndMs, dayEndMs);
        if (endMs <= dayStartMs || startMs >= dayEndMs || endMs <= startMs) return null;

        const color = getDisplayColor(activity, activityCategoryMap, categories);
        const isActive = nowTick >= actualStartMs && nowTick < actualEndMs;
        const isUpcoming = nowTick < actualStartMs;
        const elapsedSeconds = Math.max(0, Math.floor((nowTick - actualStartMs) / 1000));
        const countdownSeconds = Math.max(0, Math.ceil((actualStartMs - nowTick) / 1000));
        return {
          id: activity.id,
          activity,
          title: activity.summary || "(ไม่มีชื่อกิจกรรม)",
          top: SPACER_HEIGHT_PX + ((startMs - dayStartMs) / 60000) * pixelsPerMinute,
          height: Math.max(22, ((endMs - startMs) / 60000) * pixelsPerMinute),
          startMin: (startMs - dayStartMs) / 60000,
          endMin: (endMs - dayStartMs) / 60000,
          color,
          actualStartMs,
          actualEndMs,
          isActive,
          isUpcoming,
          elapsedSeconds,
          countdownSeconds,
          remainingSeconds: Math.max(0, Math.ceil((actualEndMs - nowTick) / 1000))
        };
      })
      .filter(Boolean);

    // Match Week Spine's puzzle layout exactly: activities with intersecting
    // time ranges receive adjacent lanes instead of covering one another.
    const lanes = layoutOverlaps(blocks.map((block) => ({
      id: block.id,
      startMin: block.startMin,
      endMin: block.endMin
    })));
    return blocks.map((block) => ({
      ...block,
      stackIndex: lanes[block.id]?.stackIndex || 0,
      hidden: lanes[block.id]?.hidden || false,
      hiddenCount: lanes[block.id]?.hiddenCount || 0,
      laneCount: lanes[block.id]?.columns || 1,
      stackZ: lanes[block.id]?.stackZ || 1,
      titleBelow: lanes[block.id]?.titleBelow || false,
      titleOffsetMinutes: lanes[block.id]?.titleOffsetMinutes || 0
    }));
  }, [activities, activityCategoryMap, categories, minutesPerRow, nowTick, SPACER_HEIGHT_PX]);

  // แถบสีของ Timer/Stopwatch เป็นคนละ layer กับ now-indicator และ Activity:
  // countdown แสดงช่วงเริ่มจนถึงเวลาสิ้นสุด, stopwatch แสดงช่วงเริ่มจนถึง
  // เวลาปัจจุบันเท่านั้น จึงไม่ไปเปลี่ยนความหมายของเส้น now-indicator เลย.
  const runningReminderSpans = useMemo(() => {
    const dayStart = new Date(nowTick);
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
    const pixelsPerMinute = ROW_HEIGHT_PX / minutesPerRow;

    return reminders.flatMap((reminder) => {
      if (!reminder.enabled || !reminder.startedAt) return [];
      const isCountdown = reminder.type === REMINDER_TYPE.COUNTDOWN;
      const isStopwatch = reminder.type === REMINDER_TYPE.STOPWATCH;
      if (!isCountdown && !isStopwatch) return [];

      const actualEndMs = isCountdown
        ? reminder.startedAt + (reminder.durationMs || 0)
        : nowTick;
      if (actualEndMs <= reminder.startedAt || actualEndMs <= dayStartMs || reminder.startedAt >= dayEndMs) return [];

      // Timer ต้องหดเข้าหาเวลาจบ: จุดเริ่มของแถบจึงตาม nowTick เสมอ
      // ขณะที่ Stopwatch ยืดจากจุดเริ่มมาหา nowTick.
      const startMs = Math.max(
        isCountdown ? nowTick : reminder.startedAt,
        dayStartMs
      );
      const endMs = Math.min(actualEndMs, dayEndMs);
      if (endMs <= startMs) return [];
      return [{
        id: reminder.id,
        title: reminder.title,
        type: reminder.type,
        top: SPACER_HEIGHT_PX + ((startMs - dayStartMs) / 60000) * pixelsPerMinute,
        height: Math.max(4, ((endMs - startMs) / 60000) * pixelsPerMinute),
        color: reminder.lineColor || DEFAULT_LINE_COLOR
      }];
    });
  }, [reminders, nowTick, minutesPerRow, SPACER_HEIGHT_PX]);

  // ข้อความบน now-indicator สงวนไว้ให้สถานะของ Activity เท่านั้น:
  // ถ้ามีกิจกรรมกำลังทำให้ความสำคัญกับเวลาที่เหลือก่อนจบ; ถ้าไม่มีจึงแสดง
  // เวลาที่เหลือก่อนถึงกิจกรรมถัดไป.
  const activityNowStatus = useMemo(() => {
    const active = calendarTimelineBlocks.find((block) => block.isActive);
    if (active) {
      return { title: active.title, text: `จะจบใน ${formatDurationClock(active.remainingSeconds)}`, color: active.color };
    }
    const next = calendarTimelineBlocks
      .filter((block) => block.isUpcoming)
      .sort((a, b) => a.actualStartMs - b.actualStartMs)[0];
    return next
      ? { title: next.title, text: `จะถึงใน ${formatDurationClock(next.countdownSeconds)}`, color: next.color }
      : null;
  }, [calendarTimelineBlocks]);

  // ตำแหน่ง scrollTop ที่ต้องการ ให้ now-indicator อยู่กลาง container พอดี
  // ต้องบวก SPACER_HEIGHT_PX เข้าไปด้วย เพราะแถว 00:00 ไม่ได้เริ่มที่ scrollTop=0 อีกต่อไป
  // แต่เริ่มหลัง spacer บนไปแล้ว จึงไม่ต้อง clamp ที่ขอบเหมือนเดิม (spacer ทำหน้าที่กันชนแทน)
  const calculateTargetScrollTop = () => {
    if (!tapeScrollRef.current) return 0;
    const now = new Date();

    // คำนวณจำนวนนาทีทั้งหมดนับตั้งแต่เที่ยงคืนของวันนี้ (00:00)
    const currentExactMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;

    const containerHeight = tapeScrollRef.current.clientHeight;
    const currentDayOffset = (currentExactMinutes / 1440) * singleDayHeight;

    // ตำแหน่งที่อยากได้คือ now-indicator อยู่กลาง container พอดี โดยนับ offset จาก spacer บนด้วย
    const idealScrollTop = SPACER_HEIGHT_PX + currentDayOffset - containerHeight / 2;

    // Track ตอนนี้คือ [spacer บน][00:00 ... 24:00][spacer ล่าง]
    // ยังคง clamp ไว้ไม่ให้ scroll เลยขอบจริงของ DOM (0 ถึง totalHeight - containerHeight)
    // แต่เพราะมี spacer คั่นแล้ว ในทางปฏิบัติ now-indicator จะไม่มีวันไปติดขอบใกล้ 00:00/24:00 อีก
    const totalHeight = SPACER_HEIGHT_PX * 2 + singleDayHeight;
    const maxScrollTop = Math.max(0, totalHeight - containerHeight);
    return Math.min(Math.max(idealScrollTop, 0), maxScrollTop);
  };

  // Auto-scroll Engine: ไหลต่อเนื่องด้วย deltaMs จริง (เหมือนน้ำไหล) + Drift Correction แบบนุ่มนวล
  // อ้างอิงตามขั้นตอนวิธีแก้ไขปัญหา: คำนวณ deltaMs จาก requestAnimationFrame แล้วขยับ scrollTop ไปข้างหน้า
  // ตามสเกลเวลาอย่างต่อเนื่อง (ไม่ใช่กระโดดสแนป) ส่วน Drift Correction แยกออกมาทำงานเฉพาะตอนคลาดเคลื่อนเกิน 5px
  // แล้วดึงกลับแบบนุ่มนวลด้วย drift * 0.1 (ไม่ปรับพรวดพราดทุกเฟรม) กัน floating-point drift สะสมระยะยาว
  useEffect(() => {
    let rafId;
    let lastFrameTime = null;
    const pxPerMs = (singleDayHeight / 1440) / 60000; // px ต่อ นาที ÷ 60000ms = px ต่อ ms

    const tick = (frameTime) => {
      if (tapeScrollRef.current) {
        if (isUserInteractingRef.current) {
          // ผู้ใช้กำลังลาก/ไถอยู่: ไม่ขยับเอง แต่รีเซ็ต lastFrameTime ไว้ กันไม่ให้กระโดดตอนปล่อยมือ
          lastFrameTime = null;
        } else if (!hasSnappedInitiallyRef.current) {
          // ครั้งแรกหลัง mount/เปลี่ยน zoom หรือเพิ่งเลิกลากด้วยมือ: sync ตำแหน่งให้ตรงเวลาจริงก่อนหนึ่งครั้ง
          // (คำนวณจาก wall-clock ตรง ๆ เพื่อความแม่นยำ) จากนั้นค่อยไหลต่อด้วยความเร็วคงที่ทุกเฟรม
          tapeScrollRef.current.scrollTop = calculateTargetScrollTop();
          hasSnappedInitiallyRef.current = true;
          lastFrameTime = frameTime;
        } else if (lastFrameTime !== null) {
          const deltaMs = frameTime - lastFrameTime;
          // ไหล scrollTop ไปข้างหน้าตามเวลาที่ผ่านไปจริงระหว่างเฟรม (ไม่ใช่ก้อนคงที่ต่อเฟรม)
          // จึงลื่นสม่ำเสมอไม่ว่าเฟรมเรตจะแกว่งแค่ไหน และไม่มีการ "กระโดดแก้ตำแหน่ง" เป็นระยะ ๆ อีกต่อไป
          tapeScrollRef.current.scrollTop += deltaMs * pxPerMs;
          lastFrameTime = frameTime;

          // Drift Correction: ทำงานเฉพาะตอนคลาดเคลื่อนเกิน 5px (กัน floating-point drift สะสมระยะยาว)
          // ดึงกลับแบบนุ่มนวลทีละ 10% ของระยะที่คลาดเคลื่อน ไม่กระโดดพรวดพราดทุกเฟรม จึงไม่รู้สึกสะดุด
          const trueTarget = calculateTargetScrollTop();
          const drift = trueTarget - tapeScrollRef.current.scrollTop;
          if (Math.abs(drift) > 5) {
            tapeScrollRef.current.scrollTop += drift * 0.1;
          }
        } else {
          lastFrameTime = frameTime;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [minutesPerRow, singleDayHeight]);

  const handleUserInteraction = () => {
    isUserInteractingRef.current = true;

    // เคลียร์ Timeout เก่าทิ้งก่อนทุกครั้งที่ขยับจอ
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    // ตั้งเวลาถอยหลัง (Idle Timeout) 3 วินาที นับจากขยับครั้งสุดท้าย ตามที่ระบุในขั้นตอนวิธีแก้ไขปัญหา
    idleTimeoutRef.current = setTimeout(() => {
      isUserInteractingRef.current = false;
      // รีเซ็ตให้ rAF loop sync ตำแหน่งกับเวลาจริงอีกครั้งหนึ่งครั้งก่อน (กันคลาดเคลื่อนจากตอนลาก)
      // แล้วค่อยกลับไปไหลต่อเนื่องด้วยความเร็วคงที่ตามปกติ ไม่ใช่กระโดดดีดทุกครั้งที่ปล่อยมือ
      hasSnappedInitiallyRef.current = false;
    }, 3000);
  };

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
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;
        if (typeof snoozeMinutes === "number") {
          logReminderEvent("reminder_snoozed", { reminder_type: r.type, snooze_minutes: snoozeMinutes });
          recordStatsEvent("snoozed", { title: r.title, reminderType: r.type, minutes: snoozeMinutes });
          return { ...r, enabled: true, nextDueAt: snoozedUntil, snoozedUntil };
        }
        if (isOneShotType(r.type)) return { ...r, enabled: false, nextDueAt: Infinity };
        return { ...r, snoozedUntil: null, nextDueAt: computeNextDueAt(r, Date.now()) };
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
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;
        if (isOneShotType(r.type)) {
          logReminderEvent("reminder_completed", { reminder_type: r.type });
          recordStatsEvent("completed", { title: r.title, reminderType: r.type });
          return { ...r, completedAt: Date.now(), enabled: false, nextDueAt: Infinity, snoozedUntil: null };
        }
        logReminderEvent("reminder_completed", { reminder_type: r.type });
        recordStatsEvent("completed", { title: r.title, reminderType: r.type });
        return { ...r, snoozedUntil: null, nextDueAt: computeNextDueAt(r, Date.now()) };
      })
    );
  };

  const triggerAnchorEvent = (reminderId) => {
    const now = Date.now();
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;
        const updated = { ...r, lastTriggeredAt: now, enabled: true };
        return { ...updated, nextDueAt: computeNextDueAt(updated, now) };
      })
    );
  };

  const advanceRoutine = (reminderId) => {
    setReminders((prev) =>
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
    setReminders((prev) =>
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
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId || r.type !== REMINDER_TYPE.STOPWATCH) return r;
        return { ...r, enabled: false, accumulatedMs: 0, startedAt: null };
      })
    );
  };

  const toggle = (reminderId) => {
    setReminders((prev) =>
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

    let newReminder = {
      id: editingId || `reminder-${Date.now()}`,
      title: draft.title,
      type: draft.type,
      enabled: true,
      groupId: draft.groupId ?? null // migration plan v2 เฟส 3
    };

    if (draft.type === REMINDER_TYPE.INTERVAL) {
      newReminder.amount = parseInt(draft.amount) || 30;
      newReminder.unit = draft.unit;
      if (!draft.runAllDay && draft.windowStart && draft.windowEnd) {
        newReminder.windowStart = draft.windowStart;
        newReminder.windowEnd = draft.windowEnd;
      } else {
        // ต้องเขียน null อย่างชัดเจน ไม่ใช่ปล่อย field หายไป: ตอนแก้ไข
        // state ถูก merge กับ reminder เก่า จึงจะล้างช่วงเวลาจำกัดเดิมได้
        // ทั้งใน local state และ Firestore mirror.
        newReminder.windowStart = null;
        newReminder.windowEnd = null;
      }
    } else if (draft.type === REMINDER_TYPE.WEEKLY) {
      newReminder.days = draft.days;
      newReminder.times = [...new Set((draft.times || [draft.time]).filter(Boolean))].sort();
      newReminder.time = newReminder.times[0] || "08:00";
    } else if (draft.type === REMINDER_TYPE.EVENT_ANCHORED) {
      newReminder.eventName = draft.eventName || "เหตุการณ์หลัก";
      newReminder.afterAmount = parseInt(draft.afterAmount) || 1;
      newReminder.afterUnit = draft.afterUnit;
      newReminder.lastTriggeredAt = null;
      newReminder.enabled = false;
    } else if (draft.type === REMINDER_TYPE.ROUTINE) {
      newReminder.steps = draft.routineSteps.split(",").map((s) => s.trim()).filter(Boolean);
      newReminder.currentIndex = 0;
    } else if (draft.type === REMINDER_TYPE.ONCE_AT) {
      if (!draft.atDate || !draft.atTime) {
        alert("กรุณากำหนดวันที่และเวลา");
        return;
      }
      const atMs = new Date(`${draft.atDate}T${draft.atTime}:00`).getTime();
      // เช็คเดียวกับที่ toggle() ทำตอนเปิดสวิตช์กลับ (บรรทัดด้านบนในไฟล์นี้)
      // — เดิมจุดสร้างใหม่ผ่านฟอร์มไม่เช็คเงื่อนไขนี้เลย ทำให้เลือกวันที่/
      // เวลาที่ผ่านไปแล้วโดยไม่ตั้งใจได้ reminder ที่ enabled: true พร้อม
      // nextDueAt เป็นอดีตทันที แล้วเด้ง banner "ถึงเวลาแล้ว" ทันทีที่บันทึก
      // โดยไม่มีการเตือนล่วงหน้าเลย เช็คเฉพาะตอน "สร้างใหม่" เท่านั้น
      // (ไม่ใช่ !editingId) — ตอนแก้ไข reminder เดิม (เช่นแค่แก้ชื่อ) ที่
      // atDate/atTime เดิมผ่านไปแล้วอยู่ก่อนแล้วต้องยังบันทึกได้ ไม่งั้นจะ
      // ติดล็อกแก้อะไรไม่ได้เลยจนกว่าจะเปลี่ยนวันที่ใหม่ก่อน
      if (!editingId && atMs <= Date.now()) {
        alert("เวลาที่เลือกผ่านไปแล้ว กรุณาเลือกวันที่และเวลาในอนาคต");
        return;
      }
      newReminder.atMs = atMs;
    } else if (draft.type === REMINDER_TYPE.COUNTDOWN) {
      const minutes = parseInt(draft.countdownMinutes) || 20;
      const durationMs = minutes * 60 * 1000;
      newReminder.durationMs = durationMs;
      newReminder.startedAt = Date.now();
      newReminder.lineColor = draft.lineColor || DEFAULT_LINE_COLOR;
    } else if (draft.type === REMINDER_TYPE.STOPWATCH) {
      newReminder.lineColor = draft.lineColor || DEFAULT_LINE_COLOR;
      if (editingId) {
        // แก้ไข stopwatch ที่มีอยู่แล้ว (เช่น แก้แค่ชื่อ) ต้องคงเวลาที่จับไว้/สถานะ running เดิมไว้
        // ไม่รีเซ็ตกลับเป็น 0 หรือหยุดโดยไม่ตั้งใจ
        const existing = reminders.find((r) => r.id === editingId);
        newReminder.accumulatedMs = existing?.accumulatedMs || 0;
        newReminder.startedAt = existing?.startedAt || null;
        newReminder.enabled = existing?.enabled || false;
      } else {
        // สร้างใหม่แบบ "หยุดอยู่ที่ 0" ให้ผู้ใช้กด Start เองทีหลัง (ไม่ auto-run ตอนสร้าง)
        newReminder.accumulatedMs = 0;
        newReminder.startedAt = null;
        newReminder.enabled = false;
      }
    }

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
      const existing = reminders.find((r) => r.id === editingId);
      newReminder.completedAt = existing?.completedAt ?? null;
      if (newReminder.type === REMINDER_TYPE.ROUTINE) {
        newReminder.completionCount = Number.isInteger(existing?.completionCount) ? existing.completionCount : 0;
      }
    } else {
      newReminder.completedAt = null;
      if (newReminder.type === REMINDER_TYPE.ROUTINE) newReminder.completionCount = 0;
    }

    if (editingId) {
      setReminders((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...newReminder } : r)));
      setEditingId(null);
    } else {
      setReminders((prev) => [...prev, newReminder]);
      logReminderEvent("reminder_created", { reminder_type: newReminder.type });
    }

    // Sync schedule fields ขึ้น Firebase — immediate: true เพราะนี่คือ
    // ตอน submit ฟอร์มจริง (กดปุ่ม "สร้าง"/"บันทึกการแก้ไข") ไม่ใช่ตอน
    // พิมพ์ใน draft ระหว่างทาง จึงไม่ต้อง debounce
    syncScheduleFields(newReminder.id, extractScheduleFields(newReminder), { immediate: true });

    setDraft(createBlankDraft());
    setIsComposerOpen(false); // บันทึกเสร็จแล้วพับ composer กลับ คืนพื้นที่ให้ list
  };

  // Phase 6: คำสั่งที่ parser เข้าใจจะสร้าง reminder ทันที; คำสั่งที่ยังไม่
  // เข้าใจจะไม่เดาเอง แต่เปิด composer พร้อมข้อความเดิมให้ผู้ใช้ตรวจต่อ.
  const submitOmnibar = () => {
    const title = omnibarInput.trim();
    if (!title) return;

    if (!omnibarPreview.matched) {
      setEditingId(null);
      setDraft({ ...createBlankDraft(), title });
      setIsComposerOpen(true);
      return;
    }

    const parsed = omnibarPreview.reminder;
    const now = Date.now();
    const reminder = {
      id: `reminder-${now}`,
      title: parsed.title,
      type: parsed.type,
      enabled: true,
      groupId: null,
      completedAt: null
    };

    if (parsed.type === REMINDER_TYPE.INTERVAL) {
      reminder.amount = parsed.amount;
      reminder.unit = parsed.unit;
    } else if (parsed.type === REMINDER_TYPE.WEEKLY) {
      reminder.days = parsed.days;
      reminder.time = parsed.time;
    } else if (parsed.type === REMINDER_TYPE.COUNTDOWN) {
      reminder.durationMs = parsed.minutes * 60 * 1000;
      reminder.startedAt = now;
      reminder.lineColor = DEFAULT_LINE_COLOR;
    }

    reminder.nextDueAt = reminder.type === REMINDER_TYPE.INTERVAL
      ? null
      : computeNextDueAt(reminder, now);
    setReminders((prev) => [...prev, reminder]);
    syncScheduleFields(reminder.id, extractScheduleFields(reminder), { immediate: true });
    logReminderEvent("reminder_created", { reminder_type: reminder.type, creation_method: "omnibar" });
    setOmnibarInput("");
  };

  const deleteReminder = (reminderId) => {
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    deleteRemoteReminder(reminderId);
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
  const enabledReminders = reminders.filter((r) => r.enabled && !r.completedAt);
  const pausedReminders = reminders.filter((r) => !r.enabled && !r.completedAt);
  const completedReminders = reminders.filter((r) => !!r.completedAt);
  const filterByType = (list) => (activeTypeFilter ? list.filter((r) => r.type === activeTypeFilter) : list);
  const filterByGroup = (list) => (activeGroupFilter ? list.filter((r) => r.groupId === activeGroupFilter) : list);
  const applyFilters = (list) => filterByGroup(filterByType(list));
  const visibleEnabledReminders = applyFilters(enabledReminders);
  const visiblePausedReminders = applyFilters(pausedReminders);
  const visibleCompletedReminders = applyFilters(completedReminders);

  /** ข้อความอธิบาย filter ที่กำลังเปิดอยู่ (ทั้งคู่พร้อมกันได้) สำหรับ empty-state — คืน "" ถ้าไม่มี filter ใดเปิดอยู่เลย */
  const describeActiveFilters = () => {
    const parts = [];
    if (activeTypeFilter) parts.push(`ประเภท "${TYPE_FILTER_OPTIONS.find((o) => o.type === activeTypeFilter)?.label}"`);
    if (activeGroupFilter) parts.push(`กลุ่ม "${groups.find((g) => g.id === activeGroupFilter)?.name}"`);
    return parts.join(" ");
  };

  const zoomOut = () => setZoomIndex(Math.max(0, zoomIndex - 1));
  const zoomIn = () => setZoomIndex(Math.min(ZOOM_LEVELS_MINUTES.length - 1, zoomIndex + 1));

  const renderReminder = (reminder) => (
    <div
      key={reminder.id}
      className={`reminder-card ${reminder.enabled ? "active" : ""}${cardMenuOpenId === reminder.id ? " menu-open" : ""}`}
      style={{ borderLeftColor: TYPE_ACCENT_COLOR[reminder.type] }}
    >
      <div
        className="reminder-type-icon"
        style={{ backgroundColor: TYPE_ACCENT_COLOR[reminder.type], color: getTypeIconTextColor(reminder.type) }}
      >
        {reminder.type === REMINDER_TYPE.WEEKLY ? "📅" :
         reminder.type === REMINDER_TYPE.EVENT_ANCHORED ? "⚓" :
         reminder.type === REMINDER_TYPE.ROUTINE ? "📋" :
         reminder.type === REMINDER_TYPE.ONCE_AT ? "1x" : 
         reminder.type === REMINDER_TYPE.COUNTDOWN ? "⏱" :
         reminder.type === REMINDER_TYPE.STOPWATCH ? "⏱️" : "↻"}
      </div>
      <div className="reminder-info">
        <p className="title">{reminder.title}</p>
        <p className="meta">{describeReminder(reminder, nowTick)}</p>
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
        {reminder.groupId && groups.find((g) => g.id === reminder.groupId) && (
          <span className="reminder-group-chip">
            <span
              className="reminder-group-chip-dot"
              style={{ background: groups.find((g) => g.id === reminder.groupId).color }}
            />
            {groups.find((g) => g.id === reminder.groupId).name}
          </span>
        )}

        {reminder.type === REMINDER_TYPE.EVENT_ANCHORED && (
          <button type="button" className="btn-action-small" onClick={() => triggerAnchorEvent(reminder.id)}>
            ⚡ เริ่มเหตุการณ์ "{reminder.eventName}"
          </button>
        )}

        {reminder.type === REMINDER_TYPE.ROUTINE && reminder.enabled && (
          <button type="button" className="btn-action-small" onClick={() => advanceRoutine(reminder.id)}>
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

      <div className={`reminder-card-actions ${cardMenuOpenId === reminder.id ? "menu-open" : ""}`}>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setCardMenuOpenId(cardMenuOpenId === reminder.id ? null : reminder.id)}
          title="ตัวเลือกเพิ่มเติม"
          aria-haspopup="true"
          aria-expanded={cardMenuOpenId === reminder.id}
        >
          ⋮
        </button>
        {cardMenuOpenId === reminder.id && (
          <div className="card-dropdown-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setCardMenuOpenId(null); startEdit(reminder); }}>
              ✏️ แก้ไข
            </button>
            {/* migration plan v2 เฟส 4 — mark เสร็จเองได้โดยไม่ต้องรอถึงเวลา
                due-banner จำกัดเฉพาะ one-shot type (once-at/countdown)
                เท่านั้น เพราะ type วนซ้ำ "ทำเสร็จแล้ว" มีความหมายเท่ากับ
                "เตือนอีกครั้ง" อยู่แล้ว (ดู markCompleted's comment) กด
                ก่อนถึงเวลาจริงจากตรงนี้จึงจะดูสมเหตุสมผลเฉพาะ type ที่จบ
                แบบถาวรได้เท่านั้น ไม่แสดงถ้าทำเสร็จไปแล้ว (ป้องกันกดซ้ำ) */}
            {isOneShotType(reminder.type) && !reminder.completedAt && (
              <button type="button" role="menuitem" onClick={() => { setCardMenuOpenId(null); markCompleted(reminder.id); }}>
                ✓ ทำเสร็จแล้ว
              </button>
            )}
            <button type="button" role="menuitem" className="is-danger" onClick={() => { setCardMenuOpenId(null); deleteReminder(reminder.id); }}>
              🗑️ ลบ
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="reminder-app-container"
      style={{
        "--timeline-now-color": timelineColors?.nowIndicator || "#ea4335"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@400;500&family=Roboto+Mono:wght@500&display=swap');

        * { box-sizing: border-box; }
        
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
        }

        .reminder-app-container {
          --g-blue: #1a73e8;
          --g-blue-hover: #1557b0;
          --g-blue-light: #e8f0fe;
          --g-red: #ea4335;
          --g-yellow: #fbbc04;
          --g-green: #34a853;
          /* เพิ่มเข้ามาคู่กับ TYPE_ACCENT_COLOR (migration plan v2 เฟส 1.4)
             — hex เดียวกับ "ม่วง"/"ฟ้าอมเขียว" ใน LINE_COLOR_OPTIONS ไม่ได้
             คิดโทนใหม่ ตามหลักเดียวกับ --g-yellow/--g-red/--g-green ข้างบน
             ที่ไม่ปรับตาม dark mode (อ่านออกบนพื้นมืดได้อยู่แล้ว) */
          --g-purple: #a142f4;
          --g-teal: #00bcd4;
          --g-surface: #ffffff;
          --g-background: #f8f9fa;
          --g-on-surface: #202124;
          --g-on-surface-variant: #5f6368;
          --g-outline: #dadce0;
          --g-outline-variant: #e8eaed;
          /* ฟิลด์เพิ่มเติมสำหรับสี hover/active ที่เดิม hardcode เป็น hex
             ตรงๆ ในหลายจุดด้านล่าง (ไม่เคยผ่าน --g-* เลย) — ดึงมาเป็นตัวแปร
             ตรงนี้เพื่อให้ dark-mode override block ด้านล่างจัดการได้ที่
             จุดเดียว แทนที่จะต้องไล่แก้ hex ทีละจุดในกฎที่กระจายอยู่ทั่วไฟล์ */
          --g-blue-light-hover: #d2e3fc;
          --g-red-light: #fce8e6;
          --g-red-light-border: #f5c6cb;
          --g-red-dark: #c5221f;
          --g-red-light-hover: #fad2cf;
          --g-active-bg: #fef7e0;
          --g-active-border: #fde293;
          --g-toggle-off: #bdc1c6;
          --g-major-hour-tint: rgba(248, 249, 250, 0.6);

          font-family: 'Google Sans', 'Roboto', -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-height: 100vh;
          background-color: var(--g-background);
          color: var(--g-on-surface);
          overflow: hidden;
        }

        /* Dark mode — reminder mode มี custom property namespace ของตัวเอง
           (--g-*) แยกจาก --bg/--text-primary/ฯลฯ ที่เหลือทั้งแอปใช้ (ดู
           index.css's html[data-theme="dark"] block) เพราะ style block นี้
           ถูกเขียนแบบ self-contained ตั้งแต่ตอนยังเป็น mockup แยกเดี่ยว —
           แทนที่จะไล่เปลี่ยนทุก var(--g-...) ในไฟล์นี้ (700+ บรรทัด) ให้ไป
           อ้าง --bg/--text-primary/ฯลฯ ตรงๆ ซึ่งเสี่ยง regression สูงและ
           breaking การ preview เป็น standalone component ในอนาคต แค่ override
           ค่าของ --g-* เองที่นี่ตาม data-theme ก็พอ — ทุกกฎที่เหลือด้านล่าง
           ที่อ้างอิงผ่าน var(--g-...) อยู่แล้วจะเปลี่ยนตามอัตโนมัติ พาเลท
           อ้างอิงจาก index.css's dark block (--bg: #202124, --bg-muted:
           #2d2e30, --text-primary: #e8eaed, --text-secondary: #9aa0a6,
           --border: #4a4d51) เพื่อให้โทนสีเข้ากับส่วนอื่นของแอป ไม่ใช่คิด
           พาเลทใหม่แยกต่างหาก
           สีใน semantic accent (--g-yellow, --g-red, --g-green หลัก) คงค่า
           เดิมไว้เกือบทั้งหมด ตามหลักเดียวกับที่ index.css บอกไว้ (ยังอ่าน
           ออกบนพื้นมืดได้อยู่แล้ว การปรับจะต้องเช็ค contrast ใหม่ทุกจุดที่
           ใช้ ซึ่งเกินขอบเขตของรอบนี้) */
        html[data-theme="dark"] .reminder-app-container {
          --g-surface: #2d2e30;
          --g-background: #202124;
          --g-on-surface: #e8eaed;
          --g-on-surface-variant: #9aa0a6;
          --g-outline: #4a4d51;
          --g-outline-variant: #35363a;
          --g-blue-light: #1a2b47;
          --g-blue-light-hover: #223a5e;
          --g-red-light: #3c1c1c;
          --g-red-light-border: #5c2b2b;
          --g-red-dark: #f28b82;
          --g-red-light-hover: #4a2424;
          --g-active-bg: #3a341a;
          --g-active-border: #5c4f22;
          --g-toggle-off: #5f6368;
          --g-major-hour-tint: rgba(255, 255, 255, 0.04);
        }

        .due-alert-banner {
          background: var(--g-red-light);
          border-bottom: 1px solid var(--g-red-light-border);
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: var(--g-red-dark);
          font-size: 14px;
          font-weight: 500;
          flex-shrink: 0;
        }

        .due-alert-actions {
          display: flex;
          gap: 8px;
        }

        .btn-snooze {
          background: var(--g-surface);
          border: 1px solid var(--g-red-light-border);
          color: var(--g-red-dark);
          padding: 6px 14px;
          border-radius: 18px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }

        .btn-snooze:hover {
          background: var(--g-red-light);
        }

        .due-alert-item-actions {
          display: flex;
          gap: 6px;
        }

        /* Backdrop โปร่งใสเต็มจอ ปิดเมนูเมื่อคลิกข้างนอก (เฟส 1.3/1.4) */
        .dropdown-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
        }

        .snooze-dropdown-wrap {
          position: relative;
        }

        .snooze-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          z-index: 50;
          background: var(--g-surface);
          border: 1px solid var(--g-outline);
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(60,64,67,0.18);
          padding: 4px;
          display: flex;
          flex-direction: column;
          min-width: 140px;
        }

        .snooze-menu button {
          background: none;
          border: none;
          text-align: left;
          padding: 7px 10px;
          border-radius: 6px;
          font-family: inherit;
          font-size: 13px;
          color: var(--g-on-surface);
          cursor: pointer;
        }

        .snooze-menu button:hover {
          background: var(--g-background);
        }

        .btn-mark-done {
          background: #1e8e3e;
          border: 1px solid #188038;
          color: #fff;
          padding: 7px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 2px 5px rgba(24, 128, 56, 0.30);
          transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        }

        .btn-mark-done:hover {
          background: #188038;
          box-shadow: 0 3px 8px rgba(24, 128, 56, 0.38);
          transform: translateY(-1px);
        }

        .btn-mark-done:focus-visible {
          outline: 3px solid color-mix(in srgb, #1e8e3e 38%, transparent);
          outline-offset: 2px;
        }

        .btn-mark-done:active {
          transform: translateY(0);
          box-shadow: 0 1px 3px rgba(24, 128, 56, 0.30);
        }

        /* Top bar — เพิ่มเข้ามาในรอบ layout-only ของ migration plan v2 เฟส 1
           (โครง 3 คอลัมน์ + top bar) โลโก้/omnibar/ปุ่มสถิติเป็น placeholder
           ล้วนๆ ในรอบนี้ ยังไม่ผูก logic จริง — omnibar รอเฟส 6, สถิติรอ
           เฟส 7 ปุ่มตั้งค่าตั้งใจไม่ใส่ซ้ำที่นี่ เพราะ app.jsx render ปุ่ม
           settings ของตัวเองอยู่แล้วเป็นปุ่มเดียวฝั่งขวาบนตอนอยู่ใน
           reminder mode (ดู settings-drawer.jsx's module comment) */
        .app-topbar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 10px 24px;
          border-bottom: 1px solid var(--g-outline-variant);
          background: var(--g-surface);
          flex-shrink: 0;
        }

        .topbar-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 16px;
          color: var(--g-on-surface);
          white-space: nowrap;
        }

        .topbar-logo-icon {
          font-size: 18px;
        }

        .topbar-omnibar-wrap {
          flex: 1;
          max-width: 560px;
          margin: 0 auto;
          position: relative;
        }

        .topbar-omnibar {
          width: 100%;
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid var(--g-outline);
          background: var(--g-background);
          color: var(--g-on-surface-variant);
          font-size: 13px;
          font-family: inherit;
        }

        .topbar-omnibar:disabled {
          cursor: not-allowed;
          opacity: 0.75;
        }

        .omnibar-preview {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px 8px 14px;
          border: 1px solid var(--g-outline);
          border-radius: 10px;
          background: var(--g-surface);
          color: var(--g-on-surface-variant);
          box-shadow: 0 5px 14px rgba(60, 64, 67, 0.18);
          font-size: 12px;
        }

        .omnibar-preview.is-matched {
          border-color: var(--g-blue);
          color: var(--g-on-surface);
        }

        .omnibar-preview button {
          flex-shrink: 0;
          border: 0;
          border-radius: 7px;
          padding: 5px 9px;
          background: var(--g-blue);
          color: #fff;
          cursor: pointer;
          font: inherit;
          font-weight: 600;
        }

        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .topbar-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: var(--g-on-surface-variant);
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .topbar-icon-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .topbar-icon-btn.is-active {
          background: var(--g-blue-light);
          color: var(--g-blue);
        }

        .reminder-stats-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(32, 33, 36, 0.34);
        }

        .reminder-stats-panel {
          width: min(520px, 100%);
          padding: 22px;
          border-radius: 16px;
          background: var(--g-surface);
          box-shadow: 0 16px 44px rgba(0, 0, 0, 0.28);
          color: var(--g-on-surface);
        }

        .reminder-stats-panel header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .reminder-stats-panel header p { margin: 0; font-size: 18px; font-weight: 700; }
        .reminder-stats-panel header span, .reminder-stats-note { color: var(--g-on-surface-variant); font-size: 12px; }
        .reminder-stats-panel header button { border: 0; background: none; font-size: 25px; line-height: 1; cursor: pointer; color: var(--g-on-surface-variant); }
        .reminder-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; }
        .reminder-stats-grid article { display: grid; gap: 3px; padding: 12px 8px; border-radius: 10px; background: var(--g-background); text-align: center; }
        .reminder-stats-grid strong { font-size: 22px; color: var(--g-blue); }
        .reminder-stats-grid span { color: var(--g-on-surface-variant); font-size: 11px; }
        .reminder-stats-details { margin: 18px 0; }
        .reminder-stats-details div { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--g-outline-variant); font-size: 13px; }
        .reminder-stats-details dt { color: var(--g-on-surface-variant); }
        .reminder-stats-details dd { margin: 0; text-align: right; font-weight: 600; }
        .reminder-stats-note { margin: 0; line-height: 1.45; }

        /* Left nav — "ตัวกรองประเภท" wired จริงแล้ว (เฟส 2) filter แบบ
           client-side, "กลุ่ม/โปรเจกต์" ยังว่างเปล่ารอเฟส 3, "ของวันนี้"
           ยังเป็น placeholder รอระบบมุมมองในอนาคต */
        .nav-sidebar {
          background: var(--g-surface);
          border-radius: 16px;
          border: 1px solid var(--g-outline);
          box-shadow: 0 1px 3px rgba(60,64,67,0.08);
          height: 100%;
          overflow-y: auto;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .nav-section-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--g-on-surface-variant);
          margin: 0 0 6px 8px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          width: 100%;
          padding: 8px 10px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--g-on-surface);
          font-size: 13px;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
        }

        .nav-item:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .nav-item.is-active {
          background: var(--g-blue-light);
          color: var(--g-blue);
          font-weight: 500;
        }

        .nav-item-count {
          font-size: 11px;
          color: var(--g-on-surface-variant);
          background: var(--g-background);
          border-radius: 10px;
          padding: 1px 8px;
        }

        .nav-empty-state {
          font-size: 12px;
          color: var(--g-on-surface-variant);
          padding: 4px 10px;
          margin: 0 0 6px;
        }

        .nav-error-state {
          font-size: 12px;
          color: var(--g-red-dark);
          padding: 4px 10px;
          margin: 0 0 6px;
        }

        /* กลุ่ม/โปรเจกต์ ใน left nav (migration plan v2 เฟส 3) */
        .nav-item-group-label {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nav-item-group-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .nav-item-right-group {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .nav-item-delete-group {
          opacity: 0;
          font-size: 11px;
          color: var(--g-on-surface-variant);
          padding: 2px 4px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .nav-item:hover .nav-item-delete-group {
          opacity: 1;
        }

        .nav-item-delete-group:hover {
          background: var(--g-red-light);
          color: var(--g-red-dark);
        }

        .nav-add-group-form {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 6px 10px;
        }

        .nav-add-group-input {
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid var(--g-outline);
          background: var(--g-background);
          color: var(--g-on-surface);
          font-family: inherit;
          font-size: 13px;
        }

        .nav-add-group-actions {
          display: flex;
          gap: 6px;
        }

        .nav-group-color-picker {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .nav-group-color-option {
          width: 20px;
          height: 20px;
          padding: 0;
          border: 2px solid transparent;
          border-radius: 50%;
          background: var(--group-color);
          cursor: pointer;
        }

        .nav-group-color-option:hover,
        .nav-group-color-option.is-selected {
          border-color: var(--g-surface);
          outline: 2px solid var(--group-color);
        }

        .nav-group-custom-color {
          position: relative;
          display: grid;
          place-items: center;
          width: 20px;
          height: 20px;
          overflow: hidden;
          border: 1px dashed var(--g-outline);
          border-radius: 50%;
          color: var(--g-on-surface-variant);
          cursor: pointer;
        }
        .nav-group-custom-color span { position: relative; z-index: 1; pointer-events: none; font-size: 14px; line-height: 1; }
        .nav-group-custom-color input[type="color"] { position: absolute; inset: -5px; width: calc(100% + 10px); height: calc(100% + 10px); padding: 0; border: 0; opacity: 0; cursor: pointer; }

        .nav-add-group-confirm {
          background: var(--g-blue);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 5px 12px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
        }

        .nav-add-group-cancel {
          background: none;
          border: none;
          color: var(--g-on-surface-variant);
          font-size: 12px;
          cursor: pointer;
          padding: 5px 8px;
        }

        /* Chip กลุ่มบนตัวการ์ด reminder เอง (เฟส 3) */
        .reminder-group-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--g-on-surface-variant);
          margin-top: 2px;
        }

        .reminder-group-chip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Badge "ทำเสร็จแล้ว" บนการ์ด (migration plan v2 เฟส 4) */
        .reminder-completed-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 500;
          color: var(--g-green);
          margin-top: 2px;
        }

        .dashboard-body {
          display: grid;
          grid-template-columns: 260px 1fr 320px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          padding: 16px;
          gap: 16px;
        }

        .timeline-panel {
          background: var(--g-surface);
          border-radius: 16px;
          border: 1px solid var(--g-outline);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          box-shadow: 0 1px 3px rgba(60,64,67,0.08);
          height: 100%;
        }

        .timeline-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--g-outline-variant);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          background: var(--g-surface);
          z-index: 20;
        }

        .timeline-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--g-on-surface-variant);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0;
        }

        .zoom-controls {
          display: flex;
          align-items: center;
          gap: 4px;
          background: var(--g-background);
          border-radius: 20px;
          padding: 2px 8px;
          border: 1px solid var(--g-outline);
        }

        .zoom-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: var(--g-on-surface-variant);
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .zoom-btn:disabled {
          opacity: 0.3;
          cursor: default;
        }

        .zoom-btn:not(:disabled):hover {
          background: var(--g-outline-variant);
        }

        .zoom-display {
          font-size: 12px;
          font-weight: 500;
          color: var(--g-on-surface);
          min-width: 65px;
          text-align: center;
        }

        .timeline-viewport {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .now-indicator {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          height: 2px;
          background: var(--timeline-now-color);
          z-index: 15;
          pointer-events: none;
        }

        .now-indicator::before {
          content: "";
          position: absolute;
          left: 54px;
          top: -4px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--timeline-now-color);
        }

        .now-indicator-clock {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          padding: 3px 6px;
          border-radius: 4px;
          background: var(--g-surface);
          border: 1px solid color-mix(in srgb, var(--timeline-now-color) 48%, var(--g-outline-variant));
          color: var(--timeline-now-color);
          font-family: 'Roboto Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: .02em;
          font-variant-numeric: tabular-nums;
          box-shadow: 0 1px 3px rgba(60, 64, 67, .18);
          white-space: nowrap;
        }

        .timeline-activity-status {
          position: absolute;
          left: 50%;
          top: 12px;
          transform: translateX(-50%);
          z-index: 20;
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          max-width: calc(100% - 32px);
          padding: 7px 12px;
          border-radius: 999px;
          background: var(--g-surface);
          border: 1px solid var(--g-outline-variant);
          border-left: 4px solid var(--timeline-status-color);
          box-shadow: 0 3px 10px rgba(60, 64, 67, 0.22);
          color: var(--timeline-status-color);
          font-size: 12px;
          line-height: 1.2;
          pointer-events: none;
        }

        .timeline-activity-status-title {
          flex: 1 1 auto;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 700;
        }

        .timeline-activity-status strong {
          flex-shrink: 0;
          color: var(--timeline-status-color);
          font-variant-numeric: tabular-nums;
        }

        .tape-scroll-container {
          height: 100%;
          overflow: auto;
          position: relative;
          scroll-behavior: auto;
          -webkit-overflow-scrolling: touch;
          will-change: scroll-position;
          transform: translateZ(0);
          overscroll-behavior: contain;
        }

        .tape-track-wrapper {
          position: relative;
          min-width: 100%;
        }

        .color-picker-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 4px;
        }

        .color-swatch-btn {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          padding: 0;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
          transition: transform 0.1s ease, border-color 0.1s ease;
        }

        .color-swatch-btn:hover {
          transform: scale(1.1);
        }

        .color-swatch-btn.selected {
          border-color: var(--g-on-surface, #202124);
          box-shadow: 0 0 0 2px var(--g-surface, #fff), 0 0 0 4px currentColor;
        }

        .color-swatch-custom {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px dashed var(--g-outline, #dadce0);
          background-image: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
          overflow: hidden;
        }

        .color-swatch-custom input[type="color"] {
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
          border: none;
          padding: 0;
        }

        .tape-spacer {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .time-row {
          position: relative;
          border-bottom: 1px solid var(--g-outline-variant);
          padding-left: 12px;
          display: flex;
          align-items: center;
          user-select: none;
          content-visibility: auto;
          contain-intrinsic-size: 0 var(--row-height, 32px);
        }

        .time-row.major-hour {
          border-bottom-color: var(--g-outline);
          background-color: var(--g-major-hour-tint);
        }

        .time-label {
          flex: 0 0 60px;
          font-family: 'Roboto Mono', monospace;
          font-size: 11px;
          color: var(--g-on-surface-variant);
          text-align: right;
          margin-right: 12px;
        }

        .time-row.major-hour .time-label {
          font-weight: 700;
          color: var(--g-blue);
        }

        .event-chip-group {
          position: absolute;
          left: 84px;
          right: 8px;
          top: 3px;
          display: flex;
          align-items: center;
          gap: 4px;
          overflow: visible;
        }

        .event-chip {
          border: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          background: var(--g-blue-light);
          color: var(--g-blue-hover);
          padding: 3px 10px;
          border-radius: 6px;
          white-space: nowrap;
          flex-shrink: 0;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
        }

        .event-chip:hover,
        .event-chip:focus-visible {
          filter: brightness(0.95);
          outline: 2px solid var(--g-blue);
          outline-offset: 2px;
        }

        .event-chip.disabled {
          background: var(--g-outline-variant);
          color: var(--g-on-surface-variant);
        }

        .chip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--g-blue);
          flex-shrink: 0;
        }

        .event-chip.disabled .chip-dot {
          background: var(--g-on-surface-variant);
        }

        .main-panel {
          background: var(--g-surface);
          border-radius: 16px;
          border: 1px solid var(--g-outline);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(60,64,67,0.08);
          height: 100%;
          min-height: 0;
        }

        .main-panel-toolbar {
          padding: 14px 16px;
          border-bottom: 1px solid var(--g-outline-variant);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .main-panel-toolbar h2 {
          font-size: 20px;
          font-weight: 500;
          margin: 0 0 4px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Chip แสดงตัวกรองประเภทที่กำลังใช้อยู่ (migration plan v2 เฟส 2) */
        .active-filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--g-blue-light);
          color: var(--g-blue);
          font-size: 12px;
          font-weight: 500;
          padding: 3px 6px 3px 10px;
          border-radius: 14px;
        }

        .active-filter-chip button {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 12px;
          padding: 2px 4px;
          line-height: 1;
        }

        .toolbar-subtitle {
          font-size: 13px;
          color: var(--g-on-surface-variant);
          margin: 0;
        }

        .add-reminder-btn {
          background: var(--g-blue-light);
          color: var(--g-blue);
          border: none;
          padding: 10px 20px;
          border-radius: 24px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .add-reminder-btn:hover {
          background: var(--g-blue-light-hover);
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }

        .add-reminder-btn.is-open {
          background: var(--g-outline-variant);
          color: var(--g-on-surface-variant);
        }

        .add-reminder-btn-icon {
          display: inline-block;
          transition: transform 0.15s;
        }

        .add-reminder-btn.is-open .add-reminder-btn-icon {
          transform: rotate(45deg);
        }

        /* Tab bar — เพิ่มเข้ามาแทน section-header คั่นหัวข้อเดิม (migration
           plan v2 เฟส 1.2) .section-header เดิมด้านล่างยังเก็บไว้เผื่อจุด
           อื่นในอนาคตอ้างถึง แต่ไม่ได้ใช้ในรายการหลักแล้วตอนนี้ */
        .tab-bar {
          display: flex;
          gap: 4px;
          padding: 0 16px;
          border-bottom: 1px solid var(--g-outline-variant);
          flex-shrink: 0;
        }

        .reminder-status-tab {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 10px 4px;
          margin-bottom: -1px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--g-on-surface-variant);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .reminder-status-tab:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .reminder-status-tab.is-active {
          color: var(--g-blue);
          border-bottom-color: var(--g-blue);
        }

        .reminder-status-tab-count {
          font-size: 11px;
          color: var(--g-on-surface-variant);
          background: var(--g-background);
          border-radius: 10px;
          padding: 1px 7px;
        }

        .reminder-status-tab.is-active .reminder-status-tab-count {
          color: var(--g-blue);
        }

        .reminders-scroll-area {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .section-header {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.8px;
          color: var(--g-on-surface-variant);
          text-transform: uppercase;
          margin: 4px 0 0 4px;
          position: sticky;
          top: 0;
          background: var(--g-surface);
          padding: 4px 0;
          z-index: 1;
        }

        .empty-state {
          font-size: 13px;
          color: var(--g-on-surface-variant);
          text-align: center;
          padding: 32px 16px;
          margin: 0;
        }

        .reminder-card {
          display: grid;
          grid-template-columns: 28px 1fr auto auto;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid var(--g-outline-variant);
          border-left-width: 4px;
          background: var(--g-surface);
          transition: all 0.2s ease;
        }

        .reminder-card:hover {
          border-color: var(--g-outline);
          box-shadow: 0 2px 6px rgba(60,64,67,0.08);
        }

        .reminder-card.active {
          background: var(--g-active-bg);
          border-color: var(--g-active-border);
        }

        /* dropdown-backdrop เป็น fixed layer (z-index: 40) สำหรับปิดเมนู
           เมื่อคลิกด้านนอก. การ์ดที่เปิดเมนูต้องยกทั้ง stacking context
           ขึ้นเหนือมัน มิฉะนั้น backdrop จะดักคลิกปุ่ม แก้ไข/ลบ ทั้งหมด. */
        .reminder-card.menu-open {
          position: relative;
          z-index: 45;
        }

        /* icon กล่องสี่เหลี่ยมมุมโค้ง (เดิมเป็นวงกลม) พื้นหลังคือสีประจำ
           ประเภท (TYPE_ACCENT_COLOR, ตั้งค่าผ่าน inline style ต่อการ์ด) —
           ไม่ผูกกับ enabled/disabled อีกต่อไป (เดิมมีกฎ .active
           .reminder-type-icon แยกสำหรับ enabled state — เอาออกเพราะตอนนี้
           สีสื่อ "ประเภท" เสมอ ส่วนสถานะ enabled/disabled สื่อผ่านความจาง
           ของทั้ง icon แทน ดูกฎถัดไป) */
        .reminder-type-icon {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 11px;
          flex-shrink: 0;
        }

        .reminder-card:not(.active) .reminder-type-icon {
          opacity: 0.55;
        }

        .reminder-info {
          min-width: 0;
        }

        .reminder-info .title {
          font-size: 13.5px;
          font-weight: 500;
          margin: 0;
          color: var(--g-on-surface);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .reminder-info .meta {
          font-size: 12px;
          color: var(--g-on-surface-variant);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn-action-small {
          margin-top: 4px;
          background: var(--g-blue-light);
          color: var(--g-blue-hover);
          border: none;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 500;
        }

        .day-selector { display: flex; gap: 6px; margin-top: 6px; }
        .day-btn {
          width: 32px; height: 32px;
          border-radius: 50%;
          border: 1px solid var(--g-outline);
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        }
        .day-btn.selected { background: var(--g-blue); color: white; border-color: var(--g-blue); }

        .toggle-switch {
          width: 36px;
          height: 20px;
          border-radius: 10px;
          background: var(--g-toggle-off);
          border: none;
          position: relative;
          cursor: pointer;
          transition: background 0.2s;
          flex-shrink: 0;
        }

        .toggle-switch.on {
          background: var(--g-blue);
        }

        .toggle-switch::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          transition: transform 0.2s;
        }

        .toggle-switch.on::after {
          transform: translateX(16px);
        }

        .stopwatch-controls {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .btn-stopwatch {
          font-family: inherit;
          font-size: 12px;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          white-space: nowrap;
        }

        .btn-stopwatch.start {
          background: var(--g-blue-light);
          color: var(--g-blue-hover);
        }

        .btn-stopwatch.start:hover {
          background: var(--g-blue-light-hover);
        }

        .btn-stopwatch.stop {
          background: var(--g-red-light);
          color: var(--g-red-dark);
        }

        .btn-stopwatch.stop:hover {
          background: var(--g-red-light-hover);
        }

        .form-hint {
          font-size: 12px;
          color: var(--g-on-surface-variant);
          margin: 0 0 12px 0;
          line-height: 1.5;
        }

        .reminder-card-actions {
          position: relative;
          display: flex;
          gap: 2px;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .reminder-card:hover .reminder-card-actions,
        .reminder-card:focus-within .reminder-card-actions,
        .reminder-card-actions.menu-open {
          opacity: 1;
        }

        .card-dropdown-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          z-index: 50;
          background: var(--g-surface);
          border: 1px solid var(--g-outline);
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(60,64,67,0.18);
          padding: 4px;
          display: flex;
          flex-direction: column;
          min-width: 110px;
        }

        .card-dropdown-menu button {
          background: none;
          border: none;
          text-align: left;
          padding: 7px 10px;
          border-radius: 6px;
          font-family: inherit;
          font-size: 13px;
          color: var(--g-on-surface);
          cursor: pointer;
          white-space: nowrap;
        }

        .card-dropdown-menu button:hover {
          background: var(--g-background);
        }

        .card-dropdown-menu button.is-danger {
          color: var(--g-red-dark);
        }

        .icon-btn {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          flex-shrink: 0;
        }

        .icon-btn:hover {
          background: var(--g-outline-variant);
        }

        .composer-card {
          border: 1px solid var(--g-outline);
          border-radius: 12px;
          padding: 14px;
          background: var(--g-background);
          flex-shrink: 0;
          animation: composer-expand 0.15s ease;
        }

        @keyframes composer-expand {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .form-field {
          margin-bottom: 10px;
        }

        .form-field label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--g-on-surface-variant);
          margin-bottom: 6px;
        }

        .form-input, .form-select {
          width: 100%;
          font-family: inherit;
          font-size: 14px;
          padding: 8px 12px;
          border: 1px solid var(--g-outline);
          border-radius: 8px;
          background: var(--g-surface);
          color: var(--g-on-surface);
          outline: none;
          transition: border-color 0.2s;
        }

        .form-input:focus, .form-select:focus {
          border-color: var(--g-blue);
          box-shadow: 0 0 0 1px var(--g-blue);
        }

        .composer-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .interval-window-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 34px;
          padding: 6px 10px;
          border: 1px solid var(--g-outline);
          border-radius: 9px;
          background: var(--g-surface);
          color: var(--g-on-surface);
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .interval-window-toggle:hover { border-color: var(--g-blue); }
        .interval-window-toggle.is-active { border-color: var(--g-blue); background: color-mix(in srgb, var(--g-blue) 12%, var(--g-surface)); color: var(--g-blue); }
        .interval-window-toggle-track { position: relative; width: 30px; height: 17px; border-radius: 99px; background: var(--g-toggle-off); }
        .interval-window-toggle-track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: #fff; transition: transform .16s ease; }
        .interval-window-toggle.is-active .interval-window-toggle-track { background: var(--g-blue); }
        .interval-window-toggle.is-active .interval-window-toggle-track::after { transform: translateX(13px); }

        .freq-inline-group {
          display: flex;
          gap: 8px;
        }

        .freq-inline-group input {
          width: 80px;
        }

        .composer-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 14px;
        }

        .btn-text {
          background: transparent;
          border: none;
          color: var(--g-blue);
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
        }

        .btn-text:hover {
          background: var(--g-blue-light);
        }

        .btn-text.btn-delete-reminder,
        .btn-text.btn-delete-reminder:hover {
          color: var(--g-red-dark);
        }

        .btn-text.btn-delete-reminder:hover {
          background: var(--g-red-light);
        }

        .btn-contained {
          background: var(--g-blue);
          border: none;
          color: white;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 20px;
          border-radius: 20px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-contained:hover {
          background: var(--g-blue-hover);
        }

        @media (max-width: 900px) {
          .dashboard-body {
            grid-template-columns: 1fr;
            overflow-y: auto;
          }
          .nav-sidebar {
            height: auto;
            max-height: 240px;
          }
          .timeline-panel {
            min-height: 360px;
          }
          .topbar-omnibar-wrap {
            display: none;
          }
        }
      `}</style>

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
            placeholder="เช่น เตือนพักสายตาทุก20นาที"
            disabled={!omnibarEnabled}
            title={omnibarEnabled ? "พิมพ์แล้วกด Enter เพื่อสร้าง Reminder" : "Omnibar ยังไม่เปิดใช้ใน Remote Config"}
          />
          {omnibarEnabled && omnibarInput.trim() && (
            <div className={`omnibar-preview ${omnibarPreview.matched ? "is-matched" : ""}`}>
              <span>{omnibarPreview.matched ? `→ ${omnibarPreview.description}` : "ไม่เข้าใจรูปแบบนี้ — จะเปิดฟอร์มให้ตรวจเอง"}</span>
              <button type="button" onClick={submitOmnibar}>{omnibarPreview.matched ? "สร้าง" : "เปิดฟอร์ม"}</button>
            </div>
          )}
        </div>
        <div className="topbar-actions">
          {/* migration plan v2 เฟส 5 — ปุ่มเปิด/ปิด push notification จริง
              (ทดสอบได้แค่ permission flow + เรียก backend — getToken()
              จริงต้องมี VITE_FIREBASE_VAPID_KEY ที่ยังไม่ตั้งค่าไว้ในสภาพ
              แวดล้อมนี้ กดแล้วจะเห็น error อธิบายตรงๆ แทนที่จะพังเงียบๆ) */}
          <button
            type="button"
            className={`topbar-icon-btn ${isPushEnabled ? "is-active" : ""}`}
            disabled={pushPermission === "unsupported" || pushPermission === "denied" || isPushRequesting}
            onClick={() => {
              const message = isPushEnabled
                ? "ต้องการปิดการแจ้งเตือนสำหรับอุปกรณ์/เว็บนี้ใช่ไหม?\n\nคุณจะไม่ได้รับ Push notification จนกว่าจะกด 🔕 เพื่อเปิดอีกครั้ง"
                : "ต้องการเปิดการแจ้งเตือนสำหรับอุปกรณ์/เว็บนี้ใช่ไหม?";
              if (window.confirm(message)) {
                if (isPushEnabled) disableNotifications();
                else requestPushPermission();
              }
            }}
            title={
              pushError
                ? `เกิดข้อผิดพลาด: ${pushError}`
                : pushPermission === "unsupported"
                ? "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ Push"
                : pushPermission === "denied"
                ? "การแจ้งเตือนถูกปิดไว้ — เปิดใหม่ได้ในตั้งค่าเบราว์เซอร์"
                : isPushEnabled
                ? "ปิดการแจ้งเตือน"
                : "เปิดการแจ้งเตือน (รับได้แม้ปิดแท็บ)"
            }
          >
            {isPushEnabled ? "🔔" : "🔕"}
          </button>
          <button type="button" className="topbar-icon-btn" onClick={() => setIsStatsOpen(true)} title="ดูสถิติ Reminder">📊</button>
        </div>
      </header>

      <ReminderStatsPanel isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} stats={reminderStats} />

      {/* Backdrop ปิดเมนู "⋮" การ์ด / snooze dropdown เมื่อคลิกนอกเมนู —
          ใช้ตัวเดียวร่วมกันทั้งสองระบบเมนู (migration plan v2 เฟส 1.3/1.4)
          เพราะเปิดได้ทีละเมนูอยู่แล้วในทางปฏิบัติ ไม่ต้อง portal/listener
          แยกต่างหาก */}
      {(cardMenuOpenId || snoozeMenuForId) && (
        <div className="dropdown-backdrop" onClick={closeAllMenus} />
      )}

      {/* Alert Banner */}
      {dueReminders.length > 0 && (
        <div className="due-alert-banner" role="alert">
          <span>🔔 ถึงเวลาแล้ว: {dueReminders.map((r) => r.title).join(", ")}</span>
          <div className="due-alert-actions">
            {dueReminders.map((r) => (
              <span key={r.id} className="due-alert-item-actions">
                <div className="snooze-dropdown-wrap">
                  <button
                    type="button"
                    className="btn-snooze"
                    onClick={() => setSnoozeMenuForId(snoozeMenuForId === r.id ? null : r.id)}
                    aria-haspopup="true"
                    aria-expanded={snoozeMenuForId === r.id}
                  >
                    เตือนอีกครั้ง ({r.title}) ▾
                  </button>
                  {snoozeMenuForId === r.id && (
                    <div className="snooze-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => { scheduleNext(r.id); setSnoozeMenuForId(null); }}>
                        ตามรอบปกติ
                      </button>
                      {SNOOZE_OPTIONS_MINUTES.map((m) => (
                        <button key={m} type="button" role="menuitem" onClick={() => { scheduleNext(r.id, m); setSnoozeMenuForId(null); }}>
                          อีก {m} นาที
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* migration plan v2 เฟส 4 — ผูก markCompleted() จริงแล้ว
                    (เดิมเป็น placeholder disabled รอ field completedAt) */}
                <button type="button" className="btn-mark-done" onClick={() => markCompleted(r.id)}>
                  ✓ ทำเสร็จแล้ว
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Body Grid — 3 คอลัมน์: nav ซ้าย / list กลาง / timeline ขวา
          (เดิม 2 คอลัมน์: timeline ซ้าย / list ขวา — ย้าย timeline ไปขวาสุด
          ตาม reminder-dashboard-mockup.jsx, migration plan v2 เฟส 1.1) */}
      <div className="dashboard-body">
        {/* Left Nav — "ตัวกรองประเภท" (เฟส 2) และ "กลุ่ม/โปรเจกต์" (เฟส 3)
            wired จริงทั้งคู่แล้ว "ของวันนี้" ยังเป็น placeholder รอระบบ
            มุมมองในอนาคต count ทุกจุดคำนวณจาก reminders/groups จริงเสมอ */}
        <nav className="nav-sidebar">
          <div>
            <p className="nav-section-title">มุมมองหลัก</p>
            <button
              type="button"
              className={`nav-item ${activeTypeFilter === null && activeGroupFilter === null ? "is-active" : ""}`}
              onClick={() => {
                setActiveTypeFilter(null);
                setActiveGroupFilter(null);
              }}
            >
              <span>ทั้งหมด</span>
              <span className="nav-item-count">{reminders.length}</span>
            </button>
            <button type="button" className="nav-item" disabled title="เร็วๆ นี้: ระบบมุมมอง">
              <span>ของวันนี้</span>
            </button>
          </div>

          <div>
            <p className="nav-section-title">กลุ่ม/โปรเจกต์</p>
            {groupsError && <p className="nav-error-state">{groupsError}</p>}
            {groups.length === 0 && !isAddingGroup && <p className="nav-empty-state">ยังไม่มีกลุ่ม</p>}
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={`nav-item ${activeGroupFilter === group.id ? "is-active" : ""}`}
                onClick={() => toggleGroupFilter(group.id)}
                aria-pressed={activeGroupFilter === group.id}
              >
                <span className="nav-item-group-label">
                  <span className="nav-item-group-dot" style={{ background: group.color }} />
                  {group.name}
                </span>
                <span className="nav-item-right-group">
                  <span className="nav-item-count">{reminders.filter((r) => r.groupId === group.id).length}</span>
                  {/* ปุ่มลบกลุ่ม — เผยออกด้วย hover เหมือน .reminder-card-actions
                      เดิม กด e.stopPropagation กันไม่ให้ trigger toggleGroupFilter
                      ของปุ่มแม่ไปพร้อมกัน */}
                  <span
                    role="button"
                    tabIndex={0}
                    className="nav-item-delete-group"
                    title="ลบกลุ่ม"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGroup(group.id);
                    }}
                  >
                    ✕
                  </span>
                </span>
              </button>
            ))}

            {isAddingGroup ? (
              <form className="nav-add-group-form" onSubmit={submitNewGroup}>
                <input
                  type="text"
                  className="nav-add-group-input"
                  placeholder="ชื่อกลุ่ม"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                  maxLength={60}
                />
                <div className="nav-group-color-picker" role="group" aria-label="เลือกสีของกลุ่ม">
                  {GROUP_COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`nav-group-color-option${newGroupColor === color ? " is-selected" : ""}`}
                      style={{ "--group-color": color }}
                      onClick={() => setNewGroupColor(color)}
                      aria-label={`เลือกสี ${color}`}
                      aria-pressed={newGroupColor === color}
                    />
                  ))}
                  <label className="nav-group-custom-color" title="เลือกเฉดสีเอง">
                    <input type="color" value={newGroupColor} onChange={(event) => setNewGroupColor(event.target.value)} aria-label="เลือกเฉดสีเอง" />
                    <span>+</span>
                  </label>
                </div>
                <div className="nav-add-group-actions">
                  <button type="submit" className="nav-add-group-confirm">เพิ่ม</button>
                  <button
                    type="button"
                    className="nav-add-group-cancel"
                    onClick={() => {
                      setIsAddingGroup(false);
                      setNewGroupName("");
                    }}
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="nav-item" onClick={() => setIsAddingGroup(true)}>
                <span>+ เพิ่มกลุ่มใหม่</span>
              </button>
            )}
          </div>

          <div>
            <p className="nav-section-title">ตัวกรองประเภท</p>
            {TYPE_FILTER_OPTIONS.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                className={`nav-item ${activeTypeFilter === type ? "is-active" : ""}`}
                onClick={() => toggleTypeFilter(type)}
                aria-pressed={activeTypeFilter === type}
              >
                <span>{label}</span>
                <span className="nav-item-count">{reminders.filter((r) => r.type === type).length}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Reminders Dashboard */}
        <section className="main-panel">
          <div className="main-panel-toolbar">
            <div>
              <h2>
                การแจ้งเตือนทั้งหมด
                {activeTypeFilter && (
                  <span className="active-filter-chip">
                    {TYPE_FILTER_OPTIONS.find((o) => o.type === activeTypeFilter)?.label}
                    <button type="button" onClick={() => setActiveTypeFilter(null)} aria-label="ล้างตัวกรองประเภท">✕</button>
                  </span>
                )}
                {activeGroupFilter && (
                  <span className="active-filter-chip">
                    {groups.find((g) => g.id === activeGroupFilter)?.name}
                    <button type="button" onClick={() => setActiveGroupFilter(null)} aria-label="ล้างตัวกรองกลุ่ม">✕</button>
                  </span>
                )}
              </h2>
              <p className="toolbar-subtitle">{reminders.length} รายการ · ใช้งานอยู่ {enabledReminders.length} · พักการแจ้งเตือน {pausedReminders.length} · ทำสำเร็จแล้ว {completedReminders.length}</p>
            </div>
            <button type="button" className={`add-reminder-btn ${isComposerOpen ? "is-open" : ""}`} onClick={toggleComposer}>
              <span className="add-reminder-btn-icon">+</span> {isComposerOpen ? "ปิดฟอร์ม" : "เพิ่ม Reminder"}
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
              ใช้งานอยู่ <span className="reminder-status-tab-count">{visibleEnabledReminders.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={reminderStatusTab === REMINDER_STATUS_TAB.PAUSED}
              className={`reminder-status-tab reminder-status-tab--paused ${reminderStatusTab === REMINDER_STATUS_TAB.PAUSED ? "is-active" : ""}`}
              onClick={() => setReminderStatusTab(REMINDER_STATUS_TAB.PAUSED)}
            >
              พักการแจ้งเตือน <span className="reminder-status-tab-count">{visiblePausedReminders.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={reminderStatusTab === REMINDER_STATUS_TAB.COMPLETED}
              className={`reminder-status-tab reminder-status-tab--completed ${reminderStatusTab === REMINDER_STATUS_TAB.COMPLETED ? "is-active" : ""}`}
              onClick={() => setReminderStatusTab(REMINDER_STATUS_TAB.COMPLETED)}
            >
              ทำสำเร็จแล้ว <span className="reminder-status-tab-count">{visibleCompletedReminders.length}</span>
            </button>
          </div>

          <div className="reminders-scroll-area">
            {/* Composer แบบ inline expand/collapse: พับเก็บเป็นค่าเริ่มต้นเพื่อประหยัดพื้นที่
                เมื่อกด "เพิ่ม Reminder" หรือกด "แก้ไข" การ์ดใดการ์ดหนึ่ง จะดันลงมาแสดงแทนที่ */}
            {isComposerOpen && (
              <div className="composer-backdrop" onMouseDown={cancelEditing}>
              <form className="composer-card" onMouseDown={(event) => event.stopPropagation()} onSubmit={submitReminderForm}>
              <div className="form-field">
                <label htmlFor="reminder-title">ชื่อการแจ้งเตือน</label>
                <input id="reminder-title" className="form-input" value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="เช่น พักสายตา 5 นาที" />
              </div>

              <div className="form-field">
                <label htmlFor="reminder-type">ประเภทการเตือน</label>
                <select id="reminder-type" className="form-select" value={draft.type} onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value={REMINDER_TYPE.INTERVAL}>เตือนวนลูปเป็นรอบ (Interval)</option>
                  <option value={REMINDER_TYPE.WEEKLY}>เกิดซ้ำตามวันในสัปดาห์ (Weekly Days)</option>
                  <option value={REMINDER_TYPE.EVENT_ANCHORED}>ผูกกับเหตุการณ์ (Event-Anchored)</option>
                  <option value={REMINDER_TYPE.ROUTINE}>ชุดงานต่อเนื่อง (Checklist/Routine)</option>
                  <option value={REMINDER_TYPE.ONCE_AT}>เตือนครั้งเดียว ตามวันที่/เวลา (Once)</option>
                  <option value={REMINDER_TYPE.COUNTDOWN}>นับถอยหลัง (Timer)</option>
                  <option value={REMINDER_TYPE.STOPWATCH}>จับเวลา (Stopwatch)</option>
                </select>
              </div>

              {/* migration plan v2 เฟส 3 — เลือกกลุ่ม/โปรเจกต์ที่ reminder
                  นี้จะผูกด้วย (optional, one-to-one) ซ่อนตัวเลือกนี้ไปเลย
                  ถ้ายังไม่มีกลุ่มไหนถูกสร้างไว้เลย แทนที่จะโชว์ dropdown
                  ว่างๆ ที่มีแค่ตัวเลือกเดียว ("ไม่มีกลุ่ม") ซึ่งไม่มีประโยชน์ */}
              {groups.length > 0 && (
                <div className="form-field">
                  <label htmlFor="reminder-group">กลุ่ม/โปรเจกต์ (ถ้ามี)</label>
                  <select
                    id="reminder-group"
                    className="form-select"
                    value={draft.groupId ?? ""}
                    onChange={(e) => setDraft((prev) => ({ ...prev, groupId: e.target.value || null }))}
                  >
                    <option value="">ไม่มีกลุ่ม</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {draft.type === REMINDER_TYPE.INTERVAL && (
                <>
                  <div className="form-field">
                    <label htmlFor="reminder-amount">ความถี่</label>
                    <div className="freq-inline-group">
                      <input id="reminder-amount" className="form-input" type="number" min="1" value={draft.amount} onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))} />
                      <select className="form-select" value={draft.unit} onChange={(e) => setDraft((prev) => ({ ...prev, unit: e.target.value }))}>
                        <option value="minutes">นาที</option>
                        <option value="hours">ชั่วโมง</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <button type="button" role="switch" aria-checked={draft.runAllDay} className={`interval-window-toggle${draft.runAllDay ? " is-active" : ""}`} onClick={() => setDraft((prev) => ({ ...prev, runAllDay: !prev.runAllDay, ...(!prev.runAllDay ? { windowStart: "", windowEnd: "" } : {}) }))}>
                      <span className="interval-window-toggle-track" aria-hidden="true" />
                      <span>ทำงานตลอดเวลา (00:00–24:00)</span>
                    </button>
                    {!draft.runAllDay && <>
                    <label>ช่วงเวลาที่ทำงาน</label>
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
                    <label>เลือกวันในสัปดาห์</label>
                    <div className="day-selector">
                      {DAYS_OF_WEEK.map((d) => (
                        <button key={d.value} type="button" className={`day-btn ${draft.days.includes(d.value) ? "selected" : ""}`} onClick={() => toggleDayInDraft(d.value)}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-field">
                    <label>เวลาแจ้งเตือน</label>
                    {(draft.times || [draft.time]).map((time, index) => (
                      <div className="weekly-time-row" key={`${time}-${index}`}>
                        <input className="form-input" type="time" value={time} onChange={(event) => setDraft((prev) => ({ ...prev, times: prev.times.map((value, itemIndex) => itemIndex === index ? event.target.value : value) }))} />
                        <button type="button" className="icon-btn" disabled={draft.times.length === 1} onClick={() => setDraft((prev) => ({ ...prev, times: prev.times.filter((_, itemIndex) => itemIndex !== index) }))}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn-text weekly-add-time" onClick={() => setDraft((prev) => ({ ...prev, times: [...prev.times, "12:00"] }))}>+ เพิ่มเวลา</button>
                  </div>
                </>
              )}

              {draft.type === REMINDER_TYPE.EVENT_ANCHORED && (
                <>
                  <div className="form-field">
                    <label>อ้างอิงจากเหตุการณ์</label>
                    <input className="form-input" value={draft.eventName} onChange={(e) => setDraft((prev) => ({ ...prev, eventName: e.target.value }))} placeholder="เช่น กินยาแก้ปวด" />
                  </div>
                  <div className="form-field">
                    <label>ระยะเวลาหลังจากเกิดเหตุการณ์</label>
                    <div className="freq-inline-group">
                      <input className="form-input" type="number" min="1" value={draft.afterAmount} onChange={(e) => setDraft((prev) => ({ ...prev, afterAmount: e.target.value }))} />
                      <select className="form-select" value={draft.afterUnit} onChange={(e) => setDraft((prev) => ({ ...prev, afterUnit: e.target.value }))}>
                        <option value="minutes">นาที</option>
                        <option value="hours">ชั่วโมง</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {draft.type === REMINDER_TYPE.ROUTINE && (
                <div className="form-field">
                  <label>รายการขั้นตอน (คั่นด้วยเครื่องหมายจุลภาค ,)</label>
                  <input className="form-input" value={draft.routineSteps} onChange={(e) => setDraft((prev) => ({ ...prev, routineSteps: e.target.value }))} placeholder="เช่น แปรงฟัน, ยืดตัว, กินวิตามิน" />
                </div>
              )}

              {draft.type === REMINDER_TYPE.ONCE_AT && (
                <div className="composer-row form-field">
                  <div>
                    <label htmlFor="at-date">วันที่</label>
                    <input id="at-date" className="form-input" type="date" value={draft.atDate} onChange={(e) => setDraft((prev) => ({ ...prev, atDate: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="at-time">เวลา</label>
                    <input id="at-time" className="form-input" type="time" value={draft.atTime} onChange={(e) => setDraft((prev) => ({ ...prev, atTime: e.target.value }))} />
                  </div>
                </div>
              )}

              {draft.type === REMINDER_TYPE.COUNTDOWN && (
                <>
                  <div className="form-field">
                    <label htmlFor="countdown-minutes">ระยะเวลา (นาที)</label>
                    <input id="countdown-minutes" className="form-input" type="number" min="1" max="1440" value={draft.countdownMinutes} onChange={(e) => setDraft((prev) => ({ ...prev, countdownMinutes: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label>สีเส้นบน Timeline</label>
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
                  <p className="form-hint">จับเวลานับขึ้นเรื่อย ๆ ไม่มีการแจ้งเตือน กด Start/Stop ได้จากการ์ดหลังสร้างเสร็จ</p>
                  <div className="form-field">
                    <label>สีเส้นบน Timeline</label>
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

              <div className="composer-actions">
                {editingId && (
                  <button className="btn-text btn-delete-reminder" type="button" onClick={deleteEditingReminder}>ลบ Reminder</button>
                )}
                <button className="btn-text" type="button" onClick={cancelEditing}>ยกเลิก</button>
                <button className="btn-contained" type="submit">
                  {editingId ? "บันทึกการแก้ไข" : "สร้าง Reminder"}
                </button>
              </div>
              </form>
              </div>
            )}

            {reminders.length === 0 && !isComposerOpen ? (
              <p className="empty-state">ยังไม่มีการแจ้งเตือน กด "เพิ่ม Reminder" เพื่อเริ่มต้น</p>
            ) : (
              <>
                {reminderStatusTab === REMINDER_STATUS_TAB.ENABLED && (
                  visibleEnabledReminders.length > 0 ? (
                    visibleEnabledReminders.map(renderReminder)
                  ) : (
                    !isComposerOpen && (
                      <p className="empty-state">
                        {describeActiveFilters()
                          ? `ไม่มี reminder ${describeActiveFilters()} ที่กำลังทำงานอยู่`
                          : "ยังไม่มี reminder ที่กำลังทำงานอยู่"}
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
                          ? `ไม่มี reminder ${describeActiveFilters()} ที่ปิดใช้งานไว้`
                          : "ยังไม่มี reminder ที่ปิดใช้งานไว้"}
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
                        ? `ไม่มี reminder ${describeActiveFilters()} ที่ทำเสร็จแล้ว`
                        : "ยังไม่มี reminder ที่ทำเสร็จแล้ว"}
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
            <p className="timeline-title">Timeline 24 ชม.</p>
            <div className="zoom-controls">
              <button type="button" className="zoom-btn" onClick={zoomOut} disabled={zoomIndex === 0} title="ซูมออก">−</button>
              <span className="zoom-display">{minutesPerRow} นาที/ช่อง</span>
              <button type="button" className="zoom-btn" onClick={zoomIn} disabled={zoomIndex === ZOOM_LEVELS_MINUTES.length - 1} title="ซูมเข้า">+</button>
            </div>
          </div>

          <div className="timeline-viewport">
            {activityNowStatus && (
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
            <div className="now-indicator" aria-label={`เวลาปัจจุบัน ${formatDigitalClock(nowTick)}`}>
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
                      onClick={() => onEditActivity?.(block.activity)}
                      title={`แก้ไขกิจกรรม: ${block.title}`}
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
      </div>
    </div>
  );
}
