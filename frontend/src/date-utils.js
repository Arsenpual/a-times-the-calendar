const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const THAI_WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export function formatMonthYear(date) {
  return `${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export function weekdayShortLabels() {
  return THAI_WEEKDAYS_SHORT;
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

export function formatTime(date) {
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Converts a weekday label ("อา".."ส", same order the backend uses) back into
 * an actual Date within the week starting at `weekStart`.
 */
export function dateForWeekdayLabel(weekStart, label) {
  const index = THAI_WEEKDAYS_SHORT.indexOf(label);
  if (index === -1) return null;
  const d = new Date(weekStart);
  d.setDate(weekStart.getDate() + index);
  return d;
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

/** e.g. "17 - 23 ก.ค. 2569" for the week containing `date`. */
export function formatWeekRange(date) {
  const [start, end] = getWeekRange(date);
  const shortMonths = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  // เดิมใช้ end.getFullYear() ตัวเดียวสำหรับทั้งช่วง — พอสัปดาห์คาบเกี่ยว
  // ข้ามปี (เช่น เริ่ม 28 ธ.ค. 2568 จบ 3 ม.ค. 2569) จะโชว์ปี พ.ศ. ของ "end"
  // (2569) ทับวันที่ของ "start" ที่จริงๆ อยู่คนละปี (2568) ไปด้วย ทำให้ขึ้น
  // "28 ธ.ค. - 3 ม.ค. 2569" ซึ่งวันที่ 28 ธ.ค. ผิดปีไปเงียบๆ — ต้องคำนวณปี
  // พ.ศ. ของแต่ละฝั่งแยกกันเผื่อกรณีนี้โดยเฉพาะ
  const startBeYear = start.getFullYear() + 543;
  const endBeYear = end.getFullYear() + 543;
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} - ${end.getDate()} ${shortMonths[end.getMonth()]} ${endBeYear}`;
  }
  if (start.getFullYear() !== end.getFullYear()) {
    // สัปดาห์คาบเกี่ยวข้ามปี — โชว่ปี พ.ศ. กำกับทั้งสองฝั่งให้ชัดเจน ไม่งั้น
    // จะดูเหมือนวันที่ผิดปีไปเงียบๆ (เช่น 28 ธ.ค. ที่จริงเป็นปีก่อนหน้า)
    return `${start.getDate()} ${shortMonths[start.getMonth()]} ${startBeYear} - ${end.getDate()} ${shortMonths[end.getMonth()]} ${endBeYear}`;
  }
  return `${start.getDate()} ${shortMonths[start.getMonth()]} - ${end.getDate()} ${shortMonths[end.getMonth()]} ${endBeYear}`;
}

/**
 * Week-of-year for the week containing `date` (Sunday-start weeks, to match
 * getWeekRange/buildMonthGrid elsewhere in this file): the week containing
 * Jan 1st is week 1, and each following Sunday-to-Saturday span increments
 * by one. This is a simple sequential count, not the ISO-8601 definition.
 */
export function weekOfYear(date) {
  const [weekStart] = getWeekRange(date);
  const jan1 = new Date(weekStart.getFullYear(), 0, 1);
  const jan1WeekStart = new Date(jan1);
  jan1WeekStart.setDate(jan1.getDate() - jan1.getDay());
  const diffDays = Math.round((weekStart - jan1WeekStart) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

/** Total number of Sunday-start weeks (using the same counting as weekOfYear) that touch `year`. */
export function totalWeeksInYear(year) {
  return weekOfYear(new Date(year, 11, 31));
}

/** e.g. "26 กรกฎาคม สัปดาห์ที่ 31/52 ของปี" — the first day of the week containing `date`. */
export function formatWeekLabel(date) {
  const [weekStart] = getWeekRange(date);
  const total = totalWeeksInYear(weekStart.getFullYear());
  return `${weekStart.getDate()} ${THAI_MONTHS[weekStart.getMonth()]} สัปดาห์ที่ ${weekOfYear(date)}/${total} ของปี`;
}

/**
 * e.g. "11 สิงหาคม สัปดาห์ที่ 33/53 ของปี" — same "สัปดาห์ที่ N/total" tail
 * as formatWeekLabel, but the date shown is `date` itself, not the Sunday
 * that starts its week. Used for the header title when a specific day is
 * focused/selected (see app.jsx's expandedDate) so the title reflects
 * whichever day the person is actually looking at right now, while the
 * week number still correctly describes which week that day falls in.
 */
export function formatFocusedDayLabel(date) {
  const total = totalWeeksInYear(date.getFullYear());
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} สัปดาห์ที่ ${weekOfYear(date)}/${total} ของปี`;
}
