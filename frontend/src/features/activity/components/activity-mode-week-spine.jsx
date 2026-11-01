import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatTime, getWeekRange, getYearWeekRange, getYearCycle, isSameDay, weekdayShortLabels } from "../../../shared/lib/date-utils.js";
import { buildWeekSpineData } from "../lib/week-spine-data.js";
import { useLanguage } from "../../../shared/i18n/i18n.jsx";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import ActivityPopup from "./activity-popup.jsx";
import ActivitySummaryHero from "./activity-summary-hero.jsx";
import { useWeekSpineTimeChanges } from "../hooks/use-week-spine-time-changes.js";
import { activityDate } from "../../../shared/lib/date-utils.js";
import { applyTimeDraft } from "../lib/planner-time-draft.js";
import ActivityDailyPlanner from "./activity-daily-planner.jsx";
import { PopupLayerItem } from "../../../shared/ui/popup-layer.jsx";
import { useWeekNames } from "../hooks/use-week-names.js";
import WeekNameField from "./week-name-field.jsx";
import FourWeekOverview from "./four-week-overview.jsx";
import { useWeekSpineSelection } from "../hooks/use-week-spine-selection.js";
import { useWeekSpineUiState } from "../hooks/use-week-spine-ui-state.js";

import { useActivityArchive } from "../hooks/use-activity-archive.js";

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function PlannerGuideBridges({ draft }) {
  const [lines, setLines] = useState([]);
  useLayoutEffect(() => {
    if (!draft) { setLines([]); return; }
    const measure = () => {
      const groups = new Map();
      document.querySelectorAll(".daily-planner .planner-alignment-guide").forEach(el => {
        const rect = el.getBoundingClientRect();
        const key = el.dataset.minute;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(rect);
      });
      setLines([...groups].flatMap(([key, rects]) => {
        const planners = [...document.querySelectorAll(".daily-planner-lanes")].map(el => el.getBoundingClientRect()).sort((a, b) => a.top - b.top);
        if (planners.length < 2) return [];
        return [{ key, left: rects[0].left, top: planners[0].top, height: planners.at(-1).bottom - planners[0].top }];
      }));
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); };
  }, [draft]);
  return createPortal(lines.map(line => <span key={line.key} className="planner-guide-bridge" style={{ left: line.left, top: line.top, height: line.height }} aria-hidden="true" />), document.body);
}

/** Account-scoped timeline, cycle overview and archive presentation. */
export default function ActivityModeWeekSpine(props) {
  return <WeekSpineContent key={props.userId || "guest"} {...props} />;
}

