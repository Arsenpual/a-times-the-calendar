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
  // แถวที่เมาส์กำลังลอยอยู่เหนือระหว่างลาก (startMinute ของแถวนั้น) — ใช้
  // ไฮไลต์แถวปลายทางให้เห็นชัดว่าถ้าปล่อยตอนนี้จะไปตกที่ไหน
  const [dragOverMinute, setDragOverMinute] = useState(null);

  /**
   * แปลงพิกัด clientY (ตำแหน่งเมาส์/นิ้วจริงบนจอ) เป็น "นาทีที่เท่าไหร่ของวัน"
   * (0-1439) — เทียบท่าเดียวกับ gridMinutesFromClientY ใน timeline-editor.jsx
   * แต่ต้องหักลบ tapeTrackOffset ออกด้วย เพราะ .tape-track เลื่อนตัวเองผ่าน
   * CSS transform ตลอดเวลา (ตามเวลาปัจจุบันหรือตาม manual scroll) ต่างจาก
   * grid ใน TimelineEditor ที่ตำแหน่งนิ่งอยู่กับที่เทียบกับ container ของมัน
   * เสมอ — ถ้าไม่หัก offset ตรงนี้ตำแหน่งที่คำนวณได้จะเพี้ยนทุกครั้งที่ track
   * เลื่อน (ซึ่งเลื่อนแทบทุกวินาทีตอนไม่ได้ pause)
   */
  const minuteFromClientY = (clientX, clientY) => {
    const rect = tapeScrollRef.current?.getBoundingClientRect();
    if (!rect) return null;
    // ต้องเช็คว่าพิกัดยังอยู่ในกรอบที่มองเห็นของ .tape-scroll จริงๆ (ทั้ง X
    // และ Y) ไม่ใช่คำนวณ+clamp ตัวเลขให้อยู่ในช่วง 0-1439 เฉยๆ — มิฉะนั้น
    // การลากที่เริ่มจากฝั่งขวา (.reminder-freq-badge) แล้วปล่อยตอนนิ้ว/เมาส์
    // ยังไม่เข้าเขตเทปฝั่งซ้ายเลย จะถูกตีความว่า "ปล่อยที่นาที 0 หรือ 1439"
    // ผิดๆ แทนที่จะถือเป็นการยกเลิกลาก (ปล่อยนอกพื้นที่รับ)
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }
    const yWithinTrack = clientY - rect.top - tapeTrackOffset;
    const minute = Math.floor((yWithinTrack / ROW_HEIGHT_PX) * minutesPerRow);
    return Math.min(1439, Math.max(0, minute));
  };

  /**
   * เวอร์ชัน hysteresis ของ minuteFromClientY — แก้ปัญหาไฮไลต์แถว/ค่านาที
   * "ลวน" (กระพือสลับไปมา) ตอนซูมระดับละเอียด (เช่น 1 นาที/แถว = สูงแค่
   * ROW_HEIGHT_PX 28px/แถว) เพราะ pointer สั่นเพียง 1-2px จากแรงสั่นของมือ/
   * นิ้วธรรมชาติ ก็เพียงพอให้ minuteFromClientY คำนวณข้ามเส้นแบ่งแถวไปแล้ว
   * (28px หารด้วย 1 นาที = 28px ต่อ 1 นาที บางระดับซูมยิ่งไวกว่านี้อีก)
   *
   * แก้ด้วยการไม่เปลี่ยนค่าแถวปัจจุบันทันทีที่คำนวณได้ค่าใหม่ — แต่เปลี่ยน
   * ก็ต่อเมื่อพิกัด Y ขยับพ้น "โซนกันเผลอ" ของแถวปัจจุบันไปจริงๆ เท่ากับ
   * ครึ่งหนึ่งของ ROW_HEIGHT_PX ในทิศทางนั้น (เหมือนมี snap point ตรงกลาง
   * แถว ต้องข้ามพ้นกึ่งกลางไปยังแถวถัดไปก่อนถึงจะสลับ ไม่ใช่ข้ามเส้นขอบแถว
   * แค่เส้นเดียวที่บางกว่ามาก) ผลคือค่านาทียังละเอียดถึงระดับนาทีเป๊ะเหมือน
   * เดิมทุกประการ (ไม่ลดความแม่นยำ) แค่ไม่กระโดดสลับกลับไปกลับมาจากการสั่น
   * เล็กน้อยของ pointer เท่านั้น
   */
  const lastStableMinuteRef = useRef(null);
  const minuteFromClientYStable = (clientX, clientY) => {
    const raw = minuteFromClientY(clientX, clientY);
    if (raw === null) {
      lastStableMinuteRef.current = null;
      return null;
    }
    if (lastStableMinuteRef.current === null) {
      lastStableMinuteRef.current = raw;
      return raw;
    }
    const rect = tapeScrollRef.current?.getBoundingClientRect();
    if (!rect) return raw;
    // ตำแหน่ง Y (px จากบนสุดของ track) ของ "กึ่งกลาง" แถวที่ถือว่าเสถียรอยู่
    // ตอนนี้ — ถ้า pointer ยังไม่ข้ามกึ่งกลางนี้ไปยังฝั่งแถวถัดไป ถือว่ายัง
    // อยู่แถวเดิม ไม่เปลี่ยนค่า
    const stableRowTopPx =
      (lastStableMinuteRef.current / minutesPerRow) * ROW_HEIGHT_PX;
    const pointerYWithinTrack = clientY - rect.top - tapeTrackOffset;
    const distanceFromStableRowTop = pointerYWithinTrack - stableRowTopPx;
    const threshold = ROW_HEIGHT_PX * 0.6; // ต้องขยับพ้นเกินครึ่งแถวเล็กน้อยถึงจะสลับ กันขอบเขตพอดีเป๊ะสั่นตรงเส้น
    if (Math.abs(distanceFromStableRowTop) < threshold) {
      return lastStableMinuteRef.current;
    }
    lastStableMinuteRef.current = raw;
    return raw;
  };

  const reminderDragState = useRef(null); // { id, title, pointerId, fromSidebar, startX, startY, confirmed }
  // ตำแหน่งเมาส์/นิ้วล่าสุดระหว่างลาก (พิกัดจอ) — ใช้วาด drag-ghost ที่ลอย
  // ตามนิ้ว/เมาส์แบบ fixed-position ให้เห็นชัดว่ากำลังลากอะไรอยู่ ไม่ว่าจะ
  // เริ่มลากจากฝั่งขวา (นอก .tape-scroll) หรือจากป้ายบนเทปเองก็ตาม
  const [dragGhost, setDragGhost] = useState(null); // { x, y, title }

  /**
   * จุดเริ่มต้นการลาก reminder หนึ่งตัว — ใช้ร่วมกันทั้งสองจุดกำเนิด:
   *   1) .reminder-freq-badge / .reminder-info ฝั่งขวา (fromSidebar: true)
   *   2) .tape-flag บนเทปฝั่งซ้ายเอง (fromSidebar: false)
   * รวมเป็น Pointer Events เดียวแทน HTML5 native drag-and-drop เดิม (ซึ่งใช้
   * เฉพาะฝั่งขวา) เพื่อให้ทำงานเหมือนกันทุก input (เมาส์/นิ้ว/ปากกา) รวมถึง
   * มือถือ — HTML5 DnD ไม่ยิง event ใดๆ เลยตอนแตะหน้าจอ
   *
   * setPointerCapture ที่ currentTarget (ธาตุต้นทาง ไม่ว่าจะอยู่ panel ไหน)
   * ทำให้ pointermove/pointerup ทั้งหมดถูกส่งไปที่ธาตุนั้นเท่านั้น แม้นิ้ว/
   * เมาส์จะเคลื่อนไปอยู่เหนือ DOM subtree อื่น (เช่น ลากจากฝั่งขวาข้ามไปเทป
   * ฝั่งซ้าย) — ดังนั้น listener ของ move/up ต้องผูกไว้ที่ currentTarget
   * เดียวกันนี้ ไม่ใช่ .tape-scroll เหมือนเดิม (จะไม่ได้รับ event เลยตอน
   * capture อยู่ที่ธาตุอื่น)
   */
  const startReminderDrag = (id, title, fromSidebar = false) => (event) => {
    if (event.button === 2) return; // right-click ไม่นับเป็นการลาก
    event.preventDefault();
    event.stopPropagation(); // กัน bubble ไปโดน .tape-scroll's onPointerDown (manual scroll)
    // ยังไม่ตั้ง isDraggingReminder ที่นี่ — แค่ "กดลง" เฉยๆ ยังไม่นับเป็นการ
    // ลาก (ดู DRAG_START_THRESHOLD_PX ด้านล่าง) ถ้าไม่รอให้ขยับเกิน threshold
    // ก่อน แค่คลิกเฉยๆ (กดแล้วปล่อยที่เดิมโดยไม่ขยับเลย) ก็จะถูกตีความเป็น
    // "ลากไปวางที่ตำแหน่งที่คลิก" ทันที ทำให้ reminder ถูก reschedule ไปยัง
    // นาทีที่คลิกโดยไม่ตั้งใจทุกครั้งที่กดโดน .tape-flag/.reminder-freq-badge
    // เฉยๆ (อาการที่ผู้ใช้เจอ: "แค่คลิกแล้ววาง ตารางก็วิ่งไปเป็นสิบชม.แล้ว")
    reminderDragState.current = {
      id,
      title,
      pointerId: event.pointerId,
      fromSidebar,
      startX: event.clientX,
      startY: event.clientY,
      confirmed: false // ยังไม่ยืนยันว่าเป็นการลากจริงจนกว่าจะขยับพ้น threshold
    };
    draggedReminderId.current = id;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  // ระยะที่ต้องขยับพ้นก่อนจึงจะนับเป็น "การลาก" จริง (ไม่ใช่แค่คลิก/แตะ) —
  // มือ/นิ้วขยับเล็กน้อยระหว่างกด-ปล่อยเป็นเรื่องปกติ ถ้า threshold เป็น 0
  // ทุกคลิกจะกลายเป็นการลากไปวางที่ตำแหน่งเดียวกับที่กดทันที
  const DRAG_START_THRESHOLD_PX = 6;

  const moveReminderDrag = (event) => {
    const state = reminderDragState.current;
    if (!state) return;
    if (!state.confirmed) {
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return; // ยังไม่พ้น threshold — ยังไม่นับเป็นลาก
      // เพิ่งขยับพ้น threshold ครั้งแรก — ยืนยันว่าเป็นการลากจริง ค่อยเปิด
      // isDraggingReminder/ghost/ไฮไลต์แถวตอนนี้ (ไม่ใช่ตั้งแต่ pointerdown)
      state.confirmed = true;
      setIsDraggingReminder(true);
      // ต้อง freeze offset ตรงนี้แบบ synchronous ทันที (ไม่ใช่รอ useEffect
      // ที่ผูกกับ isDraggingReminder ด้านล่าง) — เพราะ useEffect รันหลัง
      // commit/re-render เท่านั้น แต่ตัว moveReminderDrag นี้ยังทำงานต่อใน
      // event handler เดียวกันนี้ต่อทันที (เรียก minuteFromClientYStable
      // ด้านล่างในบรรทัดถัดๆ ไปเลย) ซึ่งจะอ่าน tapeTrackOffset จาก render
      // ปัจจุบันที่ isDraggingReminder ยังเป็น false อยู่ (ค่ายังไม่ freeze)
      // ทำให้เฟรมแรกหลังยืนยันลากคำนวณ minute จาก offset แบบ auto-scroll
      // (ที่ขยับตามเวลาจริงตลอด) แทนที่จะเป็น offset แบบ freeze — พอเฟรม
      // ถัดไป offset freeze จริงถึงมีผล ตัวเลขจะกระโดดข้ามชั่วโมงทันที
      // เพราะ baseline สองเฟรมไม่ตรงกัน (คือสาเหตุที่ลากแค่ 1 นาทีแล้วเวลา
      // วิ่งไปไกล) — เขียน frozenOffsetRef ตรงนี้เองก่อนจึงตัดปัญหา race
      // condition ระหว่าง state update กับ effect timing ได้เด็ดขาด
      frozenOffsetRef.current = clampTrackOffset(tapeAutoOffset + manualOffsetRef.current);
      setDragGhost({ x: event.clientX, y: event.clientY, title: state.title });
      lastStableMinuteRef.current = null;
    }
    setDragGhost((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
    // ใช้เวอร์ชัน Stable (hysteresis) ตรงนี้แทน minuteFromClientY ตรงๆ —
    // ระหว่างลากคือจุดที่ pointer สั่นถี่ที่สุด (ทุก pointermove) ถ้าไม่กัน
    // การกระโดดสลับนาทีตรงนี้ แถวไฮไลต์/ป้าย preview จะกระพือให้เห็นชัดเจน
    // โดยเฉพาะตอนซูมระดับละเอียด (1 นาที/แถว = ROW_HEIGHT_PX เพียง 28px)
    const minute = minuteFromClientYStable(event.clientX, event.clientY);
    // อยู่นอก .tape-scroll (เช่น ยังลากค้างอยู่ฝั่งขวา) — minute เป็น null
    // เคลียร์ไฮไลต์แถวแทนที่จะค้างแถวเดิมไว้ผิดๆ
    setDragOverMinute(minute);
  };

  const endReminderDrag = () => {
    lastStableMinuteRef.current = null;
    const state = reminderDragState.current;
    reminderDragState.current = null;
    draggedReminderId.current = null;
    setIsDraggingReminder(false);
    setDragOverMinute(null);
    setDragGhost(null);
    // ไม่เคยขยับพ้น threshold เลย = แค่คลิก/แตะเฉยๆ ไม่ใช่การลาก — ไม่
    // reschedule อะไรทั้งสิ้น ต่างจากเดิมที่ทุก pointerup จะ reschedule
    // เสมอไม่ว่าจะขยับหรือไม่ (นี่คือจุดที่ทำให้แค่คลิกก็เด้งเวลาไปไกล)
    if (!state || !state.confirmed) return;
    const finalMinute = dragOverMinute;
    // ปล่อยนอกเขตตาราง (finalMinute เป็น null) = ยกเลิกการลาก ไม่ reschedule
    if (finalMinute !== null) {
      rescheduleReminderTo(state.id, finalMinute);
    }
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

  // ตำแหน่งเทป ณ ขณะที่เพิ่งเข้าสถานะ "หยุดชั่วคราว" — จับภาพไว้ครั้งเดียว
  // ตอน endsAt เปลี่ยนเป็น null แล้วใช้เป็น "ฐาน" คงที่ให้ manualOffsetRef
  // บวกทับระหว่าง pause แทนที่จะบวกทับ tapeAutoOffset ตรงๆ ซึ่งขึ้นกับ `now`
  // และเดินหน้าทุกวินาทีไม่ว่าจะ pause อยู่หรือไม่ — ถ้าไม่ freeze ตรงนี้
  // เทปจะค่อยๆ ไหลเลื่อนเองต่อไปเรื่อยๆ แม้ผู้ใช้จะหยุดมันไว้ที่ตำแหน่งหนึ่ง
  // แล้วก็ตาม (ขัดกับ intent ที่ต้องการให้ scroll ได้อิสระตอน pause)
  const pausedBaseOffsetRef = useRef(0);
  useEffect(() => {
    if (!pomodoro.endsAt) {
      pausedBaseOffsetRef.current = clampTrackOffset(tapeAutoOffset + manualOffsetRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // ต้อง clamp เทียบกับ "ฐาน" เดียวกับที่ใช้ render จริง (ดู tapeTrackOffset
    // ด้านล่าง) — ตอน pause ฐานคือ pausedBaseOffsetRef (ค่านิ่ง) ไม่ใช่
    // tapeAutoOffset ที่ยังเดินตาม `now` ทุกวินาที มิฉะนั้นขอบเขต clamp จะ
    // เพี้ยนไปเรื่อยๆ ตามเวลาทั้งที่ตำแหน่งบนจอไม่ได้ขยับตามเลย
    const base = pomodoro.endsAt ? tapeAutoOffset : pausedBaseOffsetRef.current;
    const clampedTotal = clampTrackOffset(base + rawManualOffset);
    return clampedTotal - base;
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
    // reminder drag ก่อนเสมอ — ถ้าลากเริ่มจากป้ายบนเทป (flag เป็น descendant
    // ของ .tape-scroll นี้เอง) capture จะอยู่ที่ flag แต่ event ยัง bubble
    // ขึ้นมาถึง handler นี้ตามปกติ จึงยังรับรู้ได้ตรงนี้ด้วย (ซ้ำกับ window
    // listener ด้านล่างไม่เป็นไร เพราะ moveReminderDrag เป็น no-op ถ้าไม่มี
    // reminderDragState.current) ปล่อยให้ manual-scroll logic ทำงานต่อถ้า
    // ไม่ได้กำลังลาก reminder อยู่
    moveReminderDrag(event);
    if (!canManualScroll || !tapeDragState.current) return;
    const delta = event.clientY - tapeDragState.current.startY;
    const next = tapeDragState.current.startOffset + delta;
    manualOffsetRef.current = clampManualOffset(next);
    forceTapeRerender((n) => n + 1);
  };
  const handleTapePointerUp = () => {
    endReminderDrag();
    tapeDragState.current = null;
  };

  /**
   * เมื่อลาก reminder เริ่มจากฝั่งขวา (.reminder-freq-badge/.reminder-info)
   * setPointerCapture จะผูกอยู่ที่ธาตุต้นทางนั้น ซึ่งไม่ใช่ descendant ของ
   * .tape-scroll เลย — pointermove/pointerup ที่เกิดขึ้นระหว่างลาก (แม้นิ้ว/
   * เมาส์จะเลื่อนไปอยู่เหนือเทปฝั่งซ้ายแล้วก็ตาม) จะไม่ bubble ไปถึง
   * .tape-scroll's onPointerMove/onPointerUp เลย เพราะ capture ผูกกับธาตุ
   * ต้นทางเป็นตัวรับ event โดยตรง (target ของทุก event คือธาตุต้นทางเสมอ)
   * — จึงต้องมี window-level listener แยกต่างหากที่ทำงานเฉพาะช่วงกำลังลาก
   * (isDraggingReminder) เพื่อให้ minuteFromClientY/rescheduleReminderTo
   * ทำงานได้ไม่ว่าการลากจะเริ่มจาก panel ไหนก็ตาม — นี่คือกลไกหลักที่ทำให้
   * "ลากจากรายการฝั่งขวาไปวางบนเทป" ทำงานได้จริงด้วย pointer events เดียว
   * (แทนที่ HTML5 native drag-and-drop เดิมซึ่งไม่รองรับการแตะหน้าจอเลย)
   */
  useEffect(() => {
    if (!isDraggingReminder) return;
    const onMove = (event) => moveReminderDrag(event);
    const onUp = () => endReminderDrag();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraggingReminder]);

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
    : !pomodoro.endsAt
      ? clampTrackOffset(pausedBaseOffsetRef.current + manualOffsetRef.current)
      : clampTrackOffset(tapeAutoOffset + manualOffsetRef.current);

  const renderReminder = (reminder) => {
    const remaining = reminder.enabled ? Math.max(0, reminder.nextDueAt - now) : null;
    return (
      <div className={`reminder-row${reminder.enabled ? " active" : ""}`} key={reminder.id}>
        <div
          className="reminder-freq-badge"
          onPointerDown={startReminderDrag(reminder.id, reminder.title, true)}
          title="ลากไปวางบนตารางเวลาซ้ายเพื่อกำหนดเวลาเตือนครั้งถัดไป"
        >
          <span className="n">{reminder.amount}</span>
          <span className="u">{reminder.unit === "hours" ? "ชม." : "นาที"}</span>
        </div>
        <div
          className="reminder-info"
          onPointerDown={startReminderDrag(reminder.id, reminder.title, true)}
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
    <div className={`reminder-mockup reminder-mode${isDraggingReminder ? " is-dragging-reminder" : ""}`}>
      <style>{`
        .reminder-mode { --rm-blue:#1557b0; --rm-border:#dadce0; --rm-text-primary:#3c4043; --rm-text-secondary:#5f6368; --rm-bg:#e8eaed; --rm-bg-muted:#fff; --rm-amber:#e8710a; --rm-amber-dark:#b85a08; --rm-amber-tint:#fdf0e3; --rm-green:#1e8e3e; --rm-green-tint:#e6f4ea; font-family:"Google Sans","Roboto",Arial,sans-serif; color:var(--rm-text-primary); background:var(--rm-bg); display:flex; flex-direction:column; flex:1; min-height:0; position:relative; }
        .reminder-mode.is-dragging-reminder { user-select:none; -webkit-user-select:none; cursor:grabbing; }
        .reminder-mode.is-dragging-reminder * { cursor:grabbing !important; }
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
        .reminder-mode .tape-minute.is-drop-target { background:var(--rm-amber-tint); outline:2px solid var(--rm-amber); outline-offset:-2px; border-radius:4px; }
        .reminder-mode .tape-drop-preview { position:absolute; right:8px; top:2px; font-size:10px; font-weight:700; color:#fff; background:var(--rm-amber); padding:1px 6px; border-radius:8px; z-index:4; pointer-events:none; }
        .reminder-mode .reminder-info { cursor:grab; touch-action:none; user-select:none; -webkit-user-select:none; }
        .reminder-mode .tape-minute-label { position:absolute; left:-56px; top:-7px; width:48px; text-align:right; font-family:"Roboto Mono",monospace; font-size:11px; color:var(--rm-text-secondary); }
        .reminder-mode .tape-minute.major .tape-minute-label { font-weight:700; color:var(--rm-text-primary); }
        .reminder-mode .tape-flag { position:absolute; left:8px; top:4px; display:flex; align-items:center; gap:6px; font-size:12px; background:var(--rm-bg-muted); border:1px solid var(--rm-amber); color:var(--rm-amber-dark); padding:3px 8px 3px 6px; border-radius:12px; white-space:nowrap; max-width:210px; overflow:hidden; text-overflow:ellipsis; cursor:grab; z-index:2; touch-action:none; user-select:none; -webkit-user-select:none; }
        .reminder-mode .tape-drag-ghost { position:fixed; z-index:1000; display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; background:var(--rm-amber); color:#fff; padding:5px 10px 5px 8px; border-radius:12px; white-space:nowrap; max-width:220px; overflow:hidden; text-overflow:ellipsis; pointer-events:none; transform:translate(-50%, -130%); box-shadow:0 4px 12px rgba(0,0,0,.25); }
        .reminder-mode .tape-drag-ghost .flag-dot { background:#fff; }
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
        .reminder-mode .reminder-freq-badge { font-family:"Roboto Mono",monospace; font-size:11px; font-weight:700; text-align:center; background:#e8f0fe; color:var(--rm-blue); border-radius:6px; padding:6px 2px; line-height:1.15; cursor:grab; touch-action:none; user-select:none; -webkit-user-select:none; }
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

      {dragGhost && (
        // ป้ายลอยตามนิ้ว/เมาส์ระหว่างลาก — fixed position เทียบกับ viewport
        // (ไม่ใช่ document) เพื่อไม่ให้เพี้ยนตอนหน้าเลื่อน แสดงทั้งตอนลากจาก
        // ป้ายบนเทปเองและตอนลากจากรายการฝั่งขวา ให้เห็นชัดว่ากำลังลาก
        // reminder ตัวไหนอยู่ไม่ว่าจะเริ่มจากจุดไหนก็ตาม
        <div
          className="tape-drag-ghost"
          style={{ left: `${dragGhost.x}px`, top: `${dragGhost.y}px` }}
          aria-hidden="true"
        >
          <span className="flag-dot" />
          {dragGhost.title}
        </div>
      )}

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
                  className={`tape-minute${isMajor ? " major" : ""}${
                    isDraggingReminder && dragOverMinute === startMinute ? " is-drop-target" : ""
                  }`}
                  style={{ height: `${ROW_HEIGHT_PX}px` }}
                >
                  <span className="tape-minute-label">{label}</span>
                  {isDraggingReminder && dragOverMinute === startMinute && (
                    // ป้ายเวลาปลายทางแบบ real-time — บอกตรงๆ ว่าถ้าปล่อยตอนนี้
                    // จะไปตกที่นาทีไหน ลดการเดาจากแค่การไฮไลต์แถวเฉยๆ
                    <span className="tape-drop-preview">{label}</span>
                  )}
                  {flag && (
                    <span
                      className="tape-flag"
                      onPointerDown={startReminderDrag(flag.id, flag.title, false)}
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
