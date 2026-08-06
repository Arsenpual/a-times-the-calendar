// Google OAuth + Calendar API helpers.
//
// Phase 2 (Firebase Authentication): sign-in uses the Firebase Auth SDK's
// POPUP flow (signInWithPopup/reauthenticateWithPopup + GoogleAuthProvider).
//
// This went through two iterations worth recording:
//   1. Started with signInWithPopup — worked, but triggers a harmless
//      "Cross-Origin-Opener-Policy policy would block the window.closed
//      call" console warning in Chromium browsers (Firebase's internal
//      popup-closed polling can't succeed across the origin boundary to
//      accounts.google.com; see firebase/firebase-js-sdk#8295, #8541).
//   2. Switched to signInWithRedirect/getRedirectResult to eliminate the
//      warning — but this broke sign-in entirely on localhost:
//      getRedirectResult() kept returning null even after a fully
//      successful Google consent flow. Root cause (confirmed via multiple
//      firebase-js-sdk GitHub issues, e.g. #8652, #7716): the redirect
//      flow round-trips the result through Firebase's auth domain
//      (*.firebaseapp.com), which is a different origin than
//      localhost:5173 — modern Chrome's third-party storage partitioning
//      blocks the IndexedDB handoff between them, so the result never
//      makes it back. This isn't something fixable from app code or
//      Vite config; it needs either a matching custom auth domain (not
//      practical for local dev) or browser flags most users won't have set.
//   3. Reverted to signInWithPopup — the COOP warning is cosmetic and
//      doesn't affect functionality, whereas the redirect flow's storage
//      issue silently prevented sign-in from completing at all. Reliable
//      login took priority over a clean console.
//
// One popup gets us everything:
//   - a Firebase user + Firebase ID token (sent to our own backend, verified
//     by middleware/require-auth.js — see api.js)
//   - a Google OAuth access token with the Calendar scope, via
//     GoogleAuthProvider.credentialFromResult() (used directly against
//     Google's own Calendar API below, same as before)
//
// IMPORTANT caveat carried over from Firebase's own docs: the Google
// provider's access token is only handed to us once, at the moment of
// sign-in — Firebase does NOT auto-refresh it the way it auto-refreshes its
// own ID token. When it expires (Google's calendar-scoped tokens are
// typically ~1hr), the only way to get a fresh one is another popup
// (reauthenticateWithGooglePopup below) — there is no silent/background
// refresh path here, unlike the old initTokenClient flow. app.jsx is
// responsible for catching the resulting 401 from Google's API and
// prompting the user to re-auth (see calendarRequest's 401 handling).
//
// Docs: https://firebase.google.com/docs/auth/web/google-signin
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

// Phase 2: two-way sync needs full read/write access, not just readonly.
// Anyone who previously granted only readonly access (from before this
// scope was widened) will be re-prompted for write access automatically —
// Firebase always re-runs the OAuth consent flow through signInWithPopup,
// there's no separate "log out and back in" step needed like the old GIS
// flow required.
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export const auth = getAuth(firebaseApp);

/**
 * Builds a fresh GoogleAuthProvider with the Calendar scope requested.
 * A new instance per call (rather than one shared module-level instance)
 * avoids any risk of stale custom parameters/scopes carrying over between
 * sign-in attempts — matches Firebase's own documented usage pattern.
 */
