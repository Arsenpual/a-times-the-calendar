import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "times-reminders-v1";
const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

// ระดับซูมของตาราง timeline 24 ชม. — หน่วยเป็นนาทีต่อหนึ่งแถว เรียงจากซูมออก
// สุด (60 นาที/แถว = เห็นทั้งวันในตารางสั้นสุด) ไปซูมเข้าสุด (1 นาที/แถว =
// เห็นละเอียดสุดแต่ตารางยาว 1,440 แถว ต้อง scroll เยอะ) ปุ่ม +/- ไล่ตาม
// index ของ array นี้ ไม่ใช่คำนวณเลขเอง เพื่อจำกัดให้มีแค่ 4 ระดับที่ตั้งใจ
// ไว้เท่านั้น (ไม่ใช่ซูมต่อเนื่องแบบ pinch-zoom)
const ZOOM_LEVELS_MINUTES = [60, 15, 5, 1];
const DEFAULT_ZOOM_INDEX = ZOOM_LEVELS_MINUTES.indexOf(15); // เริ่มที่ 15 นาที/แถว

const DEFAULT_REMINDERS = [
  { id: "water", title: "ดื่มน้ำ", amount: 30, unit: "minutes", enabled: true },
  { id: "stretch", title: "ยืดตัว 30 วินาที", amount: 60, unit: "minutes", enabled: true },
  { id: "eyes", title: "พักสายตา มองไกล 20 ฟุต", amount: 20, unit: "minutes", enabled: true }
];

