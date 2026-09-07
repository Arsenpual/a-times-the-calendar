import { auth } from "../../../shared/config/firebase-auth.js";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/**
 * True if `error` came from calendarRequest()'s 401 branch — i.e. the
 * Google Calendar access token itself is dead, not just some other API
 * error. Callers that hold setCalendarAccessToken should call this in
 * their catch block and clear the token when it's true, so app.jsx's
 * renew banner (gated on `!calendarAccessToken`) reliably appears
 * whenever the error message tells the person their access expired —
 * see calendarRequest's comment for why this exists as a `code` check
 * instead of matching the Thai error text directly.
 * @param {unknown} error
 */
export function isCalendarAuthExpiredError(error) {
  return error?.code === "CALENDAR_TOKEN_EXPIRED" || error?.code === "CALENDAR_REAUTH_REQUIRED";
}

async function backendCalendarRequest(path, options = {}) {
  if (!auth.currentUser) throw new Error("ยังไม่ได้เข้าสู่ระบบ — กรุณาเข้าสู่ระบบก่อนใช้งาน");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    }
  });
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 428) {
      const error = new Error("สิทธิ์ Google Calendar หมดอายุหรือยังไม่ได้เชื่อมต่อ — กรุณาเชื่อมต่อใหม่");
      error.code = "CALENDAR_REAUTH_REQUIRED";
      throw error;
    }
    throw new Error(`[Calendar backend] error (${response.status}): ${text || "ไม่มีรายละเอียด"}`);
  }
  return text ? JSON.parse(text) : null;
}

export async function getCalendarConnectionStatus() {
  return backendCalendarRequest("/api/calendar-auth/status");
}

export async function beginCalendarAuthorization() {
  const { authorizationUrl } = await backendCalendarRequest("/api/calendar-auth/authorization-url", { method: "POST" });
  window.location.assign(authorizationUrl);
}

/** Shared fetch wrapper for Calendar API calls that return/expect JSON. */
async function calendarRequest(accessToken, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Tagged with a machine-readable `code` (not just Thai text) so
      // every caller that needs to react to "the Calendar token itself is
      // dead" — e.g. to clear calendarAccessToken and surface the renew
      // banner in app.jsx — can check err.code === CALENDAR_TOKEN_EXPIRED
      // instead of substring-matching the Thai error message. Substring
      // matching on translated/localized text is fragile (breaks silently
      // if the message wording ever changes) and was already the cause of
      // one inconsistency: only handleSaveTimes in use-activity-mutations.js
      // checked for this and cleared the token — every other caller
      // (loadActivities, tag search, individual activity writes) just
      // displayed the error text without ever clearing calendarAccessToken,
      // so the "ยืนยันตัวตน" renew button never appeared even though the
      // error banner said the token was expired. See isCalendarAuthError
      // below and every place it's now used.
      const err = new Error("สิทธิ์เข้าถึง Google Calendar หมดอายุ — กรุณายืนยันตัวตนอีกครั้ง");
      err.code = "CALENDAR_TOKEN_EXPIRED";
      throw err;
    }
    if (res.status === 403) {
      throw new Error("ไม่มีสิทธิ์แก้ไขปฏิทิน — ลองยืนยันตัวตนใหม่เพื่อขอสิทธิ์เขียนปฏิทิน");
    }
    if (res.status === 404) {
      throw new Error("ไม่พบกิจกรรมนี้ — อาจถูกลบไปแล้วจาก Google Calendar โดยตรง");
    }
    if (res.status === 410) {
      throw new Error("กิจกรรมนี้ถูกลบไปแล้ว");
    }
    const body = await res.text();
    throw new Error(`[Google Calendar API] error (${res.status}): ${body || "(ไม่มีเนื้อหา)"}`);
  }

  if (res.status === 204) return null;

  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`[Google Calendar API] response ไม่ใช่ JSON: ${text.slice(0, 200)}`);
  }
}

/**
 * Fetches activities from primary calendar within a date range.
 */
export async function fetchActivities(accessToken, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250"
  });

  const data = await backendCalendarRequest(`/api/calendar/events?${params}`);
  return data?.items || [];
}

/**
 * Fetches a single activity by id.
 */
export async function getActivity(accessToken, activityId) {
  return backendCalendarRequest(`/api/calendar/events/${encodeURIComponent(activityId)}`);
}

/**
 * Creates a new activity.
 */
export async function createActivity(accessToken, activityBody) {
  return backendCalendarRequest("/api/calendar/events", {
    method: "POST",
    body: JSON.stringify(activityBody)
  });
}

/**
 * Updates (patches) an existing activity.
 */
export async function updateActivity(accessToken, activityId, activityBody) {
  return backendCalendarRequest(`/api/calendar/events/${encodeURIComponent(activityId)}`, {
    method: "PATCH",
    body: JSON.stringify(activityBody)
  });
}

/**
 * Deletes an activity from primary calendar.
 */
export async function deleteActivity(accessToken, activityId) {
  await backendCalendarRequest(`/api/calendar/events/${encodeURIComponent(activityId)}`, {
    method: "DELETE"
  });
}

/**
 * Fetches all instances of a recurring event series.
 */
export async function fetchRecurringInstances(accessToken, recurringEventId, maxResults = 250) {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    orderBy: "startTime",
    singleEvents: "true"
  });
  const data = await backendCalendarRequest(`/api/calendar/events/${encodeURIComponent(recurringEventId)}/instances?${params}`);
  return data?.items || [];
}
