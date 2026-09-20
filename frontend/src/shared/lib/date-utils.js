// ทุกฟังก์ชันที่ format วันที่เป็นข้อความรับ `lang` ("th"|"en") เป็นพารามิเตอร์
// สุดท้ายเสมอ ค่า default เป็น "th" เพื่อคง backward-compat กับจุดเรียกเก่าที่
// ยังไม่ได้ส่ง lang มา (เผื่อมีจุดที่ตกหล่นตอน migrate) — ชื่อเดือน/วันและปี
// พ.ศ.-ค.ศ. ดึงมาจาก i18n.jsx จุดเดียว ไม่มี Thai-specific array อยู่ในไฟล์นี้
// เองอีกต่อไป ฟังก์ชันที่ไม่เกี่ยวกับการแสดงผล (isSameDay, getWeekRange,
// activityDate, toDateInputValue ฯลฯ) ไม่ต้องรับ lang เพราะทำงานกับ Date
// object/ISO string ล้วนๆ ไม่มีข้อความให้แปล
import { MONTHS, MONTHS_SHORT, WEEKDAYS_SHORT, displayYear, DEFAULT_LANGUAGE } from "../i18n/i18n.jsx";

export function formatMonthYear(date, lang = DEFAULT_LANGUAGE) {
  return `${MONTHS[lang][date.getMonth()]} ${displayYear(date.getFullYear(), lang)}`;
}

