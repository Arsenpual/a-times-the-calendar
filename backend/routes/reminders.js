const express = require("express");
const { remindersCol } = require("../firestore-db.js");

const router = express.Router();

/**
 * เบื้องต้น sync แค่ "วันและเวลา" ของ reminder เข้า Firebase ก่อน — คือ
 * ฟิลด์ที่นิยาม "เมื่อไหร่ควรเตือน" (ตั้งครั้งเดียวตอนสร้าง/แก้ไขผ่านฟอร์ม)
 * ไม่รวม runtime state ที่เปลี่ยนทุกวินาที/ทุกครั้งที่ trigger เช่น
 * startedAt (นาฬิกา countdown/stopwatch ที่กำลังนับ), accumulatedMs,
 * currentIndex (routine), lastTriggeredAt, nextDueAt — ฟิลด์เหล่านี้ยัง
 * อยู่ใน localStorage ฝั่ง frontend เหมือนเดิม ไม่ส่งขึ้น backend ในเฟสนี้
 * เพื่อไม่ให้เขียน Firestore ถี่เกินจำเป็น (เช่น stopwatch ที่ tick ทุกวินาที)
 *
 * ALLOWED_FIELDS ด้านล่างคือ allow-list ของฟิลด์ที่ยอมรับ — ฟิลด์ไหนไม่อยู่
 * ในนี้จะถูกตัดทิ้งเงียบๆ ตอน sanitize (ไม่ error) เพื่อกันไม่ให้ client
 * ส่ง runtime field มาปนโดยไม่ตั้งใจ (เช่น ส่ง object reminder ทั้งก้อนมาตรงๆ)
 */
const ALLOWED_FIELDS = [
  "type",
  "title",
  "enabled",
  "amount",
  "unit",
  "windowStart",
  "windowEnd",
  "days",
  "time",
  "atMs",
  "afterAmount",
  "afterUnit",
  "durationMs",
  "lineColor",
  "eventName",
  "steps"
];

const REMINDER_TYPES = [
  "interval",
  "weekly",
  "event-anchored",
  "routine",
  "once-at",
  "countdown",
  "stopwatch"
];

// เดิม sanitizeReminderFields() ผ่าน allow-list แค่ "ชื่อ key" (ดูใน loop
// ด้านล่าง) โดยไม่เช็คโครงสร้าง/ขนาดของค่าเลย — "days" กับ "steps" เป็น
// array ที่รับ element อะไรก็ได้ ขนาดเท่าไหร่ก็ได้ (จำกัดแค่ด้วย Firestore
// document size limit จริงๆ ที่ ~1MiB) เปิดช่องให้ user คนหนึ่งยัด array
// ใหญ่ๆ ซ้ำๆ หลาย reminder เพื่อกิน Firestore storage/cost โดยไม่ได้ตั้งใจ
// หรือเจตนาร้ายก็ได้ — เพดานด้านล่างกันเฉพาะกรณีสุดโต่งนี้ ไม่ใช่ validation
// ทางธุรกิจแบบเต็มรูป (ยังไม่เช็ค field ย่อยภายใน step object แต่ละอัน)
const MAX_DAYS = 7; // ไม่มีทางเกิน 7 วันต่อสัปดาห์อยู่แล้วโดยธรรมชาติ
const MAX_STEPS = 50; // routine หนึ่งชุดไม่ควรมีมากกว่านี้ในทางปฏิบัติ
const MAX_STEP_JSON_LENGTH = 20000; // กันแต่ละ step object ใหญ่ผิดปกติ (เช่น title ยาวเป็นหมื่นตัวอักษร)
const MAX_STRING_FIELD_LENGTH = 200; // เพดานความยาวสำหรับ string field ทั่วไป (title, eventName, unit, lineColor, afterUnit)

function isValidStringField(value, maxLength = MAX_STRING_FIELD_LENGTH) {
  return typeof value === "string" && value.length <= maxLength;
}

