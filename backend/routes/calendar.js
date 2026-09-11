const express = require("express");
const { getFreshAccessToken, CalendarReauthRequiredError } = require("../calendar-oauth.js");

const router = express.Router();
const EVENTS_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const MAX_REPEAT_OCCURRENCES = 28;
const RRULE_WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function dateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function occurrenceCountUntil(fields, startValue, limit) {
  const start = dateOnly(startValue);
  const untilDigits = String(fields.UNTIL || "").slice(0, 8);
  if (!start || !/^\d{8}$/.test(untilDigits)) return limit + 1;
  const until = new Date(Number(untilDigits.slice(0, 4)), Number(untilDigits.slice(4, 6)) - 1, Number(untilDigits.slice(6, 8)));
  const interval = Math.max(1, Number(fields.INTERVAL) || 1);
  const frequency = fields.FREQ;
  let count = 0;
  const cursor = new Date(start);

  if (frequency === "DAILY" || frequency === "MONTHLY") {
    while (cursor <= until && count <= limit) {
      count += 1;
      if (frequency === "DAILY") cursor.setDate(cursor.getDate() + interval);
      else cursor.setMonth(cursor.getMonth() + interval);
    }
    return count;
  }

  if (frequency !== "WEEKLY") return limit + 1;
  const weekdays = new Set((fields.BYDAY || RRULE_WEEKDAYS[start.getDay()]).split(","));
  const initialWeek = new Date(start);
  initialWeek.setDate(initialWeek.getDate() - initialWeek.getDay());
  while (cursor <= until && count <= limit) {
    const cursorWeek = new Date(cursor);
    cursorWeek.setDate(cursorWeek.getDate() - cursorWeek.getDay());
    const weeksApart = Math.round((cursorWeek - initialWeek) / (7 * 24 * 60 * 60 * 1000));
    if (weeksApart % interval === 0 && weekdays.has(RRULE_WEEKDAYS[cursor.getDay()])) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function assertRepeatOccurrenceLimit(event) {
  if (!Array.isArray(event?.recurrence)) return;
  const line = event.recurrence.find((rule) => typeof rule === "string" && rule.startsWith("RRULE:"));
  if (!line) return;
  const fields = Object.fromEntries(line.slice("RRULE:".length).split(";").map((part) => part.split("=")));
  const count = Number(fields.COUNT);
  if (Number.isFinite(count) && count > MAX_REPEAT_OCCURRENCES) {
    const error = new Error(`กิจกรรมทำซ้ำได้สูงสุด ${MAX_REPEAT_OCCURRENCES} ครั้งต่อชุด`);
    error.status = 400;
    throw error;
  }
  if (fields.UNTIL && occurrenceCountUntil(fields, event?.start?.dateTime || event?.start?.date, MAX_REPEAT_OCCURRENCES) > MAX_REPEAT_OCCURRENCES) {
    const error = new Error(`วันที่สิ้นสุดนี้ทำให้กิจกรรมเกิดเกิน ${MAX_REPEAT_OCCURRENCES} ครั้ง`);
    error.status = 400;
    throw error;
  }
}

function assertAllDayEventShape(event) {
  const isAllDay = Boolean(event?.start?.date || event?.end?.date);
  if (!isAllDay) return;
  const startDate = event?.start?.date;
  const endDate = event?.end?.date;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate || "") || !datePattern.test(endDate || "") || endDate <= startDate) {
    const error = new Error("กิจกรรมทั้งวันต้องมีวันเริ่มและวันสิ้นสุดที่มากกว่าวันเริ่มอย่างน้อย 1 วัน");
    error.status = 400;
    throw error;
  }
  if (event.start?.dateTime || event.end?.dateTime) {
    const error = new Error("กิจกรรมทั้งวันต้องใช้ start.date และ end.date เท่านั้น");
    error.status = 400;
    throw error;
  }
}

function clearTimedFieldsForAllDayPatch(event) {
  if (!event?.start?.date || !event?.end?.date) return event;
  // PATCH merges nested EventDateTime objects. When a timed event is being
  // converted to all-day, omitting dateTime can leave the old dateTime and
  // timeZone attached to the nested object, which Calendar rejects as an
  // invalid start. Null explicitly clears those timed-only fields.
  return {
    ...event,
    start: { ...event.start, dateTime: null, timeZone: null },
    end: { ...event.end, dateTime: null, timeZone: null }
  };
}

function clearAllDayFieldsForTimedPatch(event) {
  if (!event?.start?.dateTime || !event?.end?.dateTime) return event;
  // The inverse conversion needs the same treatment: remove the old
  // date-only value before Calendar validates the new RFC3339 dateTime.
  return {
    ...event,
    start: { ...event.start, date: null },
    end: { ...event.end, date: null }
  };
}

async function calendarRequest(userId, url, options = {}) {
  const accessToken = await getFreshAccessToken(userId);
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.body ? { "Content-Type": "application/json" } : {}) }
  });
  if (response.status === 401 || response.status === 403) {
    throw new CalendarReauthRequiredError();
  }
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Google Calendar API error (${response.status}): ${text || "ไม่มีรายละเอียด"}`);
    error.status = response.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

router.get("/events", async (req, res, next) => {
  try {
    const params = new URLSearchParams(req.query);
    res.json(await calendarRequest(req.userId, `${EVENTS_BASE}?${params}`));
  } catch (error) { next(error); }
});

router.get("/events/:eventId/instances", async (req, res, next) => {
  try {
    const params = new URLSearchParams(req.query);
    const id = encodeURIComponent(req.params.eventId);
    res.json(await calendarRequest(req.userId, `${EVENTS_BASE}/${id}/instances?${params}`));
  } catch (error) { next(error); }
});

router.get("/events/:eventId", async (req, res, next) => {
  try { res.json(await calendarRequest(req.userId, `${EVENTS_BASE}/${encodeURIComponent(req.params.eventId)}`)); } catch (error) { next(error); }
});

router.post("/events", async (req, res, next) => {
  try { assertAllDayEventShape(req.body); assertRepeatOccurrenceLimit(req.body); res.status(201).json(await calendarRequest(req.userId, EVENTS_BASE, { method: "POST", body: JSON.stringify(req.body) })); } catch (error) { next(error); }
});

router.patch("/events/:eventId", async (req, res, next) => {
  try {
    const event = clearAllDayFieldsForTimedPatch(clearTimedFieldsForAllDayPatch(req.body));
    assertAllDayEventShape(event);
    assertRepeatOccurrenceLimit(event);
    res.json(await calendarRequest(req.userId, `${EVENTS_BASE}/${encodeURIComponent(req.params.eventId)}`, { method: "PATCH", body: JSON.stringify(event) }));
  } catch (error) { next(error); }
});

router.delete("/events/:eventId", async (req, res, next) => {
  try { await calendarRequest(req.userId, `${EVENTS_BASE}/${encodeURIComponent(req.params.eventId)}`, { method: "DELETE" }); res.status(204).end(); } catch (error) { next(error); }
});

module.exports = router;
