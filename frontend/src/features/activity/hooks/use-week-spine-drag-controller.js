import { useEffect } from "react";
import { activityDate, toDateInputValue } from "../../../shared/lib/date-utils.js";

const DAY_START_MINUTES = 0;
const DAY_END_MINUTES = 24 * 60;
const SNAP_MINUTES = 15;

function minutesSinceDayStart(date, day) {
  const midnight = new Date(day);
  midnight.setHours(0, 0, 0, 0);
  return Math.round((date - midnight) / 60000);
}

function dateAtMinutes(day, minutes) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
}

/**
 * Pointer controller for the Week Spine. It never saves directly: completed
 * moves are queued through `queueTimeChanges`, then the save-bar owns writes.
 */
export function useWeekSpineDragController({
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
  onMoveActivityToDay,
  showInteractionWarning
}) {
  const {
    draft,
    setDraft,
    dragged,
    setDragged,
    dragStartedAt,
    shouldSuppressBlockClick,
    updateResizeAlignmentGuide,
    pulseMatchingTimeEdges,
    clearDragFeedback
  } = dragState;

  const trackAtPointer = (event) => document.elementFromPoint(event.clientX, event.clientY)?.closest(".week-spine-track");
  const dayForTrack = (track) => weekDays[Number(track?.dataset.dayIndex)];
  const snapPointerToMinutes = (event, track) => {
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const raw = DAY_START_MINUTES + ratio * DAY_END_MINUTES;
    return Math.min(DAY_END_MINUTES - SNAP_MINUTES, Math.max(DAY_START_MINUTES, Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES));
  };

  useEffect(() => {
    if (!dragged?.isDuplicatePlacement) return undefined;
    const updatePlacement = (event) => {
      const track = trackAtPointer(event);
      const day = dayForTrack(track);
      if (!track || !day) return;
      if (dragged.source?.start?.date && !dragged.source?.start?.dateTime) {
        setDragged((current) => current?.isDuplicatePlacement ? { ...current, day } : current);
        return;
      }
      const pointerMinutes = snapPointerToMinutes(event, track);
      setDragged((current) => {
        if (!current?.isDuplicatePlacement) return current;
        const startMinutes = Math.max(DAY_START_MINUTES, Math.min(DAY_END_MINUTES - current.durationMinutes, pointerMinutes - current.pointerOffsetMinutes));
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
      const isAllDaySource = Boolean(dragged.source?.start?.date && !dragged.source?.start?.dateTime);
      if (isAllDaySource) {
        const sourceStart = activityDate(dragged.source.start);
        const sourceEnd = activityDate(dragged.source.end);
        const durationDays = Math.max(1, Math.round((sourceEnd - sourceStart) / 86400000));
        const startDay = new Date(day);
        startDay.setHours(0, 0, 0, 0);
        const endDay = new Date(startDay);
        endDay.setDate(endDay.getDate() + durationDays);
        setDragged(null);
        onDuplicateActivity?.(dragged.source, {
          start: { date: toDateInputValue(startDay) },
          end: { date: toDateInputValue(endDay) }
        }).catch((error) => showInteractionWarning(error?.message || "ทำสำเนากิจกรรมไม่สำเร็จ"));
        return;
      }
      const pointerMinutes = snapPointerToMinutes(event, track);
      const startMinutes = Math.max(DAY_START_MINUTES, Math.min(DAY_END_MINUTES - dragged.durationMinutes, pointerMinutes - dragged.pointerOffsetMinutes));
      const start = dateAtMinutes(day, startMinutes);
      const end = dateAtMinutes(day, startMinutes + dragged.durationMinutes);
      setDragged(null);
      onDuplicateActivity?.(dragged.source, {
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() }
      }).catch((error) => showInteractionWarning(error?.message || "ทำสำเนากิจกรรมไม่สำเร็จ"));
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
  }, [dragged, onDuplicateActivity, weekDays]);

  const beginDraft = (event, day) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.preventDefault();
    showInteractionWarning("");
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
    onAddActivity?.(start, { preserveTime: true, end });
  };

  const beginExistingDrag = (event, segment, day, mode) => {
    if (event.button !== 0 || segment.isLocked || segment.continuesFromPreviousDay || segment.continuesIntoNextDay) return;
    event.preventDefault();
    event.stopPropagation();
    showInteractionWarning("");
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
      pointerOffsetMinutes: Math.max(0, Math.round((pointerMinutes - startMinutes) / SNAP_MINUTES) * SNAP_MINUTES)
    });
    if (mode === "resize") updateResizeAlignmentGuide({ endMinutes, day, weekDays, daySpanMinutes: DAY_END_MINUTES });
  };

  const beginAllDayDrag = (event, activity, day) => {
    if (event.button !== 0 || activity.isLocked) return;
    event.preventDefault();
    event.stopPropagation();
    showInteractionWarning("");
    const track = event.currentTarget.closest(".week-spine-track");
    track?.setPointerCapture?.(event.pointerId);
    dragStartedAt.current = { x: event.clientX, y: event.clientY };
    shouldSuppressBlockClick.current = false;
    clearDragFeedback();
    setDragged({
      type: "move-all-day",
      isAllDay: true,
      pointerId: event.pointerId,
      calendarId: activity.calendarId,
      source: activity.source,
      originDay: new Date(day),
      day: new Date(day)
    });
  };

  const beginDuplicatePlacement = (activity) => {
    const start = activityDate(activity?.start);
    const end = activityDate(activity?.end);
    if (!start || !end || end <= start) return;
    const day = new Date(start);
    day.setHours(0, 0, 0, 0);
    const durationMinutes = Math.max(SNAP_MINUTES, Math.round((end - start) / 60000));
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
      pointerOffsetMinutes: Math.round((durationMinutes / 2) / SNAP_MINUTES) * SNAP_MINUTES
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
    if (dragged.isAllDay) {
      setDragged((current) => current && ({ ...current, day: new Date(targetDay) }));
      return;
    }
    const pointerMinutes = snapPointerToMinutes(event, track);
    if (dragged.type === "resize") {
      const selectedDurations = isSelectionMode && selectedActivityIds.has(dragged.calendarId)
        ? timelineSegments
          .filter((segment) => selectedActivityIds.has(segment.calendarId) && !segment.isLocked && !segment.continuesFromPreviousDay && !segment.continuesIntoNextDay)
          .map((segment) => Math.round((segment.end - segment.start) / 60000))
        : [dragged.durationMinutes];
      const shortestDuration = Math.min(...selectedDurations, dragged.durationMinutes);
      const smallestAllowedEnd = Math.max(
        dragged.startMinutes + SNAP_MINUTES,
        dragged.endMinutes - Math.max(0, shortestDuration - SNAP_MINUTES)
      );
      const endMinutes = Math.min(DAY_END_MINUTES, Math.max(smallestAllowedEnd, pointerMinutes + SNAP_MINUTES));
      updateResizeAlignmentGuide({ endMinutes, day: dragged.day, weekDays, daySpanMinutes: DAY_END_MINUTES });
      pulseMatchingTimeEdges({ segments: timelineSegments, startMinutes: dragged.startMinutes, endMinutes, draggedActivityId: dragged.calendarId, minutesForSegment: minutesSinceDayStart });
      setDragged((current) => current && ({ ...current, endMinutes }));
      return;
    }
    const startMinutes = Math.max(DAY_START_MINUTES, Math.min(DAY_END_MINUTES - dragged.durationMinutes, pointerMinutes - dragged.pointerOffsetMinutes));
    pulseMatchingTimeEdges({ segments: timelineSegments, startMinutes, endMinutes: startMinutes + dragged.durationMinutes, draggedActivityId: dragged.calendarId, minutesForSegment: minutesSinceDayStart });
    setDragged((current) => {
      if (!current) return current;
      const activeDrag = current.pointerId === null ? { ...current, pointerId: event.pointerId } : current;
      const nextStartMinutes = Math.max(DAY_START_MINUTES, Math.min(DAY_END_MINUTES - activeDrag.durationMinutes, pointerMinutes - activeDrag.pointerOffsetMinutes));
      return { ...activeDrag, day: targetDay, startMinutes: nextStartMinutes, endMinutes: nextStartMinutes + activeDrag.durationMinutes };
    });
  };

  const finishExistingDrag = (event) => {
    if (!dragged || event.pointerId !== dragged.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const completed = dragged;
    setDragged(null);
    clearDragFeedback();
    dragStartedAt.current = null;
    if (!shouldSuppressBlockClick.current) {
      shouldSuppressBlockClick.current = true;
      if (isSelectionMode) {
        toggleActivitySelection(completed.calendarId);
        return;
      }
      onEditActivity?.(completed.source);
      return;
    }
    if (completed.isAllDay) {
      const originDay = new Date(completed.originDay);
      originDay.setHours(0, 0, 0, 0);
      const targetDay = new Date(completed.day);
      targetDay.setHours(0, 0, 0, 0);
      const dayDelta = Math.round((targetDay - originDay) / 86400000);
      if (dayDelta === 0) return;
      const sourceStart = activityDate(completed.source.start);
      if (!sourceStart) return;
      sourceStart.setDate(sourceStart.getDate() + dayDelta);
      onMoveActivityToDay?.(completed.calendarId, toDateInputValue(sourceStart))
        .catch((error) => showInteractionWarning(error?.message || "ย้ายกิจกรรมทั้งวันไม่สำเร็จ"));
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

  return {
    beginDraft,
    updateDraft,
    finishDraft,
    beginExistingDrag,
    beginAllDayDrag,
    beginDuplicatePlacement,
    updateExistingDrag,
    finishExistingDrag
  };
}
