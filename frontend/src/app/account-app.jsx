import React, { useCallback, useEffect, useState } from "react";
import { useAppNavigation } from "./hooks/use-app-navigation.js";
import { useAppShellUi } from "./hooks/use-app-shell-ui.js";
import { useDisplayPreferences } from "../features/settings/hooks/use-display-preferences.js";
import ActivityModeWeekSpine from "../features/activity/components/activity-mode-week-spine.jsx";
import ActivityPopup from "../features/activity/components/activity-popup.jsx";
import TagSearchResults from "../features/activity/components/tag-search-results.jsx";
import ActivityModal from "../features/activity/components/activity-modal.jsx";
import ActivityAiAssistant from "../features/activity/assistant/components/activity-assistant-dialog.jsx";
import ReminderMode from "../features/reminder/components/reminder-mode.jsx";
import CozyDeskMode from "../features/cozy-desk/cozy-desk-mode.jsx";
import AnnouncementTicker from "../features/announcements/components/announcement-ticker.jsx";
import SettingsDrawer from "../features/settings/components/settings-drawer.jsx";
import { useActivityWorkspace } from "../features/activity/hooks/use-activity-workspace.js";
import { useAssistantActivityActions } from "../features/activity/assistant/hooks/use-assistant-activity-actions.js";
import { useAssistantPreferences } from "../features/activity/assistant/hooks/use-assistant-preferences.js";
import { useAnnouncementMessage } from "../features/announcements/hooks/use-announcement-message.js";
import { useActivityTelegramNotifications } from "../features/notifications/hooks/use-activity-telegram-notifications.js";
import { usePushNotifications } from "../features/notifications/hooks/use-push-notifications.js";
import { useTelegramConnection } from "../features/notifications/hooks/use-telegram-connection.js";
import { useTelegramWebChat } from "../features/notifications/hooks/use-telegram-web-chat.js";
import AppHeader from "./components/app-header.jsx";
import AppTaskbar from "./components/app-taskbar.jsx";
import CalendarConnectionOverlays from "../features/calendar-connection/components/calendar-connection-overlays.jsx";
import ActivityAuthState from "./components/activity-auth-state.jsx";
import FirestoreQuotaBanner from "./components/firestore-quota-banner.jsx";
import { PopupLayerItem } from "../shared/ui/popup-layer.jsx";
import { setFirestoreQuotaStatus, useFirestoreQuotaStatus } from "../shared/api/firestore-quota-status.js";

