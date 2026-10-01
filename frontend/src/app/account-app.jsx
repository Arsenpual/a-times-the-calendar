import { useActivityView } from "../features/activity/hooks/use-activity-view.js";
import { useActivityError } from "../features/activity/hooks/use-activity-error.js";
import { useCycleActivities } from "../features/activity/hooks/use-cycle-activities.js";
import { useActivityCollections } from "../features/activity/hooks/use-activity-collections.js";
import { useAppNavigation } from "./hooks/use-app-navigation.js";
import { useDisplayPreferences } from "../features/settings/hooks/use-display-preferences.js";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ActivityModeWeekSpine from "../features/activity/components/activity-mode-week-spine.jsx";
import TagSearchResults from "../features/activity/components/tag-search-results.jsx";
import WeeklySummaryPanel from "../features/activity/components/weekly-summary-panel.jsx";
import CycleSummaryPanel from "../features/activity/components/cycle-summary-panel.jsx";
import ActivityTimeStreamgraph from "../features/activity/components/activity-time-streamgraph.jsx";
import MiniTimelinePanel from "../features/activity/components/mini-timeline-panel.jsx";
import ActivityModal from "../features/activity/components/activity-modal.jsx";
import ReminderMode from "../features/reminder/components/reminder-mode.jsx";
import AnnouncementTicker from "../features/announcements/components/announcement-ticker.jsx";
import SettingsDrawer from "../features/settings/components/settings-drawer.jsx";
import { getWeekRange, getYearCycle, toDateInputValue } from "../shared/lib/date-utils.js";
import { collectPreferenceCorrections } from "../features/activity/assistant/lib/preference-corrections.js";
import { fetchActivities } from "../features/calendar-connection/api/google-calendar.js";
import { fetchDailySummary } from "../features/activity/api/summary.js";
import ActivityAiAssistant from "../features/activity/assistant/components/activity-assistant-dialog.jsx";
import { useWeekNavigation } from "../features/activity/hooks/use-week-navigation.js";
import { useCalendarData } from "../features/activity/hooks/use-calendar-data.js";
import { useTagSearch } from "../features/activity/hooks/use-tag-search.js";
import { useActivityModal } from "../features/activity/hooks/use-activity-modal.js";
import { useActivityMutations } from "../features/activity/hooks/use-activity-mutations.js";
import { useActivityOnboarding } from "../features/activity/hooks/use-activity-onboarding.js";
import { useArchivedActivityIds } from "../features/activity/hooks/use-archived-activity-ids.js";
import { useActivityTelegramNotifications } from "../features/notifications/telegram/hooks/use-activity-telegram-notifications.js";
import { useAnnouncementMessage } from "../features/announcements/hooks/use-announcement-message.js";
import { useAppShellUi } from "./hooks/use-app-shell-ui.js";
import { useAssistantPreferences } from "../features/activity/assistant/hooks/use-assistant-preferences.js";
import { useTelegramConnection } from "../features/reminder/hooks/use-telegram-connection.js";
import { useTelegramWebChat } from "../features/notifications/telegram/hooks/use-telegram-web-chat.js";
import AppHeader from "./components/app-header.jsx";
import CalendarConnectionOverlays from "./components/calendar-connection-overlays.jsx";
import ActivityAuthState from "./components/activity-auth-state.jsx";
import FirestoreQuotaBanner from "./components/firestore-quota-banner.jsx";
import { PopupLayerItem } from "../shared/ui/popup-layer.jsx";
import { setFirestoreQuotaStatus, useFirestoreQuotaStatus } from "../shared/api/firestore-quota-status.js";

// Fallback only: after sign-in the app replaces this with the announcement
// configured through the authorised Telegram command. It remains useful when
// no remote announcement has ever been set or the backend is temporarily down.
const BRAND_WORDMARK_LIGHT_SRC = `${import.meta.env.BASE_URL}logo/times-wordmark.svg`;
const BRAND_WORDMARK_DARK_SRC = `${import.meta.env.BASE_URL}logo/times-wordmark-dark.svg`;
const PRIVACY_POLICY_URL = `${import.meta.env.BASE_URL}privacy.html`;

