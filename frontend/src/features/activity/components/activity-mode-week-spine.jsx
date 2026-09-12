import React, { useEffect, useMemo } from "react";
import { formatTime, getWeekRange, getYearCycle, isSameDay, weekdayShortLabels } from "../../../shared/lib/date-utils.js";
import { buildWeekSpineData } from "../lib/week-spine-data.js";
import { getDisplayColor } from "../lib/activity-colors.js";
import { layoutOverlaps } from "../lib/timeline-layout.js";
import { useLanguage } from "../../../shared/i18n/i18n.jsx";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import ActivityPopup from "./activity-popup.jsx";
import AutoShrinkText from "../../../shared/ui/auto-shrink-text.jsx";
import { useWeekNames } from "../hooks/use-week-names.js";
import WeekNameField from "./week-name-field.jsx";
import FourWeekOverview from "./four-week-overview.jsx";
import { useWeekSpineFullscreen } from "../hooks/use-week-spine-fullscreen.js";
import { useWeekSpineSelection } from "../hooks/use-week-spine-selection.js";
import { useWeekSpineTimeChanges } from "../hooks/use-week-spine-time-changes.js";
import { useWeekSpineUiState } from "../hooks/use-week-spine-ui-state.js";
import { useWeekSpineDragState } from "../hooks/use-week-spine-drag-state.js";
import { useWeekSpineDragController } from "../hooks/use-week-spine-drag-controller.js";

import { useActivityArchive } from "../hooks/use-activity-archive.js";

const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const DAY_SPAN_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function minutesSinceDayStart(date, day) {
  const midnight = new Date(day);
  midnight.setHours(0, 0, 0, 0);
  return Math.round((date - midnight) / 60000);
}

/** Account-scoped timeline, cycle overview and archive presentation. */
export default function ActivityModeWeekSpine(props) {
  return <WeekSpineContent key={props.userId || "guest"} {...props} />;
}

