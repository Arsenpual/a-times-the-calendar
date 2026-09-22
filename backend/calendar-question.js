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
  if (/พรุ่งนี้|tomorrow/.test(normalized)) start = addDays(start, 1);
  let end = start;
  let label = toDateKey(start);

  if (/สัปดาห์นี้|สัปดาห์หน้า|this week|next week/.test(normalized)) {
    start = startOfSundayWeek(start);
    if (/สัปดาห์หน้า|next week/.test(normalized)) start = addDays(start, 7);
    end = addDays(start, 6);
    label = `${toDateKey(start)} ถึง ${toDateKey(end)}`;
  } else if (/เดือนนี้|เดือนหน้า|this month|next month/.test(normalized)) {
    start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + (/เดือนหน้า|next month/.test(normalized) ? 1 : 0), 1));
    end = endOfMonth(start);
    label = `${toDateKey(start)} ถึง ${toDateKey(end)}`;
  } else if (!explicit && !/วันนี้|พรุ่งนี้|today|tomorrow/.test(normalized)) {
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
  return /calendar|ตาราง|ปฏิทิน|ว่าง|free|available|busy|ยุ่ง|มีอะไร|นัด|ชน|ทับ|กำหนดการ|schedule/.test(value)
    && (/[?？]/.test(value) || /ไหม|อะไร|กี่|หา|สรุป|ดู|บอก|tell|what|when|how/.test(value));
}

module.exports = { calendarRangeForQuestion, readCalendarQuestionContext, isCalendarQuestion };