function WeekSpineContent({
  anchorDate,
  activities,
  activitiesLoading = false,
  summaryHeader,
  categories,
  activityCategoryMap,
  activityTagMap,
  lockedActivities,
  onAddActivity,
  onEditActivity,
  onSaveTimes,
  onSelectDay,
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
  viewMode = "week",
  weekRangeOverride,
  cycleStartDate,
  onSelectOverviewWeek,
  onSelectOverviewDay,
  onNavigateCycle,
  onOpenOverviewWeekEditor,
  onOpenOverviewWeekView,
  onFocusOverviewSummary,
  onFocusWeekSummary,
  cycleData = { activities: [], loading: false, error: "" },
}) {
  const { language } = useLanguage();
  const [defaultWeekStart, defaultWeekEnd] = getYearWeekRange(anchorDate);
  const weekStart = weekRangeOverride?.start instanceof Date ? weekRangeOverride.start : defaultWeekStart;
  const weekEnd = weekRangeOverride?.end instanceof Date ? weekRangeOverride.end : defaultWeekEnd;
  const visibleYearStart = useMemo(() => new Date(anchorDate.getFullYear(), 0, 1), [anchorDate.getFullYear()]);
  const visibleYearEnd = useMemo(() => new Date(anchorDate.getFullYear(), 11, 31, 23, 59, 59, 999), [anchorDate.getFullYear()]);
  const visibleWeekStart = weekStart < visibleYearStart ? visibleYearStart : weekStart;
  const visibleWeekEnd = weekEnd > visibleYearEnd ? visibleYearEnd : weekEnd;
  const cycle = getYearCycle(cycleStartDate || anchorDate);
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
    toggleActivitySelection,
    addActivitySelection,
    clearSelection
  } = useWeekSpineSelection({
    onDeleteActivity,
    onError: showInteractionWarning
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
  const weekDays = useMemo(() => {
    const [calendarWeekStart] = getWeekRange(weekStart);
    return Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(calendarWeekStart);
      day.setDate(day.getDate() + offset);
      return day;
    });
  }, [weekStart.getTime()]);
  const timelineRef = useRef(null);
  const [timelineFullscreen, setTimelineFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setTimelineFullscreen(document.fullscreenElement === timelineRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleTimelineFullscreen = async () => {
    try {
      if (document.fullscreenElement === timelineRef.current) await document.exitFullscreen();
      else await timelineRef.current?.requestFullscreen();
    } catch { showInteractionWarning("ไม่สามารถเปิดเต็มจอได้ในขณะนี้"); }
  };
  const [summaryDrag, setSummaryDrag] = useState(null);
  const [openPlannerDays, setOpenPlannerDays] = useState(() => new Set());
  useEffect(() => { setOpenPlannerDays(new Set()); }, [weekDays, viewMode]);
  const togglePlanner = dayKey => {
    clearSelection();
    setContextMenu(null);
    setOpenPlannerDays(current => {
      const next = new Set(current);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  };
  const closePlanner = dayKey => {
    setOpenPlannerDays(current => { const next = new Set(current); next.delete(dayKey); return next; });
    requestAnimationFrame(() => document.getElementById(`week-spine-planner-${dayKey}`)?.focus({ preventScroll: true }));
  };
  const [expandedDays, setExpandedDays] = useState(() => new Set());
  useEffect(() => { setExpandedDays(new Set()); }, [weekDays, viewMode]);
  const toggleExpandedDay = (key) => setExpandedDays(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const { activities: fourWeekActivities, loading: fourWeekLoading, error: fourWeekError } = cycleData;
  const timeChanges = useWeekSpineTimeChanges({ onSaveTimes, onError: showInteractionWarning });
  const timelineActivities = useMemo(() => activities.map(activity => applyTimeDraft(activity, (timeChanges.dragPreview?.id === activity.id ? timeChanges.dragPreview : timeChanges.pendingTimeChanges.get(activity.id)))), [activities, timeChanges.pendingTimeChanges, timeChanges.dragPreview]);
  const { timedSegments, allDayActivities } = useMemo(
    () => buildWeekSpineData({ activities: timelineActivities, weekStart: visibleWeekStart, weekEnd: visibleWeekEnd, activityCategoryMap, categories, lockedActivities }),
    [timelineActivities, visibleWeekStart, visibleWeekEnd, activityCategoryMap, categories, lockedActivities]
  );
  const archivedCalendarIds = useMemo(
    () => new Set(activityArchive.map((item) => item.calendarId).filter(Boolean)),
    [activityArchive]
  );
  const timelineSegments = timedSegments.filter((segment) => !archivedCalendarIds.has(segment.calendarId) || restoringCalendarIds.has(segment.calendarId));
  const visibleAllDayActivities = allDayActivities.filter((activity) => !archivedCalendarIds.has(activity.calendarId) || restoringCalendarIds.has(activity.calendarId));
  const summaryActivities = timelineActivities.filter((activity) => !archivedCalendarIds.has(activity.id) || restoringCalendarIds.has(activity.id));
  const visibleSelectedDay = weekDays.find((day) => day >= weekStart && day <= weekEnd && isSameDay(day, selectedDay))
    || weekDays.find((day) => day >= weekStart && day <= weekEnd)
    || weekDays[0];
  const labels = weekdayShortLabels(language);
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const isSummaryBackgroundTarget = (target) => target instanceof Element
    && !target.closest("button, input, select, textarea, [contenteditable='true'], .week-spine-track, .week-spine-block, .week-spine-day, .activity-archive, .daily-planner");

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
      {viewMode === "week" && <ActivitySummaryHero header={summaryHeader} days={weekDays} visibleStart={visibleWeekStart} visibleEnd={visibleWeekEnd} activities={summaryActivities} categories={categories} activityCategoryMap={activityCategoryMap} loading={activitiesLoading} weekName={<aside className="week-spine-week-glance-demo" aria-label="ชื่อสัปดาห์">
          <WeekNameField className="week-spine-week-name" weekStart={visibleWeekStart} weekNames={customWeekNames} editingWeekKey={editingWeekNameKey} weekNameDraft={weekNameDraft} onStartEditing={startEditingWeekName} onDraftChange={setWeekNameDraft} onCommit={commitWeekName} onCancel={cancelWeekNameEdit} />
        </aside>} />}
      <section className={`week-spine${isSummaryTargetHovered ? " is-summary-target-hovered" : ""}`} aria-label="Activity Week Spine" onClick={focusSummaryFromWeekSpine} onPointerMove={updateSummaryHover} onPointerLeave={() => setIsSummaryTargetHovered(false)}>
        {viewMode === "four-weeks" ? (
          fourWeekLoading ? <p className="week-spine-overview-state">กำลังโหลดกิจกรรม 4 สัปดาห์…</p>
            : fourWeekError ? <p className="week-spine-overview-state is-error">{fourWeekError}</p>
              : <FourWeekOverview weeks={cycle.weeks} cycleStart={cycle.start} cycleEnd={cycle.end} focusedWeekDate={anchorDate} activities={fourWeekActivities} categories={categories} activityCategoryMap={activityCategoryMap} lockedActivities={lockedActivities} weekNames={customWeekNames} editingWeekKey={editingWeekNameKey} weekNameDraft={weekNameDraft} onStartEditingWeekName={startEditingWeekName} onWeekNameDraftChange={setWeekNameDraft} onCommitWeekName={commitWeekName} onCancelWeekName={cancelWeekNameEdit} language={language} onSelectWeek={onSelectOverviewWeek} onSelectDay={onSelectOverviewDay} onNavigateCycle={onNavigateCycle} onOpenWeekEditor={onOpenOverviewWeekEditor} onOpenWeekView={onOpenOverviewWeekView} />
        ) : <>
        <section ref={timelineRef} className={`week-spine-timeline-surface${timelineFullscreen ? " is-fullscreen" : ""}`} aria-label="ปฏิทิน 7 วัน" tabIndex={0}>
        <PlannerGuideBridges draft={timeChanges.dragPreview} />
        {interactionWarning && <PopupLayerItem id="week-spine-interaction-warning" region="bottom-center" priority={65}><p className="error-banner" role="alert">{interactionWarning}</p></PopupLayerItem>}
      <div className="week-spine-grid-wrap week-spine-list-grid">
        <div className="week-spine-edge-nav" aria-label="เปลี่ยนสัปดาห์">
          <button type="button" className="week-spine-edge-nav-prev" onClick={() => navigateWeekBy(-1)} aria-label="สัปดาห์ก่อนหน้า">‹</button>
          <button type="button" className="week-spine-edge-nav-next" onClick={() => navigateWeekBy(1)} aria-label="สัปดาห์ถัดไป">›</button>
          <button type="button" onClick={toggleTimelineFullscreen} aria-label={timelineFullscreen ? "ออกจากเต็มจอ" : "แสดงปฏิทินเต็มจอ"} title={timelineFullscreen ? "ออกจากเต็มจอ" : "แสดงปฏิทินเต็มจอ"}>{timelineFullscreen ? "×" : "⛶"}</button>
        </div>
        <div className="week-spine-days">
          {weekDays.map((day, index) => {
            const isOutsideVisibleYear = day < weekStart || day > weekEnd;
            const daySegments = timelineSegments.filter((segment) => isSameDay(segment.day, day));
            const dayEnd = new Date(day);
            dayEnd.setDate(dayEnd.getDate() + 1);
            const dayAllDayActivities = visibleAllDayActivities.filter((activity) => activity.start < dayEnd && activity.end > day);
            const dayActivities = [...new Map([...dayAllDayActivities, ...daySegments].map(activity => [activity.calendarId, activity])).values()]
              .sort((a, b) => Math.max(+a.start, +day) - Math.max(+b.start, +day) || a.title.localeCompare(b.title) || a.calendarId.localeCompare(b.calendarId));
            const durationInDay = activity => Math.min(+activity.end, +dayEnd) - Math.max(+activity.start, +day);
            const featuredActivities = [...dayActivities].sort((a, b) => durationInDay(b) - durationInDay(a) || Math.max(+a.start, +day) - Math.max(+b.start, +day) || a.calendarId.localeCompare(b.calendarId))
              .slice(0, 5).sort((a, b) => Math.max(+a.start, +day) - Math.max(+b.start, +day) || a.calendarId.localeCompare(b.calendarId));
            const dayKey = day.toISOString();
            const hasHiddenDraft = !openPlannerDays.has(dayKey) && timeChanges.forDay(dayKey).pendingTimeChanges.size > 0;
            const isExpanded = expandedDays.has(dayKey);
            const dayListId = `week-spine-activities-${index}`;
            const isSelected = isSameDay(day, visibleSelectedDay);
            const isToday = isSameDay(day, today);
            return <div onDragOver={event => { if (summaryDrag && !isOutsideVisibleYear) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={event => {
              if (!summaryDrag || isOutsideVisibleYear) return;
              event.preventDefault();
              const { activity, sourceDay } = summaryDrag;
              if (+sourceDay !== +day) {
                const start = activityDate(activity.source.start), end = activityDate(activity.source.end);
                const days = Math.round((Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) - Date.UTC(sourceDay.getFullYear(), sourceDay.getMonth(), sourceDay.getDate())) / 86400000);
                start.setDate(start.getDate() + days); end.setDate(end.getDate() + days);
                if (timeChanges.pendingTimeChanges.has(activity.calendarId)) {
                  showInteractionWarning("กิจกรรมนี้มีการปรับเวลาที่ยังไม่ได้บันทึก กรุณาบันทึกหรือย้อนกลับใน planner ก่อนย้าย");
                } else if (onSaveTimes) {
                  Promise.resolve(onSaveTimes([{ id: activity.calendarId, start, end }])).then(saved => {
                    if (saved === false) showInteractionWarning("ย้ายกิจกรรมไม่สำเร็จ กรุณาลองอีกครั้ง");
                  }).catch(error => showInteractionWarning(error?.message || "ย้ายกิจกรรมไม่สำเร็จ"));
                } else showInteractionWarning("ไม่พบคำสั่งบันทึกกิจกรรม");
              }
              setSummaryDrag(null);
            }} className={`week-spine-day${summaryDrag && +summaryDrag.sourceDay !== +day && !isOutsideVisibleYear ? " is-summary-drop-target" : ""}${day.getDay() === 0 || day.getDay() === 6 ? " is-weekend" : ""}${isOutsideVisibleYear ? " is-outside-year" : ""}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`} key={day.toISOString()}>
              <div className="week-spine-day-heading-wrap">
              <button className={`week-spine-day-heading${hasHiddenDraft ? " has-unsaved-draft" : ""}`} type="button" disabled={isOutsideVisibleYear} onClick={() => selectDay(day)} aria-pressed={!isOutsideVisibleYear && isSelected} aria-current={isToday ? "date" : undefined}>
                {hasHiddenDraft && <span className="week-spine-unsaved-warning" role="img" aria-label="มีการปรับเวลาที่ยังไม่ได้บันทึก" title="มีการปรับเวลาที่ยังไม่ได้บันทึก">!</span>}
                <span className="week-spine-day-label"><span className="week-spine-day-label-full">{day.toLocaleDateString(language === "th" ? "th-TH" : "en-US", { weekday: "long" }).replace(/^วัน/, "")}</span><span className="week-spine-day-label-short">{labels[day.getDay()]}</span></span>
                <strong><span>{day.getDate()}</span><small className="week-spine-day-month">{day.toLocaleDateString(language === "th" ? "th-TH" : "en-US", { month: "short" })}</small></strong>
                <small className="week-spine-day-meta">{dayActivities.length} กิจกรรม · {(daySegments.reduce((total, segment) => total + (segment.end - segment.start), 0) / 3600000).toLocaleString("th-TH", { maximumFractionDigits: 1 })} ชม.</small>
              </button>
              {hasHiddenDraft && <button type="button" className="week-spine-draft-save" disabled={timeChanges.forDay(dayKey).isSavingTimeChanges} onClick={() => timeChanges.forDay(dayKey).savePendingTimeChanges()} aria-label={`บันทึกการปรับเวลา ${day.toLocaleDateString("th-TH", { day: "numeric", month: "long" })}`} title="บันทึกการปรับเวลา"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 3h13l3 3v15H4z"/><path d="M8 3v6h8V3M8 21v-8h8v8"/></svg></button>}
              </div>
              {!openPlannerDays.has(dayKey) && <div id={dayListId} className="week-spine-track week-spine-activity-list" data-day-index={index}>
                {!isOutsideVisibleYear && (isExpanded ? dayActivities : featuredActivities).map((activity, activityIndex) => <button
                  type="button"
                  draggable={!activity.isLocked && !activity.source.isOnboardingSample}
                  onDragStart={event => { if (activity.isLocked || activity.source.isOnboardingSample) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", activity.title); setSummaryDrag({ activity, sourceDay: day }); }}
                  onDragEnd={() => setSummaryDrag(null)}
                  key={activity.segmentId || `all-day:${activity.calendarId}`}
                  title={`${activity.title}${activity.continuesFromPreviousDay ? " (ต่อเนื่องจากวันก่อน)" : ""}${activity.continuesIntoNextDay ? " (ต่อเนื่องวันถัดไป)" : ""}`}
                  className={`week-spine-block${activity.isAllDay ? " week-spine-all-day-track-block" : ""}${activity.isLocked ? " is-locked" : ""}${selectedActivityIds.has(activity.calendarId) ? " is-series-selected" : ""}`}
                  style={{ "--block-color": activity.color.border, color: activity.color.border, gridColumn: activityIndex % 5 + 1, gridRow: Math.floor(activityIndex / 5) + 1 }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isSelectionMode || event.ctrlKey || event.metaKey) { toggleActivitySelection(activity.calendarId); return; }
                    if (activity.isLocked) { showInteractionWarning("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนแก้ไข"); return; }
                    openSegmentEditor(activity);
                  }}
                >
                  <span className="week-spine-block-time">{activity.isAllDay ? "ทั้งวัน" : `${activity.continuesFromPreviousDay ? "↳ " : ""}${formatTime(activity.start, language)}–${formatTime(activity.end, language)}${activity.continuesIntoNextDay ? " ↳" : ""}`}</span>
                  <span className="week-spine-block-title">{activity.isLocked ? "🔒 " : ""}{activity.title}</span>
                </button>)}
                {!isOutsideVisibleYear && dayActivities.length > 5 && <button type="button" className="week-spine-list-more" onClick={() => toggleExpandedDay(dayKey)} aria-expanded={isExpanded} aria-controls={dayListId} title={isExpanded ? "ย่อกลับเหลือ 5 กิจกรรม" : `ดูทั้งหมด ${dayActivities.length} กิจกรรม`} aria-label={isExpanded ? "ย่อกลับเหลือ 5 กิจกรรม" : `แสดงอีก ${dayActivities.length - 5} กิจกรรม`}>{isExpanded ? "ย่อ" : `+${dayActivities.length - 5}`}</button>}
                {!isOutsideVisibleYear && <button type="button" className="week-spine-planner-open" id={`week-spine-planner-${dayKey}`} title="วางแผนรายวัน" aria-label={`วางแผนรายวัน ${day.toLocaleDateString("th-TH", { day: "numeric", month: "long" })}`} aria-expanded={openPlannerDays.has(dayKey)} aria-controls={`daily-drawer-${dayKey}`} onClick={() => togglePlanner(dayKey)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 2v4m10-4v4M3 9h18M7 13h5m-5 4h10" /></svg></button>}
                {!isOutsideVisibleYear && dayActivities.length === 0 && <span className="week-spine-list-empty">ไม่มีกิจกรรม</span>}
                {!isOutsideVisibleYear && (isExpanded || dayActivities.length <= 5) && <button type="button" className="week-spine-list-add" style={{ gridColumn: !isExpanded && dayActivities.length === 5 ? 6 : dayActivities.length % 5 + 1, gridRow: !isExpanded && dayActivities.length === 5 ? 1 : Math.floor(dayActivities.length / 5) + 1 }} onClick={() => onAddActivity?.(day)} aria-label={`เพิ่มกิจกรรม ${day.toLocaleDateString("th-TH", { day: "numeric", month: "long" })}` } title="เพิ่มกิจกรรม">+</button>}
              </div>}
              {openPlannerDays.has(dayKey) && <ActivityDailyPlanner id={`daily-drawer-${dayKey}`} timeChanges={timeChanges.forDay(dayKey)} onContextMenu={openContextMenu} day={day} activities={summaryActivities} categories={categories} activityCategoryMap={activityCategoryMap} lockedActivities={lockedActivities} loading={activitiesLoading} onClose={() => closePlanner(dayKey)} onAddActivity={onAddActivity} onEditActivity={onEditActivity} />}
            </div>;
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
        onDuplicate={() => onDuplicateActivity?.(contextMenu.segment.source, { start: contextMenu.segment.source.start, end: contextMenu.segment.source.end })}
        onMoveToDay={(date) => onMoveActivityToDay?.(contextMenu.segment.calendarId, date)}
        onFetchSeriesCount={() => onFetchSeriesCount?.(contextMenu.segment.source.recurringEventId)}
        onArchive={() => archiveActivity(contextMenu.segment)}
      />}
        </section>
      </>}
      </section>
      {viewMode !== "four-weeks" && <>
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
