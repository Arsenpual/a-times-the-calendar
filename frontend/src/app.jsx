import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import loginGuideStep1 from "../public/login-guide-step1.jpg";
import loginGuideStep2 from "../public/login-guide-step2.jpg";
import loginGuideStep3 from "../public/login-guide-step3.jpg";
import ActivityModeWeekSpine from "./components/activity-mode-week-spine.jsx";
import TagSearchResults from "./components/tag-search-results.jsx";
import WeeklySummaryPanel from "./components/weekly-summary-panel.jsx";
import MiniTimelinePanel from "./components/mini-timeline-panel.jsx";
import ActivityModal from "./components/activity-modal.jsx";
import ReminderMode from "./components/reminder-mode.jsx";
import AnnouncementTicker from "./components/announcement-ticker.jsx";
import SettingsDrawer from "./components/settings-drawer.jsx";
import { formatWeekLabel, toDateInputValue } from "./date-utils.js";
import { normalizeActivityId } from "./id-utils.js";
import { useAuth } from "./hooks/use-auth.js";
import { useWeekNavigation } from "./hooks/use-week-navigation.js";
import { useCalendarData } from "./hooks/use-calendar-data.js";
import { useTagSearch } from "./hooks/use-tag-search.js";
import { useActivityModal } from "./hooks/use-activity-modal.js";
import { useActivityMutations } from "./hooks/use-activity-mutations.js";
import { useActivityOnboarding } from "./hooks/use-activity-onboarding.js";
import ActivityModeMockupPreview from "./components/activity-mode-mockup-preview.jsx";

const ACTIVITY_MODE_MOCKUPS = Object.entries(import.meta.glob("./components/activity-mode-*-mockup.jsx", { eager: true }))
  .map(([path, module]) => {
    const id = (path.split("/").pop() || "mockup.jsx").replace(/\.jsx$/, "");
    return { id, label: id.replace(/^activity-mode-/, "").replace(/-mockup$/, "").replace(/-/g, " "), Component: module.default };
  })
  .filter((mockup) => typeof mockup.Component === "function");

// Hardcoded broadcast message shown in the scrolling ticker below the
// header, in both activity and reminder mode — see AnnouncementTicker. Not
// dismissible and not fetched from a backend, so updating it means editing
// this string and redeploying. Set to "" (or null) to hide the ticker
// entirely without removing the component from the tree.
const ANNOUNCEMENT_MESSAGE = "🎉 อัปเดตเวอร์ชันใหม่ — เพิ่มการรองรับกิจกรรมข้ามเที่ยงคืน และปรับปรุงการแสดงผลไทม์ไลน์";
const BRAND_WORDMARK_LIGHT_SRC = `${import.meta.env.BASE_URL}logo/times-wordmark.svg`;
const BRAND_WORDMARK_DARK_SRC = `${import.meta.env.BASE_URL}logo/times-wordmark-dark.svg`;
const WEEK_SPINE_HOURS_PER_CELL_KEY = "times-week-spine-hours-per-cell";

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
  return new URLSearchParams(window.location.search).has("activity-mode-mockup")
    ? <ActivityModeMockupPreview mockups={ACTIVITY_MODE_MOCKUPS} />
    : <MainApp />;
}

/**
 * State/effects previously all lived directly in this component (~1650
 * lines). Now composed from 6 hooks under ./hooks/, split by concern:
 *   - useAuth: Firebase session + Google Calendar OAuth token
 *   - useWeekNavigation: cursorDate/expandedDate, mode, theme, small UI toggles
 *   - useCalendarData: activities/categories/tags/locks/summary (reads)
 *   - useTagSearch: tag search terms + wide-range fetch
 *   - useActivityModal: ActivityModal open/close state
 *   - useActivityMutations: every write handler (save/delete/move/etc.)
 *
 * These hooks are NOT fully independent of each other — see each hook's
 * own doc comment. useCalendarData/useTagSearch/useActivityModal/
 * useActivityMutations all take calendarAccessToken (from useAuth) and a
 * shared setError as inputs, and useActivityMutations additionally reads
 * from and writes into useCalendarData's state directly. This mirrors the
 * actual shape of the app (nearly every write touches Google Calendar,
 * local optimistic state, and triggers a reload) rather than forcing an
 * artificial isolation that would just relocate the coupling into more
 * prop-drilling. App.jsx's job is now purely to wire these hooks together
 * and render.
 */
