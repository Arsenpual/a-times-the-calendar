import { useCallback, useEffect, useRef, useState } from "react";
import {
  signInWithGoogle,
  beginCalendarAuthorization,
  getCalendarConnectionStatus,
  subscribeToAuthState,
  signOut
} from "../google-calendar.js";

const CALENDAR_TOKEN_STORAGE_KEY = "calendarAccessToken";
const CALENDAR_TOKEN_EXPIRES_AT_STORAGE_KEY = "calendarAccessTokenExpiresAt";
const CALENDAR_TOKEN_LIFETIME_MS = 60 * 60 * 1000; // legacy direct-token fallback only
const CALENDAR_TOKEN_WARNING_WINDOW_MS = 5 * 60 * 1000; // show the renew banner starting 5 minutes before expiry

/**
 * Owns both halves of auth state (Phase 2 / Firebase Authentication):
 *   - firebaseUser: the Firebase Auth session itself — source of truth for
 *     "is anyone logged in". Persists across reloads on its own
 *     (IndexedDB, handled by the Firebase SDK); api.js pulls a fresh ID
 *     token from auth.currentUser on every backend call, this hook never
 *     touches the ID token directly.
 *   - calendarAccessToken: Google's own OAuth token, used only for direct
 *     Google Calendar API calls. Unlike the Firebase session, this is NOT
 *     auto-refreshed — see google-calendar.js's module comment — so it's
 *     plain state here, persisted to localStorage (see setCalendarAccessToken)
 *     and re-minted at sign-in / via reauthenticateWithGooglePopup()
 *     whenever a Calendar API call comes back 401.
 *
 * This hook does NOT know about activities/categories/summary — those
 * live in useCalendarData and clear themselves independently on logout
 * (app.jsx's handleLogout composes both). It also does not decide when
 * calendarAccessToken should be cleared due to a 401 elsewhere in the app
 * (loadActivities, handleSaveTimes) — those call the returned
 * setCalendarAccessToken(null) themselves, since only the caller making
 * the failing request knows it failed.
 */
