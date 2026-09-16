const crypto = require("crypto");
const express = require("express");
const { FieldValue } = require("firebase-admin/firestore");
const { db, telegramAuthDoc, telegramLinkDoc, telegramMessagesCol, telegramChatOwnerDoc, announcementDoc } = require("../firestore-db.js");
const { normalizeAnnouncementConfig } = require("../announcement-config.js");
const { answerTimesQuestion } = require("../skills/activity-creation/times-knowledge.js");

const router = express.Router();
const BOT_API = "https://api.telegram.org";
const LINK_TTL_MS = 10 * 60 * 1000;
const MAX_ANNOUNCEMENT_LENGTH = 500;
const DAILY_NOTIFICATION_LIMIT = 720;
const ANNOUNCEMENT_EDIT_TTL_MS = 10 * 60 * 1000;
const pendingAnnouncementMessageEdits = new Map();
const COMMAND_HELP_TEXT =
  "📚 คำสั่งของ MR.Zettascale\n\n" +
  "/start — เชื่อมต่อบัญชี T.i.M.E.S.\n" +
  "/cmd — ดูรายการคำสั่งนี้\n" +
  "/times — T.i.M.E.S. คืออะไร\n" +
  "/features — T.i.M.E.S. มีฟีเจอร์อะไรบ้าง\n" +
  "/myid — ดู Telegram chat ID ของคุณ\n" +
  "/announce — เปิดแผงตั้งค่า announcement-ticker (ผู้ดูแล)\n\n" +
  "คำสั่ง /announce ใช้ได้เฉพาะ Telegram chat ID ที่ผู้ดูแลอนุญาตไว้";
// ปุ่มลัดชั่วคราวใต้ช่องพิมพ์: Telegram จะซ่อน keyboard หลังผู้ใช้กด
// ปุ่มหนึ่งครั้ง แล้ว Bot Command Menu (สามขีด) ยังเป็นทางลัดถาวรเสมอ.
const CUSTOM_COMMAND_KEYBOARD = {
  keyboard: [[{ text: "/start" }, { text: "/cmd" }]],
  resize_keyboard: true,
  one_time_keyboard: true,
  input_field_placeholder: "เลือกคำสั่งด่วน หรือพิมพ์ข้อความ"
};

// The two roots belong in Telegram's persistent command menu. Everything
// underneath is deliberately an inline, contextual follow-up—similar to the
// guided question flow in the web Activity assistant, without invoking AI.
const PRODUCT_QUESTION_NODES = Object.freeze({
  times: {
    question: "times คืออะไร",
    buttons: [
      ["activity", "🗓️ Activity Mode"], ["reminder", "🔔 Reminder Mode"],
      ["calendar", "Google Calendar"], ["telegram", "Telegram แจ้งเตือน"],
      ["features", "ดูฟีเจอร์ทั้งหมด"]
    ]
  },
  features: {
    question: "times มีฟีเจอร์",
    buttons: [
      ["activity", "🗓️ วางแผนกิจกรรม"], ["reminder", "🔔 Reminder และ Buffer"],
      ["calendar", "Google Calendar และ Sync"], ["telegram", "Telegram"],
      ["assistant", "MR.Zettascale คืออะไร"]
    ]
  },
  activity: {
    question: "activity mode",
    buttons: [["times", "← ภาพรวม T.i.M.E.S."], ["features", "ฟีเจอร์ทั้งหมด"], ["reminder", "ดู Reminder Mode"]]
  },
  reminder: {
    question: "reminder มีประเภท",
    buttons: [["features", "← ฟีเจอร์ทั้งหมด"], ["activity", "ดู Activity Mode"], ["telegram", "การแจ้งเตือน Telegram"]]
  },
  calendar: {
    question: "google calendar",
    buttons: [["sync", "ข้อมูลซิงก์อย่างไร"], ["features", "← ฟีเจอร์ทั้งหมด"], ["times", "ภาพรวม T.i.M.E.S."]]
  },
  telegram: {
    question: "telegram",
    buttons: [["reminder", "ดู Reminder Mode"], ["sync", "ข้อมูลซิงก์อย่างไร"], ["features", "← ฟีเจอร์ทั้งหมด"]]
  },
  sync: {
    question: "ข้อมูลซิงก์ข้ามอุปกรณ์",
    buttons: [["calendar", "Google Calendar"], ["telegram", "Telegram"], ["times", "ภาพรวม T.i.M.E.S."]]
  },
  assistant: {
    question: "mr.zettascale",
    buttons: [["activity", "ดู Activity Mode"], ["features", "← ฟีเจอร์ทั้งหมด"], ["times", "ภาพรวม T.i.M.E.S."]]
  }
});

