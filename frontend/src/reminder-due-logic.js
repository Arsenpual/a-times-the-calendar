// Pure due-date calculation logic สำหรับ reminder mode — แยกออกมาจาก
// reminder-mode.jsx (migration plan v2 เฟส 5, prerequisite 5.1)
//
// เหตุผลที่แยกไฟล์: เฟส 5 ต้องมี Cloud Function ตรวจ due reminder แบบ
// server-side (เพื่อส่ง FCM push แม้ผู้ใช้ปิดแท็บ) ซึ่งต้องคำนวณ "ถึงกำหนด
// เมื่อไหร่" เหมือนกับที่ client คำนวณเป๊ะๆ ไม่งั้น client กับ server จะ
// เห็นเวลา due ไม่ตรงกัน (race condition ที่ระบุไว้เป็นความเสี่ยงเฉพาะของ
// เฟส 5 ในแผน) การมีไฟล์นี้เป็น "ต้นทาง" เดียวแล้วให้ทั้ง frontend และ
// functions/ (Cloud Function) import ไปใช้ ดีกว่า copy-paste แล้วเสี่ยงลืม
// แก้พร้อมกันทั้งสองที่
//
// ⚠️ ข้อจำกัดของ repo layout ปัจจุบัน: frontend/ และ functions/ เป็นคนละ
// npm package แยกกัน (Vite bundle ฝั่งหนึ่ง, Cloud Functions Node ฝั่งหนึ่ง)
// จึง import ข้ามโฟลเดอร์กันตรงๆ ไม่ได้ในสถานะปัจจุบัน — ไฟล์นี้ (ESM,
// สำหรับ frontend) คือต้นฉบับที่ถือว่าถูกต้องที่สุด ส่วน
// functions/reminder-due-logic.js เป็นสำเนา CommonJS ที่ port มาจากไฟล์นี้
// ทุกครั้งที่แก้ไขไฟล์นี้ ต้องไปแก้ functions/reminder-due-logic.js ให้
// ตรงกันด้วยเสมอ (มีคอมเมนต์เตือนแบบเดียวกันไว้ในไฟล์นั้น) — ถ้าในอนาคต
// ทำ repo เป็น monorepo จริงจัง (เช่น npm workspaces) ควรรวมเป็นไฟล์เดียว
// แล้วให้ทั้งสองฝั่ง import จาก package กลางแทน

export const REMINDER_TYPE = {
  INTERVAL: "interval",
  WEEKLY: "weekly",
  EVENT_ANCHORED: "event-anchored",
  ROUTINE: "routine",
  ONCE_AT: "once-at",
  COUNTDOWN: "countdown",
  STOPWATCH: "stopwatch"
};

export function isOneShotType(type) {
  return type === REMINDER_TYPE.ONCE_AT || type === REMINDER_TYPE.COUNTDOWN;
}

export function intervalMs(reminder) {
  return reminder.amount * (reminder.unit === "hours" ? 60 * 60 * 1000 : 60 * 1000);
}

export function hasWindow(reminder) {
  return Boolean(reminder.windowStart && reminder.windowEnd);
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

// สาม helper ด้านบน export ออกไปด้วย (นอกจากใช้ใน computeNextDueAt เอง)
// เพราะ reminder-mode.jsx เอาไปใช้ต่อใน getReminderTimeSlots() สำหรับวาด
// timeline visualization ด้วยเช่นกัน — ไม่ใช่แค่ due-checking — export
// รวมไว้ที่นี่กันไม่ให้ reminder-mode.jsx ต้องมี copy ซ้ำของฟังก์ชันกลุ่มนี้
export { minuteOfDayAt, minutesFromHHMM, isMinuteWithinWindow };

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

/**
 * คำนวณ timestamp ถัดไปที่ reminder นี้ควรยิง — ดู
 * reminder-mode-deep-dive.md หัวข้อ 3 สำหรับคำอธิบาย logic แต่ละ type
 * แบบละเอียด (ย้ายมาที่นี่ทั้งไฟล์ไม่ได้เปลี่ยน logic ใดๆ เลยจากต้นฉบับ
 * ใน reminder-mode.jsx เดิม)
 * @param {object} reminder
 * @param {number} from timestamp เริ่มคำนวณจากจุดนี้ (ปกติคือ Date.now())
 */
export function computeNextDueAt(reminder, from) {
  switch (reminder.type) {
    case REMINDER_TYPE.WEEKLY: {
      const times = (reminder.times?.length ? reminder.times : [reminder.time]).filter(Boolean).sort();
      if (!reminder.days || reminder.days.length === 0 || times.length === 0) return Infinity;

      const baseDate = new Date(from);

      for (let i = 0; i < 8; i++) {
        const candidate = new Date(baseDate);
        candidate.setDate(baseDate.getDate() + i);
        if (!reminder.days.includes(candidate.getDay())) continue;
        for (const time of times) {
          const targetMin = minutesFromHHMM(time);
          candidate.setHours(Math.floor(targetMin / 60), targetMin % 60, 0, 0);
          if (candidate.getTime() > from) return candidate.getTime();
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

/**
 * True ถ้า reminder นี้ควรปรากฏใน due-checking (banner/push) ตอนนี้ —
 * รวม logic การกรองที่ checkDue() ใน reminder-mode.jsx ใช้ทั้งหมดไว้ที่นี่
 * (enabled, ไม่ completedAt, ถึงเวลาแล้ว, ไม่ใช่ routine/stopwatch) เพื่อ
 * ให้ Cloud Function (เฟส 5) เรียกใช้เงื่อนไขเดียวกันเป๊ะๆ กับ client แทน
 * ที่จะคัดลอกเงื่อนไข if ซ้ำอีกที่
 * @param {object} reminder
 * @param {number} now
 */
export function isReminderDue(reminder, now) {
  // A stale nextDueAt can arrive from an older local record or remote mirror
  // after the user has edited weekly days. Never alert on a day outside the
  // selected set, except an explicit user snooze which may intentionally
  // land on another day.
  const weeklyDayMatches = reminder.type !== REMINDER_TYPE.WEEKLY ||
    reminder.snoozedUntil === reminder.nextDueAt ||
    reminder.days?.includes(new Date(reminder.nextDueAt).getDay());
  return (
    !!reminder.enabled &&
    !reminder.completedAt &&
    !!reminder.nextDueAt &&
    reminder.nextDueAt <= now &&
    weeklyDayMatches &&
    reminder.type !== REMINDER_TYPE.ROUTINE &&
    reminder.type !== REMINDER_TYPE.STOPWATCH
  );
}
