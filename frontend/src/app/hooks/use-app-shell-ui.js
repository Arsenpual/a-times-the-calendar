import { useEffect, useRef, useState } from "react";

export function useAppShellUi({ mode, userId }) {
  const [isActivityReading, setIsActivityReading] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const activityDashboardRef = useRef(null);
  const accountMenuRef = useRef(null);

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
    accountMenuRef,
    activityDashboardRef,
    handleActivityDashboardScroll
  };
}
