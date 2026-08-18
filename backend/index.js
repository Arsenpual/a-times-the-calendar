require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const { requireAuth } = require("./middleware/require-auth.js");
const categoriesRouter = require("./routes/categories.js");
const activityCategoriesRouter = require("./routes/activity-categories.js");
const summaryRouter = require("./routes/summary.js");
const remindersRouter = require("./routes/reminders.js");
const reminderGroupsRouter = require("./routes/reminder-groups.js");
const fcmTokensRouter = require("./routes/fcm-tokens.js");

const app = express();
const PORT = process.env.PORT || 4000;

// จำกัด CORS ให้รับ request จากโดเมน frontend ที่ deploy จริงเท่านั้น
// (เดิม cors() เปล่าๆ เปิดรับทุก origin — ใช้ได้ตอน dev แต่ไม่ควรเปิดกว้าง
// ขนาดนั้นตอน deploy จริง แม้จะมี Firebase Auth คุ้มกันชั้นในอยู่แล้วก็ตาม)
// FRONTEND_URL ตั้งเป็น env var แยกจาก origin dev (localhost:5173) เพื่อให้
// รันคู่กันได้ทั้งสองฝั่งระหว่าง deploy จริงกับพัฒนาต่อในเครื่อง
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: false
  })
);
app.use(express.json());

// จำกัดจำนวน request ต่อ IP ต่อ 15 นาที — เดิมไม่มี rate limiting เลยสัก
// จุดเดียว (ระบุไว้เป็นงานค้างใน overview.md) ทำให้ user ที่ login ถูกต้อง
// แล้ว (ผ่าน requireAuth) ยิง POST /api/categories, PUT /api/reminders/:id
// ฯลฯ ซ้ำไม่จำกัดจำนวนได้ — ไม่ใช่ช่องทางข้อมูล user อื่นรั่ว (Firestore
// rules + userId scoping ป้องกันอยู่แล้ว) แต่เป็นช่องทาง self-DoS/เพิ่ม
// ค่าใช้จ่าย Firestore โดยไม่ตั้งใจหรือเจตนาร้ายก็ได้ ตั้งไว้กว้างพอสำหรับ
// การใช้งานปกติ (ไม่บล็อกคนใช้จริง) แต่กันการยิงรัวๆ ผิดปกติ — ยังไม่ใช่
// rate limit แบบ per-user (ต้องรู้ userId ก่อนซึ่งมาจาก requireAuth ที่ทำงาน
// หลัง middleware นี้) แค่เป็นเกราะชั้นแรกระดับ IP ก่อน route ใดๆ ทั้งหมด
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600, // ~40 req/นาที ต่อ IP — เกินพอสำหรับการใช้งานปกติของแอปนี้
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "เรียก API ถี่เกินไป กรุณาลองใหม่อีกครั้งภายหลัง" }
});
app.use("/api", apiLimiter);

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Phase 2: ทุก route ที่แตะข้อมูล user (categories/activities/summary) ต้อง
// ผ่าน requireAuth ก่อนเสมอ — ตรวจ Firebase ID token แล้วแนบ req.userId ให้
// route handler ทุกตัวใช้ scope query ของตัวเอง ถ้า token ไม่ถูกต้อง/ไม่มี
// จะตอบ 401 ตั้งแต่ตรงนี้ ไม่ไปถึง route handler เลย — /api/health ไม่ผ่าน
// middleware นี้ เพราะเป็น endpoint เช็คสถานะ server เฉยๆ ไม่แตะข้อมูล user
app.use("/api/categories", requireAuth, categoriesRouter);
app.use("/api/activities", requireAuth, activityCategoriesRouter);
app.use("/api/summary", requireAuth, summaryRouter);
app.use("/api/reminders", requireAuth, remindersRouter);
// migration plan v2 เฟส 3 — Groups/Projects ของ reminder mode แยก route
// ต่างหากจาก /api/reminders เอง (แม้จะเก็บ groupId เป็น field บน reminder
// document ก็ตาม) เพราะ CRUD ของ "กลุ่ม" (สร้าง/แก้ไข/ลบกลุ่ม) เป็นคนละ
// resource กับ CRUD ของ reminder เอง — ตรงกับที่ categories.js แยกจาก
// activity-categories.js ฝั่งปฏิทินเช่นกัน
app.use("/api/reminder-groups", requireAuth, reminderGroupsRouter);
app.use("/api/fcm-tokens", requireAuth, fcmTokensRouter);

app.use((req, res) => {
  res.status(404).json({ error: "ไม่พบ endpoint นี้" });
});

// error handler กลาง — เดิม db.js เป็น sync ล้วน ข้อผิดพลาด (เช่น JSON เสีย)
// ถูกจัดการอยู่ในตัวมันเองแบบ synchronous เสมอ แต่ Firestore SDK เป็น async
// ทั้งหมด (network, permission, quota ฯลฯ) จึงต้องมี error handler กลางรับ
// next(err) จากทุก route แทน ไม่งั้น unhandled rejection จะทำให้ request
// ค้างไม่ตอบอะไรกลับไปเลยแทนที่จะได้ 500 พร้อมเหตุผล
app.use((err, req, res, next) => {
  console.error("[times-the-calendar backend] unhandled error:", err);
  res.status(500).json({ error: "เกิดข้อผิดพลาดฝั่ง backend — ดู log เซิร์ฟเวอร์" });
});

// Phase 2: ตัด ensureDefaultCategories() ตอน startup ออก — ของเดิม (Phase
// 0-1) seed หมวดเริ่มต้นให้ collection กลางระดับ root ครั้งเดียวตอน server
// เริ่มทำงาน แต่ตอนนี้แต่ละ user มี categories subcollection เป็นของตัวเอง
// ใต้ users/{userId}/... จึงไม่มี "collection กลาง" ให้ seed ล่วงหน้าได้อีก
// ต่อไป — seed เกิดขึ้นต่อ user แทน ผ่าน ensureDefaultCategoriesForUser()
// ที่ requireAuth middleware เรียกให้อัตโนมัติทุกครั้งที่ user คนนั้น login
// (ดู middleware/require-auth.js)
app.listen(PORT, () => {
  console.log(`times-the-calendar backend รันที่ http://localhost:${PORT}`);
});
