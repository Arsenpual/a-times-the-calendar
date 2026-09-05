import React, { useState, useRef, useEffect } from "react";
import {
  toDateInputValue,
  toTimeInputValue,
  combineDateAndTime,
  activityDate
} from "../date-utils.js";
import {
  defaultRepeatState,
  parseRRule,
  buildRRule,
  describeRepeat,
  isRuleEditable,
  RRULE_WEEKDAYS
} from "../rrule-utils.js";
import { normalizeActivityId } from "../id-utils.js";

const WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// ปิดฟังก์ชัน "ทำซ้ำไม่มีวันสิ้นสุด" ไว้ก่อน + จำกัดจำนวนครั้งสูงสุดที่ทำซ้ำ
// ได้ (ดู normalizeRepeatState ด้านล่าง และ defaultRepeatState/parseRRule ใน
// rrule-utils.js ที่ปรับ default ให้สอดคล้องกัน)
const MAX_REPEAT_COUNT = 20;

/**
 * บังคับ RepeatState ที่ได้จาก defaultRepeatState()/parseRRule() ให้ไม่ตกไป
 * อยู่ในสถานะที่ถูกปิดใช้งานแล้ว — สองกรณีที่ต้องกันไว้:
 *   1. end === "never" (ฟังก์ชัน "ไม่มีวันสิ้นสุด" ถูกปิดไว้ก่อน) → fallback
 *      เป็น "count" พร้อม count เริ่มต้นที่ปลอดภัย (ไม่เกิน MAX_REPEAT_COUNT)
 *   2. count > MAX_REPEAT_COUNT (เช่น กิจกรรมเก่าที่เคยตั้งไว้เกิน 20 ครั้ง
 *      ก่อนจะมีข้อจำกัดนี้) → clamp ลงมาไม่ให้เกิน
 * ทำที่นี่อีกชั้นเพื่อความปลอดภัย แม้ rrule-utils.js จะปรับ default ให้แล้ว
 * ก็ตาม เผื่อกรณี recurrence ของกิจกรรมจริงมี COUNT สูงกว่าที่ UI นี้อนุญาต
 */
function normalizeRepeatState(state) {
  if (state.end === "never") {
    return { ...state, end: "count", count: Math.min(state.count || 12, MAX_REPEAT_COUNT) };
  }
  if (state.end === "count" && state.count > MAX_REPEAT_COUNT) {
    return { ...state, count: MAX_REPEAT_COUNT };
  }
  return state;
}

// เฉดสีให้เลือกตอนสร้างหมวดหมู่ชีวิตใหม่ เพราะสีของกิจกรรมทั้งหมดต้องมา
// จากหมวดหมู่เท่านั้น ทุกค่าเป็น hex 6 หลักตรงตามที่ backend ตรวจสอบ
// (ดู HEX_COLOR_RE ใน routes/categories.js)
const CATEGORY_COLOR_SWATCHES = [
  "#1557B0", "#0B6B33", "#B71C1C", "#F29900", "#6A1B9A",
  "#D84315", "#0277BD", "#237B4B", "#C0392B", "#303F9F",
  "#00838F", "#AD1457", "#5D4037", "#424242", "#7CB342"
];

/**
 * Modal for creating or editing a Google Calendar activity, with life-area
 * category assignment. Used for two-way sync (Phase 2): saving here writes
 * straight back to Google Calendar via the parent's onSave handler.
 *
 * Phase 3 additions:
 * - Recurring events via RRULE, built client-side and handed to Google
 *   Calendar as-is in the event's `recurrence` field — we never store or
 *   expand occurrences ourselves. Editing the repeat rule of an *existing*
 *   recurring event isn't supported yet (see isRuleEditable below); the
 *   repeat section is hidden in that case rather than risk silently
 *   corrupting a series we can't fully round-trip.
 * - Collapsible notes/description field (Google event `description`).
 *
 * Conflict handling: if the activity was changed elsewhere (directly in
 * Google Calendar, say) after this form was opened, the parent's onSave
 * still overwrites it — this form just passes along `knownUpdated` so the
 * parent can detect that case and show a warning after saving, rather than
 * blocking the save with a confirm dialog.
 *
 * @param {Date} defaultDate day/time to prefill when creating a brand-new activity
 * @param {Date|null} defaultEnd optional snapped end time for a newly created activity
 * @param {object|null} initialActivity existing Google Calendar activity when editing, null when creating
 */
