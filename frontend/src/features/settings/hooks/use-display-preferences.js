import { useCallback, useEffect, useState } from "react";

const SUMMARY_PANEL_GLASS_KEY = "times-summary-panel-glass";

const THEME_STORAGE_KEY = "theme";
const REMINDER_TIMELINE_COLORS_STORAGE_KEY = "reminder-timeline-colors";
const DEFAULT_REMINDER_TIMELINE_COLORS = {
  nowIndicator: "#ea4335"
};

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

  // Dark mode theme — persisted in localStorage so it survives refresh.
  // Read once at mount; applied to <html> as a data-theme attribute below
  // so CSS can key off [data-theme="dark"] selectors globally. Defaults
  // to the system preference (prefers-color-scheme) on first-ever visit.
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // localStorage unavailable — fall through to system preference below.
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // If storage isn't available, the app still works, it just won't
      // remember the choice on reload.
    }
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

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

  return {
    theme, setTheme, reminderTimelineColors, setReminderTimelineColors,
    summaryPanelGlassEnabled, setSummaryPanelGlassEnabled
  };
}