function WeekSpineContent({
  anchorDate,
  activities,
  categories,
  activityCategoryMap,
  activityTagMap,
  lockedActivities,
  onAddActivity,
  onEditActivity,
  onSelectDay,
  onSaveTimes,
  onRestoreArchivedActivity,
  onAssignCategory,
  onToggleLock,
  onDeleteActivity,
  onDeleteSeries,
  onDuplicateActivity,
  onMoveActivityToDay,
  onEditSeries,
  onFetchSeriesCount,
  onNavigateWeek,
  onFocusArchiveTimeline,
  onOpenArchiveDraft,
  onEditArchivedActivity,
  userId,
  tokenNearingExpiry,
  onReauthCalendar,
  hoursPerCell = 1,
  onHoursPerCellChange,
  viewMode = "week",
  cycleStartDate,
  fullscreenRequestId = 0,
  onTimelineFullscreenChange,
  onSelectOverviewWeek,
  onSelectOverviewDay,
  onNavigateCycle,
  onOpenOverviewWeekEditor,
  onOpenOverviewWeekView,
  onFocusOverviewSummary,
  onFocusWeekSummary,
  cycleData = { activities: [], loading: false, error: "" },
  dayGantt,
}) {
  const { language } = useLanguage();
  const [weekStart, weekEnd] = getWeekRange(anchorDate);
  const cycle = getYearCycle(cycleStartDate || anchorDate);
  const cycleStart = cycle.start;
  const dragState = useWeekSpineDragState();
  const {
    draft,
    setDraft,
    dragged,
    setDragged,
    resizeAlignmentGuide,
    alignmentPulse,
    weekSpineGridRef,
    shouldSuppressBlockClick,
    clearDragFeedback
  } = dragState;
  const {
    selectedDay,
    selectDay,
    setSelectedDay,
    interactionWarning,
    showInteractionWarning,
    contextMenu,
    setContextMenu,
    isSummaryTargetHovered,
    setIsSummaryTargetHovered
  } = useWeekSpineUiState({ anchorDate, onSelectDay });
  // Selection is intentionally separate from timeline manipulation: it is a
  // collection for bulk deletion, not a modifier for moving/resizing blocks.
  const {
    isSelectionMode,
    selectedActivityIds,
    setIsSelectionMode,
    toggleActivitySelection,
    addActivitySelection
  } = useWeekSpineSelection({
    onDeleteActivity,
    onError: showInteractionWarning
  });
  const {
    pendingTimeChanges,
    undoTimeChangeHistory,
    redoTimeChangeHistory,
    isSavingTimeChanges,
    queueTimeChanges,
    undoTimeChange,
    redoTimeChange,
    discardPendingTimeChanges,
    savePendingTimeChanges,
    moveActivityToDay
  } = useWeekSpineTimeChanges({
    onSaveTimes,
    onMoveActivityToDay,
    onError: showInteractionWarning
  });
  const { timelineFullscreen, timelineFullscreenSurfaceRef, toggleTimelineFullscreen } = useWeekSpineFullscreen({
    viewMode,
    fullscreenRequestId,
    onTimelineFullscreenChange
  });
  const {
    weekNames: customWeekNames,
    editingWeekKey: editingWeekNameKey,
    weekNameDraft,
    setWeekNameDraft,
    startEditingWeekName,
    commitWeekName,
    cancelWeekNameEdit
  } = useWeekNames(userId);
  const {
    activityArchive, restoringCalendarIds, archiveTagDrafts, setArchiveTagDrafts,
    archiveTitleToFocus, setArchiveTitleToFocus, addArchiveDraft, updateArchivedActivity,
    updateArchiveCategory, updateArchivedDate, updateArchivedDuration,
    deleteArchivedActivity, archiveActivity, restoreArchivedActivity
  } = useActivityArchive({
    userId, activityCategoryMap, activityTagMap, onDeleteActivity,
    onRestoreArchivedActivity, onFocusArchiveTimeline, onOpenArchiveDraft,
    showInteractionWarning
  });
  const effectiveHoursPerCell = timelineFullscreen ? 1 : hoursPerCell;
  const hourMarks = useMemo(() => Array.from({ length: (DAY_END_HOUR - DAY_START_HOUR) / effectiveHoursPerCell + 1 }, (_, index) => DAY_START_HOUR + index * effectiveHoursPerCell), [effectiveHoursPerCell]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + offset);
    return day;
  }), [weekStart.getTime()]);
  const { activities: fourWeekActivities, loading: fourWeekLoading, error: fourWeekError } = cycleData;
  const timelineActivities = useMemo(() => activities.map((activity) => {
    const pending = pendingTimeChanges.get(activity.id);
    if (!pending) return activity;
    return {
      ...activity,
      start: { ...activity.start, dateTime: pending.start.toISOString() },
      end: { ...activity.end, dateTime: pending.end.toISOString() }
    };
  }), [activities, pendingTimeChanges]);
  const { timedSegments, allDayActivities } = useMemo(
    () => buildWeekSpineData({ activities: timelineActivities, weekStart, weekEnd, activityCategoryMap, categories, lockedActivities }),
    [timelineActivities, weekStart, weekEnd, activityCategoryMap, categories, lockedActivities]
  );
  const archivedCalendarIds = useMemo(
    () => new Set(activityArchive.map((item) => item.calendarId).filter(Boolean)),
    [activityArchive]
  );
  const timelineSegments = timedSegments.filter((segment) => !archivedCalendarIds.has(segment.calendarId) || restoringCalendarIds.has(segment.calendarId));
  const visibleAllDayActivities = allDayActivities.filter((activity) => !archivedCalendarIds.has(activity.calendarId) || restoringCalendarIds.has(activity.calendarId));
  const {
    beginDraft,
    updateDraft,
    finishDraft,
    beginExistingDrag,
    beginAllDayDrag,
    beginDuplicatePlacement,
    updateExistingDrag,
    finishExistingDrag
  } = useWeekSpineDragController({
    dragState,
    weekDays,
    timelineSegments,
    isSelectionMode,
    selectedActivityIds,
    toggleActivitySelection,
    queueTimeChanges,
    onAddActivity,
    onEditActivity,
    onDuplicateActivity,
    onMoveActivityToDay: moveActivityToDay,
    showInteractionWarning
  });
  const visibleSelectedDay = weekDays.find((day) => isSameDay(day, selectedDay)) || weekDays[0];
  const labels = weekdayShortLabels(language);
  const today = new Date();

  const isSummaryBackgroundTarget = (target) => target instanceof Element
    && !target.closest("button, input, select, textarea, [contenteditable='true'], .week-spine-track, .week-spine-block, .week-spine-day, .activity-archive");

  const focusSummaryFromWeekSpine = (event) => {
    const target = event.target;
    // Background clicks are a lightweight way back to the relevant summary.
    // Do not steal the click from any timeline editing/control surface.
    if (!isSummaryBackgroundTarget(target)) return;
    if (viewMode === "four-weeks") onFocusOverviewSummary?.();
    else onFocusWeekSummary?.();
  };

  const updateSummaryHover = (event) => {
    const nextValue = isSummaryBackgroundTarget(event.target);
    setIsSummaryTargetHovered((current) => current === nextValue ? current : nextValue);
  };

  const navigateWeekBy = (delta) => {
    const nextSelectedDay = new Date(visibleSelectedDay);
    nextSelectedDay.setDate(nextSelectedDay.getDate() + delta * 7);
    setSelectedDay(nextSelectedDay);
    onSelectDay?.(nextSelectedDay);
    onNavigateWeek?.(delta);
  };

  const openContextMenu = (event, segment) => {
    event.preventDefault();
    if (segment.source.isOnboardingSample) {
      showInteractionWarning("นี่คือกิจกรรมตัวอย่างในเครื่อง — คลิกเพื่อสร้างกิจกรรมจริงจากตัวอย่างนี้");
      return;
    }
    event.stopPropagation();
    setContextMenu({
      segment,
      position: { x: event.clientX, y: event.clientY },
    });
  };

  const openSegmentEditor = (segment) => {
    if (segment.source.isOnboardingSample) {
      onAddActivity?.(segment.start, { preserveTime: true, end: segment.end, title: segment.title });
      return;
    }
    onEditActivity?.(segment.source);
  };

  return (
    <div className="week-spine-layout">
      <section className={`week-spine${isSummaryTargetHovered ? " is-summary-target-hovered" : ""}`} aria-label="Activity Week Spine" onClick={focusSummaryFromWeekSpine} onPointerMove={updateSummaryHover} onPointerLeave={() => setIsSummaryTargetHovered(false)}>
        {viewMode === "four-weeks" ? (
          fourWeekLoading ? <p className="week-spine-overview-state">กำลังโหลดกิจกรรม 4 สัปดาห์…</p>
            : fourWeekError ? <p className="week-spine-overview-state is-error">{fourWeekError}</p>
              : <FourWeekOverview weekStart={cycleStart} weekCount={cycle.weekCount} focusedWeekDate={anchorDate} activities={fourWeekActivities} categories={categories} activityCategoryMap={activityCategoryMap} lockedActivities={lockedActivities} weekNames={customWeekNames} editingWeekKey={editingWeekNameKey} weekNameDraft={weekNameDraft} onStartEditingWeekName={startEditingWeekName} onWeekNameDraftChange={setWeekNameDraft} onCommitWeekName={commitWeekName} onCancelWeekName={cancelWeekNameEdit} language={language} onSelectWeek={onSelectOverviewWeek} onSelectDay={onSelectOverviewDay} onNavigateCycle={onNavigateCycle} onOpenWeekEditor={onOpenOverviewWeekEditor} onOpenWeekView={onOpenOverviewWeekView} />
        ) : <>
        <section ref={timelineFullscreenSurfaceRef} className={`week-spine-timeline-surface${timelineFullscreen ? " is-fullscreen" : ""}${effectiveHoursPerCell === 2 ? " is-two-hour-grid" : ""}${effectiveHoursPerCell === 4 ? " is-four-hour-grid" : ""}`}>
        <button className="week-spine-fullscreen-btn" type="button" onClick={toggleTimelineFullscreen} aria-label={timelineFullscreen ? "ออกจากเต็มหน้าจอ" : "เปิด timeline แบบเต็มหน้าจอ"} title={timelineFullscreen ? "ออกจากเต็มหน้าจอ" : "เต็มหน้าจอ"}>{timelineFullscreen ? "⤢" : "⛶"}</button>
        {(pendingTimeChanges.size > 0 || undoTimeChangeHistory.length > 0 || redoTimeChangeHistory.length > 0) && <div className="week-spine-save-bar" role="status">
          <span>มีการปรับเวลา {pendingTimeChanges.size} รายการ</span>
          <button type="button" className="week-spine-history-btn" onClick={undoTimeChange} disabled={isSavingTimeChanges || undoTimeChangeHistory.length === 0} aria-label="ย้อนกลับ" title="ย้อนกลับ">↶</button>
          <button type="button" className="week-spine-history-btn" onClick={redoTimeChange} disabled={isSavingTimeChanges || redoTimeChangeHistory.length === 0} aria-label="ทำซ้ำ" title="ทำซ้ำ">↷</button>
          <button type="button" onClick={discardPendingTimeChanges} disabled={isSavingTimeChanges}>ยกเลิก</button>
          <button type="button" className="week-spine-save-btn" onClick={savePendingTimeChanges} disabled={isSavingTimeChanges || pendingTimeChanges.size === 0}>{isSavingTimeChanges ? "กำลังบันทึก..." : "บันทึก"}</button>
        </div>}
        <div className="week-spine-edge-nav" aria-label="เปลี่ยนสัปดาห์">
          <button type="button" className="week-spine-edge-nav-prev" onClick={() => navigateWeekBy(-1)} aria-label="สัปดาห์ก่อนหน้า">‹</button>
          <button type="button" className="week-spine-edge-nav-next" onClick={() => navigateWeekBy(1)} aria-label="สัปดาห์ถัดไป">›</button>
        </div>
        {interactionWarning && <p className="error-banner" role="alert">{interactionWarning}</p>}
        {timelineFullscreen && tokenNearingExpiry && <div className="week-spine-token-prompt" role="alert"><span>สิทธิ์ Google Calendar ใกล้หมดอายุ</span><button type="button" onClick={onReauthCalendar}>ต่ออายุตอนนี้</button></div>}
      <div ref={weekSpineGridRef} className="week-spine-grid-wrap">
        {!timelineFullscreen && <div className="week-spine-density-control" role="group" aria-label="ความละเอียด Week Spine">
          <button type="button" className={hoursPerCell === 1 ? "is-active" : ""} onClick={() => onHoursPerCellChange?.(1)} aria-pressed={hoursPerCell === 1} title="1 ชั่วโมงต่อช่อง">1h</button>
          <button type="button" className={hoursPerCell === 2 ? "is-active" : ""} onClick={() => onHoursPerCellChange?.(2)} aria-pressed={hoursPerCell === 2} title="2 ชั่วโมงต่อช่อง">2h</button>
          <button type="button" className={hoursPerCell === 4 ? "is-active" : ""} onClick={() => onHoursPerCellChange?.(4)} aria-pressed={hoursPerCell === 4} title="4 ชั่วโมงต่อช่อง">4h</button>
        </div>}
        {!timelineFullscreen && <aside className="week-spine-week-glance-demo" aria-label="ชื่อสัปดาห์">
          <WeekNameField className="week-spine-week-name" weekStart={weekStart} weekNames={customWeekNames} editingWeekKey={editingWeekNameKey} weekNameDraft={weekNameDraft} onStartEditing={startEditingWeekName} onDraftChange={setWeekNameDraft} onCommit={commitWeekName} onCancel={cancelWeekNameEdit} />
        </aside>}
        <div className="week-spine-hours" aria-hidden="true" style={{ "--week-spine-hour-cell-count": (DAY_END_HOUR - DAY_START_HOUR) / effectiveHoursPerCell }}>
          {hourMarks.map((hour) => <span key={hour} style={{ top: `${((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}
        </div>
        {resizeAlignmentGuide && <span className="week-spine-resize-alignment-guide" aria-hidden="true" style={{ top: `${resizeAlignmentGuide.top}px` }} />}
        <div className="week-spine-days">
          {weekDays.map((day, index) => {
            const daySegments = timelineSegments.filter((segment) => isSameDay(segment.day, day));
            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            const dayAllDayActivities = visibleAllDayActivities.filter((activity) => activity.start < dayEnd && activity.end > dayStart);
            const laneLayout = layoutOverlaps(daySegments.map((segment) => ({
              id: segment.segmentId,
              startMin: Math.max(DAY_START_HOUR * 60, minutesSinceDayStart(segment.start, day)),
              endMin: Math.min(DAY_END_HOUR * 60, minutesSinceDayStart(segment.end, day)),
            })));
            const isSelected = isSameDay(day, visibleSelectedDay);
            const isToday = isSameDay(day, today);
            return (
              <button
                className={`week-spine-day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                key={day.toISOString()}
                type="button"
                onClick={() => selectDay(day)}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
              >
                <span className="week-spine-day-label">{labels[index]}</span>
                <strong><span>{day.getDate()}</span></strong>
                <span className="week-spine-track" data-day-index={index} onPointerDown={(event) => beginDraft(event, day)} onPointerMove={(event) => { updateDraft(event); updateExistingDrag(event); }} onPointerUp={(event) => { finishDraft(event); finishExistingDrag(event); }} onPointerCancel={() => { setDraft(null); setDragged(null); clearDragFeedback(); }}>
                  {dayAllDayActivities.filter((activity) => !(dragged?.isAllDay && dragged.calendarId === activity.calendarId)).map((activity, allDayIndex) => <span
                    key={`all-day:${activity.calendarId}`}
                    className={`week-spine-block week-spine-all-day-track-block${activity.isLocked ? " is-locked" : ""}`}
                    style={{ top: "0%", height: "100%", left: `${3 + allDayIndex * 3}px`, width: `calc(100% - ${6 + allDayIndex * 3}px)`, zIndex: allDayIndex, backgroundColor: activity.color.border }}
                    title={activity.isLocked ? `${activity.title} (ล็อกอยู่)` : `แก้ไข ${activity.title}`}
                    onPointerDown={(event) => beginAllDayDrag(event, activity, day)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (shouldSuppressBlockClick.current) {
                        shouldSuppressBlockClick.current = false;
                        return;
                      }
                      if (activity.isLocked) {
                        showInteractionWarning("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนแก้ไข");
                        return;
                      }
                      onEditActivity?.(activity.source);
                    }}
                    onContextMenu={(event) => openContextMenu(event, activity)}
                  ><AutoShrinkText text={activity.title} minScale={0.01} baseFontSize="10px" className="week-spine-block-title" /></span>)}
                  {dragged?.isAllDay && isSameDay(dragged.day, day) && <span
                    className="week-spine-block week-spine-all-day-track-block is-dragging"
                    style={{ top: "0%", height: "100%", left: "3px", width: "calc(100% - 6px)", zIndex: 100, backgroundColor: getDisplayColor(dragged.source, activityCategoryMap, categories).border }}
                    aria-hidden="true"
                  ><AutoShrinkText text={dragged.source?.summary || "(ไม่มีชื่อกิจกรรม)"} minScale={0.01} baseFontSize="10px" className="week-spine-block-title" /></span>}
                  {daySegments.map((segment) => {
                    const start = Math.max(DAY_START_HOUR * 60, minutesSinceDayStart(segment.start, day));
                    const end = Math.min(DAY_END_HOUR * 60, minutesSinceDayStart(segment.end, day));
                    const top = ((start - DAY_START_HOUR * 60) / DAY_SPAN_MINUTES) * 100;
                    const height = Math.max(1.5, ((end - start) / DAY_SPAN_MINUTES) * 100);
                    const lane = laneLayout[segment.segmentId] || { stackIndex: 0, hidden: false, hiddenCount: 0, stackZ: 1, titleBelow: false, titleOffsetMinutes: 0 };
                    if (lane.hidden) return null;
                    const stackOffset = lane.stackIndex * 10;
                    const titleOffsetPercent = lane.titleOffsetMinutes ? (lane.titleOffsetMinutes / Math.max(1, segment.end - segment.start)) * 6000000 : 0;
                    if (dragged?.calendarId === segment.calendarId) return null;
                    const continuationClass = segment.continuesFromPreviousDay || segment.continuesIntoNextDay ? " is-continuation" : "";
                    const hasAlignmentPulse = alignmentPulse?.activityIds.has(segment.calendarId);
                    return <span key={segment.segmentId} title={`${segment.title}${segment.source.isOnboardingSample ? " (ตัวอย่าง)" : ""}${segment.continuesFromPreviousDay ? " (ต่อเนื่องจากวันก่อน)" : ""}${segment.continuesIntoNextDay ? " (ต่อเนื่องวันถัดไป)" : ""}`} className={`week-spine-block${segment.isLocked || segment.source.isOnboardingSample || segment.continuesFromPreviousDay || segment.continuesIntoNextDay ? "" : " is-draggable"}${continuationClass}${lane.titleBelow ? " has-stacked-title" : ""}${selectedActivityIds.has(segment.calendarId) ? " is-series-selected" : ""}${hasAlignmentPulse ? " is-alignment-pulse" : ""}`} style={{ top: `${top}%`, height: `${height}%`, left: "3px", width: `calc(100% - ${6 + stackOffset}px)`, zIndex: lane.stackZ, backgroundColor: continuationClass ? segment.color.bg : segment.color.border, color: segment.color.border, borderLeftColor: segment.color.border }} onPointerDown={(event) => { if (!segment.source.isOnboardingSample && (!isSelectionMode || selectedActivityIds.has(segment.calendarId))) beginExistingDrag(event, segment, day, "move"); }} onClick={(event) => { event.stopPropagation(); if (shouldSuppressBlockClick.current) { shouldSuppressBlockClick.current = false; return; } if (isSelectionMode || event.ctrlKey || event.metaKey) { toggleActivitySelection(segment.calendarId); return; } openSegmentEditor(segment); }} onContextMenu={(event) => openContextMenu(event, segment)}>
                      <AutoShrinkText text={segment.title} minScale={0.01} baseFontSize="12px" className={`week-spine-block-title${lane.titleBelow ? " is-stacked" : ""}${titleOffsetPercent > 0 ? " is-relocated" : ""}`} style={titleOffsetPercent > 0 ? { top: `${titleOffsetPercent}%` } : undefined} />
                      {lane.hiddenCount > 0 && <small className="week-spine-overflow-count">+{lane.hiddenCount}</small>}
                      {(!isSelectionMode || selectedActivityIds.has(segment.calendarId)) && !segment.isLocked && !segment.source.isOnboardingSample && !segment.continuesFromPreviousDay && !segment.continuesIntoNextDay && <span className="week-spine-resize-handle" onPointerDown={(event) => beginExistingDrag(event, segment, day, "resize")} />}
                    </span>;
                  })}
                  {draft && isSameDay(draft.day, day) && <span className="week-spine-draft" style={{ top: `${((draft.startMinutes - DAY_START_HOUR * 60) / DAY_SPAN_MINUTES) * 100}%`, height: `${((draft.endMinutes - draft.startMinutes) / DAY_SPAN_MINUTES) * 100}%` }} />}
                  {dragged && !dragged.isAllDay && isSameDay(dragged.day, day) && <span className="week-spine-block is-dragging" style={{ top: `${((dragged.startMinutes - DAY_START_HOUR * 60) / DAY_SPAN_MINUTES) * 100}%`, height: `${((dragged.endMinutes - dragged.startMinutes) / DAY_SPAN_MINUTES) * 100}%`, zIndex: 100, backgroundColor: dragged.source ? timelineSegments.find((segment) => segment.calendarId === dragged.calendarId)?.color.border : undefined }}><AutoShrinkText text={dragged.source?.summary || "(ไม่มีชื่อกิจกรรม)"} minScale={0.01} baseFontSize="12px" className="week-spine-block-title" /></span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {contextMenu && <ActivityPopup
        activity={contextMenu.segment.source}
        start={contextMenu.segment.start}
        end={contextMenu.segment.end}
        position={contextMenu.position}
        locked={contextMenu.segment.isLocked}
        categories={categories}
        categoryId={activityCategoryMap[normalizeActivityId(contextMenu.segment.calendarId)] || null}
        tags={activityTagMap?.[normalizeActivityId(contextMenu.segment.calendarId)] || []}
        displayColor={contextMenu.segment.color.border}
        onClose={() => setContextMenu(null)}
        onAssignCategory={(categoryId) => onAssignCategory?.(normalizeActivityId(contextMenu.segment.calendarId), categoryId)}
        onToggleLock={(locked) => onToggleLock?.(normalizeActivityId(contextMenu.segment.calendarId), locked)}
        onEditActivity={() => { setContextMenu(null); onEditActivity?.(contextMenu.segment.source); }}
        onEditSeries={() => { setContextMenu(null); onEditSeries?.(contextMenu.segment.source); }}
        // IMPORTANT: Google Calendar needs the raw occurrence id here.
        // normalizeActivityId() removes the recurrence suffix and turns this
        // into the master series id, which would delete every occurrence.
        onDelete={() => onDeleteActivity?.(contextMenu.segment.calendarId)}
        onDeleteSeries={() => onDeleteSeries?.(contextMenu.segment.source.recurringEventId)}
              onSelectSeriesDrag={() => addActivitySelection(contextMenu.segment.calendarId)}
        onDuplicate={() => beginDuplicatePlacement(contextMenu.segment.source)}
        onMoveToDay={(date) => moveActivityToDay(contextMenu.segment.calendarId, date)}
        onFetchSeriesCount={() => onFetchSeriesCount?.(contextMenu.segment.source.recurringEventId)}
        onArchive={() => archiveActivity(contextMenu.segment)}
      />}
        </section>
      </>}
      </section>
      {viewMode !== "four-weeks" && <>
      {dayGantt}
      <section className="activity-archive" aria-label="คลังกิจกรรม">
        <div className="activity-archive-heading"><h3>คลังกิจกรรม</h3><span>{activityArchive.length} รายการ</span><button type="button" className="activity-archive-add" onClick={addArchiveDraft}>+ เพิ่มกิจกรรม</button></div>
        {activityArchive.length === 0 ? <p>ยังไม่มีกิจกรรมที่เก็บไว้</p> : (
          <ol className="activity-archive-list">
            {activityArchive.map((item) => <li key={item.archiveId}>
              <span className="activity-archive-main"><span className="activity-archive-title-row"><input className="activity-archive-title-input" autoFocus={archiveTitleToFocus === item.archiveId} value={item.title} onFocus={() => { if (archiveTitleToFocus === item.archiveId) setArchiveTitleToFocus(null); }} onChange={(event) => updateArchivedActivity(item.archiveId, "title", event.target.value)} aria-label="ชื่อกิจกรรม" />{(item.tags || []).map((tag) => <small className="activity-inline-tag" key={tag}>#{tag}<button type="button" onClick={() => updateArchivedActivity(item.archiveId, "tags", (item.tags || []).filter((savedTag) => savedTag !== tag))} aria-label={`ลบ tag ${tag}`}>✕</button></small>)}{Object.hasOwn(archiveTagDrafts, item.archiveId) ? <input className="activity-archive-tag-input" autoFocus value={archiveTagDrafts[item.archiveId]} placeholder="tag" onChange={(event) => setArchiveTagDrafts((current) => ({ ...current, [item.archiveId]: event.target.value }))} onBlur={() => setArchiveTagDrafts((current) => { const next = { ...current }; delete next[item.archiveId]; return next; })} onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); const tag = archiveTagDrafts[item.archiveId]?.trim(); if (tag) updateArchivedActivity(item.archiveId, "tags", [...(item.tags || []), tag]); setArchiveTagDrafts((current) => { const next = { ...current }; delete next[item.archiveId]; return next; }); }} /> : <button type="button" className="activity-archive-tag-add" onClick={() => setArchiveTagDrafts((current) => ({ ...current, [item.archiveId]: "" }))} aria-label="ใส่ tag" title="เพิ่ม tag">+ Tag</button>}</span>{item.start && <span className="activity-archive-original-time">{new Date(item.start).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}</span>
              <><label className="activity-archive-field"><span>เริ่ม</span><span className="activity-archive-time-input"><input type="datetime-local" value={toDateTimeLocalValue(item.start)} onChange={(event) => updateArchivedActivity(item.archiveId, "start", event.target.value)} />{!item.start && <em>-- --</em>}</span><button type="button" onClick={() => updateArchivedActivity(item.archiveId, "start", "")}>✕</button></label><label className="activity-archive-field"><span>จบ</span><span className="activity-archive-time-input"><input type="datetime-local" value={toDateTimeLocalValue(item.end)} onChange={(event) => updateArchivedActivity(item.archiveId, "end", event.target.value)} />{!item.end && <em>-- --</em>}</span><button type="button" onClick={() => updateArchivedActivity(item.archiveId, "end", "")}>✕</button></label></>
              <label className="activity-archive-category"><span className="activity-archive-category-color" style={{ backgroundColor: categories.find((category) => category.id === item.categoryId)?.color || "transparent" }} /><select value={item.categoryId || ""} onChange={(event) => updateArchiveCategory(item, event.target.value || null)}><option value="">ไม่กำหนดหมวดหมู่</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{item.categoryId && <button type="button" onClick={() => updateArchiveCategory(item, null)} aria-label="ลบหมวดหมู่">✕</button>}</label>
              <div className="activity-archive-actions"><button type="button" className="activity-archive-edit" onClick={() => { if (item.isDraft) { onOpenArchiveDraft?.(item); return; } onEditArchivedActivity?.(item.calendarId); }} aria-label={`แก้ไข ${item.title}`} title="แก้ไขกิจกรรม">✎</button><button type="button" className="activity-archive-restore" onClick={() => restoreArchivedActivity(item)} aria-label={`ส่ง ${item.title} กลับไป Timeline`} title="ส่งไป Timeline">↗</button><button type="button" className="activity-archive-delete" onClick={() => deleteArchivedActivity(item.archiveId)} aria-label={`ลบ ${item.title} ออกจากคลัง`} title="ลบจากคลัง">🗑</button></div>
            </li>)}
          </ol>
        )}
      </section>
      </>}
    </div>
  );
}
