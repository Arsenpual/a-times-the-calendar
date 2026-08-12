import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import loginGuideStep1 from "../public/login-guide-step1.jpg";
import loginGuideStep2 from "../public/login-guide-step2.jpg";
import loginGuideStep3 from "../public/login-guide-step3.jpg";
import AgendaView from "./components/agenda-view.jsx";
import TagSearchResults from "./components/tag-search-results.jsx";
import WeeklySummaryPanel from "./components/weekly-summary-panel.jsx";
import MiniTimelinePanel from "./components/mini-timeline-panel.jsx";
import ActivityModal from "./components/activity-modal.jsx";
import ReminderMode from "./components/reminder-mode-mockup.jsx";
import AnnouncementTicker from "./components/announcement-ticker.jsx";
import SettingsDrawer from "./components/settings-drawer.jsx";
import {
  auth,
  signInWithGoogle,
  reauthenticateWithGooglePopup,
  subscribeToAuthState,
  signOut,
  fetchActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
  fetchRecurringInstances
} from "./google-calendar.js";
import {
  fetchCategories,
  createCategory,
  deleteCategory,
  fetchActivityCategoryMap,
  assignActivityCategory,
  fetchActivityTagMap,
  setActivityTags,
  fetchWeeklySummary,
  fetchLockedActivities,
  setActivityLocked
} from "./api.js";
import { getWeekRange, formatWeekLabel, activityDate, toDateInputValue } from "./date-utils.js";
import { normalizeActivityId } from "./id-utils.js";

// Hardcoded broadcast message shown in the scrolling ticker below the
// header, calendar (dashboard) mode only — see AnnouncementTicker. Not
// dismissible and not fetched from a backend, so updating it means editing
// this string and redeploying. Set to "" (or null) to hide the ticker
// entirely without removing the component from the tree.
const ANNOUNCEMENT_MESSAGE = "🎉 อัปเดตเวอร์ชันใหม่ — เพิ่มการรองรับกิจกรรมข้ามเที่ยงคืน และปรับปรุงการแสดงผลไทม์ไลน์";
const BRAND_WORDMARK_SRC = `${import.meta.env.BASE_URL}logo/times-wordmark.svg`;

// 3 ขั้นตอนสำหรับผ่านหน้าจอเตือน "แอปยังไม่ได้ยืนยัน" ของ Google ระหว่าง
// OAuth consent (ดูคอมเมนต์ที่ showLoginGuide overlay ด้านล่าง) — ใช้ import
// แทน string path ตรงๆ ("/login-guide-step1.jpg") เพราะ GitHub Pages เสิร์ฟ
// ที่ subpath /a-times-the-calendar/ ไม่ใช่ root — path ที่ขึ้นต้นด้วย "/"
// ตรงๆ จะไม่ผ่าน Vite's base config เลยหาไฟล์ไม่เจอ (404) ตอน deploy จริง
// ถึงแม้ localhost จะใช้ได้ปกติเพราะ dev server เสิร์ฟจาก root เสมอ
const LOGIN_GUIDE_STEPS = [
  { number: 1, image: loginGuideStep1, text: 'เมื่อเจอหน้าเตือนสีแดง ให้กดปุ่ม "ขั้นสูง" ที่มุมซ้ายล่าง' },
  { number: 2, image: loginGuideStep2, text: 'เลื่อนลงล่างสุด แล้วคลิก "ไปที่ times-the-calendar.firebaseapp.com (ไม่ปลอดภัย)"' },
  { number: 3, image: loginGuideStep3, text: 'กดปุ่ม "ดำเนินต่อ" ที่มุมขวาล่างเพื่ออนุญาตสิทธิ์ปฏิทิน' },
];

