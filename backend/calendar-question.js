const CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const MAX_CALENDARS = 20;
const MAX_EVENTS_PER_CALENDAR = 100;

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfSundayWeek(date) {
  return addDays(date, -date.getUTCDay());
}

function endOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function calendarRangeForQuestion(text, referenceDate) {
  const normalized = String(text || "").toLowerCase();
  const base = parseDate(referenceDate) || new Date();
  const explicit = normalized.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  let start = explicit ? parseDate(explicit) : new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  if (/เมื่อวาน|yesterday/.test(normalized)) start = addDays(start, -1);
  if (/พรุ่งนี้|tomorrow/.test(normalized)) start = addDays(start, 1);
  let end = start;
  let label = toDateKey(start);

  if (/สัปดาห์นี้|สัปดาห์หน้า|สัปดาห์ก่อน|this week|next week|last week/.test(normalized)) {
    start = startOfSundayWeek(start);
    if (/สัปดาห์หน้า|next week/.test(normalized)) start = addDays(start, 7);
    if (/สัปดาห์ก่อน|last week/.test(normalized)) start = addDays(start, -7);
    end = addDays(start, 6);
    label = `${toDateKey(start)} ถึง ${toDateKey(end)}`;
  } else if (/เดือนนี้|เดือนหน้า|เดือนก่อน|this month|next month|last month/.test(normalized)) {
    const monthOffset = /เดือนหน้า|next month/.test(normalized) ? 1 : /เดือนก่อน|last month/.test(normalized) ? -1 : 0;
    start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, 1));
    end = endOfMonth(start);
    label = `${toDateKey(start)} ถึง ${toDateKey(end)}`;
  } else if (!explicit && !/วันนี้|พรุ่งนี้|เมื่อวาน|today|tomorrow|yesterday/.test(normalized)) {
    // A question without a date receives a useful but bounded upcoming-week
    // context instead of silently exposing an unlimited calendar history.
    end = addDays(start, 6);
    label = `${toDateKey(start)} ถึง ${toDateKey(end)}`;
  }
  return { start, end, label };
}

async function googleJson(url, accessToken) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000) });
  const data = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) {
    const { CalendarReauthRequiredError } = require("./calendar-oauth.js");
    throw new CalendarReauthRequiredError();
  }
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Google Calendar API ตอบ ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data || {};
}

function toBangkokBoundary(date, end = false) {
  return `${toDateKey(date)}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`;
}

/**
 * Reads only the minimum event fields needed to answer one question. Tokens
 * stay on the backend; descriptions, attendees, conference links and other
 * sensitive fields are deliberately never returned to Gemini.
 */
