import { useCallback, useEffect, useRef, useState } from "react";
import { getWeekRange } from "../../../shared/lib/date-utils.js";

/** Owns Activity week/day navigation. App supplies the active mode for shortcuts. */
export function useWeekNavigation({ mode = "activity", userId = null } = {}) {
  const [ownerId, setOwnerId] = useState(userId);
  const [cursorDate, setCursorDate] = useState(new Date());
  const [expandedDate, setExpandedDate] = useState(null);
  if (ownerId !== userId) {
    setOwnerId(userId);
    setCursorDate(new Date());
    setExpandedDate(null);
  }

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

  // เปลี่ยนวันโดยยึดวันที่ที่กำลังอ่านใน Daily Gantt อยู่เป็นหลัก; ถ้ายังไม่
  // เคยเลือกวัน ให้เริ่มจากวันของ cursor ปัจจุบันแทน `cursorDate` จะเปลี่ยน
  // เฉพาะเมื่อข้ามสัปดาห์เท่านั้น: การเลื่อนวันภายในสัปดาห์เดิมต้องเปลี่ยน
  // แค่ expandedDate มิฉะนั้นจะไป re-fetch Calendar และคำนวณ summary ใหม่
  // ทุกครั้ง ทำให้สี/animation ของทั้งหน้ากระพริบโดยไม่จำเป็น
  const navigateDay = useCallback((direction) => {
    const baseDate = expandedDate || cursorDate;
    const next = new Date(baseDate);
    next.setDate(next.getDate() + direction);

    // เปลี่ยน expandedDate เฉพาะตอนผู้ใช้เคยเลือกวันแล้วเท่านั้น —
    // ถ้ายังไม่เคยเลือกวันไหนเลย (expandedDate เป็น null) ↑/↓ ไม่ควรเปลี่ยน
    // Daily Gantt ขึ้นมาเอง มิฉะนั้นการกดลูกศรครั้งแรกหลังล็อกอิน (ก่อน
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
  const selectWeek = useCallback((date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
    setCursorDate(new Date(date));
    setExpandedDate(null);
  }, []);
  // Used when an activity is restored from the archive: unlike openDay(),
  // this deliberately moves the visible week as well as selecting its day.
  const focusDate = useCallback((date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
    const next = new Date(date);
    setCursorDate(next);
    setExpandedDate(next);
  }, []);
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
    cursorDate,
    expandedDate,
    navigateWeek,
    navigateDay,
    goToday,
    selectWeek,
    focusDate,
    openDay,
    closeDay
  };
}