function intervalMs(reminder) {
  return reminder.amount * (reminder.unit === "hours" ? 60 * 60 * 1000 : 60 * 1000);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function intervalLabel(reminder) {
  const unit = reminder.unit === "hours" ? "ชั่วโมง" : "นาที";
  return `ทุก ${reminder.amount} ${unit}`;
}

function createDraft(reminder) {
  return reminder
    ? { title: reminder.title, amount: String(reminder.amount), unit: reminder.unit }
    : { title: "", amount: "10", unit: "minutes" };
}

/**
 * Functional first version of Reminder mode. Reminders and their schedules
 * persist in localStorage and alert while this tab is open. Browser/FCM
 * notifications intentionally remain a later phase because they need user
 * permission plus server-side scheduling to work after the tab is closed.
 */
export default function ReminderMode() {
  const [reminders, setReminders] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved)) return saved;
    } catch {
      // Use the starter reminders if storage is unavailable or corrupt.
    }
    const now = Date.now();
    return DEFAULT_REMINDERS.map((reminder) => ({
      ...reminder,
      nextDueAt: now + intervalMs(reminder)
    }));
  });
  const [now, setNow] = useState(Date.now());
  const [draft, setDraft] = useState(createDraft());
  const [editingId, setEditingId] = useState(null);
  const [pomodoro, setPomodoro] = useState({
    phase: "focus",
    remainingSeconds: FOCUS_SECONDS,
    endsAt: null,
    rounds: 0
  });
  const [pomodoroNotice, setPomodoroNotice] = useState(null);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    } catch {
      // The screen remains usable even if persistence is unavailable.
    }
  }, [reminders]);

  const pomodoroRemaining = pomodoro.endsAt
    ? Math.max(0, Math.ceil((pomodoro.endsAt - now) / 1000))
    : pomodoro.remainingSeconds;

  useEffect(() => {
    if (!pomodoro.endsAt || pomodoroRemaining > 0) return;
    const completedFocus = pomodoro.phase === "focus";
    setPomodoro({
      phase: completedFocus ? "break" : "focus",
      remainingSeconds: completedFocus ? BREAK_SECONDS : FOCUS_SECONDS,
      endsAt: null,
      rounds: completedFocus ? pomodoro.rounds + 1 : pomodoro.rounds
    });
    setPomodoroNotice(
      completedFocus
        ? "ครบช่วงโฟกัสแล้ว — ถึงเวลาพัก 5 นาที"
        : "พักครบแล้ว — พร้อมเริ่มช่วงโฟกัสใหม่"
    );
  }, [pomodoro.endsAt, pomodoro.phase, pomodoro.rounds, pomodoroRemaining]);

  const dueReminders = useMemo(
    () => reminders.filter((reminder) => reminder.enabled && reminder.nextDueAt <= now),
    [reminders, now]
  );

  const activeReminders = reminders.filter((reminder) => reminder.enabled);
  const pausedReminders = reminders.filter((reminder) => !reminder.enabled);

  const scheduleNext = (id) => {
    setReminders((previous) =>
      previous.map((reminder) =>
        reminder.id === id ? { ...reminder, nextDueAt: Date.now() + intervalMs(reminder) } : reminder
      )
    );
  };

  /**
   * ย้าย reminder ไปยัง "นาทีที่ N ของวันนี้" ที่ระบุ — ใช้ตอนลาก reminder
   * จากรายการฝั่งขวาไปวางบนแถวเวลาใน tape-scroll ฝั่งซ้าย ตั้ง nextDueAt
   * ใหม่ให้ตรงเวลานั้นของวันนี้ (ความถี่/amount ของ reminder เองไม่เปลี่ยน
   * — แค่ขยับจุดยึดเวลาครั้งถัดไป) ถ้าเวลานั้นผ่านไปแล้วของวันนี้ ปล่อยให้
   * เป็นอดีตไปเลย (เหมือน reminder ที่ due ไปแล้วรอบหนึ่ง) แทนที่จะเดา
   * เลื่อนไปพรุ่งนี้แทน — ตรงไปตรงมากับตำแหน่งที่ผู้ใช้วางลงจริงๆ ที่สุด
   */
  const rescheduleReminderTo = (id, minuteOfDay) => {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const target = new Date(dayStart.getTime() + minuteOfDay * 60000);
    setReminders((previous) =>
      previous.map((reminder) =>
        reminder.id === id
          ? { ...reminder, enabled: true, nextDueAt: target.getTime() }
          : reminder
      )
    );
  };

  const draggedReminderId = useRef(null);
  const [isDraggingReminder, setIsDraggingReminder] = useState(false);
  const handleReminderDragStart = (id) => (event) => {
    draggedReminderId.current = id;
    setIsDraggingReminder(true);
    event.dataTransfer.effectAllowed = "move";
    // บาง browser (โดยเฉพาะ Firefox) ต้องมี setData ให้ dataTransfer อย่าง
    // น้อยหนึ่งค่า ไม่งั้น dragstart จะถูกยกเลิกเงียบๆ — ตัว id จริงยังอ่าน
    // จาก ref ตอน drop อยู่ดี (เพราะต้องรองรับ minuteOfDay ที่คำนวณตอน drop
    // ไม่ใช่ตอน dragstart) ค่านี้จึงเป็นแค่ placeholder ให้ browser พอใจ
    event.dataTransfer.setData("text/plain", id);
  };
  // ต้องเคลียร์ isDraggingReminder ตอนจบการลากเสมอ ไม่ว่าจะ drop สำเร็จ
  // หรือถูกยกเลิกกลางทาง (เช่น ปล่อยเมาส์นอกพื้นที่ที่รับ drop ได้เลย) —
  // dragend ยิงในทั้งสองกรณีนี้เสมอ ต่างจาก drop ที่ยิงเฉพาะตอนสำเร็จ
  // เท่านั้น ถ้าใช้แค่ drop เคลียร์ ตอนลากแล้วปล่อยพลาดจะค้าง true ตลอดไป
  // ทำให้ track หยุดขยับตาม "ตอนนี้" ถาวรโดยไม่ได้ตั้งใจ
  const handleReminderDragEnd = () => {
    setIsDraggingReminder(false);
    draggedReminderId.current = null;
  };
  const handleTapeMinuteDragOver = (event) => {
    // ต้องเรียก preventDefault() แบบไม่มีเงื่อนไขเสมอ — นี่คือสัญญาณบอก
    // browser ว่า "จุดนี้เป็นพื้นที่รับ drop ได้" ถ้าไม่เรียกใน dragover
    // event เลย บาง browser (โดยเฉพาะ Chrome/Safari) จะไม่ยอมยิง drop
    // event ให้เลย ต่อให้ dragstart เคยเซ็ต draggedReminderId ไว้ถูกต้อง
    // ก็ตาม — เดิมเรียกแบบมีเงื่อนไข (if (!draggedReminderId.current)
    // return ก่อน) ทำให้ drop ไม่เคยทำงานเลยถ้า dataTransfer ยังไม่ทันอ่าน
    // ค่าได้ในจังหวะนั้น
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };
  const handleTapeMinuteDrop = (startMinute) => (event) => {
    event.preventDefault();
    // dataTransfer.getData คืนค่า id จริงเสมอในจังหวะ drop (ต่างจาก
    // dragover ที่บาง browser ยังอ่านไม่ได้) — ใช้เป็นแหล่งความจริงหลัก
    // แทน draggedReminderId ref ซึ่งอาจไม่ทันอัปเดตถ้า dragstart มาจาก
    // แถวที่เพิ่งถูก React re-render แทนที่ node เดิมไปแล้ว
    const id = event.dataTransfer.getData("text/plain") || draggedReminderId.current;
    setIsDraggingReminder(false);
    draggedReminderId.current = null;
    if (!id) return;
    rescheduleReminderTo(id, startMinute);
  };

  const toggleReminder = (id) => {
    setReminders((previous) =>
      previous.map((reminder) => {
        if (reminder.id !== id) return reminder;
        const enabled = !reminder.enabled;
        return {
          ...reminder,
          enabled,
          nextDueAt: enabled ? Date.now() + intervalMs(reminder) : null
        };
      })
    );
  };

  const removeReminder = (id) => {
    setReminders((previous) => previous.filter((reminder) => reminder.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraft(createDraft());
    }
  };

  const startEditing = (reminder) => {
    setEditingId(reminder.id);
    setDraft(createDraft(reminder));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraft(createDraft());
  };

  const saveReminder = (event) => {
    event.preventDefault();
    const title = draft.title.trim();
    const amount = Number(draft.amount);
    if (!title || !Number.isFinite(amount) || amount < 1) return;

    if (editingId) {
      setReminders((previous) =>
        previous.map((reminder) =>
          reminder.id === editingId
            ? {
                ...reminder,
                title,
                amount,
                unit: draft.unit,
                nextDueAt: reminder.enabled ? Date.now() + amount * (draft.unit === "hours" ? 3600000 : 60000) : null
              }
            : reminder
        )
      );
    } else {
      const reminder = {
        id: crypto.randomUUID(),
        title,
        amount,
        unit: draft.unit,
        enabled: true
      };
      setReminders((previous) => [...previous, { ...reminder, nextDueAt: Date.now() + intervalMs(reminder) }]);
    }
    cancelEditing();
  };

  const [showFocusDim, setShowFocusDim] = useState(false);
  const focusDimTimerRef = useRef(null);

  const startPomodoro = () => {
    setPomodoro((previous) => ({
      ...previous,
      endsAt: Date.now() + previous.remainingSeconds * 1000
    }));
    // มืดจอชั่วคราวเฉพาะตอนเริ่ม "ช่วงโฟกัส" เท่านั้น (ไม่ใช่ตอนเริ่มพัก) —
    // เช็คจาก pomodoro.phase ปัจจุบันก่อนกด เพราะ setPomodoro ด้านบนยังไม่
    // เปลี่ยน phase เอง (แค่ตั้ง endsAt) — remainingSeconds ที่เหลืออยู่คือ
    // ของ phase ปัจจุบันอยู่แล้วเสมอ
    if (pomodoro.phase === "focus") {
      setShowFocusDim(true);
      clearTimeout(focusDimTimerRef.current);
      focusDimTimerRef.current = setTimeout(() => setShowFocusDim(false), 2500);
    }
  };

  useEffect(() => () => clearTimeout(focusDimTimerRef.current), []);

  const pausePomodoro = () => {
    setPomodoro((previous) => ({
      ...previous,
      remainingSeconds: Math.max(0, Math.ceil(((previous.endsAt || Date.now()) - Date.now()) / 1000)),
      endsAt: null
    }));
    // ถ้ากดหยุดกลางทางระหว่างที่จอยังมืดอยู่ ให้สว่างกลับทันที — ไม่ต้อง
    // รอครบ timeout เพราะสถานะไม่ใช่ "กำลังเริ่มโฟกัส" อีกต่อไปแล้ว
    clearTimeout(focusDimTimerRef.current);
    setShowFocusDim(false);
  };

  const skipPomodoro = () => {
    setPomodoro((previous) => {
      const completedFocus = previous.phase === "focus";
      return {
        phase: completedFocus ? "break" : "focus",
        remainingSeconds: completedFocus ? BREAK_SECONDS : FOCUS_SECONDS,
        endsAt: null,
        rounds: completedFocus ? previous.rounds + 1 : previous.rounds
      };
    });
  };

  // นาทีต่อแถวของระดับซูมปัจจุบัน — ผูกกับ ZOOM_LEVELS_MINUTES ผ่าน index
  // เดียว ไม่คำนวณเลขซูมเองที่อื่น เพื่อให้ปุ่ม +/- กับตัวสร้างตารางด้านล่าง
  // อ้างอิงค่าเดียวกันเสมอ
  const minutesPerRow = ZOOM_LEVELS_MINUTES[zoomIndex];

  const zoomIn = () => setZoomIndex((index) => Math.min(ZOOM_LEVELS_MINUTES.length - 1, index + 1));
  const zoomOut = () => setZoomIndex((index) => Math.max(0, index - 1));

  /**
   * รายการช่วงเวลาที่ reminder แต่ละตัวจะ "ถึงกำหนด" ตลอดทั้งวันนี้
   * (00:00-24:00) — คำนวณจาก nextDueAt ปัจจุบันของแต่ละ reminder เป็นจุด
   * ยึด (anchor) แล้ว project ทั้งไปข้างหน้าและข้างหลังตามความถี่ของมันเอง
   * (intervalMs) จนกว่าจะหลุดออกนอกขอบเขตวันนี้ทั้งสองด้าน
   *
   * ต้อง project ทั้งสองทิศทาง (ไม่ใช่แค่จาก nextDueAt ไปข้างหน้าอย่างเดียว)
   * เพราะ reminder หนึ่งอาจเคย due ไปแล้วหลายรอบตั้งแต่เที่ยงคืนของวันนี้
   * ก่อนจะถึง nextDueAt ปัจจุบัน — ถ้า project ไปข้างหน้าอย่างเดียวจะเห็นแค่
   * ครั้งต่อไปในอนาคต ไม่เห็นครั้งที่ผ่านไปแล้วของวันนี้เลย ซึ่งขัดกับที่
   * ต้องการ "แสดง reminder ทุกตัวตลอดทั้งวัน" ไม่ใช่แค่ตั้งแต่ตอนนี้
   *
   * คืนค่าเป็น Map<minuteOfDay, {id, title}> (นาทีที่ 0-1439 นับจาก
   * เที่ยงคืน) ให้ตัวสร้างแถวด้านล่าง lookup ตรงๆ ต่อแถว — เก็บ id ควบคู่
   * กับ title (ไม่ใช่แค่ title เฉยๆ แบบเดิม) เพื่อให้ tape-flag ที่ render
   * ออกมารู้ว่าตัวเองแทน reminder ตัวไหน สำหรับใช้ลาก (drag) ป้ายนี้โดยตรง
   * เพื่อย้ายเวลาได้โดยไม่ต้องกลับไปลากจากรายการฝั่งขวาเท่านั้น
   */
  const reminderOccurrencesByMinute = useMemo(() => {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const byMinute = new Map();
    for (const reminder of activeReminders) {
      const stepMs = intervalMs(reminder);
      if (!Number.isFinite(stepMs) || stepMs < 60000) continue; // กันหารด้วยเลขที่เล็กเกินไป/พัง

      // เดินย้อนจาก nextDueAt กลับไปจนกว่าจะพ้นขอบเขตวันนี้ด้านต้น
      let t = reminder.nextDueAt;
      while (t >= dayStart.getTime()) t -= stepMs;
      t += stepMs; // ก้าวสุดท้ายทำให้หลุดออกไปนอกวัน ต้องขยับกลับเข้ามาหนึ่งก้าว

      // เดินหน้าจากจุดแรกที่อยู่ในวันนี้ ไปจนสุดวัน บันทึกทุก occurrence
      for (; t < dayEnd.getTime(); t += stepMs) {
        if (t < dayStart.getTime()) continue;
        const minuteOfDay = Math.floor((t - dayStart.getTime()) / 60000);
        if (!byMinute.has(minuteOfDay)) byMinute.set(minuteOfDay, { id: reminder.id, title: reminder.title });
      }
    }
    return byMinute;
  }, [activeReminders, now]);

  /**
   * ข้อมูลตาราง timeline เต็มวัน (00:00-24:00 เสมอ) — จำนวนแถวขึ้นกับระดับ
   * ซูมที่เลือกไว้ (minutesPerRow): 60 นาที/แถว = 24 แถว (ซูมออกสุด เห็น
   * ทั้งวันในตารางสั้นสุด), 1 นาที/แถว = 1,440 แถว (ซูมเข้าสุด ละเอียดสุด)
   * ไม่ผูกกับช่วง Pomodoro อีกต่อไป — แสดง reminder ทุกตัวตลอดทั้งวันจาก
   * reminderOccurrencesByMinute ด้านบน ไม่ว่า Pomodoro จะกำลังทำงานช่วงไหน
   * หรือไม่ได้ทำงานเลยก็ตาม
   *
   * แต่ละแถวอาจครอบคลุมหลายนาที (เช่น 60 นาที/แถวตอนซูมออกสุด) — ถ้ามี
   * reminder ตกอยู่ในช่วงนาทีไหนของแถวนั้นก็ตาม จะโชว์ flag แรกที่เจอ (ไม่
   * ซ้อนกันหลาย flag ต่อแถวเพื่อไม่ให้ UI รก)
   */
  const tapeRows = useMemo(() => {
    const rowsCount = Math.ceil(1440 / minutesPerRow);
    return Array.from({ length: rowsCount }, (_, index) => {
      const startMinute = index * minutesPerRow;
      const endMinute = Math.min(1440, startMinute + minutesPerRow);
      let flag = null;
      for (let m = startMinute; m < endMinute; m++) {
        if (reminderOccurrencesByMinute.has(m)) {
          flag = reminderOccurrencesByMinute.get(m);
          break;
        }
      }
      const hour = Math.floor(startMinute / 60);
      const minute = startMinute % 60;
      return {
        startMinute,
        // ชั่วโมงเต็ม (นาที 0 ของทุกชั่วโมง) เน้นตัวหนา เป็นจุดอ้างอิงสายตา
        // หลักเสมอไม่ว่าจะซูมระดับไหน — ต่างจากเดิมที่ major ผูกกับ "ทุก 5
        // นาที" ซึ่งเหมาะกับช่วง pomodoro สั้นๆ แต่ไม่เหมาะกับตาราง 24 ชม.
        isMajor: minute === 0,
        label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        flag
      };
    });
  }, [minutesPerRow, reminderOccurrencesByMinute]);

  // ความสูงต่อแถว (px) — คงที่ 28px ทุกระดับซูม (ต่างจากเดิมที่ hardcode
  // 44px เฉพาะตอนมีแค่ระดับเดียว) เพื่อให้คำนวณตำแหน่งเส้น "ตอนนี้" และ
  // ความสูงรวมของตารางสอดคล้องกันเสมอไม่ว่าจะมีกี่แถว — เตี้ยกว่าเดิม
  // เพราะตอนซูมเข้าสุด (1,440 แถว) ถ้าใช้ 44px/แถวจะสูงเกินจะ scroll ไหว
  const ROW_HEIGHT_PX = 28;

  // ความสูงของพื้นที่มองเห็น (.tape-scroll) เป็น px — ต้องรู้ค่านี้เพื่อ
  // คำนวณว่าต้องเลื่อน tape-track ขึ้นเท่าไหร่ให้แถวเวลา "ตอนนี้" ไปอยู่
  // กึ่งกลางพอดี ก่อนหน้านี้ใช้ el.clientHeight ตรงๆ ตอน auto-scroll ครั้ง
  // เดียว แต่ตอนนี้ต้องคำนวณใหม่ทุกครั้งที่ track ขยับ (ทุกวินาที) จึงต้อง
  // เก็บเป็น state แทนที่จะอ่านสดจาก ref ทุก render — วัดผ่าน
  // ResizeObserver เผื่อขนาดพาเนลเปลี่ยน (เช่น responsive breakpoint ที่
  //ย่อ .tape-panel เป็น min-height คงที่ใน media query ด้านล่าง)
  const tapeScrollRef = useRef(null);
  const [tapeViewportHeight, setTapeViewportHeight] = useState(0);

  useEffect(() => {
    const el = tapeScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setTapeViewportHeight(entries[0].contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ตำแหน่งของแถวเวลา "ตอนนี้" นับจากบนสุดของ tape-track (เที่ยงคืน) เป็น
  // px — เหมือนเดิมทุกประการ (ใช้เป็นค่าตั้งต้นก่อนแปลงเป็น offset ด้านล่าง)
  const tapeNowLineTop = useMemo(() => {
    const nowDate = new Date(now);
    const minutesSinceMidnight =
      nowDate.getHours() * 60 + nowDate.getMinutes() + nowDate.getSeconds() / 60;
    return (minutesSinceMidnight / minutesPerRow) * ROW_HEIGHT_PX;
  }, [now, minutesPerRow]);

  // เลื่อน tape-track ขึ้น (translateY ติดลบ) เท่ากับระยะจากบนสุดของ track
  // ถึงแถว "ตอนนี้" ลบด้วยครึ่งหนึ่งของพื้นที่มองเห็น — ผลคือแถว "ตอนนี้"
  // จะอยู่ตรงกึ่งกลางพอดีเสมอ ไม่ว่าจะซูมระดับไหนหรือเวลาผ่านไปเท่าไหร่
  // เส้น .tape-now-line เองไม่ขยับอีกต่อไป (fixed อยู่กึ่งกลางผ่าน CSS
  // top:50% เสมอ) มีแค่ตัวตารางเวลาที่เลื่อนผ่านมันไป เหมือนเทปที่ไหลผ่าน
  // หัวอ่านคงที่ — ตรงข้ามกับพฤติกรรมเดิมที่ตารางอยู่นิ่งแล้วเส้นขยับลงมา
  //
  // ทุกวินาทีที่ `now` tick การขยับนี้จึงเกิดขึ้นทุกครั้งด้วย (ต่างจาก
  // auto-scroll เดิมที่ตั้งใจให้รันแค่ตอนเปลี่ยนซูม/mount) — ตรงตาม
  // requirement ใหม่ที่ต้องการให้เส้นอยู่กึ่งกลางตลอดเวลา ไม่ใช่แค่จัดกึ่งกลาง
  // ครั้งเดียวตอนเปิดหน้าแล้วปล่อยให้ผู้ใช้ scroll เองได้เหมือนก่อนหน้านี้
  const tapeAutoOffset = tapeViewportHeight > 0
    ? tapeViewportHeight / 2 - tapeNowLineTop
    : 0;

  // ระยะที่ผู้ใช้เลื่อนเองด้วยมือ (px) — บวกเพิ่มเข้าไปบน tapeAutoOffset
  // เท่านั้น ไม่ได้แทนที่กัน เพื่อให้ตำแหน่ง "ตอนนี้" ยังเป็นจุดอ้างอิง 0
  // เสมอ (เลื่อนจากศูนย์ ไม่ใช่เลื่อนจากค่าที่คำนวณสดครั้งก่อน) — เก็บเป็น
  // ref แทน state เพราะอัปเดตถี่มากตอนลาก/wheel และไม่จำเป็นต้อง trigger
  // re-render ทุกพิกเซล ใช้ forceRerender แบบง่ายๆ (นับเลข) มา trigger แทน
  const manualOffsetRef = useRef(0);
  const [, forceTapeRerender] = useState(0);

  // อนุญาตให้เลื่อนเองด้วยมือเฉพาะตอน Pomodoro "หยุดชั่วคราว" อยู่เท่านั้น
  // (ไม่ได้กำลังนับถอยหลัง — pomodoro.endsAt เป็น null) ตามที่ต้องการ —
  // ระหว่างนับถอยหลังจริง เทปยังคงล็อกติดตามเวลาปัจจุบันอัตโนมัติเหมือนเดิม
  // ไม่ให้ผู้ใช้ scroll หลุดจากเวลาปัจจุบันโดยไม่ตั้งใจระหว่างทำงานอยู่
  const canManualScroll = !pomodoro.endsAt;

  // พอกด "เริ่ม" อีกครั้ง (endsAt เปลี่ยนจาก null เป็นมีค่า) ให้รีเซ็ต
  // manualOffset กลับเป็น 0 ทันที — เทปจะกระโดดกลับไปตามเวลาปัจจุบันให้
  // อัตโนมัติ ไม่ค้างอยู่ตำแหน่งที่ผู้ใช้เคยเลื่อนดูตอนหยุดพัก
  useEffect(() => {
    if (pomodoro.endsAt) {
      manualOffsetRef.current = 0;
      forceTapeRerender((n) => n + 1);
    }
  }, [pomodoro.endsAt]);

  const trackHeightPx = tapeRows.length * ROW_HEIGHT_PX; // 00:00 ถึง 24:00 เต็มความสูง

  // ห้ามเลื่อนออกนอกขอบเขต 00:00-24:00 เด็ดขาด — clamp ค่า offset สุดท้าย
  // ให้ขอบบนสุดของ track (นาทีที่ 0) ไม่มีวันเลื่อนต่ำกว่าขอบบนของพื้นที่
  // มองเห็น และขอบล่างสุดของ track (นาทีที่ 1440) ไม่มีวันเลื่อนสูงกว่าขอบ
  // ล่างของพื้นที่มองเห็น — ทั้งสองเงื่อนไขต้องเป็นจริงพร้อมกันเสมอ:
  //   translateY สูงสุดที่ยอมได้ = 0 (ขอบบนของ track ชนขอบบนของจอพอดี)
  //   translateY ต่ำสุดที่ยอมได้ = viewportHeight - trackHeightPx (ขอบล่าง
  //     ของ track ชนขอบล่างของจอพอดี)
  // ถ้า trackHeightPx สั้นกว่า viewport เอง (ซูมออกสุดบนจอใหญ่) ขอบเขตทั้ง
  // สองจะสลับที่กัน (min > max) — ใช้ Math.min/Math.max ครอบอีกชั้นกันพัง
  const clampTrackOffset = (rawOffset) => {
    if (tapeViewportHeight <= 0) return rawOffset;
    const maxOffset = 0;
    const minOffset = Math.min(0, tapeViewportHeight - trackHeightPx);
    return Math.min(maxOffset, Math.max(minOffset, rawOffset));
  };

  // manualOffsetRef ต้องถูก clamp ด้วยขอบเขตเดียวกันนี้ "สัมพัทธ์กับ
  // tapeAutoOffset ปัจจุบัน" ไม่ใช่ clamp ตัวมันเองแบบลอยๆ — มิฉะนั้นตอน
  // auto-offset เปลี่ยน (เวลาผ่านไป) ผลรวมอาจหลุดขอบเขตได้อีกแม้
  // manualOffsetRef เองจะอยู่ในช่วงที่เคย valid ตอนคำนวณครั้งก่อน
  const clampManualOffset = (rawManualOffset) => {
    const clampedTotal = clampTrackOffset(tapeAutoOffset + rawManualOffset);
    return clampedTotal - tapeAutoOffset;
  };

  const handleTapeWheel = (event) => {
    if (!canManualScroll) return;
    event.preventDefault();
    const next = manualOffsetRef.current - event.deltaY;
    manualOffsetRef.current = clampManualOffset(next);
    forceTapeRerender((n) => n + 1);
  };

  // ผูก wheel listener เองแบบ native (ไม่ใช่ผ่าน React's onWheel prop) —
  // จำเป็นเพราะ browser สมัยใหม่ (Chrome/Firefox) ผูก onWheel ของ React
  // เป็น passive listener โดย default เสมอ ทำให้ event.preventDefault()
  // ข้างในถูกเพิกเฉยเงียบๆ พร้อม console warning "Unable to preventDefault
  // inside passive event listener invocation" — ผลคือหน้าเว็บยัง scroll
  // ตามปกติทับซ้อนกับการเลื่อน tape-track เอง ต้องผูกผ่าน
  // addEventListener('wheel', handler, { passive: false }) ตรงๆ เท่านั้น
  // ถึงจะสั่ง preventDefault ได้จริง — useEffect นี้จึงทำหน้าที่แทน onWheel
  // prop เดิมทั้งหมด (ไม่มี onWheel prop บน .tape-scroll อีกต่อไป)
  useEffect(() => {
    const el = tapeScrollRef.current;
    if (!el) return;
    const listener = (event) => handleTapeWheel(event);
    el.addEventListener("wheel", listener, { passive: false });
    return () => el.removeEventListener("wheel", listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManualScroll, tapeRows.length, tapeAutoOffset, tapeViewportHeight]);

  // ลาก (pointer drag) เป็นอีกทางเลื่อนเทปด้วยมือ นอกเหนือจาก wheel —
  // สำคัญโดยเฉพาะบนมือถือ/แท็บเล็ตที่ไม่มี wheel event ให้ใช้เลย
  const tapeDragState = useRef(null);
  const handleTapePointerDown = (event) => {
    if (!canManualScroll) return;
    tapeDragState.current = { startY: event.clientY, startOffset: manualOffsetRef.current };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handleTapePointerMove = (event) => {
    if (!canManualScroll || !tapeDragState.current) return;
    const delta = event.clientY - tapeDragState.current.startY;
    const next = tapeDragState.current.startOffset + delta;
    manualOffsetRef.current = clampManualOffset(next);
    forceTapeRerender((n) => n + 1);
  };
  const handleTapePointerUp = () => {
    tapeDragState.current = null;
  };

  // ระหว่างกำลังลาก reminder อยู่ (isDraggingReminder) ห้าม track ขยับเลย
  // แม้แต่ตอน `now` tick ทุกวินาที — HTML5 drag-and-drop คำนวณตำแหน่ง
  // drop-target จากพิกัดจริงบนจอ ถ้า .tape-track ขยับด้วย CSS transform
  // ระหว่างนั้น (จาก transition อยู่แล้ว) บาง browser จะเสีย track ของ
  // dragover ไปกลางคัน ทำให้ drop ไม่ยิงเลยทั้งที่ปล่อยเมาส์ตรงแถวเวลาแล้ว
  // จริงๆ — ค่านี้จึง freeze ทั้ง auto (ตามเวลาปัจจุบัน) และ manual (เลื่อน
  // เอง) offset ไว้ที่ค่าล่าสุดก่อนเริ่มลาก โดยใช้ ref เก็บ snapshot ไว้
  const frozenOffsetRef = useRef(0);
  useEffect(() => {
    if (isDraggingReminder) {
      frozenOffsetRef.current = clampTrackOffset(tapeAutoOffset + manualOffsetRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraggingReminder]);

  const tapeTrackOffset = isDraggingReminder
    ? frozenOffsetRef.current
    : clampTrackOffset(tapeAutoOffset + manualOffsetRef.current);

  const renderReminder = (reminder) => {
    const remaining = reminder.enabled ? Math.max(0, reminder.nextDueAt - now) : null;
    return (
      <div className={`reminder-row${reminder.enabled ? " active" : ""}`} key={reminder.id}>
        <div
          className="reminder-freq-badge"
          draggable
          onDragStart={handleReminderDragStart(reminder.id)}
          onDragEnd={handleReminderDragEnd}
          title="ลากไปวางบนตารางเวลาซ้ายเพื่อกำหนดเวลาเตือนครั้งถัดไป"
        >
          <span className="n">{reminder.amount}</span>
          <span className="u">{reminder.unit === "hours" ? "ชม." : "นาที"}</span>
        </div>
        <div
          className="reminder-info"
          draggable
          onDragStart={handleReminderDragStart(reminder.id)}
          onDragEnd={handleReminderDragEnd}
        >
          <p className="title">{reminder.title}</p>
          <p className="meta">
            {reminder.enabled ? `${intervalLabel(reminder)} · อีก ${formatDuration(remaining)}` : "ปิดอยู่"}
          </p>
        </div>
        <button
          type="button"
          className={`reminder-toggle${reminder.enabled ? " on" : ""}`}
          onClick={() => toggleReminder(reminder.id)}
          aria-label={`${reminder.enabled ? "ปิด" : "เปิด"} ${reminder.title}`}
          aria-pressed={reminder.enabled}
        />
        <div className="reminder-row-actions">
          <button type="button" className="icon-btn" onClick={() => startEditing(reminder)} title="แก้ไข">✎</button>
          <button type="button" className="icon-btn" onClick={() => removeReminder(reminder.id)} title="ลบ">🗑</button>
        </div>
      </div>
    );
  };

  return (
    <div className="reminder-mockup reminder-mode">
      <style>{`
        .reminder-mode { --rm-blue:#1557b0; --rm-border:#dadce0; --rm-text-primary:#3c4043; --rm-text-secondary:#5f6368; --rm-bg:#e8eaed; --rm-bg-muted:#fff; --rm-amber:#e8710a; --rm-amber-dark:#b85a08; --rm-amber-tint:#fdf0e3; --rm-green:#1e8e3e; --rm-green-tint:#e6f4ea; font-family:"Google Sans","Roboto",Arial,sans-serif; color:var(--rm-text-primary); background:var(--rm-bg); display:flex; flex-direction:column; flex:1; min-height:0; position:relative; }
        .reminder-mode .reminder-banner,.reminder-mode .reminder-alert { display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:13px; font-weight:500; }
        .reminder-mode .reminder-banner { background:var(--rm-amber-tint); color:var(--rm-amber-dark); border-bottom:1px solid var(--rm-amber); }
        .reminder-mode .reminder-banner .badge { font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; background:var(--rm-amber); color:#fff; padding:2px 8px; border-radius:10px; flex-shrink:0; }
        .reminder-mode .reminder-alert { background:var(--rm-amber-tint); color:var(--rm-amber-dark); border-bottom:1px solid var(--rm-amber); justify-content:space-between; }
        .reminder-mode .reminder-alert-actions { display:flex; gap:8px; }
        .reminder-mode .rm-dashboard { flex:1; display:grid; grid-template-columns:300px 1fr; gap:16px; padding:16px; overflow:hidden; }
        .reminder-mode .btn { font:inherit; font-size:14px; padding:8px 16px; border-radius:6px; border:1px solid var(--rm-border); background:var(--rm-bg-muted); color:var(--rm-text-primary); cursor:pointer; }
        .reminder-mode .btn.primary { background:var(--rm-amber); border-color:var(--rm-amber); color:#fff; }
        .reminder-mode .btn:hover { filter:brightness(.97); }
        .reminder-mode .tape-panel,.reminder-mode .reminder-panel { background:var(--rm-bg-muted); border:1px solid var(--rm-border); border-radius:8px; display:flex; flex-direction:column; overflow:hidden; }
        .reminder-mode .tape-panel { position:relative; z-index:11; }
        .reminder-mode .focus-dim-overlay { position:absolute; inset:0; z-index:10; background:rgba(32,33,36,.72); animation:rm-focus-dim-fade .25s ease; pointer-events:none; }
        @keyframes rm-focus-dim-fade { from { opacity:0; } to { opacity:1; } }
        .reminder-mode .tape-header { padding:16px; }
        .reminder-mode .tape-label,.reminder-mode .reminder-toolbar-sub,.reminder-mode .meta { color:var(--rm-text-secondary); }
        .reminder-mode .tape-label { font-size:12px; text-transform:uppercase; letter-spacing:.04em; margin:0 0 6px; }
        .reminder-mode .tape-session-name { font-size:16px; font-weight:500; margin:0 0 2px; }
        .reminder-mode .tape-session-sub { font-size:12px; color:var(--rm-text-secondary); }
        .reminder-mode .tape-big-clock { font:500 40px "Roboto Mono",monospace; letter-spacing:-.02em; color:var(--rm-amber-dark); margin:12px 0 4px; }
        .reminder-mode .tape-phase-pill { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:500; padding:3px 10px; border-radius:12px; background:var(--rm-green-tint); color:var(--rm-green); }
        .reminder-mode .tape-phase-pill .dot { width:6px; height:6px; border-radius:50%; background:var(--rm-green); }
        .reminder-mode .tape-scroll { flex:1; overflow:hidden; padding:8px 0; position:relative; touch-action:none; }
        .reminder-mode .tape-scroll.is-manual-scrollable { cursor:grab; }
        .reminder-mode .tape-scroll.is-manual-scrollable:active { cursor:grabbing; }
        .reminder-mode .tape-toolbar { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--rm-border); flex-shrink:0; }
        .reminder-mode .tape-toolbar-label { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--rm-text-secondary); }
        .reminder-mode .tape-zoom-controls { display:flex; align-items:center; gap:6px; }
        .reminder-mode .tape-zoom-controls .icon-btn { border:1px solid var(--rm-border); width:24px; height:24px; font-size:14px; line-height:1; }
        .reminder-mode .tape-zoom-controls .icon-btn:disabled { opacity:.4; cursor:default; }
        .reminder-mode .tape-zoom-controls .icon-btn:disabled:hover { background:transparent; color:var(--rm-text-secondary); }
        .reminder-mode .tape-zoom-value { font-family:"Roboto Mono",monospace; font-size:11px; color:var(--rm-text-secondary); min-width:70px; text-align:center; }
        .reminder-mode .tape-track { position:absolute; left:0; right:0; padding-left:56px; margin:0 16px; transition:transform .2s linear; will-change:transform; }
        .reminder-mode .tape-now-line { position:absolute; top:50%; left:0; right:0; height:2px; background:var(--rm-amber); z-index:3; }
        .reminder-mode .tape-now-line::before { content:"ตอนนี้"; position:absolute; left:8px; top:-9px; font-size:10px; font-weight:700; color:#fff; background:var(--rm-amber); padding:1px 6px; border-radius:8px; }
        .reminder-mode .tape-minute { position:relative; border-top:1px solid var(--rm-border); }
        .reminder-mode .tape-minute:hover { background:var(--rm-amber-tint); }
        .reminder-mode .reminder-info { cursor:grab; }
        .reminder-mode .tape-minute-label { position:absolute; left:-56px; top:-7px; width:48px; text-align:right; font-family:"Roboto Mono",monospace; font-size:11px; color:var(--rm-text-secondary); }
        .reminder-mode .tape-minute.major .tape-minute-label { font-weight:700; color:var(--rm-text-primary); }
        .reminder-mode .tape-flag { position:absolute; left:8px; top:4px; display:flex; align-items:center; gap:6px; font-size:12px; background:var(--rm-bg-muted); border:1px solid var(--rm-amber); color:var(--rm-amber-dark); padding:3px 8px 3px 6px; border-radius:12px; white-space:nowrap; max-width:210px; overflow:hidden; text-overflow:ellipsis; cursor:grab; z-index:2; }
        .reminder-mode .tape-flag:active { cursor:grabbing; }
        .reminder-mode .tape-flag .flag-dot { width:6px; height:6px; border-radius:50%; background:var(--rm-amber); flex-shrink:0; }
        .reminder-mode .tape-footer { margin-top:auto; padding:12px 16px; border-top:1px solid var(--rm-border); display:flex; gap:8px; }
        .reminder-mode .tape-footer .btn { flex:1; }
        .reminder-mode .reminder-toolbar { padding:16px; border-bottom:1px solid var(--rm-border); display:flex; align-items:center; justify-content:space-between; gap:16px; }
        .reminder-mode .reminder-toolbar h2 { font-size:18px; font-weight:500; margin:0; }
        .reminder-mode .reminder-toolbar-sub { font-size:12px; margin:2px 0 0; }
        .reminder-mode .reminder-list { flex:1; overflow-y:auto; padding:12px 16px; display:flex; flex-direction:column; gap:8px; }
        .reminder-mode .reminder-section-label { font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--rm-text-secondary); margin:12px 0 2px; padding:0 4px; }
        .reminder-mode .reminder-row { display:grid; grid-template-columns:44px 1fr auto auto; align-items:center; gap:12px; padding:10px 12px; border:1px solid var(--rm-border); border-radius:8px; background:var(--rm-bg-muted); }
        .reminder-mode .reminder-row.active { border-color:var(--rm-amber); background:var(--rm-amber-tint); }
        .reminder-mode .reminder-freq-badge { font-family:"Roboto Mono",monospace; font-size:11px; font-weight:700; text-align:center; background:#e8f0fe; color:var(--rm-blue); border-radius:6px; padding:6px 2px; line-height:1.15; cursor:grab; }
        .reminder-mode .active .reminder-freq-badge { background:var(--rm-amber); color:#fff; }
        .reminder-mode .reminder-freq-badge .n,.reminder-mode .reminder-freq-badge .u { display:block; }
        .reminder-mode .reminder-freq-badge .n { font-size:14px; }
        .reminder-mode .reminder-freq-badge .u { font-size:8px; opacity:.8; }
        .reminder-mode .reminder-info .title { font-size:14px; font-weight:500; margin:0 0 2px; }
        .reminder-mode .meta { font-size:12px; margin:0; }
        .reminder-mode .reminder-toggle { width:36px; height:20px; border-radius:10px; background:var(--rm-border); position:relative; cursor:pointer; border:none; }
        .reminder-mode .reminder-toggle.on { background:var(--rm-green); }
        .reminder-mode .reminder-toggle::after { content:""; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:left .15s ease; }
        .reminder-mode .reminder-toggle.on::after { left:18px; }
        .reminder-mode .reminder-row-actions { display:flex; gap:4px; }
        .reminder-mode .icon-btn { width:28px; height:28px; border-radius:6px; border:none; background:transparent; color:var(--rm-text-secondary); cursor:pointer; font-size:14px; }
        .reminder-mode .icon-btn:hover { background:#e8eaed; color:var(--rm-text-primary); }
        .reminder-mode .composer { margin:8px 0 4px; border:1px dashed var(--rm-border); border-radius:8px; padding:14px; display:grid; grid-template-columns:1.4fr 1fr auto; gap:10px; align-items:end; background:#fafbfc; }
        .reminder-mode .composer label { font-size:11px; color:var(--rm-text-secondary); display:block; margin-bottom:4px; }
        .reminder-mode .composer input,.reminder-mode .composer select { width:100%; box-sizing:border-box; font:inherit; font-size:13px; padding:8px 10px; border:1px solid var(--rm-border); border-radius:6px; background:#fff; }
        .reminder-mode .freq-row { display:flex; gap:6px; }
        .reminder-mode .freq-row input { width:58px; flex:none; }
        @media (max-width:900px) { .reminder-mode .rm-dashboard { grid-template-columns:1fr; overflow:auto; } .reminder-mode .tape-panel { min-height:230px; } }
      `}</style>

      {showFocusDim && <div className="focus-dim-overlay" aria-hidden="true" />}

      <div className="reminder-banner">
        <span className="badge">Live</span>
        Reminder ทำงานในแท็บนี้ · Pomodoro และ reminder ใช้ระบบแจ้งเตือนเดียวกัน
      </div>
      {(dueReminders.length > 0 || pomodoroNotice) && (
        <div className="reminder-alert" role="alert">
          <span>{pomodoroNotice || `ถึงเวลา: ${dueReminders.map((reminder) => reminder.title).join(", ")}`}</span>
          <div className="reminder-alert-actions">
            {dueReminders.map((reminder) => <button key={reminder.id} className="btn" onClick={() => scheduleNext(reminder.id)}>เตือนอีกครั้ง</button>)}
            {pomodoroNotice && <button className="btn" onClick={() => setPomodoroNotice(null)}>รับทราบ</button>}
          </div>
        </div>
      )}

      <div className="rm-dashboard">
        <aside className="tape-panel">
          <div className="tape-header">
            <p className="tape-label">Pomodoro Timer</p>
            <p className="tape-session-name">โฟกัส: {pomodoro.phase === "focus" ? "งานที่กำลังทำอยู่" : "พักระหว่างรอบ"}</p>
            <p className="tape-session-sub">รอบโฟกัสที่ {pomodoro.rounds + 1} · reminder ที่เปิดอยู่จะทำงานควบคู่กัน</p>
            <div className="tape-big-clock">{formatDuration(pomodoroRemaining * 1000)}</div>
            <span className="tape-phase-pill"><span className="dot" />{pomodoro.endsAt ? "กำลังทำงาน" : "หยุดชั่วคราว"}</span>
          </div>
          <div className="tape-toolbar">
            <span className="tape-toolbar-label">มุมมอง 24 ชม.</span>
            <div className="tape-zoom-controls" role="group" aria-label="ระดับซูมตาราง">
              <button
                type="button"
                className="icon-btn"
                onClick={zoomOut}
                disabled={zoomIndex === 0}
                aria-label="ซูมออก"
                title="ซูมออก"
              >
                −
              </button>
              <span className="tape-zoom-value">{minutesPerRow} นาที/ช่อง</span>
              <button
                type="button"
                className="icon-btn"
                onClick={zoomIn}
                disabled={zoomIndex === ZOOM_LEVELS_MINUTES.length - 1}
                aria-label="ซูมเข้า"
                title="ซูมเข้า"
              >
                +
              </button>
            </div>
          </div>
          <div
            className={`tape-scroll${canManualScroll ? " is-manual-scrollable" : ""}`}
            ref={tapeScrollRef}
            onPointerDown={handleTapePointerDown}
            onPointerMove={handleTapePointerMove}
            onPointerUp={handleTapePointerUp}
            onPointerLeave={handleTapePointerUp}
          >
            <div className="tape-now-line" />
            <div
              className="tape-track"
              style={{
                height: `${tapeRows.length * ROW_HEIGHT_PX}px`,
                transform: `translateY(${tapeTrackOffset}px)`,
                transition: isDraggingReminder ? "none" : undefined
              }}
            >
              {tapeRows.map(({ startMinute, isMajor, label, flag }) => (
                <div
                  key={startMinute}
                  className={`tape-minute${isMajor ? " major" : ""}`}
                  style={{ height: `${ROW_HEIGHT_PX}px` }}
                  onDragOver={handleTapeMinuteDragOver}
                  onDrop={handleTapeMinuteDrop(startMinute)}
                >
                  <span className="tape-minute-label">{label}</span>
                  {flag && (
                    <span
                      className="tape-flag"
                      draggable
                      onDragStart={(event) => {
                        // หยุด event ไม่ให้ bubble ไปโดน onDragOver/onDrop
                        // ของ .tape-minute ที่ครอบมันอยู่ (ตัวมันเองอยู่
                        // ข้างในแถวเวลาที่เป็น drop-target อยู่แล้ว) —
                        // ไม่งั้นลากป้ายนี้ออกจากตำแหน่งเดิมอาจไป trigger
                        // dragover ของแถวตัวเองซ้อนกับของแถวปลายทางจริง
                        event.stopPropagation();
                        handleReminderDragStart(flag.id)(event);
                      }}
                      onDragEnd={handleReminderDragEnd}
                      title="ลากเพื่อย้ายเวลาเตือนของ reminder นี้"
                    >
                      <span className="flag-dot" />{flag.title}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="tape-footer">
            {pomodoro.endsAt ? <button className="btn" onClick={pausePomodoro}>หยุดชั่วคราว</button> : <button className="btn primary" onClick={startPomodoro}>เริ่ม {pomodoro.phase === "focus" ? "โฟกัส" : "พัก"}</button>}
            <button className="btn" onClick={skipPomodoro}>ข้ามช่วง</button>
          </div>
        </aside>

        <section className="reminder-panel">
          <div className="reminder-toolbar"><div><h2>Reminder ทั้งหมด</h2><p className="reminder-toolbar-sub">{reminders.length} รายการ · {activeReminders.length} กำลังทำงาน</p></div><button type="button" className="btn primary" onClick={() => document.getElementById("reminder-title")?.focus()}>+ เพิ่ม Reminder</button></div>
          <div className="reminder-list">
            {activeReminders.length > 0 && <><p className="reminder-section-label">กำลังทำงาน</p>{activeReminders.map(renderReminder)}</>}
            {pausedReminders.length > 0 && <><p className="reminder-section-label">ปิดอยู่</p>{pausedReminders.map(renderReminder)}</>}
            <form className="composer" onSubmit={saveReminder}>
              <div><label htmlFor="reminder-title">ชื่อ Reminder</label><input id="reminder-title" value={draft.title} onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))} placeholder="เช่น ลุกยืดเส้น" /></div>
              <div><label htmlFor="reminder-amount">ความถี่</label><div className="freq-row"><input id="reminder-amount" type="number" min="1" value={draft.amount} onChange={(event) => setDraft((previous) => ({ ...previous, amount: event.target.value }))} /><select value={draft.unit} onChange={(event) => setDraft((previous) => ({ ...previous, unit: event.target.value }))}><option value="minutes">นาที</option><option value="hours">ชั่วโมง</option></select></div></div>
              <div>{editingId && <button className="btn" type="button" onClick={cancelEditing}>ยกเลิก</button>}<button className="btn primary" type="submit">{editingId ? "บันทึก" : "เพิ่ม"}</button></div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
