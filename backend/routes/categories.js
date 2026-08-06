const express = require("express");
const { randomUUID } = require("crypto");
const { db, categoriesCol, activityCategoriesCol } = require("../firestore-db.js");

const router = express.Router();

// ต้องเป็น hex สี 6 หลัก เช่น #1557B0 — บังคับ format นี้เพราะ frontend เอา
// ค่านี้ไปต่อ string ตรงๆ ทำ alpha-tint (`${color}33` ใน activityColors.js)
// ถ้า format ผิดจะได้ CSS color ที่ invalid แล้ว browser เงียบๆ ไม่แสดงสีเลย
// โดยไม่มี error ให้เห็น จึงเช็คตั้งแต่ตรงนี้แทน
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function isValidColor(color) {
  return typeof color === "string" && HEX_COLOR_RE.test(color);
}

// GET /api/categories — list all life areas ของ user ที่ login อยู่
// (requireAuth แนบ req.userId ไว้ให้แล้วก่อนถึง route นี้เสมอ)
router.get("/", async (req, res, next) => {
  try {
    const snapshot = await categoriesCol(req.userId).get();
    const categories = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /api/categories — create a new life area { name, color }
router.post("/", async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name || !color) {
      return res.status(400).json({ error: "ต้องระบุ name และ color" });
    }
    if (!isValidColor(color)) {
      return res.status(400).json({ error: "color ต้องเป็น hex สี 6 หลัก เช่น #1557B0" });
    }
    const id = randomUUID();
    await categoriesCol(req.userId).doc(id).set({ name, color });
    res.status(201).json({ id, name, color });
  } catch (err) {
    next(err);
  }
});

// PUT /api/categories/:id — update a life area's name/color
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    if (color !== undefined && !isValidColor(color)) {
      return res.status(400).json({ error: "color ต้องเป็น hex สี 6 หลัก เช่น #1557B0" });
    }

    const docRef = categoriesCol(req.userId).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "ไม่พบหมวดหมู่นี้" });
    }

    const updates = {};
    if (name) updates.name = name;
    if (color) updates.color = color;
    await docRef.update(updates);

    const updated = await docRef.get();
    res.json({ id, ...updated.data() });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/categories/:id — remove a life area
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = categoriesCol(req.userId).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "ไม่พบหมวดหมู่นี้" });
    }

    // ลบ mapping ของกิจกรรมที่เคยผูกกับหมวดหมู่นี้ด้วย (พฤติกรรมเดิมจาก
    // db.js) — query หา activityCategories (ใต้ user เดียวกัน) ทุก doc ที่
    // categoryId ตรงกับหมวดหมู่ที่กำลังลบ แล้วลบเป็น batch เดียว (สูงสุด
    // 500 ops/batch ตามข้อจำกัดของ Firestore ซึ่งเกินพอสำหรับ scale ของ
    // prototype นี้มาก)
    const linkedSnapshot = await activityCategoriesCol(req.userId).where("categoryId", "==", id).get();
    const batch = db.batch();
    batch.delete(docRef);
    linkedSnapshot.docs.forEach((linkedDoc) => batch.delete(linkedDoc.ref));
    await batch.commit();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
