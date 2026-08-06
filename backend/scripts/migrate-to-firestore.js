/**
 * ⚠️ DEPRECATED (Phase 2 — Firebase Auth): สคริปต์นี้เขียนไป collection
 * กลางระดับ root (categories/{id}, activityCategories/{id},
 * lockedActivities/{id}) ซึ่ง Phase 2 เปลี่ยนโครงสร้างเป็น
 * users/{userId}/categories/{id} ฯลฯ แทนแล้ว — ฟังก์ชัน categoriesCol() /
 * activityCategoriesCol() / lockedActivitiesCol() ที่ import มาด้านล่างนี้
 * ตอนนี้เป็น function ที่ต้องการ userId argument ไม่ใช่ collection ref
 * คงที่แบบเดิมอีกต่อไป — สคริปต์นี้เรียกแบบเดิม (ไม่ส่ง userId) จะ error
 * ทันทีถ้ารัน
 *
 * ทีมตัดสินใจไม่ migrate ข้อมูล global เดิม (6 หมวดหมู่, 31 mapping, 2
 * locked) ไปผูกกับ userId ใดๆ — ผู้ใช้ใหม่ทุกคนเริ่มจาก categories
 * subcollection ว่างเปล่า แล้วได้ 4 หมวดเริ่มต้น seed ให้อัตโนมัติผ่าน
 * ensureDefaultCategoriesForUser() แทน (ดู firestore-db.js) เมื่อ login
 * ครั้งแรก — ข้อมูล global เดิมใน root-level collections (ถ้ายังหลงเหลือ
 * อยู่ใน Firestore จาก Phase 1) จะไม่ถูกอ่านหรือเขียนโดยโค้ดชุดปัจจุบัน
 * อีกต่อไป ปล่อยทิ้งไว้เฉยๆ ได้ ไม่กระทบอะไร (ลบเองด้วยมือทีหลังได้ถ้า
 * ต้องการเคลียร์ Firestore ให้สะอาด)
 *
 * เก็บไฟล์นี้ไว้เป็นข้อมูลอ้างอิงประวัติ Phase 1 เท่านั้น ไม่ต้องรันอีก
 *
 * ---- เอกสารเดิมของสคริปต์ (Phase 1, ใช้งานได้ตอนนั้น) ----
 * สคริปต์ migration รันครั้งเดียวตอน cutover จาก data/db.json ไปยัง
 * Firestore (ระยะ 1 ตาม firebase-migration-plan.md ขั้นตอนที่ 2)
 *
 * วิธีรัน (จาก root ของ backend/):
 *   node scripts/migrate-to-firestore.js
 *
 * สิ่งที่สคริปต์นี้ทำ:
 *   1. อ่าน data/db.json ตรงๆ ด้วย fs (ไม่ผ่าน db.js เดิม เพื่อไม่ให้พึ่งพา
 *      โมดูลที่กำลังจะถูกเลิกใช้ และเห็นข้อมูลดิบจริงๆ ไม่ผ่าน migrateLegacyKeys())
 *   2. เขียนแต่ละ key เข้า Firestore ตามโครงสร้าง collection ใหม่
 *   3. รายงานสรุปว่าย้ายไปกี่รายการ ไม่เขียนทับถ้า Firestore มีข้อมูลอยู่แล้ว
 *      (กันรันซ้ำโดยไม่ตั้งใจแล้วข้อมูลชนกัน) เว้นแต่ส่ง --force
 *
 * ไม่ได้ลบ data/db.json ต้นฉบับ — ตามแผนให้เก็บไว้เป็น backup ระยะหนึ่งก่อน
 * ค่อยลบทิ้งเองด้วยมือหลังยืนยันว่า Firestore ทำงานถูกต้องแล้ว
 */
throw new Error(
  "[migrate-to-firestore.js] deprecated ตั้งแต่ Phase 2 (Firebase Auth) — " +
    "โครงสร้าง Firestore เปลี่ยนเป็น users/{userId}/... แล้ว และทีมตัดสินใจไม่ " +
    "migrate ข้อมูล global เดิม ดูคอมเมนต์ด้านบนของไฟล์นี้"
);

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const { db, categoriesCol, activityCategoriesCol, lockedActivitiesCol } = require("../firestore-db.js");

const DB_JSON_PATH = path.join(__dirname, "..", "data", "db.json");
const FORCE = process.argv.includes("--force");

/**
 * เผื่อไฟล์ db.json เดิมยังใช้ชื่อคีย์รุ่นก่อน (eventCategories/lockedEvents)
 * — ก๊อปมาจาก migrateLegacyKeys() ใน db.js เดิมเพื่อให้ migration ถูกต้อง
 * แม้ไฟล์ยังไม่เคยผ่าน readDB() มาก่อนเลยสักครั้ง (ซึ่งปกติจะ migrate คีย์
 * พวกนี้ให้อัตโนมัติตอน backend รันอยู่ทุกครั้ง แต่สคริปต์นี้อ่านไฟล์ดิบตรงๆ)
 */
