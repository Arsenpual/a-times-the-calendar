import { REMINDER_TYPE } from "./reminder-due-logic.js";
// ฟิลด์วัน/เวลาที่ sync ขึ้น Firebase — ต้องตรงกับ ALLOWED_FIELDS ใน
// backend/routes/reminders.js เป๊ะๆ (ฝั่ง backend มี allow-list ของตัวเอง
// อยู่แล้ว ตัดฟิลด์ที่ไม่อยู่ในนี้ทิ้งเงียบๆ — รายการนี้ฝั่ง frontend มีไว้
// เพื่อความชัดเจนตอนอ่านโค้ด ไม่ใช่ security boundary จริง) ไม่รวม runtime
// field เช่น startedAt/accumulatedMs/currentIndex/lastTriggeredAt — ยกเว้น
// completedAt/completionCount ของ routine ซึ่ง sync เพื่อเก็บประวัติการทำครบ
// (เพิ่มเข้ามาเฟส 4) — nextDueAt เป็นข้อยกเว้นในเฟส 5 เพราะ scheduler
// ฝั่ง Cloud Function ต้องอ่านมันได้แม้ผู้ใช้ปิดแท็บอยู่
const SCHEDULE_FIELD_KEYS = [
  "type", "title", "enabled", "amount", "unit", "windowStart", "windowEnd",
  "days", "time", "times", "atMs", "afterAmount", "afterUnit", "durationMs",
  "lineColor", "eventName", "steps", "eventAnchorCountdownMinutes",
  "eventAnchorStopwatchMinutes", "eventAnchorCountdownTitle", "eventAnchorStopwatchTitle", "eventAnchorStartedAt", "eventAnchorPrimaryDueAt", "eventAnchorNotificationPhase",
  // migration plan v2 เฟส 3 — groupId ผูก reminder เข้ากับกลุ่ม/โปรเจกต์
  // (one-to-one, null = ไม่มีกลุ่ม) ต้องส่งค่า null อย่างชัดเจนเสมอ (ไม่ใช่
  // undefined) เมื่อไม่มีกลุ่ม เพื่อให้ extractScheduleFields ด้านล่างส่ง
  // ค่านี้ขึ้น backend ทุกครั้ง — มิฉะนั้นตอนผู้ใช้เอา reminder ออกจากกลุ่ม
  // (groupId: null) การ sync จะไม่ส่งฟิลด์นี้ไปเลย (เพราะ !== undefined
  // เช็คไม่ผ่าน) ทำให้ backend ไม่รู้ว่าต้องเคลียร์ค่าเดิมทิ้ง
  "groupId",
  // 1:1 link กับ Google Calendar activity; Activity เป็นเจ้าของ title/เวลา
  // ร่วม ส่วน reminder เก็บกติกาการแจ้งเตือนของตัวเอง
  "activityId",
  "nextDueAt",
  // การ Snooze เป็นข้อยกเว้นชั่วคราวของตารางปกติ (โดยเฉพาะ weekly ที่
  // อาจเลื่อนข้ามวันได้) จึงต้อง mirror คู่กับ nextDueAt ด้วย มิฉะนั้น
  // ตอน reload/merge จาก Firebase ตัวตรวจ weekly จะเข้าใจผิดว่าเป็นค่า
  // ค้างและเขียน nextDueAt กลับเป็นรอบปกติ
  "snoozedUntil"
];

export function extractScheduleFields(reminder) {
  const fields = {};
  for (const key of SCHEDULE_FIELD_KEYS) {
    if (reminder[key] !== undefined) {
      // Firestore ไม่ควรเก็บ Infinity: มันไม่มีความหมายว่า "ครบกำหนด" และ
      // query <= now จะไม่ต้องพบมันอยู่แล้ว ใช้ null แทนสถานะไม่มี due-date
      // (event ที่ยังไม่ trigger, routine, stopwatch, one-shot ที่จบแล้ว)
      fields[key] = key === "nextDueAt" && !Number.isFinite(reminder[key]) ? null : reminder[key];
    }
  }
  // เก็บสถานะและจำนวนครั้งเฉพาะ Checklist/Routine เพื่อรองรับข้ามอุปกรณ์.
  if (reminder.type === REMINDER_TYPE.ROUTINE) {
    fields.completedAt = reminder.completedAt ?? null;
    fields.completionCount = Number.isInteger(reminder.completionCount)
      ? reminder.completionCount
      : 0;
  }
  return fields;
}