/** ตรวจ "days" — ต้องเป็น array ของ string สั้นๆ ไม่เกิน 7 รายการ */
function isValidDays(days) {
  if (!Array.isArray(days) || days.length > MAX_DAYS) return false;
  return days.every((d) => isValidStringField(d, 20));
}

/**
 * ตรวจ "steps" — ต้องเป็น array ของ object ล้วน (ไม่ใช่ primitive/array
 * ซ้อน) ไม่เกิน MAX_STEPS รายการ และแต่ละ step เมื่อ serialize เป็น JSON
 * แล้วต้องไม่เกิน MAX_STEP_JSON_LENGTH ตัวอักษร — ไม่ได้เช็ค schema ภายใน
 * แบบละเอียด (เช่น step ต้องมี field อะไรบ้าง) เพราะ frontend ยังไม่ได้
 * fix รูปแบบ step object ให้นิ่งพอ แค่กันขนาดที่ผิดปกติชัดเจนไว้ก่อน
 */
function isValidSteps(steps) {
  if (!Array.isArray(steps) || steps.length > MAX_STEPS) return false;
  return steps.every((step) => {
    if (typeof step !== "object" || step === null || Array.isArray(step)) return false;
    try {
      return JSON.stringify(step).length <= MAX_STEP_JSON_LENGTH;
    } catch {
      return false; // circular reference หรือ serialize ไม่ได้ — ปฏิเสธ
    }
  });
}

function sanitizeReminderFields(body) {
  if (!body || typeof body !== "object") return null;
  if (typeof body.type !== "string" || !REMINDER_TYPES.includes(body.type)) return null;
  if (!isValidStringField(body.title) || body.title.trim().length === 0) return null;

  // ฟิลด์ string ทั่วไปอื่นๆ ที่ frontend อาจส่งมา — เช็คเพดานความยาวก่อนรับ
  const STRING_FIELDS = ["unit", "afterUnit", "lineColor", "eventName"];
  for (const key of STRING_FIELDS) {
    if (body[key] !== undefined && !isValidStringField(body[key])) return null;
  }

  if (body.days !== undefined && !isValidDays(body.days)) return null;
  if (body.steps !== undefined && !isValidSteps(body.steps)) return null;

  const cleaned = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) cleaned[key] = body[key];
  }
  return cleaned;
}

// GET /api/reminders — รายการ reminder ทั้งหมด (เฉพาะฟิลด์วัน/เวลา) ของ
// user ที่ login อยู่ — รูปแบบ response เดียวกับ /api/activities/categories
// คือ object แบนราบ { [reminderId]: {...fields} } ไม่ใช่ array เพราะ
// frontend ใช้ id เป็น key อยู่แล้วในการ merge เข้ากับ localStorage state
router.get("/", async (req, res, next) => {
  try {
    const snapshot = await remindersCol(req.userId).get();
    const reminders = {};
    snapshot.docs.forEach((doc) => {
      reminders[doc.id] = doc.data();
    });
    res.json(reminders);
  } catch (err) {
    next(err);
  }
});

// PUT /api/reminders/:reminderId — สร้างหรืออัปเดต schedule fields ของ
// reminder หนึ่งตัว (upsert เดียว ไม่แยก POST/PUT เพราะ reminder id เป็น
// client-generated อยู่แล้ว เหมือน activity id ของ Google Calendar — ไม่มี
// concept "ยังไม่มี id" ที่ต้องให้ backend generate ให้)
router.put("/:reminderId", async (req, res, next) => {
  try {
    const cleaned = sanitizeReminderFields(req.body);
    if (!cleaned) {
      return res.status(400).json({
        error: "ต้องระบุ type (หนึ่งใน " + REMINDER_TYPES.join(", ") + ") และ title ที่ไม่ว่างเปล่า"
      });
    }
    const { reminderId } = req.params;
    await remindersCol(req.userId).doc(reminderId).set(cleaned);
    res.json({ id: reminderId, ...cleaned });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reminders/:reminderId
router.delete("/:reminderId", async (req, res, next) => {
  try {
    await remindersCol(req.userId).doc(req.params.reminderId).delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