export default function ActivityModal({
  open,
  defaultDate,
  defaultEnd,
  defaultTitle = "",
  initialWarning = "",
  missingFields = [],
  initialActivity,
  activities,
  archivedActivityIds = new Set(),
  categories,
  activityCategoryMap,
  activityTagMap,
  onCreateCategory,
  onDeleteCategory,
  onSave,
  onDelete,
  onSyncGoogleCalendar,
  googleCalendarSyncing = false,
  onGenerateAiDraft,
  onClose
}) {
  const isEditing = !!initialActivity;

  const initialStart = initialActivity ? activityDate(initialActivity.start) : defaultDate || new Date();
  const initialEnd = initialActivity
    ? activityDate(initialActivity.end)
    : defaultEnd || new Date((defaultDate || new Date()).getTime() + 60 * 60000);

  const [title, setTitle] = useState(initialActivity?.summary || defaultTitle);
  // When the modal was opened from an incomplete archive entry, leave the
  // missing value genuinely blank (rather than silently filling "now") so
  // the red required-field treatment points at the real missing data.
  const [date, setDate] = useState(missingFields.includes("start") ? "" : toDateInputValue(initialStart));
  const [endDate, setEndDate] = useState(missingFields.includes("end") ? "" : toDateInputValue(initialEnd));
  const [startTime, setStartTime] = useState(missingFields.includes("start") ? "" : toTimeInputValue(initialStart));
  const [endTime, setEndTime] = useState(missingFields.includes("end") ? "" : toTimeInputValue(initialEnd));

  const [categoryId, setCategoryId] = useState(
    (initialActivity && activityCategoryMap[normalizeActivityId(initialActivity.id)]) || ""
  );

  // Tag แบบพิมพ์เอง (free text) — เก็บเป็น array ของ string, พิมพ์แล้วกด
  // Enter/comma เพื่อเพิ่มเป็น chip ลบออกได้ทีละอัน ต่างจาก category ตรงที่
  // ผูกได้หลายอันพร้อมกัน (many-to-many) และไม่ต้องสร้างไว้ก่อนใน list ใดๆ
  const [tags, setTags] = useState(
    (initialActivity && activityTagMap?.[normalizeActivityId(initialActivity.id)]) || []
  );
  const [tagDraft, setTagDraft] = useState("");
  const TAG_MAX_LENGTH = 40;
  const TAGS_MAX_COUNT = 20;

  const addTagFromDraft = () => {
    const trimmed = tagDraft.trim();
    setTagDraft("");
    if (!trimmed || trimmed.length > TAG_MAX_LENGTH) return;
    setTags((prev) => {
      if (prev.length >= TAGS_MAX_COUNT) return prev;
      const key = trimmed.toLowerCase();
      if (prev.some((t) => t.toLowerCase() === key)) return prev; // กันซ้ำ
      return [...prev, trimmed];
    });
  };

  const removeTag = (tagToRemove) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTagFromDraft();
    } else if (e.key === "Backspace" && tagDraft === "" && tags.length > 0) {
      // Backspace บนช่องว่าง ลบ tag ล่าสุดทิ้ง — พฤติกรรมเดียวกับ chip-input ทั่วไป
      setTags((prev) => prev.slice(0, -1));
    }
  };

  // แบบฟอร์มสร้างหมวดหมู่ใหม่แบบ inline — เปิด/ปิดด้วย dropdown ตัวเลือก
  // "+ สร้างหมวดหมู่ใหม่" ในช่อง "หมวดหมู่" ด้านล่าง แยก error/saving state
  // ของตัวเองออกจากฟอร์มกิจกรรมหลัก เพื่อไม่ให้การพิมพ์ชื่อหมวดหมู่ผิดพลาด
  // ไปบล็อกการบันทึกกิจกรรมทั้งฟอร์ม
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLOR_SWATCHES[0]);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState(null);

  // ช่องหมวดหมู่ใช้ custom dropdown (ไม่ใช่ native <select>) เพราะต้องใส่ปุ่ม
  // ลบต่อท้ายแต่ละแถวได้ — <option> ของ native select ใส่ปุ่มไม่ได้
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null); // กำลังลบอันไหนอยู่ (disable ปุ่มระหว่างรอ)
  const categoryFieldRef = useRef(null);

  // ปิด dropdown เมื่อคลิกข้างนอกกล่อง — native <select> ปิดเองเมื่อคลิกที่
  // อื่นอยู่แล้ว แต่ custom dropdown นี้ต้องจัดการเอง มิฉะนั้นจะค้างเปิดคาไว้
  // เวลาผู้ใช้ไปกรอกช่องอื่นในฟอร์มต่อ
  useEffect(() => {
    if (!categoryDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (categoryFieldRef.current && !categoryFieldRef.current.contains(e.target)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [categoryDropdownOpen]);

  // Repeat rule is only editable for brand-new activities, or existing ones
  // whose recurrence we can fully represent in this simple UI (see
  // isRuleEditable) — otherwise we hide the section entirely rather than
  // show a form that can't round-trip the real rule.
  const recurrenceEditable = !isEditing || isRuleEditable(initialActivity.recurrence);
  const rawInitialRepeat = isEditing
    ? parseRRule(initialActivity.recurrence, initialStart)
    : defaultRepeatState(initialStart);
  // แจ้งเตือนถ้ากิจกรรมเก่าจริงๆ เป็น "ไม่มีวันสิ้นสุด" (ก่อนถูก
  // normalizeRepeatState แปลงเงียบๆ เป็น "หลังจาก 12 ครั้ง") — ผู้ใช้ต้องรู้
  // ว่าถ้ากด "แก้ไข" (แม้แค่เปลี่ยนชื่อ) recurrence ของกิจกรรมจริงจะถูก
  // เปลี่ยนจาก "ไม่มีวันสิ้นสุด" เป็น "จบใน 12 ครั้ง" ไปด้วย ไม่ใช่แค่ UI
  const wasUnlimitedRepeat = isEditing && rawInitialRepeat.end === "never";
  const [repeat, setRepeat] = useState(() => normalizeRepeatState(rawInitialRepeat));

  const [notesOpen, setNotesOpen] = useState(!!initialActivity?.description);
  const [notes, setNotes] = useState(initialActivity?.description || "");

  const [saving, setSaving] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [formError, setFormError] = useState(initialWarning || null);
  const [remainingRequiredFields, setRemainingRequiredFields] = useState(missingFields);
  // Editing an existing event must never unexpectedly rewrite its end time.
  // This only becomes true after that editor has deliberately cleared both
  // date/time values, which turns it into a fresh time assignment.
  const [editingTimesCleared, setEditingTimesCleared] = useState(false);

  const dateTimeValue = (dateValue, timeValue) => dateValue && timeValue ? `${dateValue}T${timeValue}` : "";
  const updateDateTime = (kind, value) => {
    const [nextDate = "", nextTime = ""] = value.split("T");
    const shouldAutoSetEnd = !isEditing || missingFields.length > 0 || editingTimesCleared;
    if (kind === "start") {
      setDate(nextDate);
      setStartTime(nextTime);
      if (value && shouldAutoSetEnd) {
        const start = new Date(value);
        if (!Number.isNaN(start.getTime())) {
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          setEndDate(toDateInputValue(end));
          setEndTime(toTimeInputValue(end));
          setRemainingRequiredFields((current) => current.filter((field) => field !== "end"));
          setEditingTimesCleared(false);
        }
      }
    } else {
      setEndDate(nextDate);
      setEndTime(nextTime);
    }
    setRemainingRequiredFields((current) => current.filter((field) => field !== kind));
    if (!value) {
      const otherIsEmpty = kind === "start"
        ? !endDate && !endTime
        : !date && !startTime;
      if (otherIsEmpty) setEditingTimesCleared(true);
    }
  };

  const normalizeAiDateTime = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    // Gemini occasionally returns valid ISO with seconds (or an explicit
    // offset) despite being asked for YYYY-MM-DDTHH:mm. Keep calendar time
    // correct instead of rejecting an otherwise usable AI draft.
    const plainMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/);
    if (plainMatch) return `${plainMatch[1]}T${plainMatch[2]}`;
    const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed) ? new Date(trimmed) : null;
    if (withZone && !Number.isNaN(withZone.getTime())) {
      return `${toDateInputValue(withZone)}T${toTimeInputValue(withZone)}`;
    }
    return null;
  };

  const applyAiDateTime = (kind, value) => {
    const normalized = normalizeAiDateTime(value);
    if (!normalized) return false;
    const [nextDate, nextTime] = normalized.split("T");
    if (kind === "start") {
      setDate(nextDate);
      setStartTime(nextTime);
    } else {
      setEndDate(nextDate);
      setEndTime(nextTime);
    }
    return true;
  };

  const handleAiDraft = async () => {
    if (!onGenerateAiDraft || isEditing) return;
    const request = window.prompt("อธิบายกิจกรรม เช่น ‘พรุ่งนี้ประชุมทีม 10 โมง 90 นาที’");
    if (!request?.trim()) return;
    setAiDrafting(true);
    setFormError(null);
    try {
      const draft = await onGenerateAiDraft({
        text: request,
        referenceDate: date || toDateInputValue(new Date()),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        categories: categories.map((category) => category.name)
      });
      if (draft.title) setTitle(draft.title);
      const hasStart = applyAiDateTime("start", draft.startLocal);
      const hasEnd = applyAiDateTime("end", draft.endLocal);
      if (!hasStart || !hasEnd) throw new Error("Gemini ส่งวันหรือเวลาในรูปแบบที่ใช้ไม่ได้");
      if (typeof draft.notes === "string") {
        setNotes(draft.notes);
        setNotesOpen(Boolean(draft.notes));
      }
      const matchingCategory = categories.find((category) => category.name === draft.categoryName);
      setCategoryId(matchingCategory?.id || "");
    } catch (error) {
      setFormError(error.message || "สร้างร่างกิจกรรมด้วย AI ไม่สำเร็จ");
    } finally {
      setAiDrafting(false);
    }
  };
  const startMissing = remainingRequiredFields.includes("start");
  const endMissing = remainingRequiredFields.includes("end");

  // Tracks whether the person already saw and accepted the "long overnight
  // duration" warning from validate() below — set true after the first
  // submit that triggers it, so clicking "บันทึก" a second time (without
  // changing date/time) goes through instead of looping on the same
  // warning forever. Reset whenever date/start/end change, since a new
  // time combination needs its own fresh confirmation.
  const [overnightWarningAcknowledged, setOvernightWarningAcknowledged] = useState(false);
  useEffect(() => {
    setOvernightWarningAcknowledged(false);
  }, [date, endDate, startTime, endTime]);

  // Escape ปิด modal ได้เหมือนคลิกนอกกรอบ (.modal-overlay's onClick={onClose}
  // ด้านล่าง) — attach ที่ document เพราะโฟกัสอาจอยู่ตรงไหนก็ได้ในฟอร์ม
  // (input, textarea, ปุ่ม) ไม่ใช่แค่ตอน modal เองมีโฟกัสตรงๆ ใส่ effect นี้
  // ไว้ก่อน early return (`if (!open) return null` ด้านล่าง) เพราะ hook
  // ต้องถูกเรียกทุก render เสมอ (Rules of Hooks) — ตัว effect เองเช็ค `open`
  // ข้างในแทน ไม่ใช่การข้าม hook ทั้งก้อนแบบมีเงื่อนไข
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const toggleWeekday = (code) => {
    setRepeat((prev) => {
      const has = prev.byDay.includes(code);
      const byDay = has ? prev.byDay.filter((d) => d !== code) : [...prev.byDay, code];
      return { ...prev, byDay };
    });
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryError("กรุณาตั้งชื่อหมวดหมู่");
      return;
    }
    setCategorySaving(true);
    setCategoryError(null);
    try {
      const created = await onCreateCategory(name, newCategoryColor);
      // เลือกหมวดหมู่ที่เพิ่งสร้างให้ทันที ผู้ใช้ไม่ต้องกลับไปเลือกซ้ำใน dropdown
      setCategoryId(created.id);
      setCreatingCategory(false);
      setNewCategoryName("");
      setNewCategoryColor(CATEGORY_COLOR_SWATCHES[0]);
    } catch (err) {
      setCategoryError(err.message);
    } finally {
      setCategorySaving(false);
    }
  };

  // ลบหมวดหมู่ — กดปุ่ม ✕ ท้ายแถวใน dropdown โดยไม่ต้องเลือกหมวดหมู่นั้นก่อน
  // (stopPropagation กันไม่ให้ click ทะลุไปเลือกแถวนั้นเป็นค่าปัจจุบัน)
  const handleDeleteCategory = async (e, category) => {
    e.stopPropagation();
    if (!onDeleteCategory) return;
    if (!window.confirm(`ลบหมวดหมู่ "${category.name}" ใช่ไหม? กิจกรรมที่เคยผูกไว้จะกลายเป็น "ไม่ระบุหมวดหมู่"`)) {
      return;
    }
    setDeletingCategoryId(category.id);
    setCategoryError(null);
    try {
      await onDeleteCategory(category.id);
      // ถ้ากำลังเลือกหมวดหมู่นี้อยู่พอดี ต้องเคลียร์ค่ากลับเป็น "ไม่ระบุ"
      // ไม่งั้นฟอร์มจะยังอ้างถึง categoryId ที่ไม่มีอยู่แล้ว
      if (categoryId === category.id) {
        setCategoryId("");
      }
    } catch (err) {
      setCategoryError(err.message);
    } finally {
      setDeletingCategoryId(null);
    }
  };

  /**
   * คำนวณ start/end เป็น Date object จริง — แยกออกมาจาก buildActivityBody()
   * เดิม (ซึ่งยังคงเรียกฟังก์ชันนี้อยู่) เพื่อให้ validate()'s overlap check
   * ด้านล่างใช้ start/end ชุดเดียวกัน ไม่ต้องคำนวณซ้ำสองที่ (เสี่ยง logic
   * เพี้ยนจากกันถ้าแก้ไขจุดเดียวแล้วลืมอีกจุด — โดยเฉพาะ edge case ข้าม
   * เที่ยงคืนด้านล่างที่ละเอียดอ่อน)
   */
  const computeStartEnd = () => {
    const start = combineDateAndTime(date, startTime);
    let end = combineDateAndTime(endDate, endTime);
    // กิจกรรมที่ข้ามเที่ยงคืน (เช่น เริ่ม 23:00 จบ 00:30) จะได้ endTime ที่
    // "น้อยกว่า" startTime เมื่อเทียบเป็นเวลาในวันเดียวกัน — เลื่อน end ไป
    // วันถัดไปแทนที่จะปล่อยให้ end <= start กลายเป็นช่วงเวลาติดลบ/ผิดพลาด
    // ที่ Google Calendar อาจปฏิเสธหรือตีความผิดไปเงียบๆ (ดู validate() ที่
    // อนุญาต endTime <= startTime ไว้แล้วเพื่อรองรับกรณีนี้โดยเฉพาะ)
    if (end <= start && endDate === date) {
      end = new Date(end.getTime() + 24 * 60 * 60000);
    }
    return { start, end };
  };

  const buildActivityBody = () => {
    const body = {
      summary: title.trim() || "(ไม่มีชื่อ)",
      // null (not undefined) so an update PATCH actively clears the field on
      // Google's side when the user empties it — omitting the key entirely
      // would leave the old value untouched instead.
      description: notes.trim() || null
    };

    const { start, end } = computeStartEnd();
    // Google Calendar requires an explicit IANA timeZone alongside dateTime —
    // it does NOT infer it from the offset embedded in an ISO string, even
    // one ending in "Z". Using the browser's local zone keeps the event
    // anchored to the wall-clock time the user actually picked in the form.
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    body.start = { dateTime: start.toISOString(), timeZone };
    body.end = { dateTime: end.toISOString(), timeZone };

    if (recurrenceEditable) {
      const rrule = buildRRule(repeat);
      body.recurrence = rrule ? [rrule] : null;
    }

    return body;
  };

  const validate = () => {
    if (endDate < date) return "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม";
    // endTime <= startTime (เทียบ string "HH:mm") ไม่ใช่ error เสมอไป —
    // ตีความว่าเป็นกิจกรรมข้ามเที่ยงคืน (เช่น 23:00 - 00:30) แล้วเลื่อน
    // end ไปวันถัดไปให้ตอน buildActivityBody() แทนที่จะบล็อกไม่ให้บันทึก
    // (เดิมโค้ดนี้ปฏิเสธทุกกรณีที่ end "ดูเหมือน" มาก่อน start ทำให้ผู้ใช้
    // สร้างกิจกรรมข้ามคืนไม่ได้เลย)
    if (repeat.mode === "custom" && repeat.freq === "WEEKLY" && repeat.byDay.length === 0) {
      return "เลือกอย่างน้อย 1 วันสำหรับกิจกรรมที่ทำซ้ำทุกสัปดาห์";
    }
    if (repeat.mode === "custom" && repeat.end === "until" && !repeat.until) {
      return "กรุณาระบุวันที่สิ้นสุดการทำซ้ำ";
    }

    // เตือน (ไม่บล็อก) ถ้าการเลื่อน end ไปวันถัดไปแบบอัตโนมัติ (ดู
    // computeStartEnd) ทำให้กิจกรรมยาวผิดปกติ (> 18 ชม.) — เคสนี้มักเกิด
    // จากผู้ใช้เผลอตั้ง endTime พลาด (เช่น เท่ากับ startTime พอดี หรือ
    // กลับ AM/PM สลับกัน) ไม่ใช่กิจกรรมข้ามคืนจริงๆ ที่ตั้งใจ เตือนไว้ก่อน
    // บันทึกจริง ให้ผู้ใช้เช็คซ้ำแทนที่จะปล่อยให้สร้างกิจกรรม 20+ ชม. โดย
    // ไม่รู้ตัว
    const { start: durationStart, end: durationEnd } = computeStartEnd();
    const durationHours = (durationEnd - durationStart) / 3600000;
    if (durationHours > 18 && !overnightWarningAcknowledged) {
      return `กิจกรรมนี้ยาว ${durationHours.toFixed(1)} ชั่วโมง (ข้ามเที่ยงคืนไปจบวันถัดไป) — ถ้าตั้งใจแบบนี้ กดบันทึกอีกครั้งเพื่อยืนยัน`;
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      // The long-duration warning is a confirm-to-proceed prompt, not a
      // hard block — arm the acknowledgment flag so the *next* submit
      // (with the same date/time) passes validate() and actually saves.
      // Any other validation error leaves this false, so it keeps
      // blocking normally.
      const { start: durationStart, end: durationEnd } = computeStartEnd();
      const durationHours = (durationEnd - durationStart) / 3600000;
      if (durationHours > 18) {
        setOvernightWarningAcknowledged(true);
      }
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await onSave({
        activityBody: buildActivityBody(),
        categoryId: categoryId || null,
        tags,
        existingId: initialActivity?.id || null,
        // Passed along so the caller can detect an edit-time conflict
        // (someone else changed the activity after we opened this form)
        // and warn about it — the save still goes through and overwrites.
        knownUpdated: initialActivity?.updated || null
      });
      onClose();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialActivity) return;
    const isRecurringOccurrence = Boolean(initialActivity.recurringEventId);
    const confirmation = isRecurringOccurrence
      ? `ลบเฉพาะครั้งนี้ของ “${initialActivity.summary || "(ไม่มีชื่อ)"}” ใช่ไหม? ครั้งอื่นในชุดทำซ้ำจะไม่ถูกลบ`
      : `ลบกิจกรรม “${initialActivity.summary || "(ไม่มีชื่อ)"}” ใช่ไหม?`;
    if (!window.confirm(confirmation)) return;
    setSaving(true);
    setFormError(null);
    try {
      await onDelete(initialActivity.id);
      onClose();
    } catch (err) {
      setFormError(err.message);
      setSaving(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEditing ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}</h2>
          <div className="modal-header-actions">
            {!isEditing && onSyncGoogleCalendar && (
              <button type="button" className="google-calendar-sync-btn" onClick={onSyncGoogleCalendar} disabled={googleCalendarSyncing} title="ดึงกิจกรรมของสัปดาห์นี้จาก Google Calendar">
                <img src={`${import.meta.env.BASE_URL}logo/google-calendar.svg`} alt="" />
                <span>{googleCalendarSyncing ? "กำลังดึง..." : "ดึงจาก Google Calendar"}</span>
              </button>
            )}
            {!isEditing && onGenerateAiDraft && (
              <button type="button" className="ai-activity-draft-btn" onClick={handleAiDraft} disabled={aiDrafting} title="ให้ Gemini ช่วยร่างกิจกรรม">
                <span aria-hidden="true">✨</span><span>{aiDrafting ? "กำลังร่าง..." : "ร่างด้วย AI"}</span>
              </button>
            )}
            <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
              ✕
            </button>
          </div>
        </div>
        {initialWarning && <div className="modal-initial-warning" role="alert"><strong>ต้องกรอกข้อมูลเพิ่มเติม</strong><span>{initialWarning}</span></div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="modal-field field-title">
            <span className="field-label">ชื่อกิจกรรม</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ประชุมทีม"
              autoFocus
            />
          </label>

          <div className="modal-field-row">
            <label className={`modal-field${startMissing ? " is-required-missing" : ""}`}>
              <span className="field-label">วันและเวลาเริ่ม</span>
              <input type="datetime-local" value={dateTimeValue(date, startTime)} onChange={(e) => updateDateTime("start", e.target.value)} required />
            </label>
            <label className={`modal-field${endMissing ? " is-required-missing" : ""}`}>
              <span className="field-label">วันและเวลาสิ้นสุด</span>
              <input type="datetime-local" value={dateTimeValue(endDate, endTime)} min={dateTimeValue(date, startTime)} onChange={(e) => updateDateTime("end", e.target.value)} required />
            </label>
          </div>
          {endDate === date && endTime <= startTime && (
            <p className="modal-hint">
              ⏰ เวลาสิ้นสุดอยู่ก่อนเวลาเริ่ม — ระบบจะถือว่ากิจกรรมนี้จบในวันถัดไป (ข้ามเที่ยงคืน)
            </p>
          )}

          <div className="modal-field" ref={categoryFieldRef} style={{ position: "relative" }}>
            <span className="field-label">หมวดหมู่</span>
            <div className="category-select-wrap">
              {selectedCategory && (
                <span className="category-swatch" style={{ background: selectedCategory.color }} />
              )}
              <button
                type="button"
                className="category-dropdown-trigger"
                onClick={() => setCategoryDropdownOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={categoryDropdownOpen}
              >
                <span>{selectedCategory ? selectedCategory.name : "ไม่ระบุ"}</span>
                <span className="category-dropdown-arrow">{categoryDropdownOpen ? "▲" : "▼"}</span>
              </button>
            </div>

            {categoryDropdownOpen && (
              <ul className="category-dropdown-list" role="listbox">
                <li
                  className={`category-dropdown-item${categoryId === "" ? " is-active" : ""}`}
                  role="option"
                  aria-selected={categoryId === ""}
                  onClick={() => {
                    setCategoryId("");
                    setCategoryDropdownOpen(false);
                  }}
                >
                  <span className="category-dropdown-item-label">ไม่ระบุ</span>
                </li>
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    className={`category-dropdown-item${categoryId === cat.id ? " is-active" : ""}`}
                    role="option"
                    aria-selected={categoryId === cat.id}
                    onClick={() => {
                      setCategoryId(cat.id);
                      setCategoryDropdownOpen(false);
                    }}
                  >
                    <span className="category-dropdown-item-label">
                      <span className="category-swatch" style={{ background: cat.color }} />
                      {cat.name}
                    </span>
                    {onDeleteCategory && (
                      <button
                        type="button"
                        className="category-delete-btn"
                        onClick={(e) => handleDeleteCategory(e, cat)}
                        disabled={deletingCategoryId === cat.id}
                        title={`ลบหมวดหมู่ "${cat.name}"`}
                        aria-label={`ลบหมวดหมู่ ${cat.name}`}
                      >
                        {deletingCategoryId === cat.id ? "…" : "✕"}
                      </button>
                    )}
                  </li>
                ))}
                {onCreateCategory && (
                  <li
                    className="category-dropdown-item category-dropdown-create"
                    role="option"
                    onClick={() => {
                      setCreatingCategory(true);
                      setCategoryError(null);
                      setCategoryDropdownOpen(false);
                    }}
                  >
                    <span className="category-dropdown-item-label">+ สร้างหมวดหมู่ใหม่</span>
                  </li>
                )}
              </ul>
            )}

            {creatingCategory && (
              <div className="new-category-form">
                <input
                  type="text"
                  className="new-category-name-input"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="ชื่อหมวดหมู่ เช่น งานอดิเรก"
                  autoFocus
                />
                <div className="category-color-swatch-row">
                  {CATEGORY_COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`color-dot${newCategoryColor === hex ? " is-selected" : ""}`}
                      style={{ background: hex, color: hex }}
                      onClick={() => setNewCategoryColor(hex)}
                      title={hex}
                      aria-label={`เลือกสี ${hex}`}
                    />
                  ))}
                  <label className="category-custom-color" title="เลือกสีเอง (color picker)">
                    <input
                      type="color"
                      value={newCategoryColor}
                      onChange={(e) => setNewCategoryColor(e.target.value)}
                    />
                  </label>
                </div>
                {categoryError && <p className="modal-error">{categoryError}</p>}
                <div className="new-category-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-small"
                    onClick={() => {
                      setCreatingCategory(false);
                      setCategoryError(null);
                    }}
                    disabled={categorySaving}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    onClick={handleCreateCategory}
                    disabled={categorySaving}
                  >
                    {categorySaving ? "กำลังสร้าง..." : "สร้างหมวดหมู่"}
                  </button>
                </div>
              </div>
            )}

            {!creatingCategory && categoryError && (
              <p className="modal-error">{categoryError}</p>
            )}
          </div>

          <div className="modal-field">
            <span className="field-label">Tag</span>
            <div className="tag-input-wrap">
              {tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                  <button
                    type="button"
                    className="tag-chip-remove"
                    onClick={() => removeTag(tag)}
                    aria-label={`ลบ tag ${tag}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="tag-input"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                onBlur={addTagFromDraft}
                placeholder={tags.length >= TAGS_MAX_COUNT ? "ครบจำนวน tag สูงสุดแล้ว" : "พิมพ์แล้วกด Enter..."}
                disabled={tags.length >= TAGS_MAX_COUNT}
              />
            </div>
          </div>

          {recurrenceEditable ? (
            <div className="modal-field">
              <span className="field-label">ทำซ้ำ</span>
              {wasUnlimitedRepeat && (
                <p className="modal-error" style={{ marginBottom: "6px" }}>
                  ⚠ กิจกรรมนี้เดิมตั้งไว้แบบ "ไม่มีวันสิ้นสุด" — ฟังก์ชันนี้ปิดไว้ก่อน
                  ถ้ากด "แก้ไข" ตอนนี้ การทำซ้ำจะถูกจำกัดเหลือ {repeat.count} ครั้งแทน
                </p>
              )}
              <div className="repeat-summary">
                <select
                  value={repeat.mode === "none" ? "none" : "custom"}
                  onChange={(e) =>
                    setRepeat((prev) => ({ ...prev, mode: e.target.value === "none" ? "none" : "custom" }))
                  }
                >
                  <option value="none">ไม่ซ้ำ</option>
                  <option value="custom">กำหนดเอง</option>
                </select>
              </div>

              {repeat.mode === "custom" && (
                <div className="repeat-custom">
                  <div className="repeat-freq-row">
                    <span>ทำซ้ำทุก</span>
                    <input
                      type="number"
                      min="1"
                      value={repeat.interval}
                      onChange={(e) =>
                        setRepeat((prev) => ({ ...prev, interval: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                      }
                    />
                    <select
                      value={repeat.freq}
                      onChange={(e) => setRepeat((prev) => ({ ...prev, freq: e.target.value }))}
                    >
                      <option value="DAILY">วัน</option>
                      <option value="WEEKLY">สัปดาห์</option>
                      <option value="MONTHLY">เดือน</option>
                    </select>
                  </div>

                  {repeat.freq === "WEEKLY" && (
                    <div className="modal-field" style={{ gap: "8px" }}>
                      <span className="field-label">ในวัน</span>
                      <div className="weekday-picker">
                        {RRULE_WEEKDAYS.map((code, i) => (
                          <button
                            key={code}
                            type="button"
                            className={`weekday-chip${repeat.byDay.includes(code) ? " is-active" : ""}`}
                            onClick={() => toggleWeekday(code)}
                          >
                            {WEEKDAY_SHORT[i]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="modal-field" style={{ gap: "8px" }}>
                    <span className="field-label">สิ้นสุด</span>
                    <div className="repeat-end-row">
                      {/* ปิดฟังก์ชัน "ไม่มีวันสิ้นสุด" ไว้ก่อน — ต้องเลือก
                          "หลังจาก N ครั้ง" หรือ "ในวันที่" เท่านั้น (ดู
                          defaultRepeatState/parseRRule ใน rrule-utils.js ที่
                          fallback เป็น "count" แทน "never" แล้วเช่นกัน) */}
                      <label className="radio-inline">
                        <input
                          type="radio"
                          name="repeat-end"
                          checked={repeat.end === "count"}
                          onChange={() => setRepeat((prev) => ({ ...prev, end: "count" }))}
                        />
                        หลังจาก
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={MAX_REPEAT_COUNT}
                        value={repeat.count}
                        disabled={repeat.end !== "count"}
                        onChange={(e) =>
                          setRepeat((prev) => ({
                            ...prev,
                            count: Math.min(MAX_REPEAT_COUNT, Math.max(1, parseInt(e.target.value, 10) || 1))
                          }))
                        }
                      />
                      <span>ครั้ง (สูงสุด {MAX_REPEAT_COUNT} ครั้ง)</span>
                      <label className="radio-inline">
                        <input
                          type="radio"
                          name="repeat-end"
                          checked={repeat.end === "until"}
                          onChange={() => setRepeat((prev) => ({ ...prev, end: "until" }))}
                        />
                        ในวันที่
                      </label>
                      <input
                        type="date"
                        disabled={repeat.end !== "until"}
                        value={repeat.until}
                        onChange={(e) => setRepeat((prev) => ({ ...prev, until: e.target.value }))}
                      />
                    </div>
                  </div>

                  <p className="repeat-preview">
                    {describeRepeat(repeat, combineDateAndTime(date, startTime || "00:00"))}
                  </p>
                </div>
              )}
            </div>
          ) : (
            isEditing && (
              <p className="allday-hint">
                กิจกรรมนี้เป็นส่วนหนึ่งของชุดกิจกรรมที่ทำซ้ำอยู่แล้ว — การแก้ไขรูปแบบการทำซ้ำยังไม่รองรับในแอปนี้
                (แก้ไขได้โดยตรงใน Google Calendar)
              </p>
            )
          )}

          <div className="modal-field">
            <button
              type="button"
              className={`collapsible-trigger${notesOpen ? " is-open" : ""}`}
              onClick={() => setNotesOpen((v) => !v)}
            >
              <span className="chevron">▸</span> เพิ่มรายละเอียด / โน้ต
            </button>
            {notesOpen && (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="รายละเอียดเพิ่มเติม เช่น ลิงก์ประชุม, สิ่งที่ต้องเตรียม..."
              />
            )}
          </div>

          {formError && <p className="modal-error">{formError}</p>}

          <div className="modal-actions">
            {isEditing && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={saving}
              >
                {initialActivity.recurringEventId ? "ลบครั้งนี้" : "ลบ"}
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
                ยกเลิก
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
