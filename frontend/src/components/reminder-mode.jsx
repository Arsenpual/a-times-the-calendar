import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRemindersSync } from "../hooks/use-reminders-sync.js";

const STORAGE_KEY = "times-reminders-v1";

// ฟิลด์วัน/เวลาที่ sync ขึ้น Firebase — ต้องตรงกับ ALLOWED_FIELDS ใน
// backend/routes/reminders.js เป๊ะๆ (ฝั่ง backend มี allow-list ของตัวเอง
// อยู่แล้ว ตัดฟิลด์ที่ไม่อยู่ในนี้ทิ้งเงียบๆ — รายการนี้ฝั่ง frontend มีไว้
// เพื่อความชัดเจนตอนอ่านโค้ด ไม่ใช่ security boundary จริง) ไม่รวม runtime
// field เช่น startedAt/accumulatedMs/currentIndex/lastTriggeredAt/nextDueAt
const SCHEDULE_FIELD_KEYS = [
  "type", "title", "enabled", "amount", "unit", "windowStart", "windowEnd",
  "days", "time", "atMs", "afterAmount", "afterUnit", "durationMs",
  "lineColor", "eventName", "steps"
];

function extractScheduleFields(reminder) {
  const fields = {};
  for (const key of SCHEDULE_FIELD_KEYS) {
    if (reminder[key] !== undefined) fields[key] = reminder[key];
  }
  return fields;
}

const ZOOM_LEVELS_MINUTES = [60, 15, 5, 1];
const DEFAULT_ZOOM_INDEX = ZOOM_LEVELS_MINUTES.indexOf(15);

const REMINDER_TYPE = {
  INTERVAL: "interval",
  WEEKLY: "weekly",
  EVENT_ANCHORED: "event-anchored",
  ROUTINE: "routine",
  ONCE_AT: "once-at",
  COUNTDOWN: "countdown",
  STOPWATCH: "stopwatch"
};

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

function isOneShotType(type) {
  return type === REMINDER_TYPE.ONCE_AT || type === REMINDER_TYPE.COUNTDOWN;
}

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
    windowStart: "",
    windowEnd: "",
    atTime: now.toTimeString().slice(0, 5),
    atDate: toLocalDateInputValue(now.getTime()),
    countdownMinutes: "20",
    days: [1, 3, 5],
    time: "08:00",
    eventName: "",
    afterAmount: "2",
    afterUnit: "hours",
    routineSteps: "แปรงฟัน, ยืดตัว, กินวิตามิน",
    lineColor: DEFAULT_LINE_COLOR
  };
}

const DEFAULT_REMINDERS = [
  { id: "water", type: REMINDER_TYPE.INTERVAL, title: "ดื่มน้ำ", amount: 30, unit: "minutes", enabled: true },
  { id: "stretch", type: REMINDER_TYPE.INTERVAL, title: "ยืดตัว 30 วินาที", amount: 60, unit: "minutes", enabled: true },
  { id: "eyes", type: REMINDER_TYPE.INTERVAL, title: "พักสายตา มองไกล 20 ฟุต", amount: 20, unit: "minutes", enabled: true }
];

function intervalMs(reminder) {
  return reminder.amount * (reminder.unit === "hours" ? 60 * 60 * 1000 : 60 * 1000);
}

function intervalLabel(reminder) {
  const unit = reminder.unit === "hours" ? "ชั่วโมง" : "นาที";
  const base = `ทุก ${reminder.amount} ${unit}`;
  return hasWindow(reminder) ? `${base} (${reminder.windowStart}-${reminder.windowEnd})` : base;
}

function hasWindow(reminder) {
  return Boolean(reminder.windowStart && reminder.windowEnd);
}

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

