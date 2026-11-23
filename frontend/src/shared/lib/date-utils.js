// ทุกฟังก์ชันที่ format วันที่เป็นข้อความรับ `lang` ("th"|"en") เป็นพารามิเตอร์
// สุดท้ายเสมอ ค่า default เป็น "th" เพื่อคง backward-compat กับจุดเรียกเก่าที่
// ยังไม่ได้ส่ง lang มา (เผื่อมีจุดที่ตกหล่นตอน migrate) — ชื่อเดือน/วันและปี
// พ.ศ.-ค.ศ. ดึงมาจาก i18n-catalog.js จุดเดียว ไม่มี Thai-specific array อยู่ในไฟล์นี้
// เองอีกต่อไป ฟังก์ชันที่ไม่เกี่ยวกับการแสดงผล (isSameDay, getWeekRange,
// activityDate, toDateInputValue ฯลฯ) ไม่ต้องรับ lang เพราะทำงานกับ Date
// object/ISO string ล้วนๆ ไม่มีข้อความให้แปล
import { MONTHS, MONTHS_SHORT, WEEKDAYS_SHORT, displayYear, DEFAULT_LANGUAGE } from "../i18n/i18n-catalog.js";

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
 * Activity weeks use normal Sunday–Saturday calendar weeks. Only the first
 * and final week of a year may be partial, and their foreign-year days are
 * excluded. Four such Week blocks form a Cycle.
 */
export function getYearWeekBlock(date) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = safeDate.getFullYear();
  const yearStart = new Date(year, 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const dayMs = 24 * 60 * 60 * 1000;
  const firstSunday = new Date(yearStart);
  firstSunday.setDate(firstSunday.getDate() + ((7 - firstSunday.getDay()) % 7));
  const hasPartialFirstWeek = firstSunday.getTime() !== yearStart.getTime();
  const dateAtMidnight = new Date(safeDate);
  dateAtMidnight.setHours(0, 0, 0, 0);
  let index;
  let start;

  if (hasPartialFirstWeek && dateAtMidnight < firstSunday) {
    index = 0;
    start = new Date(yearStart);
  } else {
    index = (hasPartialFirstWeek ? 1 : 0) + Math.floor((dateAtMidnight - firstSunday) / (7 * dayMs));
    start = new Date(firstSunday);
    start.setDate(start.getDate() + (index - (hasPartialFirstWeek ? 1 : 0)) * 7);
  }
  const end = hasPartialFirstWeek && index === 0
    ? new Date(firstSunday.getFullYear(), firstSunday.getMonth(), firstSunday.getDate() - 1, 23, 59, 59, 999)
    : new Date(start);
  if (!(hasPartialFirstWeek && index === 0)) {
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  }
  if (end > yearEnd) end.setTime(yearEnd.getTime());
  const firstWeekCount = hasPartialFirstWeek ? 1 : 0;
  const regularWeekCount = Math.ceil((yearEnd.getTime() - firstSunday.getTime() + 1) / (7 * dayMs));
  return { year, index, total: firstWeekCount + regularWeekCount, start, end };
}

export function getYearWeekRange(date) {
  const { start, end } = getYearWeekBlock(date);
  return [start, end];
}

/**
 * Steps by Activity Week blocks (`delta` = ±1, etc.) without skipping partial
 * boundary weeks such as week 53 at year-end or week 1 at year-start.
 */
export function shiftYearWeek(date, delta = 1) {
  let cursor = new Date(date);
  const step = delta >= 0 ? 1 : -1;
  const count = Math.abs(Math.trunc(delta));
  for (let i = 0; i < count; i += 1) {
    const [weekStart, weekEnd] = getYearWeekRange(cursor);
    const pivot = new Date(step > 0 ? weekEnd : weekStart);
    pivot.setHours(0, 0, 0, 0);
    pivot.setDate(pivot.getDate() + step);
    const [nextStart, nextEnd] = getYearWeekRange(pivot);
    const candidate = new Date(cursor);
    candidate.setDate(candidate.getDate() + step * 7);
    if (candidate >= nextStart && candidate <= nextEnd) {
      cursor = candidate;
    } else {
      cursor = step > 0
        ? new Date(nextStart)
        : new Date(nextEnd.getFullYear(), nextEnd.getMonth(), nextEnd.getDate());
    }
  }
  return cursor;
}

