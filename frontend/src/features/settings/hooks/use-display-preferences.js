import { useCallback, useEffect, useState } from "react";

const SUMMARY_PANEL_GLASS_KEY = "times-summary-panel-glass";

const REMINDER_TIMELINE_COLORS_STORAGE_KEY = "reminder-timeline-colors";
const DEFAULT_REMINDER_TIMELINE_COLORS = {
  nowIndicator: "#ea4335"
};
const NOW_INDICATOR_RESET_SECONDS_KEY = "reminder-now-indicator-reset-seconds";
export const DEFAULT_NOW_INDICATOR_RESET_SECONDS = 3;
export const MIN_NOW_INDICATOR_RESET_SECONDS = 1;
export const MAX_NOW_INDICATOR_RESET_SECONDS = 120;

export function normalizeNowIndicatorResetSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < MIN_NOW_INDICATOR_RESET_SECONDS) {
    return DEFAULT_NOW_INDICATOR_RESET_SECONDS;
  }
  return Math.min(MAX_NOW_INDICATOR_RESET_SECONDS, Math.round(numeric));
}

function loadNowIndicatorResetSeconds() {
  try {
    const saved = window.localStorage.getItem(NOW_INDICATOR_RESET_SECONDS_KEY);
    return saved === null ? DEFAULT_NOW_INDICATOR_RESET_SECONDS : normalizeNowIndicatorResetSeconds(saved);
  } catch {
    return DEFAULT_NOW_INDICATOR_RESET_SECONDS;
  }
}

function loadReminderTimelineColors() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(REMINDER_TIMELINE_COLORS_STORAGE_KEY));
    if (!saved || typeof saved !== "object") return DEFAULT_REMINDER_TIMELINE_COLORS;
    const isColor = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
    return {
      nowIndicator: isColor(saved.nowIndicator) ? saved.nowIndicator : DEFAULT_REMINDER_TIMELINE_COLORS.nowIndicator
    };
  } catch {
    return DEFAULT_REMINDER_TIMELINE_COLORS;
  }
}

/** Device-local display preferences shared by both modes. */
export function useDisplayPreferences() {
  const [summaryPanelGlassEnabled, setSummaryPanelGlassEnabled] = useState(() => {
    try {
      const savedValue = window.localStorage.getItem(SUMMARY_PANEL_GLASS_KEY);
      return (savedValue ?? window.localStorage.getItem("times-weekly-summary-glass")) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(SUMMARY_PANEL_GLASS_KEY, String(summaryPanelGlassEnabled));
    } catch {
      // The visual preference still works for the current session.
    }
  }, [summaryPanelGlassEnabled]);

  // Use the current light base while the app's color system is being redesigned.
  useEffect(() => { document.documentElement.setAttribute("data-theme", "light"); }, []);

  // สีของเอฟเฟกต์เวลาใน Reminder Timeline เป็น preference ฝั่งเครื่อง:
  // ไม่เกี่ยวกับข้อมูล Activity/Reminder จึงไม่ควร sync ขึ้น Calendar หรือ Firebase.
  const [reminderTimelineColors, setReminderTimelineColorsState] = useState(loadReminderTimelineColors);
  const setReminderTimelineColors = useCallback((partialColors) => {
    setReminderTimelineColorsState((previous) => {
      const next = { ...previous, ...partialColors };
      try {
        window.localStorage.setItem(REMINDER_TIMELINE_COLORS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage ไม่พร้อมใช้: เปลี่ยนสีใน session ปัจจุบันได้ตามปกติ
      }
      return next;
    });
  }, []);

  const [nowIndicatorResetSeconds, setNowIndicatorResetSecondsState] = useState(loadNowIndicatorResetSeconds);
  const setNowIndicatorResetSeconds = useCallback((value) => {
    const next = normalizeNowIndicatorResetSeconds(value);
    setNowIndicatorResetSecondsState(next);
    try {
      window.localStorage.setItem(NOW_INDICATOR_RESET_SECONDS_KEY, String(next));
    } catch {
      // localStorage ไม่พร้อมใช้: เปลี่ยนเวลา reset ใน session ปัจจุบันได้ตามปกติ
    }
  }, []);

  return {
    reminderTimelineColors, setReminderTimelineColors,
    nowIndicatorResetSeconds, setNowIndicatorResetSeconds,
    summaryPanelGlassEnabled, setSummaryPanelGlassEnabled
  };
}
