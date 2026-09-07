// Small helper for converting between the repeat UI's plain state and the
// RRULE (iCal, RFC 5545) string Google Calendar's API expects in an event's
// `recurrence` array. We only build/parse the small subset of RRULE our UI
// exposes (FREQ, INTERVAL, BYDAY, COUNT, UNTIL) — Google is the source of
// truth for actually expanding the series, we never store occurrences
// ourselves.

const RRULE_WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const THAI_WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const THAI_WEEKDAY_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/**
 * @typedef {object} RepeatState
 * @property {"none"|"custom"} mode
 * @property {"DAILY"|"WEEKLY"|"MONTHLY"} freq
 * @property {number} interval e.g. every 2 weeks
 * @property {string[]} byDay RRULE weekday codes, e.g. ["MO","WE"] (WEEKLY only)
 * @property {"never"|"count"|"until"} end
 * @property {number} count used when end === "count"
 * @property {string} until "YYYY-MM-DD" used when end === "until"
 */

/** @returns {RepeatState} */
export function defaultRepeatState(startDate) {
  return {
    mode: "none",
    freq: "WEEKLY",
    interval: 1,
    byDay: [RRULE_WEEKDAYS[startDate.getDay()]],
    // ปิดฟังก์ชัน "ไม่มีวันสิ้นสุด" ไว้ก่อน (ซ่อนใน ActivityModal) — default
    // จึงต้องเป็น "count" แทน "never" ไม่งั้นตอนเปิดฟอร์มใหม่จะไม่มี radio
    // ตัวไหนถูกเลือกเลย เพราะตัวเลือกที่ state ชี้ไปหา (never) ถูกซ่อนไปแล้ว
    end: "count",
    count: 12,
    until: ""
  };
}

/** Builds a single RRULE string (no "RRULE:" prefix needed — caller adds it) from a RepeatState. */
export function buildRRule(state) {
  if (!state || state.mode !== "custom") return null;

  const parts = [`FREQ=${state.freq}`];
  if (state.interval && state.interval > 1) {
    parts.push(`INTERVAL=${state.interval}`);
  }
  if (state.freq === "WEEKLY" && state.byDay.length > 0) {
    parts.push(`BYDAY=${state.byDay.join(",")}`);
  }
  if (state.end === "count" && state.count > 0) {
    parts.push(`COUNT=${state.count}`);
  } else if (state.end === "until" && state.until) {
    // RRULE UNTIL wants a bare date or UTC datetime; a bare YYYYMMDD is
    // valid and avoids timezone ambiguity for an "on this calendar day" cutoff.
    const compact = state.until.replaceAll("-", "");
    parts.push(`UNTIL=${compact}`);
  }
  return `RRULE:${parts.join(";")}`;
}

/**
 * Parses the first RRULE found in a Google Calendar event's `recurrence`
 * array back into a RepeatState, for prefilling the form when editing.
 * Returns a "none" state if there's no recurrence, and null if the rule is
 * too complex for our simple UI to represent (caller should then treat the
 * event as read-only for repeat purposes — see isRuleEditable below).
 */
export function parseRRule(recurrence, startDate) {
  const base = defaultRepeatState(startDate);
  if (!Array.isArray(recurrence) || recurrence.length === 0) return base;

  const ruleLine = recurrence.find((line) => line.startsWith("RRULE:"));
  if (!ruleLine) return base;

  const fields = Object.fromEntries(
    ruleLine
      .slice("RRULE:".length)
      .split(";")
      .map((pair) => pair.split("="))
  );

  const state = { ...base, mode: "custom" };
  if (fields.FREQ) state.freq = fields.FREQ;
  if (fields.INTERVAL) state.interval = parseInt(fields.INTERVAL, 10) || 1;
  if (fields.BYDAY) state.byDay = fields.BYDAY.split(",");
  if (fields.COUNT) {
    state.end = "count";
    state.count = parseInt(fields.COUNT, 10) || 1;
  } else if (fields.UNTIL) {
    state.end = "until";
    // UNTIL may be "20261201" or "20261201T000000Z" — take the date part.
    const digits = fields.UNTIL.slice(0, 8);
    state.until = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return state;
}

/** True if we can safely round-trip this event's recurrence through our simple UI. */
export function isRuleEditable(recurrence) {
  if (!Array.isArray(recurrence) || recurrence.length === 0) return true;
  if (recurrence.length > 1) return false; // e.g. RRULE + EXDATE exceptions
  const line = recurrence[0];
  if (!line.startsWith("RRULE:")) return false;
  // Anything beyond our supported keys (BYMONTHDAY, BYSETPOS, etc.) — bail out.
  const supportedKeys = ["FREQ", "INTERVAL", "BYDAY", "COUNT", "UNTIL"];
  const keys = line
    .slice("RRULE:".length)
    .split(";")
    .map((pair) => pair.split("=")[0]);
  return keys.every((k) => supportedKeys.includes(k));
}

const FREQ_LABEL_TH = { DAILY: "วัน", WEEKLY: "สัปดาห์", MONTHLY: "เดือน" };

function formatThaiDate(dateStr) {
  const THAI_MONTHS_SHORT = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
}

/**
 * Human-readable Thai summary of a RepeatState + start date, for the
 * "🔁 เกิดซ้ำ..." preview line under the custom-repeat panel.
 */
export function describeRepeat(state, startDate) {
  if (!state || state.mode !== "custom") return "";

  const startLabel = formatThaiDate(toIsoDate(startDate));
  let whenPart;
  if (state.freq === "WEEKLY" && state.byDay.length > 0) {
    const dayNames = state.byDay
      .map((code) => THAI_WEEKDAY_FULL[RRULE_WEEKDAYS.indexOf(code)])
      .filter(Boolean);
    const dayList = dayNames.length > 1
      ? `${dayNames.slice(0, -1).join(", ")}และ${dayNames[dayNames.length - 1]}`
      : dayNames[0] || "";
    whenPart = state.interval > 1
      ? `ทุก ${state.interval} สัปดาห์ ในวัน${dayList}`
      : `ทุกวัน${dayList}`;
  } else {
    const unit = FREQ_LABEL_TH[state.freq] || state.freq;
    whenPart = state.interval > 1 ? `ทุก ${state.interval} ${unit}` : `ทุก${unit}`;
  }

  let endPart = "";
  if (state.end === "count" && state.count > 0) {
    endPart = ` — รวม ${state.count} ครั้ง`;
  } else if (state.end === "until" && state.until) {
    endPart = ` — สิ้นสุดในวันที่ ${formatThaiDate(state.until)}`;
  }

  return `🔁 เกิดซ้ำ${whenPart} เริ่ม ${startLabel}${endPart}`;
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export { RRULE_WEEKDAYS };
