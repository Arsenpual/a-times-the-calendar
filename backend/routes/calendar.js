const express = require("express");
const { getFreshAccessToken, CalendarReauthRequiredError } = require("../calendar-oauth.js");

const router = express.Router();
const EVENTS_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

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
  try { res.status(201).json(await calendarRequest(req.userId, EVENTS_BASE, { method: "POST", body: JSON.stringify(req.body) })); } catch (error) { next(error); }
});

router.patch("/events/:eventId", async (req, res, next) => {
  try { res.json(await calendarRequest(req.userId, `${EVENTS_BASE}/${encodeURIComponent(req.params.eventId)}`, { method: "PATCH", body: JSON.stringify(req.body) })); } catch (error) { next(error); }
});

router.delete("/events/:eventId", async (req, res, next) => {
  try { await calendarRequest(req.userId, `${EVENTS_BASE}/${encodeURIComponent(req.params.eventId)}`, { method: "DELETE" }); res.status(204).end(); } catch (error) { next(error); }
});

module.exports = router;
