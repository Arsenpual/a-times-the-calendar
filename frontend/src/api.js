// Client for the times-the-calendar backend (categories, activity-category
// mapping, weekly summary). Separate from google-calendar.js, which talks to
// Google directly.
//
// Phase 2 (Firebase Authentication): every request now needs a Firebase ID
// token in the Authorization header — the backend's requireAuth middleware
// rejects anything without one (401). The token comes from the currently
// signed-in Firebase user via auth.currentUser.getIdToken(), which Firebase
// auto-refreshes under the hood — getIdToken() always resolves with a
// currently-valid token without us needing to track expiry ourselves
// (unlike the Google Calendar access token in google-calendar.js, which is
// NOT auto-refreshed by Firebase and needs its own reauth flow).
import { auth } from "./google-calendar.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/**
 * Fetches a fresh Firebase ID token for the signed-in user. Throws a clear
 * error if nobody is signed in rather than silently sending a request with
 * no Authorization header (which would just come back as an opaque 401
 * from the backend).
 */
async function getIdTokenOrThrow() {
  if (!auth.currentUser) {
    throw new Error("ยังไม่ได้เข้าสู่ระบบ — กรุณาเข้าสู่ระบบก่อนใช้งาน");
  }
  return auth.currentUser.getIdToken();
}

/**
 * Shared fetch wrapper for every backend call below — attaches the
 * Authorization: Bearer <idToken> header automatically so individual
 * functions don't each need to remember to do it. Mirrors the
 * calendarRequest() pattern in google-calendar.js.
 * @param {string} path e.g. "/api/categories"
 * @param {RequestInit} [options]
 */
async function apiRequest(path, options = {}) {
  const idToken = await getIdTokenOrThrow();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
}

async function handleResponse(res, label) {
  const text = await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      // Distinct from google-calendar.js's 401 (expired Google Calendar
      // access token) — this one means the Firebase ID token itself was
      // rejected, which normally shouldn't happen since getIdToken() keeps
      // it fresh automatically. Most likely cause in practice: the user's
      // Firebase session was revoked/signed out in another tab.
      throw new Error(`[${label}] เซสชันไม่ถูกต้องหรือหมดอายุ — กรุณาเข้าสู่ระบบใหม่`);
    }
    throw new Error(`[${label}] backend ตอบ error (${res.status}): ${text || "(ไม่มีเนื้อหา)"}`);
  }
  if (!text) {
    throw new Error(
      `[${label}] backend ตอบกลับมาว่างเปล่า (status ${res.status}) — เช็คว่า backend รันอยู่ไหมและไม่ได้รีสตาร์ทกลางคัน`
    );
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`[${label}] response ไม่ใช่ JSON ที่ถูกต้อง: ${text.slice(0, 200)}`);
  }
}

/** GET /api/categories — รายการหมวดหมู่ชีวิตทั้งหมด */
export async function fetchCategories() {
  const res = await apiRequest("/api/categories");
  return handleResponse(res, "GET /api/categories");
}

/**
 * POST /api/categories — สร้างหมวดหมู่ชีวิตใหม่ { name, color }
 * @param {string} name
 * @param {string} color hex สี 6 หลัก เช่น "#1557B0"
 */
export async function createCategory(name, color) {
  const res = await apiRequest("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name, color })
  });
  return handleResponse(res, "POST /api/categories");
}

/**
 * DELETE /api/categories/:id — ลบหมวดหมู่ชีวิต
 * mapping ของกิจกรรมที่เคยผูกกับหมวดหมู่นี้จะถูกลบตามไปด้วยฝั่ง backend
 * (ดู routes/categories.js) — กิจกรรมเหล่านั้นจะกลายเป็น "ไม่ระบุหมวดหมู่"
 */
export async function deleteCategory(id) {
  const res = await apiRequest(`/api/categories/${id}`, { method: "DELETE" });
  // 204 No Content — ไม่มี body ให้ parse เป็น JSON, handleResponse เดิม
  // คาดหวัง response ว่างแล้ว throw เพราะ !text ดังนั้นจัดการ 204 แยกตรงนี้
  if (res.status === 204) {
    if (!res.ok) {
      throw new Error(`[DELETE /api/categories/:id] backend ตอบ error (${res.status})`);
    }
    return null;
  }
  return handleResponse(res, "DELETE /api/categories/:id");
}

