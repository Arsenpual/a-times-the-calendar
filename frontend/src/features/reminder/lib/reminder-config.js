import { REMINDER_TYPE } from "./reminder-due-logic.js";
export const STORAGE_KEY = "times-reminders-v1";
export const REMINDER_STATUS_TAB = Object.freeze({
  ENABLED: "enabled",
  PAUSED: "paused",
  COMPLETED: "completed"
});

// REMINDER_TYPE ย้ายไป ../reminder-due-logic.js แล้ว (migration plan v2
// เฟส 5, import ไว้ด้านบนของไฟล์) — ดูคอมเมนต์ในไฟล์นั้นสำหรับเหตุผล

// ตัวเลือก snooze บน due-banner (migration plan v2 เฟส 1.3)
export const SNOOZE_OPTIONS_MINUTES = [5, 10, 15, 30];

// ตัวเลือกตัวกรองประเภทใน left nav (migration plan v2 เฟส 2) — module-level
// เพื่อให้ใช้ label เดียวกันได้ทั้งใน nav list และหัวข้อ toolbar เมื่อกรองอยู่
// ไม่ต้อง duplicate ข้อความ
export const TYPE_FILTER_OPTIONS = [
  { type: REMINDER_TYPE.INTERVAL, labelKey: "reminder.type.interval" },
  { type: REMINDER_TYPE.WEEKLY, labelKey: "reminder.type.weekly" },
  { type: REMINDER_TYPE.EVENT_ANCHORED, labelKey: "reminder.type.event-anchored" },
  { type: REMINDER_TYPE.ROUTINE, labelKey: "reminder.type.routine" },
  { type: REMINDER_TYPE.ONCE_AT, labelKey: "reminder.type.once-at" },
  { type: REMINDER_TYPE.COUNTDOWN, labelKey: "reminder.type.countdown" },
  { type: REMINDER_TYPE.STOPWATCH, labelKey: "reminder.type.stopwatch" }
];

export const DAYS_OF_WEEK = [
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
export const LINE_COLOR_OPTIONS = [
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
export const DEFAULT_LINE_COLOR = LINE_COLOR_OPTIONS[0].value;