/**
 * State/effects previously all lived directly in this component (~1650
 * lines). Now composed from app and feature hooks, split by concern:
 *   - useAuth: Firebase session + Google Calendar OAuth token
 *   - useWeekNavigation: cursorDate/expandedDate and Activity keyboard navigation
 *   - useAppNavigation: mode, settings drawer and login guide
 *   - useDisplayPreferences: theme and reminder timeline colors
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
 * prop-drilling. AccountApp's job is to wire account-scoped hooks together
 * and keep those subscriptions mounted while switching modes.
 */
// Reset all feature state and effect subscriptions when the Firebase identity
// changes. Mode switches keep this boundary mounted so reminder timers continue.
export default function AccountApp({ auth }) {
  const firestoreQuota = useFirestoreQuotaStatus();
  const handleTestFirestoreQuota = useCallback(() => {
    if (firestoreQuota) {
      setFirestoreQuotaStatus(null);
      return;
    }
    setFirestoreQuotaStatus({
      metric: "documentReads",
      remaining: 0,
      dailyLimit: 50_000,
      resetsAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      resetTimeZone: "America/Los_Angeles",
      simulated: true
    });
  }, [firestoreQuota]);
  const {
    firebaseUser,
    authReady,
    error: authError,
    setError: setAuthError,
    calendarAccessToken,
    calendarConnectionState,
    setCalendarAccessToken,
    calendarTokenExpiresAt,
    setCalendarTokenExpiresAtState,
    tokenNearingExpiry,
    refreshCalendarConnection,
    handleLogin,
    handleLogout: authHandleLogout,
    handleReauthCalendar,
    handleDisconnectCalendar,
    CALENDAR_TOKEN_EXPIRES_AT_STORAGE_KEY
  } = auth;
  const assistantPreferences = useAssistantPreferences(firebaseUser?.uid);
  const telegramIntegration = useTelegramConnection(firebaseUser);
  const telegramChat = useTelegramWebChat(firebaseUser, telegramIntegration.telegramConnection.isConnected);
  const { error: activityError, setError } = useActivityError(firebaseUser?.uid);
  const error = authError || activityError;

  const archivedActivityIds = useArchivedActivityIds(firebaseUser);
  const announcement = useAnnouncementMessage(firebaseUser);

  useEffect(() => {
    if (!error) return undefined;
    const dismissIfOutsideToast = (event) => {
      if (event.target instanceof Element && event.target.closest(".error-banner")) return;
      setError(null);
      setAuthError(null);
    };
    document.addEventListener("pointerdown", dismissIfOutsideToast, true);
    document.addEventListener("focusin", dismissIfOutsideToast, true);
    return () => {
      document.removeEventListener("pointerdown", dismissIfOutsideToast, true);
      document.removeEventListener("focusin", dismissIfOutsideToast, true);
    };
  }, [error, setError, setAuthError]);

  const { mode, setMode, settingsOpen, setSettingsOpen } = useAppNavigation();
  const {
    theme, setTheme, reminderTimelineColors, setReminderTimelineColors,
    summaryPanelGlassEnabled, setSummaryPanelGlassEnabled,
    weekSpineHoursPerCell, setWeekSpineHoursPerCell
  } = useDisplayPreferences();
  const nav = useWeekNavigation({ mode, userId: firebaseUser?.uid ?? null });
  const {
    cursorDate,
    expandedDate,
    weekRangeOverride,
    navigateWeek,
    navigateDay,
    goToday,
    selectWeek,
    focusDate,
    openDay,
    closeDay
  } = nav;
  const {
    weekSpineViewMode,
    cycleAnchorDate,
    weekSpineFullscreenRequest,
    summaryPanelMode,
    setWeekSpineView,
    navigateCycle,
    openCycleWeekEditor,
    openCycleWeekView,
    handleTimelineFullscreenChange,
    selectCycleWeek,
    focusCycleSummary,
    focusWeeklySummary,
    activityHeaderTitle
  } = useActivityView({ cursorDate, selectWeek, closeDay, userId: firebaseUser?.uid ?? null });
  const [streamgraphRange, setStreamgraphRange] = useState("week");
  // In the normal Week Spine, Cycle Streamgraph follows the week currently
  // on screen. The four-week overview continues to own its own cycle anchor.
  const cycleRange = getYearCycle(
    weekSpineViewMode === "four-weeks" ? cycleAnchorDate : (streamgraphRange === "cycle" ? cursorDate : cycleAnchorDate)
  );
  const cycleData = useCycleActivities({
    viewMode: mode === "activity" && firebaseUser ? weekSpineViewMode : "week",
    calendarAccessToken,
    cycleStart: cycleRange.start,
    cycleEnd: cycleRange.end,
    userId: firebaseUser?.uid,
    archivedActivityIds,
    includeWhenWeek: mode === "activity" && streamgraphRange === "cycle"
  });
  const {
    isActivityReading,
    setIsActivityReading,
    accountMenuOpen,
    setAccountMenuOpen,
    accountMenuRef,
    activityDashboardRef,
    handleActivityDashboardScroll
  } = useAppShellUi({ mode, userId: firebaseUser?.uid });
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
    modalInitialDraft,
    modalInitialWarning,
    modalMissingFields,
    modalEditingActivity,
    modalEditingAsSeries,
    modalSessionId,
    openAddActivity,
    openEditActivity,
    openEditActivityById,
    closeModal,
    handleEditSeries
  } = activityModal;
  const [activityAssistantOpen, setActivityAssistantOpen] = useState(false);
  const [assistantInsight, setAssistantInsight] = useState(null);
  const [activityAssistantFormUpdate, setActivityAssistantFormUpdate] = useState(null);
  const [activityAssistantStartRequest, setActivityAssistantStartRequest] = useState(0);
  const [activityAssistantDailySummaryRequest, setActivityAssistantDailySummaryRequest] = useState(0);
  const [assistantDailySummary, setAssistantDailySummary] = useState({ open: false, loading: false, error: "", data: null });
  const openMrZettascaleChat = useCallback(() => {
    setActivityAssistantOpen(true);
    telegramChat.openChat();
  }, [telegramChat.openChat]);
  const handleCloseActivityModal = () => {
    // An assistant hand-off belongs only to the current form.  Clearing it on
    // close prevents an old chat reply from refilling the next blank form.
    setActivityAssistantFormUpdate(null);
    closeModal();
  };
  const openAssistantDailySummary = useCallback(async () => {
    if (!calendarAccessToken) throw new Error("กรุณาเชื่อม Google Calendar ก่อนดูสรุปกิจกรรม");
    const now = new Date();
    const date = toDateInputValue(now);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    setAssistantDailySummary({ open: true, loading: true, error: "", data: null });
    handleCloseActivityModal();
    try {
      const dayActivities = await fetchActivities(calendarAccessToken, dayStart, dayEnd);
      const payload = dayActivities
        .filter((activity) => !archivedActivityIds.has(activity.id))
        .map((activity) => {
          const allDay = Boolean(activity.start?.date && !activity.start?.dateTime);
          return {
            id: activity.id,
            summary: activity.summary,
            start: allDay ? `${activity.start.date}T00:00:00` : activity.start?.dateTime,
            end: allDay ? `${activity.end?.date || activity.start.date}T00:00:00` : activity.end?.dateTime,
            allDay
          };
        })
        .filter((activity) => activity.start && activity.end);
      const data = await fetchDailySummary(date, payload);
      setAssistantDailySummary({ open: true, loading: false, error: "", data });
      return data;
    } catch (error) {
      setAssistantDailySummary({ open: true, loading: false, error: error.message, data: null });
      throw error;
    }
  }, [calendarAccessToken, archivedActivityIds]);
  const requestAssistantDailySummary = useCallback(() => {
    setActivityAssistantOpen(true);
    setActivityAssistantDailySummaryRequest((current) => current + 1);
  }, []);

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
    handleSaveActivityPlan,
    handleSaveTimes,
    handleFetchSeriesCount,
    handleDeleteActivity,
    handleDeleteSeries,
    handleDuplicateActivity,
    handleMoveActivityToDay
  } = mutations;
  const saveActivityWithAssistantLearning = useCallback(async (payload) => {
    const saved = await handleSaveActivity(payload);
    const corrections = collectPreferenceCorrections(payload);
    // Preference learning is never allowed to make a Calendar save look as if
    // it failed. It is an optional follow-up and has its own visible UI.
    if (corrections.length) assistantPreferences.recordCorrections(corrections).catch(() => {});
    return saved;
  }, [assistantPreferences, handleSaveActivity]);
  const saveAssistantPlan = useCallback(async (drafts) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const items = drafts.map((draft) => {
      const start = new Date(draft.startLocal || "");
      const end = new Date(draft.endLocal || "");
      if (!draft.title?.trim() || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
        throw new Error("แผนมีชื่อหรือวันเวลาที่ไม่ถูกต้อง");
      }
      const categoryId = categories.find((category) => category.name === draft.categoryName)?.id || null;
      return {
        activityBody: {
          summary: draft.title.trim(),
          description: draft.notes?.trim() || null,
          start: { dateTime: start.toISOString(), timeZone },
          end: { dateTime: end.toISOString(), timeZone }
        },
        categoryId,
        tags: Array.isArray(draft.tags) ? draft.tags : []
      };
    });
    return handleSaveActivityPlan(items);
  }, [categories, handleSaveActivityPlan]);

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
    // Close transient UI immediately. Firebase identity change then unmounts
    // the account tree, including both modes' timers and subscriptions.
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
  const { calendarActivities, visibleActivities } = useActivityCollections({
    activities, onboardingActivities, archivedActivityIds,
    tagSearchTerms, tagSearchResults, activityTagMap
  });
  const displayedActivityCategoryMap = useMemo(
    () => ({ ...activityCategoryMap, ...onboardingCategoryMap }),
    [activityCategoryMap, onboardingCategoryMap]
  );

  useActivityTelegramNotifications({ firebaseUser, activities, archivedActivityIds });

  return (
    <div className={`app app--${mode}${isActivityReading ? " is-reading" : ""}`}>
      <AppHeader
        firebaseUser={firebaseUser}
        brandWordmarkSrc={brandWordmarkSrc}
        mode={mode}
        setMode={setMode}
        goToday={goToday}
        navigateDay={navigateDay}
        navigateWeek={navigateWeek}
        activityHeaderTitle={activityHeaderTitle}
        weekSpineViewMode={weekSpineViewMode}
        setWeekSpineView={setWeekSpineView}
        tagSearchTerms={tagSearchTerms}
        setTagSearchTerms={setTagSearchTerms}
        tagSearchDraft={tagSearchDraft}
        setTagSearchDraft={setTagSearchDraft}
        openAddActivity={openAddActivity}
        cursorDate={cursorDate}
        calendarAccessToken={calendarAccessToken}
        setCalendarTokenExpiresAtState={setCalendarTokenExpiresAtState}
        calendarTokenExpiresAtStorageKey={CALENDAR_TOKEN_EXPIRES_AT_STORAGE_KEY}
        onTestFirestoreQuota={handleTestFirestoreQuota}
        firestoreQuotaTestActive={Boolean(firestoreQuota?.simulated)}
        telegramConnected={telegramIntegration.telegramConnection.isConnected}
        telegramUnreadCount={telegramChat.unreadCount}
        onOpenMrZettascaleChat={openMrZettascaleChat}
        accountMenuRef={accountMenuRef}
        accountMenuOpen={accountMenuOpen}
        setAccountMenuOpen={setAccountMenuOpen}
        setSettingsOpen={setSettingsOpen}
        handleLogout={handleLogout}
      />

      {firebaseUser && <AnnouncementTicker message={announcement.message} config={announcement.config} />}

      <CalendarConnectionOverlays
        firebaseUser={firebaseUser}
        calendarConnectionState={calendarConnectionState}
        tokenNearingExpiry={tokenNearingExpiry}
        handleReauthCalendar={handleReauthCalendar}
      />
      <FirestoreQuotaBanner quota={firestoreQuota} />

      {error && <PopupLayerItem id="app-error" region="top-right" priority={90}><div className="error-banner" role="alert">{error}</div></PopupLayerItem>}
      <main className="app-main">
        {firebaseUser && (
          // Keep the reminder runtime mounted while Activity Mode is open.
          // Its due-check loop owns Telegram reminder delivery, so unmounting
          // it on every mode switch used to stop Telegram until the user
          // explicitly returned to Reminder Mode. `hidden` removes only its
          // visual layout; state, Firebase sync, and the notification loop
          // continue while this browser tab remains open.
          <div className="reminder-mode-runtime" hidden={mode !== "reminder"} aria-hidden={mode !== "reminder"}>
            <ReminderMode
              calendarAccessToken={calendarAccessToken}
              onReauthRequired={setCalendarAccessToken}
              archivedActivityIds={archivedActivityIds}
              isVisible={mode === "reminder"}
              firebaseUser={firebaseUser}
              activities={calendarActivities}
              categories={categories}
              activityCategoryMap={activityCategoryMap}
              lockedActivities={lockedActivities}
              onEditActivity={openEditActivity}
              onToggleActivityLock={handleToggleLock}
              timelineColors={reminderTimelineColors}
              telegramIntegration={telegramIntegration}
              telegramChat={telegramChat}
            />
          </div>
        )}

        {mode === "activity" && (
          <React.Fragment>
            <ActivityAuthState
              authReady={authReady}
              firebaseUser={firebaseUser}
              brandWordmarkSrc={brandWordmarkSrc}
              privacyPolicyUrl={PRIVACY_POLICY_URL}
              handleLogin={handleLogin}
            />

            {/* Signed in to Firebase, but the Google Calendar consent hasn't
                happened yet (first sign-in denied Calendar scope), OR its
                token specifically expired mid-session. Show this only while
                there is no previously synced activity data to read. */}
            {firebaseUser && calendarConnectionState === "needs-reauth" && activities.length === 0 && (
              <div className="empty-state">
                <p>ต้องยืนยันตัวตนกับ Google Calendar อีกครั้งเพื่อดึงปฏิทินของคุณมาแสดง</p>
              </div>
            )}

            {firebaseUser && calendarConnectionState === "unavailable" && (
              <PopupLayerItem id="calendar-backend-unavailable" region="top-right" priority={80}><div className="error-banner" role="status">
                <span>ยังติดต่อ Calendar backend ไม่ได้ชั่วคราว — อาจกำลังเริ่มทำงาน</span>
                <button type="button" className="btn btn-outline" onClick={refreshCalendarConnection}>ลองเชื่อมต่อใหม่</button>
              </div></PopupLayerItem>
            )}

            {firebaseUser && loading && (
              <PopupLayerItem id="activity-loading" region="bottom-right" priority={10}><div className="loading-banner" role="status" aria-live="polite">
                กำลังโหลด...
              </div></PopupLayerItem>
            )}
            {firebaseUser && isSearchingTags && !tagSearchLoading && (
              <div className="tag-search-status">
                พบ {visibleActivities.length} กิจกรรมที่มี tag ตรงกับ{" "}
                {tagSearchTerms.map((t) => `#${t}`).join(" หรือ ")} (ค้นหาช่วง ±3 เดือนจากวันนี้)
              </div>
            )}

            {firebaseUser && (
              <div ref={activityDashboardRef} className={`dashboard activity-dashboard${assistantDailySummary.open ? " is-assistant-daily-summary" : ""}`} onScroll={handleActivityDashboardScroll}>
                <div className={`summary-column${assistantDailySummary.open ? " is-assistant-daily-summary" : ""}`}>
                  <div className={`flip-card${expandedDate ? " is-flipped" : ""}`}>
                    <div className="flip-face flip-face-summary">
                      {weekSpineViewMode === "four-weeks" && summaryPanelMode === "cycle" ? <CycleSummaryPanel
                            anchorDate={cycleAnchorDate}
                            activities={cycleData.activities}
                            loading={cycleData.loading}
                            error={cycleData.error}
                            categories={categories}
                            activityCategoryMap={activityCategoryMap}
                            onSelectWeek={selectCycleWeek}
                            onSelectDay={focusDate}
                            glass={summaryPanelGlassEnabled}
                            theme={theme}
                          /> : <WeeklySummaryPanel
                            anchorDate={cursorDate}
                            summary={summary}
                            loading={summaryLoading}
                            error={summaryError}
                            onSelectDay={openDay}
                            categories={categories}
                            glass={summaryPanelGlassEnabled}
                            theme={theme}
                          />}
                    </div>
                    <div className="flip-face flip-face-timeline">
                      <MiniTimelinePanel
                        activities={visibleActivities}
                        categories={categories}
                        activityCategoryMap={activityCategoryMap}
                        lockedActivities={lockedActivities}
                        userId={firebaseUser.uid}
                        expandedDate={expandedDate}
                        onClose={closeDay}
                        onEditActivity={openEditActivity}
                        onOpenDailySummary={requestAssistantDailySummary}
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
                    viewMode={weekSpineViewMode}
                    weekRangeOverride={weekRangeOverride}
                    cycleStartDate={cycleAnchorDate}
                    fullscreenRequestId={weekSpineFullscreenRequest}
                    onTimelineFullscreenChange={handleTimelineFullscreenChange}
                    onSelectOverviewWeek={selectCycleWeek}
                    onSelectOverviewDay={focusDate}
                    onNavigateCycle={navigateCycle}
                    onOpenOverviewWeekEditor={openCycleWeekEditor}
                    onOpenOverviewWeekView={openCycleWeekView}
                    onFocusOverviewSummary={focusCycleSummary}
                    onFocusWeekSummary={focusWeeklySummary}
                    cycleData={cycleData}
                    weekStreamgraph={weekSpineViewMode === "week" ? <ActivityTimeStreamgraph
                      anchorDate={cursorDate}
                      activities={visibleActivities}
                      cycleAnchorDate={streamgraphRange === "cycle" ? cursorDate : cycleAnchorDate}
                      cycleActivities={cycleData.activities}
                      cycleLoading={cycleData.loading}
                      categories={categories}
                      activityCategoryMap={activityCategoryMap}
                      range={streamgraphRange}
                      onRangeChange={setStreamgraphRange}
                      onSelectDay={openDay}
                    /> : null}
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
        key={`activity-modal-${modalSessionId}`}
        open={modalOpen}
        defaultDate={modalDefaultDate}
        defaultEnd={modalDefaultEnd}
        defaultTitle={modalDefaultTitle}
        initialDraft={modalInitialDraft}
        assistantUpdate={activityAssistantFormUpdate}
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
        onSave={saveActivityWithAssistantLearning}
        onDelete={handleDeleteActivity}
        onSyncGoogleCalendar={handleManualCalendarSync}
        googleCalendarSyncing={loading}
        onOpenAssistant={() => {
          setActivityAssistantOpen(true);
          setActivityAssistantStartRequest((current) => current + 1);
        }}
        onClose={handleCloseActivityModal}
      />

      <ActivityAiAssistant
        open={activityAssistantOpen}
        activityFormOpen={modalOpen}
        dailySummaryOpen={assistantDailySummary.open}
        startActivityCreationRequest={activityAssistantStartRequest}
        startDailySummaryRequest={activityAssistantDailySummaryRequest}
        onClose={() => {
          setActivityAssistantOpen(false);
          telegramChat.closeChat();
          setAssistantDailySummary({ open: false, loading: false, error: "", data: null });
        }}
        categories={categories}
        activities={activities}
        activityTagMap={activityTagMap}
        assistantPreferences={assistantPreferences.values}
        telegramMessages={telegramChat.messages}
        telegramError={telegramChat.error}
        onOpenTelegramChat={telegramChat.openChat}
        onSendTelegramMessage={telegramChat.sendChatMessage}
        onClearTelegramMessages={telegramChat.clearChatMessages}
        lockedActivities={lockedActivities}
        userId={firebaseUser?.uid}
        onOpenActivityForm={(draft) => {
          setActivityAssistantFormUpdate(null);
          const start = new Date(draft.startLocal || new Date());
          const end = new Date(draft.endLocal || start.getTime() + 60 * 60000);
          openAddActivity(start, { preserveTime: true, end, title: draft.title || "", initialDraft: { ...draft, assistantOrigin: "mr-zettascale" } });
        }}
        onUpdateActivityForm={({ values, changedField }) => setActivityAssistantFormUpdate({ values, changedField, revision: Date.now() })}
        onConfirmActivityPlan={saveAssistantPlan}
        onOpenDailySummary={openAssistantDailySummary}
        assistantInsight={assistantInsight}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        reminderTimelineColors={reminderTimelineColors}
        onReminderTimelineColorsChange={setReminderTimelineColors}
        summaryPanelGlassEnabled={summaryPanelGlassEnabled}
        onSummaryPanelGlassChange={setSummaryPanelGlassEnabled}
        assistantPreferences={assistantPreferences.values}
        assistantPreferenceCandidates={assistantPreferences.candidates}
        assistantPreferencesLoading={assistantPreferences.loading}
        onSaveAssistantPreference={assistantPreferences.save}
        onDeleteAssistantPreference={assistantPreferences.remove}
        onDismissAssistantPreferenceCandidate={assistantPreferences.dismissCandidate}
        calendarConnected={calendarConnectionState === "connected"}
        onDisconnectCalendar={async () => {
          const disconnected = await handleDisconnectCalendar();
          if (disconnected) window.location.reload();
        }}
        assistantInsight={assistantInsight}
        onAssistantInsightChange={setAssistantInsight}
      />

    </div>
  );
}