/** GET /api/activities/categories — mapping ทั้งหมด { [activityId]: categoryId } */
export async function fetchActivityCategoryMap() {
  const res = await apiRequest("/api/activities/categories");
  return handleResponse(res, "GET /api/activities/categories");
}

/** PUT /api/activities/:activityId/category — ผูก/เปลี่ยนหมวดหมู่ของกิจกรรม */
export async function assignActivityCategory(activityId, categoryId) {
  const res = await apiRequest(`/api/activities/${activityId}/category`, {
    method: "PUT",
    body: JSON.stringify({ categoryId })
  });
  return handleResponse(res, "PUT /api/activities/:id/category");
}

/**
 * POST /api/summary/week — คำนวณสรุปสัปดาห์จากกิจกรรมที่ frontend ดึงมาจาก
 * Google Calendar อยู่แล้ว
 * @param {Array} activities รายการกิจกรรมแบบ { id, summary, start, end } (ISO strings)
 */
export async function fetchWeeklySummary(activities) {
  const res = await apiRequest("/api/summary/week", {
    method: "POST",
    body: JSON.stringify({ activities })
  });
  return handleResponse(res, "POST /api/summary/week");
}

/** GET /api/activities/tags — mapping ทั้งหมด { [activityId]: string[] } */
export async function fetchActivityTagMap() {
  const res = await apiRequest("/api/activities/tags");
  return handleResponse(res, "GET /api/activities/tags");
}

/**
 * PUT /api/activities/:activityId/tags — แทนที่ tag ทั้งชุดของกิจกรรมนี้
 * @param {string} activityId
 * @param {string[]} tags ส่ง [] เพื่อล้าง tag ทั้งหมดออก
 */
export async function setActivityTags(activityId, tags) {
  const res = await apiRequest(`/api/activities/${activityId}/tags`, {
    method: "PUT",
    body: JSON.stringify({ tags })
  });
  return handleResponse(res, "PUT /api/activities/:id/tags");
}

/** GET /api/activities/locks — mapping ทั้งหมด { [activityId]: true } ของกิจกรรมที่ถูก lock ไว้ */
export async function fetchLockedActivities() {
  const res = await apiRequest("/api/activities/locks");
  return handleResponse(res, "GET /api/activities/locks");
}

/**
 * PUT /api/activities/:activityId/lock — ตั้ง/ปลด lock ของกิจกรรมหนึ่งอัน
 * กิจกรรมที่ถูก lock จะแก้ไข/ลาก/ลบไม่ได้จนกว่าจะปลดล็อกอีกครั้ง
 */
export async function setActivityLocked(activityId, locked) {
  const res = await apiRequest(`/api/activities/${activityId}/lock`, {
    method: "PUT",
    body: JSON.stringify({ locked })
  });
  return handleResponse(res, "PUT /api/activities/:id/lock");
}

/**
 * GET /api/reminders — mapping ทั้งหมด { [reminderId]: {...scheduleFields} }
 * เบื้องต้น sync แค่ฟิลด์วัน/เวลาของ reminder (ดู routes/reminders.js
 * ฝั่ง backend สำหรับรายการฟิลด์ทั้งหมด) — ไม่รวม runtime state เช่น
 * startedAt/accumulatedMs ของ countdown/stopwatch ที่กำลังทำงานอยู่
 */
export async function fetchReminders() {
  const res = await apiRequest("/api/reminders");
  return handleResponse(res, "GET /api/reminders");
}

/**
 * PUT /api/reminders/:reminderId — สร้างหรืออัปเดต schedule fields ของ
 * reminder หนึ่งตัว (upsert เดียว — reminder id เป็น client-generated
 * อยู่แล้วเหมือน activity id ของ Google Calendar)
 * @param {string} reminderId
 * @param {object} fields ฟิลด์วัน/เวลาที่จะบันทึก (type, title, enabled,
 *   amount, unit, windowStart, windowEnd, days, time, atMs, afterAmount,
 *   afterUnit, durationMs, lineColor, eventName, steps) — ฟิลด์ runtime
 *   อื่นที่ไม่อยู่ใน allow-list นี้จะถูกตัดทิ้งฝั่ง backend เงียบๆ ถ้าส่งมา
 */
