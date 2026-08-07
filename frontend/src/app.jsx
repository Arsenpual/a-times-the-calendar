import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import AgendaView from "./components/agenda-view.jsx";
import TagSearchResults from "./components/tag-search-results.jsx";
import WeeklySummaryPanel from "./components/weekly-summary-panel.jsx";
import MiniTimelinePanel from "./components/mini-timeline-panel.jsx";
import ActivityModal from "./components/activity-modal.jsx";
import ReminderModeMockup from "./components/reminder-mode-mockup.jsx";
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
import { getWeekRange, formatWeekLabel, activityDate } from "./date-utils.js";
import { normalizeActivityId } from "./id-utils.js";

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
  // "dashboard" = ปฏิทินปกติ (ของจริง), "reminder" = โหมด Reminder ซึ่งยังเป็น
  // แค่ mockup ล้วนๆ ตอนนี้ (ดู ReminderModeMockup — ยังไม่มี state/logic จริง
  // อยู่เบื้องหลังเลย รอ commit เรื่อง Cloud Messaging/Pomodoro ตามที่ระบุใน
  // firebase-migration-plan.md ระยะ 4 ก่อน) แยก state ออกมาต่างหากจาก
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
  const [calendarAccessToken, setCalendarAccessToken] = useState(null);
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
      const [rangeStart, rangeEnd] = getWeekRange(cursorDate);
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
    if (tagSearchResults.length > 0) return; // ดึงไปแล้ว ไม่ต้องซ้ำ

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
  }, [tagSearchTerms, calendarAccessToken, tagSearchResults.length]);

  // เคลียร์ผลค้นหาทิ้งเมื่อไม่มีคำค้นหาเหลืออยู่แล้ว (กันผลเก่าค้าง ถ้า
  // ผู้ใช้ลบคำค้นหาหมดแล้วพิมพ์ใหม่ทีหลัง จะได้ไปดึงข้อมูลรอบใหม่)
  useEffect(() => {
    if (tagSearchTerms.length === 0) {
      setTagSearchResults([]);
      setTagSearchError(null);
    }
  }, [tagSearchTerms]);

  // Recompute the weekly summary from our backend whenever the activities
  // for the visible week (or their category assignments) change.
  useEffect(() => {
    if (!firebaseUser || activities.length === 0) {
      setSummary(null);
      return;
    }
    setSummaryLoading(true);
    setSummaryError(null);
    const payload = activities
      .map((activity) => {
        const start = activityDate(activity.start);
        const end = activityDate(activity.end);
        if (!start || !end) return null;
        return { id: activity.id, summary: activity.summary, start: start.toISOString(), end: end.toISOString() };
      })
      .filter(Boolean);

    fetchWeeklySummary(payload)
      .then(setSummary)
      .catch((e) => setSummaryError(e.message))
      .finally(() => setSummaryLoading(false));
  }, [firebaseUser, activities, activityCategoryMap]);

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

  const navigateWeek = (direction) => {
    const next = new Date(cursorDate);
    next.setDate(next.getDate() + direction * 7);
    setCursorDate(next);
  };

  const goToday = () => setCursorDate(new Date());

  // Reset the open timeline day whenever the visible week changes, since a
  // day from last week's selection wouldn't have activities loaded anyway.
  useEffect(() => {
    setExpandedDate(null);
  }, [cursorDate]);

  const openDay = (date) => setExpandedDate(date);

  const closeDay = () => setExpandedDate(null);

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
  };

  /**
   * Clones an activity onto the same day: same title, time range, and
   * colorId (Google Calendar's own field), plus the same life-area
   * category assignment in our backend. Locked state is deliberately NOT
   * copied — a duplicate starts out unlocked so it can be adjusted right
   * away.
   */
  const handleDuplicateActivity = async (activity) => {
    if (!calendarAccessToken) return;
    const body = {
      summary: activity.summary || "(ไม่มีชื่อ)",
      start: activity.start,
      end: activity.end
    };
    if (activity.colorId) body.colorId = activity.colorId;

    const created = await createActivity(calendarAccessToken, body);

    const existingCategoryId = activityCategoryMap[normalizeActivityId(activity.id)] || null;
    if (created?.id && existingCategoryId) {
      setActivityCategoryMap((prev) => ({ ...prev, [created.id]: existingCategoryId }));
      try {
        await assignActivityCategory(created.id, existingCategoryId);
      } catch (e) {
        setError(`ทำสำเนากิจกรรมสำเร็จ แต่บันทึกหมวดหมู่ของสำเนาไม่สำเร็จ: ${e.message}`);
      }
    }

    const existingTags = activityTagMap[normalizeActivityId(activity.id)] || [];
    if (created?.id && existingTags.length > 0) {
      setActivityTagMap((prev) => ({ ...prev, [created.id]: existingTags }));
      try {
        await setActivityTags(created.id, existingTags);
      } catch (e) {
        setError(`ทำสำเนากิจกรรมสำเร็จ แต่บันทึก tag ของสำเนาไม่สำเร็จ: ${e.message}`);
      }
    }
    await loadActivities();
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
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-logo">
            <span style={{ color: "#1557B0" }}>ปฏิทิน</span>
            <span style={{ color: "#B71C1C" }}>ของ</span>
            <span style={{ color: "#F29900" }}>ฉัน</span>
          </span>
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
              title="ยังเป็นแค่ mockup — ใช้งานจริงไม่ได้"
            >
              ⏱ Reminder
            </button>
          </div>
          {mode === "dashboard" && firebaseUser && (
            <>
              <button className="btn btn-outline" onClick={goToday}>
                วันนี้
              </button>
              <button className="btn-icon" onClick={() => navigateWeek(-1)} aria-label="สัปดาห์ก่อนหน้า">
                ‹
              </button>
              <button className="btn-icon" onClick={() => navigateWeek(1)} aria-label="สัปดาห์ถัดไป">
                ›
              </button>
              <h1 className="app-title">{formatWeekLabel(cursorDate)}</h1>
            </>
          )}
        </div>

        <div className="app-header-right">
          {mode === "dashboard" && firebaseUser ? (
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
            </>
          ) : mode === "dashboard" ? (
            <button className="btn btn-primary" onClick={handleLogin} disabled={!authReady}>
              เข้าสู่ระบบด้วย Google
            </button>
          ) : null}
        </div>
      </header>

      <main className="app-main">
        {mode === "reminder" && <ReminderModeMockup />}

        {mode === "dashboard" && (
          <React.Fragment>
            {!authReady && (
              <div className="empty-state">
                <p>กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</p>
              </div>
            )}

            {authReady && !firebaseUser && (
              <div className="empty-state">
                <p>เข้าสู่ระบบด้วย Google เพื่อดึงปฏิทินของคุณมาแสดง</p>
              </div>
            )}

            {/* Signed in to Firebase, but the separate Google Calendar consent
                hasn't happened yet (first sign-in denied Calendar scope) or its
                token specifically expired mid-session (see loadActivities'
                catch block above, which clears calendarAccessToken on a 401
                without touching firebaseUser) — offer just the Calendar re-auth
                popup instead of a full logout/login round-trip. */}
            {firebaseUser && !calendarAccessToken && (
              <div className="empty-state">
                <p>ต้องยืนยันตัวตนกับ Google Calendar อีกครั้งเพื่อดึงปฏิทินของคุณมาแสดง</p>
                <button className="btn btn-primary" onClick={handleReauthCalendar}>
                  ยืนยันตัวตน Google Calendar
                </button>
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
        // key เปลี่ยนตามกิจกรรมที่กำลังแก้ไข (หรือ "new" ตอนสร้างใหม่) เพื่อบังคับให้
        // React unmount/remount ActivityModal ทุกครั้งที่เปิดกิจกรรมคนละตัว —
        // ถ้าไม่มี key นี้ ActivityModal จะถูก mount แค่ครั้งเดียวตลอดอายุแอป
        // (เพราะ render อยู่ตำแหน่งเดิมเสมอ แค่ return null ตอน closed) ทำให้ทุก
        // useState(initialActivity?.xxx) ข้างในอ่านค่าเริ่มต้นแค่ครั้งแรกที่แอปโหลด
        // (ตอนนั้น initialActivity ยังเป็น null) แล้วค้างค่าว่างไว้ตลอด — เปิดแก้ไข
        // กิจกรรมไหนทีหลังก็เห็นฟอร์มว่างเหมือนสร้างใหม่ทุกครั้ง
        key={modalEditingActivity?.id || "new"}
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
    </div>
  );
}
