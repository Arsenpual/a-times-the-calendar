const express = require("express");
const { categoriesCol, activityCategoriesCol, activityTagsCol, lockedActivitiesCol } = require("../firestore-db.js");

const router = express.Router();

/**
 * Google Calendar ส่ง instance id ของ recurring event มาในรูป
 * "<baseId>_<timestamp>" (เช่น "abc123_20260801T040000Z") เมื่อใช้
 * singleEvents=true — แต่ base event id คือ "abc123" เท่านั้น
 *
 * การเก็บ instance id ตรงๆ ทำให้สัปดาห์อื่น (ที่ยัง ไม่เคย assign) lookup
 * ไม่เจอ เพราะ timestamp ต่างกัน → สีหาย
 *
 * แก้โดย strip suffix "_<timestamp>" ออกก่อนทุกครั้งที่ read/write ให้
 * recurring event ทุก occurrence แชร์ document เดียวกันใน Firestore —
 * ฟังก์ชันนี้ไม่เปลี่ยนจากตอนใช้ db.json เลย เพราะเป็นปัญหาจาก Google
 * Calendar API ไม่เกี่ยวกับ storage layer (ดู firebase-migration-plan.md)
 */
function normalizeId(activityId) {
  // รูปแบบ: <baseId>_<YYYYMMDDTHHmmssZ> — underscore ตามด้วย timestamp UTC
  return activityId.replace(/_\d{8}T\d{6}Z$/, "");
}

// GET /api/activities/categories — ดึง mapping ทั้งหมด { [activityId]: categoryId }
// ของ user ที่ login อยู่ (ใช้แทนการยิงทีละกิจกรรมตอน frontend โหลดสัปดาห์หนึ่งๆ)
router.get("/categories", async (req, res, next) => {
  try {
    const snapshot = await activityCategoriesCol(req.userId).get();
    const mapping = {};
    snapshot.docs.forEach((doc) => {
      mapping[doc.id] = doc.data().categoryId;
    });
    res.json(mapping);
  } catch (err) {
    next(err);
  }
});