export function weekdayShortLabels(lang = DEFAULT_LANGUAGE) {
  return WEEKDAYS_SHORT[lang];
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Builds a 6-week (42 day) grid for the given month, including the
 * trailing/leading days from adjacent months, like Google Calendar's month view.
 */
export function buildMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startOffset);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Returns [startOfWeek(Sun), endOfWeek(Sat)] for the week containing `date`. */
export function getWeekRange(date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

export function startOfMonthRangeForFetch(monthDate) {
  const days = buildMonthGrid(monthDate);
  const start = days[0];
  const end = new Date(days[days.length - 1]);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

/** Extracts a JS Date from a Google Calendar activity's start/end object. */
export function activityDate(activityDateTimeObj) {
  if (!activityDateTimeObj) return null;
  if (activityDateTimeObj.dateTime) return new Date(activityDateTimeObj.dateTime);
  if (activityDateTimeObj.date) return new Date(activityDateTimeObj.date + "T00:00:00");
  return null;
}

/**
 * toLocaleTimeString's locale tag controls things like am/pm conventions
 * and separator characters, not just digit script — "th-TH" and "en-US"
 * both render as 24-hour "HH:mm" for this app's chosen options either way,
 * but keeping the locale tag correct per-language is still more robust
 * against future Intl behavior differences than hardcoding "th-TH" always.
 */
export function formatTime(date, lang = DEFAULT_LANGUAGE) {
  const locale = lang === "th" ? "th-TH" : "en-US";
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * Converts a weekday label (short label in the given language, e.g. "อา" or
 * "Sun") back into an actual Date within the week starting at `weekStart`.
 */
export function dateForWeekdayLabel(weekStart, label, lang = DEFAULT_LANGUAGE) {
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + offset);
    if (WEEKDAYS_SHORT[lang][date.getDay()] === label) return date;
  }
  return null;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Formats a Date as "YYYY-MM-DD" for an <input type="date"> value. */
export function toDateInputValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Formats a Date as "HH:mm" for an <input type="time"> value. */
export function toTimeInputValue(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Combines separate "YYYY-MM-DD" and "HH:mm" input values into a Date in
 * local time (used when building the event body to send to Google Calendar).
 */
export function combineDateAndTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = (timeStr || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

/** e.g. "17 - 23 ก.ค. 2569" (th) or "17 - 23 Jul 2026" (en) for the week containing `date`. */
export function formatWeekRange(date, lang = DEFAULT_LANGUAGE) {
  const [start, end] = getWeekRange(date);
  const shortMonths = MONTHS_SHORT[lang];
  // เดิมใช้ end.getFullYear() ตัวเดียวสำหรับทั้งช่วง — พอสัปดาห์คาบเกี่ยว
  // ข้ามปี (เช่น เริ่ม 28 ธ.ค. 2568 จบ 3 ม.ค. 2569) จะโชว์ปีของ "end" ทับ
  // วันที่ของ "start" ที่จริงๆ อยู่คนละปี ทำให้วันที่ผิดปีไปเงียบๆ — ต้อง
  // คำนวณปีที่แสดงของแต่ละฝั่งแยกกันเผื่อกรณีนี้โดยเฉพาะ (แปลงผ่าน
  // displayYear() ให้ถูก พ.ศ./ค.ศ. ตามภาษาด้วย ไม่ hardcode +543 ตรงนี้)
  const startDisplayYear = displayYear(start.getFullYear(), lang);
  const endDisplayYear = displayYear(end.getFullYear(), lang);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} - ${end.getDate()} ${shortMonths[end.getMonth()]} ${endDisplayYear}`;
  }
  if (start.getFullYear() !== end.getFullYear()) {
    // สัปดาห์คาบเกี่ยวข้ามปี — กำกับปีทั้งสองฝั่งให้ชัดเจน ไม่งั้นจะดูเหมือน
    // วันที่ผิดปีไปเงียบๆ (เช่น 28 ธ.ค. ที่จริงเป็นปีก่อนหน้า)
    return `${start.getDate()} ${shortMonths[start.getMonth()]} ${startDisplayYear} - ${end.getDate()} ${shortMonths[end.getMonth()]} ${endDisplayYear}`;
  }
  return `${start.getDate()} ${shortMonths[start.getMonth()]} - ${end.getDate()} ${shortMonths[end.getMonth()]} ${endDisplayYear}`;
}

/**
 * Activity weeks are numbered from the 1 January block, never from an
 * ISO/Sunday-start calendar week. This keeps four consecutive Week blocks
 * identical to one Cycle everywhere in the app.
 */
export function getYearWeekBlock(date) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = safeDate.getFullYear();
  const yearStart = new Date(year, 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const dayMs = 24 * 60 * 60 * 1000;
  const daysInYear = Math.round((yearEnd.getTime() - yearStart.getTime() + 1) / dayMs);
  const dayIndex = Math.min(daysInYear - 1, Math.max(0, Math.floor((safeDate.getTime() - yearStart.getTime()) / dayMs)));
  const start = new Date(yearStart);
  const index = Math.floor(dayIndex / 7);
  start.setDate(start.getDate() + index * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  if (end > yearEnd) end.setTime(yearEnd.getTime());
  return { year, index, total: Math.ceil(daysInYear / 7), start, end };
}

export function getYearWeekRange(date) {
  const { start, end } = getYearWeekBlock(date);
  return [start, end];
}

/** One-based fixed seven-day Activity Week within its calendar year. */
export function weekOfYear(date) {
  return getYearWeekBlock(date).index + 1;
}

/** Total fixed seven-day Activity Week blocks in a calendar year. */
export function totalWeeksInYear(year) {
  return getYearWeekBlock(new Date(year, 11, 31)).total;
}

/**
 * Returns the fixed four-week Cycle that contains `date`.
 *
 * Cycles are fixed 28-day blocks beginning on 1 January of the selected
 * year. Therefore Cycle 1 always has four complete weeks, and only the
 * final Cycle may be shorter. No Cycle can ever include another year.
 */
export function getYearCycle(date, cycleWeeks = 4) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const activeWeek = getYearWeekBlock(safeDate);
  const cycleIndex = Math.floor(activeWeek.index / cycleWeeks);
  const firstWeekIndex = cycleIndex * cycleWeeks;
  const weekCount = Math.min(cycleWeeks, activeWeek.total - firstWeekIndex);
  const weeks = Array.from({ length: weekCount }, (_, offset) => {
    const dateInWeek = new Date(activeWeek.year, 0, 1);
    dateInWeek.setDate(dateInWeek.getDate() + (firstWeekIndex + offset) * 7);
    return getYearWeekBlock(dateInWeek);
  });
  const start = new Date(weeks[0].start);
  const end = new Date(weeks.at(-1).end);
  return {
    year: activeWeek.year,
    start,
    end,
    weekCount,
    weeks,
    cycleNumber: cycleIndex + 1,
    totalCycles: Math.ceil(activeWeek.total / cycleWeeks)
  };
}

/** e.g. "26 กรกฎาคม สัปดาห์ที่ 31/52 ของปี" (th) or "26 July, week 31/52 of the year" (en) — the first day of the week containing `date`. */
export function formatWeekLabel(date, lang = DEFAULT_LANGUAGE) {
  const [weekStart] = getYearWeekRange(date);
  const total = totalWeeksInYear(weekStart.getFullYear());
  const monthName = MONTHS[lang][weekStart.getMonth()];
  if (lang === "th") {
    return `${weekStart.getDate()} ${monthName} สัปดาห์ที่ ${weekOfYear(date)}/${total} ของปี`;
  }
  return `${weekStart.getDate()} ${monthName}, week ${weekOfYear(date)}/${total} of the year`;
}

/**
 * e.g. "11 สิงหาคม สัปดาห์ที่ 33/53 ของปี" (th) or "11 August, week 33/53 of
 * the year" (en) — same "week N/total" tail as formatWeekLabel, but the
 * date shown is `date` itself, not the Sunday that starts its week. Used
 * for the header title when a specific day is focused/selected (see
 * app.jsx's expandedDate) so the title reflects whichever day the person
 * is actually looking at right now, while the week number still correctly
 * describes which week that day falls in.
 */
export function formatFocusedDayLabel(date, lang = DEFAULT_LANGUAGE) {
  const total = totalWeeksInYear(date.getFullYear());
  const monthName = MONTHS[lang][date.getMonth()];
  if (lang === "th") {
    return `${date.getDate()} ${monthName} สัปดาห์ที่ ${weekOfYear(date)}/${total} ของปี`;
  }
  return `${date.getDate()} ${monthName}, week ${weekOfYear(date)}/${total} of the year`;
}