export async function saveReminder(reminderId, fields) {
  const res = await apiRequest(`/api/reminders/${reminderId}`, {
    method: "PUT",
    body: JSON.stringify(fields)
  });
  return handleResponse(res, "PUT /api/reminders/:id");
}

/** DELETE /api/reminders/:reminderId */
export async function deleteReminderRemote(reminderId) {
  const res = await apiRequest(`/api/reminders/${reminderId}`, { method: "DELETE" });
  if (res.status === 204) {
    if (!res.ok) {
      throw new Error(`[DELETE /api/reminders/:id] backend ตอบ error (${res.status})`);
    }
    return null;
  }
  return handleResponse(res, "DELETE /api/reminders/:id");
}

/**
 * Groups/Projects ของ reminder mode (migration plan v2 เฟส 3) — CRUD
 * รูปแบบเดียวกับ fetchCategories/createCategory/deleteCategory ทุก
 * ประการ (one-to-one ต่อ reminder ผ่าน groupId field, ดู
 * backend/routes/reminder-groups.js และ firestore-db.js's
 * reminderGroupsCol comment)
 */

/** GET /api/reminder-groups — รายการกลุ่มทั้งหมด */
export async function fetchReminderGroups() {
  const res = await apiRequest("/api/reminder-groups");
  return handleResponse(res, "GET /api/reminder-groups");
}

/**
 * POST /api/reminder-groups — สร้างกลุ่มใหม่ { name, color }
 * @param {string} name
 * @param {string} color hex สี 6 หลัก เช่น "#1557B0"
 */
export async function createReminderGroup(name, color) {
  const res = await apiRequest("/api/reminder-groups", {
    method: "POST",
    body: JSON.stringify({ name, color })
  });
  return handleResponse(res, "POST /api/reminder-groups");
}

/**
 * DELETE /api/reminder-groups/:id — ลบกลุ่ม
 * reminder ที่เคยผูกกับกลุ่มนี้จะถูกเคลียร์ groupId เป็น null ฝั่ง backend
 * (ไม่ใช่ถูกลบทิ้ง — ดู routes/reminder-groups.js's DELETE handler)
 */
export async function deleteReminderGroup(id) {
  const res = await apiRequest(`/api/reminder-groups/${id}`, { method: "DELETE" });
  if (res.status === 204) {
    if (!res.ok) {
      throw new Error(`[DELETE /api/reminder-groups/:id] backend ตอบ error (${res.status})`);
    }
    return null;
  }
  return handleResponse(res, "DELETE /api/reminder-groups/:id");
}

/**
 * FCM device tokens (migration plan v2 เฟส 5) — ลงทะเบียน/เลิกลงทะเบียน
 * token ของอุปกรณ์นี้กับ backend เพื่อให้ Cloud Function (ยัง scaffold
 * อยู่ ดู /functions) รู้ว่าจะส่ง push แจ้งเตือนไปที่ไหนบ้าง
 */

/**
 * POST /api/fcm-tokens — ลงทะเบียน token ของอุปกรณ์นี้ (upsert — เรียกซ้ำ
 * ด้วย token เดิมได้ปลอดภัย ไม่สร้างซ้ำ ดู backend/routes/fcm-tokens.js)
 * @param {string} token จาก Firebase Messaging SDK's getToken()
 */
export async function registerFcmToken(token) {
  const res = await apiRequest("/api/fcm-tokens", {
    method: "POST",
    body: JSON.stringify({ token, userAgent: navigator.userAgent })
  });
  return handleResponse(res, "POST /api/fcm-tokens");
}

/** DELETE /api/fcm-tokens/:token — เลิกลงทะเบียน token นี้ (ตอนผู้ใช้ปิดการแจ้งเตือนเอง) */
export async function unregisterFcmToken(token) {
  const res = await apiRequest(`/api/fcm-tokens/${encodeURIComponent(token)}`, { method: "DELETE" });
  if (res.status === 204) {
    if (!res.ok) {
      throw new Error(`[DELETE /api/fcm-tokens/:token] backend ตอบ error (${res.status})`);
    }
    return null;
  }
  return handleResponse(res, "DELETE /api/fcm-tokens/:token");
}