async function readCalendarQuestionContext(userId, { text, referenceDate }) {
  const range = calendarRangeForQuestion(text, referenceDate);
  const { getFreshAccessToken } = require("./calendar-oauth.js");
  const accessToken = await getFreshAccessToken(userId);
  const calendars = await googleJson(`${CALENDAR_LIST_URL}?${new URLSearchParams({ maxResults: String(MAX_CALENDARS), minAccessRole: "reader", fields: "items(id,summary,primary,hidden),nextPageToken" })}`, accessToken);
  const visibleCalendars = (calendars.items || []).filter((calendar) => !calendar.hidden).slice(0, MAX_CALENDARS);
  const timeMin = toBangkokBoundary(range.start);
  const timeMax = toBangkokBoundary(range.end, true);

  const eventGroups = await Promise.all(visibleCalendars.map(async (calendar) => {
    const params = new URLSearchParams({
      timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: String(MAX_EVENTS_PER_CALENDAR),
      fields: "items(summary,start,end,status,transparency),nextPageToken"
    });
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params}`;
    const response = await googleJson(base, accessToken);
    return {
      truncated: Boolean(response.nextPageToken),
      events: (response.items || [])
      .filter((event) => event.status !== "cancelled" && event.transparency !== "transparent")
      .map((event) => ({
        calendar: calendar.summary || (calendar.primary ? "Primary" : "Calendar"),
        title: event.summary || "(ไม่มีชื่อ)",
        start: event.start?.dateTime || event.start?.date || "",
        end: event.end?.dateTime || event.end?.date || "",
        allDay: Boolean(event.start?.date)
      }))
    };
  }));
  const events = eventGroups.flatMap((group) => group.events).sort((left, right) => String(left.start).localeCompare(String(right.start)));
  return {
    range: { start: toDateKey(range.start), end: toDateKey(range.end), label: range.label },
    events,
    calendarCount: visibleCalendars.length,
    truncatedCalendars: Boolean(calendars.nextPageToken),
    truncatedEvents: eventGroups.some((group) => group.truncated)
  };
}

function isCalendarQuestion(text) {
  const value = String(text || "").toLowerCase();
  const calendarTopic = /calendar|ตาราง|ปฏิทิน|ว่าง|free|available|busy|ยุ่ง|มีอะไร|นัด|ชน|ทับ|กำหนดการ|schedule|ประชุม|event|กิจกรรม|ย้ายงาน|เวลาพัก|วางแผน/.test(value);
  const questionIntent = /[?？]|ไหม|อะไร|กี่|หา|สรุป|ดู|บอก|เช็ค|ตรวจ|ค้น|ช่วย|ควร|tell|what|when|where|how|show|find|list|check/.test(value);
  return calendarTopic && questionIntent;
}

// These questions do not need interpretation.  Keeping them deterministic
// means the app can answer from the same bounded Calendar data without
// spending a Gemini request or sending event titles to an AI model.
function isDeterministicCalendarQuestion(text) {
  const value = String(text || "").toLowerCase();
  return /วันนี้มีอะไร|วันนี้มีนัด|พรุ่งนี้มีอะไร|พรุ่งนี้มีนัด|สัปดาห์นี้มีนัด|ว่างช่วงไหน|ตารางชนกัน|นัด.*ชน|เวลาชน/.test(value);
}

function formatEventTime(event, timeZone = "Asia/Bangkok") {
  if (event.allDay) return "ทั้งวัน";
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "ไม่ระบุเวลา";
  const format = new Intl.DateTimeFormat("th-TH", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${format.format(start)}–${format.format(end)}`;
}

function eventInterval(event) {
  if (event.allDay) return null;
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

function formatEvents(events, timeZone) {
  if (!events.length) return "ไม่มีรายการ";
  return events.slice(0, 12).map((event) => `• ${formatEventTime(event, timeZone)} ${event.title}`).join("\n")
    + (events.length > 12 ? `\nและอีก ${events.length - 12} รายการ` : "");
}

function findConflicts(events) {
  const intervals = events.map((event) => ({ event, interval: eventInterval(event) })).filter((item) => item.interval);
  const conflicts = [];
  for (let left = 0; left < intervals.length; left += 1) {
    for (let right = left + 1; right < intervals.length; right += 1) {
      if (intervals[left].interval.start < intervals[right].interval.end && intervals[right].interval.start < intervals[left].interval.end) {
        conflicts.push([intervals[left].event, intervals[right].event]);
      }
    }
  }
  return conflicts;
}

function buildFreeTimeReply(context, timeZone) {
  // A simple, explainable 08:00–22:00 working-window calculation.  It avoids
  // pretending to know the user's sleep or work preferences.
  const day = context.range.start;
  const dayStart = new Date(`${day}T08:00:00+07:00`).getTime();
  const dayEnd = new Date(`${day}T22:00:00+07:00`).getTime();
  const busy = context.events.map(eventInterval).filter(Boolean)
    .map((interval) => ({ start: Math.max(interval.start, dayStart), end: Math.min(interval.end, dayEnd) }))
    .filter((interval) => interval.end > interval.start).sort((a, b) => a.start - b.start);
  const gaps = [];
  let cursor = dayStart;
  for (const interval of busy) {
    if (interval.start > cursor) gaps.push({ start: cursor, end: interval.start });
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < dayEnd) gaps.push({ start: cursor, end: dayEnd });
  const format = new Intl.DateTimeFormat("th-TH", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  const visible = gaps.filter((gap) => gap.end - gap.start >= 30 * 60 * 1000).slice(0, 6);
  return visible.length
    ? `ช่วงว่างของ ${day} (ประเมินในช่วง 08:00–22:00):\n${visible.map((gap) => `• ${format.format(gap.start)}–${format.format(gap.end)}`).join("\n")}`
    : `ไม่พบช่วงว่างอย่างน้อย 30 นาทีในช่วง 08:00–22:00 ของ ${day}`;
}

function answerDeterministicCalendarQuestion(text, context, timeZone = "Asia/Bangkok") {
  if (!isDeterministicCalendarQuestion(text)) return null;
  const value = String(text || "").toLowerCase();
  if (/ว่างช่วงไหน/.test(value)) return buildFreeTimeReply(context, timeZone);
  if (/ชนกัน|เวลาชน|นัด.*ชน/.test(value)) {
    const conflicts = findConflicts(context.events);
    return conflicts.length
      ? `พบเวลาชนกัน ${conflicts.length} คู่ในช่วง ${context.range.label}:\n${conflicts.slice(0, 8).map(([left, right]) => `• ${left.title} ↔ ${right.title}`).join("\n")}`
      : `ไม่พบกิจกรรมที่เวลาชนกันในช่วง ${context.range.label}`;
  }
  return `ตาราง ${context.range.label}:\n${formatEvents(context.events, timeZone)}`;
}

module.exports = { calendarRangeForQuestion, readCalendarQuestionContext, isCalendarQuestion, isDeterministicCalendarQuestion, answerDeterministicCalendarQuestion };
