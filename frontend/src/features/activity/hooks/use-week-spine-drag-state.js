import { useEffect, useRef, useState } from "react";
import { isSameDay } from "../../../shared/lib/date-utils.js";

/**
 * Owns transient pointer state and visual feedback for moving/resizing blocks.
 * Pointer decisions live in useWeekSpineDragController.
 * This hook owns feedback timers and their cleanup.
 */
export function useWeekSpineDragState() {
  const [draft, setDraft] = useState(null);
  const [dragged, setDragged] = useState(null);
  const [resizeAlignmentGuide, setResizeAlignmentGuide] = useState(null);
  const [alignmentPulse, setAlignmentPulse] = useState(null);
  const weekSpineGridRef = useRef(null);
  const dragStartedAt = useRef(null);
  const shouldSuppressBlockClick = useRef(false);
  const alignmentPulseKeyRef = useRef(null);
  const alignmentPulseTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(alignmentPulseTimerRef.current), []);

  const updateResizeAlignmentGuide = ({ endMinutes, day, weekDays, daySpanMinutes }) => {
    const grid = weekSpineGridRef.current;
    const dayIndex = weekDays.findIndex((candidate) => isSameDay(candidate, day));
    const track = dayIndex >= 0 ? grid?.querySelector(`.week-spine-track[data-day-index="${dayIndex}"]`) : null;
    if (!grid || !track) return;
    const gridRect = grid.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    setResizeAlignmentGuide({
      top: trackRect.top - gridRect.top + (Math.min(daySpanMinutes, Math.max(0, endMinutes)) / daySpanMinutes) * trackRect.height
    });
  };

  const pulseMatchingTimeEdges = ({ segments, startMinutes, endMinutes, draggedActivityId, minutesForSegment }) => {
    const matchingIds = [...new Set(segments
      .filter((segment) => segment.calendarId !== draggedActivityId)
      .filter((segment) => {
        const segmentStart = minutesForSegment(segment.start, segment.day);
        const segmentEnd = minutesForSegment(segment.end, segment.day);
        return segmentStart === startMinutes || segmentEnd === startMinutes || segmentStart === endMinutes || segmentEnd === endMinutes;
      })
      .map((segment) => segment.calendarId))];
    if (!matchingIds.length) {
      alignmentPulseKeyRef.current = null;
      return;
    }
    const key = `${startMinutes}:${endMinutes}:${matchingIds.sort().join(",")}`;
    if (alignmentPulseKeyRef.current === key) return;
    alignmentPulseKeyRef.current = key;
    window.clearTimeout(alignmentPulseTimerRef.current);
    setAlignmentPulse({ key, activityIds: new Set(matchingIds) });
    alignmentPulseTimerRef.current = window.setTimeout(() => setAlignmentPulse(null), 640);
  };

  const clearDragFeedback = () => {
    window.clearTimeout(alignmentPulseTimerRef.current);
    setResizeAlignmentGuide(null);
    setAlignmentPulse(null);
    alignmentPulseKeyRef.current = null;
  };

  return {
    draft,
    setDraft,
    dragged,
    setDragged,
    resizeAlignmentGuide,
    alignmentPulse,
    weekSpineGridRef,
    dragStartedAt,
    shouldSuppressBlockClick,
    updateResizeAlignmentGuide,
    pulseMatchingTimeEdges,
    clearDragFeedback
  };
}
