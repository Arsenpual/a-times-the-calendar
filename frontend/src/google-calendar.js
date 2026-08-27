// Google OAuth + Calendar API helpers.
//
// Phase 2 (Firebase Authentication): sign-in uses the Firebase Auth SDK's
// POPUP flow (signInWithPopup/reauthenticateWithPopup + GoogleAuthProvider).

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  reauthenticateWithPopup,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from "firebase/auth";
import { firebaseApp } from "./firebase-config.js";

const EVENTS_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
// Narrowed from the full "https://www.googleapis.com/auth/calendar" scope
// (read/write access to every calendar the user owns, calendar list
// management, sharing settings, etc.) down to "calendar.events" — this app
// only ever creates/reads/updates/deletes events on the primary calendar
// (see fetchActivities/getActivity/createActivity/updateActivity/
// deleteActivity/fetchRecurringInstances below), it never touches calendar
// list or sharing settings. Requesting the narrower scope reduces what an
// attacker could do if this access token were ever exfiltrated (e.g. via
// an XSS bug), since the token is persisted in localStorage — see
// use-auth.js's module comment.
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export const auth = getAuth(firebaseApp);

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

/**
 * Provider สำหรับ Firebase Login เท่านั้น; สิทธิ์ Calendar ระยะยาวถูกขอ
 * แยกผ่าน backend OAuth flow หลังผู้ใช้กดเชื่อมต่อ Calendar โดยตรง.
 * prompt: "select_account" forces Google's account picker to show every
 * time, even if the browser only has one Google session — this matters
 * here because a first sign-in is exactly the moment someone with multiple
 * Google accounts (e.g. work + personal) needs to consciously pick the
 * right one; silently defaulting to "whichever Google account is most
 * recently active in this browser" risks connecting the wrong account's
 * calendar without the person noticing until later. Kept separate from
 * googleProviderForReauth below, which deliberately does NOT set this —
 * see that function's comment for why the two cases need different
 * behavior despite both requesting the same Calendar scope.
 */
function googleProviderForSignIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

/**
 * Builds a fresh GoogleAuthProvider with the Calendar scope requested, for
 * *re-authentication* specifically (reauthenticateWithGooglePopup below) —
 * minting a fresh Calendar access token for a Firebase user who is already
 * signed in, not picking who to sign in as. Deliberately omits
 * prompt: "select_account" (unlike googleProviderForSignIn above): this
 * call already knows exactly which account it needs — auth.currentUser —
 * so re-prompting to choose an account would ask a question that has only
 * one sensible answer, adding a click with no real decision behind it.
 *
 * login_hint tells Google's account chooser which account to pre-select —
 * without it, dropping prompt: "select_account" alone only makes Google
 * *likely* to reuse the browser's most recently active session, which
 * isn't guaranteed to be the same account Firebase is currently signed in
 * as (e.g. someone with work + personal Google accounts open in the same
 * browser profile). Passing auth.currentUser's own email removes that
 * guesswork entirely — Google pre-selects that exact account, so the
 * popup becomes a single confirmation click (or occasionally auto-closes
 * with no click at all, if Google decides the existing grant is still
 * fresh enough not to ask again).
 * @param {string} [email] auth.currentUser.email — omitted only if that's
 *   somehow unavailable (e.g. account created via a provider that doesn't
 *   expose email), in which case this falls back to today's behavior of
 *   letting Google guess from the browser's active session.
 */
function googleProviderForReauth(email) {
  const provider = new GoogleAuthProvider();
  provider.addScope(CALENDAR_SCOPE);
  if (email) {
    provider.setCustomParameters({ login_hint: email });
  }
  return provider;
}

/**
 * Opens the Firebase identity sign-in popup. Calendar permission is not
 * requested here, so signing in never grants long-lived calendar access by
 * accident.
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProviderForSignIn());
    const idToken = await result.user.getIdToken();
    return { idToken };
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("หน้าต่างเข้าสู่ระบบถูกปิดก่อนทำรายการเสร็จสิ้น");
    }
    if (error.code === "auth/popup-blocked") {
      throw new Error("เบราว์เซอร์บล็อกหน้าต่าง Popup กรุณาอนุญาตให้เปิด Popup สำหรับเว็บนี้");
    }
    throw error;
  }
}

/**
 * Re-opens the Google sign-in popup for the already-signed-in Firebase user,
 * purely to mint a fresh Calendar access token once the old one expires.
 * @returns {Promise<string>} calendarAccessToken
 */
export async function reauthenticateWithGooglePopup() {
  if (!auth.currentUser) {
    throw new Error("ยังไม่ได้เข้าสู่ระบบ — เรียก signInWithGoogle() ก่อน");
  }
  try {
    const result = await reauthenticateWithPopup(
      auth.currentUser,
      googleProviderForReauth(auth.currentUser.email)
    );
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error("ไม่ได้รับ Access Token จาก Google กรุณาลองใหม่อีกครั้ง");
    }

    return credential.accessToken;
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("หน้าต่างยืนยันตัวตนถูกปิดก่อนทำรายการเสร็จสิ้น");
    }
    if (error.code === "auth/popup-blocked") {
      throw new Error("เบราว์เซอร์บล็อกหน้าต่าง Popup กรุณาอนุญาตให้เปิด Popup");
    }
    throw error;
  }
}

/**
 * Subscribes to Firebase auth state changes.
 * @param {(user: import("firebase/auth").User | null) => void} callback
 */
export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Signs out of Firebase entirely. */
export async function signOut() {
  await firebaseSignOut(auth);
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
