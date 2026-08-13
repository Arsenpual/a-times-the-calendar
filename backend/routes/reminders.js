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

function sanitizeReminderFields(body) {
  if (!body || typeof body !== "object") return null;
  if (typeof body.type !== "string" || !REMINDER_TYPES.includes(body.type)) return null;
  if (typeof body.title !== "string" || body.title.trim().length === 0) return null;

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
