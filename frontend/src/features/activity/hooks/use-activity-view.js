import { useCallback, useRef, useState } from "react";
import { formatWeekLabel, getYearCycle } from "../../../shared/lib/date-utils.js";

function formatCycleLabel(date) {
  const cycle = getYearCycle(date);
  const dateLabel = cycle.start.toLocaleDateString("th-TH", { day: "numeric", month: "long" });
  return `${dateLabel} cycle ที่ ${cycle.cycleNumber}/${cycle.totalCycles} ของปี`;
}

/** Coordinates Activity views. cursorDate remains owned by week navigation.
 * Cycle data is owned separately by useCycleActivities at the app composition level.
 */
export function useActivityView({ cursorDate, selectWeek, closeDay, userId = null }) {
  const [ownerId, setOwnerId] = useState(userId);
  const [weekSpineViewMode, setWeekSpineViewMode] = useState("week");
  // This deliberately stays separate from cursorDate. In Cycle view, users
  // may inspect any of its four weeks without moving the visible Cycle.
  const [cycleAnchorDate, setCycleAnchorDate] = useState(() => new Date());
  const [weekSpineFullscreenRequest, setWeekSpineFullscreenRequest] = useState(0);
  const [summaryPanelMode, setSummaryPanelMode] = useState("week");
  const cycleViewToRestoreRef = useRef(null);
  // Reset before rendering children so a new account cannot consume an old
  // fullscreen request. React retries this component before committing children.
  if (ownerId !== userId) {
    setOwnerId(userId);
    setWeekSpineViewMode("week");
    setCycleAnchorDate(new Date());
    setWeekSpineFullscreenRequest(0);
    setSummaryPanelMode("week");
    cycleViewToRestoreRef.current = null;
  }
  const setWeekSpineView = useCallback((nextView) => {
    if (nextView === "four-weeks") {
      setCycleAnchorDate(getYearCycle(cursorDate).start);
      setSummaryPanelMode("cycle");
    }
    if (nextView === "week") setSummaryPanelMode("week");
    setWeekSpineViewMode(nextView);
  }, [cursorDate]);
  const navigateCycle = useCallback((direction) => {
    const currentCycle = getYearCycle(cycleAnchorDate);
    const pivot = new Date(direction > 0 ? currentCycle.end : currentCycle.start);
    pivot.setDate(pivot.getDate() + (direction > 0 ? 1 : -1));
    const nextCycle = getYearCycle(pivot);
    // Browsing another Cycle must not silently change the user's focused
    // week. The focus only changes after they deliberately click a week
    // inside the Cycle; returning to 7-day view then restores that focus.
    setCycleAnchorDate(nextCycle.start);
  }, [cycleAnchorDate]);
  const openCycleWeekEditor = useCallback((date) => {
    cycleViewToRestoreRef.current = new Date(cycleAnchorDate);
    selectWeek(date);
    setWeekSpineViewMode("week");
    setWeekSpineFullscreenRequest((request) => request + 1);
  }, [cycleAnchorDate, selectWeek]);
  const openCycleWeekView = useCallback((date) => {
    selectWeek(date);
    setSummaryPanelMode("week");
    setWeekSpineViewMode("week");
  }, [selectWeek]);
  const handleTimelineFullscreenChange = useCallback((isFullscreen) => {
    if (isFullscreen || !cycleViewToRestoreRef.current) return;
    const cycleAnchor = cycleViewToRestoreRef.current;
    cycleViewToRestoreRef.current = null;
    setCycleAnchorDate(cycleAnchor);
    setSummaryPanelMode("cycle");
    setWeekSpineViewMode("four-weeks");
  }, []);
  const selectCycleWeek = useCallback((date) => {
    selectWeek(date);
    setSummaryPanelMode("week");
  }, [selectWeek]);
  const focusCycleSummary = useCallback(() => {
    closeDay();
    setSummaryPanelMode("cycle");
  }, [closeDay]);
  const focusWeeklySummary = useCallback(() => {
    closeDay();
    setSummaryPanelMode("week");
  }, [closeDay]);
  const activityHeaderTitle = weekSpineViewMode === "four-weeks"
    ? formatCycleLabel(cycleAnchorDate)
    : formatWeekLabel(cursorDate);
  return { weekSpineViewMode, cycleAnchorDate, weekSpineFullscreenRequest, summaryPanelMode, setWeekSpineView, navigateCycle, openCycleWeekEditor, openCycleWeekView, handleTimelineFullscreenChange, selectCycleWeek, focusCycleSummary, focusWeeklySummary, activityHeaderTitle };
}
