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
const activityArchiveRouter = require("./routes/activity-archive.js");
const fcmTokensRouter = require("./routes/fcm-tokens.js");
const activityNotificationsRouter = require("./routes/activity-notifications.js");
const calendarAuthRouter = require("./routes/calendar-auth.js");
const calendarRouter = require("./routes/calendar.js");
const telegramRouter = require("./routes/telegram.js");
const announcementRouter = require("./routes/announcement.js");
const aiActivityDraftRouter = require("./routes/ai-activity-draft.js");
const assistantPreferencesRouter = require("./routes/assistant-preferences.js");
const { createDataLabExportRouter } = require("./routes/data-lab-export.js");
const { firestoreQuotaExhaustedPayload } = require("./lib/firestore-quota.js");

const app = express();
const PORT = process.env.PORT || 4000;
// Render วาง Express ไว้หลัง reverse proxy และส่ง X-Forwarded-For มาให้.
// ระบุจำนวน proxy ที่เชื่อถือได้ก่อนสร้าง rate limiter เพื่อไม่ให้
// express-rate-limit ปฏิเสธ request ปกติจาก public site.
app.set("trust proxy", 1);

// จำกัด CORS ให้รับ request จากโดเมน frontend ที่ deploy จริงเท่านั้น
// (เดิม cors() เปล่าๆ เปิดรับทุก origin — ใช้ได้ตอน dev แต่ไม่ควรเปิดกว้าง
// ขนาดนั้นตอน deploy จริง แม้จะมี Firebase Auth คุ้มกันชั้นในอยู่แล้วก็ตาม)
// FRONTEND_URL คือ canonical frontend ที่ OAuth redirect กลับไป ส่วน
// FRONTEND_CORS_ORIGINS รองรับ origin เก่าระหว่างย้าย custom domain โดย
// คั่นหลายค่าด้วย comma และถอดออกได้หลัง cutover เสร็จ
// `Origin` header ไม่มี path (เช่น https://arsenpual.github.io) แต่
// FRONTEND_URL ต้องเก็บ path ของ GitHub Pages ไว้ด้วยเพื่อใช้ redirect กลับ
// หลัง OAuth (เช่น .../a-times-the-calendar/) จึงต้องแปลงเป็น origin ก่อน
// นำมาใช้กับ CORS เสมอ
function toOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((url) => toOrigin(url.trim()))
    .filter(Boolean);
}

const allowedOrigins = [...new Set([
  "http://localhost:5173",
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.FRONTEND_CORS_ORIGINS)
].filter(Boolean))];

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

// Once Firestore reports a depleted daily quota, sending every open browser
// tab back into Firestore cannot succeed and only floods Render logs. Keep a
// short in-memory circuit open, serve the same structured 503 directly, then
// probe Firestore again at most once every five minutes. The frontend still
// receives the actual daily reset estimate and pauses its reminder poll until
// that time.
const FIRESTORE_QUOTA_PROBE_INTERVAL_MS = 5 * 60 * 1000;
let firestoreQuotaCircuit = null;

function sendFirestoreQuotaUnavailable(res, quota) {
  const retryAfterSeconds = Math.max(60, Math.ceil((new Date(quota.resetsAt).getTime() - Date.now()) / 1000));
  res.set("Retry-After", String(retryAfterSeconds));
  return res.status(503).json({
    code: "FIRESTORE_QUOTA_EXHAUSTED",
    error: "โควต้า Firestore หมดชั่วคราว กรุณารอให้โควต้ารีเซ็ตหรือเปิดใช้ Billing แล้วลองใหม่",
    retryAfterSeconds,
    quota
  });
}

app.use((req, res, next) => {
  if (!firestoreQuotaCircuit) return next();
  if (Date.now() >= firestoreQuotaCircuit.probeAfter) {
    firestoreQuotaCircuit = null;
    return next();
  }
  return sendFirestoreQuotaUnavailable(res, firestoreQuotaCircuit.quota);
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
app.use("/api/activity-archive", requireAuth, activityArchiveRouter);
app.use("/api/activity-notifications", requireAuth, activityNotificationsRouter);
app.use("/api/fcm-tokens", requireAuth, fcmTokensRouter);
app.use("/api/calendar-auth", requireAuth, calendarAuthRouter);
app.use("/api/calendar", requireAuth, calendarRouter);
app.use("/api/announcement", requireAuth, announcementRouter);
app.use("/api/assistant-preferences", requireAuth, assistantPreferencesRouter);
app.use("/api/data-lab", requireAuth, createDataLabExportRouter());
// Gemini is used only to propose a draft. The client still confirms before
// saving anything to Google Calendar.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const resetAt = req.rateLimit?.resetTime?.getTime?.() || Date.now() + options.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    res.status(options.statusCode).json({
      error: "เรียกผู้ช่วย AI ถี่เกินไป",
      retryAfterSeconds,
      retryAfterAt: new Date(resetAt).toISOString()
    });
  }
});
app.use("/api/ai", requireAuth, aiLimiter, aiActivityDraftRouter);
// Telegram ไม่มี Firebase token; ยืนยันด้วย secret header ที่ setWebhook
// กำหนดไว้แทน จึงต้องประกาศก่อน 404 handler.
app.post("/api/telegram/webhook", telegramRouter.webhook);
app.use("/api/telegram", requireAuth, telegramRouter);
// OAuth callback มาจาก Google จึงไม่มี Firebase Authorization header;
// state ที่ลงลายเซ็นไว้ผูก callback กลับเข้ากับ uid อย่างปลอดภัยแทน.
app.get("/oauth/google/calendar/callback", calendarAuthRouter.callback);

