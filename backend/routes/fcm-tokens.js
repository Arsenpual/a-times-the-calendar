const express = require("express");
const { fcmTokensCol } = require("../firestore-db.js");

const router = express.Router();

// เพดานความยาว FCM token — token จริงของ Firebase ยาวประมาณ 140-180
// ตัวอักษร กันไว้กว้างๆ ที่ 500 ตัวอักษร ป้องกัน client (บั๊กหรือเจตนาร้าย)
// ส่ง string ยาวผิดปกติมาเป็น "token" (เช่นเดียวกับแนวทางที่ reminders.js
// ใช้กับ MAX_STRING_FIELD_LENGTH)
const MAX_TOKEN_LENGTH = 500;
const MAX_USER_AGENT_LENGTH = 300;

function isValidToken(token) {
  return typeof token === "string" && token.trim().length > 0 && token.length <= MAX_TOKEN_LENGTH;
}

/**
 * ใช้ตัว token เองเป็น Firestore document id — Firestore ห้าม "/" ใน doc id
 * (FCM token ไม่เคยมี "/" ในทางปฏิบัติ แต่ encode ไว้กันเหนียว เผื่อ
 * รูปแบบ token เปลี่ยนในอนาคต) การใช้ token เป็น id ทำให้ POST ซ้ำ token
 * เดิมเป็น upsert อัตโนมัติ (ดู firestore-db.js's fcmTokensCol comment)
 */
function tokenDocId(token) {
  return encodeURIComponent(token);
}

// POST /api/fcm-tokens — ลงทะเบียน FCM token ของอุปกรณ์/เบราว์เซอร์นี้
// { token, userAgent? } — เรียกทุกครั้งที่ frontend ได้ token ใหม่จาก
// Firebase Messaging SDK (ตอนขอ permission ครั้งแรก หรือเมื่อ browser
// หมุนเวียน token ใหม่ให้ ซึ่งเกิดขึ้นเป็นครั้งคราวตาม FCM's own rotation)
router.post("/", async (req, res, next) => {
  try {
    const { token, userAgent } = req.body;
    if (!isValidToken(token)) {
      return res.status(400).json({ error: `token ต้องเป็น string ไม่ว่างเปล่า ยาวไม่เกิน ${MAX_TOKEN_LENGTH} ตัวอักษร` });
    }
    if (userAgent !== undefined && (typeof userAgent !== "string" || userAgent.length > MAX_USER_AGENT_LENGTH)) {
      return res.status(400).json({ error: `userAgent ต้องเป็น string ยาวไม่เกิน ${MAX_USER_AGENT_LENGTH} ตัวอักษร` });
    }

    await fcmTokensCol(req.userId).doc(tokenDocId(token)).set({
      token,
      userAgent: userAgent || null,
      // updatedAt เก็บเป็น client timestamp ธรรมดา (ไม่ใช่ Firestore
      // serverTimestamp()) ให้สอดคล้องกับ pattern ตัวเลข timestamp (ms)
      // ที่ reminders.js/routes อื่นในโปรเจกต์นี้ใช้อยู่แล้วทั้งหมด (เช่น
      // atMs, durationMs) แทนที่จะผสมสอง convention เข้าด้วยกัน
      updatedAt: Date.now()
    });

    res.status(201).json({ token });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/fcm-tokens/:token — เลิกลงทะเบียน token นี้ (ตอนผู้ใช้ปิด
// การแจ้งเตือนเองจาก Settings, หรือตอน token หมดอายุที่ Firebase Messaging
// SDK รายงานกลับมา) — :token ผ่าน URL param ต้อง decode/encode ให้ตรงกับ
// tokenDocId() ด้านบนเป๊ะๆ (Express decode req.params ให้อัตโนมัติอยู่แล้ว
// จึง encode กลับก่อนใช้เป็น doc id เหมือน POST)
router.delete("/:token", async (req, res, next) => {
  try {
    await fcmTokensCol(req.userId).doc(tokenDocId(req.params.token)).delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/fcm-tokens — ดู token ทั้งหมดที่ลงทะเบียนไว้ของ user นี้ (ใช้
// เพื่อ debug/แสดงรายการ "อุปกรณ์ที่เปิดแจ้งเตือนอยู่" ใน Settings ในอนาคต
// ถ้าต้องการ — ยังไม่มี UI ใช้งานจริงตอนนี้ เพิ่มไว้ตั้งแต่ต้นเพราะ CRUD
// resource ที่ดีควรมี read endpoint คู่กันเสมอ)
router.get("/", async (req, res, next) => {
  try {
    const snapshot = await fcmTokensCol(req.userId).get();
    const tokens = snapshot.docs.map((doc) => doc.data());
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