export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authReady, setAuthReady] = useState(false); // true once Firebase's initial auth check resolves — avoids a login-button flash before we know if a session already exists

  // Guards signInWithGoogle()/reauthenticateWithGooglePopup() against being
  // called twice concurrently — a ref (not state) because it must be
  // readable/settable synchronously without waiting for a re-render.
  // Needed specifically because React StrictMode double-invokes handlers
  // in dev mode, which can call Firebase's popup-based auth functions
  // before the first call's popup has resolved; Firebase's internal popup
  // tracking assumes only one is ever in flight, and violating that throws
  // "INTERNAL ASSERTION FAILED: Pending promise was never set" — a known
  // firebase-js-sdk issue with concurrent popup calls, not something
  // fixable on Firebase's side from app code other than preventing the
  // overlap ourselves.
  const authPopupInFlight = useRef(false);

  const [error, setError] = useState(null);

  // Google Calendar access token persistence (localStorage) — separate
  // from Firebase's own session persistence (which Firebase's SDK already
  // handles internally via IndexedDB). Without this, refreshing the page
  // always re-prompted the Google consent popup even when the token was
  // still perfectly valid, because calendarAccessToken previously lived
  // in plain React state with nothing backing it across reloads. Storing
  // it doesn't make it last any longer than its real ~1hr Google-side
  // expiry — it just avoids forcing a popup for a token that's still
  // good.
  //
  // Also tracks calendarTokenExpiresAt alongside the token itself —
  // Google Calendar OAuth access tokens minted via Firebase have a fixed
  // 1-hour lifetime, but nothing in the Firebase SDK response exposes
  // that expiry directly, so it's computed once (Date.now() + 1 hour) the
  // moment a fresh token is received and persisted alongside it. This
  // powers the "expiring soon" warning banner in app.jsx — silently
  // auto-reopening the consent popup from a timer isn't possible
  // (browsers block popups not triggered directly by a user click/tap),
  // so the best available option is warning ahead of time with a button
  // the person clicks themselves, which does count as direct user
  // interaction.
  const [calendarAccessToken, setCalendarAccessTokenState] = useState(() => {
    try {
      return window.localStorage.getItem(CALENDAR_TOKEN_STORAGE_KEY) || null;
    } catch {
      // Storage disabled/unavailable (private browsing, some embedded
      // webviews) — fall back to the old in-memory-only behavior rather
      // than crashing the app on load.
      return null;
    }
  });
  const [calendarTokenExpiresAt, setCalendarTokenExpiresAtState] = useState(() => {
    try {
      const raw = window.localStorage.getItem(CALENDAR_TOKEN_EXPIRES_AT_STORAGE_KEY);
      return raw ? parseInt(raw, 10) : null;
    } catch {
      return null;
    }
  });
  // แยก "สิทธิ์หมดจริง" ออกจาก "backend/เน็ตเข้าไม่ถึงชั่วคราว".  ก่อน
  // หน้านี้ catch ของ /calendar-auth/status ล้าง token ทันที ทำให้ Render
  // cold start ถูกตีความผิดว่า Google Calendar ต้องยืนยันใหม่ทุกครั้ง.
  const [calendarConnectionState, setCalendarConnectionState] = useState("idle");
  const setCalendarAccessToken = useCallback((token) => {
    setCalendarAccessTokenState(token);
    setCalendarConnectionState(token ? "connected" : "needs-reauth");
    // "server-managed" หมายถึง backend มี refresh token แล้ว; ไม่ตั้งวันหมด
    // อายุ เพราะ access token จริงถูกสร้าง/ต่ออายุเฉพาะบน server.
    const expiresAt = token && token !== "server-managed" ? Date.now() + CALENDAR_TOKEN_LIFETIME_MS : null;
    setCalendarTokenExpiresAtState(expiresAt);
    try {
      if (token && token !== "server-managed") {
        window.localStorage.setItem(CALENDAR_TOKEN_STORAGE_KEY, token);
        window.localStorage.setItem(CALENDAR_TOKEN_EXPIRES_AT_STORAGE_KEY, String(expiresAt));
      } else {
        window.localStorage.removeItem(CALENDAR_TOKEN_STORAGE_KEY);
        window.localStorage.removeItem(CALENDAR_TOKEN_EXPIRES_AT_STORAGE_KEY);
      }
    } catch {
      // Same as above — if localStorage isn't available, the app still
      // works, it just goes back to prompting for a new token every
      // reload like before this change.
    }
  }, []);

  const refreshCalendarConnection = useCallback(async () => {
    if (!auth.currentUser) {
      setCalendarConnectionState("idle");
      return false;
    }

    setCalendarConnectionState("checking");
    // ให้เวลา Render ตื่นจาก cold start สองรอบก่อนตัดสินว่า backend
    // เข้าไม่ถึงจริง ๆ; สำคัญคือไม่ล้าง Calendar state ระหว่างนี้.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const status = await getCalendarConnectionStatus();
        if (status.connected) {
          setCalendarAccessToken("server-managed");
          return true;
        }
        // Backend ตอบมาเองว่าไม่มี/ใช้ refresh token ไม่ได้เท่านั้น จึง
        // เปลี่ยนเป็น needs-reauth และแสดงหน้าต่างบังคับยืนยันสิทธิ์.
        setCalendarAccessToken(null);
        return false;
      } catch {
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, (attempt + 1) * 1500));
        }
      }
    }

    setCalendarConnectionState("unavailable");
    return false;
  }, [setCalendarAccessToken]);

  // Re-checked once a minute (not on every render) whether the token is
  // within the warning window — a plain comparison in the render body
  // would technically work too, but wouldn't by itself trigger a
  // re-render when the clock ticks past the threshold with no other
  // state change happening; this interval is what actually wakes the
  // component up to show the banner at the right moment.
  const [tokenNearingExpiry, setTokenNearingExpiry] = useState(false);
  useEffect(() => {
    if (!calendarTokenExpiresAt) {
      setTokenNearingExpiry(false);
      return;
    }
    const checkExpiry = () => {
      const msRemaining = calendarTokenExpiresAt - Date.now();
      setTokenNearingExpiry(msRemaining > 0 && msRemaining <= CALENDAR_TOKEN_WARNING_WINDOW_MS);
    };
    checkExpiry();
    const interval = setInterval(checkExpiry, 60 * 1000);
    return () => clearInterval(interval);
  }, [calendarTokenExpiresAt]);

  // Subscribe to Firebase's own auth state once on mount — fires
  // immediately with the persisted session (or null) on load, then again
  // on every sign-in/sign-out.
  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        // Signed out elsewhere (e.g. another tab, or token revoked) —
        // drop the Calendar token too, since it's meaningless without a
        // Firebase session to pair it with.
        setCalendarAccessToken(null);
        setCalendarConnectionState("idle");
      } else {
        // Login เดิมที่เคยเชื่อม Calendar แล้วจะได้สถานะ server-managed
        // กลับมาทันทีหลัง refresh โดยไม่ขอ popup ซ้ำ.  Network error ไม่ใช่
        // reauth: refreshCalendarConnection จะ retry และคืน unavailable แทน.
        refreshCalendarConnection();
      }
    });
    return unsubscribe;
  }, [refreshCalendarConnection, setCalendarAccessToken]);

  const handleLogin = useCallback(async () => {
    if (authPopupInFlight.current) return;
    authPopupInFlight.current = true;
    try {
      setError(null);
      await signInWithGoogle();
      const status = await getCalendarConnectionStatus();
      setCalendarAccessToken(status.connected ? "server-managed" : null);
      // firebaseUser itself is set by the subscribeToAuthState listener
      // above, not here — signInWithPopup's result also triggers that
      // subscription, so we'd otherwise be setting it twice.
    } catch (e) {
      // Popup closed/blocked by the user is a normal cancellation, not an
      // error worth surfacing as a red banner.
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        setError(e.message);
      }
    } finally {
      authPopupInFlight.current = false;
    }
  }, [setCalendarAccessToken]);

  // handleLogout only clears this hook's own state (firebaseUser is
  // cleared by the auth-state listener once signOut() resolves) — the
  // caller (app.jsx) is responsible for also clearing activities/
  // categories/summary state owned by useCalendarData, since this hook
  // has no knowledge of that data.
  const handleLogout = useCallback(async () => {
    await signOut();
  }, []);

  /**
   * เริ่ม server-side OAuth flow สำหรับเชื่อม/reconnect Google Calendar.
   */
  const handleReauthCalendar = useCallback(async () => {
    if (authPopupInFlight.current) return;
    authPopupInFlight.current = true;
    try {
      setError(null);
      await beginCalendarAuthorization();
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        setError(e.message);
      }
    } finally {
      authPopupInFlight.current = false;
    }
  }, [setCalendarAccessToken]);

  return {
    firebaseUser,
    authReady,
    error,
    setError,
    calendarAccessToken,
    calendarConnectionState,
    setCalendarAccessToken,
    calendarTokenExpiresAt,
    setCalendarTokenExpiresAtState, // exposed only for app.jsx's dev-only token-expiry-simulation button
    tokenNearingExpiry,
    refreshCalendarConnection,
    handleLogin,
    handleLogout,
    handleReauthCalendar,
    CALENDAR_TOKEN_EXPIRES_AT_STORAGE_KEY // exposed for the same dev-only button, which writes this key directly
  };
}