/** One-based fixed seven-day Activity Week within its calendar year. */
export function weekOfYear(date) {
  return getYearWeekBlock(date).index + 1;
}

/** Total fixed seven-day Activity Week blocks in a calendar year. */
export function totalWeeksInYear(year) {
  return getYearWeekBlock(new Date(year, 11, 31)).total;
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function getDaysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDaysToDate(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function diffInDays(start, end) {
  const msPerDay = 86_400_000;
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((utcEnd - utcStart) / msPerDay) + 1;
}

function buildLonthWeeks(startDate, endDate) {
  const weeks = [];
  let currentStart = new Date(startDate);
  while (currentStart <= endDate) {
    const dayOfWeek = currentStart.getDay();
    const daysUntilSaturday = 6 - dayOfWeek;
    let currentEnd = addDaysToDate(currentStart, daysUntilSaturday);
    if (currentEnd > endDate) currentEnd = new Date(endDate);

    const days = [];
    let cur = new Date(currentStart);
    while (cur <= currentEnd) {
      days.push(new Date(cur));
      cur = addDaysToDate(cur, 1);
    }
    weeks.push({
      start: startOfDay(currentStart),
      end: endOfDay(currentEnd),
      startDate: startOfDay(currentStart),
      endDate: endOfDay(currentEnd),
      dayCount: days.length,
      days
    });
    currentStart = addDaysToDate(currentEnd, 1);
  }
  return weeks;
}

export function buildYearLonths(year) {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const jan1Day = jan1.getDay();
  const daysToFirstSaturday = (6 - jan1Day + 7) % 7;
  const firstSaturday = addDaysToDate(jan1, daysToFirstSaturday);
  const l01End = addDaysToDate(firstSaturday, 21);
  const lonths = [];

  const l01Start = startOfDay(jan1);
  const l01EndDay = endOfDay(l01End);
  lonths.push({
    id: "L01",
    index: 1,
    year,
    startDate: l01Start,
    endDate: l01EndDay,
    dayCount: diffInDays(l01Start, l01EndDay),
    isStandard28: diffInDays(l01Start, l01EndDay) === 28,
    weeks: buildLonthWeeks(l01Start, l01EndDay)
  });

  let currentStart = addDaysToDate(l01End, 1);
  for (let i = 2; i <= 13; i++) {
    const padIndex = String(i).padStart(2, "0");
    const id = `L${padIndex}`;
    const blockStart = startOfDay(currentStart);
    const blockEnd = endOfDay(addDaysToDate(currentStart, 27));
    lonths.push({
      id,
      index: i,
      year,
      startDate: blockStart,
      endDate: blockEnd,
      dayCount: 28,
      isStandard28: true,
      weeks: buildLonthWeeks(blockStart, blockEnd)
    });
    currentStart = addDaysToDate(currentStart, 28);
  }

  const l14Start = startOfDay(currentStart);
  const l14End = endOfDay(dec31);
  lonths.push({
    id: "L14",
    index: 14,
    year,
    startDate: l14Start,
    endDate: l14End,
    dayCount: diffInDays(l14Start, l14End),
    isStandard28: diffInDays(l14Start, l14End) === 28,
    weeks: buildLonthWeeks(l14Start, l14End)
  });
  return lonths;
}

const yearLonthsCache = new Map();

export function getCachedYearLonths(year) {
  if (!yearLonthsCache.has(year)) {
    yearLonthsCache.set(year, buildYearLonths(year));
  }
  return yearLonthsCache.get(year);
}

export function findLonthByDate(date) {
  const target = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = target.getFullYear();
  const lonths = getCachedYearLonths(year);
  const targetDay = startOfDay(target).getTime();
  for (const lonth of lonths) {
    const start = startOfDay(lonth.startDate).getTime();
    const end = startOfDay(lonth.endDate).getTime();
    if (targetDay >= start && targetDay <= end) {
      const dayIndex = diffInDays(lonth.startDate, target);
      return { ...lonth, dayIndex };
    }
  }
  return targetDay < startOfDay(lonths[0].startDate).getTime()
    ? { ...lonths[0], dayIndex: 1 }
    : { ...lonths[13], dayIndex: lonths[13].dayCount };
}

export function getLonthById(year, lonthId) {
  const lonths = getCachedYearLonths(year);
  return lonths.find((item) => item.id === lonthId) || lonths[0];
}

export function getAdjacentLonth(year, lonthId, delta) {
  const lonths = getCachedYearLonths(year);
  const currentIndex = lonths.findIndex((l) => l.id === lonthId);
  const nextRawIndex = (currentIndex === -1 ? 0 : currentIndex) + delta;

  if (nextRawIndex < 0) {
    const prevYear = year - 1;
    const prevLonths = getCachedYearLonths(prevYear);
    return { year: prevYear, lonthId: "L14", lonth: prevLonths[13] };
  }
  if (nextRawIndex >= 14) {
    const nextYear = year + 1;
    const nextLonths = getCachedYearLonths(nextYear);
    return { year: nextYear, lonthId: "L01", lonth: nextLonths[0] };
  }
  const targetLonth = lonths[nextRawIndex];
  return { year, lonthId: targetLonth.id, lonth: targetLonth };
}

export function formatLonthRange(lonth, lang = DEFAULT_LANGUAGE) {
  const shortMonths = MONTHS_SHORT[lang] || MONTHS_SHORT.th;
  const startMonth = shortMonths[lonth.startDate.getMonth()];
  const endMonth = shortMonths[lonth.endDate.getMonth()];
  const startDay = lonth.startDate.getDate();
  const endDay = lonth.endDate.getDate();
  if (startMonth === endMonth) {
    return `${startDay}–${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

/**
 * Returns the 14-Lonth block containing `date` according to TIMES-CAL-001.
 *
 * Each year has exactly 14 Lonths (L01–L14):
 * - L01: Jan 1 to first Sat + 21 days
 * - L02–L13: 12 blocks of exactly 28 days (4 standard Sunday–Saturday weeks) = 336 days
 * - L14: remaining days through Dec 31
 */
export function getYearLonth(date) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const lonth = findLonthByDate(safeDate);
  const weeks = lonth.weeks.map((w) => ({
    start: w.startDate,
    end: w.endDate,
    dayCount: w.dayCount,
    days: w.days
  }));
  return {
    id: lonth.id,
    lonthId: lonth.id,
    lonthNumber: lonth.index,
    totalLonths: 14,
    year: lonth.year,
    start: lonth.startDate,
    end: lonth.endDate,
    dayCount: lonth.dayCount,
    isStandard28: lonth.isStandard28,
    weeks,
    weekCount: weeks.length,
    // Backward-compatibility:
    cycleNumber: lonth.index,
    totalCycles: 14
  };
}

export const getYearCycle = getYearLonth;

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

/** Standard Gregorian month range and Sunday-first week rows for Month view. */
export function getMonthCycle(date) {
  const anchor = new Date(date);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const [gridStart] = getWeekRange(monthStart);
  const [, gridEnd] = getWeekRange(monthEnd);
  const weeks = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const start = new Date(cursor);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    weeks.push({ start, end });
    cursor.setDate(cursor.getDate() + 7);
  }
  return {
    start: monthStart,
    end: monthEnd,
    gridStart,
    gridEnd,
    year,
    month,
    weeks
  };
}
