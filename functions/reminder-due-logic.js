// ⚠️ สำเนา CommonJS ของ frontend/src/reminder-due-logic.js — ต้องแก้พร้อม
// กันทั้งสองไฟล์เสมอ (migration plan v2 เฟส 5's known risk: "มีสองที่ที่
// ต้องคำนวณ due-logic ตรงกัน") repo layout ปัจจุบันมี frontend/ กับ
// functions/ เป็นคนละ npm package แยกกัน (Vite ESM bundle ฝั่งหนึ่ง,
// Cloud Functions Node CommonJS อีกฝั่งหนึ่ง) จึง import ข้ามกันตรงๆ
// ไม่ได้ในสถานะปัจจุบัน — ถ้าในอนาคตทำเป็น npm workspaces จริงจัง ควรรวม
// เป็นแพ็กเกจกลางแล้วลบไฟล์นี้ทิ้ง ให้ทั้งสองฝั่ง import จากที่เดียวแทน
//
// ต้นฉบับที่ถือว่าถูกต้องที่สุดคือ frontend/src/reminder-due-logic.js —
// ไฟล์นี้ port มาแบบ 1:1 (เปลี่ยนแค่ export syntax จาก ESM เป็น CommonJS)
// ไม่ได้ปรับ logic ใดๆ เลย

const REMINDER_TYPE = {
  INTERVAL: "interval",
  WEEKLY: "weekly",
  EVENT_ANCHORED: "event-anchored",
  ROUTINE: "routine",
  ONCE_AT: "once-at",
  COUNTDOWN: "countdown",
  STOPWATCH: "stopwatch"
};

function isOneShotType(type) {
  return type === REMINDER_TYPE.ONCE_AT || type === REMINDER_TYPE.COUNTDOWN;
}

function intervalMs(reminder) {
  return reminder.amount * (reminder.unit === "hours" ? 60 * 60 * 1000 : 60 * 1000);
}

function hasWindow(reminder) {
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
      return Infinity;
    case REMINDER_TYPE.INTERVAL:
    default: {
      const next = from + intervalMs(reminder);
      return hasWindow(reminder) ? snapToNextWindowStart(next, reminder.windowStart, reminder.windowEnd) : next;
    }
  }
}

function isReminderDue(reminder, now) {
  return (
    !!reminder.enabled &&
    !reminder.completedAt &&
    !!reminder.nextDueAt &&
    reminder.nextDueAt <= now &&
    reminder.type !== REMINDER_TYPE.ROUTINE &&
    reminder.type !== REMINDER_TYPE.STOPWATCH
  );
}

module.exports = {
  REMINDER_TYPE,
  isOneShotType,
  intervalMs,
  hasWindow,
  computeNextDueAt,
  isReminderDue
};
