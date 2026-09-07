import { REMINDER_TYPE } from "./reminder-due-logic.js";

const DAY_BY_THAI_NAME = {
  "อา": 0, "อาทิตย์": 0,
  "จ": 1, "จันทร์": 1,
  "อ": 2, "อังคาร": 2,
  "พ": 3, "พุธ": 3,
  "พฤ": 4, "พฤหัส": 4, "พฤหัสบดี": 4,
  "ศ": 5, "ศุกร์": 5,
  "ส": 6, "เสาร์": 6
};

function normalizeDigits(value) {
  return value.replace(/[๐-๙]/g, (digit) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit)));
}

function parseDays(value) {
  const tokens = value.trim().split(/[\s,،/]+/).filter(Boolean);
  const days = tokens.map((token) => DAY_BY_THAI_NAME[token]);
  if (days.length === 0 || days.some((day) => day === undefined) || new Set(days).size !== days.length) return null;
  return days.sort((a, b) => a - b);
}

function validTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * แปลงประโยคสร้าง reminder ที่รองรับใน Phase 6 เป็น draft เล็ก ๆ โดยไม่มี
 * side effect เพื่อให้ UI preview กับการกด Enter ใช้คำตอบเดียวกันเสมอ.
 */
export function parseReminderQuickInput(input) {
  const text = normalizeDigits(input.trim());
  if (!text) return { matched: false, confidence: 0, reminder: null, description: "" };

  let match = text.match(/^เตือน\s*(.+?)\s*ใน\s*(\d+)\s*นาที$/);
  if (match && Number(match[2]) > 0) {
    return {
      matched: true,
      confidence: 1,
      reminder: { title: match[1].trim(), type: REMINDER_TYPE.COUNTDOWN, minutes: Number(match[2]) },
      description: `นับถอยหลัง ${Number(match[2])} นาที`
    };
  }

  match = text.match(/^เตือน\s*(.+?)\s*ทุกวัน\s*(.+?)\s*เวลา\s*(\d{1,2}:\d{2})$/);
  if (match) {
    const days = parseDays(match[2]);
    if (days && validTime(match[3])) {
      const time = match[3].padStart(5, "0");
      return {
        matched: true,
        confidence: 1,
        reminder: { title: match[1].trim(), type: REMINDER_TYPE.WEEKLY, days, time },
        description: `ทุกวัน ${match[2].trim()} เวลา ${time}`
      };
    }
  }

  match = text.match(/^เตือน\s*(.+?)\s*ทุก\s*(\d+)\s*(นาที|นาท|ชม\.?|ชั่วโมง)$/);
  if (match && Number(match[2]) > 0) {
    const unit = /ชม|ชั่วโมง/.test(match[3]) ? "hours" : "minutes";
    return {
      matched: true,
      confidence: 1,
      reminder: { title: match[1].trim(), type: REMINDER_TYPE.INTERVAL, amount: Number(match[2]), unit },
      description: `ทุก ${Number(match[2])} ${unit === "hours" ? "ชั่วโมง" : "นาที"}`
    };
  }

  return { matched: false, confidence: 0, reminder: null, description: "เปิดฟอร์มสร้าง Reminder พร้อมข้อความนี้" };
}