function productQuestionKeyboard(node) {
  return {
    inline_keyboard: node.buttons.map(([id, label]) => [{ text: label, callback_data: `product:${id}` }])
  };
}

function productQuestionResponse(nodeId) {
  const node = PRODUCT_QUESTION_NODES[nodeId] || PRODUCT_QUESTION_NODES.times;
  return {
    node,
    text: answerTimesQuestion(node.question) || "ผมยังไม่มีข้อมูลยืนยันเกี่ยวกับส่วนนั้นใน T.i.M.E.S. ครับ"
  };
}

function productNodeForText(text) {
  const normalized = String(text || "").toLowerCase();
  if (/ฟีเจอร์|ทำอะไรได้บ้าง|ความสามารถ/.test(normalized)) return "features";
  if (/activity|กิจกรรม|week spine|cycle/.test(normalized)) return "activity";
  if (/reminder|buffer|countdown|stopwatch/.test(normalized)) return "reminder";
  if (/google|calendar|ปฏิทิน/.test(normalized)) return "calendar";
  if (/telegram|แจ้งเตือน|notification|noti/.test(normalized)) return "telegram";
  if (/sync|ซิงก์|firestore|firebase/.test(normalized)) return "sync";
  if (/zettascale|ผู้ช่วย|\bai\b/.test(normalized)) return "assistant";
  return "times";
}

function announcementAdminChatIds() {
  return new Set(
    String(process.env.TELEGRAM_ANNOUNCEMENT_ADMIN_CHAT_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function isAnnouncementAdmin(chatId) {
  // Fail closed: until an admin chat ID is configured, no Telegram account
  // can mutate the announcement (including the first account that links).
  return announcementAdminChatIds().has(String(chatId));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`ไม่พบ ${name} ใน environment ของ backend`);
  return value;
}

async function sendTelegram(chatId, text, options = {}) {
  const response = await fetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...options })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`Telegram ส่งข้อความไม่สำเร็จ: ${data.description || response.status}`);
  return data.result;
}

function announcementConfigSummary(config) {
  return "⚙️ การตั้งค่า announcement-ticker\n" +
    `สถานะ: ${config.enabled ? "เปิด" : "ปิด"}\n` +
    `แสดงซ้ำทุก: ${config.repeatIntervalMinutes} นาที\n` +
    `ค้างข้อความ: ${config.holdDurationSeconds} วินาที\n` +
    `ความเร็วเลื่อน: ${config.scrollSpeedPxPerSecond} px/s\n` +
    `เอฟเฟกต์ scramble: ${config.scrambleEnabled ? "เปิด" : "ปิด"}`;
}

function formatAnnouncementPanel(data = {}) {
  const config = normalizeAnnouncementConfig(data);
  const message = typeof data.message === "string" && data.message.trim()
    ? data.message.trim()
    : "ยังไม่มีข้อความประกาศ";
  return "📣 ตั้งค่า announcement-ticker\n\n" +
    `ข้อความ: ${message.slice(0, 180)}${message.length > 180 ? "…" : ""}\n\n` +
    announcementConfigSummary(config) + "\n\nเลือกปุ่มด้านล่างเพื่อปรับค่า";
}

