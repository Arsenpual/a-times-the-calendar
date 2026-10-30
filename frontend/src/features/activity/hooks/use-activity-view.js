import { useCallback, useState } from "react";
import { formatWeekLabel, getYearCycle, getYearWeekRange } from "../../../shared/lib/date-utils.js";

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
  const [summaryPanelMode, setSummaryPanelMode] = useState("week");
  // Reset account-scoped view state before rendering children.
  if (ownerId !== userId) {
    setOwnerId(userId);
    setWeekSpineViewMode("week");
    setCycleAnchorDate(new Date());
    setSummaryPanelMode("week");
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
  const openCycleWeekEditor = useCallback((date, range = null) => {
    selectWeek(date, range);
    setSummaryPanelMode("week");
    setWeekSpineViewMode("week");
  }, [selectWeek]);
  const openCycleWeekView = useCallback((date, range = null) => {
    selectWeek(date, range);
    setSummaryPanelMode("week");
    setWeekSpineViewMode("week");
  }, [selectWeek]);
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
  const headerLabel = weekSpineViewMode === "four-weeks"
    ? formatCycleLabel(cycleAnchorDate)
    : formatWeekLabel(cursorDate);
  const headerDate = weekSpineViewMode === "four-weeks"
    ? getYearCycle(cycleAnchorDate).start
    : getYearWeekRange(cursorDate)[0];
  const activityHeaderTitle = {
    date: headerDate.toLocaleDateString("th-TH-u-ca-gregory", { day: "numeric", month: "long", year: "numeric" }),
    period: headerLabel.slice(headerLabel.indexOf(weekSpineViewMode === "four-weeks" ? "cycle ที่" : "สัปดาห์ที่")),
  };
  return { weekSpineViewMode, cycleAnchorDate, summaryPanelMode, setWeekSpineView, navigateCycle, openCycleWeekEditor, openCycleWeekView, selectCycleWeek, focusCycleSummary, focusWeeklySummary, activityHeaderTitle };
}
