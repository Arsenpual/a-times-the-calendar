import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "times-reminders-v1";

const ZOOM_LEVELS_MINUTES = [60, 15, 5, 1];
const DEFAULT_ZOOM_INDEX = ZOOM_LEVELS_MINUTES.indexOf(15);

const REMINDER_TYPE = {
  INTERVAL: "interval",
  WEEKLY: "weekly",
  EVENT_ANCHORED: "event-anchored",
  ROUTINE: "routine",
  ONCE_AT: "once-at",
  COUNTDOWN: "countdown",
  STOPWATCH: "stopwatch"
};

const DAYS_OF_WEEK = [
  { label: "อา", value: 0 },
  { label: "จ", value: 1 },
  { label: "อ", value: 2 },
  { label: "พ", value: 3 },
  { label: "พฤ", value: 4 },
  { label: "ศ", value: 5 },
  { label: "ส", value: 6 }
];

function isOneShotType(type) {
  return type === REMINDER_TYPE.ONCE_AT || type === REMINDER_TYPE.COUNTDOWN;
}

// แปลง timestamp เป็น "YYYY-MM-DD" ตามเวลาท้องถิ่นของเครื่อง (ไม่ใช้ toISOString() เพราะแปลงเป็น UTC
// ทำให้วันที่เพี้ยนได้เมื่อเวลาใกล้เที่ยงคืนในโซนเวลาที่ต่างจาก UTC เช่น ไทย +7)
function toLocalDateInputValue(ms) {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const DEFAULT_REMINDERS = [
  { id: "water", type: REMINDER_TYPE.INTERVAL, title: "ดื่มน้ำ", amount: 30, unit: "minutes", enabled: true },
  { id: "stretch", type: REMINDER_TYPE.INTERVAL, title: "ยืดตัว 30 วินาที", amount: 60, unit: "minutes", enabled: true },
  { id: "eyes", type: REMINDER_TYPE.INTERVAL, title: "พักสายตา มองไกล 20 ฟุต", amount: 20, unit: "minutes", enabled: true }
];

function intervalMs(reminder) {
  return reminder.amount * (reminder.unit === "hours" ? 60 * 60 * 1000 : 60 * 1000);
}

function intervalLabel(reminder) {
  const unit = reminder.unit === "hours" ? "ชั่วโมง" : "นาที";
  const base = `ทุก ${reminder.amount} ${unit}`;
  return hasWindow(reminder) ? `${base} (${reminder.windowStart}-${reminder.windowEnd})` : base;
}

function hasWindow(reminder) {
  return Boolean(reminder.windowStart && reminder.windowEnd);
}

// จัดรูปแบบวินาทีทั้งหมดเป็น "mm:ss" หรือ "h:mm:ss" ถ้าเกิน 1 ชั่วโมง ใช้ร่วมกันทั้ง stopwatch และ countdown
function formatDurationClock(totalSeconds) {
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  if (hh > 0) {
    return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function minuteOfDayAt(ms) {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesFromHHMM(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isMinuteWithinWindow(minuteOfDay, windowStart, windowEnd) {
  const start = minutesFromHHMM(windowStart);
  const end = minutesFromHHMM(windowEnd);
  if (start === end) return true;
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  return minuteOfDay >= start || minuteOfDay < end;
}

function snapToNextWindowStart(ms, windowStart, windowEnd) {
  const minuteOfDay = minuteOfDayAt(ms);
  if (isMinuteWithinWindow(minuteOfDay, windowStart, windowEnd)) return ms;
  const start = minutesFromHHMM(windowStart);
  const dayStart = new Date(ms);
  dayStart.setHours(0, 0, 0, 0);
  let candidate = dayStart.getTime() + start * 60000;
  if (candidate < ms) candidate += 24 * 60 * 60 * 1000;
  return candidate;
}

function computeNextDueAt(reminder, from) {
  switch (reminder.type) {
    case REMINDER_TYPE.WEEKLY: {
      if (!reminder.days || reminder.days.length === 0 || !reminder.time) return Infinity;
      const targetMin = minutesFromHHMM(reminder.time);
      const targetHour = Math.floor(targetMin / 60);
      const targetMinute = targetMin % 60;
      
      const baseDate = new Date(from);
      
      for (let i = 0; i < 8; i++) {
        const candidate = new Date(baseDate);
        candidate.setDate(baseDate.getDate() + i);
        candidate.setHours(targetHour, targetMinute, 0, 0);

        const dayOfWeek = candidate.getDay();
        if (reminder.days.includes(dayOfWeek) && candidate.getTime() > from) {
          return candidate.getTime();
        }
      }
      return Infinity;
    }
    case REMINDER_TYPE.EVENT_ANCHORED: {
      if (!reminder.lastTriggeredAt) return Infinity;
      const ms = reminder.afterAmount * (reminder.afterUnit === "hours" ? 3600000 : 60000);
      return reminder.lastTriggeredAt + ms;
    }
    case REMINDER_TYPE.ROUTINE: {
      return from;
    }
    case REMINDER_TYPE.ONCE_AT:
      return reminder.atMs;
    case REMINDER_TYPE.COUNTDOWN:
      return reminder.startedAt + reminder.durationMs;
    case REMINDER_TYPE.STOPWATCH:
      // Stopwatch จับเวลาอย่างเดียว ไม่มีแจ้งเตือน จึงไม่มี "ถึงกำหนด" ตลอดไป
      return Infinity;
    case REMINDER_TYPE.INTERVAL:
    default: {
      const next = from + intervalMs(reminder);
      return hasWindow(reminder) ? snapToNextWindowStart(next, reminder.windowStart, reminder.windowEnd) : next;
    }
  }
}

function describeReminder(reminder, nowMs) {
  switch (reminder.type) {
    case REMINDER_TYPE.WEEKLY: {
      const dayNames = reminder.days?.map(d => DAYS_OF_WEEK.find(x => x.value === d)?.label).join(" ");
      return `วนสัปดาห์ · [${dayNames}] เวลา ${reminder.time}`;
    }
    case REMINDER_TYPE.EVENT_ANCHORED: {
      const unit = reminder.afterUnit === "hours" ? "ชม." : "นาที";
      return `เหตุการณ์ · +${reminder.afterAmount} ${unit} หลัง "${reminder.eventName}"`;
    }
    case REMINDER_TYPE.ROUTINE: {
      const total = reminder.steps?.length || 0;
      const current = (reminder.currentIndex || 0) + 1;
      const stepName = reminder.steps?.[reminder.currentIndex] || "เสร็จสิ้นแล้ว";
      return `Routine (${current}/${total}) · ถัดไป: ${stepName}`;
    }
    case REMINDER_TYPE.ONCE_AT: {
      const d = new Date(reminder.atMs);
      const dateLabel = d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
      const timeLabel = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return `ครั้งเดียว · ${dateLabel} ${timeLabel}`;
    }
    case REMINDER_TYPE.COUNTDOWN: {
      if (!reminder.enabled || !reminder.startedAt) {
        const mins = Math.round(reminder.durationMs / 60000);
        return `นับถอยหลัง · ตั้งไว้ ${mins} นาที`;
      }
      const endMs = reminder.startedAt + reminder.durationMs;
      const remainingMs = endMs - (nowMs ?? Date.now());
      if (remainingMs <= 0) return "นับถอยหลัง · ถึงเวลาแล้ว";
      const totalSeconds = Math.ceil(remainingMs / 1000);
      return `นับถอยหลัง · เหลือ ${formatDurationClock(totalSeconds)}`;
    }
    case REMINDER_TYPE.STOPWATCH: {
      if (!reminder.enabled || !reminder.startedAt) {
        // หยุดอยู่: โชว์เวลาที่สะสมไว้ล่าสุด (accumulatedMs) ถ้ามี ไม่งั้นแสดง 0
        const totalSeconds = Math.floor((reminder.accumulatedMs || 0) / 1000);
        return `จับเวลา · หยุดที่ ${formatDurationClock(totalSeconds)}`;
      }
      // กำลังทำงาน: เวลาที่ผ่านไป = เวลาที่สะสมไว้ก่อนหน้า + เวลาตั้งแต่ startedAt ล่าสุดจนถึงตอนนี้
      const elapsedMs = (reminder.accumulatedMs || 0) + ((nowMs ?? Date.now()) - reminder.startedAt);
      const totalSeconds = Math.floor(elapsedMs / 1000);
      return `จับเวลา · ${formatDurationClock(totalSeconds)}`;
    }
    case REMINDER_TYPE.INTERVAL:
    default:
      return intervalLabel(reminder);
  }
}

// คืนค่ารายการ "นาทีของวัน" (0-1439) ที่ reminder ประเภทนี้ควรถูกปักหมุดแสดงบน timeline
// ใช้แสดงผลบน timeline โดยไม่สนใจว่า enabled/nextDueAt ถึงกำหนดหรือยัง (โชว์ทุกประเภทเสมอเวลาเลื่อนดู)
// - INTERVAL: ปักซ้ำทุก ๆ N นาที (จำกัดในช่วง window ถ้ามีกำหนด)
// - WEEKLY: ปักที่เวลาเดียวของวัน (เวลาเดิมทุกสัปดาห์ที่ตรงกับ days ที่เลือก)
// - ONCE_AT: ปักที่เวลาของวันนั้น เฉพาะกรณีเป็นวันเดียวกับวันนี้ (เพราะเป็น timeline วันเดียว)
// - COUNTDOWN: ปักที่เวลาสิ้นสุดของการนับถอยหลัง (ถ้าอยู่ในวันเดียวกับวันนี้)
// - STOPWATCH: จับเวลาต่อเนื่องไม่มีเวลาตายตัว จึงไม่ปักหมุดตามเวลาเช่นกัน (เหมือน EVENT_ANCHORED/ROUTINE)
// - EVENT_ANCHORED / ROUTINE: ไม่มีเวลาตายตัวในแต่ละวัน (ขึ้นกับ event ภายนอก) จึงไม่ปักหมุดตามเวลา
function getReminderTimeSlots(reminder, startOfTodayMs) {
  switch (reminder.type) {
    case REMINDER_TYPE.INTERVAL: {
      const stepMinutes = reminder.amount * (reminder.unit === "hours" ? 60 : 1);
      if (!stepMinutes || stepMinutes <= 0) return [];
      const slots = [];
      for (let m = 0; m < 1440; m += stepMinutes) {
        if (!hasWindow(reminder) || isMinuteWithinWindow(m, reminder.windowStart, reminder.windowEnd)) {
          slots.push(m);
        }
      }
      return slots;
    }
    case REMINDER_TYPE.WEEKLY: {
      if (!reminder.time) return [];
      return [minutesFromHHMM(reminder.time)];
    }
    case REMINDER_TYPE.ONCE_AT: {
      if (!reminder.atMs) return [];
      const dayStart = new Date(reminder.atMs);
      dayStart.setHours(0, 0, 0, 0);
      if (dayStart.getTime() !== startOfTodayMs) return [];
      return [minuteOfDayAt(reminder.atMs)];
    }
    case REMINDER_TYPE.COUNTDOWN: {
      if (!reminder.startedAt || !reminder.durationMs) return [];
      const endMs = reminder.startedAt + reminder.durationMs;
      const dayStart = new Date(endMs);
      dayStart.setHours(0, 0, 0, 0);
      if (dayStart.getTime() !== startOfTodayMs) return [];
      return [minuteOfDayAt(endMs)];
    }
    case REMINDER_TYPE.EVENT_ANCHORED:
    case REMINDER_TYPE.ROUTINE:
    case REMINDER_TYPE.STOPWATCH:
    default:
      return [];
  }
}

const ROW_HEIGHT_PX = 32;

export default function ReminderDashboard() {
  const [reminders, setReminders] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_REMINDERS;
    } catch {
      return DEFAULT_REMINDERS;
    }
  });

  const [dueReminders, setDueReminders] = useState([]);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);

  const [draft, setDraft] = useState({
    title: "",
    type: REMINDER_TYPE.INTERVAL,
    amount: "30",
    unit: "minutes",
    windowStart: "",
    windowEnd: "",
    atTime: "",
    atDate: "",
    countdownMinutes: "20",
    days: [1, 3, 5],
    time: "08:00",
    eventName: "",
    afterAmount: "2",
    afterUnit: "hours",
    routineSteps: "แปรงฟัน, ยืดตัว, กินวิตามิน"
  });

  const [editingId, setEditingId] = useState(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false); // composer เริ่มต้นแบบพับเก็บ ประหยัดพื้นที่
  const [nowTick, setNowTick] = useState(() => Date.now()); // อัปเดตทุกวินาที เพื่อให้ countdown แสดงเวลานับถอยหลังแบบ live

  const tapeScrollRef = useRef(null);
  const isUserInteractingRef = useRef(false);
  const idleTimeoutRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    const checkDue = () => {
      const now = Date.now();
      setNowTick(now); // อัปเดตเวลา "ตอนนี้" ทุกวินาที ให้ countdown บนการ์ด tick แบบ live
      const due = reminders.filter((r) => r.enabled && r.nextDueAt && r.nextDueAt <= now && r.type !== REMINDER_TYPE.ROUTINE && r.type !== REMINDER_TYPE.STOPWATCH);
      setDueReminders(due);
    };

    checkDue();
    const interval = setInterval(checkDue, 1000);
    return () => clearInterval(interval);
  }, [reminders]);

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
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // เตรียม slot เวลาของ reminder ทุกตัวไว้ล่วงหน้า (ไม่สนใจ enabled/nextDueAt)
    // เพื่อให้ทุกประเภทที่มีเวลาตายตัวในแต่ละวัน ถูกปักหมุดให้เห็นบน timeline เสมอเวลาเลื่อนดู
    const reminderSlots = reminders.map((r) => ({
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
  }, [reminders, minutesPerRow, totalRows]);

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

  useEffect(() => {
    const updateScroll = () => {
      if (tapeScrollRef.current && !isUserInteractingRef.current) {
        const targetScrollTop = calculateTargetScrollTop();
        tapeScrollRef.current.scrollTo({
          top: targetScrollTop,
          behavior: "smooth"
        });
      }
    };

    updateScroll();
    const intervalId = setInterval(updateScroll, 10000);
    return () => clearInterval(intervalId);
  }, [minutesPerRow, singleDayHeight]);

  const handleUserInteraction = () => {
    isUserInteractingRef.current = true;

    // เคลียร์ Timeout เก่าทิ้งก่อนทุกครั้งที่ขยับจอ
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    // ตั้งเวลาใหม่ 5 วินาที นับจากขยับครั้งสุดท้าย
    idleTimeoutRef.current = setTimeout(() => {
      isUserInteractingRef.current = false;
      if (tapeScrollRef.current) {
        const targetScrollTop = calculateTargetScrollTop();
        tapeScrollRef.current.scrollTo({
          top: targetScrollTop,
          behavior: "smooth"
        });
      }
    }, 5000);
  };

  const scheduleNext = (reminderId) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;
        if (isOneShotType(r.type)) return { ...r, enabled: false, nextDueAt: Infinity };
        return { ...r, nextDueAt: computeNextDueAt(r, Date.now()) };
      })
    );
  };

  const triggerAnchorEvent = (reminderId) => {
    const now = Date.now();
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;
        const updated = { ...r, lastTriggeredAt: now, enabled: true };
        return { ...updated, nextDueAt: computeNextDueAt(updated, now) };
      })
    );
  };

  const advanceRoutine = (reminderId) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;
        const nextIdx = (r.currentIndex || 0) + 1;
        if (nextIdx >= r.steps.length) {
          return { ...r, currentIndex: 0, enabled: false };
        }
        return { ...r, currentIndex: nextIdx };
      })
    );
  };

  // Start/Stop สำหรับ stopwatch โดยเฉพาะ (แยกจาก toggle() ทั่วไปเพราะ semantics ต่างกัน)
  // - Start: enabled=true, startedAt=ตอนนี้ (นับเวลาต่อจาก accumulatedMs เดิม)
  // - Stop: บวกเวลาที่ผ่านไปตั้งแต่ startedAt เข้ากับ accumulatedMs แล้วหยุด (enabled=false, startedAt=null)
  //   ทำให้กด Start ใหม่ได้และเวลานับต่อจากเดิมได้ ไม่รีเซ็ตทุกครั้งที่หยุด
  const toggleStopwatch = (reminderId) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId || r.type !== REMINDER_TYPE.STOPWATCH) return r;

        if (!r.enabled) {
          return { ...r, enabled: true, startedAt: Date.now() };
        }

        const elapsedSinceStart = r.startedAt ? Date.now() - r.startedAt : 0;
        return {
          ...r,
          enabled: false,
          accumulatedMs: (r.accumulatedMs || 0) + elapsedSinceStart,
          startedAt: null
        };
      })
    );
  };

  // รีเซ็ต stopwatch กลับเป็น 0 (หยุดด้วย ถ้ากำลังทำงานอยู่)
  const resetStopwatch = (reminderId) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId || r.type !== REMINDER_TYPE.STOPWATCH) return r;
        return { ...r, enabled: false, accumulatedMs: 0, startedAt: null };
      })
    );
  };

  const toggle = (reminderId) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== reminderId) return r;

        if (!r.enabled) {
          // Countdown ประเภทเดียวที่ "เปิดใหม่" ควรหมายถึงเริ่มนับใหม่ทั้งหมด
          // (ถ้าใช้ startedAt เดิม endMs จะเป็นอดีตไปแล้ว ทำให้ยิงแจ้งเตือนทันทีที่เปิด)
          if (r.type === REMINDER_TYPE.COUNTDOWN) {
            const restarted = { ...r, enabled: true, startedAt: Date.now() };
            return { ...restarted, nextDueAt: computeNextDueAt(restarted, Date.now()) };
          }

          // Once-at ที่เวลาผ่านไปแล้ว เปิดสวิตช์กลับไม่มีประโยชน์ (จะยิงทันที) ต้องให้ผู้ใช้แก้ไขวันที่/เวลาใหม่แทน
          if (r.type === REMINDER_TYPE.ONCE_AT && r.atMs && r.atMs <= Date.now()) {
            alert("เวลาที่ตั้งไว้ผ่านไปแล้ว กรุณาแก้ไขวันที่และเวลาใหม่ก่อนเปิดใช้งานอีกครั้ง");
            return r;
          }

          const nextDue = computeNextDueAt(r, Date.now());
          return { ...r, enabled: true, nextDueAt: nextDue };
        }
        return { ...r, enabled: false };
      })
    );
  };

  const toggleDayInDraft = (dayVal) => {
    setDraft((prev) => {
      const exists = prev.days.includes(dayVal);
      return {
        ...prev,
        days: exists ? prev.days.filter((d) => d !== dayVal) : [...prev.days, dayVal]
      };
    });
  };

  const saveReminder = (event) => {
    event.preventDefault();
    if (!draft.title.trim()) return;

    let newReminder = {
      id: editingId || `reminder-${Date.now()}`,
      title: draft.title,
      type: draft.type,
      enabled: true
    };

    if (draft.type === REMINDER_TYPE.INTERVAL) {
      newReminder.amount = parseInt(draft.amount) || 30;
      newReminder.unit = draft.unit;
      if (draft.windowStart && draft.windowEnd) {
        newReminder.windowStart = draft.windowStart;
        newReminder.windowEnd = draft.windowEnd;
      }
    } else if (draft.type === REMINDER_TYPE.WEEKLY) {
      newReminder.days = draft.days;
      newReminder.time = draft.time;
    } else if (draft.type === REMINDER_TYPE.EVENT_ANCHORED) {
      newReminder.eventName = draft.eventName || "เหตุการณ์หลัก";
      newReminder.afterAmount = parseInt(draft.afterAmount) || 1;
      newReminder.afterUnit = draft.afterUnit;
      newReminder.lastTriggeredAt = null;
      newReminder.enabled = false;
    } else if (draft.type === REMINDER_TYPE.ROUTINE) {
      newReminder.steps = draft.routineSteps.split(",").map((s) => s.trim()).filter(Boolean);
      newReminder.currentIndex = 0;
    } else if (draft.type === REMINDER_TYPE.ONCE_AT) {
      if (!draft.atDate || !draft.atTime) {
        alert("กรุณากำหนดวันที่และเวลา");
        return;
      }
      const atMs = new Date(`${draft.atDate}T${draft.atTime}:00`).getTime();
      newReminder.atMs = atMs;
    } else if (draft.type === REMINDER_TYPE.COUNTDOWN) {
      const minutes = parseInt(draft.countdownMinutes) || 20;
      const durationMs = minutes * 60 * 1000;
      newReminder.durationMs = durationMs;
      newReminder.startedAt = Date.now();
    } else if (draft.type === REMINDER_TYPE.STOPWATCH) {
      if (editingId) {
        // แก้ไข stopwatch ที่มีอยู่แล้ว (เช่น แก้แค่ชื่อ) ต้องคงเวลาที่จับไว้/สถานะ running เดิมไว้
        // ไม่รีเซ็ตกลับเป็น 0 หรือหยุดโดยไม่ตั้งใจ
        const existing = reminders.find((r) => r.id === editingId);
        newReminder.accumulatedMs = existing?.accumulatedMs || 0;
        newReminder.startedAt = existing?.startedAt || null;
        newReminder.enabled = existing?.enabled || false;
      } else {
        // สร้างใหม่แบบ "หยุดอยู่ที่ 0" ให้ผู้ใช้กด Start เองทีหลัง (ไม่ auto-run ตอนสร้าง)
        newReminder.accumulatedMs = 0;
        newReminder.startedAt = null;
        newReminder.enabled = false;
      }
    }

    newReminder.nextDueAt = computeNextDueAt(newReminder, Date.now());

    if (editingId) {
      setReminders((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...newReminder } : r)));
      setEditingId(null);
    } else {
      setReminders((prev) => [...prev, newReminder]);
    }

    setDraft({
      title: "",
      type: REMINDER_TYPE.INTERVAL,
      amount: "30",
      unit: "minutes",
      windowStart: "",
      windowEnd: "",
      atTime: "",
      atDate: "",
      countdownMinutes: "20",
      days: [1, 3, 5],
      time: "08:00",
      eventName: "",
      afterAmount: "2",
      afterUnit: "hours",
      routineSteps: "แปรงฟัน, ยืดตัว, กินวิตามิน"
    });
    setIsComposerOpen(false); // บันทึกเสร็จแล้วพับ composer กลับ คืนพื้นที่ให้ list
  };

  const deleteReminder = (reminderId) => {
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
  };

  const startEdit = (reminder) => {
    setIsComposerOpen(true); // แก้ไข reminder ต้องเปิด composer ให้เห็นฟอร์มด้วย
    setEditingId(reminder.id);
    setDraft({
      title: reminder.title,
      type: reminder.type,
      amount: String(reminder.amount || 30),
      unit: reminder.unit || "minutes",
      windowStart: reminder.windowStart || "",
      windowEnd: reminder.windowEnd || "",
      atTime: reminder.atMs ? new Date(reminder.atMs).toTimeString().slice(0, 5) : "",
      atDate: reminder.atMs ? toLocalDateInputValue(reminder.atMs) : "",
      countdownMinutes: reminder.durationMs ? String(reminder.durationMs / 60000) : "20",
      days: reminder.days || [1, 3, 5],
      time: reminder.time || "08:00",
      eventName: reminder.eventName || "",
      afterAmount: String(reminder.afterAmount || 2),
      afterUnit: reminder.afterUnit || "hours",
      routineSteps: reminder.steps ? reminder.steps.join(", ") : "แปรงฟัน, ยืดตัว, กินวิตามิน"
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraft({
      title: "",
      type: REMINDER_TYPE.INTERVAL,
      amount: "30",
      unit: "minutes",
      windowStart: "",
      windowEnd: "",
      atTime: "",
      atDate: "",
      countdownMinutes: "20",
      days: [1, 3, 5],
      time: "08:00",
      eventName: "",
      afterAmount: "2",
      afterUnit: "hours",
      routineSteps: "แปรงฟัน, ยืดตัว, กินวิตามิน"
    });
    setIsComposerOpen(false); // ยกเลิกแล้วพับ composer กลับ
  };

  const toggleComposer = () => {
    if (isComposerOpen) {
      // กำลังเปิดอยู่แล้วกดปุ่มซ้ำ = ปิด และล้าง draft/สถานะแก้ไขทิ้งไปด้วย
      cancelEditing();
    } else {
      setIsComposerOpen(true);
    }
  };

  const activeReminders = reminders.filter((r) => r.enabled);
  const pausedReminders = reminders.filter((r) => !r.enabled);

  const zoomOut = () => setZoomIndex(Math.max(0, zoomIndex - 1));
  const zoomIn = () => setZoomIndex(Math.min(ZOOM_LEVELS_MINUTES.length - 1, zoomIndex + 1));

  const renderReminder = (reminder) => (
    <div key={reminder.id} className={`reminder-card ${reminder.enabled ? "active" : ""}`}>
      <div className="reminder-type-icon">
        {reminder.type === REMINDER_TYPE.WEEKLY ? "📅" :
         reminder.type === REMINDER_TYPE.EVENT_ANCHORED ? "⚓" :
         reminder.type === REMINDER_TYPE.ROUTINE ? "📋" :
         reminder.type === REMINDER_TYPE.ONCE_AT ? "1x" : 
         reminder.type === REMINDER_TYPE.COUNTDOWN ? "⏱" :
         reminder.type === REMINDER_TYPE.STOPWATCH ? "⏱️" : "↻"}
      </div>
      <div className="reminder-info">
        <p className="title">{reminder.title}</p>
        <p className="meta">{describeReminder(reminder, nowTick)}</p>

        {reminder.type === REMINDER_TYPE.EVENT_ANCHORED && (
          <button type="button" className="btn-action-small" onClick={() => triggerAnchorEvent(reminder.id)}>
            ⚡ เริ่มเหตุการณ์ "{reminder.eventName}"
          </button>
        )}

        {reminder.type === REMINDER_TYPE.ROUTINE && reminder.enabled && (
          <button type="button" className="btn-action-small" onClick={() => advanceRoutine(reminder.id)}>
            ✓ ทำเสร็จแล้ว ({reminder.steps[reminder.currentIndex]})
          </button>
        )}
      </div>

      {reminder.type === REMINDER_TYPE.STOPWATCH ? (
        // Stopwatch ใช้ปุ่ม Start/Stop (+ Reset) แทน toggle switch ทั่วไป เพราะไม่ใช่ enable/disable
        // แบบ on-off เฉย ๆ แต่มี semantics ของการนับเวลาสะสมที่ต้องจัดการเฉพาะ
        <div className="stopwatch-controls">
          <button type="button" className={`btn-stopwatch ${reminder.enabled ? "stop" : "start"}`} onClick={() => toggleStopwatch(reminder.id)}>
            {reminder.enabled ? "⏸ Stop" : "▶ Start"}
          </button>
          <button type="button" className="icon-btn" onClick={() => resetStopwatch(reminder.id)} title="รีเซ็ตเป็น 0">
            ↺
          </button>
        </div>
      ) : (
        <button type="button" className={`toggle-switch ${reminder.enabled ? "on" : ""}`} onClick={() => toggle(reminder.id)} aria-label="สวิตช์เปิดปิด" />
      )}

      <div className="reminder-card-actions">
        <button type="button" className="icon-btn" onClick={() => startEdit(reminder)} title="แก้ไข">
          ✏️
        </button>
        <button type="button" className="icon-btn" onClick={() => deleteReminder(reminder.id)} title="ลบ">
          🗑️
        </button>
      </div>
    </div>
  );

  return (
    <div className="reminder-app-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@400;500&family=Roboto+Mono:wght@500&display=swap');

        * { box-sizing: border-box; }
        
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
        }

        .reminder-app-container {
          --g-blue: #1a73e8;
          --g-blue-hover: #1557b0;
          --g-blue-light: #e8f0fe;
          --g-red: #ea4335;
          --g-yellow: #fbbc04;
          --g-green: #34a853;
          --g-surface: #ffffff;
          --g-background: #f8f9fa;
          --g-on-surface: #202124;
          --g-on-surface-variant: #5f6368;
          --g-outline: #dadce0;
          --g-outline-variant: #e8eaed;
          
          font-family: 'Google Sans', 'Roboto', -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-height: 100vh;
          background-color: var(--g-background);
          color: var(--g-on-surface);
          overflow: hidden;
        }

        .due-alert-banner {
          background: #fce8e6;
          border-bottom: 1px solid #f5c6cb;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #c5221f;
          font-size: 14px;
          font-weight: 500;
          flex-shrink: 0;
        }

        .due-alert-actions {
          display: flex;
          gap: 8px;
        }

        .btn-snooze {
          background: #ffffff;
          border: 1px solid #f5c6cb;
          color: #c5221f;
          padding: 6px 14px;
          border-radius: 18px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }

        .btn-snooze:hover {
          background: #fce8e6;
        }

        .dashboard-body {
          display: grid;
          grid-template-columns: 380px 1fr;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          padding: 16px;
          gap: 16px;
        }

        .timeline-panel {
          background: var(--g-surface);
          border-radius: 16px;
          border: 1px solid var(--g-outline);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          box-shadow: 0 1px 3px rgba(60,64,67,0.08);
          height: 100%;
        }

        .timeline-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--g-outline-variant);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          background: var(--g-surface);
          z-index: 20;
        }

        .timeline-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--g-on-surface-variant);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0;
        }

        .zoom-controls {
          display: flex;
          align-items: center;
          gap: 4px;
          background: var(--g-background);
          border-radius: 20px;
          padding: 2px 8px;
          border: 1px solid var(--g-outline);
        }

        .zoom-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: var(--g-on-surface-variant);
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .zoom-btn:disabled {
          opacity: 0.3;
          cursor: default;
        }

        .zoom-btn:not(:disabled):hover {
          background: var(--g-outline-variant);
        }

        .zoom-display {
          font-size: 12px;
          font-weight: 500;
          color: var(--g-on-surface);
          min-width: 65px;
          text-align: center;
        }

        .timeline-viewport {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .now-indicator {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          height: 2px;
          background: var(--g-red);
          z-index: 15;
          pointer-events: none;
        }

        .now-indicator::before {
          content: "";
          position: absolute;
          left: 54px;
          top: -4px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--g-red);
        }

        .tape-scroll-container {
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          will-change: scroll-position;
          transform: translateZ(0);
          overscroll-behavior: contain;
        }

        .tape-track-wrapper {
          position: relative;
        }

        .tape-spacer {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .time-row {
          position: relative;
          border-bottom: 1px solid var(--g-outline-variant);
          padding-left: 12px;
          display: flex;
          align-items: center;
          user-select: none;
        }

        .time-row.major-hour {
          border-bottom-color: var(--g-outline);
          background-color: rgba(248, 249, 250, 0.6);
        }

        .time-label {
          flex: 0 0 60px;
          font-family: 'Roboto Mono', monospace;
          font-size: 11px;
          color: var(--g-on-surface-variant);
          text-align: right;
          margin-right: 12px;
        }

        .time-row.major-hour .time-label {
          font-weight: 700;
          color: var(--g-blue);
        }

        .event-chip-group {
          position: absolute;
          left: 84px;
          right: 8px;
          top: 3px;
          display: flex;
          align-items: center;
          gap: 4px;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
        }

        .event-chip-group::-webkit-scrollbar {
          display: none;
        }

        .event-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          background: var(--g-blue-light);
          color: var(--g-blue-hover);
          padding: 3px 10px;
          border-radius: 6px;
          white-space: nowrap;
          flex-shrink: 0;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }

        .event-chip.disabled {
          background: var(--g-outline-variant);
          color: var(--g-on-surface-variant);
        }

        .chip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--g-blue);
          flex-shrink: 0;
        }

        .event-chip.disabled .chip-dot {
          background: var(--g-on-surface-variant);
        }

        .main-panel {
          background: var(--g-surface);
          border-radius: 16px;
          border: 1px solid var(--g-outline);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(60,64,67,0.08);
          height: 100%;
          min-height: 0;
        }

        .main-panel-toolbar {
          padding: 14px 16px;
          border-bottom: 1px solid var(--g-outline-variant);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .main-panel-toolbar h2 {
          font-size: 20px;
          font-weight: 500;
          margin: 0 0 4px 0;
        }

        .toolbar-subtitle {
          font-size: 13px;
          color: var(--g-on-surface-variant);
          margin: 0;
        }

        .add-reminder-btn {
          background: var(--g-blue-light);
          color: var(--g-blue);
          border: none;
          padding: 10px 20px;
          border-radius: 24px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .add-reminder-btn:hover {
          background: #d2e3fc;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }

        .add-reminder-btn.is-open {
          background: var(--g-outline-variant);
          color: var(--g-on-surface-variant);
        }

        .add-reminder-btn-icon {
          display: inline-block;
          transition: transform 0.15s;
        }

        .add-reminder-btn.is-open .add-reminder-btn-icon {
          transform: rotate(45deg);
        }

        .reminders-scroll-area {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .section-header {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.8px;
          color: var(--g-on-surface-variant);
          text-transform: uppercase;
          margin: 4px 0 0 4px;
          position: sticky;
          top: 0;
          background: var(--g-surface);
          padding: 4px 0;
          z-index: 1;
        }

        .empty-state {
          font-size: 13px;
          color: var(--g-on-surface-variant);
          text-align: center;
          padding: 32px 16px;
          margin: 0;
        }

        .reminder-card {
          display: grid;
          grid-template-columns: 28px 1fr auto auto;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid var(--g-outline-variant);
          background: var(--g-surface);
          transition: all 0.2s ease;
        }

        .reminder-card:hover {
          border-color: var(--g-outline);
          box-shadow: 0 2px 6px rgba(60,64,67,0.08);
        }

        .reminder-card.active {
          background: #fef7e0;
          border-color: #fde293;
        }

        .reminder-type-icon {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--g-background);
          color: var(--g-on-surface-variant);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 11px;
          flex-shrink: 0;
        }

        .active .reminder-type-icon {
          background: var(--g-yellow);
          color: #202124;
        }

        .reminder-info {
          min-width: 0;
        }

        .reminder-info .title {
          font-size: 13.5px;
          font-weight: 500;
          margin: 0;
          color: var(--g-on-surface);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .reminder-info .meta {
          font-size: 12px;
          color: var(--g-on-surface-variant);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn-action-small {
          margin-top: 4px;
          background: var(--g-blue-light);
          color: var(--g-blue-hover);
          border: none;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 500;
        }

        .day-selector { display: flex; gap: 6px; margin-top: 6px; }
        .day-btn {
          width: 32px; height: 32px;
          border-radius: 50%;
          border: 1px solid var(--g-outline);
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        }
        .day-btn.selected { background: var(--g-blue); color: white; border-color: var(--g-blue); }

        .toggle-switch {
          width: 36px;
          height: 20px;
          border-radius: 10px;
          background: #bdc1c6;
          border: none;
          position: relative;
          cursor: pointer;
          transition: background 0.2s;
          flex-shrink: 0;
        }

        .toggle-switch.on {
          background: var(--g-blue);
        }

        .toggle-switch::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          transition: transform 0.2s;
        }

        .toggle-switch.on::after {
          transform: translateX(16px);
        }

        .stopwatch-controls {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .btn-stopwatch {
          font-family: inherit;
          font-size: 12px;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          white-space: nowrap;
        }

        .btn-stopwatch.start {
          background: var(--g-blue-light);
          color: var(--g-blue-hover);
        }

        .btn-stopwatch.start:hover {
          background: #d2e3fc;
        }

        .btn-stopwatch.stop {
          background: #fce8e6;
          color: #c5221f;
        }

        .btn-stopwatch.stop:hover {
          background: #fad2cf;
        }

        .form-hint {
          font-size: 12px;
          color: var(--g-on-surface-variant);
          margin: 0 0 12px 0;
          line-height: 1.5;
        }

        .reminder-card-actions {
          display: flex;
          gap: 2px;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .reminder-card:hover .reminder-card-actions,
        .reminder-card:focus-within .reminder-card-actions {
          opacity: 1;
        }

        .icon-btn {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          flex-shrink: 0;
        }

        .icon-btn:hover {
          background: var(--g-outline-variant);
        }

        .composer-card {
          border: 1px solid var(--g-outline);
          border-radius: 12px;
          padding: 14px;
          background: var(--g-background);
          flex-shrink: 0;
          animation: composer-expand 0.15s ease;
        }

        @keyframes composer-expand {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .form-field {
          margin-bottom: 10px;
        }

        .form-field label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--g-on-surface-variant);
          margin-bottom: 6px;
        }

        .form-input, .form-select {
          width: 100%;
          font-family: inherit;
          font-size: 14px;
          padding: 8px 12px;
          border: 1px solid var(--g-outline);
          border-radius: 8px;
          background: var(--g-surface);
          color: var(--g-on-surface);
          outline: none;
          transition: border-color 0.2s;
        }

        .form-input:focus, .form-select:focus {
          border-color: var(--g-blue);
          box-shadow: 0 0 0 1px var(--g-blue);
        }

        .composer-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .freq-inline-group {
          display: flex;
          gap: 8px;
        }

        .freq-inline-group input {
          width: 80px;
        }

        .composer-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 14px;
        }

        .btn-text {
          background: transparent;
          border: none;
          color: var(--g-blue);
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
        }

        .btn-text:hover {
          background: var(--g-blue-light);
        }

        .btn-contained {
          background: var(--g-blue);
          border: none;
          color: white;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 20px;
          border-radius: 20px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-contained:hover {
          background: var(--g-blue-hover);
        }

        @media (max-width: 900px) {
          .dashboard-body {
            grid-template-columns: 1fr;
            overflow-y: auto;
          }
          .timeline-panel {
            min-height: 360px;
          }
        }
      `}</style>

      {/* Alert Banner */}
      {dueReminders.length > 0 && (
        <div className="due-alert-banner" role="alert">
          <span>🔔 ถึงเวลาแล้ว: {dueReminders.map((r) => r.title).join(", ")}</span>
          <div className="due-alert-actions">
            {dueReminders.map((r) => (
              <button key={r.id} className="btn-snooze" onClick={() => scheduleNext(r.id)}>
                เตือนอีกครั้ง ({r.title})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Body Grid */}
      <div className="dashboard-body">
        {/* Timeline Section */}
        <aside className="timeline-panel">
          <div className="timeline-header">
            <p className="timeline-title">Timeline 24 ชม.</p>
            <div className="zoom-controls">
              <button type="button" className="zoom-btn" onClick={zoomOut} disabled={zoomIndex === 0} title="ซูมออก">−</button>
              <span className="zoom-display">{minutesPerRow} นาที/ช่อง</span>
              <button type="button" className="zoom-btn" onClick={zoomIn} disabled={zoomIndex === ZOOM_LEVELS_MINUTES.length - 1} title="ซูมเข้า">+</button>
            </div>
          </div>

          <div className="timeline-viewport">
            <div className="now-indicator" />

            <div
              className="tape-scroll-container"
              ref={tapeScrollRef}
              onScroll={handleUserInteraction}
              onWheel={handleUserInteraction}
              onTouchMove={handleUserInteraction}
            >
              <div className="tape-track-wrapper">
                {/* Spacer บน: ยืดขอบออกจากแถว 00:00 ไม่ให้ now-indicator ชนขอบ container
                    เป็น slot เปิดไว้ เผื่อใส่ content อื่นในอนาคต (เช่น แบนเนอร์/โฆษณา) */}
                <div className="tape-spacer tape-spacer-top" style={{ height: `${SPACER_HEIGHT_PX}px` }}>
                  {/* TODO: ใส่ content เพิ่มเติมได้ที่นี่ในอนาคต เช่น <AdSlot position="timeline-top" /> */}
                </div>

                {tapeRows.map(({ key, isMajor, label, flags }) => (
                  <div key={key} className={`time-row${isMajor ? " major-hour" : ""}`} style={{ height: `${ROW_HEIGHT_PX}px` }}>
                    <span className="time-label">{label}</span>
                    {flags.length > 0 && (
                      <span className="event-chip-group">
                        {flags.map((r) => (
                          <span key={r.id} className={`event-chip${r.enabled ? "" : " disabled"}`} title={`${r.title} · ${describeReminder(r, nowTick)}`}>
                            <span className="chip-dot" />{r.title}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ))}

                {/* Spacer ล่าง: ยืดขอบออกจากแถว 24:00 ไม่ให้ now-indicator ชนขอบ container
                    เป็น slot เปิดไว้ เผื่อใส่ content อื่นในอนาคตเช่นกัน */}
                <div className="tape-spacer tape-spacer-bottom" style={{ height: `${SPACER_HEIGHT_PX}px` }}>
                  {/* TODO: ใส่ content เพิ่มเติมได้ที่นี่ในอนาคต เช่น <AdSlot position="timeline-bottom" /> */}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Reminders Dashboard */}
        <section className="main-panel">
          <div className="main-panel-toolbar">
            <div>
              <h2>การแจ้งเตือนทั้งหมด</h2>
              <p className="toolbar-subtitle">{reminders.length} รายการ · กำลังทำงาน {activeReminders.length} รายการ</p>
            </div>
            {/* พื้นที่เผื่อฟีเจอร์ใหม่ในอนาคต เช่น filter chip / tab เพิ่มเติม วางต่อจากนี้ได้โดยไม่ดันความสูง toolbar */}
            <button type="button" className={`add-reminder-btn ${isComposerOpen ? "is-open" : ""}`} onClick={toggleComposer}>
              <span className="add-reminder-btn-icon">+</span> {isComposerOpen ? "ปิดฟอร์ม" : "เพิ่ม Reminder"}
            </button>
          </div>

          <div className="reminders-scroll-area">
            {/* Composer แบบ inline expand/collapse: พับเก็บเป็นค่าเริ่มต้นเพื่อประหยัดพื้นที่
                เมื่อกด "เพิ่ม Reminder" หรือกด "แก้ไข" การ์ดใดการ์ดหนึ่ง จะดันลงมาแสดงแทนที่ */}
            {isComposerOpen && (
              <form className="composer-card" onSubmit={saveReminder}>
              <div className="form-field">
                <label htmlFor="reminder-title">ชื่อการแจ้งเตือน</label>
                <input id="reminder-title" className="form-input" value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="เช่น พักสายตา 5 นาที" />
              </div>

              <div className="form-field">
                <label htmlFor="reminder-type">ประเภทการเตือน</label>
                <select id="reminder-type" className="form-select" value={draft.type} onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value={REMINDER_TYPE.INTERVAL}>เตือนวนลูปเป็นรอบ (Interval)</option>
                  <option value={REMINDER_TYPE.WEEKLY}>เกิดซ้ำตามวันในสัปดาห์ (Weekly Days)</option>
                  <option value={REMINDER_TYPE.EVENT_ANCHORED}>ผูกกับเหตุการณ์ (Event-Anchored)</option>
                  <option value={REMINDER_TYPE.ROUTINE}>ชุดงานต่อเนื่อง (Checklist/Routine)</option>
                  <option value={REMINDER_TYPE.ONCE_AT}>เตือนครั้งเดียว ตามวันที่/เวลา (Once)</option>
                  <option value={REMINDER_TYPE.COUNTDOWN}>นับถอยหลัง (Timer)</option>
                  <option value={REMINDER_TYPE.STOPWATCH}>จับเวลา (Stopwatch)</option>
                </select>
              </div>

              {draft.type === REMINDER_TYPE.INTERVAL && (
                <>
                  <div className="form-field">
                    <label htmlFor="reminder-amount">ความถี่</label>
                    <div className="freq-inline-group">
                      <input id="reminder-amount" className="form-input" type="number" min="1" value={draft.amount} onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))} />
                      <select className="form-select" value={draft.unit} onChange={(e) => setDraft((prev) => ({ ...prev, unit: e.target.value }))}>
                        <option value="minutes">นาที</option>
                        <option value="hours">ชั่วโมง</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>ช่วงเวลาที่ทำงาน (Optional)</label>
                    <div className="composer-row">
                      <input className="form-input" type="time" value={draft.windowStart} onChange={(e) => setDraft((prev) => ({ ...prev, windowStart: e.target.value }))} />
                      <input className="form-input" type="time" value={draft.windowEnd} onChange={(e) => setDraft((prev) => ({ ...prev, windowEnd: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              {draft.type === REMINDER_TYPE.WEEKLY && (
                <>
                  <div className="form-field">
                    <label>เลือกวันในสัปดาห์</label>
                    <div className="day-selector">
                      {DAYS_OF_WEEK.map((d) => (
                        <button key={d.value} type="button" className={`day-btn ${draft.days.includes(d.value) ? "selected" : ""}`} onClick={() => toggleDayInDraft(d.value)}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-field">
                    <label>เวลาแจ้งเตือน</label>
                    <input className="form-input" type="time" value={draft.time} onChange={(e) => setDraft((prev) => ({ ...prev, time: e.target.value }))} />
                  </div>
                </>
              )}

              {draft.type === REMINDER_TYPE.EVENT_ANCHORED && (
                <>
                  <div className="form-field">
                    <label>อ้างอิงจากเหตุการณ์</label>
                    <input className="form-input" value={draft.eventName} onChange={(e) => setDraft((prev) => ({ ...prev, eventName: e.target.value }))} placeholder="เช่น กินยาแก้ปวด" />
                  </div>
                  <div className="form-field">
                    <label>ระยะเวลาหลังจากเกิดเหตุการณ์</label>
                    <div className="freq-inline-group">
                      <input className="form-input" type="number" min="1" value={draft.afterAmount} onChange={(e) => setDraft((prev) => ({ ...prev, afterAmount: e.target.value }))} />
                      <select className="form-select" value={draft.afterUnit} onChange={(e) => setDraft((prev) => ({ ...prev, afterUnit: e.target.value }))}>
                        <option value="minutes">นาที</option>
                        <option value="hours">ชั่วโมง</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {draft.type === REMINDER_TYPE.ROUTINE && (
                <div className="form-field">
                  <label>รายการขั้นตอน (คั่นด้วยเครื่องหมายจุลภาค ,)</label>
                  <input className="form-input" value={draft.routineSteps} onChange={(e) => setDraft((prev) => ({ ...prev, routineSteps: e.target.value }))} placeholder="เช่น แปรงฟัน, ยืดตัว, กินวิตามิน" />
                </div>
              )}

              {draft.type === REMINDER_TYPE.ONCE_AT && (
                <div className="composer-row form-field">
                  <div>
                    <label htmlFor="at-date">วันที่</label>
                    <input id="at-date" className="form-input" type="date" value={draft.atDate} onChange={(e) => setDraft((prev) => ({ ...prev, atDate: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="at-time">เวลา</label>
                    <input id="at-time" className="form-input" type="time" value={draft.atTime} onChange={(e) => setDraft((prev) => ({ ...prev, atTime: e.target.value }))} />
                  </div>
                </div>
              )}

              {draft.type === REMINDER_TYPE.COUNTDOWN && (
                <div className="form-field">
                  <label htmlFor="countdown-minutes">ระยะเวลา (นาที)</label>
                  <input id="countdown-minutes" className="form-input" type="number" min="1" max="1440" value={draft.countdownMinutes} onChange={(e) => setDraft((prev) => ({ ...prev, countdownMinutes: e.target.value }))} />
                </div>
              )}

              {draft.type === REMINDER_TYPE.STOPWATCH && (
                <p className="form-hint">จับเวลานับขึ้นเรื่อย ๆ ไม่มีการแจ้งเตือน กด Start/Stop ได้จากการ์ดหลังสร้างเสร็จ</p>
              )}

              <div className="composer-actions">
                <button className="btn-text" type="button" onClick={cancelEditing}>ยกเลิก</button>
                <button className="btn-contained" type="submit">
                  {editingId ? "บันทึกการแก้ไข" : "สร้าง Reminder"}
                </button>
              </div>
              </form>
            )}

            {activeReminders.length > 0 && (
              <>
                <p className="section-header">กำลังทำงาน</p>
                {activeReminders.map(renderReminder)}
              </>
            )}

            {pausedReminders.length > 0 && (
              <>
                <p className="section-header">ปิดใช้งาน</p>
                {pausedReminders.map(renderReminder)}
              </>
            )}

            {reminders.length === 0 && !isComposerOpen && (
              <p className="empty-state">ยังไม่มีการแจ้งเตือน กด "เพิ่ม Reminder" เพื่อเริ่มต้น</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}