function announcementInlineKeyboard(config) {
  const active = config.enabled ? "🟢 เปิดอยู่" : "⚫ ปิดอยู่";
  const scramble = config.scrambleEnabled ? "✨ เปิด" : "○ ปิด";
  return {
    inline_keyboard: [
      [{ text: `Ticker: ${active}`, callback_data: "announce:toggle" }],
      [
        { text: "− รอบ", callback_data: "announce:interval:-" },
        { text: `${config.repeatIntervalMinutes} นาที`, callback_data: "announce:status" },
        { text: "+ รอบ", callback_data: "announce:interval:+" }
      ],
      [
        { text: "− ค้าง", callback_data: "announce:hold:-" },
        { text: `${config.holdDurationSeconds} วิ`, callback_data: "announce:status" },
        { text: "+ ค้าง", callback_data: "announce:hold:+" }
      ],
      [
        { text: "ช้าลง", callback_data: "announce:speed:-" },
        { text: `ความเร็ว ${config.scrollSpeedPxPerSecond}`, callback_data: "announce:status" },
        { text: "เร็วขึ้น", callback_data: "announce:speed:+" }
      ],
      [{ text: `Scramble: ${scramble}`, callback_data: "announce:scramble" }],
      [{ text: "✏️ เปลี่ยนข้อความ", callback_data: "announce:message" }],
      [{ text: "↻ อัปเดต", callback_data: "announce:refresh" }, { text: "✕ ปิดแผง", callback_data: "announce:close" }]
    ]
  };
}

async function answerTelegramCallback(callbackQueryId, text = "") {
  const response = await fetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`ตอบ Telegram Inline Keyboard ไม่สำเร็จ: ${data.description || response.status}`);
}

async function editTelegramMessage(chatId, messageId, text, options = {}) {
  const response = await fetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, ...options })
  });
  const data = await response.json().catch(() => ({}));
  // Pressing a read-only button can intentionally produce the same content.
  if (!response.ok || !data.ok) {
    if (data.description?.includes("message is not modified")) return;
    throw new Error(`แก้ไขข้อความ Telegram ไม่สำเร็จ: ${data.description || response.status}`);
  }
}

async function sendAnnouncementPanel(reply) {
  const data = (await announcementDoc().get()).data() || {};
  const config = normalizeAnnouncementConfig(data);
  await reply(formatAnnouncementPanel(data), { reply_markup: announcementInlineKeyboard(config) });
}

async function handleAnnouncementCallback(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  if (!chatId || !messageId || !callbackQuery.id) return;
  if (!isAnnouncementAdmin(chatId)) {
    await answerTelegramCallback(callbackQuery.id, "คุณไม่มีสิทธิ์เปลี่ยนประกาศ");
    return;
  }

  const action = String(callbackQuery.data || "");
  if (!action.startsWith("announce:")) return;
  if (action === "announce:close") {
    await answerTelegramCallback(callbackQuery.id, "ปิดแผงแล้ว");
    await editTelegramMessage(chatId, messageId, "📣 ปิดแผงตั้งค่า announcement-ticker แล้ว");
    return;
  }
  if (action === "announce:message") {
    pendingAnnouncementMessageEdits.set(String(chatId), Date.now() + ANNOUNCEMENT_EDIT_TTL_MS);
    await answerTelegramCallback(callbackQuery.id, "ส่งข้อความใหม่ภายใน 10 นาที");
    await sendTelegram(chatId, "✏️ ส่งข้อความประกาศใหม่ในข้อความถัดไป\n(หมดเวลาใน 10 นาที)", {
      reply_markup: { force_reply: true, input_field_placeholder: "พิมพ์ข้อความ announcement…" }
    });
    return;
  }

  const data = (await announcementDoc().get()).data() || {};
  const config = normalizeAnnouncementConfig(data);
  const updates = {};
  if (action === "announce:toggle") updates.enabled = !config.enabled;
  if (action === "announce:scramble") updates.scrambleEnabled = !config.scrambleEnabled;
  if (action === "announce:interval:-") updates.repeatIntervalMinutes = Math.max(1, config.repeatIntervalMinutes - 1);
  if (action === "announce:interval:+") updates.repeatIntervalMinutes = Math.min(1_440, config.repeatIntervalMinutes + 1);
  if (action === "announce:hold:-") updates.holdDurationSeconds = Math.max(0.5, Number((config.holdDurationSeconds - 0.5).toFixed(1)));
  if (action === "announce:hold:+") updates.holdDurationSeconds = Math.min(60, Number((config.holdDurationSeconds + 0.5).toFixed(1)));
  if (action === "announce:speed:-") updates.scrollSpeedPxPerSecond = Math.max(20, config.scrollSpeedPxPerSecond - 10);
  if (action === "announce:speed:+") updates.scrollSpeedPxPerSecond = Math.min(240, config.scrollSpeedPxPerSecond + 10);

  const next = normalizeAnnouncementConfig({ ...config, ...updates });
  if (Object.keys(updates).length) {
    await announcementDoc().set({ ...next, updatedAt: new Date().toISOString(), updatedByTelegramChatId: String(chatId) }, { merge: true });
  }
  await answerTelegramCallback(callbackQuery.id, action === "announce:status" ? "ดูสถานะล่าสุด" : "บันทึกแล้ว");
  await editTelegramMessage(chatId, messageId, formatAnnouncementPanel({ ...data, ...next }), { reply_markup: announcementInlineKeyboard(next) });
}