// Fallback only: after sign-in the app replaces this with the announcement
// configured through the authorised Telegram command. It remains useful when
// no remote announcement has ever been set or the backend is temporarily down.
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
  const [reminderHeaderTarget, setReminderHeaderTarget] = useState(null);
  const [aiHeaderTarget, setAiHeaderTarget] = useState(null);
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
  const { isEnabled: isPushEnabled } = usePushNotifications({ firebaseUser });
  const telegramIntegration = useTelegramConnection(firebaseUser);
  const telegramChat = useTelegramWebChat(firebaseUser, telegramIntegration.telegramConnection.isConnected);
  const announcement = useAnnouncementMessage(firebaseUser);

  const { mode, setMode, closeAiMode, toggleAiMode, settingsOpen, setSettingsOpen } = useAppNavigation();
  const [navigationExpanded, setNavigationExpanded] = useState(() => window.matchMedia("(min-width: 761px)").matches);
  const {
    reminderTimelineColors, setReminderTimelineColors,
    nowIndicatorResetSeconds, setNowIndicatorResetSeconds,
    summaryPanelGlassEnabled, setSummaryPanelGlassEnabled
  } = useDisplayPreferences();

  const {
    isActivityReading,
    setIsActivityReading,
    accountMenuOpen,
    setAccountMenuOpen,
    accountMenuRef,
    activityDashboardRef,
    handleActivityDashboardScroll
  } = useAppShellUi({ mode, userId: firebaseUser?.uid });

  const {
    activityError,
    setError,
    archivedActivityIds,
    cursorDate,
    weekRangeOverride,
    navigateWeek,
    navigateDay,
    goToday,
    focusDate,
    openDay,
    closeDay,
    weekSpineViewMode,
    cycleAnchorDate,
    monthAnchorDate,
    setWeekSpineView,
    navigateCycle,
    navigateMonth,
    setMonthAnchorDate,
    selectMonthDate,
    selectCycleDate,
    openCycleWeekEditor,
    openCycleWeekView,
    selectCycleWeek,
    focusCycleSummary,
    focusWeeklySummary,
    activityHeaderTitle,
    cycleData,
    activities,
    loading,
    categories,
    activityCategoryMap,
    activityTagMap,
    lockedActivities,
    resetOnLogout,
    handleManualCalendarSync,
    tagSearchTerms,
    setTagSearchTerms,
    tagSearchDraft,
    setTagSearchDraft,
    tagSearchLoading,
    tagSearchError,
    isSearchingTags,
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
    handleEditSeries,
    handleToggleLock,
    handleAssignCategory,
    handleCreateCategory,
    handleUpdateCategoryColor,
    handleDeleteCategory,
    handleSaveActivity,
    handleSaveActivityPlan,
    handleSaveTimes,
    handleFetchSeriesCount,
    handleDeleteActivity,
    handleDeleteSeries,
    handleDuplicateActivity,
    handleMoveActivityToDay,
    calendarActivities,
    visibleActivities,
    displayedActivityCategoryMap,
    weekNamesState,
    visibleHeaderWeekStart
  } = useActivityWorkspace({
    mode,
    firebaseUser,
    calendarAccessToken,
    setCalendarAccessToken
  });

  const error = authError || activityError;

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

  const {
    activityAssistantOpen,
    assistantInsight,
    setAssistantInsight,
    activityAssistantFormUpdate,
    activityAssistantStartRequest,
    activityAssistantDailySummaryRequest,
    assistantDailySummary,
    handleCloseActivityModal,
    openAssistantDailySummary,
    saveActivityWithAssistantLearning,
    saveAssistantRailEdit,
    saveAssistantPlan,
    handleCloseAssistant,
    handleOpenActivityFormFromAssistant,
    handleUpdateActivityFormFromAssistant,
    handleOpenAssistantFromModal
  } = useAssistantActivityActions({
    mode,
    setMode,
    closeAiMode,
    calendarAccessToken,
    archivedActivityIds,
    categories,
    activityCategoryMap,
    activityTagMap,
    assistantPreferences,
    telegramChat,
    openAddActivity,
    closeModal,
    handleSaveActivity,
    handleSaveActivityPlan
  });

  const handleLogout = async () => {
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

  useActivityTelegramNotifications({ firebaseUser, activities, archivedActivityIds });

  const headerInSummary = mode === "activity" && !isSearchingTags;
  const appHeader = (
    <AppHeader
        navigationExpanded={navigationExpanded}
        onToggleNavigation={() => setNavigationExpanded((expanded) => !expanded)}
        firebaseUser={firebaseUser}
        reminderHeaderRef={setReminderHeaderTarget}
        aiHeaderRef={setAiHeaderTarget}
        mode={mode}
        setMode={setMode}
        goToday={() => {
          goToday();
          if (weekSpineViewMode === "month") {
            const today = new Date();
            setMonthAnchorDate(new Date(today.getFullYear(), today.getMonth(), 1));
          }
        }}
        navigateDay={navigateDay}
        navigateWeek={weekSpineViewMode === "month" ? navigateMonth : navigateWeek}
        activityHeaderTitle={activityHeaderTitle}
        weekStart={visibleHeaderWeekStart}
        weekNamesState={weekNamesState}
        weekSpineViewMode={weekSpineViewMode}
        setWeekSpineView={setWeekSpineView}
        cycleAnchorDate={cycleAnchorDate}
        onNavigateCycle={navigateCycle}
        onSelectLonthDate={selectCycleDate}
        tagSearchTerms={tagSearchTerms}
        setTagSearchTerms={setTagSearchTerms}
        tagSearchDraft={tagSearchDraft}
        setTagSearchDraft={setTagSearchDraft}
        openAddActivity={openAddActivity}
        cursorDate={cursorDate}
        calendarAccessToken={calendarAccessToken}
        accountMenuRef={accountMenuRef}
        accountMenuOpen={accountMenuOpen}
        setAccountMenuOpen={setAccountMenuOpen}
        setSettingsOpen={setSettingsOpen}
        handleLogout={handleLogout}
      />
  );

  return (
    <div className={`app app--${mode}${isActivityReading ? " is-reading" : ""}`}>
      {!headerInSummary && mode !== "cozy" && appHeader}

      {firebaseUser && <AnnouncementTicker message={announcement.message} config={announcement.config} />}

      <CalendarConnectionOverlays
        firebaseUser={firebaseUser}
        calendarConnectionState={calendarConnectionState}
        tokenNearingExpiry={tokenNearingExpiry}
        handleReauthCalendar={handleReauthCalendar}
      />
      <FirestoreQuotaBanner quota={firestoreQuota} />

      {error && <PopupLayerItem id="app-error" region="top-right" priority={90}><div className="error-banner" role="alert">{error}</div></PopupLayerItem>}
      <div className="app-workspace">
        {firebaseUser && <AppTaskbar
          mode={mode}
          expanded={navigationExpanded}
          onClose={() => setNavigationExpanded(false)}
          onSelectMode={(nextMode) => { setMode(nextMode); setNavigationExpanded(false); }}
          onOpenAssistant={() => { toggleAiMode(); setNavigationExpanded(false); }}
          unreadCount={telegramChat.unreadCount}
          onSyncGoogleCalendar={handleManualCalendarSync}
          googleCalendarSyncing={loading}
        />}
      <main className="app-main" id="app-workspace-content">
        {firebaseUser && (
          // Keep the reminder runtime mounted while Activity Mode is open.
          // Its due-check loop owns Telegram reminder delivery, so unmounting
          // it on every mode switch used to stop Telegram until the user
          // explicitly returned to Reminder Mode. `hidden` removes only its
          // visual layout; state, Firebase sync, and the notification loop
          // continue while this browser tab remains open.
          <div className="reminder-mode-runtime" hidden={mode !== "reminder"} aria-hidden={mode !== "reminder"}>
            <ReminderMode
              headerTarget={reminderHeaderTarget}
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
              nowIndicatorResetSeconds={nowIndicatorResetSeconds}
              telegramIntegration={telegramIntegration}
              telegramChat={telegramChat}
              isPushEnabled={isPushEnabled}
              ActivityPopupComponent={ActivityPopup}
            />
          </div>
        )}

        {firebaseUser && (
          <CozyDeskMode
            isVisible={mode === "cozy"}
            firebaseUser={firebaseUser}
            activities={activities}
            archivedActivityIds={archivedActivityIds}
            navigationExpanded={navigationExpanded}
            onToggleNavigation={() => setNavigationExpanded((expanded) => !expanded)}
          />
        )}

        {mode === "activity" && (
          <React.Fragment>
            <ActivityAuthState
              authReady={authReady}
              firebaseUser={firebaseUser}
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
              <div ref={activityDashboardRef} className={`dashboard activity-dashboard${(weekSpineViewMode === "week" || weekSpineViewMode === "four-weeks" || weekSpineViewMode === "month") && !isSearchingTags ? " has-summary-hero" : ""}${assistantDailySummary.open ? " is-assistant-daily-summary" : ""}`} onScroll={handleActivityDashboardScroll}>
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
                    summaryHeader={headerInSummary ? appHeader : null}
                    weekNamesState={weekNamesState}
                    anchorDate={cursorDate}
                    activities={visibleActivities}
                    categories={categories}
                    activityCategoryMap={displayedActivityCategoryMap}
                    activitiesLoading={loading}
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
                    onNavigateDay={navigateDay}
                    onGoToday={goToday}
                    activityHeaderTitle={activityHeaderTitle}
                    onFocusArchiveTimeline={focusDate}
                    onOpenArchiveDraft={(item, warning = "") => openAddActivity(item.start ? new Date(item.start) : new Date(cursorDate), { preserveTime: Boolean(item.start), end: item.end || null, title: item.title, warning, missingFields: [!item.start && "start", !item.end && "end"].filter(Boolean) })}
                    onEditArchivedActivity={openEditActivityById}
                    userId={firebaseUser.uid}
                    viewMode={weekSpineViewMode}
                    weekRangeOverride={weekRangeOverride}
                    cycleStartDate={cycleAnchorDate}
                    monthAnchorDate={monthAnchorDate}
                    onSelectOverviewWeek={selectCycleWeek}
                    onSelectOverviewDay={focusDate}
                    onNavigateCycle={navigateCycle}
                    onNavigateMonth={navigateMonth}
                    onSelectLonthDate={selectCycleDate}
                    onSelectMonthDate={selectMonthDate}
                    onOpenOverviewWeekEditor={openCycleWeekEditor}
                    onOpenOverviewWeekView={openCycleWeekView}
                    onFocusOverviewSummary={focusCycleSummary}
                    onFocusWeekSummary={focusWeeklySummary}
                    cycleData={cycleData}
                  />
                )}
              </div>
            )}
          </React.Fragment>
        )}
      <ActivityAiAssistant
        presentation="page"
        headerTarget={aiHeaderTarget}
        open={activityAssistantOpen}
        activityFormOpen={modalOpen}
        dailySummaryOpen={assistantDailySummary.open}
        startActivityCreationRequest={activityAssistantStartRequest}
        startDailySummaryRequest={activityAssistantDailySummaryRequest}
        onClose={handleCloseAssistant}
        categories={categories}
        activities={activities}
        activityTagMap={activityTagMap}
        assistantPreferences={assistantPreferences.values}
        telegramMessages={telegramChat.messages}
        telegramUnreadCount={telegramChat.unreadCount}
        telegramError={telegramChat.error}
        onOpenTelegramChat={telegramChat.openChat}
        onMarkTelegramRead={telegramChat.markTelegramChatRead}
        onSendTelegramMessage={telegramChat.sendChatMessage}
        onClearTelegramMessages={telegramChat.clearChatMessages}
        lockedActivities={lockedActivities}
        userId={firebaseUser?.uid}
        onOpenActivityForm={handleOpenActivityFormFromAssistant}
        onUpdateActivityForm={handleUpdateActivityFormFromAssistant}
        onConfirmActivityPlan={saveAssistantPlan}
        onUpdateActivityFromRail={saveAssistantRailEdit}
        onDeleteActivityFromRail={handleDeleteActivity}
        onEditActivity={openEditActivity}
        onOpenDailySummary={openAssistantDailySummary}
        onReauthCalendar={handleReauthCalendar}
        assistantInsight={assistantInsight}
      />
      </main>
      </div>

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
        onUpdateCategoryColor={handleUpdateCategoryColor}
        onDeleteCategory={handleDeleteCategory}
        onSave={saveActivityWithAssistantLearning}
        onDelete={handleDeleteActivity}
        onOpenAssistant={handleOpenAssistantFromModal}
        onClose={handleCloseActivityModal}
      />


      <SettingsDrawer
        open={settingsOpen}
        calendarAccessToken={calendarAccessToken}
        setCalendarTokenExpiresAtState={setCalendarTokenExpiresAtState}
        calendarTokenExpiresAtStorageKey={CALENDAR_TOKEN_EXPIRES_AT_STORAGE_KEY}
        onTestFirestoreQuota={handleTestFirestoreQuota}
        firestoreQuotaTestActive={Boolean(firestoreQuota?.simulated)}
        onClose={() => setSettingsOpen(false)}
        reminderTimelineColors={reminderTimelineColors}
        onReminderTimelineColorsChange={setReminderTimelineColors}
        nowIndicatorResetSeconds={nowIndicatorResetSeconds}
        onNowIndicatorResetSecondsChange={setNowIndicatorResetSeconds}
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