// GET /api/activities/:activityId/category — ดูว่ากิจกรรมนี้ผูกกับหมวดหมู่ไหน
router.get("/:activityId/category", async (req, res, next) => {
  try {
    const id = normalizeId(req.params.activityId);
    const doc = await activityCategoriesCol(req.userId).doc(id).get();
    const categoryId = doc.exists ? doc.data().categoryId : null;
    res.json({ activityId: id, categoryId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/activities/:activityId/category — ผูก/เปลี่ยนหมวดหมู่ของกิจกรรม { categoryId }
router.put("/:activityId/category", async (req, res, next) => {
  try {
    const { categoryId } = req.body;
    const id = normalizeId(req.params.activityId);

    // ต้องเป็น null (เอาหมวดหมู่ออก) หรือ non-empty string (id ของหมวดหมู่)
    // เท่านั้น — เดิมรับอะไรก็ได้ที่ !== null ตรงๆ (object, number, "",
    // undefined) แล้วส่งเข้า .doc(categoryId) ทันที ซึ่ง Firestore SDK จะ
    // throw TypeError ถ้า categoryId ไม่ใช่ string ทำให้ request จบด้วย 500
    // (unhandled-ish) แทนที่จะเป็น 400 ที่บอกสาเหตุชัดเจนแบบนี้
    if (categoryId !== null && (typeof categoryId !== "string" || categoryId.trim() === "")) {
      return res.status(400).json({ error: "categoryId ต้องเป็น null หรือ string ที่ไม่ว่างเปล่า" });
    }

    if (categoryId !== null) {
      const categoryDoc = await categoriesCol(req.userId).doc(categoryId).get();
      if (!categoryDoc.exists) {
        return res.status(400).json({ error: "ไม่พบหมวดหมู่ที่ระบุ" });
      }
      await activityCategoriesCol(req.userId).doc(id).set({ categoryId });
    } else {
      await activityCategoriesCol(req.userId).doc(id).delete();
    }

    res.json({ activityId: id, categoryId });
  } catch (err) {
    next(err);
  }
});

// Tag เดียวต้องไม่ว่างเปล่าและไม่ยาวเกินไป (กันพิมพ์มั่ว/วางข้อความยาวทั้งก้อน
// มาเป็น "1 tag" โดยไม่ตั้งใจ) — trim ให้แล้วก่อนเช็คความยาว ค่าจำกัดกว้าง
// พอสำหรับ free-text tag ทั่วไปแต่ไม่กว้างจนกลายเป็นช่องโน้ตที่สอง
const TAG_MAX_LENGTH = 40;
const TAGS_MAX_COUNT = 20;

function sanitizeTags(rawTags) {
  if (!Array.isArray(rawTags)) return null;
  const cleaned = [];
  const seen = new Set();
  for (const t of rawTags) {
    if (typeof t !== "string") return null;
    const trimmed = t.trim();
    if (!trimmed || trimmed.length > TAG_MAX_LENGTH) return null;
    // กันซ้ำแบบไม่สนตัวพิมพ์เล็ก-ใหญ่ ("Work" กับ "work" ถือเป็น tag เดียวกัน)
    // เก็บรูปแบบตัวพิมพ์ที่ผู้ใช้พิมพ์ครั้งแรกไว้ (ไม่บังคับ lowercase ทั้งหมด)
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
  }
  if (cleaned.length > TAGS_MAX_COUNT) return null;
  return cleaned;
}

// GET /api/activities/tags — ดึง mapping ทั้งหมด { [activityId]: string[] }
// ของ user ที่ login อยู่ (เรียกครั้งเดียวตอนโหลดสัปดาห์ เหมือน /categories และ /locks)
router.get("/tags", async (req, res, next) => {
  try {
    const snapshot = await activityTagsCol(req.userId).get();
    const mapping = {};
    snapshot.docs.forEach((doc) => {
      mapping[doc.id] = doc.data().tags || [];
    });
    res.json(mapping);
  } catch (err) {
    next(err);
  }
});

// PUT /api/activities/:activityId/tags — แทนที่ tag ทั้งชุดของกิจกรรมนี้ { tags: string[] }
// ส่ง tags: [] เพื่อล้าง tag ทั้งหมดออก (ลบ document ทิ้ง แทนที่จะเก็บ array ว่าง
// ไว้เฉยๆ — กัน document ค้างเปล่าไม่มีประโยชน์สะสมใน collection)
router.put("/:activityId/tags", async (req, res, next) => {
  try {
    const id = normalizeId(req.params.activityId);
    const tags = sanitizeTags(req.body.tags);

    if (tags === null) {
      return res.status(400).json({
        error: `tags ต้องเป็น array ของ string ไม่ว่างเปล่า แต่ละอันยาวไม่เกิน ${TAG_MAX_LENGTH} ตัวอักษร และมีได้ไม่เกิน ${TAGS_MAX_COUNT} tag`
      });
    }

    if (tags.length === 0) {
      await activityTagsCol(req.userId).doc(id).delete();
    } else {
      await activityTagsCol(req.userId).doc(id).set({ tags });
    }

    res.json({ activityId: id, tags });
  } catch (err) {
    next(err);
  }
});

// GET /api/activities/locks — ดึงสถานะ lock ทั้งหมด { [activityId]: true }
// ของ user ที่ login อยู่ (ใช้แทนการยิงทีละกิจกรรมตอน frontend โหลดสัปดาห์
// หนึ่งๆ เหมือน /categories)
router.get("/locks", async (req, res, next) => {
  try {
    const snapshot = await lockedActivitiesCol(req.userId).get();
    const locks = {};
    snapshot.docs.forEach((doc) => {
      locks[doc.id] = true;
    });
    res.json(locks);
  } catch (err) {
    next(err);
  }
});

// PUT /api/activities/:activityId/lock — ตั้ง/ปลด lock ของกิจกรรม { locked: boolean }
// กิจกรรมที่ถูก lock จะแก้ไข/ลาก/ลบใน timeline-editor และ context menu ไม่ได้
// จนกว่าจะปลดล็อกอีกครั้ง (ดู TimelineEditor.jsx ฝั่ง frontend)
router.put("/:activityId/lock", async (req, res, next) => {
  try {
    const { locked } = req.body;
    const id = normalizeId(req.params.activityId);

    // สำคัญ: ปลดล็อกต้อง .delete() document ทิ้งเสมอ ห้ามเปลี่ยนเป็น
    // .set({ locked: false }) — firestore.rules (ดู scripts/
    // firestore-rules.test.js เคส "locked: false ไม่ถือว่า lock") เผื่อ
    // กรณีนี้ไว้เป็น fallback เท่านั้น ไม่ใช่รูปแบบที่ตั้งใจให้เขียนจริง
    // การ .set({ locked: false }) แทน .delete() ยังคง "ปลอดภัย" ในแง่ที่
    // security rules ยังไม่ถือว่าล็อก แต่จะทิ้ง document เปล่าไม่มี
    // ประโยชน์ไว้ค้างใน collection ตลอดไป (ผิดกับ pattern เดียวกันที่
    // activityCategories/activityTags ใช้ — ลบ document เมื่อไม่มีค่าที่
    // มีความหมายให้เก็บ)
    if (locked) {
      await lockedActivitiesCol(req.userId).doc(id).set({ locked: true });
    } else {
      await lockedActivitiesCol(req.userId).doc(id).delete();
    }

    res.json({ activityId: id, locked: !!locked });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
