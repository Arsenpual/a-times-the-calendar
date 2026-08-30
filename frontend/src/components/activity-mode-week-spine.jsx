import React, { useEffect, useMemo, useRef, useState } from "react";
import { activityDate, formatTime, getWeekRange, isSameDay, weekdayShortLabels } from "../date-utils.js";
import { buildWeekSpineData } from "../week-spine-data.js";
import { layoutOverlaps } from "../timeline-layout.js";
import { useLanguage } from "../i18n.jsx";
import { normalizeActivityId } from "../id-utils.js";
import ActivityPopup from "./activity-popup.jsx";
import AutoShrinkText from "./auto-shrink-text.jsx";
import { deleteActivityArchiveItem, fetchActivityArchive, saveActivityArchiveItem } from "../api.js";

const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const DAY_SPAN_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
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
}) {
  const { language } = useLanguage();
  const [weekStart, weekEnd] = getWeekRange(anchorDate);
  const [selectedDay, setSelectedDay] = useState(anchorDate);
  const [draft, setDraft] = useState(null);
  const [dragged, setDragged] = useState(null);
  const [interactionWarning, setInteractionWarning] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  // Selection is intentionally separate from timeline manipulation: it is a
  // collection for bulk deletion, not a modifier for moving/resizing blocks.
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedActivityIds, setSelectedActivityIds] = useState(() => new Set());
  const [pendingTimeChanges, setPendingTimeChanges] = useState(() => new Map());
  const [isSavingTimeChanges, setIsSavingTimeChanges] = useState(false);
  const dragStartedAt = useRef(null);
  const shouldSuppressBlockClick = useRef(false);
  const [timelineFullscreen, setTimelineFullscreen] = useState(false);
  const archiveStorageKey = `times-activity-archive:${userId || "guest"}`;
  const [activityArchive, setActivityArchive] = useState([]);
  // Makes a restored item render immediately even while the archive write and
  // the Calendar refresh are settling after a week change.
  const [restoringCalendarIds, setRestoringCalendarIds] = useState(() => new Set());
  const [archiveHydrated, setArchiveHydrated] = useState(false);
  const [archiveRemoteReady, setArchiveRemoteReady] = useState(false);
  const archiveSnapshotRef = useRef(new Map());
  const [archiveTagDrafts, setArchiveTagDrafts] = useState({});
  const effectiveHoursPerCell = timelineFullscreen ? 1 : hoursPerCell;
  const hourMarks = useMemo(() => Array.from({ length: (DAY_END_HOUR - DAY_START_HOUR) / effectiveHoursPerCell + 1 }, (_, index) => DAY_START_HOUR + index * effectiveHoursPerCell), [effectiveHoursPerCell]);
  useEffect(() => {
    document.body.classList.toggle("week-spine-fullscreen-active", timelineFullscreen);
    return () => document.body.classList.remove("week-spine-fullscreen-active");
  }, [timelineFullscreen]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + offset);
    return day;
  }), [weekStart]);

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
  const visibleSelectedDay = weekDays.find((day) => isSameDay(day, selectedDay)) || weekDays[0];
  const selectedSegments = timelineSegments
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

  // Migrate any existing browser-only archive on first successful load, then
  // use Firestore as the durable source for this user across devices.
  useEffect(() => {
    if (!archiveHydrated || !userId) return;
    let cancelled = false;
    fetchActivityArchive()
      .then((remoteItems) => {
        if (cancelled) return;
        const archiveItems = Array.isArray(remoteItems) ? remoteItems : [];
        // Firestore is the archive source of truth. A local browser copy may
        // help during startup, but must never resurrect items absent from the
        // user's remote archive.
        archiveSnapshotRef.current = new Map(archiveItems.map((item) => [item.archiveId, JSON.stringify(item)]));
        setActivityArchive(archiveItems);
        setArchiveRemoteReady(true);
      })
      .catch((error) => {
        console.error("โหลดคลังกิจกรรมจาก Firebase ไม่สำเร็จ:", error.message);
        // Local copy stays usable; a later state change will retry on reload.
      });
    return () => { cancelled = true; };
  }, [archiveHydrated, userId]);

  useEffect(() => {
    if (!archiveHydrated) return;
    try {
      window.localStorage.setItem(archiveStorageKey, JSON.stringify(activityArchive));
      window.dispatchEvent(new CustomEvent("times-activity-archive-changed", { detail: { userId } }));
    } catch {
      // Storage may be unavailable; keep the in-memory archive usable.
    }
    if (!archiveRemoteReady) return;
    const nextSnapshot = new Map(activityArchive.map((item) => [item.archiveId, JSON.stringify(item)]));
    for (const item of activityArchive) {
      if (archiveSnapshotRef.current.get(item.archiveId) !== JSON.stringify(item)) {
        saveActivityArchiveItem(item).catch((error) => console.error("บันทึกคลังกิจกรรมลง Firebase ไม่สำเร็จ:", error.message));
      }
    }
    for (const archiveId of archiveSnapshotRef.current.keys()) {
      if (!nextSnapshot.has(archiveId)) {
        deleteActivityArchiveItem(archiveId).catch((error) => console.error("ลบคลังกิจกรรมจาก Firebase ไม่สำเร็จ:", error.message));
      }
    }
    archiveSnapshotRef.current = nextSnapshot;
  }, [activityArchive, archiveStorageKey, archiveHydrated, archiveRemoteReady, userId]);

  const archiveActivity = async (segment) => {
    if (segment.isLocked) {
      setInteractionWarning("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเก็บเข้าคลัง");
      return;
    }
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
    try {
      // Archive first so a failed network request can never lose the activity.
      await saveActivityArchiveItem(archived);
      // An archived activity must no longer exist in Google Calendar. This
      // removes it from the automatic two-way Calendar sync and Week Spine.
      await onDeleteActivity?.(segment.calendarId);
      archiveSnapshotRef.current.set(archived.archiveId, JSON.stringify(archived));
      setActivityArchive((current) => [archived, ...current.filter((item) => !(item.start === archived.start && item.title === archived.title))]);
    } catch (error) {
      // If Calendar deletion fails, remove the just-created remote archive so
      // the same activity is not simultaneously archived and on the calendar.
      await deleteActivityArchiveItem(archived.archiveId).catch(() => {});
      setInteractionWarning(error?.message || "เก็บกิจกรรมเข้าคลังไม่สำเร็จ");
    }
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
    try {
      // This is intentionally distinct from normal drag saving: restoring
      // must create/update first even when its time conflicts. The Timeline
      // then exposes that conflict so the person can drag it into place.
      const saved = await onRestoreArchivedActivity?.({
        // The old Google Calendar id was deliberately deleted on archive.
        // Restoring therefore creates a fresh event and reconnects it to sync.
        calendarId: null,
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
    if (!dragged?.isDuplicatePlacement) return undefined;
    const updatePlacement = (event) => {
      const track = trackAtPointer(event);
      const day = dayForTrack(track);
      if (!track || !day) return;
      const pointerMinutes = snapPointerToMinutes(event, track);
      setDragged((current) => {
        if (!current?.isDuplicatePlacement) return current;
        const startMinutes = Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - current.durationMinutes, pointerMinutes - current.pointerOffsetMinutes));
        return { ...current, day, startMinutes, endMinutes: startMinutes + current.durationMinutes };
      });
    };
    const placePlacement = (event) => {
      if (event.button !== 0) return;
      const track = trackAtPointer(event);
      const day = dayForTrack(track);
      if (!track || !day) return;
      event.preventDefault();
      event.stopPropagation();
      const pointerMinutes = snapPointerToMinutes(event, track);
      const startMinutes = Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - dragged.durationMinutes, pointerMinutes - dragged.pointerOffsetMinutes));
      const start = dateAtMinutes(day, startMinutes);
      const end = dateAtMinutes(day, startMinutes + dragged.durationMinutes);
      setDragged(null);
      onDuplicateActivity?.(dragged.source, {
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() }
      }).catch((error) => setInteractionWarning(error?.message || "ทำสำเนากิจกรรมไม่สำเร็จ"));
    };
    const cancelPlacement = (event) => {
      if (event.key === "Escape") setDragged(null);
    };
    window.addEventListener("pointermove", updatePlacement);
    window.addEventListener("pointerdown", placePlacement, true);
    window.addEventListener("keydown", cancelPlacement);
    return () => {
      window.removeEventListener("pointermove", updatePlacement);
      window.removeEventListener("pointerdown", placePlacement, true);
      window.removeEventListener("keydown", cancelPlacement);
    };
  }, [dragged, onDuplicateActivity]);

  // Folder-like selection: Ctrl/Cmd-click toggles an item without opening
  // its editor. Delete removes the selected items after one explicit
  // confirmation; Escape exits selection mode without changing activities.
  useEffect(() => {
    const handleSelectionKeys = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable)) return;
      if (event.key === "Escape" && selectedActivityIds.size) {
        setSelectedActivityIds(new Set());
        setIsSelectionMode(false);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedActivityIds.size) {
        event.preventDefault();
        if (!window.confirm(`ลบกิจกรรมที่เลือก ${selectedActivityIds.size} รายการใช่ไหม?`)) return;
        const ids = [...selectedActivityIds];
        setSelectedActivityIds(new Set());
        setIsSelectionMode(false);
        Promise.all(ids.map((id) => onDeleteActivity?.(id))).catch((error) => setInteractionWarning(error?.message || "ลบบางกิจกรรมไม่สำเร็จ"));
      }
    };
    window.addEventListener("keydown", handleSelectionKeys);
    return () => window.removeEventListener("keydown", handleSelectionKeys);
  }, [selectedActivityIds, onDeleteActivity]);

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

  const queueTimeChanges = (changes) => {
    setPendingTimeChanges((current) => {
      const next = new Map(current);
      changes.forEach(({ id, start, end }) => next.set(id, { start: new Date(start), end: new Date(end) }));
      return next;
    });
  };

  const savePendingTimeChanges = async () => {
    const changes = [...pendingTimeChanges.entries()].map(([id, value]) => ({ id, start: value.start, end: value.end }));
    if (changes.length === 0) return true;
    setIsSavingTimeChanges(true);
    try {
      const saved = await onSaveTimes?.(changes);
      if (saved === false) {
        setInteractionWarning("บันทึกการปรับเวลาไม่สำเร็จ — กรุณาแก้เวลาที่ชนกันก่อน");
        return false;
      }
      setPendingTimeChanges(new Map());
      return true;
    } catch (error) {
      setInteractionWarning(error?.message || "บันทึกการปรับเวลาไม่สำเร็จ");
      return false;
    } finally {
      setIsSavingTimeChanges(false);
    }
  };

  const moveActivityToDay = async (activityId, date) => {
    // A date move is deliberately transactional from the person's point of
    // view: flush any local timeline edits first, then request the move.
    const changesBeforeMove = [...pendingTimeChanges.entries()].map(([id, value]) => ({ id, start: value.start, end: value.end }));
    if (!(await savePendingTimeChanges())) return false;
    return onMoveActivityToDay?.(activityId, date, changesBeforeMove);
  };

  const openContextMenu = (event, segment) => {
    event.preventDefault();
    if (segment.source.isOnboardingSample) {
      setInteractionWarning("นี่คือกิจกรรมตัวอย่างในเครื่อง — คลิกเพื่อสร้างกิจกรรมจริงจากตัวอย่างนี้");
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

  const beginDuplicatePlacement = (activity) => {
    const start = activityDate(activity?.start);
    const end = activityDate(activity?.end);
    if (!start || !end || end <= start) return;
    const day = new Date(start);
    day.setHours(0, 0, 0, 0);
    const durationMinutes = Math.max(SNAP_MINUTES, Math.round((end - start) / 60000));
    // The copy stays local until the user chooses a Timeline position.
    setDragged({
      type: "move",
      isDuplicatePlacement: true,
      pointerId: null,
      calendarId: null,
      source: activity,
      day,
      startMinutes: minutesSinceDayStart(start, day),
      endMinutes: minutesSinceDayStart(end, day),
      durationMinutes,
      pointerOffsetMinutes: Math.round((durationMinutes / 2) / SNAP_MINUTES) * SNAP_MINUTES,
    });
  };

  const updateExistingDrag = (event) => {
    if (!dragged || dragged.isDuplicatePlacement || (dragged.pointerId !== null && event.pointerId !== dragged.pointerId)) return;
    if (dragStartedAt.current && (Math.abs(event.clientX - dragStartedAt.current.x) > 3 || Math.abs(event.clientY - dragStartedAt.current.y) > 3)) {
      shouldSuppressBlockClick.current = true;
    }
    const track = trackAtPointer(event) || event.currentTarget;
    const targetDay = dayForTrack(track);
    if (!targetDay) return;
    const pointerMinutes = snapPointerToMinutes(event, track);
    setDragged((current) => {
      if (!current) return current;
      const activeDrag = current.pointerId === null ? { ...current, pointerId: event.pointerId } : current;
      if (activeDrag.type === "resize") {
        // Selection does not affect moving. It only lets the resize handle
        // apply one shared end-time delta to all selected activities.
        const selectedDurations = isSelectionMode && selectedActivityIds.has(activeDrag.calendarId)
          ? timelineSegments
            .filter((segment) => selectedActivityIds.has(segment.calendarId) && !segment.isLocked && !segment.continuesFromPreviousDay && !segment.continuesIntoNextDay)
            .map((segment) => Math.round((segment.end - segment.start) / 60000))
          : [activeDrag.durationMinutes];
        const shortestDuration = Math.min(...selectedDurations, activeDrag.durationMinutes);
        const smallestAllowedEnd = Math.max(
          activeDrag.startMinutes + SNAP_MINUTES,
          activeDrag.endMinutes - Math.max(0, shortestDuration - SNAP_MINUTES)
        );
        return { ...activeDrag, endMinutes: Math.min(DAY_END_HOUR * 60, Math.max(smallestAllowedEnd, pointerMinutes + SNAP_MINUTES)) };
      }
      const startMinutes = Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - activeDrag.durationMinutes, pointerMinutes - activeDrag.pointerOffsetMinutes));
      return { ...activeDrag, day: targetDay, startMinutes, endMinutes: startMinutes + activeDrag.durationMinutes };
    });
  };

  const finishExistingDrag = (event) => {
    if (!dragged || event.pointerId !== dragged.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const completed = dragged;
    setDragged(null);
    dragStartedAt.current = null;
    if (!shouldSuppressBlockClick.current) {
      // In selection mode, a press/release toggles selection; a true drag is
      // handled below and moves the selected set together.
      shouldSuppressBlockClick.current = true;
      if (isSelectionMode) {
        setSelectedActivityIds((current) => {
          const next = new Set(current);
          next.has(completed.calendarId) ? next.delete(completed.calendarId) : next.add(completed.calendarId);
          return next;
        });
        return;
      }
      // A pointer press/release without movement is a left-click: open the
      // existing single-activity editor directly from the timeline block.
      onEditActivity?.(completed.source);
      return;
    }
    const start = dateAtMinutes(completed.day, completed.startMinutes);
    const end = dateAtMinutes(completed.day, completed.endMinutes);
    const selectionForBatchEdit = isSelectionMode && selectedActivityIds.has(completed.calendarId)
      ? selectedActivityIds
      : null;
    if (start.getTime() !== new Date(completed.source.start.dateTime).getTime() || end.getTime() !== new Date(completed.source.end.dateTime).getTime()) {
      if (selectionForBatchEdit) {
        const delta = completed.type === "resize"
          ? end.getTime() - new Date(completed.source.end.dateTime).getTime()
          : start.getTime() - new Date(completed.source.start.dateTime).getTime();
        const changes = timelineSegments
          .filter((segment) => selectedActivityIds.has(segment.calendarId) && !segment.isLocked && !segment.continuesFromPreviousDay && !segment.continuesIntoNextDay)
          .map((segment) => completed.type === "resize"
            ? { id: segment.calendarId, start: new Date(segment.start), end: new Date(segment.end.getTime() + delta) }
            : { id: segment.calendarId, start: new Date(segment.start.getTime() + delta), end: new Date(segment.end.getTime() + delta) });
        queueTimeChanges(changes);
      } else {
        queueTimeChanges([{ id: completed.calendarId, start, end }]);
      }
    }
  };

  return (
    <div className="week-spine-layout">
      <section className="week-spine" aria-label="Activity Week Spine">
        {visibleAllDayActivities.length > 0 && <div className="week-spine-all-day"><strong>กิจกรรมทั้งวัน</strong>{visibleAllDayActivities.map((activity) => <span key={activity.calendarId}>{activity.title}</span>)}</div>}
        <section className={`week-spine-timeline-surface${timelineFullscreen ? " is-fullscreen" : ""}${effectiveHoursPerCell === 2 ? " is-two-hour-grid" : ""}${effectiveHoursPerCell === 4 ? " is-four-hour-grid" : ""}`}>
        <button className="week-spine-fullscreen-btn" type="button" onClick={toggleTimelineFullscreen} aria-label={timelineFullscreen ? "ออกจากเต็มหน้าจอ" : "เปิด timeline แบบเต็มหน้าจอ"} title={timelineFullscreen ? "ออกจากเต็มหน้าจอ" : "เต็มหน้าจอ"}>{timelineFullscreen ? "⤢" : "⛶"}</button>
        {pendingTimeChanges.size > 0 && <div className="week-spine-save-bar" role="status">
          <span>มีการปรับเวลา {pendingTimeChanges.size} รายการ</span>
          <button type="button" onClick={() => setPendingTimeChanges(new Map())} disabled={isSavingTimeChanges}>ยกเลิก</button>
          <button type="button" className="week-spine-save-btn" onClick={savePendingTimeChanges} disabled={isSavingTimeChanges}>{isSavingTimeChanges ? "กำลังบันทึก..." : "บันทึก"}</button>
        </div>}
        <div className="week-spine-edge-nav" aria-label="เปลี่ยนสัปดาห์">
          <button type="button" className="week-spine-edge-nav-prev" onClick={() => navigateWeekBy(-1)} aria-label="สัปดาห์ก่อนหน้า">‹</button>
          <button type="button" className="week-spine-edge-nav-next" onClick={() => navigateWeekBy(1)} aria-label="สัปดาห์ถัดไป">›</button>
        </div>
        {interactionWarning && <p className="error-banner" role="alert">{interactionWarning}</p>}
        {timelineFullscreen && tokenNearingExpiry && <div className="week-spine-token-prompt" role="alert"><span>สิทธิ์ Google Calendar ใกล้หมดอายุ</span><button type="button" onClick={onReauthCalendar}>ต่ออายุตอนนี้</button></div>}
      <div className="week-spine-grid-wrap">
        {!timelineFullscreen && <div className="week-spine-density-control" role="group" aria-label="ความละเอียด Week Spine">
          <button type="button" className={hoursPerCell === 1 ? "is-active" : ""} onClick={() => onHoursPerCellChange?.(1)} aria-pressed={hoursPerCell === 1} title="1 ชั่วโมงต่อช่อง">1h</button>
          <button type="button" className={hoursPerCell === 2 ? "is-active" : ""} onClick={() => onHoursPerCellChange?.(2)} aria-pressed={hoursPerCell === 2} title="2 ชั่วโมงต่อช่อง">2h</button>
          <button type="button" className={hoursPerCell === 4 ? "is-active" : ""} onClick={() => onHoursPerCellChange?.(4)} aria-pressed={hoursPerCell === 4} title="4 ชั่วโมงต่อช่อง">4h</button>
        </div>}
        <div className="week-spine-hours" aria-hidden="true" style={{ "--week-spine-hour-cell-count": (DAY_END_HOUR - DAY_START_HOUR) / effectiveHoursPerCell }}>
          {hourMarks.map((hour) => <span key={hour} style={{ top: `${((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}
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
                    const lane = laneLayout[segment.segmentId] || { stackIndex: 0, hidden: false, hiddenCount: 0, stackZ: 1, titleBelow: false, titleOffsetMinutes: 0 };
                    if (lane.hidden) return null;
                    const stackOffset = lane.stackIndex * 10;
                    const titleOffsetPercent = lane.titleOffsetMinutes ? (lane.titleOffsetMinutes / Math.max(1, segment.end - segment.start)) * 6000000 : 0;
                    if (dragged?.calendarId === segment.calendarId) return null;
                    const continuationClass = segment.continuesFromPreviousDay || segment.continuesIntoNextDay ? " is-continuation" : "";
                    return <span key={segment.segmentId} title={`${segment.title}${segment.source.isOnboardingSample ? " (ตัวอย่าง)" : ""}${segment.continuesFromPreviousDay ? " (ต่อเนื่องจากวันก่อน)" : ""}${segment.continuesIntoNextDay ? " (ต่อเนื่องวันถัดไป)" : ""}`} className={`week-spine-block${segment.isLocked || segment.source.isOnboardingSample || segment.continuesFromPreviousDay || segment.continuesIntoNextDay ? "" : " is-draggable"}${continuationClass}${lane.titleBelow ? " has-stacked-title" : ""}${selectedActivityIds.has(segment.calendarId) ? " is-series-selected" : ""}`} style={{ top: `${top}%`, height: `${height}%`, left: "3px", width: `calc(100% - ${6 + stackOffset}px)`, zIndex: lane.stackZ, backgroundColor: continuationClass ? segment.color.bg : segment.color.border, color: segment.color.border, borderLeftColor: segment.color.border }} onPointerDown={(event) => { if (!segment.source.isOnboardingSample && (!isSelectionMode || selectedActivityIds.has(segment.calendarId))) beginExistingDrag(event, segment, day, "move"); }} onClick={(event) => { event.stopPropagation(); if (shouldSuppressBlockClick.current) { shouldSuppressBlockClick.current = false; return; } if (isSelectionMode || event.ctrlKey || event.metaKey) { setSelectedActivityIds((current) => { const next = new Set(current); next.has(segment.calendarId) ? next.delete(segment.calendarId) : next.add(segment.calendarId); return next; }); return; } openSegmentEditor(segment); }} onContextMenu={(event) => openContextMenu(event, segment)}>
                      <AutoShrinkText text={segment.title} minScale={0.01} baseFontSize="12px" className={`week-spine-block-title${lane.titleBelow ? " is-stacked" : ""}${titleOffsetPercent > 0 ? " is-relocated" : ""}`} style={titleOffsetPercent > 0 ? { top: `${titleOffsetPercent}%` } : undefined} />
                      {lane.hiddenCount > 0 && <small className="week-spine-overflow-count">+{lane.hiddenCount}</small>}
                      {(!isSelectionMode || selectedActivityIds.has(segment.calendarId)) && !segment.isLocked && !segment.source.isOnboardingSample && !segment.continuesFromPreviousDay && !segment.continuesIntoNextDay && <span className="week-spine-resize-handle" onPointerDown={(event) => beginExistingDrag(event, segment, day, "resize")} />}
                    </span>;
                  })}
                  {draft && isSameDay(draft.day, day) && <span className="week-spine-draft" style={{ top: `${((draft.startMinutes - DAY_START_HOUR * 60) / DAY_SPAN_MINUTES) * 100}%`, height: `${((draft.endMinutes - draft.startMinutes) / DAY_SPAN_MINUTES) * 100}%` }} />}
                  {dragged && isSameDay(dragged.day, day) && <span className="week-spine-block is-dragging" style={{ top: `${((dragged.startMinutes - DAY_START_HOUR * 60) / DAY_SPAN_MINUTES) * 100}%`, height: `${((dragged.endMinutes - dragged.startMinutes) / DAY_SPAN_MINUTES) * 100}%`, zIndex: 100, backgroundColor: dragged.source ? timelineSegments.find((segment) => segment.calendarId === dragged.calendarId)?.color.border : undefined }}><AutoShrinkText text={dragged.source?.summary || "(ไม่มีชื่อกิจกรรม)"} minScale={0.01} baseFontSize="12px" className="week-spine-block-title" /></span>}
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
        onSelectSeriesDrag={() => { setIsSelectionMode(true); setSelectedActivityIds((current) => new Set(current).add(contextMenu.segment.calendarId)); }}
        onDuplicate={() => beginDuplicatePlacement(contextMenu.segment.source)}
        onMoveToDay={(date) => moveActivityToDay(contextMenu.segment.calendarId, date)}
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
