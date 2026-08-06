const express = require("express");
const { db, categoriesCol, activityCategoriesCol } = require("../firestore-db.js");

const router = express.Router();

const UNCATEGORIZED = { id: null, name: "ไม่ระบุหมวดหมู่", color: "#9AA0A6" };

/**
 * Google Calendar ส่ง instance id ของ recurring event มาในรูป
 * "<baseId>_<YYYYMMDDTHHmmssZ>" เมื่อใช้ singleEvents=true — แต่
 * activityCategories ใน Firestore เก็บด้วย base id เท่านั้น (ดู normalizeId
 * ใน routes/activity-categories.js) ต้อง strip suffix นี้ออกก่อน lookup
 * เช่นกัน มิฉะนั้นกิจกรรมที่ทำซ้ำจะไม่เจอหมวดหมู่ที่ตั้งไว้เลยในหน้าสรุป
 * (ตกไปอยู่ใน "ไม่ระบุหมวดหมู่" เสมอ) — ฟังก์ชันนี้ไม่เปลี่ยนจากตอนใช้
 * db.json เลย เพราะเป็นปัญหาจาก Google Calendar API ไม่ใช่จาก storage layer
 */
function normalizeId(activityId) {
  return activityId.replace(/_\d{8}T\d{6}Z$/, "");
}

const WEEKDAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const WEEKDAY_TH_FULL = {
  "อา": "อาทิตย์", "จ": "จันทร์", "อ": "อังคาร", "พ": "พุธ",
  "พฤ": "พฤหัสบดี", "ศ": "ศุกร์", "ส": "เสาร์"
};

/**
 * POST /api/summary/week
 * Body: { activities: [{ id, summary, start: ISOString, end: ISOString }] }
 *
 * รับกิจกรรมของสัปดาห์จาก frontend (ที่ดึงมาจาก Google Calendar อยู่แล้ว)
 * แล้วคำนวณสรุป: จำนวนกิจกรรม, สัดส่วนตามหมวดหมู่, วันที่ยุ่งที่สุด, insight
 */
router.post("/week", async (req, res, next) => {
  try {
    const { activities } = req.body;
    if (!Array.isArray(activities)) {
      return res.status(400).json({ error: "ต้องส่ง activities เป็น array" });
    }

    // ดึงหมวดหมู่ทั้งหมดมาไว้ล่วงหน้า (จำนวนน้อย ไม่กี่สิบรายการ อ่านรวด
    // เดียวคุ้มกว่า query ทีละ id) — เหมือน categoryById เดิมที่ทำใน memory
    // (Phase 2: scope ด้วย req.userId — เห็นแค่หมวดหมู่ของตัวเองเท่านั้น)
    const categoriesSnapshot = await categoriesCol(req.userId).get();
    const categoryById = {};
    categoriesSnapshot.docs.forEach((doc) => {
      categoryById[doc.id] = { id: doc.id, ...doc.data() };
    });

    // ต่างจาก categories (โหลดทั้งหมดคุ้มกว่า) — activityCategories อาจมี
    // เยอะกว่ามากตามระยะเวลาที่ใช้แอป จึง batch-fetch เฉพาะ id ของกิจกรรม
    // สัปดาห์นี้เท่านั้น ด้วย getAll() ซึ่งยิง request เดียวได้หลาย doc พร้อม
    // กัน (ต่างจาก Promise.all ที่ยิงทีละ request) — ประหยัดกว่าการโหลดทั้ง
    // collection แบบที่ db.json ทำ (เพราะไฟล์ทั้งก้อนอยู่ใน memory อยู่แล้ว)
    const normalizedIds = [...new Set(activities.map((a) => normalizeId(a.id)))];
    const activityCategoryById = {};
    if (normalizedIds.length > 0) {
      const refs = normalizedIds.map((id) => activityCategoriesCol(req.userId).doc(id));
      const docs = await db.getAll(...refs);
      docs.forEach((doc) => {
        if (doc.exists) activityCategoryById[doc.id] = doc.data().categoryId;
      });
    }

    const minutesByCategory = {}; // categoryId -> minutes
    const countByDay = {}; // "อา".."ส" -> count
    let totalMinutes = 0;

    for (const activity of activities) {
      const start = new Date(activity.start);
      const end = new Date(activity.end);
      const durationMin = Math.max(0, (end - start) / 60000) || 30; // all-day/zero-length activities count as 30min

      const categoryId = activityCategoryById[normalizeId(activity.id)] || null;
      minutesByCategory[categoryId] = (minutesByCategory[categoryId] || 0) + durationMin;
      totalMinutes += durationMin;

      const dayLabel = WEEKDAY_TH[start.getDay()];
      countByDay[dayLabel] = (countByDay[dayLabel] || 0) + 1;
    }

    const byCategory = Object.entries(minutesByCategory)
      .map(([categoryId, minutes]) => {
        const cat = categoryId === "null" || categoryId === null
          ? UNCATEGORIZED
          : categoryById[categoryId] || UNCATEGORIZED;
        return {
          categoryId: cat.id,
          name: cat.name,
          color: cat.color,
          minutes: Math.round(minutes),
          percent: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0
        };
      })
      .sort((a, b) => b.minutes - a.minutes);

    const busiestDayEntry = Object.entries(countByDay).sort((a, b) => b[1] - a[1])[0];
    const busiestDay = busiestDayEntry
      ? { day: busiestDayEntry[0], count: busiestDayEntry[1] }
      : null;

    const insight = buildInsight(byCategory, busiestDay, activities.length);

    res.json({
      totalActivities: activities.length,
      busiestDay,
      byCategory,
      insight
    });
  } catch (err) {
    next(err);
  }
});

function buildInsight(byCategory, busiestDay, totalActivities) {
  if (totalActivities === 0) {
    return "สัปดาห์นี้ยังไม่มีกิจกรรม";
  }
  const top = byCategory[0];
  const parts = [];
  if (top && top.percent >= 40) {
    parts.push(`สัปดาห์นี้เวลาส่วนใหญ่ (${top.percent}%) อยู่ที่หมวด "${top.name}"`);
  }
  if (busiestDay) {
    parts.push(`วัน${WEEKDAY_TH_FULL[busiestDay.day]}ยุ่งที่สุด ด้วย ${busiestDay.count} กิจกรรม`);
  }
  return parts.length > 0 ? parts.join(" — ") : `สัปดาห์นี้มี ${totalActivities} กิจกรรม กระจายค่อนข้างสมดุล`;
}

module.exports = router;