function googleProviderWithCalendarScope() {
  const provider = new GoogleAuthProvider();
  provider.addScope(CALENDAR_SCOPE);
  // Always show the account chooser — avoids silently re-using whichever
  // Google account happens to be cached in the browser, since this app is
  // scoped to one Google Calendar per Firebase user.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

/**
 * Opens the Google sign-in popup, requesting both Firebase identity and the
 * Calendar scope in one consent screen.
 * @returns {Promise<{ idToken: string, calendarAccessToken: string }>}
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProviderWithCalendarScope());
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const idToken = await result.user.getIdToken();
  return { idToken, calendarAccessToken: credential.accessToken };
}

/**
 * Re-opens the Google sign-in popup for the already-signed-in Firebase user,
 * purely to mint a fresh Calendar access token once the old one expires —
 * see the module-level comment above for why this can't happen silently.
 * The Firebase session itself (ID token) is untouched by this; only the
 * Google access token is refreshed.
 * @returns {Promise<string>} calendarAccessToken
 */
export async function reauthenticateWithGooglePopup() {
  if (!auth.currentUser) {
    throw new Error("ยังไม่ได้เข้าสู่ระบบ — เรียก signInWithGoogle() ก่อน");
  }
  const result = await reauthenticateWithPopup(auth.currentUser, googleProviderWithCalendarScope());
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return credential.accessToken;
}

/**
 * Subscribes to Firebase auth state changes (sign-in, sign-out, token
 * refresh). Returns the unsubscribe function — call it on unmount.
 * @param {(user: import("firebase/auth").User | null) => void} callback
 */
export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Signs out of Firebase entirely (also invalidates the cached Calendar access token for this session). */
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
      // Phase 2: this now specifically means the *Google* Calendar access
      // token has expired (Firebase's own ID token auto-refreshes and
      // never surfaces here) — app.jsx should catch this and offer
      // reauthenticateWithGooglePopup() rather than a full re-login.
      throw new Error("สิทธิ์เข้าถึง Google Calendar หมดอายุ — กรุณายืนยันตัวตนอีกครั้ง");
    }
    if (res.status === 403) {
      throw new Error(
        "ไม่มีสิทธิ์แก้ไขปฏิทิน — ลองยืนยันตัวตนใหม่เพื่อขอสิทธิ์เขียนปฏิทิน"
      );
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

  // DELETE returns 204 with no body.
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
 * Fetches activities (Google Calendar events) from the user's primary
 * calendar within a date range.
 * @param {string} accessToken
 * @param {Date} timeMin
 * @param {Date} timeMax
 * @returns {Promise<Array>} list of Google Calendar event objects
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
 * Fetches a single activity by id — used before an update to check whether
 * it was changed elsewhere (e.g. directly in Google Calendar) since it was
 * loaded into the edit form, so we can warn about a conflict instead of
 * silently overwriting someone else's edit.
 * @param {string} accessToken
 * @param {string} activityId
 */
export async function getActivity(accessToken, activityId) {
  return calendarRequest(accessToken, `${EVENTS_BASE}/${encodeURIComponent(activityId)}`);
}

/**
 * Creates a new activity on the user's primary Google Calendar.
 * @param {string} accessToken
 * @param {{summary: string, start: object, end: object}} activityBody
 */
export async function createActivity(accessToken, activityBody) {
  return calendarRequest(accessToken, EVENTS_BASE, {
    method: "POST",
    body: JSON.stringify(activityBody)
  });
}

/**
 * Updates (patches) an existing activity.
 * @param {string} accessToken
 * @param {string} activityId
 * @param {object} activityBody partial fields to update (summary, start, end)
 */
export async function updateActivity(accessToken, activityId, activityBody) {
  return calendarRequest(accessToken, `${EVENTS_BASE}/${encodeURIComponent(activityId)}`, {
    method: "PATCH",
    body: JSON.stringify(activityBody)
  });
}

/**
 * Deletes an activity from the user's primary Google Calendar.
 *
 * To delete an entire recurring series in one call, pass the series'
 * `recurringEventId` (present on every expanded instance returned by
 * fetchActivities, since we always request singleEvents=true) instead of
 * the instance's own `id` — Google Calendar treats the recurring event's
 * own id as the "master" event, and deleting it removes every occurrence.
 * @param {string} accessToken
 * @param {string} activityId a single instance's id, or a series' recurringEventId
 */
export async function deleteActivity(accessToken, activityId) {
  await calendarRequest(accessToken, `${EVENTS_BASE}/${encodeURIComponent(activityId)}`, {
    method: "DELETE"
  });
}
/**
 * ดึง instances ทั้งหมดของ recurring event series
 * ใช้ก่อน "แก้ทั้งชุด" เพื่อนับว่ามีกี่ครั้ง และเพื่อ update ทีละ instance
 *
 * @param {string} accessToken
 * @param {string} recurringEventId  — base event id (ไม่ใช่ instance id)
 * @param {number} maxResults        — cap ที่ดึงมา (default 250 = Google's max per page)
 * @returns {Promise<Array>} instances sorted by startTime
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