function MainApp() {
  const [isActivityReading, setIsActivityReading] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [weekSpineHoursPerCell, setWeekSpineHoursPerCell] = useState(() => {
    try {
      const savedValue = Number(window.localStorage.getItem(WEEK_SPINE_HOURS_PER_CELL_KEY));
      return [1, 2, 4].includes(savedValue) ? savedValue : 2;
    } catch {
      return 2;
    }
  });
  const accountMenuRef = useRef(null);
  useEffect(() => {
    try {
      window.localStorage.setItem(WEEK_SPINE_HOURS_PER_CELL_KEY, String(weekSpineHoursPerCell));
    } catch {
      // The default grid remains available when local storage is unavailable.
    }
  }, [weekSpineHoursPerCell]);
  useEffect(() => {
    const openMockupMode = (event) => {
      const target = event.target;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable || !event.ctrlKey || !event.altKey || event.code !== "KeyW") return;
      event.preventDefault();
      const url = new URL(window.location.href);
      url.searchParams.set("activity-mode-mockup", "1");
      window.open(url.toString(), "times-activity-mode-mockups", `popup=yes,width=${window.screen.availWidth},height=${window.screen.availHeight}`)?.focus();
    };
    window.addEventListener("keydown", openMockupMode);
    return () => window.removeEventListener("keydown", openMockupMode);
  }, []);
  const auth = useAuth();
  const {
    firebaseUser,
    authReady,
    error,
    setError,
    calendarAccessToken,
    setCalendarAccessToken,
    calendarTokenExpiresAt,
    setCalendarTokenExpiresAtState,
    tokenNearingExpiry,
    handleLogin,
    handleLogout: authHandleLogout,
    handleReauthCalendar,
    CALENDAR_TOKEN_EXPIRES_AT_STORAGE_KEY
  } = auth;

  // The archive is per-account local visibility state. Keep one shared set
  // here so every Activity Mode surface reads the same filtered data.
  const [archivedActivityIds, setArchivedActivityIds] = useState(() => new Set());
  useEffect(() => {
    const archiveStorageKey = `times-activity-archive:${firebaseUser?.uid || "guest"}`;
    const refreshArchivedActivityIds = () => {
      try {
        const archive = JSON.parse(window.localStorage.getItem(archiveStorageKey) || "[]");
        setArchivedActivityIds(new Set(
          (Array.isArray(archive) ? archive : [])
            .flatMap((item) => item.calendarId ? [item.calendarId, normalizeActivityId(item.calendarId)] : [])
        ));
      } catch {
        setArchivedActivityIds(new Set());
      }
    };
    refreshArchivedActivityIds();
    const onArchiveChanged = (event) => {
      if (event.detail?.userId === firebaseUser?.uid) refreshArchivedActivityIds();
    };
    window.addEventListener("times-activity-archive-changed", onArchiveChanged);
    return () => window.removeEventListener("times-activity-archive-changed", onArchiveChanged);
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!error) return undefined;
    const dismissIfOutsideToast = (event) => {
      if (event.target instanceof Element && event.target.closest(".error-banner")) return;
      setError(null);
    };
    document.addEventListener("pointerdown", dismissIfOutsideToast, true);
    document.addEventListener("focusin", dismissIfOutsideToast, true);
    return () => {
      document.removeEventListener("pointerdown", dismissIfOutsideToast, true);
      document.removeEventListener("focusin", dismissIfOutsideToast, true);
    };
  }, [error, setError]);

  const nav = useWeekNavigation();
  const {
    mode,
    setMode,
    settingsOpen,
    setSettingsOpen,
    showLoginGuide,
    setShowLoginGuide,
    theme,
    setTheme,
    reminderTimelineColors,
    setReminderTimelineColors,
    cursorDate,
    expandedDate,
    navigateWeek,
    navigateDay,
    goToday,
    focusDate,
    openDay,
    closeDay
  } = nav;
  const brandWordmarkSrc = theme === "dark" ? BRAND_WORDMARK_DARK_SRC : BRAND_WORDMARK_LIGHT_SRC;

  const calendarData = useCalendarData({ calendarAccessToken, setCalendarAccessToken, firebaseUser, cursorDate, setError, archivedActivityIds });
  const {
    activities,
    setActivities,
    loading,
    categories,
    setCategories,
    activityCategoryMap,
    setActivityCategoryMap,
    activityTagMap,
    setActivityTagMap,
    lockedActivities,
    setLockedActivities,
    summary,
    summaryLoading,
    summaryError,
    loadActivities,
    resetOnLogout
  } = calendarData;

  const handleManualCalendarSync = useCallback(async () => {
    if (!calendarAccessToken) {
      setError("สิทธิ์ Google Calendar หมดอายุแล้ว — ยืนยันตัวตนเมื่อต้องการดึงกิจกรรม");
      return;
    }
    try {
      await loadActivities();
    } catch {
      // loadActivities already exposes a recoverable error and clears an
      // expired token. Keep the modal usable after a failed manual sync.
    }
  }, [calendarAccessToken, loadActivities, setError]);

  const tagSearch = useTagSearch({ calendarAccessToken, setCalendarAccessToken });
  const {
    tagSearchTerms,
    setTagSearchTerms,
    tagSearchDraft,
    setTagSearchDraft,
    tagSearchResults,
    tagSearchLoading,
    tagSearchError,
    refreshTagSearchIfActive,
    isSearchingTags
  } = tagSearch;

  const activityModal = useActivityModal({ calendarAccessToken, lockedActivities, setError });
  const {
    modalOpen,
    modalDefaultDate,
    modalDefaultEnd,
    modalDefaultTitle,
    modalInitialWarning,
    modalMissingFields,
    modalEditingActivity,
    modalEditingAsSeries,
    openAddActivity,
    openEditActivity,
    openEditActivityById,
    closeModal,
    handleEditSeries
  } = activityModal;

  const mutations = useActivityMutations({
    calendarAccessToken,
    setCalendarAccessToken,
    activities,
    setActivities,
    activityCategoryMap,
    setActivityCategoryMap,
    activityTagMap,
    setActivityTagMap,
    lockedActivities,
    setLockedActivities,
    setCategories,
    loadActivities,
    refreshTagSearchIfActive,
    setError
  });
  const {
    handleToggleLock,
    handleAssignCategory,
    handleCreateCategory,
    handleDeleteCategory,
    handleSaveActivity,
    handleSaveTimes,
    handleFetchSeriesCount,
    handleDeleteActivity,
    handleDeleteSeries,
    handleDuplicateActivity,
    handleMoveActivityToDay
  } = mutations;

  const { onboardingActivities, onboardingCategoryMap } = useActivityOnboarding({
    mode,
    firebaseUser,
    categories,
    cursorDate,
    activities
  });

  // handleLogout composes both hooks' own cleanup — useAuth only knows
  // how to sign out of Firebase, useCalendarData only knows how to clear
  // the data it owns; neither hook has a reference to the other, so this
  // composition has to happen here.
  const handleLogout = async () => {
    // Reset the shell first so Reminder Mode unmounts immediately (stopping
    // its due-checking/timer effects) rather than leaving its local UI on
    // screen while Firebase finishes the asynchronous sign-out.
    setAccountMenuOpen(false);
    setSettingsOpen(false);
    setIsActivityReading(false);
    setMode("activity");
    closeModal();
    closeDay();
    setTagSearchTerms([]);
    setTagSearchDraft("");
    await authHandleLogout();
    resetOnLogout();
  };

  /**
   * กรองกิจกรรมด้วย tag search (OR — มี tag ใดอันหนึ่งตรงกับคำค้นหาอันใด
   * อันหนึ่งก็นับ) เมื่อกำลังค้นหาอยู่ (มี tagSearchTerms) ใช้
   * tagSearchResults (ดึงมาแบบกว้าง ±3 เดือน จาก useTagSearch) แทน
   * activities ของสัปดาห์ปัจจุบัน เพื่อให้เห็นผลลัพธ์ข้ามสัปดาห์ได้
   */
  const visibleActivities = useMemo(() => {
    const isArchived = (activity) => archivedActivityIds.has(activity.id) || archivedActivityIds.has(normalizeActivityId(activity.id));
    if (tagSearchTerms.length === 0) return [...activities, ...onboardingActivities].filter((activity) => !isArchived(activity));
    const queries = tagSearchTerms.map((t) => t.toLowerCase());
    return tagSearchResults.filter((activity) => {
      if (isArchived(activity)) return false;
      const tags = activityTagMap[normalizeActivityId(activity.id)] || [];
      const lowerTags = tags.map((t) => t.toLowerCase());
      return queries.some((q) => lowerTags.some((tag) => tag.includes(q)));
    });
  }, [activities, activityTagMap, tagSearchTerms, tagSearchResults, onboardingActivities, archivedActivityIds]);
  const displayedActivityCategoryMap = useMemo(
    () => ({ ...activityCategoryMap, ...onboardingCategoryMap }),
    [activityCategoryMap, onboardingCategoryMap]
  );


  useEffect(() => {
    if (mode !== "activity") setIsActivityReading(false);
  }, [mode]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const closeAccountMenu = (event) => {
      if (!(event.target instanceof Node) || !accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeAccountMenu, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeAccountMenu, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  const handleActivityDashboardScroll = (event) => {
    const dashboard = event.currentTarget;
    // A small downward scroll is enough to enter reading mode. The separate
    // return threshold prevents the header from flickering as it collapses.
    setIsActivityReading((reading) => reading
      ? dashboard.scrollTop > 4
      : dashboard.scrollTop >= 12
    );
  };

  return (
    <div className={`app app--${mode}${isActivityReading ? " is-reading" : ""}`}>
      {firebaseUser && (
        <header className="app-header">
          <div className="app-header-left">
            <img className="app-logo" src={brandWordmarkSrc} alt="T.i.M.E.S." />
            <div className="mode-switch" role="tablist" aria-label="สลับโหมด">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "activity"}
                className={mode === "activity" ? "active" : ""}
                onClick={() => setMode("activity")}
              >
                Activity
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "reminder"}
                className={mode === "reminder" ? "active" : ""}
                onClick={() => setMode("reminder")}
              >
                Reminder
              </button>
            </div>
            {mode === "activity" && (
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
            {mode === "activity" ? (
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
                {/* 🧪 DEV TEST BUTTON — เดิมไม่มี guard ใดๆ ทำให้ปุ่มนี้ขึ้น
                    ในโปรดักชันจริงด้วย ตอนนี้ห่อด้วย import.meta.env.DEV
                    (Vite inject ให้เป็น false เสมอใน build production —
                    ทั้ง `npm run build` และ `npm run preview` ตัด branch
                    นี้ทิ้งไปเลยตอน tree-shaking ไม่ใช่แค่ซ่อนด้วย CSS) จึง
                    ไม่มีทางหลุดไป deploy จริงได้อีกไม่ว่าจะลืมลบเองหรือไม่
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
                {import.meta.env.DEV && (
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
                    title="[DEV] จำลอง token ใกล้หมดอายุ (เหลือ 4 นาที) — ปุ่มนี้แสดงเฉพาะ dev build เท่านั้น"
                  >
                    ⏰
                  </button>
                )}
              </>
            ) : null}
            <div className="account-menu-wrap" ref={accountMenuRef}>
              <button
                type="button"
                className="account-menu-trigger"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-label="เปิดเมนูบัญชีผู้ใช้"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                {firebaseUser.photoURL
                  ? <img src={firebaseUser.photoURL} alt="" referrerPolicy="no-referrer" />
                  : <span className="account-menu-avatar-fallback" aria-hidden="true">{(firebaseUser.displayName || firebaseUser.email || "U").trim().charAt(0).toUpperCase()}</span>}
              </button>
              {accountMenuOpen && (
                <div className="account-menu" role="menu">
                  <div className="account-menu-identity">
                    {firebaseUser.photoURL
                      ? <img src={firebaseUser.photoURL} alt="" referrerPolicy="no-referrer" />
                      : <span className="account-menu-avatar-fallback" aria-hidden="true">{(firebaseUser.displayName || firebaseUser.email || "U").trim().charAt(0).toUpperCase()}</span>}
                    <div>
                      {firebaseUser.displayName && <strong>{firebaseUser.displayName}</strong>}
                      <span>{firebaseUser.email || "ไม่พบอีเมลบัญชี"}</span>
                    </div>
                  </div>
                  <div className="account-menu-actions">
                    <button type="button" role="menuitem" onClick={() => { setSettingsOpen(true); setAccountMenuOpen(false); }}>⚙️ การตั้งค่า</button>
                    <button type="button" role="menuitem" className="is-danger" onClick={() => { setAccountMenuOpen(false); handleLogout(); }}>ออกจากระบบ</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {firebaseUser && <AnnouncementTicker message={ANNOUNCEMENT_MESSAGE} />}

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
      {firebaseUser && (tokenNearingExpiry || !calendarAccessToken) && (
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
        {firebaseUser && mode === "reminder" && (
          <ReminderMode
            firebaseUser={firebaseUser}
            activities={visibleActivities}
            categories={categories}
            activityCategoryMap={activityCategoryMap}
            onEditActivity={openEditActivity}
            timelineColors={reminderTimelineColors}
          />
        )}

        {mode === "activity" && (
          <React.Fragment>
            {!authReady && (
              <div className="empty-state">
                <p>กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</p>
              </div>
            )}

            {authReady && !firebaseUser && (
              <div className="login-screen">
                <div className="login-card">
                  <img className="login-logo" src={brandWordmarkSrc} alt="T.i.M.E.S." />
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
                token specifically expired mid-session. Show this only while
                there is no previously synced activity data to read. */}
            {firebaseUser && !calendarAccessToken && activities.length === 0 && (
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

            {firebaseUser && (
              <div className="dashboard activity-dashboard" onScroll={handleActivityDashboardScroll}>
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
                        activities={visibleActivities}
                        categories={categories}
                        activityCategoryMap={activityCategoryMap}
                        userId={firebaseUser.uid}
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
                  <ActivityModeWeekSpine
                    anchorDate={cursorDate}
                    activities={visibleActivities}
                    categories={categories}
                    activityCategoryMap={displayedActivityCategoryMap}
                    activityTagMap={activityTagMap}
                    onAddActivity={openAddActivity}
                    onSelectDay={openDay}
                    onEditActivity={openEditActivity}
                    onSaveTimes={handleSaveTimes}
                    onRestoreArchivedActivity={async ({ calendarId, title, start, end, categoryId, tags }) => handleSaveActivity({
                      activityBody: {
                        summary: title,
                        start: { dateTime: start.toISOString() },
                        end: { dateTime: end.toISOString() }
                      },
                      categoryId,
                      tags,
                      existingId: calendarId || undefined
                    })}
                    lockedActivities={lockedActivities}
                    onAssignCategory={handleAssignCategory}
                    onToggleLock={handleToggleLock}
                    onDeleteActivity={handleDeleteActivity}
                    onDeleteSeries={handleDeleteSeries}
                    onDuplicateActivity={handleDuplicateActivity}
                    onMoveActivityToDay={handleMoveActivityToDay}
                    onEditSeries={handleEditSeries}
                    onFetchSeriesCount={handleFetchSeriesCount}
                    onNavigateWeek={navigateWeek}
                    onFocusArchiveTimeline={focusDate}
                    onOpenArchiveDraft={(item, warning = "") => openAddActivity(item.start ? new Date(item.start) : new Date(cursorDate), { preserveTime: Boolean(item.start), end: item.end || null, title: item.title, warning, missingFields: [!item.start && "start", !item.end && "end"].filter(Boolean) })}
                    onEditArchivedActivity={openEditActivityById}
                    userId={firebaseUser.uid}
                    tokenNearingExpiry={tokenNearingExpiry}
                    onReauthCalendar={handleReauthCalendar}
                    hoursPerCell={weekSpineHoursPerCell}
                    onHoursPerCellChange={setWeekSpineHoursPerCell}
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
        key={modalEditingActivity?.id || `new-${toDateInputValue(modalDefaultDate || new Date())}-${modalDefaultTitle}-${modalInitialWarning}`}
        open={modalOpen}
        defaultDate={modalDefaultDate}
        defaultEnd={modalDefaultEnd}
        defaultTitle={modalDefaultTitle}
        initialWarning={modalInitialWarning}
        missingFields={modalMissingFields}
        initialActivity={modalEditingActivity}
        isSeries={modalEditingAsSeries}
        activities={activities}
        archivedActivityIds={archivedActivityIds}
        categories={categories}
        activityCategoryMap={activityCategoryMap}
        activityTagMap={activityTagMap}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={handleDeleteCategory}
        onSave={handleSaveActivity}
        onDelete={handleDeleteActivity}
        onSyncGoogleCalendar={handleManualCalendarSync}
        googleCalendarSyncing={loading}
        onClose={closeModal}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        reminderTimelineColors={reminderTimelineColors}
        onReminderTimelineColorsChange={setReminderTimelineColors}
      />

    </div>
  );
}