async function handleProductQuestionCallback(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const nodeId = String(callbackQuery.data || "").replace(/^product:/, "");
  if (!chatId || !messageId || !callbackQuery.id || !PRODUCT_QUESTION_NODES[nodeId]) return;

  const { node, text } = productQuestionResponse(nodeId);
  await answerTelegramCallback(callbackQuery.id);
  await editTelegramMessage(chatId, messageId, text, { reply_markup: productQuestionKeyboard(node) });

  // The answer is edited in Telegram rather than sent as a stack of new
  // messages. Mirror that final visible text into the web chat as well.
  const chatOwner = (await telegramChatOwnerDoc(chatId).get()).data()?.userId;
  if (chatOwner) {
    await telegramMessagesCol(chatOwner).doc(String(messageId)).set({
      direction: "outgoing", text, telegramMessageId: messageId
    }, { merge: true });
  }
}

async function saveChatMessage(userId, { direction, text, telegramMessageId = null, readAt = null }) {
  const messageId = telegramMessageId ? String(telegramMessageId) : crypto.randomUUID();
  const messageRef = telegramMessagesCol(userId).doc(messageId);
  // The unread badge is stored as a single counter document. This lets a
  // closed web chat poll one document instead of repeatedly reading up to 100
  // historical messages just to draw a badge.
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(messageRef);
    transaction.set(messageRef, {
      direction, text: String(text || "").slice(0, 4_000), telegramMessageId,
      createdAt: Date.now(), readAt
    }, { merge: true });
    if (!existing.exists && direction === "outgoing" && !readAt) {
      transaction.set(telegramAuthDoc(userId), { unreadCount: FieldValue.increment(1) }, { merge: true });
    }
  });
}

async function sendChatReply(userId, chatId, text, options = {}) {
  const sent = await sendTelegram(chatId, text, options);
  await saveChatMessage(userId, { direction: "outgoing", text, telegramMessageId: sent?.message_id });
  return sent;
}

function bangkokDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
}

/**
 * Claims a one-time Telegram delivery across every open client. Browser-side
 * Set/refs only prevent repeats inside one tab; Pi + laptop need Firestore's
 * transaction to decide which device wins the same scheduled occurrence.
 */
