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
import { auth } from "../config/firebase-auth.js";

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
export async function apiRequest(path, options = {}) {
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

export async function handleResponse(res, label) {
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

