import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatTime, getWeekRange, getYearWeekRange, getYearCycle, isSameDay, weekdayShortLabels } from "../../../shared/lib/date-utils.js";
import { buildWeekSpineData } from "../lib/week-spine-data.js";
import { useLanguage } from "../../../shared/i18n/i18n.jsx";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import ActivityPopup from "./activity-popup.jsx";
import ActivitySummaryHero from "./activity-summary-hero.jsx";
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
  weekStreamgraph,
}) {
  const timelineSurfaceRef = useRef(null);
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
    addActivitySelection
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
  const { activities: fourWeekActivities, loading: fourWeekLoading, error: fourWeekError } = cycleData;
  const timelineActivities = activities;
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
  const todayKey = today.toDateString();
  useEffect(() => {
    const surface = timelineSurfaceRef.current;
    if (viewMode !== "week" || !surface) return;
    const revealToday = () => {
      const currentDay = surface.querySelector(".week-spine-day.is-today:not(.is-outside-year)");
      if (!currentDay) return;
      const viewport = surface.getBoundingClientRect();
      const day = currentDay.getBoundingClientRect();
      const left = viewport.left + surface.clientLeft;
      const right = left + surface.clientWidth;
      // Move only enough to show the whole day; preserve room for its neighbours.
      if (day.left < left) surface.scrollLeft += day.left - left;
      else if (day.right > right) surface.scrollLeft += day.right - right;
    };
    surface.scrollLeft = 0;
    revealToday();
    const observer = new ResizeObserver(revealToday);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [viewMode, weekDays, anchorDate.getTime(), todayKey]);

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
      {viewMode === "week" && <ActivitySummaryHero header={summaryHeader} days={weekDays} visibleStart={visibleWeekStart} visibleEnd={visibleWeekEnd} activities={summaryActivities} categories={categories} activityCategoryMap={activityCategoryMap} onSelectDay={selectDay} loading={activitiesLoading} weekName={<aside className="week-spine-week-glance-demo" aria-label="ชื่อสัปดาห์">
          <WeekNameField className="week-spine-week-name" weekStart={visibleWeekStart} weekNames={customWeekNames} editingWeekKey={editingWeekNameKey} weekNameDraft={weekNameDraft} onStartEditing={startEditingWeekName} onDraftChange={setWeekNameDraft} onCommit={commitWeekName} onCancel={cancelWeekNameEdit} />
        </aside>} />}
      <section className={`week-spine${isSummaryTargetHovered ? " is-summary-target-hovered" : ""}`} aria-label="Activity Week Spine" onClick={focusSummaryFromWeekSpine} onPointerMove={updateSummaryHover} onPointerLeave={() => setIsSummaryTargetHovered(false)}>
        {viewMode === "four-weeks" ? (
          fourWeekLoading ? <p className="week-spine-overview-state">กำลังโหลดกิจกรรม 4 สัปดาห์…</p>
            : fourWeekError ? <p className="week-spine-overview-state is-error">{fourWeekError}</p>
              : <FourWeekOverview weeks={cycle.weeks} cycleStart={cycle.start} cycleEnd={cycle.end} focusedWeekDate={anchorDate} activities={fourWeekActivities} categories={categories} activityCategoryMap={activityCategoryMap} lockedActivities={lockedActivities} weekNames={customWeekNames} editingWeekKey={editingWeekNameKey} weekNameDraft={weekNameDraft} onStartEditingWeekName={startEditingWeekName} onWeekNameDraftChange={setWeekNameDraft} onCommitWeekName={commitWeekName} onCancelWeekName={cancelWeekNameEdit} language={language} onSelectWeek={onSelectOverviewWeek} onSelectDay={onSelectOverviewDay} onNavigateCycle={onNavigateCycle} onOpenWeekEditor={onOpenOverviewWeekEditor} onOpenWeekView={onOpenOverviewWeekView} />
        ) : <>
        <section ref={timelineSurfaceRef} className="week-spine-timeline-surface" aria-label="ปฏิทิน 7 วัน" tabIndex={0}>
        <div className="week-spine-edge-nav" aria-label="เปลี่ยนสัปดาห์">
          <button type="button" className="week-spine-edge-nav-prev" onClick={() => navigateWeekBy(-1)} aria-label="สัปดาห์ก่อนหน้า">‹</button>
          <button type="button" className="week-spine-edge-nav-next" onClick={() => navigateWeekBy(1)} aria-label="สัปดาห์ถัดไป">›</button>
        </div>
        {interactionWarning && <PopupLayerItem id="week-spine-interaction-warning" region="bottom-center" priority={65}><p className="error-banner" role="alert">{interactionWarning}</p></PopupLayerItem>}
      <div className="week-spine-grid-wrap week-spine-list-grid">
        <div className="week-spine-days">
          {weekDays.map((day, index) => {
            const isOutsideVisibleYear = day < weekStart || day > weekEnd;
            const daySegments = timelineSegments.filter((segment) => isSameDay(segment.day, day));
            const dayEnd = new Date(day);
            dayEnd.setDate(dayEnd.getDate() + 1);
            const dayAllDayActivities = visibleAllDayActivities.filter((activity) => activity.start < dayEnd && activity.end > day);
            const dayActivities = [...dayAllDayActivities, ...daySegments].sort((a, b) =>
              Number(b.isAllDay) - Number(a.isAllDay) || a.start - b.start || a.title.localeCompare(b.title) || a.calendarId.localeCompare(b.calendarId));
            const isSelected = isSameDay(day, visibleSelectedDay);
            const isToday = isSameDay(day, today);
            return <div className={`week-spine-day${day.getDay() === 0 || day.getDay() === 6 ? " is-weekend" : ""}${isOutsideVisibleYear ? " is-outside-year" : ""}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`} key={day.toISOString()}>
              <button className="week-spine-day-heading" type="button" disabled={isOutsideVisibleYear} onClick={() => selectDay(day)} aria-pressed={!isOutsideVisibleYear && isSelected} aria-current={isToday ? "date" : undefined}>
                <span className="week-spine-day-label"><span className="week-spine-day-label-full">{day.toLocaleDateString(language === "th" ? "th-TH" : "en-US", { weekday: "long" }).replace(/^วัน/, "")}</span><span className="week-spine-day-label-short">{labels[day.getDay()]}</span></span>
                <strong><span>{day.getDate()}</span><small className="week-spine-day-month">{day.toLocaleDateString(language === "th" ? "th-TH" : "en-US", { month: "short" })}</small></strong>
                <small className="week-spine-day-meta">{dayActivities.length} กิจกรรม · {(daySegments.reduce((total, segment) => total + (segment.end - segment.start), 0) / 3600000).toLocaleString("th-TH", { maximumFractionDigits: 1 })} ชม.</small>
              </button>
              <div className="week-spine-track week-spine-activity-list" data-day-index={index}>
                {!isOutsideVisibleYear && dayActivities.map((activity) => <button
                  type="button"
                  key={activity.segmentId || `all-day:${activity.calendarId}`}
                  title={`${activity.title}${activity.continuesFromPreviousDay ? " (ต่อเนื่องจากวันก่อน)" : ""}${activity.continuesIntoNextDay ? " (ต่อเนื่องวันถัดไป)" : ""}`}
                  className={`week-spine-block${activity.isAllDay ? " week-spine-all-day-track-block" : ""}${activity.isLocked ? " is-locked" : ""}${selectedActivityIds.has(activity.calendarId) ? " is-series-selected" : ""}`}
                  style={{ "--block-color": activity.color.border, color: activity.color.border }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isSelectionMode || event.ctrlKey || event.metaKey) { toggleActivitySelection(activity.calendarId); return; }
                    if (activity.isLocked) { showInteractionWarning("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนแก้ไข"); return; }
                    openSegmentEditor(activity);
                  }}
                  onContextMenu={(event) => openContextMenu(event, activity)}
                >
                  <span className="week-spine-block-time">{activity.isAllDay ? "ทั้งวัน" : `${activity.continuesFromPreviousDay ? "↳ " : ""}${formatTime(activity.start, language)}–${formatTime(activity.end, language)}${activity.continuesIntoNextDay ? " ↳" : ""}`}</span>
                  <span className="week-spine-block-title">{activity.isLocked ? "🔒 " : ""}{activity.title}</span>
                </button>)}
                {!isOutsideVisibleYear && dayActivities.length === 0 && <span className="week-spine-list-empty">ไม่มีกิจกรรม</span>}
                {!isOutsideVisibleYear && <button type="button" className="week-spine-list-add" onClick={() => onAddActivity?.(day)} aria-label={`เพิ่มกิจกรรม ${day.toLocaleDateString("th-TH", { day: "numeric", month: "long" })}`}>+ เพิ่มกิจกรรม</button>}
              </div>
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
      {weekStreamgraph}
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
