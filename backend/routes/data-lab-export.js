const express = require("express");

const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const DATA_LAB_TIME_ZONE = "Asia/Bangkok";
const MAX_WINDOW_DAYS = 31;
const MAX_EVENTS = 500;

function parseDateBoundary(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function readWindow(query) {
  const start = parseDateBoundary(query.windowStart);
  const end = parseDateBoundary(query.windowEnd);
  if (!start || !end || end <= start) return null;
  if ((end - start) / (24 * 60 * 60 * 1000) > MAX_WINDOW_DAYS) return null;
  return {
    start: `${query.windowStart}T00:00`,
    end: `${query.windowEnd}T00:00`
  };
}

function normalizeActivityId(activityId) {
  return String(activityId || "").replace(/_\d{8}T\d{6}Z$/, "");
}

function mappingFromSnapshot(snapshot, valueForDocument) {
  const mapping = {};
  snapshot.docs.forEach((document) => {
    mapping[document.id] = valueForDocument(document.data() || {});
  });
  return mapping;
}

async function readPrimaryCalendarEvents(userId, window, dependencies) {
  const accessToken = await dependencies.getFreshAccessToken(userId);
  const params = new URLSearchParams({
    timeMin: `${window.start}:00+07:00`,
    timeMax: `${window.end}:00+07:00`,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(MAX_EVENTS),
    fields: "items(id,summary,start,end,status,transparency),nextPageToken"
  });
  const response = await dependencies.fetchImpl(`${EVENTS_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000)
  });
  const data = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) throw dependencies.createCalendarReauthRequiredError();
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Google Calendar API ตอบ ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return {
    events: (data?.items || []).filter((event) => event.status !== "cancelled" && event.transparency !== "transparent"),
    truncated: Boolean(data?.nextPageToken)
  };
}

async function buildActivityExport(userId, window, dependencies) {
  const [calendarResult, categorySnapshot, activityCategorySnapshot, tagSnapshot, lockSnapshot] = await Promise.all([
    readPrimaryCalendarEvents(userId, window, dependencies),
    dependencies.categoriesCol(userId).get(),
    dependencies.activityCategoriesCol(userId).get(),
    dependencies.activityTagsCol(userId).get(),
    dependencies.lockedActivitiesCol(userId).get()
  ]);
  const categoryNames = mappingFromSnapshot(categorySnapshot, (data) => typeof data.name === "string" ? data.name : "");
  const activityCategories = mappingFromSnapshot(activityCategorySnapshot, (data) => data.categoryId || "");
  const activityTags = mappingFromSnapshot(tagSnapshot, (data) => Array.isArray(data.tags) ? data.tags.filter((tag) => typeof tag === "string") : []);
  const locks = mappingFromSnapshot(lockSnapshot, () => true);
  const activities = calendarResult.events.map((event) => {
    const id = String(event.id || "");
    const metadataId = normalizeActivityId(id);
    return {
      id,
      title: typeof event.summary === "string" ? event.summary : "",
      start: event.start?.dateTime || event.start?.date || "",
      end: event.end?.dateTime || event.end?.date || "",
      allDay: Boolean(event.start?.date),
      category: categoryNames[activityCategories[metadataId]] || "",
      tags: activityTags[metadataId] || [],
      locked: Boolean(locks[metadataId]),
      source: "calendar"
    };
  });
  return {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    timeZone: DATA_LAB_TIME_ZONE,
    windowStart: window.start,
    windowEnd: window.end,
    activities,
    truncated: calendarResult.truncated
  };
}

function createDataLabExportRouter(overrides = {}) {
  const requiredDependencyNames = [
    "getFreshAccessToken",
    "fetchImpl",
    "createCalendarReauthRequiredError",
    "categoriesCol",
    "activityCategoriesCol",
    "activityTagsCol",
    "lockedActivitiesCol"
  ];
  let productionDependencies;
  function getProductionDependencies() {
    if (productionDependencies) return productionDependencies;
    const { getFreshAccessToken, CalendarReauthRequiredError } = require("../calendar-oauth.js");
    const { categoriesCol, activityCategoriesCol, activityTagsCol, lockedActivitiesCol } = require("../firestore-db.js");
    productionDependencies = {
      getFreshAccessToken,
      fetchImpl: fetch,
      createCalendarReauthRequiredError: () => new CalendarReauthRequiredError(),
      categoriesCol,
      activityCategoriesCol,
      activityTagsCol,
      lockedActivitiesCol
    };
    return productionDependencies;
  }
  const needsProductionDependencies = requiredDependencyNames.some((name) => !overrides[name]);
  const dependencies = { ...(needsProductionDependencies ? getProductionDependencies() : {}), ...overrides };
  const router = express.Router();

  router.get("/activity-export", async (req, res, next) => {
    const window = readWindow(req.query);
    if (!window) {
      return res.status(400).json({
        error: `windowStart และ windowEnd ต้องเป็น YYYY-MM-DD, windowEnd ต้องอยู่หลัง windowStart, และช่วงยาวได้สูงสุด ${MAX_WINDOW_DAYS} วัน`
      });
    }
    try {
      res.set("Content-Disposition", "attachment; filename=times-activity-export.json");
      res.json(await buildActivityExport(req.userId, window, dependencies));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createDataLabExportRouter, buildActivityExport, readWindow, normalizeActivityId };
