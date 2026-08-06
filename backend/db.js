const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "db.json");

const DEFAULT_DATA = {
  // Life Areas — ผู้ใช้แก้ไข/เพิ่มได้ผ่าน /api/categories
  categories: [
    { id: "work", name: "งาน", color: "#1557B0" },
    { id: "personal", name: "ส่วนตัว", color: "#B71C1C" },
    { id: "health", name: "สุขภาพ", color: "#F29900" },
    { id: "family", name: "ครอบครัว", color: "#0B6B33" }
  ],
  // ผูก Google Calendar event id เข้ากับ category id: { [googleEventId]: categoryId }
  activityCategories: {},
  // event id ที่ถูก lock ไว้ ป้องกันการแก้ไข/ลาก/ลบใน timeline-editor และ context menu
  lockedActivities: {}
};

function ensureDbFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

/**
 * ถ้าไฟล์ db.json เสีย (เขียนไม่จบเพราะ process ถูก kill กลางคัน, แก้ไฟล์มือ
 * แล้วพลาด, ดิสก์มีปัญหา ฯลฯ) — เก็บสำเนาไฟล์ที่เสียไว้ก่อนเผื่อกู้คืนเองได้
 * ทีหลัง (data/db.json.corrupt-<timestamp>) แล้วค่อยคืนค่า null ให้ readDB()
 * ไปสร้าง DEFAULT_DATA ใหม่แทนที่จะปล่อยให้ JSON.parse throw จน endpoint
 * ทุกตัวที่เรียก readDB() พังหมดทั้งระบบ
 */
function backupCorruptFile(raw) {
  try {
    const backupPath = `${DB_PATH}.corrupt-${Date.now()}`;
    fs.writeFileSync(backupPath, raw);
    console.error(
      `[db] db.json เสียหาย อ่านไม่ได้ — สำรองไฟล์เดิมไว้ที่ ${backupPath} แล้วจะสร้าง db.json ใหม่จากค่าเริ่มต้น`
    );
  } catch (backupErr) {
    console.error("[db] สำรองไฟล์ db.json ที่เสียหายไม่สำเร็จ:", backupErr.message);
  }
}

/**
 * เผื่อไฟล์ db.json เดิมที่ยังใช้ชื่อคีย์รุ่นก่อน (eventCategories /
 * lockedEvents จากตอนแอปยังเรียก "นัดหมาย/event") ย้ายข้อมูลมาเก็บใต้ชื่อ
 * ใหม่ (activityCategories / lockedActivities) แบบไม่ทำข้อมูลหาย — ใช้ได้
 * ครั้งเดียวตอนโหลด ไฟล์จะถูกเขียนทับด้วยชื่อคีย์ใหม่ในครั้งถัดไปที่ writeDB ทำงาน
 */
function migrateLegacyKeys(data) {
  if (!data.activityCategories && data.eventCategories) {
    data.activityCategories = data.eventCategories;
  }
  if (!data.lockedActivities && data.lockedEvents) {
    data.lockedActivities = data.lockedEvents;
  }
  delete data.eventCategories;
  delete data.lockedEvents;
  return data;
}

function readDB() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (parseErr) {
    // ไฟล์เสีย — สำรองไว้แล้วเริ่มใหม่จาก DEFAULT_DATA แทนที่จะ throw จนทุก
    // endpoint พังไปด้วย ผู้ใช้จะเสียข้อมูลของสัปดาห์นี้ แต่แอปยังใช้งานต่อได้
    // (ดีกว่า backend ตายสนิททั้งระบบ)
    backupCorruptFile(raw);
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
    parsed = JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  const data = migrateLegacyKeys(parsed);
  if (!data.categories || !Array.isArray(data.categories)) {
    data.categories = JSON.parse(JSON.stringify(DEFAULT_DATA.categories));
  }
  if (!data.activityCategories) {
    data.activityCategories = {};
  }
  if (!data.lockedActivities) {
    data.lockedActivities = {};
  }
  return data;
}

/**
 * เขียนไฟล์แบบ write-to-temp-then-rename แทนการเขียนทับ db.json ตรงๆ —
 * fs.rename เป็น atomic operation ในระดับ OS ดังนั้นถ้า process ถูก kill
 * หรือเครื่องดับกลางคัน จะไม่มีทางเจอ db.json ที่เขียนค้างครึ่งๆ กลางๆ
 * (ไฟล์เดิมจะยังอยู่ครบ หรือไฟล์ใหม่แทนที่สมบูรณ์ ไม่มีสถานะกึ่งกลาง)
 */
function writeDB(data) {
  ensureDbFile();
  const tmpPath = `${DB_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, DB_PATH);
}

module.exports = { readDB, writeDB };
