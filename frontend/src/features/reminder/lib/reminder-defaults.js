import { REMINDER_TYPE } from "./reminder-due-logic.js";
import { DEFAULT_LINE_COLOR } from "./reminder-config.js";
// แปลง timestamp เป็น "YYYY-MM-DD" ตามเวลาท้องถิ่นของเครื่อง (ไม่ใช้ toISOString() เพราะแปลงเป็น UTC
// ทำให้วันที่เพี้ยนได้เมื่อเวลาใกล้เที่ยงคืนในโซนเวลาที่ต่างจาก UTC เช่น ไทย +7)
function toLocalDateInputValue(ms) {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * ค่าเริ่มต้นของ draft สำหรับ composer ตอนยังไม่ได้แก้ไข reminder ใดอยู่
 * (สร้างใหม่/ล้างฟอร์มหลังบันทึก/ยกเลิกแก้ไข) — รวมไว้ที่ฟังก์ชันเดียวแทนที่
 * จะก็อปปี้ object literal ซ้ำ 3 จุด (initial useState, submitReminderForm's
 * reset, cancelEditing) เพื่อไม่ให้จุดใดจุดหนึ่งลืมอัปเดตตามถ้าค่าเริ่มต้น
 * เปลี่ยนในอนาคต
 *
 * atDate/atTime (ใช้กับ ONCE_AT) ตั้งเป็นวันที่/เวลาปัจจุบันของเครื่องเสมอ
 * แทนที่จะปล่อยว่าง — ผู้ใช้ที่จะตั้งเตือนแบบ "ครั้งเดียว" ส่วนใหญ่ตั้งเวลา
 * ใกล้ๆ ตอนนี้อยู่แล้ว (เช่น อีก 20 นาที) การมีวันที่/เวลาปัจจุบันโชว์ไว้ก่อน
 * ให้แค่ปรับเวลาต่อจากนั้นเร็วกว่าต้องเปิด date/time picker มาเลือกเองทั้งหมด
 * ตั้งใจคำนวณใหม่ทุกครั้งที่เรียกฟังก์ชันนี้ (ไม่ใช่ค่าคงที่ตอน module
 * โหลด) เพื่อให้ตรงกับเวลาจริง ณ ตอนเปิด/ล้างฟอร์มเสมอ ไม่ใช่เวลาที่หน้าเว็บ
 * ถูกโหลดครั้งแรก
 */
export function createBlankDraft() {
  const now = new Date();
  return {
    title: "",
    type: REMINDER_TYPE.INTERVAL,
    amount: "30",
    unit: "minutes",
    // true = ไม่มีช่วงพัก, interval ทำงาน 24 ชั่วโมง; เก็บช่วงเวลาไว้
    // เฉพาะเมื่อผู้ใช้ปิดตัวเลือกนี้เท่านั้น
    runAllDay: true,
    windowStart: "",
    windowEnd: "",
    atTime: now.toTimeString().slice(0, 5),
    atDate: toLocalDateInputValue(now.getTime()),
    countdownMinutes: "20",
    days: [1, 3, 5],
    time: "08:00",
    times: ["08:00"],
    eventName: "",
    afterAmount: "2",
    afterUnit: "hours",
    eventAnchorCountdownEnabled: false,
    eventAnchorCountdownAmount: "10",
    eventAnchorCountdownUnit: "minutes",
    eventAnchorCountdownTitle: "",
    eventAnchorStopwatchEnabled: false,
    eventAnchorStopwatchAmount: "10",
    eventAnchorStopwatchUnit: "minutes",
    eventAnchorStopwatchTitle: "",
    routineSteps: "แปรงฟัน, ยืดตัว, กินวิตามิน",
    lineColor: DEFAULT_LINE_COLOR,
    groupId: null // migration plan v2 เฟส 3
  };
}

export const DEFAULT_REMINDERS = [
  { id: "water", type: REMINDER_TYPE.INTERVAL, title: "ดื่มน้ำ", amount: 30, unit: "minutes", enabled: true },
  { id: "stretch", type: REMINDER_TYPE.INTERVAL, title: "ยืดตัว 30 วินาที", amount: 60, unit: "minutes", enabled: true },
  { id: "eyes", type: REMINDER_TYPE.INTERVAL, title: "พักสายตา มองไกล 20 ฟุต", amount: 20, unit: "minutes", enabled: true }
];
