import { useCallback, useEffect, useRef, useState } from "react";
import { getWeekRange } from "../date-utils.js";

const THEME_STORAGE_KEY = "theme";

/**
 * Owns cursorDate/expandedDate navigation (week + day), plus a handful of
 * small standalone UI toggles that don't warrant their own hook each:
 * activity/reminder mode switch, dark-mode theme (persisted), the
 * settings drawer open/close flag, and the login-guide dismiss flag.
 *
 * None of these read or write calendar data — they're purely "what is the
 * user looking at / how do they want it styled" state, which is why they
 * group naturally even though they don't share a single concern the way
 * useAuth or useCalendarData do.
 */
export function useWeekNavigation() {
  const [mode, setMode] = useState("activity"); // "activity" = ปฏิทินปกติ, "reminder" = reminder/Pomodoro mockup
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Shows a guide image over the login screen explaining the Google
  // consent-screen warning people will see, since this app isn't through
  // Google's App Verification process yet. Starts true and only ever goes
  // false via the dismiss button — deliberately NOT persisted, so it
  // reappears every time the page is loaded/refreshed rather than being
  // permanently dismissed after the first close.
  const [showLoginGuide, setShowLoginGuide] = useState(true);

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

  const [cursorDate, setCursorDate] = useState(new Date());
  const [expandedDate, setExpandedDate] = useState(null);

  /**
   * เปลี่ยนสัปดาห์ที่กำลังดู — เรียกจากทั้งปุ่ม ‹ › ในหัว, ปุ่มลูกศรของแถว
   * ใน ActivityMode, และ global ← → shortcut ด้านล่าง ทั้งสามทางเรียก
   * ฟังก์ชันเดียวกันนี้เสมอเพื่อไม่ให้ logic เพี้ยนจากกัน ห่อด้วย
   * useCallback (identity คงที่) เพราะ effect ของ global shortcut ด้านล่าง
   * add/remove event listener ตาม dependency ของมันเอง
   *
   * ไม่แตะ expandedDate โดยตรงในนี้ (ทำที่ effect ผูกกับ cursorDate ด้านล่าง
   * แทน) เพราะฟังก์ชันนี้ต้องเป็น pure ต่อ cursorDate เท่านั้นเพื่อให้
   * dependency array ของ useCallback ว่างเปล่าคงที่ได้
   */
  const navigateWeek = useCallback((direction) => {
    setCursorDate((prevCursorDate) => {
      const next = new Date(prevCursorDate);
      next.setDate(next.getDate() + direction * 7);
      return next;
    });
  }, []);

  // เปลี่ยนวันโดยยึดวันที่ที่กำลังเปิด mini timeline อยู่เป็นหลัก; ถ้ายังไม่
  // เคยเลือกวัน ให้เริ่มจากวันของ cursor ปัจจุบันแทน `cursorDate` จะเปลี่ยน
  // เฉพาะเมื่อข้ามสัปดาห์เท่านั้น: การเลื่อนวันภายในสัปดาห์เดิมต้องเปลี่ยน
  // แค่ expandedDate มิฉะนั้นจะไป re-fetch Calendar และคำนวณ summary ใหม่
  // ทุกครั้ง ทำให้สี/animation ของทั้งหน้ากระพริบโดยไม่จำเป็น
  const navigateDay = useCallback((direction) => {
    const baseDate = expandedDate || cursorDate;
    const next = new Date(baseDate);
    next.setDate(next.getDate() + direction);

    // เปลี่ยน expandedDate เฉพาะตอนมี mini-timeline เปิดอยู่แล้วเท่านั้น —
    // ถ้ายังไม่เคยเลือกวันไหนเลย (expandedDate เป็น null) ↑/↓ ไม่ควรเปิด
    // mini-timeline ขึ้นมาเอง มิฉะนั้นการกดลูกศรครั้งแรกหลังล็อกอิน (ก่อน
    // คลิกเลือกวันใดๆ) จะดันไปเปิดมันขึ้นมาโดยไม่ได้ตั้งใจ
    if (expandedDate) {
      setExpandedDate(next);
    }

    const [currentWeekStart] = getWeekRange(cursorDate);
    const [nextWeekStart] = getWeekRange(next);
    if (currentWeekStart.getTime() !== nextWeekStart.getTime()) {
      setCursorDate(next);
    }
  }, [cursorDate, expandedDate]);

  const goToday = useCallback(() => setCursorDate(new Date()), []);
  const openDay = useCallback((date) => setExpandedDate(date), []);
  const closeDay = useCallback(() => setExpandedDate(null), []);

  // Ref เดียวที่ track ว่า effect ด้านล่าง (ผูกกับ cursorDate) เคยรันมาแล้ว
  // อย่างน้อยหนึ่งครั้งหรือยัง — ต้องกันการรันตอน initial mount โดยเฉพาะ
  // เพราะ useEffect รันเสมอตอน mount ครั้งแรกไม่ว่า dependency จะ "เปลี่ยน"
  // จริงหรือไม่ ถ้าไม่กันไว้ expandedDate จะถูกเปลี่ยนเป็นวันแรกของสัปดาห์
  // ปัจจุบันทันทีตั้งแต่โหลดหน้าแรก ทั้งที่ควรว่างเปล่าจนกว่าผู้ใช้จะเลือกวันเอง
  const isFirstCursorDateRun = useRef(true);

  // Reset the open timeline day whenever the visible week changes:
  //   - ถ้ามีวันที่ถูกเลือกอยู่แล้วก่อนเปลี่ยนสัปดาห์ และวันนั้นไม่อยู่ใน
  //     สัปดาห์ใหม่อีกต่อไป → clear เป็น null
  //   - ถ้ายังไม่มีวันไหนถูกเลือกอยู่ → คง null ไว้
  //   - ยกเว้น "รอบแรกสุด" ตอน mount ที่จะไม่ทำอะไรเลย
  useEffect(() => {
    if (isFirstCursorDateRun.current) {
      isFirstCursorDateRun.current = false;
      return;
    }
    setExpandedDate((prev) => {
      const [weekStart, weekEnd] = getWeekRange(cursorDate);
      if (!prev) return null;
      return prev >= weekStart && prev <= weekEnd ? prev : null;
    });
  }, [cursorDate]);

  /**
   * Global arrow-key shortcuts, independent of focus inside ActivityMode.
   * ←/→ navigate weeks; ↑/↓ navigate days. Skipped entirely outside
   * activity mode, and while focus is inside a text input/textarea/
   * contenteditable element.
   */
  useEffect(() => {
    if (mode !== "activity") return;
    const handleGlobalKeyDown = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const active = document.activeElement;
      const isTextEntry =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable);
      if (isTextEntry) return;
      e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        navigateWeek(e.key === "ArrowLeft" ? -1 : 1);
      } else {
        navigateDay(e.key === "ArrowUp" ? -1 : 1);
      }
    };
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [mode, navigateDay, navigateWeek]);

  return {
    mode,
    setMode,
    settingsOpen,
    setSettingsOpen,
    showLoginGuide,
    setShowLoginGuide,
    theme,
    setTheme,
    cursorDate,
    expandedDate,
    navigateWeek,
    navigateDay,
    goToday,
    openDay,
    closeDay
  };
}
