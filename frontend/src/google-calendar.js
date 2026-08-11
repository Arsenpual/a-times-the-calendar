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
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export const auth = getAuth(firebaseApp);

/**
 * Builds a fresh GoogleAuthProvider with the Calendar scope requested, for
 * the *first* sign-in specifically (signInWithGoogle below).
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
  provider.addScope(CALENDAR_SCOPE);
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
 * Opens the Google sign-in popup, requesting both Firebase identity and the
 * Calendar scope in one consent screen.
 * @returns {Promise<{ idToken: string, calendarAccessToken: string }>}
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProviderForSignIn());
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const idToken = await result.user.getIdToken();
    
    if (!credential?.accessToken) {
      throw new Error("ไม่ได้รับ Access Token จาก Google กรุณาลองใหม่อีกครั้ง");
    }

    return { idToken, calendarAccessToken: credential.accessToken };
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
      throw new Error("สิทธิ์เข้าถึง Google Calendar หมดอายุ — กรุณายืนยันตัวตนอีกครั้ง");
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

  const data = await calendarRequest(accessToken, `${EVENTS_BASE}?${params}`);
  return data?.items || [];
}

/**
 * Fetches a single activity by id.
 */
export async function getActivity(accessToken, activityId) {
  return calendarRequest(accessToken, `${EVENTS_BASE}/${encodeURIComponent(activityId)}`);
}

/**
 * Creates a new activity.
 */
export async function createActivity(accessToken, activityBody) {
  return calendarRequest(accessToken, EVENTS_BASE, {
    method: "POST",
    body: JSON.stringify(activityBody)
  });
}

/**
 * Updates (patches) an existing activity.
 */
export async function updateActivity(accessToken, activityId, activityBody) {
  return calendarRequest(accessToken, `${EVENTS_BASE}/${encodeURIComponent(activityId)}`, {
    method: "PATCH",
    body: JSON.stringify(activityBody)
  });
}

/**
 * Deletes an activity from primary calendar.
 */
export async function deleteActivity(accessToken, activityId) {
  await calendarRequest(accessToken, `${EVENTS_BASE}/${encodeURIComponent(activityId)}`, {
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
  const data = await calendarRequest(
    accessToken,
    `${EVENTS_BASE}/${encodeURIComponent(recurringEventId)}/instances?${params}`
  );
  return data?.items || [];
}