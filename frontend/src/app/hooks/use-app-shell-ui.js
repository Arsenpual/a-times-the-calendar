import { useEffect, useRef, useState } from "react";

const WEEK_SPINE_HOURS_PER_CELL_KEY = "times-week-spine-hours-per-cell";
const WEEKLY_SUMMARY_GLASS_KEY = "times-weekly-summary-glass";

export function useAppShellUi({ mode, userId }) {
  const [isActivityReading, setIsActivityReading] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [weeklySummaryGlass, setWeeklySummaryGlass] = useState(() => {
    try {
      return window.localStorage.getItem(WEEKLY_SUMMARY_GLASS_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [weekSpineHoursPerCell, setWeekSpineHoursPerCell] = useState(() => {
    try {
      const savedValue = Number(window.localStorage.getItem(WEEK_SPINE_HOURS_PER_CELL_KEY));
      return [1, 2, 4].includes(savedValue) ? savedValue : 2;
    } catch {
      return 2;
    }
  });
  const activityDashboardRef = useRef(null);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(WEEK_SPINE_HOURS_PER_CELL_KEY, String(weekSpineHoursPerCell));
    } catch {
      // The default grid remains available when local storage is unavailable.
    }
  }, [weekSpineHoursPerCell]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WEEKLY_SUMMARY_GLASS_KEY, String(weeklySummaryGlass));
    } catch {
      // The visual preference still works for the current session.
    }
  }, [weeklySummaryGlass]);

  useEffect(() => {
    if (mode !== "activity") setIsActivityReading(false);
  }, [mode]);

  useEffect(() => {
    if (mode !== "activity") return undefined;
    const frameId = window.requestAnimationFrame(() => {
      activityDashboardRef.current?.scrollTo({ top: 0, behavior: "auto" });
      window.scrollTo({ top: 0, behavior: "auto" });
      setIsActivityReading(false);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [mode, userId]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const closeAccountMenu = (event) => {
      if (!(event.target instanceof Node) || !accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeAccountMenu, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeAccountMenu, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  const handleActivityDashboardScroll = (event) => {
    const dashboard = event.currentTarget;
    setIsActivityReading((reading) => reading ? dashboard.scrollTop > 4 : dashboard.scrollTop >= 12);
  };

  return {
    isActivityReading,
    setIsActivityReading,
    accountMenuOpen,
    setAccountMenuOpen,
    weeklySummaryGlass,
    setWeeklySummaryGlass,
    accountMenuRef,
    activityDashboardRef,
    weekSpineHoursPerCell,
    setWeekSpineHoursPerCell,
    handleActivityDashboardScroll
  };
}
