import React, { useEffect, useMemo, useRef, useState } from "react";
import { activityDate, formatTime, getWeekRange, isSameDay, weekdayShortLabels } from "../date-utils.js";
import { buildWeekSpineData } from "../week-spine-data.js";
import { layoutOverlaps } from "../timeline-layout.js";
import { useLanguage } from "../i18n.jsx";
import { normalizeActivityId } from "../id-utils.js";
import ActivityPopup from "./activity-popup.jsx";
import AutoShrinkText from "./auto-shrink-text.jsx";

const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const DAY_SPAN_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const HOUR_MARKS = [0, 4, 8, 12, 16, 20, 24];
const SNAP_MINUTES = 15;

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

/** Read-only Week Spine; editing/drag interactions are intentionally Phase 2–3. */
export default function ActivityModeWeekSpine({
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
  onSetActivityColor,
  onEditSeries,
  onFetchSeriesCount,
  onNavigateWeek,
  onFocusArchiveTimeline,
  onOpenArchiveDraft,
  onEditArchivedActivity,
  userId,
  tokenNearingExpiry,
  onReauthCalendar,
}) {
  const { language } = useLanguage();
  const [weekStart, weekEnd] = getWeekRange(anchorDate);
  const [selectedDay, setSelectedDay] = useState(anchorDate);
  const [draft, setDraft] = useState(null);
  const [dragged, setDragged] = useState(null);
  const [interactionWarning, setInteractionWarning] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const dragStartedAt = useRef(null);
  const shouldSuppressBlockClick = useRef(false);
  const [timelineFullscreen, setTimelineFullscreen] = useState(false);
  const archiveStorageKey = `times-activity-archive:${userId || "guest"}`;
  const [activityArchive, setActivityArchive] = useState([]);
  // Makes a restored item render immediately even while the archive write and
  // the Calendar refresh are settling after a week change.
  const [restoringCalendarIds, setRestoringCalendarIds] = useState(() => new Set());
  const [archiveHydrated, setArchiveHydrated] = useState(false);
  const [archiveTagDrafts, setArchiveTagDrafts] = useState({});
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + offset);
    return day;
  }), [weekStart]);

  const { timedSegments, allDayActivities } = useMemo(
    () => buildWeekSpineData({ activities, weekStart, weekEnd, activityCategoryMap, categories, lockedActivities }),
    [activities, weekStart, weekEnd, activityCategoryMap, categories, lockedActivities]
  );
  const archivedCalendarIds = useMemo(
    () => new Set(activityArchive.map((item) => item.calendarId).filter(Boolean)),
    [activityArchive]
  );
  const timelineSegments = timedSegments.filter((segment) => !archivedCalendarIds.has(segment.calendarId) || restoringCalendarIds.has(segment.calendarId));
  const visibleSelectedDay = weekDays.find((day) => isSameDay(day, selectedDay)) || weekDays[0];
  const selectedSegments = timedSegments
    .filter((segment) => isSameDay(segment.day, visibleSelectedDay))
    .sort((a, b) => a.start - b.start);
  const labels = weekdayShortLabels(language);
  const today = new Date();

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(archiveStorageKey) || "[]");
      setActivityArchive(Array.isArray(saved) ? saved : []);
    } catch {
      setActivityArchive([]);
    } finally {
      setArchiveHydrated(true);
    }
  }, [archiveStorageKey]);

  useEffect(() => {
    if (!archiveHydrated) return;
    try {
      window.localStorage.setItem(archiveStorageKey, JSON.stringify(activityArchive));
      window.dispatchEvent(new CustomEvent("times-activity-archive-changed", { detail: { userId } }));
    } catch {
      // Storage may be unavailable; keep the in-memory archive usable.
    }
  }, [activityArchive, archiveStorageKey, archiveHydrated]);

  const archiveActivity = (segment) => {
    const archived = {
      archiveId: `${segment.calendarId}:${segment.start.getTime()}:${Date.now()}`,
      calendarId: segment.calendarId,
      title: segment.title,
      start: segment.start.toISOString(),
      end: segment.end.toISOString(),
      categoryId: activityCategoryMap[segment.id] || activityCategoryMap[normalizeActivityId(segment.calendarId)] || null,
      tags: activityTagMap[segment.id] || activityTagMap[normalizeActivityId(segment.calendarId)] || [],
      color: segment.color.border,
      archivedAt: new Date().toISOString(),
    };
    setRestoringCalendarIds((current) => {
      if (!current.has(segment.calendarId)) return current;
      const next = new Set(current);
      next.delete(segment.calendarId);
      return next;
    });
    setActivityArchive((current) => [archived, ...current.filter((item) => !(item.start === archived.start && item.title === archived.title))]);
  };

  const addArchiveDraft = () => {
    setActivityArchive((current) => [{
      archiveId: `draft:${Date.now()}`,
      calendarId: null,
      title: "กิจกรรมใหม่",
      start: null,
      end: null,
      categoryId: null,
      color: "#5f6368",
      isDraft: true,
      archivedAt: new Date().toISOString(),
    }, ...current]);
  };

  const updateArchivedActivity = (archiveId, field, value) => {
    if (field === "title" || field === "categoryId" || field === "tags") {
      setActivityArchive((current) => current.map((item) => item.archiveId === archiveId ? { ...item, [field]: value } : item));
      return;
    }
    if (!value) {
      setActivityArchive((current) => current.map((item) => item.archiveId === archiveId ? { ...item, [field]: null } : item));
      return;
    }
    const nextDate = new Date(value);
    if (Number.isNaN(nextDate.getTime())) return;
    setActivityArchive((current) => current.map((item) => {
      if (item.archiveId !== archiveId) return item;
      const updated = { ...item, [field]: nextDate.toISOString() };
      if (field === "start" && !item.end) updated.end = new Date(nextDate.getTime() + 60 * 60 * 1000).toISOString();
      return updated;
    }));
  };

  const updateArchiveCategory = (item, categoryId) => {
    updateArchivedActivity(item.archiveId, "categoryId", categoryId || null);
    if (item.calendarId) onAssignCategory?.(item.calendarId, categoryId || null);
  };

  const updateArchivedDate = (item, value) => {
    if (!value) return;
    const oldStart = new Date(item.start);
    const oldEnd = new Date(item.end);
    const [year, month, day] = value.split("-").map(Number);
    const nextStart = new Date(year, month - 1, day, oldStart.getHours(), oldStart.getMinutes());
    const nextEnd = new Date(nextStart.getTime() + (oldEnd - oldStart));
    setActivityArchive((current) => current.map((archived) => archived.archiveId === item.archiveId ? { ...archived, start: nextStart.toISOString(), end: nextEnd.toISOString() } : archived));
  };

  const updateArchivedDuration = (item, rawValue, unit) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) return;
    const start = new Date(item.start);
    const end = new Date(start.getTime() + value * (unit === "day" ? 86400000 : 3600000));
    setActivityArchive((current) => current.map((archived) => archived.archiveId === item.archiveId ? { ...archived, end: end.toISOString(), durationUnit: unit } : archived));
  };

  const restoreArchivedActivity = async (item) => {
    if (!item.start || !item.end) {
      const missing = [!item.start && "วันที่/เวลาเริ่ม", !item.end && "วันที่/เวลาสิ้นสุด"].filter(Boolean).join(" และ ");
      onOpenArchiveDraft?.(item, `กิจกรรมนี้ยังขาด ${missing} — กรุณากำหนดให้ครบก่อนบันทึก`);
      return;
    }
    const start = new Date(item.start);
    const end = new Date(item.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setInteractionWarning("ส่งไป Timeline ไม่ได้: เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม");
      return;
    }
    const overlap = findOverlap(start, end, item.calendarId);
    try {
      // This is intentionally distinct from normal drag saving: restoring
      // must create/update first even when its time conflicts. The Timeline
      // then exposes that conflict so the person can drag it into place.
      const saved = await onRestoreArchivedActivity?.({
        calendarId: item.calendarId,
        title: item.title,
        start,
        end,
        categoryId: item.categoryId || null,
        tags: item.tags || []
      });
      const restoredId = saved?.id || item.calendarId;
      if (restoredId) setRestoringCalendarIds((current) => new Set(current).add(restoredId));
      setActivityArchive((current) => current.filter((archived) => archived.archiveId !== item.archiveId));
      onFocusArchiveTimeline?.(start);
      requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector(".week-spine-timeline-surface")?.scrollIntoView({ behavior: "smooth", block: "center" })));
      if (overlap) setInteractionWarning(`นำกลับเข้า Timeline แล้ว — เวลาชนกับ “${overlap.summary || "(ไม่มีชื่อกิจกรรม)"}” ลากเพื่อปรับเวลาได้ทันที`);
    } catch (error) {
      setInteractionWarning(error?.message || "ส่งกิจกรรมไป Timeline ไม่สำเร็จ");
    }
  };

  useEffect(() => {
    if (!interactionWarning) return undefined;
    const timeout = window.setTimeout(() => setInteractionWarning(""), 5500);
    return () => window.clearTimeout(timeout);
  }, [interactionWarning]);

  useEffect(() => {
    if (!interactionWarning && !contextMenu) return undefined;
    const dismissTransientUi = (event) => {
      if (event.target instanceof Element && event.target.closest(".error-banner, .activity-popup")) return;
      setInteractionWarning("");
      setContextMenu(null);
    };
    document.addEventListener("pointerdown", dismissTransientUi, true);
    document.addEventListener("focusin", dismissTransientUi, true);
    return () => {
      document.removeEventListener("pointerdown", dismissTransientUi, true);
      document.removeEventListener("focusin", dismissTransientUi, true);
    };
  }, [interactionWarning, contextMenu]);

  useEffect(() => {
    if (!timelineFullscreen) return undefined;
    const exitOnEscape = (event) => {
      if (event.key === "Escape") setTimelineFullscreen(false);
    };
    document.addEventListener("keydown", exitOnEscape);
    return () => document.removeEventListener("keydown", exitOnEscape);
  }, [timelineFullscreen]);

  const selectDay = (day) => {
    setSelectedDay(day);
    onSelectDay?.(day);
  };

  const toggleTimelineFullscreen = () => setTimelineFullscreen((open) => !open);

  const navigateWeekBy = (delta) => {
    const nextSelectedDay = new Date(visibleSelectedDay);
    nextSelectedDay.setDate(nextSelectedDay.getDate() + delta * 7);
    setSelectedDay(nextSelectedDay);
    onSelectDay?.(nextSelectedDay);
    onNavigateWeek?.(delta);
  };

  const snapPointerToMinutes = (event, track) => {
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const raw = DAY_START_HOUR * 60 + ratio * DAY_SPAN_MINUTES;
    return Math.min(DAY_END_HOUR * 60 - SNAP_MINUTES, Math.max(DAY_START_HOUR * 60, Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES));
  };

  const dateAtMinutes = (day, minutes) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);

  // Keep the same half-open interval rule as use-activity-mutations:
  // touching an activity's end exactly is valid; intersecting it is not.
  const findOverlap = (start, end, excludeCalendarId = null) => activities.find((activity) => {
    if (activity.id === excludeCalendarId) return false;
    const otherStart = activityDate(activity.start);
    const otherEnd = activityDate(activity.end) || otherStart;
    return otherStart && otherEnd && start < otherEnd && end > otherStart;
  });

  const openContextMenu = (event, segment) => {
    event.preventDefault();
    if (segment.source.isOnboardingSample) {
      setInteractionWarning("นี่คือกิจกรรมตัวอย่างในเครื่อง — คลิกเพื่อสร้างกิจกรรมจริงจากตัวอย่างนี้");
      return;
    }
    event.stopPropagation();
    const container = event.currentTarget.closest(".week-spine-timeline-surface") || document.querySelector(".week-spine-timeline-surface");
    const bounds = container?.getBoundingClientRect();
    setContextMenu({
      segment,
      position: { x: event.clientX - (bounds?.left || 0), y: event.clientY - (bounds?.top || 0) },
    });
  };

  const openSegmentEditor = (segment) => {
    if (segment.source.isOnboardingSample) {
      onAddActivity?.(segment.start, { preserveTime: true, end: segment.end, title: segment.title });
      return;
    }
    onEditActivity?.(segment.source);
  };

  const trackAtPointer = (event) => document.elementFromPoint(event.clientX, event.clientY)?.closest(".week-spine-track");
  const dayForTrack = (track) => weekDays[Number(track?.dataset.dayIndex)];

  const beginDraft = (event, day) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.preventDefault();
    setInteractionWarning("");
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const startMinutes = snapPointerToMinutes(event, event.currentTarget);
    setDraft({ day, startMinutes, endMinutes: startMinutes + SNAP_MINUTES, pointerId: event.pointerId });
  };

  const updateDraft = (event) => {
    if (!draft || event.pointerId !== draft.pointerId) return;
    const pointerMinutes = snapPointerToMinutes(event, event.currentTarget);
    setDraft((current) => current && ({ ...current, endMinutes: Math.max(current.startMinutes + SNAP_MINUTES, pointerMinutes + SNAP_MINUTES) }));
  };

  const finishDraft = (event) => {
    if (!draft || event.pointerId !== draft.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const completed = draft;
    setDraft(null);
    const start = dateAtMinutes(completed.day, completed.startMinutes);
    const end = dateAtMinutes(completed.day, completed.endMinutes);
    const overlap = findOverlap(start, end);
    if (overlap) {
      setInteractionWarning(`สร้างไม่ได้: เวลาชนกับ “${overlap.summary || "(ไม่มีชื่อกิจกรรม)"}”`);
      return;
    }
    onAddActivity?.(start, {
      preserveTime: true,
      end,
    });
  };

  const beginExistingDrag = (event, segment, day, mode) => {
    if (event.button !== 0 || segment.isLocked || segment.continuesFromPreviousDay || segment.continuesIntoNextDay) return;
    event.preventDefault();
    event.stopPropagation();
    setInteractionWarning("");
    const track = event.currentTarget.closest(".week-spine-track");
    track?.setPointerCapture?.(event.pointerId);
    const startMinutes = minutesSinceDayStart(segment.start, day);
    const endMinutes = minutesSinceDayStart(segment.end, day);
    const pointerMinutes = snapPointerToMinutes(event, track);
    dragStartedAt.current = { x: event.clientX, y: event.clientY };
    shouldSuppressBlockClick.current = false;
    setDragged({
      type: mode,
      pointerId: event.pointerId,
      calendarId: segment.calendarId,
      source: segment.source,
      day,
      startMinutes,
      endMinutes,
      durationMinutes: endMinutes - startMinutes,
      pointerOffsetMinutes: Math.max(0, Math.round((pointerMinutes - startMinutes) / SNAP_MINUTES) * SNAP_MINUTES),
    });
  };

  const updateExistingDrag = (event) => {
    if (!dragged || event.pointerId !== dragged.pointerId) return;
    if (dragStartedAt.current && (Math.abs(event.clientX - dragStartedAt.current.x) > 3 || Math.abs(event.clientY - dragStartedAt.current.y) > 3)) {
      shouldSuppressBlockClick.current = true;
    }
    const track = trackAtPointer(event) || event.currentTarget;
    const targetDay = dayForTrack(track);
    if (!targetDay) return;
    const pointerMinutes = snapPointerToMinutes(event, track);
    setDragged((current) => {
      if (!current) return current;
      if (current.type === "resize") {
        return { ...current, endMinutes: Math.max(current.startMinutes + SNAP_MINUTES, pointerMinutes + SNAP_MINUTES) };
      }
      const startMinutes = Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - current.durationMinutes, pointerMinutes - current.pointerOffsetMinutes));
      return { ...current, day: targetDay, startMinutes, endMinutes: startMinutes + current.durationMinutes };
    });
  };

  const finishExistingDrag = (event) => {
    if (!dragged || event.pointerId !== dragged.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const completed = dragged;
    setDragged(null);
    dragStartedAt.current = null;
    if (!shouldSuppressBlockClick.current) {
      // A pointer press/release without movement is a left-click: open the
      // existing single-activity editor directly from the timeline block.
      shouldSuppressBlockClick.current = true;
      onEditActivity?.(completed.source);
      return;
    }
    const start = dateAtMinutes(completed.day, completed.startMinutes);
    const end = dateAtMinutes(completed.day, completed.endMinutes);
    const overlap = findOverlap(start, end, completed.calendarId);
    if (overlap) {
      setInteractionWarning(`บันทึกไม่ได้: เวลาชนกับ “${overlap.summary || "(ไม่มีชื่อกิจกรรม)"}`);
      return;
    }
    if (start.getTime() !== new Date(completed.source.start.dateTime).getTime() || end.getTime() !== new Date(completed.source.end.dateTime).getTime()) {
      onSaveTimes?.([{ id: completed.calendarId, start, end }]);
    }
  };

  return (
    <div className="week-spine-layout">
      <section className="week-spine" aria-label="Activity Week Spine">
        {allDayActivities.length > 0 && <div className="week-spine-all-day"><strong>กิจกรรมทั้งวัน</strong>{allDayActivities.map((activity) => <span key={activity.calendarId}>{activity.title}</span>)}</div>}
        <section className={`week-spine-timeline-surface${timelineFullscreen ? " is-fullscreen" : ""}`}>
        <button className="week-spine-fullscreen-btn" type="button" onClick={toggleTimelineFullscreen} aria-label={timelineFullscreen ? "ออกจากเต็มหน้าจอ" : "เปิด timeline แบบเต็มหน้าจอ"} title={timelineFullscreen ? "ออกจากเต็มหน้าจอ" : "เต็มหน้าจอ"}>{timelineFullscreen ? "⤢" : "⛶"}</button>
        <div className="week-spine-edge-nav" aria-label="เปลี่ยนสัปดาห์">
          <button type="button" className="week-spine-edge-nav-prev" onClick={() => navigateWeekBy(-1)} aria-label="สัปดาห์ก่อนหน้า">‹</button>
          <button type="button" className="week-spine-edge-nav-next" onClick={() => navigateWeekBy(1)} aria-label="สัปดาห์ถัดไป">›</button>
        </div>
        {interactionWarning && <p className="error-banner" role="alert">{interactionWarning}</p>}
        {timelineFullscreen && tokenNearingExpiry && <div className="week-spine-token-prompt" role="alert"><span>สิทธิ์ Google Calendar ใกล้หมดอายุ</span><button type="button" onClick={onReauthCalendar}>ต่ออายุตอนนี้</button></div>}
      <div className="week-spine-grid-wrap">
        <div className="week-spine-hours" aria-hidden="true">
          {HOUR_MARKS.map((hour) => <span key={hour} style={{ top: `${((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}
        </div>
        <div className="week-spine-days">
          {weekDays.map((day, index) => {
            const daySegments = timelineSegments.filter((segment) => isSameDay(segment.day, day));
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
                <span className="week-spine-track" data-day-index={index} onPointerDown={(event) => beginDraft(event, day)} onPointerMove={(event) => { updateDraft(event); updateExistingDrag(event); }} onPointerUp={(event) => { finishDraft(event); finishExistingDrag(event); }} onPointerCancel={() => { setDraft(null); setDragged(null); }}>
                  {daySegments.map((segment) => {
                    const start = Math.max(DAY_START_HOUR * 60, minutesSinceDayStart(segment.start, day));
                    const end = Math.min(DAY_END_HOUR * 60, minutesSinceDayStart(segment.end, day));
                    const top = ((start - DAY_START_HOUR * 60) / DAY_SPAN_MINUTES) * 100;
                    const height = Math.max(1.5, ((end - start) / DAY_SPAN_MINUTES) * 100);
                    const lane = laneLayout[segment.segmentId] || { column: 0, columns: 1 };
                    const laneWidth = 100 / lane.columns;
                    const laneLeft = lane.column * laneWidth;
                    if (dragged?.calendarId === segment.calendarId) return null;
                    const continuationClass = segment.continuesFromPreviousDay || segment.continuesIntoNextDay ? " is-continuation" : "";
                    return <span key={segment.segmentId} title={`${segment.title}${segment.source.isOnboardingSample ? " (ตัวอย่าง)" : ""}${segment.continuesFromPreviousDay ? " (ต่อเนื่องจากวันก่อน)" : ""}${segment.continuesIntoNextDay ? " (ต่อเนื่องวันถัดไป)" : ""}`} className={`week-spine-block${segment.isLocked || segment.source.isOnboardingSample || segment.continuesFromPreviousDay || segment.continuesIntoNextDay ? "" : " is-draggable"}${continuationClass}`} style={{ top: `${top}%`, height: `${height}%`, left: `calc(${laneLeft}% + 3px)`, width: `calc(${laneWidth}% - 6px)`, backgroundColor: continuationClass ? segment.color.bg : segment.color.border, color: segment.color.border, borderLeftColor: segment.color.border }} onPointerDown={(event) => { if (!segment.source.isOnboardingSample) beginExistingDrag(event, segment, day, "move"); }} onClick={(event) => { event.stopPropagation(); if (shouldSuppressBlockClick.current) { shouldSuppressBlockClick.current = false; return; } openSegmentEditor(segment); }} onContextMenu={(event) => openContextMenu(event, segment)}>
                      <AutoShrinkText text={segment.title} minScale={0.75} className="week-spine-block-title" />
                      {!segment.isLocked && !segment.source.isOnboardingSample && !segment.continuesFromPreviousDay && !segment.continuesIntoNextDay && <span className="week-spine-resize-handle" onPointerDown={(event) => beginExistingDrag(event, segment, day, "resize")} />}
                    </span>;
                  })}
                  {draft && isSameDay(draft.day, day) && <span className={`week-spine-draft${findOverlap(dateAtMinutes(draft.day, draft.startMinutes), dateAtMinutes(draft.day, draft.endMinutes)) ? " is-conflicting" : ""}`} style={{ top: `${((draft.startMinutes - DAY_START_HOUR * 60) / DAY_SPAN_MINUTES) * 100}%`, height: `${((draft.endMinutes - draft.startMinutes) / DAY_SPAN_MINUTES) * 100}%` }} />}
                  {dragged && isSameDay(dragged.day, day) && <span className={`week-spine-block is-dragging${findOverlap(dateAtMinutes(dragged.day, dragged.startMinutes), dateAtMinutes(dragged.day, dragged.endMinutes), dragged.calendarId) ? " is-conflicting" : ""}`} style={{ top: `${((dragged.startMinutes - DAY_START_HOUR * 60) / DAY_SPAN_MINUTES) * 100}%`, height: `${((dragged.endMinutes - dragged.startMinutes) / DAY_SPAN_MINUTES) * 100}%`, backgroundColor: dragged.source ? timelineSegments.find((segment) => segment.calendarId === dragged.calendarId)?.color.border : undefined }}><AutoShrinkText text={dragged.source?.summary || "(ไม่มีชื่อกิจกรรม)"} minScale={0.75} className="week-spine-block-title" /></span>}
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
        onDelete={() => onDeleteActivity?.(normalizeActivityId(contextMenu.segment.calendarId))}
        onDeleteSeries={() => onDeleteSeries?.(contextMenu.segment.source.recurringEventId)}
        onDuplicate={() => onDuplicateActivity?.(contextMenu.segment.source)}
        onMoveToDay={(date) => onMoveActivityToDay?.(normalizeActivityId(contextMenu.segment.calendarId), date)}
        onSetColor={(colorId) => onSetActivityColor?.(normalizeActivityId(contextMenu.segment.calendarId), colorId)}
        onFetchSeriesCount={() => onFetchSeriesCount?.(contextMenu.segment.source.recurringEventId)}
        onArchive={() => archiveActivity(contextMenu.segment)}
      />}
        </section>
      </section>

      <section className="week-spine-detail" aria-live="polite">
        <h3>{labels[visibleSelectedDay.getDay()]} {visibleSelectedDay.getDate()}</h3>
        {selectedSegments.length === 0 ? <p>ยังไม่มีกิจกรรมตามเวลาในวันนี้</p> : selectedSegments.map((segment) => (
          <button className="week-spine-detail-item" type="button" key={segment.segmentId} onClick={() => openSegmentEditor(segment)} onContextMenu={(event) => openContextMenu(event, segment)}>
            <span className="week-spine-detail-dot" style={{ backgroundColor: segment.color.border }} />
            <span className="week-spine-detail-title"><span>{segment.title}{segment.continuesFromPreviousDay ? " ←" : ""}{segment.continuesIntoNextDay ? " →" : ""}{segment.isLocked ? " 🔒" : ""}</span>{(activityTagMap?.[normalizeActivityId(segment.calendarId)] || []).map((tag) => <small className="activity-inline-tag" key={tag}>#{tag}</small>)}</span>
            <time>{formatTime(segment.start, language)} – {formatTime(segment.end, language)}</time>
          </button>
        ))}
      </section>
      <section className="activity-archive" aria-label="คลังกิจกรรม">
        <div className="activity-archive-heading"><h3>คลังกิจกรรม</h3><span>{activityArchive.length} รายการ</span><button type="button" className="activity-archive-add" onClick={addArchiveDraft}>+ เพิ่มกิจกรรม</button></div>
        {activityArchive.length === 0 ? <p>ยังไม่มีกิจกรรมที่เก็บไว้</p> : (
          <ol className="activity-archive-list">
            {activityArchive.map((item) => <li key={item.archiveId}>
              <span className="activity-archive-main"><span className="activity-archive-title-row"><input className="activity-archive-title-input" autoFocus={item.isDraft} value={item.title} onChange={(event) => updateArchivedActivity(item.archiveId, "title", event.target.value)} aria-label="ชื่อกิจกรรม" />{(item.tags || []).map((tag) => <small className="activity-inline-tag" key={tag}>#{tag}<button type="button" onClick={() => updateArchivedActivity(item.archiveId, "tags", (item.tags || []).filter((savedTag) => savedTag !== tag))} aria-label={`ลบ tag ${tag}`}>✕</button></small>)}{Object.hasOwn(archiveTagDrafts, item.archiveId) ? <input className="activity-archive-tag-input" autoFocus value={archiveTagDrafts[item.archiveId]} placeholder="tag" onChange={(event) => setArchiveTagDrafts((current) => ({ ...current, [item.archiveId]: event.target.value }))} onBlur={() => setArchiveTagDrafts((current) => { const next = { ...current }; delete next[item.archiveId]; return next; })} onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); const tag = archiveTagDrafts[item.archiveId]?.trim(); if (tag) updateArchivedActivity(item.archiveId, "tags", [...(item.tags || []), tag]); setArchiveTagDrafts((current) => { const next = { ...current }; delete next[item.archiveId]; return next; }); }} /> : <button type="button" className="activity-archive-tag-add" onClick={() => setArchiveTagDrafts((current) => ({ ...current, [item.archiveId]: "" }))} aria-label="ใส่ tag" title="เพิ่ม tag">+ Tag</button>}</span>{item.start && <span className="activity-archive-original-time">{new Date(item.start).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}</span>
              <><label className="activity-archive-field"><span>เริ่ม</span><span className="activity-archive-time-input"><input type="datetime-local" value={toDateTimeLocalValue(item.start)} onChange={(event) => updateArchivedActivity(item.archiveId, "start", event.target.value)} />{!item.start && <em>-- --</em>}</span><button type="button" onClick={() => updateArchivedActivity(item.archiveId, "start", "")}>✕</button></label><label className="activity-archive-field"><span>จบ</span><span className="activity-archive-time-input"><input type="datetime-local" value={toDateTimeLocalValue(item.end)} onChange={(event) => updateArchivedActivity(item.archiveId, "end", event.target.value)} />{!item.end && <em>-- --</em>}</span><button type="button" onClick={() => updateArchivedActivity(item.archiveId, "end", "")}>✕</button></label></>
              <label className="activity-archive-category"><span className="activity-archive-category-color" style={{ backgroundColor: categories.find((category) => category.id === item.categoryId)?.color || "transparent" }} /><select value={item.categoryId || ""} onChange={(event) => updateArchiveCategory(item, event.target.value || null)}><option value="">ไม่กำหนดหมวดหมู่</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{item.categoryId && <button type="button" onClick={() => updateArchiveCategory(item, null)} aria-label="ลบหมวดหมู่">✕</button>}</label>
              <div className="activity-archive-actions"><button type="button" className="activity-archive-edit" onClick={() => { if (item.isDraft) { onOpenArchiveDraft?.(item); return; } onEditArchivedActivity?.(item.calendarId); }} aria-label={`แก้ไข ${item.title}`} title="แก้ไขกิจกรรม">✎</button><button type="button" className="activity-archive-restore" onClick={() => restoreArchivedActivity(item)} aria-label={`ส่ง ${item.title} กลับไป Timeline`} title="ส่งไป Timeline">↗</button><button type="button" className="activity-archive-delete" onClick={() => setActivityArchive((current) => current.filter((archived) => archived.archiveId !== item.archiveId))} aria-label={`ลบ ${item.title} ออกจากคลัง`} title="ลบจากคลัง">🗑</button></div>
            </li>)}
          </ol>
        )}
      </section>
    </div>
  );
}