function minuteOfDayAt(ms) {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesFromHHMM(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isMinuteWithinWindow(minuteOfDay, windowStart, windowEnd) {
  const start = minutesFromHHMM(windowStart);
  const end = minutesFromHHMM(windowEnd);
  if (start === end) return true;
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  return minuteOfDay >= start || minuteOfDay < end;
}

function snapToNextWindowStart(ms, windowStart, windowEnd) {
  const minuteOfDay = minuteOfDayAt(ms);
  if (isMinuteWithinWindow(minuteOfDay, windowStart, windowEnd)) return ms;
  const start = minutesFromHHMM(windowStart);
  const dayStart = new Date(ms);
  dayStart.setHours(0, 0, 0, 0);
  let candidate = dayStart.getTime() + start * 60000;
  if (candidate < ms) candidate += 24 * 60 * 60 * 1000;
  return candidate;
}

function computeNextDueAt(reminder, from) {
  switch (reminder.type) {
    case REMINDER_TYPE.WEEKLY: {
      if (!reminder.days || reminder.days.length === 0 || !reminder.time) return Infinity;
      const targetMin = minutesFromHHMM(reminder.time);
      const targetHour = Math.floor(targetMin / 60);
      const targetMinute = targetMin % 60;
      
      const baseDate = new Date(from);
      
      for (let i = 0; i < 8; i++) {
        const candidate = new Date(baseDate);
        candidate.setDate(baseDate.getDate() + i);
        candidate.setHours(targetHour, targetMinute, 0, 0);

        const dayOfWeek = candidate.getDay();
        if (reminder.days.includes(dayOfWeek) && candidate.getTime() > from) {
          return candidate.getTime();
        }
      }
      return Infinity;
    }
    case REMINDER_TYPE.EVENT_ANCHORED: {
      if (!reminder.lastTriggeredAt) return Infinity;
      const ms = reminder.afterAmount * (reminder.afterUnit === "hours" ? 3600000 : 60000);
      return reminder.lastTriggeredAt + ms;
    }
    case REMINDER_TYPE.ROUTINE: {
      return from;
    }
    case REMINDER_TYPE.ONCE_AT:
      return reminder.atMs;
    case REMINDER_TYPE.COUNTDOWN:
      return reminder.startedAt + reminder.durationMs;
    case REMINDER_TYPE.STOPWATCH:
      // Stopwatch จับเวลาอย่างเดียว ไม่มีแจ้งเตือน จึงไม่มี "ถึงกำหนด" ตลอดไป
      return Infinity;
    case REMINDER_TYPE.INTERVAL:
    default: {
      const next = from + intervalMs(reminder);
      return hasWindow(reminder) ? snapToNextWindowStart(next, reminder.windowStart, reminder.windowEnd) : next;
    }
  }
}

function describeReminder(reminder, nowMs) {
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
// - WEEKLY: ปักที่เวลาเดียวของวัน (เวลาเดิมทุกสัปดาห์ที่ตรงกับ days ที่เลือก)
// - ONCE_AT: ปักที่เวลาของวันนั้น เฉพาะกรณีเป็นวันเดียวกับวันนี้ (เพราะเป็น timeline วันเดียว)
// - COUNTDOWN: ปักที่เวลาสิ้นสุดของการนับถอยหลัง (ถ้าอยู่ในวันเดียวกับวันนี้)
// - STOPWATCH: จับเวลาต่อเนื่องไม่มีเวลาตายตัว จึงไม่ปักหมุดตามเวลาเช่นกัน (เหมือน EVENT_ANCHORED/ROUTINE)
// - EVENT_ANCHORED / ROUTINE: ไม่มีเวลาตายตัวในแต่ละวัน (ขึ้นกับ event ภายนอก) จึงไม่ปักหมุดตามเวลา
function getReminderTimeSlots(reminder, startOfTodayMs) {
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
      if (!reminder.time) return [];
      return [minutesFromHHMM(reminder.time)];
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

// คืนค่าช่วง "นาทีของวัน" (แบบทศนิยม ไม่ปัดเศษ) [startMinute, endMinute] สำหรับวาดเส้นสีเหลืองบาง ๆ บน timeline
// เฉพาะ Countdown/Stopwatch ที่กำลังทำงานอยู่เท่านั้น (enabled + มี startedAt)
// ใช้หน่วยนาทีแบบทศนิยม (ไม่ใช่ minuteOfDayAt ที่ปัดเศษเป็นจำนวนเต็ม) เพื่อให้เส้นขึ้นทันทีตั้งแต่วินาทีแรกที่กด Start
// - STOPWATCH: เส้นเริ่มที่จุดเริ่ม (startMinute) แล้ว "ขยายยาวออกไปเรื่อย ๆ" ไปทาง "ตอนนี้" (นาทีปัจจุบัน)
// - COUNTDOWN: เส้นเต็มความยาวทันที (จากจุดเริ่มถึงจุดสิ้นสุดที่ตั้งไว้) แล้ว "บีบเข้าหาจุดสิ้นสุดเรื่อย ๆ"
//   คือฝั่งเริ่ม (startMinute) จะขยับเข้าหาปลาย (endMinute) ตามเวลาที่ผ่านไป จนกระทั่งบีบจนสุดที่จุดสิ้นสุด
function minuteOfDayAtPrecise(ms) {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000;
}

function getRunningLineSpan(reminder, nowMs, startOfTodayMs) {
  if (reminder.type !== REMINDER_TYPE.COUNTDOWN && reminder.type !== REMINDER_TYPE.STOPWATCH) return null;
  if (!reminder.enabled || !reminder.startedAt) return null;

  const endOfTodayMs = startOfTodayMs + 24 * 60 * 60 * 1000;
  const clampedNowMs = Math.min(Math.max(nowMs, startOfTodayMs), endOfTodayMs);

  if (reminder.type === REMINDER_TYPE.STOPWATCH) {
    // จุดเริ่มจริงของ stopwatch (clamp เป็น 00:00 ถ้าเริ่มมาจากเมื่อวาน เพราะ timeline แสดงแค่วันเดียว)
    const startMs = Math.max(reminder.startedAt, startOfTodayMs);
    const startMinute = minuteOfDayAtPrecise(startMs);
    const endMinute = minuteOfDayAtPrecise(clampedNowMs);
    if (endMinute <= startMinute) return null;
    return { startMinute, endMinute };
  }

  // COUNTDOWN: เส้นเต็มช่วงทันที (เริ่ม → สิ้นสุดที่ตั้งไว้) แล้วฝั่ง "เริ่ม" ค่อย ๆ บีบเข้าหาฝั่ง "สิ้นสุด"
  const dueMs = reminder.startedAt + reminder.durationMs;
  const fixedEndMs = Math.min(dueMs, endOfTodayMs);
  const fixedEndMinute = minuteOfDayAtPrecise(fixedEndMs);

  // ฝั่งเริ่มที่บีบเข้าเรื่อย ๆ คือ "ตอนนี้" (แต่ไม่เกินจุดสิ้นสุด และไม่ก่อนจุดเริ่มตั้งต้นจริง)
  const originalStartMs = Math.max(reminder.startedAt, startOfTodayMs);
  const shrinkingStartMs = Math.min(Math.max(clampedNowMs, originalStartMs), fixedEndMs);
  const shrinkingStartMinute = minuteOfDayAtPrecise(shrinkingStartMs);

  if (fixedEndMinute <= shrinkingStartMinute) return null;
  return { startMinute: shrinkingStartMinute, endMinute: fixedEndMinute };
}

const ROW_HEIGHT_PX = 32;

// แยก component แถว timeline ออกมาต่างหากแล้วครอบด้วย React.memo พร้อม custom comparator
// เพราะ parent (ReminderDashboard) re-render ทุกวินาทีจาก nowTick (ให้ countdown/stopwatch tick แบบ live)
// ถ้าไม่แยก จะทำให้ React ต้อง reconcile แถวทั้งหมด (สูงสุด 1440 แถวที่ซูม 1 นาที/ช่อง) ทุกวินาทีโดยไม่จำเป็น ทำให้ scroll กระตุก
// เปรียบเทียบเฉพาะ tapeRows (reference จาก useMemo เปลี่ยนเมื่อ reminders/zoom เปลี่ยนจริง ๆ) ไม่สน nowTick ที่เปลี่ยนทุกวินาที
// ผลคือ tooltip (title) ของ event-chip อาจไม่ได้อัปเดตวินาทีต่อวินาที แต่แลกกับ scroll ที่ลื่นขึ้นมาก ซึ่งคุ้มกว่ามาก
const TimelineRows = React.memo(
  function TimelineRows({ tapeRows, nowTick }) {
    return tapeRows.map(({ key, isMajor, label, flags }) => (
      <div key={key} className={`time-row${isMajor ? " major-hour" : ""}`} style={{ height: `${ROW_HEIGHT_PX}px`, "--row-height": `${ROW_HEIGHT_PX}px` }}>
        <span className="time-label">{label}</span>
        {flags.length > 0 && (
          <span className="event-chip-group">
            {flags.map((r) => (
              <span key={r.id} className={`event-chip${r.enabled ? "" : " disabled"}`} title={`${r.title} · ${describeReminder(r, nowTick)}`}>
                <span className="chip-dot" />{r.title}
              </span>
            ))}
          </span>
        )}
      </div>
    ));
  },
  (prevProps, nextProps) => prevProps.tapeRows === nextProps.tapeRows
);

export default function ReminderDashboard({ firebaseUser }) {
  const [reminders, setReminders] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_REMINDERS;
    } catch {
      return DEFAULT_REMINDERS;
    }
  });

  // เบื้องต้น sync แค่ฟิลด์วัน/เวลาขึ้น Firebase (ดู use-reminders-sync.js) —
  // localStorage ยังเป็น source of truth หลักของ reminders ทั้งก้อน
  // (รวม runtime state) ในเฟสนี้; Firebase เป็นแค่ mirror ของ schedule
  // fields เพื่อให้กู้คืนได้ถ้า localStorage หาย/เปลี่ยนเครื่อง
  const { remoteReminders, syncScheduleFields, deleteRemoteReminder } = useRemindersSync({ firebaseUser });

  // Merge remote schedule fields เข้ากับ local state ครั้งเดียวตอนที่
  // remoteReminders เพิ่งโหลดเสร็จ (เปลี่ยนจาก null เป็น object) — ไม่ merge
  // ซ้ำทุกครั้งที่ remoteReminders reference เปลี่ยน (มันจะไม่เปลี่ยนอีก
  // หลังโหลดครั้งแรกอยู่แล้วตาม useRemindersSync's design) เพื่อไม่ให้ทับ
  // runtime state (startedAt ของ stopwatch ที่กำลังเดินอยู่ในเครื่อง) ที่
  // Firebase ไม่มีข้อมูลนั้นเก็บไว้เลย — merge แบบ "schedule fields จาก
  // remote ชนะ, runtime fields จาก local คงเดิม, reminder ที่มีแค่ฝั่งใด
  // ฝั่งหนึ่งก็เก็บไว้ทั้งคู่" ไม่ใช่ overwrite ทั้งก้อน
  const hasMergedRemoteRef = useRef(false);
  useEffect(() => {
    if (!remoteReminders || hasMergedRemoteRef.current) return;
    hasMergedRemoteRef.current = true;
    const remoteIds = Object.keys(remoteReminders);
    if (remoteIds.length === 0) return; // ไม่มีอะไรให้ merge (ยังไม่เคย sync ขึ้นไปเลย หรือ user ใหม่)

    setReminders((prevLocal) => {
      const byId = new Map(prevLocal.map((r) => [r.id, r]));
      for (const id of remoteIds) {
        const remoteFields = remoteReminders[id];
        const existingLocal = byId.get(id);
        if (existingLocal) {
          // มีทั้งสองฝั่ง — schedule fields จาก remote ชนะ (เผื่อแก้จาก
          // อุปกรณ์อื่นมา), runtime fields จาก local คงเดิมไว้ (ไม่มีใน remote อยู่แล้ว)
          byId.set(id, { ...existingLocal, ...remoteFields });
        } else {
          // มีแค่ฝั่ง remote (เช่น สร้างจากอุปกรณ์อื่น) — เพิ่มเข้า local
          // โดยไม่มี runtime field ใดๆ (nextDueAt จะถูกคำนวณใหม่จาก effect
          // ที่มีอยู่แล้วด้านล่างซึ่งรัน checkDue() ทุกวินาทีอยู่แล้ว)
          byId.set(id, { id, ...remoteFields });
        }
      }
      return Array.from(byId.values());
    });
  }, [remoteReminders]);

  const [dueReminders, setDueReminders] = useState([]);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);

  const [draft, setDraft] = useState(createBlankDraft);

  const [editingId, setEditingId] = useState(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false); // composer เริ่มต้นแบบพับเก็บ ประหยัดพื้นที่
  const [nowTick, setNowTick] = useState(() => Date.now()); // อัปเดตทุกวินาที เพื่อให้ countdown แสดงเวลานับถอยหลังแบบ live

  const tapeScrollRef = useRef(null);
  const isUserInteractingRef = useRef(false);
  const idleTimeoutRef = useRef(null);
  const hasSnappedInitiallyRef = useRef(false); // true = เคย sync ตำแหน่งกับเวลาจริงแล้ว รอบต่อไปให้ไหลต่อเนื่อง ไม่สแนปซ้ำ

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    const checkDue = () => {
      const now = Date.now();
      setNowTick(now); // อัปเดตเวลา "ตอนนี้" ทุกวินาที ให้ countdown บนการ์ด tick แบบ live
      const due = reminders.filter((r) => r.enabled && r.nextDueAt && r.nextDueAt <= now && r.type !== REMINDER_TYPE.ROUTINE && r.type !== REMINDER_TYPE.STOPWATCH);
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

  // เส้นสีเหลืองบาง ๆ สำหรับ Countdown/Stopwatch ที่กำลังทำงาน
  // คำนวณตำแหน่งเทียบกับ "ตอนนี้" (now-indicator ที่ล็อกอยู่กลาง viewport เสมอ) แทนที่จะอิงตำแหน่ง scroll ของ track
  // เพื่อให้เส้นแสดงผลเต็มความยาวเสมอ ไม่ถูกครอบตัดโดย overflow ของ tape-scroll-container
  // top คือระยะ px จากกึ่งกลาง viewport (ค่าลบ = อยู่เหนือกึ่งกลาง, ค่าบวก = อยู่ใต้กึ่งกลาง)
  const runningLines = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const pxPerMinute = singleDayHeight / 1440;
    const nowMinute = minuteOfDayAtPrecise(nowTick);

    return reminders
      .map((r) => {
        const span = getRunningLineSpan(r, nowTick, startOfToday);
        if (!span) return null;
        return {
          id: r.id,
          top: (span.startMinute - nowMinute) * pxPerMinute,
          height: (span.endMinute - span.startMinute) * pxPerMinute,
          color: r.lineColor || DEFAULT_LINE_COLOR
        };
      })
      .filter(Boolean);
  }, [reminders, nowTick, singleDayHeight]);

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

  const scheduleNext = (reminderId) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;
        if (isOneShotType(r.type)) return { ...r, enabled: false, nextDueAt: Infinity };
        return { ...r, nextDueAt: computeNextDueAt(r, Date.now()) };
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
          return { ...r, currentIndex: 0, enabled: false };
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
          // Countdown ประเภทเดียวที่ "เปิดใหม่" ควรหมายถึงเริ่มนับใหม่ทั้งหมด
          // (ถ้าใช้ startedAt เดิม endMs จะเป็นอดีตไปแล้ว ทำให้ยิงแจ้งเตือนทันทีที่เปิด)
          if (r.type === REMINDER_TYPE.COUNTDOWN) {
            const restarted = { ...r, enabled: true, startedAt: Date.now() };
            return { ...restarted, nextDueAt: computeNextDueAt(restarted, Date.now()) };
          }

          // Once-at ที่เวลาผ่านไปแล้ว เปิดสวิตช์กลับไม่มีประโยชน์ (จะยิงทันที) ต้องให้ผู้ใช้แก้ไขวันที่/เวลาใหม่แทน
          if (r.type === REMINDER_TYPE.ONCE_AT && r.atMs && r.atMs <= Date.now()) {
            alert("เวลาที่ตั้งไว้ผ่านไปแล้ว กรุณาแก้ไขวันที่และเวลาใหม่ก่อนเปิดใช้งานอีกครั้ง");
            return r;
          }

          const nextDue = computeNextDueAt(r, Date.now());
          return { ...r, enabled: true, nextDueAt: nextDue };
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
      enabled: true
    };

    if (draft.type === REMINDER_TYPE.INTERVAL) {
      newReminder.amount = parseInt(draft.amount) || 30;
      newReminder.unit = draft.unit;
      if (draft.windowStart && draft.windowEnd) {
        newReminder.windowStart = draft.windowStart;
        newReminder.windowEnd = draft.windowEnd;
      }
    } else if (draft.type === REMINDER_TYPE.WEEKLY) {
      newReminder.days = draft.days;
      newReminder.time = draft.time;
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

    newReminder.nextDueAt = computeNextDueAt(newReminder, Date.now());

    if (editingId) {
      setReminders((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...newReminder } : r)));
      setEditingId(null);
    } else {
      setReminders((prev) => [...prev, newReminder]);
    }

    // Sync schedule fields ขึ้น Firebase — immediate: true เพราะนี่คือ
    // ตอน submit ฟอร์มจริง (กดปุ่ม "สร้าง"/"บันทึกการแก้ไข") ไม่ใช่ตอน
    // พิมพ์ใน draft ระหว่างทาง จึงไม่ต้อง debounce
    syncScheduleFields(newReminder.id, extractScheduleFields(newReminder), { immediate: true });

    setDraft(createBlankDraft());
    setIsComposerOpen(false); // บันทึกเสร็จแล้วพับ composer กลับ คืนพื้นที่ให้ list
  };

  const deleteReminder = (reminderId) => {
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    deleteRemoteReminder(reminderId);
  };

  const startEdit = (reminder) => {
    setIsComposerOpen(true); // แก้ไข reminder ต้องเปิด composer ให้เห็นฟอร์มด้วย
    setEditingId(reminder.id);
    setDraft({
      title: reminder.title,
      type: reminder.type,
      amount: String(reminder.amount || 30),
      unit: reminder.unit || "minutes",
      windowStart: reminder.windowStart || "",
      windowEnd: reminder.windowEnd || "",
      atTime: reminder.atMs ? new Date(reminder.atMs).toTimeString().slice(0, 5) : "",
      atDate: reminder.atMs ? toLocalDateInputValue(reminder.atMs) : "",
      countdownMinutes: reminder.durationMs ? String(reminder.durationMs / 60000) : "20",
      days: reminder.days || [1, 3, 5],
      time: reminder.time || "08:00",
      eventName: reminder.eventName || "",
      afterAmount: String(reminder.afterAmount || 2),
      afterUnit: reminder.afterUnit || "hours",
      routineSteps: reminder.steps ? reminder.steps.join(", ") : "แปรงฟัน, ยืดตัว, กินวิตามิน",
      lineColor: reminder.lineColor || DEFAULT_LINE_COLOR
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

  const activeReminders = reminders.filter((r) => r.enabled);
  const pausedReminders = reminders.filter((r) => !r.enabled);

  const zoomOut = () => setZoomIndex(Math.max(0, zoomIndex - 1));
  const zoomIn = () => setZoomIndex(Math.min(ZOOM_LEVELS_MINUTES.length - 1, zoomIndex + 1));

  const renderReminder = (reminder) => (
    <div key={reminder.id} className={`reminder-card ${reminder.enabled ? "active" : ""}`}>
      <div className="reminder-type-icon">
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

      <div className="reminder-card-actions">
        <button type="button" className="icon-btn" onClick={() => startEdit(reminder)} title="แก้ไข">
          ✏️
        </button>
        <button type="button" className="icon-btn" onClick={() => deleteReminder(reminder.id)} title="ลบ">
          🗑️
        </button>
      </div>
    </div>
  );

  return (
    <div className="reminder-app-container">
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

        .dashboard-body {
          display: grid;
          grid-template-columns: 380px 1fr;
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
          background: var(--g-red);
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
          background: var(--g-red);
        }

        .tape-scroll-container {
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          scroll-behavior: auto;
          -webkit-overflow-scrolling: touch;
          will-change: scroll-position;
          transform: translateZ(0);
          overscroll-behavior: contain;
        }

        .tape-track-wrapper {
          position: relative;
        }

        /* แถบสีบาง ๆ (สีเลือกได้) แสดง Countdown/Stopwatch ที่กำลังทำงาน
           อยู่ใน timeline-viewport (จุดเดียวกับ now-indicator) ไม่ใช่ track ที่ scroll
           จึงไม่ถูก overflow ของ tape-scroll-container ครอบตัด แสดงผลเต็มความยาวเสมอ (ตัดแค่ขอบ viewport จริง ๆ เท่านั้น)
           กว้างเต็มพื้นที่แถว (left: 84px ถึง right: 8px ตรงกับ event-chip-group) ใช้ linear-gradient จางเข้าออก
           ทั้งสองด้าน ให้เห็นเส้น time-row/grid ทะลุผ่านพื้นหลังได้ ไม่ทึบจนบังข้อมูล */
        .running-timer-line {
          position: absolute;
          left: 84px;
          right: 8px;
          border-radius: 8px;
          z-index: 4;
          pointer-events: none;
          background-color: var(--line-color, #fbbc04);
          opacity: 0.22;
          background: linear-gradient(
            180deg,
            transparent 0%,
            color-mix(in srgb, var(--line-color, #fbbc04) 30%, transparent) 15%,
            color-mix(in srgb, var(--line-color, #fbbc04) 30%, transparent) 85%,
            transparent 100%
          );
          border-left: 3px solid var(--line-color, #fbbc04);
          border-right: 3px solid var(--line-color, #fbbc04);
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
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
        }

        .event-chip-group::-webkit-scrollbar {
          display: none;
        }

        .event-chip {
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

        .reminder-type-icon {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--g-background);
          color: var(--g-on-surface-variant);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 11px;
          flex-shrink: 0;
        }

        .active .reminder-type-icon {
          background: var(--g-yellow);
          color: #202124;
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
          display: flex;
          gap: 2px;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .reminder-card:hover .reminder-card-actions,
        .reminder-card:focus-within .reminder-card-actions {
          opacity: 1;
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
          .timeline-panel {
            min-height: 360px;
          }
        }
      `}</style>

      {/* Alert Banner */}
      {dueReminders.length > 0 && (
        <div className="due-alert-banner" role="alert">
          <span>🔔 ถึงเวลาแล้ว: {dueReminders.map((r) => r.title).join(", ")}</span>
          <div className="due-alert-actions">
            {dueReminders.map((r) => (
              <button key={r.id} className="btn-snooze" onClick={() => scheduleNext(r.id)}>
                เตือนอีกครั้ง ({r.title})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Body Grid */}
      <div className="dashboard-body">
        {/* Timeline Section */}
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
            <div className="now-indicator" />

            {/* เส้นสีเหลืองบาง ๆ แสดง Countdown/Stopwatch ที่กำลังทำงาน
                วางใน timeline-viewport (ไม่ใช่ track ที่ scroll) จึงไม่ถูก overflow ครอบตัด และแสดงเต็มความยาวเสมอ
                ตำแหน่งคำนวณเทียบกับกึ่งกลาง viewport (จุดเดียวกับ now-indicator) */}
            {runningLines.map((line) => (
              <div
                key={line.id}
                className="running-timer-line"
                style={{ top: `calc(50% + ${line.top}px)`, height: `${line.height}px`, "--line-color": line.color }}
              />
            ))}

            <div
              className="tape-scroll-container"
              ref={tapeScrollRef}
              onScroll={handleUserInteraction}
              onWheel={handleUserInteraction}
              onTouchMove={handleUserInteraction}
            >
              <div className="tape-track-wrapper">
                {/* Spacer บน: ยืดขอบออกจากแถว 00:00 ไม่ให้ now-indicator ชนขอบ container
                    เป็น slot เปิดไว้ เผื่อใส่ contentอื่นในอนาคต (เช่น แบนเนอร์/โฆษณา) */}
                <div className="tape-spacer tape-spacer-top" style={{ height: `${SPACER_HEIGHT_PX}px` }}>
                  {/* TODO: ใส่ content เพิ่มเติมได้ที่นี่ในอนาคต เช่น <AdSlot position="timeline-top" /> */}
                </div>

                <TimelineRows tapeRows={tapeRows} nowTick={nowTick} />

                {/* Spacer ล่าง: ยืดขอบออกจากแถว 24:00 ไม่ให้ now-indicator ชนขอบ container
                    เป็น slot เปิดไว้ เผื่อใส่ content อื่นในอนาคตเช่นกัน */}
                <div className="tape-spacer tape-spacer-bottom" style={{ height: `${SPACER_HEIGHT_PX}px` }}>
                  {/* TODO: ใส่ content เพิ่มเติมได้ที่นี่ในอนาคต เช่น <AdSlot position="timeline-bottom" /> */}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Reminders Dashboard */}
        <section className="main-panel">
          <div className="main-panel-toolbar">
            <div>
              <h2>การแจ้งเตือนทั้งหมด</h2>
              <p className="toolbar-subtitle">{reminders.length} รายการ · กำลังทำงาน {activeReminders.length} รายการ</p>
            </div>
            {/* พื้นที่เผื่อฟีเจอร์ใหม่ในอนาคต เช่น filter chip / tab เพิ่มเติม วางต่อจากนี้ได้โดยไม่ดันความสูง toolbar */}
            <button type="button" className={`add-reminder-btn ${isComposerOpen ? "is-open" : ""}`} onClick={toggleComposer}>
              <span className="add-reminder-btn-icon">+</span> {isComposerOpen ? "ปิดฟอร์ม" : "เพิ่ม Reminder"}
            </button>
          </div>

          <div className="reminders-scroll-area">
            {/* Composer แบบ inline expand/collapse: พับเก็บเป็นค่าเริ่มต้นเพื่อประหยัดพื้นที่
                เมื่อกด "เพิ่ม Reminder" หรือกด "แก้ไข" การ์ดใดการ์ดหนึ่ง จะดันลงมาแสดงแทนที่ */}
            {isComposerOpen && (
              <form className="composer-card" onSubmit={submitReminderForm}>
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
                    <label>ช่วงเวลาที่ทำงาน (Optional)</label>
                    <div className="composer-row">
                      <input className="form-input" type="time" value={draft.windowStart} onChange={(e) => setDraft((prev) => ({ ...prev, windowStart: e.target.value }))} />
                      <input className="form-input" type="time" value={draft.windowEnd} onChange={(e) => setDraft((prev) => ({ ...prev, windowEnd: e.target.value }))} />
                    </div>
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
                    <input className="form-input" type="time" value={draft.time} onChange={(e) => setDraft((prev) => ({ ...prev, time: e.target.value }))} />
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
                <button className="btn-text" type="button" onClick={cancelEditing}>ยกเลิก</button>
                <button className="btn-contained" type="submit">
                  {editingId ? "บันทึกการแก้ไข" : "สร้าง Reminder"}
                </button>
              </div>
              </form>
            )}

            {activeReminders.length > 0 && (
              <>
                <p className="section-header">กำลังทำงาน</p>
                {activeReminders.map(renderReminder)}
              </>
            )}

            {pausedReminders.length > 0 && (
              <>
                <p className="section-header">ปิดใช้งาน</p>
                {pausedReminders.map(renderReminder)}
              </>
            )}

            {reminders.length === 0 && !isComposerOpen && (
              <p className="empty-state">ยังไม่มีการแจ้งเตือน กด "เพิ่ม Reminder" เพื่อเริ่มต้น</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}