async function claimDelivery(userId, notificationKey, notificationKind, title) {
  const hasKey = typeof notificationKey === "string" && notificationKey.length > 0 && notificationKey.length <= 500;
  const deliveryId = hasKey ? crypto.createHash("sha256").update(notificationKey).digest("base64url") : null;
  const authRef = telegramAuthDoc(userId);
  const deliveryRef = deliveryId ? authRef.collection("deliveries").doc(deliveryId) : null;
  const dayKey = bangkokDayKey();
  const limitRef = authRef.collection("notification-limits").doc(dayKey);
  return db.runTransaction(async (transaction) => {
    const [existing, limit] = await Promise.all([
      deliveryRef ? transaction.get(deliveryRef) : Promise.resolve(null),
      transaction.get(limitRef)
    ]);
    if (existing?.exists) return { status: "deduplicated" };
    const count = Number(limit.data()?.count || 0);
    if (count >= DAILY_NOTIFICATION_LIMIT) return { status: "limited", dayKey, count };
    if (deliveryRef) transaction.set(deliveryRef, {
      notificationKey, notificationKind, title: String(title || "").slice(0, 500),
      createdAt: new Date().toISOString(), dayKey
    });
    transaction.set(limitRef, {
      count: count + 1, limit: DAILY_NOTIFICATION_LIMIT, dayKey,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { status: "claimed", deliveryRef, limitRef, dayKey, remaining: DAILY_NOTIFICATION_LIMIT - count - 1 };
  });
}

async function releaseDeliveryClaim(claim) {
  if (!claim || claim.status !== "claimed") return;
  await db.runTransaction(async (transaction) => {
    const limit = await transaction.get(claim.limitRef);
    const count = Number(limit.data()?.count || 0);
    if (claim.deliveryRef) transaction.delete(claim.deliveryRef);
    transaction.set(claim.limitRef, { count: Math.max(0, count - 1), updatedAt: new Date().toISOString() }, { merge: true });
  });
}

async function registerBotCommands() {
  // A bot can have a separate menu for all private chats. Updating only the
  // default scope leaves an older private-chat menu visible, so publish the
  // same two roots to both scopes every time the backend starts.
  const commands = [
    { command: "times", description: "T.i.M.E.S. คืออะไร" },
    { command: "features", description: "T.i.M.E.S. มีฟีเจอร์อะไรบ้าง" }
  ];
  for (const scope of [undefined, { type: "all_private_chats" }]) {
    const response = await fetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands, ...(scope ? { scope } : {}) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(`ตั้งเมนูคำสั่ง Telegram ไม่สำเร็จ: ${data.description || response.status}`);
  }
}

router.get("/status", async (req, res, next) => {
  try {
    const data = (await telegramAuthDoc(req.userId).get()).data();
    if (data?.chatId) await telegramChatOwnerDoc(data.chatId).set({ userId: req.userId, updatedAt: Date.now() }, { merge: true });
    res.json({ connected: Boolean(data?.chatId), username: process.env.TELEGRAM_BOT_USERNAME || null });
  } catch (error) { next(error); }
});

router.get("/messages", async (req, res, next) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 30)) : 30;
    const snapshot = await telegramMessagesCol(req.userId).orderBy("createdAt", "desc").limit(limit).get();
    const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).reverse();
    // A person's own messages are never unread. Only bot replies and sent
    // notifications wait for acknowledgement in the web chat.
    res.json({ messages, unreadCount: messages.filter((message) => message.direction === "outgoing" && !message.readAt).length });
  } catch (error) { next(error); }
});

router.get("/messages/summary", async (req, res, next) => {
  try {
    const data = (await telegramAuthDoc(req.userId).get()).data();
    res.json({ unreadCount: Math.max(0, Number(data?.unreadCount || 0)) });
  } catch (error) { next(error); }
});