function migrateLegacyKeys(data) {
  const activityCategories = data.activityCategories || data.eventCategories || {};
  const lockedActivities = data.lockedActivities || data.lockedEvents || {};
  return { ...data, activityCategories, lockedActivities };
}

async function collectionHasData(col) {
  const snapshot = await col.limit(1).get();
  return !snapshot.empty;
}

async function main() {
  if (!fs.existsSync(DB_JSON_PATH)) {
    console.log(`[migrate] ไม่พบไฟล์ ${DB_JSON_PATH} — ไม่มีอะไรให้ย้าย ข้ามสคริปต์นี้ได้เลย`);
    process.exit(0);
  }

  const raw = fs.readFileSync(DB_JSON_PATH, "utf-8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`[migrate] ${DB_JSON_PATH} เป็น JSON ที่เสีย อ่านไม่ได้: ${err.message}`);
    process.exit(1);
  }
  data = migrateLegacyKeys(data);

  const categories = Array.isArray(data.categories) ? data.categories : [];
  const activityCategories = data.activityCategories || {};
  const lockedActivities = data.lockedActivities || {};

  console.log(
    `[migrate] พบใน db.json: ${categories.length} หมวดหมู่, ` +
      `${Object.keys(activityCategories).length} activity-category mapping, ` +
      `${Object.keys(lockedActivities).length} locked activities`
  );

  if (!FORCE) {
    const [hasCategories, hasActivityCategories, hasLockedActivities] = await Promise.all([
      collectionHasData(categoriesCol),
      collectionHasData(activityCategoriesCol),
      collectionHasData(lockedActivitiesCol)
    ]);
    if (hasCategories || hasActivityCategories || hasLockedActivities) {
      console.error(
        "[migrate] Firestore มีข้อมูลอยู่แล้วอย่างน้อย 1 collection — หยุดไว้กันเขียนทับโดยไม่ตั้งใจ\n" +
          "ถ้าตั้งใจจะเขียนทับจริงๆ (เช่น รัน migration ซ้ำหลังแก้ db.json) รันใหม่พร้อม --force:\n" +
          "  node scripts/migrate-to-firestore.js --force"
      );
      process.exit(1);
    }
  } else {
    console.log("[migrate] ใช้ --force — จะเขียนทับข้อมูลใน Firestore ที่มีอยู่แล้ว (ถ้ามี)");
  }

  // Firestore batch เขียนได้สูงสุด 500 operations/batch — เกินพอสำหรับ
  // ขนาดข้อมูลของ prototype นี้ (ปกติหลักสิบ-หลักร้อยรายการ) จึงยังไม่ต้อง
  // แบ่งเป็นหลาย batch แต่เผื่ออนาคตข้อมูลโตเกิน 500 รายการรวมกันไว้ก่อน
  const totalOps = categories.length + Object.keys(activityCategories).length + Object.keys(lockedActivities).length;
  if (totalOps > 500) {
    console.error(
      `[migrate] มีทั้งหมด ${totalOps} รายการ เกินขีดจำกัด 500 ops/batch ของ Firestore — ` +
        "สคริปต์นี้ยังไม่รองรับการแบ่ง batch อัตโนมัติ ต้องแก้สคริปต์เพิ่มก่อนรัน"
    );
    process.exit(1);
  }

  const batch = db.batch();

  for (const cat of categories) {
    const { id, ...rest } = cat;
    if (!id) {
      console.warn("[migrate] ข้ามหมวดหมู่ที่ไม่มี id:", cat);
      continue;
    }
    batch.set(categoriesCol.doc(id), rest);
  }

  for (const [activityId, categoryId] of Object.entries(activityCategories)) {
    batch.set(activityCategoriesCol.doc(activityId), { categoryId });
  }

  for (const activityId of Object.keys(lockedActivities)) {
    batch.set(lockedActivitiesCol.doc(activityId), { locked: true });
  }

  await batch.commit();

  console.log(
    `[migrate] ย้ายข้อมูลสำเร็จ: ${categories.length} หมวดหมู่, ` +
      `${Object.keys(activityCategories).length} activity-category mapping, ` +
      `${Object.keys(lockedActivities).length} locked activities`
  );
  console.log(
    `[migrate] data/db.json ยังอยู่เหมือนเดิม (ไม่ได้ลบ) — เก็บไว้เป็น backup ` +
      "จนกว่าจะยืนยันว่า Firestore ทำงานถูกต้องแล้วค่อยลบเองด้วยมือ"
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] เกิดข้อผิดพลาดระหว่าง migration:", err);
  process.exit(1);
});
