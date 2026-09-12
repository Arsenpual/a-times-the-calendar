import { useReminderMenus } from "../hooks/use-reminder-menus.js";
import { useReminderCalendar } from "../hooks/use-reminder-calendar.js";
import { useDueReminders } from "../hooks/use-due-reminders.js";
import { useReminderComposerState } from "../hooks/use-reminder-composer-state.js";
import { useReminderComposerActions } from "../hooks/use-reminder-composer-actions.js";
import { useReminderActions } from "../hooks/use-reminder-actions.js";
import { useReminderComposerPreview } from "../hooks/use-reminder-composer-preview.js";
import { useReminderGroups } from "../hooks/use-reminder-groups.js";
import { usePushNotifications } from "../../notifications/push/hooks/use-push-notifications.js";
import { useReminderStore } from "../hooks/use-reminder-store.js";
import { useTelegramConnection } from "../hooks/use-telegram-connection.js";
import { useReminderStats } from "../hooks/use-reminder-stats.js";
import { useActivityContextMenu } from "../hooks/use-activity-context-menu.js";
import { useReminderOmnibar } from "../hooks/use-reminder-omnibar.js";
import { useReminderFilters } from "../hooks/use-reminder-filters.js";
import { useEventAnchorSessions } from "../hooks/use-event-anchor-sessions.js";
import ReminderSidebar from "./reminder-sidebar.jsx";
import ReminderCard from "./reminder-card.jsx";
import ReminderListPanel from "./reminder-list-panel.jsx";
import ReminderTimelinePanel from "./reminder-timeline-panel.jsx";
import ReminderStatsPanel from "./reminder-stats-panel.jsx";
import ActivityPopup from "../../activity/components/activity-popup.jsx";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import { useLanguage } from "../../../shared/i18n/i18n.jsx";
import { useReminderExport } from "../hooks/use-reminder-export.js";
import { useReminderTimeline, ZOOM_LEVELS_MINUTES } from "../hooks/use-reminder-timeline.js";
import "../styles/reminder-material.css";
import "../styles/reminder-mode.css";
import { STORAGE_KEY, REMINDER_STATUS_TAB, TYPE_FILTER_OPTIONS, REMINDER_DISPLAY_TYPE_OPTIONS, REMINDER_COMPOSER_TYPE_OPTIONS, DAYS_OF_WEEK, LINE_COLOR_OPTIONS, DEFAULT_LINE_COLOR } from "../lib/reminder-config.js";
import { extractScheduleFields } from "../lib/reminder-sync-fields.js";
import { createBlankDraft, DEFAULT_REMINDERS } from "../lib/reminder-defaults.js";
import { formatDurationClock } from "../lib/reminder-formatters.js";
import ReminderTimelineRows from "./reminder-timeline-rows.jsx";
import ReminderTopbar from "./reminder-topbar.jsx";
import TelegramConnectionToast from "./telegram-connection-toast.jsx";
import ReminderAlerts from "./reminder-alerts.jsx";