export default function App() {
  // Phase 2 (Firebase Auth): two separate pieces of auth state now instead
  // of one accessToken —
  //   - firebaseUser: the Firebase Auth session itself. This is the source
  //     of truth for "is anyone logged in" (drives every login-gated effect
  //     and the header/login-button UI below). Firebase persists this
  //     across reloads on its own (IndexedDB), and api.js pulls a
  //     fresh ID token from auth.currentUser on every backend call —
  //     app.jsx never touches the ID token directly.
  //   - calendarAccessToken: Google's own OAuth token, used only for direct
  //     Google Calendar API calls (fetchActivities/updateActivity/etc.
  //     below still take this as their first argument, unchanged from
  //     before). Unlike the Firebase session, this is NOT auto-refreshed —
  //     see google-calendar.js's module comment — so it's plain component
  //     state, re-minted at sign-in and again via
  //     reauthenticateWithGooglePopup() whenever a Calendar API call comes
  //     back 401.
  const [firebaseUser, setFirebaseUser] = useState(null);
  // "dashboard" = ปฏิทินปกติ, "reminder" = reminder/Pomodoro ที่ทำงานใน
  // browser tab และเก็บรายการไว้ใน localStorage แยก state ออกมาต่างหากจาก
  // firebaseUser/calendarAccessToken เพราะสลับโหมดได้ไม่ว่าจะ login อยู่หรือไม่
  const [mode, setMode] = useState("dashboard");
  // Guards signInWithGoogle()/reauthenticateWithGooglePopup() against being
  // called twice concurrently — a ref (not state) because it must be
  // readable/settable synchronously without waiting for a re-render.
  // Needed specifically because React StrictMode double-invokes handlers
  // in dev mode, which can call Firebase's popup-based auth functions
  // before the first call's popup has resolved; Firebase's internal popup
  // tracking assumes only one is ever in flight, and violating that throws
  // "INTERNAL ASSERTION FAILED: Pending promise was never set" — a
  // known firebase-js-sdk issue with concurrent popup calls, not something
  // fixable on Firebase's side from app code other than preventing the
  // overlap ourselves.
  const authPopupInFlight = useRef(false);
  const [authReady, setAuthReady] = useState(false); // true once Firebase's initial auth check resolves — avoids a login-button flash before we know if a session already exists

  // Shows a guide image over the login screen explaining the Google
  // consent-screen warning people will see, since this app isn't through
  // Google's App Verification process yet. Starts true (shown immediately
  // alongside the login card) and only ever goes false via the dismiss
  // button — deliberately NOT persisted (no localStorage), so it reappears
  // every time the page is loaded/refreshed rather than being permanently
  // dismissed after the first close.
  const [showLoginGuide, setShowLoginGuide] = useState(true);

  // Dark mode theme — persisted in localStorage so it survives refresh,
  // same pattern as calendarAccessToken above. Read once at mount; applied
  // to <html> as a data-theme attribute (see the effect below) so CSS can
  // key off [data-theme="dark"] selectors globally, rather than needing a
  // class/prop threaded through every component that renders a color.
  // Defaults to the system preference (prefers-color-scheme) on first-ever
  // visit, before anything has been explicitly chosen/saved.
  const THEME_STORAGE_KEY = "theme";
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // localStorage unavailable — fall through to system preference below.
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const setTheme = (next) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Same as calendarAccessToken's setter — if storage isn't available,
      // the app still works, it just won't remember the choice on reload.
    }
  };
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Google Calendar access token persistence (localStorage) — separate
  // from Firebase's own session persistence (which Firebase's SDK already
  // handles internally via IndexedDB). Without this, refreshing the page
  // always re-prompted the Google consent popup even when the token was
  // still perfectly valid, because calendarAccessToken previously lived
  // in plain React state (useState(null)) with nothing backing it across
  // reloads. Storing it doesn't make it last any longer than its real
  // ~1hr Google-side expiry — it just avoids forcing a popup for a token
  // that's still good. The existing 401 handling (loadActivities,
  // handleSaveTimes, the auth-state listener's sign-out branch) already
  // clears calendarAccessToken to null in every case where the token
  // turns out to be dead; routing all of those through
  // persistCalendarAccessToken means the stale value also gets wiped from
  // localStorage at the same time, not just from React state.
  //
  // Also tracks calendarTokenExpiresAt alongside the token itself — Google
  // Calendar OAuth access tokens minted via Firebase have a fixed 1-hour
  // lifetime, but nothing in the Firebase SDK response exposes that
  // expiry directly, so it's computed once (Date.now() + 1 hour) the
  // moment a fresh token is received and persisted alongside it. This
  // powers the "expiring soon" warning banner below — silently
  // auto-reopening the consent popup from a timer isn't possible (browsers
  // block popups not triggered directly by a user click/tap), so the best
  // available option is warning ahead of time with a button the person
  // clicks themselves, which does count as direct user interaction.
  const CALENDAR_TOKEN_STORAGE_KEY = "calendarAccessToken";
  const CALENDAR_TOKEN_EXPIRES_AT_STORAGE_KEY = "calendarAccessTokenExpiresAt";
  const CALENDAR_TOKEN_LIFETIME_MS = 60 * 60 * 1000; // Google's standard OAuth access token lifetime
  const CALENDAR_TOKEN_WARNING_WINDOW_MS = 5 * 60 * 1000; // show the renew banner starting 5 minutes before expiry

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
  const setCalendarAccessToken = useCallback((token) => {
    setCalendarAccessTokenState(token);
    const expiresAt = token ? Date.now() + CALENDAR_TOKEN_LIFETIME_MS : null;
    setCalendarTokenExpiresAtState(expiresAt);
    try {
      if (token) {
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

  const [cursorDate, setCursorDate] = useState(new Date());
  const [activities, setActivities] = useState([]);
  // ค้นหากิจกรรมด้วย tag (หลายอันพร้อมกัน แบบ OR — เจอกิจกรรมที่มี tag
  // ใดอันหนึ่งตรงก็แสดง) — เก็บเป็น array ของคำค้นหา ไม่ใช่ string เดียว
  // เพื่อรองรับหลาย tag พร้อมกัน (พิมพ์แล้วกด Enter เพิ่มเป็นคำถัดไป)
  const [tagSearchTerms, setTagSearchTerms] = useState([]);
  const [tagSearchDraft, setTagSearchDraft] = useState("");
  // เมื่อมี tagSearchTerms อยู่ ต้องค้นข้ามสัปดาห์ได้ (ไม่ใช่แค่สัปดาห์ที่
  //กำลังดูอยู่) — ดึงกิจกรรมจาก Google Calendar แบบช่วงกว้างแยกต่างหาก
  // จาก `activities` ปกติ (ซึ่งยังคงยึดตามสัปดาห์ที่ cursorDate ชี้อยู่
  // เหมือนเดิม ไม่กระทบกัน) จำกัดช่วง ±3 เดือนจากวันนี้ กันดึงข้อมูลหนักเกิน
  // ไปถ้าผู้ใช้มีกิจกรรมสะสมมานาน
  const [tagSearchResults, setTagSearchResults] = useState([]);
  const [tagSearchLoading, setTagSearchLoading] = useState(false);
  const [tagSearchError, setTagSearchError] = useState(null);
  // Bumped by every handler that writes an activity (save/delete/move/
  // duplicate/set-color/save-times/delete-series) so the tag-search effect
  // below knows to refetch even though tagSearchTerms itself didn't change —
  // without this, editing/deleting/moving an activity from inside
  // TagSearchResults left tagSearchResults showing stale data until the
  // person cleared and retyped their search (see the "ดึงไปแล้ว ไม่ต้องซ้ำ"
  // guard below, which otherwise skips every refetch after the first).
  const [tagSearchRefreshKey, setTagSearchRefreshKey] = useState(0);
  const refreshTagSearchIfActive = () => {
    if (tagSearchTerms.length > 0) setTagSearchRefreshKey((k) => k + 1);
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [categories, setCategories] = useState([]);
  const [activityCategoryMap, setActivityCategoryMap] = useState({});
  const [activityTagMap, setActivityTagMap] = useState({}); // activityId (normalized) -> string[]
  const [lockedActivities, setLockedActivities] = useState({});
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Two-way sync: modal state for creating/editing a Google Calendar activity.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState(null);
  const [modalEditingActivity, setModalEditingActivity] = useState(null);
  const [modalEditingAsSeries, setModalEditingAsSeries] = useState(false);

  // Day-timeline state: when set, the summary/timeline flip card (see App
  // render below) shows MiniTimelinePanel for this day instead of
  // WeeklySummaryPanel. Selecting a day only ever happens from AgendaView
  // on the right — this panel pair has no day picker of its own anymore.
  const [expandedDate, setExpandedDate] = useState(null);

  // Subscribe to Firebase's own auth state once on mount — fires
  // immediately with the persisted session (or null) on load, then again
  // on every sign-in/sign-out. Replaces the old GIS initTokenClient setup
  // effect entirely; there's no separate "wait for GIS script to load and
  // retry" dance needed since the Firebase SDK is a normal ES import.
  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        // Signed out elsewhere (e.g. another tab, or token revoked) —
        // drop the Calendar token too, since it's meaningless without a
        // Firebase session to pair it with.
        setCalendarAccessToken(null);
      }
    });
    return unsubscribe;
  }, []);

  // Load life-area categories + activity->category mapping + lock states
  // from our own backend once the user is logged in. Gated on firebaseUser
  // (not calendarAccessToken) since api.js only needs the Firebase ID
  // token, which it pulls fresh from auth.currentUser itself.
  useEffect(() => {
    if (!firebaseUser) return;
    fetchCategories().then(setCategories).catch((e) => setError(e.message));
    fetchActivityCategoryMap().then(setActivityCategoryMap).catch((e) => setError(e.message));
    fetchActivityTagMap().then(setActivityTagMap).catch((e) => setError(e.message));
    fetchLockedActivities().then(setLockedActivities).catch((e) => setError(e.message));
  }, [firebaseUser]);

  const loadActivities = useCallback(async () => {
    if (!calendarAccessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [weekStart, rangeEnd] = getWeekRange(cursorDate);
      // Fetch from one day before the visible week starts — not because
      // that extra day is shown anywhere, but so an activity that began
      // the night before the week (e.g. Saturday 23:00 → Sunday 02:00)
      // is available to render as a dimmed "spillover from last night"
      // indicator on the week's first day. activitiesByDay still filters
      // strictly by each activity's own start date, so this extra day of
      // fetched data never gets counted as belonging to any visible day.
      const rangeStart = new Date(weekStart);
      rangeStart.setDate(rangeStart.getDate() - 1);
      const items = await fetchActivities(calendarAccessToken, rangeStart, rangeEnd);
      setActivities(items);
    } catch (e) {
      setError(e.message);
      if (e.message.includes("หมดอายุ")) {
        // Only the Google Calendar token is stale here — the Firebase
        // session itself is fine, so we don't sign the user out. Clearing
        // calendarAccessToken flips the UI to the "ยืนยันตัวตน Google
        // Calendar" prompt (see render below) instead of the full
        // "เข้าสู่ระบบด้วย Google" login button.
        setCalendarAccessToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [calendarAccessToken, cursorDate]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // ค้นหาด้วย tag ต้องเห็นกิจกรรมข้ามสัปดาห์/เดือนได้ ไม่ใช่แค่สัปดาห์ที่
  // agenda กำลังแสดงอยู่ — ดึงช่วงกว้าง ±3 เดือนจากวันนี้แยกต่างหากจาก
  // `activities` ปกติ เกิดขึ้นแค่ตอนมี tagSearchTerms อย่างน้อย 1 คำ
  // (ไม่ดึงล่วงหน้าโดยไม่จำเป็น) — ดึงครั้งเดียวตอนเริ่มค้นหา ไม่ query ซ้ำ
  // ทุกครั้งที่เพิ่ม/ลบคำค้นหา เพราะช่วงเวลาที่ดึงไม่ได้เปลี่ยนตามคำค้นหา
  useEffect(() => {
    if (tagSearchTerms.length === 0 || !calendarAccessToken) return;

    let cancelled = false;
    setTagSearchLoading(true);
    setTagSearchError(null);
    const today = new Date();
    const rangeStart = new Date(today);
    rangeStart.setMonth(rangeStart.getMonth() - 3);
    const rangeEnd = new Date(today);
    rangeEnd.setMonth(rangeEnd.getMonth() + 3);

    fetchActivities(calendarAccessToken, rangeStart, rangeEnd)
      .then((items) => {
        if (!cancelled) setTagSearchResults(items);
      })
      .catch((e) => {
        if (!cancelled) setTagSearchError(e.message);
      })
      .finally(() => {
        if (!cancelled) setTagSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // tagSearchRefreshKey deliberately triggers a refetch on every bump
    // (see refreshTagSearchIfActive) even though it carries no data of its
    // own — this is what keeps search results in sync after an edit/
    // delete/move instead of only fetching once per search session.
  }, [tagSearchTerms, calendarAccessToken, tagSearchRefreshKey]);

  // เคลียร์ผลค้นหาทิ้งเมื่อไม่มีคำค้นหาเหลืออยู่แล้ว (กันผลเก่าค้าง ถ้า
  // ผู้ใช้ลบคำค้นหาหมดแล้วพิมพ์ใหม่ทีหลัง จะได้ไปดึงข้อมูลรอบใหม่)
  useEffect(() => {
    if (tagSearchTerms.length === 0) {
      setTagSearchResults([]);
      setTagSearchError(null);
    }
  }, [tagSearchTerms]);

  // Recompute the weekly summary from our backend whenever the activities
  // for the visible week (or their category assignments) change. activities
  // deliberately includes the day before the week for the timeline's
  // overnight-spillover indicator, so filter it back to the visible Sunday–
  // Saturday range before sending it to the summary API.
  useEffect(() => {
    const [weekStart, weekEnd] = getWeekRange(cursorDate);
    const weeklyActivities = activities.filter((activity) => {
      const start = activityDate(activity.start);
      return start && start >= weekStart && start <= weekEnd;
    });

    if (!firebaseUser || weeklyActivities.length === 0) {
      setSummary(null);
      setSummaryLoading(false);
      return;
    }

    // A duplicate/move can trigger a fresh load and summary request while
    // the previous request is still in flight. Ignore the older response if
    // its effect has already been superseded, so stale totals cannot flash
    // back over the latest calendar state.
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    const payload = weeklyActivities
      .map((activity) => {
        const start = activityDate(activity.start);
        const end = activityDate(activity.end);
        if (!start || !end) return null;
        return {
          id: activity.id,
          summary: activity.summary,
          start: start.toISOString(),
          end: end.toISOString(),
          // Keep the browser-local day that AgendaView and MiniTimelinePanel
          // use, rather than relying on the server's timezone for grouping.
          startDate: toDateInputValue(start)
        };
      })
      .filter(Boolean);

    fetchWeeklySummary(payload)
      .then((nextSummary) => {
        if (!cancelled) setSummary(nextSummary);
      })
      .catch((e) => {
        if (!cancelled) setSummaryError(e.message);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [firebaseUser, activities, activityCategoryMap, cursorDate]);

  const handleLogin = async () => {
    if (authPopupInFlight.current) return;
    authPopupInFlight.current = true;
    try {
      setError(null);
      const { calendarAccessToken: token } = await signInWithGoogle();
      setCalendarAccessToken(token);
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
  };

  const handleLogout = async () => {
    await signOut();
    // firebaseUser/calendarAccessToken are cleared by the auth-state
    // listener above once signOut() resolves — clear the rest of the
    // session's data here so stale content doesn't flash before the
    // login-gated effects above re-run.
    setActivities([]);
    setSummary(null);
    setCategories([]);
    setActivityCategoryMap({});
    setLockedActivities({});
  };

  /**
   * Re-opens the Google consent popup purely to mint a fresh Calendar
   * access token, without touching the Firebase session — used when
   * loadActivities (or any direct Calendar API call) comes back 401 with
   * calendarAccessToken cleared to null (see loadActivities above and the
   * "ยืนยันตัวตน Google Calendar" prompt in the render below).
   */
  const handleReauthCalendar = async () => {
    if (authPopupInFlight.current) return;
    authPopupInFlight.current = true;
    try {
      setError(null);
      const token = await reauthenticateWithGooglePopup();
      setCalendarAccessToken(token);
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        setError(e.message);
      }
    } finally {
      authPopupInFlight.current = false;
    }
  };

  /**
   * เปลี่ยนสัปดาห์ที่กำลังดู — เรียกจากทั้งปุ่ม ‹ › ในหัว, ปุ่มลูกศรของแถว
   * ใน AgendaView, และ global ← → shortcut ด้านล่าง (ดู handleGlobalKeyDown)
   * ทั้งสามทางเรียกฟังก์ชันเดียวกันนี้เสมอเพื่อไม่ให้ logic เพี้ยนจากกัน
   * ห่อด้วย useCallback (identity คงที่) เพราะ effect ของ global shortcut
   * ด้านล่าง add/remove event listener ตาม dependency ของมันเอง — ถ้า
   * navigateWeek เป็นฟังก์ชันใหม่ทุก render (เหมือนตอนเป็น const ธรรมดา)
   * effect นั้นจะ add/remove listener ใหม่ทุก render ไปด้วยโดยไม่จำเป็น
   *
   * ไม่แตะ expandedDate โดยตรงในนี้ (ทำที่ effect ผูกกับ cursorDate ด้านล่าง
   * แทน) เพราะฟังก์ชันนี้ต้องเป็น pure ต่อ cursorDate เท่านั้นเพื่อให้
   * dependency array ของ useCallback ว่างเปล่าคงที่ได้
   */
  const navigateWeek = useCallback((direction) => {
    setCursorDate((prevCursorDate) => {
      const next = new Date(prevCursorDate);
      next.setDate(next.getDate() + direction * 7);
      return next;
    });
  }, []);

  // เปลี่ยนวันโดยยึดวันที่ที่กำลังเปิด mini timeline อยู่เป็นหลัก; ถ้ายังไม่
  // เคยเลือกวัน ให้เริ่มจากวันของ cursor ปัจจุบันแทน `cursorDate` จะเปลี่ยน
  // เฉพาะเมื่อข้ามสัปดาห์เท่านั้น: การเลื่อนวันภายในสัปดาห์เดิมต้องเปลี่ยน
  // แค่ expandedDate มิฉะนั้นจะไป re-fetch Calendar และคำนวณ summary ใหม่
  // ทุกครั้ง ทำให้สี/animation ของทั้งหน้ากระพริบโดยไม่จำเป็น
  const navigateDay = useCallback((direction) => {
    const baseDate = expandedDate || cursorDate;
    const next = new Date(baseDate);
    next.setDate(next.getDate() + direction);

    // เปลี่ยน expandedDate เฉพาะตอนมี mini-timeline เปิดอยู่แล้วเท่านั้น —
    // ถ้ายังไม่เคยเลือกวันไหนเลย (expandedDate เป็น null) ↑/↓ ไม่ควรเปิด
    // mini-timeline ขึ้นมาเอง มิฉะนั้นการกดลูกศรครั้งแรกหลังล็อกอิน (ก่อน
    // คลิกเลือกวันใดๆ) จะดันไปเปิดมันขึ้นมาโดยไม่ได้ตั้งใจ ขัดกับ intent
    // เดิมที่ isFirstCursorDateRun guard ด้านล่างตั้งใจรักษาไว้
    if (expandedDate) {
      setExpandedDate(next);
    }

    const [currentWeekStart] = getWeekRange(cursorDate);
    const [nextWeekStart] = getWeekRange(next);
    if (currentWeekStart.getTime() !== nextWeekStart.getTime()) {
      setCursorDate(next);
    }
  }, [cursorDate, expandedDate]);

  const goToday = () => setCursorDate(new Date());

  // Ref เดียวที่ track ว่า effect ด้านล่าง (ผูกกับ cursorDate) เคยรันมาแล้ว
  // อย่างน้อยหนึ่งครั้งหรือยัง — ต้องกันการรันตอน initial mount โดยเฉพาะ
  // เพราะ useEffect รันเสมอตอน mount ครั้งแรกไม่ว่า dependency จะ "เปลี่ยน"
  // จริงหรือไม่ ถ้าไม่กันไว้ expandedDate (เริ่มต้นเป็น null ตาม useState
  // ด้านบน) จะถูกเปลี่ยนเป็นวันแรกของสัปดาห์ปัจจุบันทันทีตั้งแต่โหลดหน้า
  // แรก ทั้งที่ควรว่างเปล่าจนกว่าผู้ใช้จะเลือกวันเอง (ยังไม่เคยกด ←→ เลย)
  const isFirstCursorDateRun = useRef(true);

  const openDay = (date) => setExpandedDate(date);

  const closeDay = () => setExpandedDate(null);

  // Reset the open timeline day whenever the visible
  // week changes:
  //   - ถ้ามีวันที่ถูกเลือกอยู่แล้วก่อนเปลี่ยนสัปดาห์ (prev ไม่ null) และวัน
  //     นั้นไม่อยู่ในสัปดาห์ใหม่อีกต่อไป → clear เป็น null (พฤติกรรมเดิม —
  //     วันจากสัปดาห์เก่าไม่มี activities โหลดมาแสดงอยู่แล้ว)
  //   - ถ้ายังไม่มีวันไหนถูกเลือกอยู่ (prev เป็น null) → คง null ไว้;
  //     global ↑/↓ สามารถเริ่มเลือกวันจาก cursorDate ได้เอง จึงไม่ต้อง
  //     สร้าง DOM focus ให้แถว AgendaView เพื่อให้ keyboard ใช้งานได้
  //   - ยกเว้น "รอบแรกสุด" ตอน mount (isFirstCursorDateRun) ที่จะไม่ทำ
  //     อะไรเลย — คงพฤติกรรมเดิมที่หน้าเพิ่งโหลดมาแล้วยังไม่มี mini-timeline
  //     ใดๆ เปิดอยู่จนกว่าผู้ใช้จะเลือกวันเอง ไม่ใช่ auto-select ตั้งแต่แรก
  useEffect(() => {
    if (isFirstCursorDateRun.current) {
      isFirstCursorDateRun.current = false;
      return;
    }
    setExpandedDate((prev) => {
      const [weekStart, weekEnd] = getWeekRange(cursorDate);
      if (!prev) return null;
      return prev >= weekStart && prev <= weekEnd ? prev : null;
    });
  }, [cursorDate]);

  /**
   * Global arrow-key shortcuts, independent of focus inside AgendaView.
   * ←/→ call the week buttons' handler; ↑/↓ call the day buttons' handler.
   * Keeping the shortcut here rather than inside an agenda row means it
   * works immediately after login and while focus is on any non-text UI.
   *
   * Two guards keep this from firing where arrow keys should do something
   * else instead:
   *   1. Skipped entirely outside dashboard mode (mode !== "dashboard"),
   *      since there's no week to navigate in reminder mode.
   *   2. Skipped while focus is inside a text input, textarea, or
   *      contenteditable element (tag search box, any field inside
   *      ActivityModal, etc.) — arrow keys there need to move the text
   *      cursor, not navigate the calendar.
   */
  useEffect(() => {
    if (mode !== "dashboard") return;
    const handleGlobalKeyDown = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const active = document.activeElement;
      const isTextEntry =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable);
      if (isTextEntry) return;
      e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        navigateWeek(e.key === "ArrowLeft" ? -1 : 1);
      } else {
        navigateDay(e.key === "ArrowUp" ? -1 : 1);
      }
    };
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [mode, navigateDay, navigateWeek]);

  /**
   * Shared two-way sync conflict check (see also ActivityModal's own check
   * via knownUpdated): compares the activity's Google Calendar "updated"
   * timestamp against what we last loaded into `activities` state. If it
   * changed — meaning the activity was edited elsewhere (directly in
   * Google Calendar, say, or from another tab) since we loaded this week —
   * this does NOT block the save. It always proceeds (overwrites), and
   * just reports back whether a conflict was detected so the caller can
   * show a warning after the fact instead of an interrupting confirm
   * dialog.
   * @returns {Promise<boolean>} true if a conflicting edit elsewhere was detected
   */
  const checkConflict = async (activityId) => {
    if (!calendarAccessToken) return false;
    // Callers pass either a raw Google Calendar id (e.g. from the timeline
    // drag-editor's draftTimes, keyed by activity.id as-is) or an
    // already-normalized id (e.g. from handleAssignCategory, which receives
    // normalized ids from TimelineEditor's context menu) — match on
    // normalized id either way so a recurring occurrence's conflict check
    // doesn't silently no-op, then use the matched activity's own raw id
    // (never the possibly-normalized `activityId` we were passed) for the
    // actual Google Calendar lookup.
    const match = activities.find(
      (activity) => normalizeActivityId(activity.id) === normalizeActivityId(activityId)
    );
    if (!match?.updated) return false; // nothing to compare against
    try {
      const latest = await getActivity(calendarAccessToken, match.id);
      return !!(latest?.updated && latest.updated !== match.updated);
    } catch (e) {
      // If we can't check (e.g. the activity was deleted elsewhere), let the
      // actual update call surface that error instead of blocking here.
      return false;
    }
  };

  /** Toggles an activity's lock state via the backend, optimistically updating local state. */
  const handleToggleLock = async (activityId, locked) => {
    setLockedActivities((prev) => {
      const next = { ...prev };
      if (locked) next[activityId] = true;
      else delete next[activityId];
      return next;
    });
    try {
      await setActivityLocked(activityId, locked);
    } catch (e) {
      setError(`${locked ? "ล็อก" : "ปลดล็อก"}กิจกรรมไม่สำเร็จ: ${e.message}`);
      // Roll back by re-fetching the source of truth.
      fetchLockedActivities().then(setLockedActivities).catch(() => {});
    }
  };

  const handleAssignCategory = async (activityId, categoryId) => {
    if (lockedActivities[activityId]) {
      setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเปลี่ยนหมวดหมู่");
      return;
    }
    const conflict = await checkConflict(activityId);
    // Optimistic update so the dropdown/color feels instant.
    setActivityCategoryMap((prev) => {
      const next = { ...prev };
      if (categoryId) {
        next[activityId] = categoryId;
      } else {
        delete next[activityId];
      }
      return next;
    });
    try {
      await assignActivityCategory(activityId, categoryId);
      if (conflict) {
        setError("กิจกรรมนี้ถูกแก้ไขที่อื่นหลังจากโหลดข้อมูลล่าสุด — บันทึกทับข้อมูลนั้นแล้ว");
      }
    } catch (e) {
      setError(`บันทึกหมวดหมู่ไม่สำเร็จ: ${e.message}`);
      // Roll back by re-fetching the source of truth.
      fetchActivityCategoryMap().then(setActivityCategoryMap).catch(() => {});
    }
  };

  const handleCreateCategory = async (name, color) => {
    const newCategory = await createCategory(name, color);
    setCategories((prev) => [...prev, newCategory]);
    return newCategory;
  };

  /**
   * ลบหมวดหมู่ชีวิต — backend ลบ mapping ของกิจกรรมที่เคยผูกกับหมวดหมู่นี้
   * ให้ด้วย (ดู DELETE /api/categories/:id) จึงต้องเคลียร์ local state
   * ทั้งสองก้อนให้ตรงกัน: เอาหมวดหมู่ออกจาก `categories` และเอา entry
   * ที่ชี้มาที่ id นี้ออกจาก `activityCategoryMap` — ไม่งั้นกิจกรรมที่เคย
   * ผูกไว้จะยังโชว์สี/ชื่อหมวดหมู่ที่ถูกลบไปแล้วค้างอยู่จนกว่าจะ reload
   */
  const handleDeleteCategory = async (categoryId) => {
    await deleteCategory(categoryId);
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    setActivityCategoryMap((prev) => {
      const next = { ...prev };
      for (const activityId of Object.keys(next)) {
        if (next[activityId] === categoryId) delete next[activityId];
      }
      return next;
    });
  };

  /**
   * Opens the "add activity" modal prefilled with the actual current
   * date/time — the given `day` supplies the calendar date, but the clock
   * time always comes from `new Date()` at the moment the button is
   * pressed, so a new activity defaults to "now" instead of midnight.
   */
  const openAddActivity = (day) => {
    const now = new Date();
    const base = day || now;
    const combined = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      now.getHours(),
      now.getMinutes()
    );
    setModalDefaultDate(combined);
    setModalEditingActivity(null);
    setModalOpen(true);
  };

  const openEditActivity = (activity) => {
    if (lockedActivities[normalizeActivityId(activity.id)]) {
      setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนแก้ไขหรือลบ");
      return;
    }
    setModalDefaultDate(null);
    setModalEditingActivity(activity);
    setModalEditingAsSeries(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalEditingActivity(null);
    setModalDefaultDate(null);
    setModalEditingAsSeries(false);
  };

  /**
   * Saves an activity to Google Calendar (create or update), then assigns
   * its life-area category via our own backend, then reloads the week.
   *
   * Two-way sync conflict handling: if we're editing, we compare the
   * activity's "updated" timestamp against what the form was opened with.
   * If it changed — meaning the activity was edited elsewhere (directly in
   * Google Calendar, say) while our modal was open — we still save
   * (overwrite), per the "overwrite but warn" policy, and surface a
   * warning banner afterward instead of blocking with a confirm dialog.
   */
  const handleSaveActivity = async ({ activityBody, categoryId, tags, existingId, knownUpdated }) => {
    if (!calendarAccessToken) return;

    let conflictDetected = false;
    let savedActivity;
    if (existingId) {
      if (knownUpdated) {
        try {
          const latest = await getActivity(calendarAccessToken, existingId);
          if (latest?.updated && latest.updated !== knownUpdated) {
            conflictDetected = true;
          }
        } catch (e) {
          // Can't verify — proceed with the save and let any real error
          // surface from the update call itself.
        }
      }
      savedActivity = await updateActivity(calendarAccessToken, existingId, activityBody);
    } else {
      savedActivity = await createActivity(calendarAccessToken, activityBody);
    }

    // Sync the life-area assignment + tags to our own backend.
    if (savedActivity?.id) {
      // ต้อง normalize ก่อนเสมอ — savedActivity.id ที่ได้จาก updateActivity()
      // อาจเป็น instance id ของ recurring event (<baseId>_<timestamp>) เมื่อ
      // แก้ไข occurrence เดียวของ series ที่มีอยู่แล้ว ในขณะที่ทุกจุดอื่นที่
      // เก็บ/lookup activityCategoryMap ใช้ base id เท่านั้น (ดู id-utils.js)
      const normalizedId = normalizeActivityId(savedActivity.id);
      setActivityCategoryMap((prev) => {
        const next = { ...prev };
        if (categoryId) next[normalizedId] = categoryId;
        else delete next[normalizedId];
        return next;
      });
      try {
        await assignActivityCategory(normalizedId, categoryId);
      } catch (e) {
        setError(`บันทึกหมวดหมู่ไม่สำเร็จ: ${e.message}`);
      }

      const cleanTags = Array.isArray(tags) ? tags : [];
      setActivityTagMap((prev) => {
        const next = { ...prev };
        if (cleanTags.length > 0) next[normalizedId] = cleanTags;
        else delete next[normalizedId];
        return next;
      });
      try {
        await setActivityTags(normalizedId, cleanTags);
      } catch (e) {
        setError(`บันทึก tag ไม่สำเร็จ: ${e.message}`);
      }
    }

    if (conflictDetected) {
      setError(
        `กิจกรรม "${activityBody.summary}" ถูกแก้ไขที่อื่นหลังจากเปิดฟอร์มนี้ — บันทึกทับข้อมูลล่าสุดแล้ว`
      );
    }

    await loadActivities();
    refreshTagSearchIfActive();
  };

  /**
   * Batched save for AgendaView's inline timeline-editor (per row, ⚙
   * toggle): applies every dragged start/end change to Google Calendar at
   * once (one updateActivity per changed activity), only when the person
   * presses "บันทึก" — dragging itself never touches the network, per the
   * two-way sync conflict risk called out in the proposal. Each activity is
   * checked for a conflicting edit elsewhere (see checkConflict) right
   * before its update is sent; a conflict does not skip the save — it
   * overwrites and is reported afterward in a single combined warning.
   * Locked activities are skipped outright (the editor already prevents
   * dragging them, this is a defensive backstop).
   */
  const handleSaveTimes = async (changes) => {
    if (!calendarAccessToken || changes.length === 0) return;
    const failures = [];
    let anySkippedLocked = false;
    let anyConflicts = false;
    let tokenExpired = false;
    for (const { id, start, end } of changes) {
      // `id` here is the raw activity id (TimelineEditor's drag state keys
      // draftTimes off activity.id as-is) but lockedActivities is keyed by
      // normalized id — normalize before checking, or a locked recurring
      // occurrence's dragged time change would slip through.
      if (lockedActivities[normalizeActivityId(id)]) {
        anySkippedLocked = true;
        continue;
      }
      const conflict = await checkConflict(id);
      if (conflict) anyConflicts = true;
      try {
        await updateActivity(calendarAccessToken, id, {
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() }
        });
      } catch (e) {
        failures.push(`${id}: ${e.message}`);
        // Token expiring mid-batch means every remaining call in this loop
        // would fail the same way (and checkConflict's own getActivity call
        // would too) — stop immediately instead of burning through the rest
        // of `changes` with a token we already know is dead.
        if (e.message.includes("หมดอายุ")) {
          tokenExpired = true;
          break;
        }
      }
    }
    if (tokenExpired) {
      // Same reasoning as loadActivities' catch block above: only the
      // Google Calendar token died here, not the Firebase session — clear
      // just calendarAccessToken so the UI falls back to the "ยืนยันตัวตน
      // Google Calendar" reauth prompt (see render below) rather than
      // forcing a full sign-out/sign-in round-trip.
      setCalendarAccessToken(null);
      setError("สิทธิ์เข้าถึง Google Calendar หมดอายุระหว่างบันทึก — กรุณายืนยันตัวตนอีกครั้งแล้วลองอีกครั้ง");
      return;
    }
    if (failures.length > 0) {
      setError(`ปรับเวลาบางกิจกรรมไม่สำเร็จ — ${failures.join(", ")}`);
    } else if (anySkippedLocked && anyConflicts) {
      setError("บางกิจกรรมถูกล็อกไว้จึงข้ามไป และบางกิจกรรมถูกแก้ไขที่อื่น — บันทึกทับข้อมูลนั้นแล้ว");
    } else if (anySkippedLocked) {
      setError("บางกิจกรรมถูกล็อกไว้จึงไม่ถูกบันทึก");
    } else if (anyConflicts) {
      setError("บางกิจกรรมถูกแก้ไขที่อื่นหลังจากโหลดข้อมูลล่าสุด — บันทึกทับข้อมูลนั้นแล้ว");
    }
    await loadActivities();
    refreshTagSearchIfActive();
  };


  /** นับจำนวน instances ของ recurring series สำหรับ ActivityPopup */
  const handleFetchSeriesCount = async (recurringEventId) => {
    if (!calendarAccessToken || !recurringEventId) return null;
    try {
      const instances = await fetchRecurringInstances(calendarAccessToken, recurringEventId);
      return instances.length;
    } catch (e) {
      return null;
    }
  };

  /**
   * เปิด ActivityModal แก้ไขทั้งชุด recurring โดยโหลด master event
   * (recurringEventId) แล้วส่งเป็น initialActivity — Google Calendar
   * จะ apply การแก้ไขไปยังทุก occurrence ที่ยังไม่ได้ถูก override แยก
   */
  const handleEditSeries = async (activity) => {
    if (!calendarAccessToken) return;
    if (lockedActivities[normalizeActivityId(activity.id)]) {
      setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนแก้ไข");
      return;
    }
    try {
      const masterEvent = await getActivity(calendarAccessToken, activity.recurringEventId);
      setModalDefaultDate(null);
      setModalEditingActivity(masterEvent);
      setModalEditingAsSeries(true);
      setModalOpen(true);
    } catch (e) {
      setError("โหลดข้อมูลชุดกิจกรรมไม่สำเร็จ: " + e.message);
    }
  };

  const handleDeleteActivity = async (activityId) => {
    if (!calendarAccessToken) return;
    // activityId may be raw (e.g. from ActivityModal's initialActivity.id,
    // which keeps the recurring-instance suffix) or already-normalized
    // (from TimelineEditor's context menu) — normalize once up front for
    // every lookup against lockedActivities/activityCategoryMap (both keyed
    // by normalized id), but keep the original `activityId` for the actual
    // Google Calendar delete call, which needs the real instance id.
    const normalizedId = normalizeActivityId(activityId);
    if (lockedActivities[normalizedId]) {
      throw new Error("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนลบ");
    }
    await deleteActivity(calendarAccessToken, activityId);
    setActivityCategoryMap((prev) => {
      const next = { ...prev };
      delete next[normalizedId];
      return next;
    });
    try {
      await assignActivityCategory(normalizedId, null);
    } catch (e) {
      // Non-fatal — the activity itself is already gone from Google Calendar.
    }
    setActivityTagMap((prev) => {
      const next = { ...prev };
      delete next[normalizedId];
      return next;
    });
    try {
      await setActivityTags(normalizedId, []);
    } catch (e) {
      // Non-fatal — the activity itself is already gone from Google Calendar.
    }
    await loadActivities();
    refreshTagSearchIfActive();
  };

  /**
   * Deletes every occurrence of a recurring event in one call, by targeting
   * the series' recurringEventId (Google Calendar treats this as the
   * "master" event — deleting it removes the whole series, past and
   * future). Refuses if any *currently loaded* occurrence of the series is
   * locked, since a locked occurrence explicitly means "don't touch this
   * one" and a series-wide delete would remove it anyway; occurrences
   * outside the currently loaded week aren't checked (we simply don't have
   * their lock state without fetching every week), so this is a best-effort
   * guard rather than a guarantee.
   */
  const handleDeleteSeries = async (recurringEventId) => {
    if (!calendarAccessToken) return;
    const seriesActivityIds = activities
      .filter((a) => a.recurringEventId === recurringEventId || a.id === recurringEventId)
      .map((a) => a.id);
    // lockedActivities and activityCategoryMap are both keyed by normalized
    // id, but seriesActivityIds comes straight from raw Google Calendar
    // activity ids (recurring occurrences still carry their instance-id
    // suffix here) — normalize before checking/deleting, or a locked
    // occurrence's lock would go undetected and its category-map entry
    // would be left behind as a stale orphan after the series is deleted.
    const normalizedSeriesIds = seriesActivityIds.map(normalizeActivityId);
    const lockedInSeries = normalizedSeriesIds.filter((id) => lockedActivities[id]);
    if (lockedInSeries.length > 0) {
      throw new Error("บางกิจกรรมในชุดนี้ถูกล็อกไว้ — ปลดล็อกทั้งหมดก่อนลบทั้งชุด");
    }
    await deleteActivity(calendarAccessToken, recurringEventId);
    setActivityCategoryMap((prev) => {
      const next = { ...prev };
      for (const id of normalizedSeriesIds) delete next[id];
      return next;
    });
    await Promise.all(
      [...new Set(normalizedSeriesIds)].map((id) =>
        assignActivityCategory(id, null).catch(() => {
          // Non-fatal — the activities themselves are already gone from Google Calendar.
        })
      )
    );
    setActivityTagMap((prev) => {
      const next = { ...prev };
      for (const id of normalizedSeriesIds) delete next[id];
      return next;
    });
    await Promise.all(
      [...new Set(normalizedSeriesIds)].map((id) =>
        setActivityTags(id, []).catch(() => {
          // Non-fatal — the activities themselves are already gone from Google Calendar.
        })
      )
    );
    await loadActivities();
    refreshTagSearchIfActive();
  };

  /**
   * Builds the summary text for a duplicate: appends "(copy)" the first
   * time, then "(copy 2)", "(copy 3)", etc. if copies of the same base
   * name already exist — so a person duplicating the same activity
   * several times gets distinctly numbered copies instead of a pile of
   * identically named "(copy)" activities. Only ever strips/re-adds its
   * own "(copy...)" suffix, so duplicating a duplicate copies the
   * *original* base name forward rather than stacking suffixes into
   * "(copy) (copy)".
   *
   * Counts existing copies only from `activities` (the currently loaded
   * week) — an original or earlier copy sitting in a different week won't
   * be seen, so the numbering is a best-effort count within the visible
   * week rather than a guaranteed-unique count across the whole calendar.
   * The name is always editable afterward regardless, so a rare wrong
   * number here isn't destructive.
   * @param {string} originalSummary
   */
  const nextCopySummary = (originalSummary) => {
    const base = (originalSummary || "(ไม่มีชื่อ)").replace(/\s*\(copy(?:\s+\d+)?\)\s*$/, "");
    const copyPattern = new RegExp(
      `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(copy(?:\\s+(\\d+))?\\)$`
    );
    let highestExisting = 0; // 0 means no copy exists yet
    for (const existing of activities) {
      const match = (existing.summary || "").match(copyPattern);
      if (!match) continue;
      const n = match[1] ? parseInt(match[1], 10) : 1; // "(copy)" alone counts as copy #1
      if (n > highestExisting) highestExisting = n;
    }
    const nextN = highestExisting + 1;
    return nextN === 1 ? `${base} (copy)` : `${base} (copy ${nextN})`;
  };

  /**
   * Clones an activity onto the same day: same title (with a "(copy)" /
   * "(copy 2)" suffix appended — see nextCopySummary — so the duplicate
   * is distinguishable at a glance, though the name can be edited
   * afterward like any other), time range, and colorId (Google Calendar's
   * own field), plus the same life-area category assignment in our
   * backend. Locked state is deliberately NOT copied — a duplicate starts
   * out unlocked so it can be adjusted right away.
   */
  const handleDuplicateActivity = async (activity) => {
    if (!calendarAccessToken) return;
    const body = {
      summary: nextCopySummary(activity.summary),
      start: activity.start,
      end: activity.end
    };
    if (activity.colorId) body.colorId = activity.colorId;

    const created = await createActivity(calendarAccessToken, body);
    const normalizedCreatedId = created?.id ? normalizeActivityId(created.id) : null;

    const existingCategoryId = activityCategoryMap[normalizeActivityId(activity.id)] || null;
    if (normalizedCreatedId && existingCategoryId) {
      setActivityCategoryMap((prev) => ({ ...prev, [normalizedCreatedId]: existingCategoryId }));
      try {
        await assignActivityCategory(normalizedCreatedId, existingCategoryId);
      } catch (e) {
        setError(`ทำสำเนากิจกรรมสำเร็จ แต่บันทึกหมวดหมู่ของสำเนาไม่สำเร็จ: ${e.message}`);
      }
    }

    const existingTags = activityTagMap[normalizeActivityId(activity.id)] || [];
    if (normalizedCreatedId && existingTags.length > 0) {
      setActivityTagMap((prev) => ({ ...prev, [normalizedCreatedId]: existingTags }));
      try {
        await setActivityTags(normalizedCreatedId, existingTags);
      } catch (e) {
        setError(`ทำสำเนากิจกรรมสำเร็จ แต่บันทึก tag ของสำเนาไม่สำเร็จ: ${e.message}`);
      }
    }
    await loadActivities();
    refreshTagSearchIfActive();
  };

  /**
   * Moves an activity to a different calendar date, keeping its time-of-day
   * and duration unchanged. Runs through the same "overwrite but warn"
   * conflict check as other two-way-sync writes.
   * @param {string} activityId
   * @param {string} dateStr "YYYY-MM-DD" — the new date
   */
  const handleMoveActivityToDay = async (activityId, dateStr) => {
    if (!calendarAccessToken) return;
    // activityId arrives already normalized (TimelineEditor's context menu
    // normalizes before calling this) — lockedActivities is keyed by
    // normalized id, so that check is fine as-is. But `activities` holds
    // raw ids, and Google Calendar's update endpoint needs the real raw
    // instance id (not the normalized one) to patch the right occurrence —
    // so match on normalized id, then use the matched activity's own raw
    // `.id` for everything that talks to Google Calendar below.
    if (lockedActivities[activityId]) {
      setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนย้ายวัน");
      return;
    }
    const activity = activities.find((a) => normalizeActivityId(a.id) === activityId);
    if (!activity) return;
    const rawId = activity.id;

    const [y, m, d] = dateStr.split("-").map(Number);

    const oldStart = activityDate(activity.start);
    const oldEnd = activityDate(activity.end);
    const durationMs = oldEnd - oldStart;
    const newStart = new Date(y, m - 1, d, oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds());
    const newEnd = new Date(newStart.getTime() + durationMs);
    const body = { start: { dateTime: newStart.toISOString() }, end: { dateTime: newEnd.toISOString() } };

    const conflict = await checkConflict(rawId);
    await updateActivity(calendarAccessToken, rawId, body);
    if (conflict) {
      setError("กิจกรรมนี้ถูกแก้ไขที่อื่นหลังจากโหลดข้อมูลล่าสุด — บันทึกทับข้อมูลนั้นแล้ว");
    }
    await loadActivities();
    refreshTagSearchIfActive();
  };

  /**
   * Sets or clears a custom color override on an activity, using Google
   * Calendar's own native `colorId` field (see activity-colors.js) — no
   * backend changes needed since this doesn't touch our own db.json.
   *
   * Note: a life-area category's color always wins over this in the
   * display (see getDisplayColor) — ActivityPopup only shows these swatches
   * when the activity has no category assigned, so this should never fire
   * while a category is set. Google's API is documented to reset colorId to
   * the calendar's default when set to an empty string.
   * @param {string} activityId
   * @param {string|null} colorId null resets to default
   */
  const handleSetActivityColor = async (activityId, colorId) => {
    if (!calendarAccessToken) return;
    // Same normalized-vs-raw split as handleMoveActivityToDay above:
    // activityId arrives normalized, lockedActivities check is fine as-is,
    // but Google Calendar's update call needs the matched activity's raw id.
    if (lockedActivities[activityId]) {
      setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเปลี่ยนสี");
      return;
    }
    const activity = activities.find((a) => normalizeActivityId(a.id) === activityId);
    if (!activity) return;
    await updateActivity(calendarAccessToken, activity.id, { colorId: colorId || "" });
    await loadActivities();
    refreshTagSearchIfActive();
  };

  /**
   * กรองกิจกรรมด้วย tag search (OR — มี tag ใดอันหนึ่งตรงกับคำค้นหาอันใด
   * อันหนึ่งก็นับ) เมื่อกำลังค้นหาอยู่ (มี tagSearchTerms) ใช้
   * tagSearchResults (ดึงมาแบบกว้าง ±3 เดือน จาก effect ด้านบน) แทน
   * activities ของสัปดาห์ปัจจุบัน เพื่อให้เห็นผลลัพธ์ข้ามสัปดาห์ได้ ไม่ใช่
   * ถูกจำกัดอยู่แค่สัปดาห์ที่ agenda กำลังแสดงอยู่ ณ ขณะนั้น
   */
  const visibleActivities = useMemo(() => {
    if (tagSearchTerms.length === 0) return activities;
    const queries = tagSearchTerms.map((t) => t.toLowerCase());
    return tagSearchResults.filter((activity) => {
      const tags = activityTagMap[normalizeActivityId(activity.id)] || [];
      const lowerTags = tags.map((t) => t.toLowerCase());
      return queries.some((q) => lowerTags.some((tag) => tag.includes(q)));
    });
  }, [activities, activityTagMap, tagSearchTerms, tagSearchResults]);

  const isSearchingTags = tagSearchTerms.length > 0;

  return (
    <div className="app">
      {firebaseUser && (
        <header className="app-header">
          <div className="app-header-left">
            <img className="app-logo" src={BRAND_WORDMARK_SRC} alt="T.i.M.E.S." />
            <div className="mode-switch" role="tablist" aria-label="สลับโหมด">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "dashboard"}
                className={mode === "dashboard" ? "active" : ""}
                onClick={() => setMode("dashboard")}
              >
                Dashboard
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "reminder"}
                className={mode === "reminder" ? "active" : ""}
                onClick={() => setMode("reminder")}
              >
                ⏱ Reminder
              </button>
            </div>
            {mode === "dashboard" && (
              <>
                <button className="btn btn-outline" onClick={goToday}>
                  วันนี้
                </button>
                <div className="calendar-nav-pad" role="group" aria-label="ปุ่มนำทางปฏิทิน">
                  <button className="btn-icon calendar-nav-up" onClick={() => navigateDay(-1)} aria-label="วันก่อนหน้า">
                    ▲
                  </button>
                  <button className="btn-icon calendar-nav-left" onClick={() => navigateWeek(-1)} aria-label="สัปดาห์ก่อนหน้า">
                    ◀
                  </button>
                  <span className="calendar-nav-center" aria-hidden="true" />
                  <button className="btn-icon calendar-nav-right" onClick={() => navigateWeek(1)} aria-label="สัปดาห์ถัดไป">
                    ▶
                  </button>
                  <button className="btn-icon calendar-nav-down" onClick={() => navigateDay(1)} aria-label="วันถัดไป">
                    ▼
                  </button>
                </div>
                <h1 className="app-title">{formatWeekLabel(cursorDate)}</h1>
              </>
            )}
          </div>

          <div className="app-header-right">
            {mode === "dashboard" ? (
              <>
                <div className="tag-search-wrap">
                  <span className="tag-search-icon">🔍</span>
                  {tagSearchTerms.map((term) => (
                    <span key={term} className="tag-search-chip">
                      #{term}
                      <button
                        type="button"
                        className="tag-search-chip-remove"
                        onClick={() => setTagSearchTerms((prev) => prev.filter((t) => t !== term))}
                        aria-label={`ลบคำค้นหา ${term}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    className="tag-search-input"
                    placeholder={tagSearchTerms.length === 0 ? "ค้นหาด้วย tag..." : "เพิ่ม tag..."}
                    value={tagSearchDraft}
                    onChange={(e) => setTagSearchDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const trimmed = tagSearchDraft.trim();
                        setTagSearchDraft("");
                        if (!trimmed) return;
                        setTagSearchTerms((prev) =>
                          prev.some((t) => t.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
                        );
                      } else if (e.key === "Backspace" && tagSearchDraft === "" && tagSearchTerms.length > 0) {
                        setTagSearchTerms((prev) => prev.slice(0, -1));
                      }
                    }}
                    aria-label="ค้นหากิจกรรมด้วย tag — พิมพ์แล้วกด Enter เพื่อค้นหาได้หลาย tag พร้อมกัน"
                  />
                  {(tagSearchTerms.length > 0 || tagSearchDraft) && (
                    <button
                      type="button"
                      className="tag-search-clear"
                      onClick={() => {
                        setTagSearchTerms([]);
                        setTagSearchDraft("");
                      }}
                      aria-label="ล้างคำค้นหาทั้งหมด"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => openAddActivity(new Date(cursorDate))}
                  disabled={!calendarAccessToken}
                >
                  + เพิ่มกิจกรรม
                </button>
                <button className="btn btn-outline" onClick={handleLogout}>
                  ออกจากระบบ
                </button>
                <button
                  type="button"
                  className="btn-icon settings-open-btn"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="เปิดการตั้งค่า"
                  title="การตั้งค่า"
                >
                  ⚙️
                </button>
                {/* 🧪 DEV TEST BUTTON — ลบทิ้งก่อน deploy จริง
                    จำลอง token "ใกล้หมดอายุ" — ตั้ง calendarTokenExpiresAt
                    ให้เหลือ 4 นาทีจากตอนนี้ (น้อยกว่า
                    CALENDAR_TOKEN_WARNING_WINDOW_MS ที่ตั้งไว้ 5 นาที แต่
                    ยังมากกว่า 0) เพื่อให้ผ่านเงื่อนไขทั้งสองใน checkExpiry()
                    ด้านบนพร้อมกัน (msRemaining > 0 && msRemaining <= 5
                    นาที) แล้วเห็นการ์ดเตือนใกล้หมดอายุทันที โดยไม่ต้องรอ
                    token ใกล้หมดอายุจริง (~55 นาทีหลัง login) — เขียนลง
                    localStorage ควบคู่ด้วยเพื่อให้ค่าคงอยู่ข้าม refresh
                    เหมือนกับที่ setCalendarAccessToken ทำกับ token เอง
                    ไม่ได้เรียก setCalendarAccessToken ตรงนี้ เพราะต้องคง
                    calendarAccessToken เดิมไว้ (การ์ดนี้ต้องมี token อยู่
                    จริงถึงจะขึ้น — ดูเงื่อนไข render ด้านล่าง) ถ้าลบ token
                    ไปด้วยจะไปโดนการ์ด "หมดอายุแล้ว" แทน ไม่ใช่การ์ดนี้ */}
                <button
                  type="button"
                  className="btn-icon dev-test-btn"
                  onClick={() => {
                    const fakeExpiresAt = Date.now() + 4 * 60 * 1000;
                    setCalendarTokenExpiresAtState(fakeExpiresAt);
                    try {
                      window.localStorage.setItem(
                        CALENDAR_TOKEN_EXPIRES_AT_STORAGE_KEY,
                        String(fakeExpiresAt)
                      );
                    } catch {
                      // localStorage ไม่พร้อมใช้งาน — การ์ดยังขึ้นได้ปกติ
                      // จาก state ในตอนนี้ แค่ไม่รอดข้าม refresh เท่านั้น
                    }
                  }}
                  disabled={!calendarAccessToken}
                  aria-label="[ทดสอบ] จำลอง token ใกล้หมดอายุ"
                  title="[DEV] จำลอง token ใกล้หมดอายุ (เหลือ 4 นาที) — ลบปุ่มนี้ก่อน deploy จริง"
                >
                  ⏰
                </button>
              </>
            ) : null}
          </div>
        </header>
      )}

      {firebaseUser && mode === "dashboard" && <AnnouncementTicker message={ANNOUNCEMENT_MESSAGE} />}

      {/* Blocking heads-up for the Google Calendar token — covers two
          situations with the same visual treatment (dimmed backdrop +
          small banner, top-left corner), just different wording:
            1. Nearing expiry (tokenNearingExpiry): token still works for
               now, this is a proactive nudge (~5 min warning window).
            2. Already expired (!calendarAccessToken): token is dead,
               nothing works until renewed — same urgency, same banner.
          Blocks all other interaction until the person renews (no
          click-to-dismiss — renewing is the only way out, there's no
          "cancel" that makes sense here), same idea as .modal-overlay but
          escalated: letting the token die mid-action (e.g. mid-drag in
          TimelineEditor) risks losing unsaved work, so forcing a decision
          here is safer than leaving it easy to ignore.

          Persists across refresh in the "already expired" case: nothing
          here needs its own persistence, since it's purely derived from
          calendarAccessToken/tokenNearingExpiry, and calendarAccessToken
          itself is already cleared from localStorage the moment it
          expires (see setCalendarAccessToken above) — so !calendarAccessToken
          still evaluates true after a reload, no separate flag needed.

          Deliberately does NOT auto-open the Google popup from a timer —
          browsers block popups that aren't triggered by a direct click, so
          a button the person presses themselves is the only reliable way
          to renew either way. */}
      {firebaseUser && (tokenNearingExpiry || !calendarAccessToken) && mode === "dashboard" && (
        <div className="token-expiry-backdrop">
          <div
            className="token-expiry-banner"
            role="alertdialog"
            aria-label={
              calendarAccessToken
                ? "แจ้งเตือนสิทธิ์เข้าถึง Google Calendar ใกล้หมดอายุ"
                : "ต้องยืนยันตัวตนกับ Google Calendar อีกครั้ง"
            }
          >
            <span>
              {calendarAccessToken
                ? "สิทธิ์เข้าถึง Google Calendar ใกล้หมดอายุ — ต่ออายุตอนนี้เพื่อไม่ให้การใช้งานสะดุด"
                : "สิทธิ์เข้าถึง Google Calendar หมดอายุแล้ว — ยืนยันตัวตนอีกครั้งเพื่อดึงปฏิทินของคุณกลับมาแสดง"}
            </span>
            <button type="button" className="btn btn-outline token-expiry-renew-btn" onClick={handleReauthCalendar}>
              {calendarAccessToken ? "ต่ออายุตอนนี้" : "ยืนยันตัวตน"}
            </button>
          </div>
        </div>
      )}

      <main className="app-main">
        {mode === "reminder" && <ReminderMode />}

        {mode === "dashboard" && (
          <React.Fragment>
            {!authReady && (
              <div className="empty-state">
                <p>กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</p>
              </div>
            )}

            {authReady && !firebaseUser && (
              <div className="login-screen">
                <div className="login-card">
                  <img className="login-logo" src={BRAND_WORDMARK_SRC} alt="T.i.M.E.S." />
                  <h1 className="login-headline">สรุปชีวิตคุณ ทุกสัปดาห์</h1>
                  <p className="login-subtext">
                    เข้าสู่ระบบด้วย Google เพื่อ sync ปฏิทินของคุณโดยตรง — ปลอดภัย ไม่มีการเก็บสำเนาข้อมูลกิจกรรมไว้ที่อื่น
                  </p>
                  <button className="google-signin-btn" onClick={handleLogin}>
                    <svg className="google-signin-icon" viewBox="0 0 18 18" aria-hidden="true">
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                    </svg>
                    เข้าสู่ระบบด้วย Google
                  </button>
                </div>

                {/* App ยังไม่ผ่าน Google App Verification — Google จะโชว์
                    หน้าจอเตือน "แอปยังไม่ได้ยืนยัน" ระหว่าง OAuth consent
                    ซึ่งอาจทำให้ผู้ใช้ที่ไม่คุ้นเคยกดยกเลิกไปเฉยๆ การ์ด 3
                    ขั้นตอนนี้แสดงขั้นตอนที่ต้องกด ("ขั้นสูง" > "ไปที่ ...
                    (ไม่ปลอดภัย)" > "ดำเนินต่อ") เพื่อผ่านหน้าจอนั้นไปให้
                    signInWithGoogle() ทำงานต่อได้ รูปประกอบยังเป็น
                    placeholder รอใส่ภาพสกรีนช็อตจริงทีหลัง (STEP_GUIDE_IMAGES)
                    ปิดแล้วหายไปแค่ในเซสชันนี้ (ไม่บันทึกไว้) — รีเฟรชหน้าจะ
                    เห็นอีกครั้งเสมอ ตั้งใจไว้แบบนี้เพราะสถานะ verification
                    อาจเปลี่ยนไปเมื่อไหร่ก็ได้ ไม่อยากให้คนที่เคยปิดไปแล้ว
                    พลาดเห็นตอนที่ยังจำเป็นต้องรู้ */}
                {showLoginGuide && (
                  <div className="login-guide-overlay" role="dialog" aria-label="วิธีเข้าสู่ระบบ Google">
                    <div className="login-guide-panel">
                      <button
                        type="button"
                        className="login-guide-close"
                        onClick={() => setShowLoginGuide(false)}
                        aria-label="ปิด"
                      >
                        ✕
                      </button>
                      <div className="login-guide-header">
                        <h2 className="login-guide-title">
                          📌 วิธีเข้าใช้งานครั้งแรก (3 ขั้นตอนง่ายๆ)
                        </h2>
                        <p className="login-guide-note">
                          เนื่องจากระบบกำลังอยู่ในช่วงยื่นขอการยืนยันสิทธิ์จาก Google
                          ท่านสามารถกดข้ามตามขั้นตอนด้านล่างเพื่อเข้าใช้งานได้อย่างปลอดภัย
                        </p>
                      </div>

                      <div className="login-guide-steps">
                        {LOGIN_GUIDE_STEPS.map((step) => (
                          <div className="login-guide-step" key={step.number}>
                            {step.image ? (
                              <img
                                src={step.image}
                                alt={`ขั้นตอนที่ ${step.number}`}
                                className="login-guide-step-image"
                              />
                            ) : (
                              <div className="login-guide-step-placeholder">
                                รูปประกอบ Step {step.number}
                              </div>
                            )}
                            <p>
                              <strong>Step {step.number}:</strong> {step.text}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="login-guide-footnote">
                        <strong>📌 หมายเหตุ:</strong> ทำขั้นตอนเหล่านี้แค่ครั้งแรกที่เข้าสู่ระบบเท่านั้น
                        เมื่อเข้าสู่ระบบสำเร็จแล้ว ครั้งถัดไปจะเข้าหน้าแอปได้ทันทีโดยไม่ขึ้นหน้าเตือนนี้อีก
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Signed in to Firebase, but the Google Calendar consent hasn't
                happened yet (first sign-in denied Calendar scope), OR its
                token specifically expired mid-session — either way there's
                no calendarAccessToken to work with. Rendered as an
                empty-state placeholder in the main content area; the
                *actionable* blocking prompt (backdrop + banner asking to
                re-auth) is handled separately below, right before <main>,
                using the exact same token-expiry-backdrop/banner styling as
                the "nearing expiry" warning — see that block's comment for
                why both share one visual treatment. */}
            {firebaseUser && !calendarAccessToken && (
              <div className="empty-state">
                <p>ต้องยืนยันตัวตนกับ Google Calendar อีกครั้งเพื่อดึงปฏิทินของคุณมาแสดง</p>
              </div>
            )}

            {firebaseUser && error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            {firebaseUser && loading && (
              <div className="loading-banner" role="status" aria-live="polite">
                กำลังโหลด...
              </div>
            )}
            {firebaseUser && isSearchingTags && !tagSearchLoading && (
              <div className="tag-search-status">
                พบ {visibleActivities.length} กิจกรรมที่มี tag ตรงกับ{" "}
                {tagSearchTerms.map((t) => `#${t}`).join(" หรือ ")} (ค้นหาช่วง ±3 เดือนจากวันนี้)
              </div>
            )}

            {firebaseUser && calendarAccessToken && (
              <div className="dashboard">
                <div className="summary-column">
                  <div className={`flip-card${expandedDate ? " is-flipped" : ""}`}>
                    <div className="flip-face flip-face-summary">
                      <WeeklySummaryPanel
                        anchorDate={cursorDate}
                        summary={summary}
                        loading={summaryLoading}
                        error={summaryError}
                        onSelectDay={openDay}
                        categories={categories}
                      />
                    </div>
                    <div className="flip-face flip-face-timeline">
                      <MiniTimelinePanel
                        activities={activities}
                        categories={categories}
                        activityCategoryMap={activityCategoryMap}
                        expandedDate={expandedDate}
                        onClose={closeDay}
                        onEditActivity={openEditActivity}
                      />
                    </div>
                  </div>
                </div>
                {isSearchingTags ? (
                  <TagSearchResults
                    activities={visibleActivities}
                    categories={categories}
                    activityCategoryMap={activityCategoryMap}
                    activityTagMap={activityTagMap}
                    searchTerms={tagSearchTerms}
                    loading={tagSearchLoading}
                    error={tagSearchError}
                    onEditActivity={openEditActivity}
                  />
                ) : (
                  <AgendaView
                    anchorDate={cursorDate}
                    activities={visibleActivities}
                    categories={categories}
                    activityCategoryMap={activityCategoryMap}
                    activityTagMap={activityTagMap}
                    expandedDate={expandedDate}
                    onAddActivity={openAddActivity}
                    onSelectDay={openDay}
                    onAssignCategory={handleAssignCategory}
                    onEditActivity={openEditActivity}
                    onSaveTimes={handleSaveTimes}
                    lockedActivities={lockedActivities}
                    onToggleLock={handleToggleLock}
                    onDeleteActivity={handleDeleteActivity}
                    onDeleteSeries={handleDeleteSeries}
                    onDuplicateActivity={handleDuplicateActivity}
                    onMoveActivityToDay={handleMoveActivityToDay}
                    onSetActivityColor={handleSetActivityColor}
                    onEditSeries={handleEditSeries}
                    onFetchSeriesCount={handleFetchSeriesCount}
                  />
                )}
              </div>
            )}
          </React.Fragment>
        )}
      </main>

      <ActivityModal
        // key เปลี่ยนตามกิจกรรมที่กำลังแก้ไข (หรือวันที่ที่กำลังจะสร้างใหม่)
        // เพื่อบังคับให้ React unmount/remount ActivityModal ทุกครั้งที่เปิด
        // กิจกรรมคนละตัว หรือกดปุ่ม "+ เพิ่มกิจกรรม" ของคนละวัน — ถ้าไม่มี key
        // นี้ ActivityModal จะถูก mount แค่ครั้งเดียวตลอดอายุแอป (เพราะ render
        // อยู่ตำแหน่งเดิมเสมอ แค่ return null ตอน closed) ทำให้ทุก
        // useState(initialActivity?.xxx) ข้างในอ่านค่าเริ่มต้นแค่ครั้งแรกที่แอป
        // โหลด แล้วค้างค่าไว้ตลอด — เปิดแก้ไขกิจกรรมไหนทีหลังก็เห็นฟอร์มว่าง
        // เหมือนสร้างใหม่ทุกครั้ง, และกดเพิ่มกิจกรรมของวันไหนทีหลังก็เห็นวันที่
        // ของครั้งแรกสุดที่เปิดฟอร์มค้างอยู่เสมอ (เดิม key ตอนสร้างใหม่เป็น
        // ค่าคงที่ "new" เฉยๆ ไม่ผูกกับ modalDefaultDate เลย จึงไม่ remount
        // เมื่อกดปุ่มเพิ่มกิจกรรมของวันอื่น)
        key={modalEditingActivity?.id || `new-${toDateInputValue(modalDefaultDate || new Date())}`}
        open={modalOpen}
        defaultDate={modalDefaultDate}
        initialActivity={modalEditingActivity}
        isSeries={modalEditingAsSeries}
        categories={categories}
        activityCategoryMap={activityCategoryMap}
        activityTagMap={activityTagMap}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={handleDeleteCategory}
        onSave={handleSaveActivity}
        onDelete={handleDeleteActivity}
        onClose={closeModal}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
      />
    </div>
  );
}
