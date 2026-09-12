import { useEffect, useMemo, useRef, useState } from "react";
import { reminderSlotsOnDate, localDateKey } from "../lib/reminder-date-view.js";
import { REMINDER_TYPE } from "../lib/reminder-due-logic.js";
import { activityDate } from "../../../shared/lib/date-utils.js";
import { getDisplayColor } from "../../activity/lib/activity-colors.js";
import { layoutOverlaps } from "../../activity/lib/timeline-layout.js";

export const ZOOM_LEVELS_MINUTES = [60, 15, 5, 1];
export const ROW_HEIGHT_PX = 32;
const DEFAULT_ZOOM_INDEX = ZOOM_LEVELS_MINUTES.indexOf(15);
function getReminderTimeSlots(reminder, dateMs) {
  return reminderSlotsOnDate(reminder, new Date(dateMs));
}


/** Timeline projection and viewport lifecycle; does not mutate reminders. */
export function useReminderTimeline({
  reminders, activities, categories, activityCategoryMap,
  selectedDate, selectedDateKey, activeTypeFilter, activeGroupFilter,
  nowTick, defaultLineColor, formatDurationClock
}) {
  const DEFAULT_LINE_COLOR = defaultLineColor;
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const tapeScrollRef = useRef(null);
  const isUserInteractingRef = useRef(false);
  const idleTimeoutRef = useRef(null);
  const hasSnappedInitiallyRef = useRef(false); // true = เคย sync ตำแหน่งกับเวลาจริงแล้ว รอบต่อไปให้ไหลต่อเนื่อง ไม่สแนปซ้ำ

  const minutesPerRow = ZOOM_LEVELS_MINUTES[zoomIndex];
  const totalRows = 1440 / minutesPerRow;
  const singleDayHeight = totalRows * ROW_HEIGHT_PX;

  // แสดงวันเดียว (00:00 - 24:00) ต่อ track เดียวเท่านั้น (ไม่ duplicate ข้อมูล/ไม่มีปัญหาสับสนวัน-เวลา)
  // แต่เพิ่ม "spacer" ว่างไว้ก่อนแถว 00:00 และหลังแถว 24:00 เพื่อยืดขอบออกไป
  // ทำให้ now-indicator เลื่อนเข้าใกล้ 00:00/24:00 ได้โดยไม่ชนขอบ scroll container จริง ๆ
  // spacer นี้เป็นพื้นที่เปิด (slot) เผื่อไว้ใส่ content อื่นในอนาคตได้ เช่น แบนเนอร์/โฆษณา
  const SPACER_HEIGHT_PX = 240; // ความสูง spacer แต่ละด้าน ปรับได้ตามพื้นที่ viewport

  const tapeRows = useMemo(() => {
    const rows = [];
    const now = selectedDate;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Timeline ใช้ filter ชุดเดียวกับ nav-sidebar/main-panel: แสดงเฉพาะ
    // reminder ที่ใช้งานอยู่และตรงกับประเภท/กลุ่มที่ผู้ใช้เลือก. รายการที่
    // พักหรือทำสำเร็จแล้วต้องไม่ทิ้ง chip/slot ค้างบน timeline.
    const reminderSlots = reminders
      .filter((r) => (
        r.enabled &&
        !r.completedAt &&
        (!activeTypeFilter || r.type === activeTypeFilter) &&
        (!activeGroupFilter || r.groupId === activeGroupFilter)
      ))
      .map((r) => ({
      reminder: r,
      minutes: getReminderTimeSlots(r, startOfToday)
      }));

    for (let i = 0; i < totalRows; i++) {
      const startMinute = i * minutesPerRow;
      const isMajor = startMinute % 60 === 0;
      const hours = Math.floor(startMinute / 60);
      const mins = startMinute % 60;
      const endMinute = startMinute + minutesPerRow;

      const label = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

      const flags = [];
      for (const { reminder, minutes } of reminderSlots) {
        for (const slotMinute of minutes) {
          if (slotMinute >= startMinute && slotMinute < endMinute) {
            flags.push(reminder);
            break; // กันไม่ให้ reminder เดียวกันถูกนับซ้ำในแถวเดียวกัน (เช่น interval ถี่กว่า minutesPerRow)
          }
        }
      }

      rows.push({
        key: `row-${startMinute}`,
        startMinute,
        isMajor,
        label,
        flags
      });
    }

    return rows;
  }, [reminders, minutesPerRow, totalRows, activeTypeFilter, activeGroupFilter, selectedDateKey]);

  // ให้ track กว้างตามจำนวน reminder ที่อยู่เวลาเดียวกัน เพื่อให้ผู้ใช้
  // เลื่อนดูทุก chip ทางแนวนอนได้ แทนการซ่อนรายการส่วนเกินในแต่ละแถว.
  const maxConcurrentReminderChips = useMemo(
    () => Math.max(1, ...tapeRows.map((row) => row.flags.length)),
    [tapeRows]
  );
  const timelineTrackMinWidth = 84 + (maxConcurrentReminderChips * 204) + 8;

  // Activity Mode และ Reminder Mode ใช้ข้อมูล Google Calendar ชุดเดียวกัน:
  // timeline นี้จึงแสดงเฉพาะกิจกรรมที่ทับกับ "วันนี้" และคำนวณตำแหน่งจาก
  // เวลาเริ่ม/จบจริง (รองรับกิจกรรมข้ามเที่ยงคืนด้วย) โดยไม่สร้างสำเนาข้อมูล
  // activity ไว้ใน reminder store อีกชุดหนึ่ง
  const calendarTimelineBlocks = useMemo(() => {
    const dayStart = new Date(selectedDateKey + "T00:00:00");
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
    const pixelsPerMinute = ROW_HEIGHT_PX / minutesPerRow;

    const blocks = activities
      .map((activity) => {
        // All-day activities belong only to Activity Mode. They have no
        // concrete time-of-day and must not appear on Reminder's timeline.
        if (!activity.start?.dateTime) return null;
        const start = activityDate(activity.start);
        if (!start || Number.isNaN(start.getTime())) return null;

        const parsedEnd = activityDate(activity.end);
        const end = parsedEnd && !Number.isNaN(parsedEnd.getTime())
          ? parsedEnd
          : new Date(start.getTime() + 30 * 60 * 1000);
        const actualStartMs = start.getTime();
        const actualEndMs = Math.max(end.getTime(), actualStartMs + 60 * 1000);
        const startMs = Math.max(actualStartMs, dayStartMs);
        const endMs = Math.min(actualEndMs, dayEndMs);
        if (endMs <= dayStartMs || startMs >= dayEndMs || endMs <= startMs) return null;

        const color = getDisplayColor(activity, activityCategoryMap, categories);
        const isActive = nowTick >= actualStartMs && nowTick < actualEndMs;
        const isUpcoming = nowTick < actualStartMs;
        const elapsedSeconds = Math.max(0, Math.floor((nowTick - actualStartMs) / 1000));
        const countdownSeconds = Math.max(0, Math.ceil((actualStartMs - nowTick) / 1000));
        return {
          id: activity.id,
          activity,
          title: activity.summary || "(ไม่มีชื่อกิจกรรม)",
          top: SPACER_HEIGHT_PX + ((startMs - dayStartMs) / 60000) * pixelsPerMinute,
          height: Math.max(22, ((endMs - startMs) / 60000) * pixelsPerMinute),
          startMin: (startMs - dayStartMs) / 60000,
          endMin: (endMs - dayStartMs) / 60000,
          color,
          actualStartMs,
          actualEndMs,
          isActive,
          isUpcoming,
          elapsedSeconds,
          countdownSeconds,
          remainingSeconds: Math.max(0, Math.ceil((actualEndMs - nowTick) / 1000))
        };
      })
      .filter(Boolean);

    // Match Week Spine's puzzle layout exactly: activities with intersecting
    // time ranges receive adjacent lanes instead of covering one another.
    const lanes = layoutOverlaps(blocks.map((block) => ({
      id: block.id,
      startMin: block.startMin,
      endMin: block.endMin
    })));
    return blocks.map((block) => ({
      ...block,
      stackIndex: lanes[block.id]?.stackIndex || 0,
      hidden: lanes[block.id]?.hidden || false,
      hiddenCount: lanes[block.id]?.hiddenCount || 0,
      laneCount: lanes[block.id]?.columns || 1,
      stackZ: lanes[block.id]?.stackZ || 1,
      titleBelow: lanes[block.id]?.titleBelow || false,
      titleOffsetMinutes: lanes[block.id]?.titleOffsetMinutes || 0
    }));
  }, [activities, activityCategoryMap, categories, minutesPerRow, nowTick, SPACER_HEIGHT_PX, selectedDateKey]);

  // แถบสีของ Timer/Stopwatch เป็นคนละ layer กับ now-indicator และ Activity:
  // countdown แสดงช่วงเริ่มจนถึงเวลาสิ้นสุด, stopwatch แสดงช่วงเริ่มจนถึง
  // เวลาปัจจุบันเท่านั้น จึงไม่ไปเปลี่ยนความหมายของเส้น now-indicator เลย.
  const runningReminderSpans = useMemo(() => {
    const dayStart = new Date(selectedDateKey + "T00:00:00");
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
    const pixelsPerMinute = ROW_HEIGHT_PX / minutesPerRow;

    return reminders.flatMap((reminder) => {
      if (!reminder.enabled || reminder.completedAt || !reminder.startedAt ||
          (activeTypeFilter && reminder.type !== activeTypeFilter) ||
          (activeGroupFilter && reminder.groupId !== activeGroupFilter)) return [];
      const isCountdown = reminder.type === REMINDER_TYPE.COUNTDOWN;
      const isStopwatch = reminder.type === REMINDER_TYPE.STOPWATCH;
      if (!isCountdown && !isStopwatch) return [];

      const actualEndMs = isCountdown
        ? reminder.startedAt + (reminder.durationMs || 0)
        : nowTick;
      if (actualEndMs <= reminder.startedAt || actualEndMs <= dayStartMs || reminder.startedAt >= dayEndMs) return [];

      // Timer ต้องหดเข้าหาเวลาจบ: จุดเริ่มของแถบจึงตาม nowTick เสมอ
      // ขณะที่ Stopwatch ยืดจากจุดเริ่มมาหา nowTick.
      const startMs = Math.max(
        isCountdown ? nowTick : reminder.startedAt,
        dayStartMs
      );
      const endMs = Math.min(actualEndMs, dayEndMs);
      if (endMs <= startMs) return [];
      return [{
        id: reminder.id,
        title: reminder.title,
        type: reminder.type,
        top: SPACER_HEIGHT_PX + ((startMs - dayStartMs) / 60000) * pixelsPerMinute,
        height: Math.max(4, ((endMs - startMs) / 60000) * pixelsPerMinute),
        color: reminder.lineColor || DEFAULT_LINE_COLOR
      }];
    });
  }, [reminders, nowTick, minutesPerRow, SPACER_HEIGHT_PX, selectedDateKey, activeTypeFilter, activeGroupFilter]);

  // ข้อความบน now-indicator สงวนไว้ให้สถานะของ Activity เท่านั้น:
  // ถ้ามีกิจกรรมกำลังทำให้ความสำคัญกับเวลาที่เหลือก่อนจบ; ถ้าไม่มีจึงแสดง
  // เวลาที่เหลือก่อนถึงกิจกรรมถัดไป.
  const activityNowStatus = useMemo(() => {
    const active = calendarTimelineBlocks.find((block) => block.isActive);
    if (active) {
      return { title: active.title, text: `จะจบใน ${formatDurationClock(active.remainingSeconds)}`, color: active.color };
    }
    const next = calendarTimelineBlocks
      .filter((block) => block.isUpcoming)
      .sort((a, b) => a.actualStartMs - b.actualStartMs)[0];
    return next
      ? { title: next.title, text: `จะถึงใน ${formatDurationClock(next.countdownSeconds)}`, color: next.color }
      : null;
  }, [calendarTimelineBlocks]);

  // ตำแหน่ง scrollTop ที่ต้องการ ให้ now-indicator อยู่กลาง container พอดี
  // ต้องบวก SPACER_HEIGHT_PX เข้าไปด้วย เพราะแถว 00:00 ไม่ได้เริ่มที่ scrollTop=0 อีกต่อไป
  // แต่เริ่มหลัง spacer บนไปแล้ว จึงไม่ต้อง clamp ที่ขอบเหมือนเดิม (spacer ทำหน้าที่กันชนแทน)
  const calculateTargetScrollTop = () => {
    if (!tapeScrollRef.current) return 0;
    const now = new Date();

    // คำนวณจำนวนนาทีทั้งหมดนับตั้งแต่เที่ยงคืนของวันนี้ (00:00)
    const currentExactMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;

    const containerHeight = tapeScrollRef.current.clientHeight;
    const currentDayOffset = (currentExactMinutes / 1440) * singleDayHeight;

    // ตำแหน่งที่อยากได้คือ now-indicator อยู่กลาง container พอดี โดยนับ offset จาก spacer บนด้วย
    const idealScrollTop = SPACER_HEIGHT_PX + currentDayOffset - containerHeight / 2;

    // Track ตอนนี้คือ [spacer บน][00:00 ... 24:00][spacer ล่าง]
    // ยังคง clamp ไว้ไม่ให้ scroll เลยขอบจริงของ DOM (0 ถึง totalHeight - containerHeight)
    // แต่เพราะมี spacer คั่นแล้ว ในทางปฏิบัติ now-indicator จะไม่มีวันไปติดขอบใกล้ 00:00/24:00 อีก
    const totalHeight = SPACER_HEIGHT_PX * 2 + singleDayHeight;
    const maxScrollTop = Math.max(0, totalHeight - containerHeight);
    return Math.min(Math.max(idealScrollTop, 0), maxScrollTop);
  };

  // Auto-scroll Engine: ไหลต่อเนื่องด้วย deltaMs จริง (เหมือนน้ำไหล) + Drift Correction แบบนุ่มนวล
  // อ้างอิงตามขั้นตอนวิธีแก้ไขปัญหา: คำนวณ deltaMs จาก requestAnimationFrame แล้วขยับ scrollTop ไปข้างหน้า
  // ตามสเกลเวลาอย่างต่อเนื่อง (ไม่ใช่กระโดดสแนป) ส่วน Drift Correction แยกออกมาทำงานเฉพาะตอนคลาดเคลื่อนเกิน 5px
  // แล้วดึงกลับแบบนุ่มนวลด้วย drift * 0.1 (ไม่ปรับพรวดพราดทุกเฟรม) กัน floating-point drift สะสมระยะยาว
  useEffect(() => {
    let rafId;
    let lastFrameTime = null;
    const pxPerMs = (singleDayHeight / 1440) / 60000; // px ต่อ นาที ÷ 60000ms = px ต่อ ms

    const tick = (frameTime) => {
      if (tapeScrollRef.current) {
        if (selectedDateKey !== localDateKey() || isUserInteractingRef.current) {
          // ผู้ใช้กำลังลาก/ไถอยู่: ไม่ขยับเอง แต่รีเซ็ต lastFrameTime ไว้ กันไม่ให้กระโดดตอนปล่อยมือ
          lastFrameTime = null;
        } else if (!hasSnappedInitiallyRef.current) {
          // ครั้งแรกหลัง mount/เปลี่ยน zoom หรือเพิ่งเลิกลากด้วยมือ: sync ตำแหน่งให้ตรงเวลาจริงก่อนหนึ่งครั้ง
          // (คำนวณจาก wall-clock ตรง ๆ เพื่อความแม่นยำ) จากนั้นค่อยไหลต่อด้วยความเร็วคงที่ทุกเฟรม
          tapeScrollRef.current.scrollTop = calculateTargetScrollTop();
          hasSnappedInitiallyRef.current = true;
          lastFrameTime = frameTime;
        } else if (lastFrameTime !== null) {
          const deltaMs = frameTime - lastFrameTime;
          // ไหล scrollTop ไปข้างหน้าตามเวลาที่ผ่านไปจริงระหว่างเฟรม (ไม่ใช่ก้อนคงที่ต่อเฟรม)
          // จึงลื่นสม่ำเสมอไม่ว่าเฟรมเรตจะแกว่งแค่ไหน และไม่มีการ "กระโดดแก้ตำแหน่ง" เป็นระยะ ๆ อีกต่อไป
          tapeScrollRef.current.scrollTop += deltaMs * pxPerMs;
          lastFrameTime = frameTime;

          // Drift Correction: ทำงานเฉพาะตอนคลาดเคลื่อนเกิน 5px (กัน floating-point drift สะสมระยะยาว)
          // ดึงกลับแบบนุ่มนวลทีละ 10% ของระยะที่คลาดเคลื่อน ไม่กระโดดพรวดพราดทุกเฟรม จึงไม่รู้สึกสะดุด
          const trueTarget = calculateTargetScrollTop();
          const drift = trueTarget - tapeScrollRef.current.scrollTop;
          if (Math.abs(drift) > 5) {
            tapeScrollRef.current.scrollTop += drift * 0.1;
          }
        } else {
          lastFrameTime = frameTime;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [minutesPerRow, singleDayHeight, selectedDateKey]);

  const handleUserInteraction = () => {
    isUserInteractingRef.current = true;

    // เคลียร์ Timeout เก่าทิ้งก่อนทุกครั้งที่ขยับจอ
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    // ตั้งเวลาถอยหลัง (Idle Timeout) 3 วินาที นับจากขยับครั้งสุดท้าย ตามที่ระบุในขั้นตอนวิธีแก้ไขปัญหา
    idleTimeoutRef.current = setTimeout(() => {
      isUserInteractingRef.current = false;
      // รีเซ็ตให้ rAF loop sync ตำแหน่งกับเวลาจริงอีกครั้งหนึ่งครั้งก่อน (กันคลาดเคลื่อนจากตอนลาก)
      // แล้วค่อยกลับไปไหลต่อเนื่องด้วยความเร็วคงที่ตามปกติ ไม่ใช่กระโดดดีดทุกครั้งที่ปล่อยมือ
      hasSnappedInitiallyRef.current = false;
    }, 3000);
  };

  // พา slot ของ reminder มาทับตำแหน่งกลาง viewport ซึ่งเป็นตำแหน่งเดียวกับ
  // now-indicator. หยุด auto-follow ชั่วคราวผ่าน handleUserInteraction() แล้ว
  // ให้กลับตามเวลาปัจจุบันเองหลังผู้ใช้หยุดโต้ตอบ 3 วินาที.
  const focusReminderOnTimeline = (reminder) => {
    const container = tapeScrollRef.current;
    if (!container || !reminder.enabled || reminder.completedAt) return;

    const now = selectedDate;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const slots = getReminderTimeSlots(reminder, startOfToday);
    if (slots.length === 0) return; // routine/stopwatch ไม่มีเวลาตายตัวบน timeline

    const currentMinute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const targetMinute = slots.reduce((nearest, candidate) => (
      Math.abs(candidate - currentMinute) < Math.abs(nearest - currentMinute) ? candidate : nearest
    ));
    const selectedOffset = (targetMinute / 1440) * singleDayHeight;
    const totalHeight = SPACER_HEIGHT_PX * 2 + singleDayHeight;
    const maxScrollTop = Math.max(0, totalHeight - container.clientHeight);
    const targetScrollTop = Math.min(
      Math.max(SPACER_HEIGHT_PX + selectedOffset - container.clientHeight / 2, 0),
      maxScrollTop
    );

    handleUserInteraction();
    container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
  };


  useEffect(() => () => clearTimeout(idleTimeoutRef.current), []);
  const zoomOut = () => setZoomIndex(Math.max(0, zoomIndex - 1));
  const zoomIn = () => setZoomIndex(Math.min(ZOOM_LEVELS_MINUTES.length - 1, zoomIndex + 1));
  return {
    zoomIndex, zoomIn, zoomOut, minutesPerRow, tapeRows, tapeScrollRef,
    timelineTrackMinWidth, calendarTimelineBlocks, runningReminderSpans,
    activityNowStatus, handleUserInteraction, focusReminderOnTimeline,
    SPACER_HEIGHT_PX
  };
}