app.use((req, res) => {
  res.status(404).json({ error: "ไม่พบ endpoint นี้" });
});

// error handler กลาง — เดิม db.js เป็น sync ล้วน ข้อผิดพลาด (เช่น JSON เสีย)
// ถูกจัดการอยู่ในตัวมันเองแบบ synchronous เสมอ แต่ Firestore SDK เป็น async
// ทั้งหมด (network, permission, quota ฯลฯ) จึงต้องมี error handler กลางรับ
// next(err) จากทุก route แทน ไม่งั้น unhandled rejection จะทำให้ request
// ค้างไม่ตอบอะไรกลับไปเลยแทนที่จะได้ 500 พร้อมเหตุผล
app.use((err, req, res, next) => {
  if (err.code === "CALENDAR_REAUTH_REQUIRED") {
    return res.status(428).json({ code: err.code, error: err.message });
  }
  // Firestore gRPC code 8 = RESOURCE_EXHAUSTED. การตอบ 500 ทำให้ frontend
  // มองเป็น server crash และ retry รัว ทั้งที่ต้องรอ quota reset/เปิด billing
  // จึงตอบ 503 พร้อม Retry-After ให้ client ชะลออย่างชัดเจน
  const firestoreQuotaExceeded =
    err.code === 8 || err.code === "8" || err.code === "RESOURCE_EXHAUSTED" || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(err.message || "");
  if (firestoreQuotaExceeded) {
    const quota = firestoreQuotaExhaustedPayload();
    if (!firestoreQuotaCircuit) {
      console.warn(`[times-the-calendar backend] Firestore quota exhausted; pause Firestore requests until probe at ${new Date(Date.now() + FIRESTORE_QUOTA_PROBE_INTERVAL_MS).toISOString()}`);
    }
    firestoreQuotaCircuit = {
      quota,
      probeAfter: Date.now() + FIRESTORE_QUOTA_PROBE_INTERVAL_MS
    };
    return sendFirestoreQuotaUnavailable(res, quota);
  }
  console.error("[times-the-calendar backend] unhandled error:", err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({ error: err.message || "เกิดข้อผิดพลาดฝั่ง backend — ดู log เซิร์ฟเวอร์" });
});

// Phase 2: ตัด ensureDefaultCategories() ตอน startup ออก — ของเดิม (Phase
// 0-1) seed หมวดเริ่มต้นให้ collection กลางระดับ root ครั้งเดียวตอน server
// เริ่มทำงาน แต่ตอนนี้แต่ละ user มี categories subcollection เป็นของตัวเอง
// ใต้ users/{userId}/... จึงไม่มี "collection กลาง" ให้ seed ล่วงหน้าได้อีก
// ต่อไป — seed เกิดขึ้นต่อ user แบบ lazy เมื่อเรียก GET /api/categories
// เท่านั้น เพื่อไม่เพิ่ม Firestore read ให้ทุก authenticated endpoint
app.listen(PORT, () => {
  console.log(`times-the-calendar backend รันที่ http://localhost:${PORT}`);
  const webhookBaseUrl = process.env.TELEGRAM_WEBHOOK_BASE_URL || process.env.RENDER_EXTERNAL_URL || "https://times-the-calendar-backend.onrender.com";
  const retryDelaysMs = [3_000, 10_000, 30_000];
  const registerTelegramWebhook = (attempt = 0) => {
    telegramRouter.registerWebhook(webhookBaseUrl).catch((error) => {
      // Render can briefly lack outbound DNS/network readiness just after a
      // deploy. Outgoing notifications may work later, but Telegram commands
      // require this initial webhook registration, so retry without a redeploy.
      const reason = error?.cause?.message || error?.message || String(error);
      console.error(`[telegram] ตั้ง webhook อัตโนมัติไม่สำเร็จ (ครั้งที่ ${attempt + 1}):`, reason);
      if (attempt >= retryDelaysMs.length) return;
      const delay = retryDelaysMs[attempt];
      console.log(`[telegram] จะลองตั้ง webhook ใหม่ใน ${delay / 1000} วินาที`);
      setTimeout(() => registerTelegramWebhook(attempt + 1), delay);
    });
  };
  registerTelegramWebhook();
  // The former standalone AI bot is retired. If its token remains configured
  // during migration, stop Telegram from delivering updates to the removed
  // endpoint. This does not delete its chat history or pending updates.
  if (process.env.TELEGRAM_AI_BOT_TOKEN) {
    fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_AI_BOT_TOKEN}/deleteWebhook`, { method: "POST" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) throw new Error(result.description || String(response.status));
        console.log("[telegram-ai] ปิด webhook ของบอต AI แยกแล้ว");
      })
      .catch((error) => console.error("[telegram-ai] ปิด webhook ของบอต AI แยกไม่สำเร็จ:", error.message));
  }
});