export default function ReminderDashboard({
  firebaseUser,
  calendarAccessToken,
  onReauthRequired,
  archivedActivityIds,
  isVisible = true,
  activities = [],
  categories = [],
  activityCategoryMap = {},
  lockedActivities = {},
  onEditActivity,
  onToggleActivityLock,
  timelineColors
}) {
  const { t } = useLanguage();
  // Runtime reminder state belongs to a person, not to this browser. The
  // previous shared key exposed the prior account's reminders after logout.
  const userStorageKey = `${STORAGE_KEY}:${firebaseUser?.uid || "guest"}`;
  const { reminders, setReminders, updateReminders, getExportReminders, syncError } = useReminderStore({
    firebaseUser,
    storageKey: userStorageKey,
    defaultReminders: DEFAULT_REMINDERS,
    extractScheduleFields
  });
  const { groups, groupsError, addGroup, removeGroup } = useReminderGroups({ firebaseUser });
  const {
    isEnabled: isPushEnabled
  } = usePushNotifications({ firebaseUser });

  const { telegramConnection, areTelegramAlertsEnabled, handleTelegramAlertToggle, dismissTelegramStatus } = useTelegramConnection(firebaseUser);
  const { activityContextMenu, openActivityContextMenu, closeActivityContextMenu } = useActivityContextMenu();
  const { reminderStats, recordStatsEvent, isStatsOpen, openStats, closeStats } = useReminderStats({ firebaseUser, reminders });
  const { dueReminders, nowTick, scheduleNext, markCompleted } = useDueReminders({
    reminders, setReminders, updateReminders, firebaseUser, recordStatsEvent
  });
  const eventAnchorSessions = useEventAnchorSessions(reminders, nowTick);
  // Keep temporary sessions visible on their own, and also attach them to
  // the parent card so a user can see the currently running buffer without
  // needing to find it elsewhere in the list.
  const sessionsBySourceId = new Map();
  eventAnchorSessions.forEach((session) => {
    const current = sessionsBySourceId.get(session.sourceReminderId) || [];
    current.push(session);
    sessionsBySourceId.set(session.sourceReminderId, current);
  });
  const remindersForDisplay = reminders.map((reminder) => ({ ...reminder, activeEventAnchorSessions: sessionsBySourceId.get(reminder.id) || [] }));
  const remindersForTimeline = [...remindersForDisplay, ...eventAnchorSessions];

  const { draft, setDraft, editingId, setEditingId, isComposerOpen, setIsComposerOpen, composerCardRef } = useReminderComposerState(createBlankDraft);
  const { omnibarEnabled, omnibarInput, setOmnibarInput, omnibarPreview, submitOmnibar } = useReminderOmnibar({
    setDraft, setEditingId, setIsComposerOpen, createBlankDraft,
    updateReminders, defaultLineColor: DEFAULT_LINE_COLOR
  });


  const composerPreview = useReminderComposerPreview({
    draft, editingId, reminders, activities, t,
    typeOptions: REMINDER_DISPLAY_TYPE_OPTIONS, daysOfWeek: DAYS_OF_WEEK
  });

  // Tab ของรายการ reminder (migration plan v2 เฟส 1.2) — เดิมแสดง
  // active/paused พร้อมกันทั้งคู่คั่นด้วย section header, ตอนนี้เลือกดูได้
  // ทีละ tab แบบ mockup "completed" ยังเป็น placeholder เฉยๆ (รอ field
  // completedAt จริงจากเฟส 4) กด disabled ไว้ก่อน
  // สถานะของรายการที่กำลังแสดง ไม่ใช่ "active" ของ UI ทั่วไป.
  const { reminderDateFilter, setReminderDateFilter, selectedDateKey, selectedDate, selectDate, todayReminderCount, reminderStatusTab, setReminderStatusTab, activeTypeFilter, setActiveTypeFilter, activeGroupFilter, setActiveGroupFilter, toggleTypeFilter, toggleGroupFilter, enabledReminders, pausedReminders, completedReminders, visibleEnabledReminders, visiblePausedReminders, visibleCompletedReminders } = useReminderFilters(remindersForDisplay);

  const reminderCalendar = useReminderCalendar({
    userId: firebaseUser?.uid, calendarAccessToken, selectedDateKey,
    enabled: isVisible, activityRevision: activities, archivedActivityIds, onReauthRequired
  });

  // ฟอร์มสร้างกลุ่มใหม่แบบ inline ใน nav sidebar — เปิด/ปิดด้วยปุ่ม "+
  // เพิ่มกลุ่มใหม่" เก็บแค่ชื่อ (สีสุ่ม/วนจาก GROUP_COLOR_PALETTE อัตโนมัติ
  // ไม่ให้ผู้ใช้เลือกเอง เพื่อลดขั้นตอนเหลือแค่พิมพ์ชื่อ + Enter)
  /**
   * ลบกลุ่ม — backend เคลียร์ groupId ของ reminder ที่เคยผูกไว้เป็น null
   * ให้แล้ว (ดู routes/reminder-groups.js) แต่ local `reminders` state ที่
   * นี่ยังไม่รู้เรื่อง ต้อง patch เองให้ตรงกัน (useReminderGroups ไม่รู้จัก
   * reminders state จึงทำให้ไม่ได้ — ดู hook's module comment) พร้อมเคลียร์
   * activeGroupFilter ถ้ากำลังกรองด้วยกลุ่มที่เพิ่งถูกลบไปพอดี
   */
  const handleDeleteGroup = async (groupId) => {
    try {
      await removeGroup(groupId);
      setReminders((prev) => prev.map((r) => (r.groupId === groupId ? { ...r, groupId: null } : r)));
      setActiveGroupFilter((prev) => (prev === groupId ? null : prev));
    } catch {
      // groupsError จาก hook แสดงผลอยู่แล้ว
    }
  };

  // เมนู "⋮" บนการ์ด (แทนปุ่ม edit/delete แยก) + เมนู snooze บน due-banner
  // (migration plan v2 เฟส 1.3/1.4) — เก็บเป็น id เดียวต่อเมนู เพราะเปิด
  // ได้ทีละอันในแต่ละกลุ่มเสมออยู่แล้ว ไม่ต้องเป็น Set
  const {
    cardMenu, snoozeMenuForId, toggleCardMenu, toggleSnoozeMenu,
    closeCardMenu, closeSnoozeMenu, closeAllMenus
  } = useReminderMenus();
  const {
    zoomIndex, zoomIn, zoomOut, minutesPerRow, tapeRows, tapeScrollRef,
    timelineTrackMinWidth, calendarTimelineBlocks, runningReminderSpans,
    activityNowStatus, handleUserInteraction, focusReminderOnTimeline, SPACER_HEIGHT_PX
  } = useReminderTimeline({
    reminders: remindersForTimeline, activities: reminderCalendar.activities, categories, activityCategoryMap, selectedDate, selectedDateKey,
    activeTypeFilter, activeGroupFilter, nowTick,
    defaultLineColor: DEFAULT_LINE_COLOR, formatDurationClock
  });
  const { isExporting, exportTimelineImage } = useReminderExport({
    getExportReminders, selectedDate, activities: reminderCalendar.activities, categories, activityCategoryMap,
    groups, activeTypeFilter, activeGroupFilter
  });

  const {
    triggerAnchorEvent, advanceRoutine, toggleStopwatch, resetStopwatch, toggleReminder
  } = useReminderActions({
    updateReminders,
    recordStatsEvent,
    onWarning: (message) => window.alert(message)
  });

  const { toggleDayInDraft, submitReminderForm, deleteReminder, deleteEditingReminder, startEdit, cancelEditing, toggleComposer } = useReminderComposerActions({
    draft, setDraft, editingId, setEditingId, isComposerOpen, setIsComposerOpen,
    reminders, updateReminders, createBlankDraft, defaultLineColor: DEFAULT_LINE_COLOR
  });

  // Filter ตามประเภท (เฟส 2) ใช้ร่วมกันทั้ง active/paused — reminders ที่
  // enabled/paused คำนวณจาก reminders เต็มชุดก่อน (ไม่ใช่ผลลัพธ์ที่กรอง
  // แล้ว) เพราะ toolbar-subtitle ด้านบนยังต้องโชว์ยอดรวมทั้งหมดแยกจากที่
  // กำลังกรองอยู่ — ตัวแปรสองชุดนี้แทน "รายการทั้งหมดของ tab นั้น" ส่วน
  // ตัวที่ map ขึ้นจอจริงจะกรองซ้ำอีกชั้นด้วย activeTypeFilter ที่จุด render
  //
  // migration plan v2 เฟส 4 — เพิ่มเงื่อนไข !r.completedAt เข้า
  // enabledReminders/pausedReminders ทั้งคู่ (reminder ที่ทำเสร็จแล้วต้อง
  // ไม่ปรากฏใน tab เดิมอีกต่อไป ย้ายไป completedReminders แทน) และเพิ่ม
  // completedReminders เป็น tab ที่ 3
  /** ข้อความอธิบาย filter ที่กำลังเปิดอยู่ (ทั้งคู่พร้อมกันได้) สำหรับ empty-state — คืน "" ถ้าไม่มี filter ใดเปิดอยู่เลย */
  const describeActiveFilters = () => {
    const parts = [];
    if (activeTypeFilter) {
      const type = TYPE_FILTER_OPTIONS.find((option) => option.type === activeTypeFilter);
      parts.push(t("reminder.filterType", { type: t(type?.labelKey) }));
    }
    if (activeGroupFilter) parts.push(t("reminder.filterGroup", { group: groups.find((group) => group.id === activeGroupFilter)?.name }));
    return parts.join(" ");
  };



  const renderReminder = (reminder) => (
    <ReminderCard
      key={reminder.id}
      reminder={reminder}
      nowTick={nowTick}
      t={t}
      groups={groups}
      typeOptions={REMINDER_DISPLAY_TYPE_OPTIONS}
      daysOfWeek={DAYS_OF_WEEK}
      cardMenu={cardMenu}
      onFocusTimeline={focusReminderOnTimeline}
      onStartEdit={startEdit}
      onTriggerAnchor={triggerAnchorEvent}
      onAdvanceRoutine={advanceRoutine}
      onToggleStopwatch={toggleStopwatch}
      onResetStopwatch={resetStopwatch}
      onToggleReminder={toggleReminder}
      onToggleMenu={toggleCardMenu}
      onCloseMenu={closeCardMenu}
      onMarkCompleted={markCompleted}
      onDelete={deleteReminder}
    />
  );
  return (
    <div
      className="reminder-app-container"
      style={{
        "--timeline-now-color": timelineColors?.nowIndicator || "#ea4335"
      }}
    >

      {/* Top Bar — Omnibar แบบ rule-based (Phase 6); สถิติยังรอ Phase 7 */}
      <ReminderTopbar
        t={t} omnibarInput={omnibarInput} setOmnibarInput={setOmnibarInput}
        submitOmnibar={submitOmnibar} omnibarEnabled={omnibarEnabled} omnibarPreview={omnibarPreview}
        telegramConnection={telegramConnection} areTelegramAlertsEnabled={areTelegramAlertsEnabled}
        handleTelegramAlertToggle={handleTelegramAlertToggle} isPushEnabled={isPushEnabled} openStats={openStats}
      />

      <TelegramConnectionToast telegramConnection={telegramConnection} onClose={dismissTelegramStatus} />

      <ReminderStatsPanel isOpen={isStatsOpen} onClose={() => closeStats()} stats={reminderStats} />

      {/* Backdrop ปิดเมนู "⋮" การ์ด / snooze dropdown เมื่อคลิกนอกเมนู —
          ใช้ตัวเดียวร่วมกันทั้งสองระบบเมนู (migration plan v2 เฟส 1.3/1.4)
          เพราะเปิดได้ทีละเมนูอยู่แล้วในทางปฏิบัติ ไม่ต้อง portal/listener
          แยกต่างหาก */}
      <ReminderAlerts
        t={t} cardMenu={cardMenu} snoozeMenuForId={snoozeMenuForId} closeAllMenus={closeAllMenus}
        dueReminders={dueReminders} toggleSnoozeMenu={toggleSnoozeMenu} scheduleNext={scheduleNext}
        closeSnoozeMenu={closeSnoozeMenu} markCompleted={markCompleted}
      />

      {/* Main Body Grid — 3 คอลัมน์: nav ซ้าย / list กลาง / timeline ขวา
          (เดิม 2 คอลัมน์: timeline ซ้าย / list ขวา — ย้าย timeline ไปขวาสุด
          ตาม reminder-dashboard-mockup.jsx, migration plan v2 เฟส 1.1) */}
      {syncError && <p className="error-banner" role="alert">{syncError}</p>}
      {reminderCalendar.error && <p className="error-banner" role="alert">{reminderCalendar.error}</p>}
      {reminderCalendar.loading && <p role="status">กำลังโหลดกิจกรรมในปฏิทิน…</p>}
      <div className="dashboard-body">
        {/* Left Nav — มุมมองทั้งหมด/วันนี้/วันที่เลือก, ตัวกรองประเภท และ
            กลุ่ม/โปรเจกต์ ใช้ reminderDateFilter ชุดเดียวกับ list/timeline */}
        <ReminderSidebar
          reminderDateFilter={reminderDateFilter}
          setReminderDateFilter={setReminderDateFilter}
          todayReminderCount={todayReminderCount}
          selectedDateKey={selectedDateKey}
          selectDate={selectDate}
          reminders={remindersForDisplay}
          groups={groups}
          groupsError={groupsError}
          addGroup={addGroup}
          handleDeleteGroup={handleDeleteGroup}
          activeTypeFilter={activeTypeFilter}
          setActiveTypeFilter={setActiveTypeFilter}
          activeGroupFilter={activeGroupFilter}
          setActiveGroupFilter={setActiveGroupFilter}
          toggleGroupFilter={toggleGroupFilter}
          toggleTypeFilter={toggleTypeFilter}
          typeFilterOptions={TYPE_FILTER_OPTIONS}
        />

        <ReminderListPanel
          t={t}
          reminders={remindersForDisplay}
          groups={groups}
          typeOptions={TYPE_FILTER_OPTIONS}
          composerTypeOptions={editingId && draft.type === "event-anchored" ? REMINDER_DISPLAY_TYPE_OPTIONS : REMINDER_COMPOSER_TYPE_OPTIONS}
          daysOfWeek={DAYS_OF_WEEK}
          lineColorOptions={LINE_COLOR_OPTIONS}
          activeTypeFilter={activeTypeFilter}
          activeGroupFilter={activeGroupFilter}
          onClearTypeFilter={() => setActiveTypeFilter(null)}
          onClearGroupFilter={() => setActiveGroupFilter(null)}
          enabledReminders={enabledReminders}
          pausedReminders={pausedReminders}
          completedReminders={completedReminders}
          visibleEnabledReminders={visibleEnabledReminders}
          visiblePausedReminders={visiblePausedReminders}
          visibleCompletedReminders={visibleCompletedReminders}
          statusTab={reminderStatusTab}
          statusTabs={REMINDER_STATUS_TAB}
          onStatusTabChange={setReminderStatusTab}
          isComposerOpen={isComposerOpen}
          onToggleComposer={toggleComposer}
          composerProps={{
            draft, setDraft, editingId, preview: composerPreview, cardRef: composerCardRef,
            onSubmit: submitReminderForm, onCancel: cancelEditing,
            onDelete: deleteEditingReminder, onToggleDay: toggleDayInDraft
          }}
          renderReminder={renderReminder}
          describeActiveFilters={describeActiveFilters}
        />
        <ReminderTimelinePanel
          t={t}
          selectedDateKey={selectedDateKey}
          nowTick={nowTick}
          isExporting={isExporting}
          onExport={exportTimelineImage}
          zoomIndex={zoomIndex}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          minutesPerRow={minutesPerRow}
          zoomLevelCount={ZOOM_LEVELS_MINUTES.length}
          activityNowStatus={activityNowStatus}
          tapeScrollRef={tapeScrollRef}
          onUserInteraction={handleUserInteraction}
          timelineTrackMinWidth={timelineTrackMinWidth}
          spacerHeight={SPACER_HEIGHT_PX}
          timelineRows={<ReminderTimelineRows tapeRows={tapeRows} nowTick={nowTick} onEditReminder={startEdit} />}
          runningReminderSpans={runningReminderSpans}
          calendarTimelineBlocks={calendarTimelineBlocks}
          onEditActivity={onEditActivity}
          onOpenActivityMenu={openActivityContextMenu}
        />
        {activityContextMenu && (
          <ActivityPopup
            activity={activityContextMenu.block.activity}
            start={new Date(activityContextMenu.block.actualStartMs)}
            end={new Date(activityContextMenu.block.actualEndMs)}
            position={activityContextMenu.position}
            locked={Boolean(lockedActivities[normalizeActivityId(activityContextMenu.block.activity.id)])}
            categories={categories}
            categoryId={activityCategoryMap[normalizeActivityId(activityContextMenu.block.activity.id)] || null}
            tags={[]}
            displayColor={activityContextMenu.block.color.border}
            onClose={closeActivityContextMenu}
            onToggleLock={(isLocked) => onToggleActivityLock?.(normalizeActivityId(activityContextMenu.block.activity.id), isLocked)}
            restrictedToLock
          />
        )}
      </div>
    </div>
  );
}
