const express = require("express");
const { randomUUID } = require("crypto");
const { db, reminderGroupsCol, remindersCol } = require("../firestore-db.js");

const router = express.Router();

// Validation เหมือน categories.js เป๊ะๆ (migration plan v2 เฟส 3 ตั้งใจให้
// เดินตาม pattern เดียวกับ categoriesCol ทุกจุด) — ไม่ import ข้ามไฟล์มา
// ใช้ร่วมกันเพราะ categories.js ไม่ได้ export ฟังก์ชันพวกนี้ออกมา (เป็น
// module-private) การ duplicate เล็กน้อยแบบนี้ยังดีกว่าดึง dependency ข้าม
// route ที่ไม่เกี่ยวข้องกันโดยตรง
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function isValidColor(color) {
  return typeof color === "string" && HEX_COLOR_RE.test(color);
}

const NAME_MAX_LENGTH = 60;

function isValidName(name) {
  return typeof name === "string" && name.trim().length > 0 && name.length <= NAME_MAX_LENGTH;
}

// GET /api/reminder-groups — รายการกลุ่มทั้งหมดของ user ที่ login อยู่
router.get("/", async (req, res, next) => {
  try {
    const snapshot = await reminderGroupsCol(req.userId).get();
    const groups = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// POST /api/reminder-groups — สร้างกลุ่มใหม่ { name, color }
router.post("/", async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!isValidName(name)) {
      return res.status(400).json({ error: `name ต้องเป็น string ไม่ว่างเปล่า ยาวไม่เกิน ${NAME_MAX_LENGTH} ตัวอักษร` });
    }
    if (!isValidColor(color)) {
      return res.status(400).json({ error: "color ต้องเป็น hex สี 6 หลัก เช่น #1557B0" });
    }
    const id = randomUUID();
    const trimmedName = name.trim();
    await reminderGroupsCol(req.userId).doc(id).set({ name: trimmedName, color });
    res.status(201).json({ id, name: trimmedName, color });
  } catch (err) {
    next(err);
  }
});

// PUT /api/reminder-groups/:id — แก้ไขชื่อ/สีกลุ่ม
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    if (name !== undefined && !isValidName(name)) {
      return res.status(400).json({ error: `name ต้องเป็น string ไม่ว่างเปล่า ยาวไม่เกิน ${NAME_MAX_LENGTH} ตัวอักษร` });
    }
    if (color !== undefined && !isValidColor(color)) {
      return res.status(400).json({ error: "color ต้องเป็น hex สี 6 หลัก เช่น #1557B0" });
    }

    const docRef = reminderGroupsCol(req.userId).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "ไม่พบกลุ่มนี้" });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;
    await docRef.update(updates);

    const updated = await docRef.get();
    res.json({ id, ...updated.data() });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reminder-groups/:id — ลบกลุ่ม
//
// ต่างจาก categories.js's DELETE (ที่ลบ document mapping แยกใน
// activityCategoriesCol ทิ้งทั้งอัน) — reminder เก็บ groupId เป็น field
// อยู่บนตัว document ของตัวเองตรงๆ (ดู firestore-db.js's reminderGroupsCol
// comment) ดังนั้นสิ่งที่ต้องทำตอนลบกลุ่มคือ "เคลียร์ groupId เป็น null"
// บน reminder ทุกตัวที่เคยผูกไว้ ไม่ใช่ลบ reminder หรือลบ document ผูก —
// สอดคล้องกับคำตอบเฟส 0 ข้อ 1 ที่ล็อกไว้ (ลบกลุ่มแล้ว fallback เป็น
// "ไม่มีกลุ่ม" ไม่ใช่ลบ reminder ทิ้ง)
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = reminderGroupsCol(req.userId).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "ไม่พบกลุ่มนี้" });
    }

    const linkedSnapshot = await remindersCol(req.userId).where("groupId", "==", id).get();
    const batch = db.batch();
    batch.delete(docRef);
    linkedSnapshot.docs.forEach((linkedDoc) => batch.update(linkedDoc.ref, { groupId: null }));
    await batch.commit();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
