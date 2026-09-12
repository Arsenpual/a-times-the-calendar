import { REMINDER_TYPE, hasWindow } from "./reminder-due-logic.js";
function intervalLabel(reminder) {
  const unit = reminder.unit === "hours" ? "ชั่วโมง" : "นาที";
  const base = `ทุก ${reminder.amount} ${unit}`;
  return hasWindow(reminder) ? `${base} (${reminder.windowStart}-${reminder.windowEnd})` : base;
}

// hasWindow ย้ายไป ../reminder-due-logic.js แล้ว (migration plan v2 เฟส 5)

// จัดรูปแบบวินาทีทั้งหมดเป็น "mm:ss" หรือ "h:mm:ss" ถ้าเกิน 1 ชั่วโมง ใช้ร่วมกันทั้ง stopwatch และ countdown
export function formatDurationClock(totalSeconds) {
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  if (hh > 0) {
    return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function formatDigitalClock(timestamp) {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

// minuteOfDayAt/minutesFromHHMM/isMinuteWithinWindow/snapToNextWindowStart/
// computeNextDueAt ทั้งหมดย้ายไป ../reminder-due-logic.js แล้ว (migration
// plan v2 เฟส 5, import ไว้ด้านบนของไฟล์) — เป็น prerequisite ของ FCM
// scheduler ฝั่ง Cloud Function ที่ต้องคำนวณ due-date ตรงกับ client เป๊ะๆ
// ดูคอมเมนต์ท้ายไฟล์นั้นสำหรับรายละเอียด

export function describeReminder(reminder, nowMs) {
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