router.post("/messages/read", async (req, res, next) => {
  try {
    // Use the same newest-message window as GET /messages instead of a
    // compound Firestore query, so opening the chat never depends on a new
    // composite index being deployed.
    const snapshot = await telegramMessagesCol(req.userId).orderBy("createdAt", "desc").limit(30).get();
    const batch = db.batch();
    const unread = snapshot.docs.filter((doc) => doc.data().direction === "outgoing" && !doc.data().readAt);
    unread.forEach((doc) => batch.update(doc.ref, { readAt: Date.now() }));
    if (unread.length) {
      const auth = await telegramAuthDoc(req.userId).get();
      const remainingUnread = Math.max(0, Number(auth.data()?.unreadCount || 0) - unread.length);
      batch.set(telegramAuthDoc(req.userId), { unreadCount: remainingUnread }, { merge: true });
      await batch.commit();
    }
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post("/messages", async (req, res, next) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text || text.length > 4_000) return res.status(400).json({ error: "ข้อความต้องมีความยาว 1–4,000 ตัวอักษร" });
    const auth = (await telegramAuthDoc(req.userId).get()).data();
    if (!auth?.chatId) return res.status(409).json({ error: "ยังไม่ได้เชื่อม Telegram" });
    const sent = await sendTelegram(auth.chatId, text);
    // The text was composed by the person in the web chat, even though this
    // endpoint relays it through the bot API. Render it on the user's side.
    await saveChatMessage(req.userId, { direction: "incoming", text, telegramMessageId: sent?.message_id, readAt: Date.now() });
    if (/^\/cmd(?:@\w+)?$/i.test(text)) {
      await sendChatReply(req.userId, auth.chatId, COMMAND_HELP_TEXT, { reply_markup: CUSTOM_COMMAND_KEYBOARD });
    }
    // Telegram is deliberately delivery-only. MR.Zettascale's planning AI
    // lives in Activity Mode on the web, where a draft can be reviewed
    // before it is allowed anywhere near Calendar data.
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post("/connect", async (req, res, next) => {
  try {
    const username = requiredEnv("TELEGRAM_BOT_USERNAME").replace(/^@/, "");
    const token = crypto.randomBytes(24).toString("base64url");
    await telegramLinkDoc(token).set({ userId: req.userId, expiresAt: Date.now() + LINK_TTL_MS, createdAt: new Date().toISOString() });
    res.json({
      connectUrl: `https://t.me/${username}?start=${token}`,
      appConnectUrl: `tg://resolve?domain=${username}&start=${token}`,
      expiresAt: Date.now() + LINK_TTL_MS
    });
  } catch (error) { next(error); }
});

router.post("/test", async (req, res, next) => {
  try {
    const data = (await telegramAuthDoc(req.userId).get()).data();
    if (!data?.chatId) return res.status(409).json({ error: "ยังไม่ได้เชื่อม Telegram" });
    await sendChatReply(req.userId, data.chatId, "✅ MR.Zettascale เชื่อมต่อกับ T.i.M.E.S. สำเร็จแล้ว");
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post("/notify", async (req, res, next) => {
  let deliveryClaim = null;
  try {
    // Telegram is an optional delivery channel. A local development setup
    // commonly omits its production-only bot secret, which must not turn an
    // otherwise successful Activity/Reminder action into a backend error.
    if (!process.env.TELEGRAM_BOT_TOKEN) return res.json({ sent: false, unavailable: true });
    const data = (await telegramAuthDoc(req.userId).get()).data();
    if (!data?.chatId) return res.json({ sent: false });
    const title = String(req.body?.title || "Reminder").slice(0, 500);
    const notificationKind = ["activity", "interval"].includes(req.body?.notificationKind)
      ? req.body.notificationKind
      : "reminder";
    const notificationLabel = notificationKind === "activity"
      ? "กิจกรรม"
      : notificationKind === "interval"
        ? "Reminder แบบช่วงเวลา"
        : "reminder";
    deliveryClaim = await claimDelivery(req.userId, req.body?.notificationKey, notificationKind, title);
    if (deliveryClaim.status === "deduplicated") return res.json({ sent: false, deduplicated: true });
    if (deliveryClaim.status === "limited") {
      return res.json({ sent: false, rateLimited: true, limit: DAILY_NOTIFICATION_LIMIT, remaining: 0, dayKey: deliveryClaim.dayKey });
    }
    const notificationText = `🔔 ถึงเวลาของ${notificationLabel}: ${title}`;
    const sentMessage = await sendTelegram(data.chatId, notificationText);
    // Mirror successful deliveries into the web chat. This makes
    // MR.Zettascale the single readable notification history instead of
    // showing only commands that originated from Telegram itself.
    await saveChatMessage(req.userId, {
      direction: "outgoing",
      text: notificationText,
      telegramMessageId: sentMessage?.message_id
    });
    res.json({ sent: true, limit: DAILY_NOTIFICATION_LIMIT, remaining: deliveryClaim.remaining, dayKey: deliveryClaim.dayKey });
  } catch (error) {
    // Allow a later retry if Telegram itself failed after this process won
    // the claim. Do not leave a permanent "sent" marker for a failed send.
    await releaseDeliveryClaim(deliveryClaim).catch(() => {});
    next(error);
  }
});

module.exports = router;

module.exports.registerWebhook = async function registerWebhook(baseUrl) {
  const missing = [
    !process.env.TELEGRAM_BOT_TOKEN && "TELEGRAM_BOT_TOKEN",
    !process.env.TELEGRAM_WEBHOOK_SECRET && "TELEGRAM_WEBHOOK_SECRET",
    !baseUrl && "webhook base URL"
  ].filter(Boolean);
  if (missing.length) {
    // Deliberately report only variable names—never token or secret values.
    console.warn(`[telegram] ข้ามการตั้ง webhook และ Bot Command Menu: ไม่พบ ${missing.join(", ")}`);
    return;
  }
  const identityResponse = await fetch(`${BOT_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
  const identity = await identityResponse.json().catch(() => ({}));
  if (!identityResponse.ok || !identity.ok) {
    throw new Error(`ตรวจ Telegram bot ไม่สำเร็จ: ${identity.description || identityResponse.status}`);
  }
  console.log(`[telegram] ยืนยัน bot @${identity.result?.username || "unknown"} สำเร็จ`);
  const response = await fetch(`${BOT_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`ตั้ง Telegram webhook ไม่สำเร็จ: ${data.description || response.status}`);
  console.log(`[telegram] ตั้ง webhook สำเร็จ: ${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`);
  await registerBotCommands();
  console.log("[telegram] ตั้ง Bot Command Menu สำเร็จ");
};

module.exports.webhook = async function telegramWebhook(req, res) {
  if (req.get("X-Telegram-Bot-Api-Secret-Token") !== process.env.TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(401);
  try {
    const callbackQuery = req.body?.callback_query;
    if (callbackQuery?.data?.startsWith("announce:")) {
      await handleAnnouncementCallback(callbackQuery);
      return res.sendStatus(200);
    }
    if (callbackQuery?.data?.startsWith("product:")) {
      await handleProductQuestionCallback(callbackQuery);
      return res.sendStatus(200);
    }
    const message = req.body?.message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || "").trim();
    if (!chatId) return res.sendStatus(200);
    const chatOwner = (await telegramChatOwnerDoc(chatId).get()).data()?.userId || null;
    if (chatOwner && text) await saveChatMessage(chatOwner, { direction: "incoming", text, telegramMessageId: message.message_id, readAt: Date.now() });
    const reply = (replyText, options) => chatOwner
      ? sendChatReply(chatOwner, chatId, replyText, options)
      : sendTelegram(chatId, replyText, options);

    if (/^\/cmd(?:@\w+)?$/i.test(text)) {
      await reply(COMMAND_HELP_TEXT, { reply_markup: CUSTOM_COMMAND_KEYBOARD });
      return res.sendStatus(200);
    }

    if (/^\/(?:myid|chatid)(?:@\w+)?$/i.test(text)) {
      await reply(`รหัส Telegram chat ของคุณ: ${chatId}\nตั้งค่า TELEGRAM_ANNOUNCEMENT_ADMIN_CHAT_IDS=${chatId} ใน Render เพื่อใช้คำสั่งประกาศ`);
      return res.sendStatus(200);
    }

    const announcementMatch = text.match(/^\/announce(?:@\w+)?(?:\s+([\s\S]*))?$/i);
    if (announcementMatch) {
      if (!isAnnouncementAdmin(chatId)) {
        await reply("⛔ คุณไม่มีสิทธิ์เปลี่ยนประกาศ");
        return res.sendStatus(200);
      }

      if (announcementMatch[1]?.trim()) {
        await reply("ใช้ /announce เพียงคำสั่งเดียว แล้วกด ✏️ เปลี่ยนข้อความ ในแผงตั้งค่า");
        return res.sendStatus(200);
      }
      await sendAnnouncementPanel(reply);
      return res.sendStatus(200);
    }

    const pendingEditExpiresAt = pendingAnnouncementMessageEdits.get(String(chatId));
    if (pendingEditExpiresAt && pendingEditExpiresAt < Date.now()) pendingAnnouncementMessageEdits.delete(String(chatId));
    if (pendingAnnouncementMessageEdits.has(String(chatId)) && text && !text.startsWith("/")) {
      if (!isAnnouncementAdmin(chatId)) {
        pendingAnnouncementMessageEdits.delete(String(chatId));
        await reply("⛔ คุณไม่มีสิทธิ์เปลี่ยนประกาศ");
        return res.sendStatus(200);
      }
      if (text.length > MAX_ANNOUNCEMENT_LENGTH) {
        await reply(`ข้อความยาวเกินไป — จำกัด ${MAX_ANNOUNCEMENT_LENGTH} ตัวอักษร`);
        return res.sendStatus(200);
      }
      pendingAnnouncementMessageEdits.delete(String(chatId));
      await announcementDoc().set({ message: text, enabled: true, updatedAt: new Date().toISOString(), updatedByTelegramChatId: String(chatId) }, { merge: true });
      await reply("✅ อัปเดตข้อความประกาศแล้ว");
      await sendAnnouncementPanel(reply);
      return res.sendStatus(200);
    }

    // Telegram can answer only documented product questions here. This is a
    // deterministic knowledge lookup, so it never calls Gemini or consumes
    // the Activity Mode AI quota.
    const commandNodes = {
      "/times": "times",
      "/features": "features"
    };
    const commandName = text.match(/^\/(times|features)(?:@\w+)?$/i)?.[1]?.toLowerCase();
    const requestedNode = commandName ? commandNodes[`/${commandName}`] : productNodeForText(text);
    const productQuestion = commandName ? PRODUCT_QUESTION_NODES[requestedNode].question : text;
    const productAnswer = answerTimesQuestion(productQuestion);
    if (productAnswer) {
      const node = PRODUCT_QUESTION_NODES[requestedNode];
      await reply(productAnswer, { reply_markup: productQuestionKeyboard(node) });
      return res.sendStatus(200);
    }

    const match = text.match(/^\/start\s+([A-Za-z0-9_-]{1,64})$/);
    if (!match) {
      if (/^\/start(?:@\w+)?$/i.test(text)) {
        await reply("ยินดีต้อนรับสู่ MR.Zettascale ✨\nกด /cmd เพื่อดูคำสั่งทั้งหมด\n\nหากต้องการเชื่อมบัญชี T.i.M.E.S. ให้กดปุ่ม Telegram ใน Reminder Mode", { reply_markup: CUSTOM_COMMAND_KEYBOARD });
      }
      return res.sendStatus(200);
    }
    const ref = telegramLinkDoc(match[1]);
    const link = (await ref.get()).data();
    if (!link || link.expiresAt < Date.now()) return res.sendStatus(200);
    await telegramAuthDoc(link.userId).set({ chatId: String(chatId), connectedAt: new Date().toISOString() }, { merge: true });
    await telegramChatOwnerDoc(chatId).set({ userId: link.userId, updatedAt: Date.now() }, { merge: true });
    await ref.delete();
    if (text) await saveChatMessage(link.userId, { direction: "incoming", text, telegramMessageId: message.message_id, readAt: Date.now() });
    await sendChatReply(link.userId, chatId, "✅ เชื่อม MR.Zettascale กับ T.i.M.E.S. สำเร็จแล้ว", { reply_markup: CUSTOM_COMMAND_KEYBOARD });
    res.sendStatus(200);
  } catch (error) {
    console.error("[telegram] webhook ล้มเหลว:", error.message);
    res.sendStatus(500);
  }
};
