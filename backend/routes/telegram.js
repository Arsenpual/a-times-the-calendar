const crypto = require("crypto");
const express = require("express");
const { FieldValue } = require("firebase-admin/firestore");
const { db, telegramAuthDoc, telegramLinkDoc, telegramMessagesCol, telegramChatOwnerDoc, announcementDoc } = require("../firestore-db.js");
const { normalizeAnnouncementConfig } = require("../announcement-config.js");
const { answerTimesQuestion } = require("../skills/activity-creation/times-knowledge.js");
const { generateContent } = require("../gemini-api.js");
const { claimGeminiChatUsage, releaseGeminiChatUsage, isDeveloperUser } = require("../gemini-chat.js");
const { searchGoogleNews, getGoogleNewsTopStories } = require("../google-news.js");

const router = express.Router();
const BOT_API = "https://api.telegram.org";
const LINK_TTL_MS = 10 * 60 * 1000;
const MAX_ANNOUNCEMENT_LENGTH = 500;
const DAILY_NOTIFICATION_LIMIT = 720;
const ANNOUNCEMENT_EDIT_TTL_MS = 10 * 60 * 1000;
const TELEGRAM_FREE_AI_HISTORY_LIMIT = 16;
const TELEGRAM_FREE_AI_HISTORY_MESSAGE_LIMIT = 4_000;
const TELEGRAM_FREE_AI_REPLY_LIMIT = 12_000;
const TELEGRAM_MESSAGE_CHUNK_LIMIT = 3_900;
const TELEGRAM_NEWS_TOPIC_LIMIT = 8;
const TELEGRAM_NEWS_TOPIC_LENGTH_LIMIT = 80;
const TELEGRAM_NEWS_TOPIC_PAGE_SIZE = 4;
const TELEGRAM_NEWS_AI_BRIEF_LIMIT = 2_400;
const TELEGRAM_NEWS_INPUT_TTL_MS = 10 * 60 * 1000;
const TELEGRAM_NEWS_PERIODS = Object.freeze({ "1h": "1 ชั่วโมง", "6h": "6 ชั่วโมง", "1d": "24 ชั่วโมง", "7d": "7 วัน" });
const TELEGRAM_NEWS_RESULTS_BY_PERIOD = Object.freeze({ "1h": 3, "6h": 5, "1d": 8, "7d": 10 });
const pendingAnnouncementMessageEdits = new Map();
const pendingTelegramNewsInputs = new Map();
// Public Telegram commands have one source of truth. Add each new command here:
// its entry is then published to Bot Menu and appears in /cmd automatically.
const BOT_MENU_COMMANDS = Object.freeze([
  { command: "start", description: "เริ่มต้นใช้งาน T.i.M.E.S.", help: "เชื่อมต่อบัญชี T.i.M.E.S." },
  { command: "general_questions", description: "คำถามทั่วไป", help: "คำถามทั่วไปเกี่ยวกับ T.i.M.E.S." },
  { command: "cmd", description: "ดูรายการคำสั่งทั้งหมด", help: "ดูรายการคำสั่งนี้" },
  { command: "times", description: "T.i.M.E.S. คืออะไร", help: "T.i.M.E.S. คืออะไร" },
  { command: "features", description: "ดูฟีเจอร์ T.i.M.E.S.", help: "ดูฟีเจอร์ของ T.i.M.E.S." },
  { command: "ai", description: "สถานะและโหมด AI ส่วนตัว", help: "ดูสถานะโหมด AI ส่วนตัว" },
  { command: "ai_commands", description: "ชุดคำสั่ง AI", help: "เปิดชุดคำสั่ง AI" },
  { command: "ai_on", description: "เปิดโหมด AI (/ai on)", help: "เปิดโหมด AI", usage: "/ai on หรือ /ai_on" },
  { command: "ai_off", description: "ปิดโหมด AI (/ai off)", help: "ปิดโหมด AI", usage: "/ai off หรือ /ai_off" },
  { command: "ai_clear", description: "ล้างบริบท AI (/ai clear)", help: "ล้างบริบท AI", usage: "/ai clear หรือ /ai_clear" },
  { command: "ai_reset", description: "ล้างบริบท AI (/ai reset)", help: "ล้างบริบท AI", usage: "/ai reset หรือ /ai_reset" },
  { command: "ai_status", description: "ดูสถานะ AI (/ai status)", help: "ดูสถานะโหมด AI", usage: "/ai status หรือ /ai_status" },
  { command: "myid", description: "ดู Telegram chat ID", help: "ดู Telegram chat ID ของคุณ" },
  { command: "chatid", description: "ดู Telegram chat ID (alias)", help: "ดู Telegram chat ID ของคุณ" },
  { command: "news", description: "เปิดชุดคำสั่งข่าว", help: "เปิดชุดคำสั่งข่าวจาก Google News" },
  { command: "news_add", description: "เพิ่มหัวข้อข่าว", help: "เพิ่มหัวข้อ เช่น /news_add AI" },
  { command: "news_remove", description: "ลบหัวข้อข่าว", help: "ลบหัวข้อด้วยชื่อหรือลำดับ" },
  { command: "news_list", description: "ดูหัวข้อข่าว", help: "ดูหัวข้อข่าวที่ติดตาม" },
  { command: "news_now", description: "อ่านข่าวล่าสุด", help: "อ่านข่าวล่าสุดจากหัวข้อที่ติดตาม" },
  { command: "announce", description: "ตั้งค่า announcement-ticker", help: "เปิดแผงตั้งค่า announcement-ticker (ผู้ดูแล)" }
]);
const COMMAND_HELP_TEXT =
  "📚 คำสั่งของ MR.Zettascale\n\n" +
  BOT_MENU_COMMANDS.map(({ command, help, usage }) => `${usage || `/${command}`} — ${help}`).join("\n") +
  "\n\n" +
  "คำสั่ง /announce ใช้ได้เฉพาะ Telegram chat ID ที่ผู้ดูแลอนุญาตไว้";
// ปุ่มลัดชั่วคราวใต้ช่องพิมพ์: Telegram จะซ่อน keyboard หลังผู้ใช้กด
// ปุ่มหนึ่งครั้ง การแสดงปุ่ม Bot Command Menu ขึ้นกับ Telegram client.
const CUSTOM_COMMAND_KEYBOARD = {
  keyboard: [[{ text: "/start" }, { text: "/cmd" }]],
  resize_keyboard: true,
  one_time_keyboard: true,
  input_field_placeholder: "เลือกคำสั่งด่วน หรือพิมพ์ข้อความ"
};
const AI_COMMAND_COLLECTION_KEYBOARD = {
  inline_keyboard: [
    [{ text: "🟢 เปิด AI", callback_data: "ai:on" }, { text: "⚫ ปิด AI", callback_data: "ai:off" }],
    [{ text: "🧹 ล้างบริบท", callback_data: "ai:clear" }, { text: "↻ รีเซ็ตบริบท", callback_data: "ai:reset" }],
    [{ text: "◉ ดูสถานะ AI", callback_data: "ai:status" }]
  ]
};
// Product-question follow-ups remain inline and use deterministic product
// knowledge only.
const GENERAL_QUESTION_BUTTONS = Object.freeze([
  ["times", "T.i.M.E.S. คืออะไร?"],
  ["features", "T.i.M.E.S. มีฟีเจอร์อะไรบ้าง?"],
  ["data-lab", "Data Lab คืออะไร?"]
]);

const PRODUCT_QUESTION_NODES = Object.freeze({
  times: {
    question: "times คืออะไร",
    buttons: [
      ["purpose", "T.i.M.E.S. ใช้ทำอะไร"],
      ["activity-reminder", "Activity กับ Reminder ต่างกันอย่างไร"],
      ["assistant", "MR.Zettascale คืออะไร"]
    ]
  },
  features: {
    question: "times มีฟีเจอร์",
    buttons: [
      ["activity", "🗓️ ฟีเจอร์ Activity Mode"],
      ["reminder", "🔔 ฟีเจอร์ Reminder Mode"],
      ["connection", "การเชื่อมต่อและการซิงก์"]
    ]
  },
  "data-lab": {
    question: "Data Lab คืออะไร?",
    buttons: [
      ["data-lab-export", "ส่งออกข้อมูล Data Lab อย่างไร?"],
      ["insight-review", "Insight Review ใช้อย่างไร?"],
      ["general-questions", "← คำถามทั่วไป"]
    ]
  },
  "data-lab-export": {
    question: "ส่งออกข้อมูล Data Lab อย่างไร?",
    buttons: [["insight-review", "Insight Review ใช้อย่างไร?"], ["data-lab", "← Data Lab"]]
  },
  "insight-review": {
    question: "Insight Review ใช้อย่างไร?",
    buttons: [["data-lab-export", "ส่งออกข้อมูล Data Lab อย่างไร?"], ["data-lab", "← Data Lab"]]
  },
  "general-questions": {
    question: "",
    buttons: GENERAL_QUESTION_BUTTONS
  },
  purpose: {
    question: "times คืออะไร",
    buttons: [
      ["activity-reminder", "Activity กับ Reminder ต่างกันอย่างไร"],
      ["features", "ดูฟีเจอร์ทั้งหมด"],
      ["assistant", "MR.Zettascale คืออะไร"]
    ]
  },
  "activity-reminder": {
    question: "activity กับ reminder",
    buttons: [
      ["activity", "ดู Activity Mode"],
      ["reminder", "ดู Reminder Mode"],
      ["times", "← กลับภาพรวม T.i.M.E.S."]
    ]
  },
  activity: {
    question: "activity mode",
    buttons: [
      ["week-spine", "Week Spine และ Cycle"],
      ["category-tag", "Category และ Tag"],
      ["features", "← ฟีเจอร์ทั้งหมด"]
    ]
  },
  reminder: {
    question: "reminder มีประเภท",
    buttons: [
      ["buffer", "Buffer ทำงานอย่างไร"],
      ["notifications", "การแจ้งเตือนและโควต้า"],
      ["features", "← ฟีเจอร์ทั้งหมด"]
    ]
  },
  connection: {
    question: "ฟีเจอร์การเชื่อมต่อและการตั้งค่า",
    buttons: [
      ["calendar", "Google Calendar"],
      ["telegram", "Telegram แจ้งเตือน"],
      ["sync", "ข้อมูลซิงก์อย่างไร"]
    ]
  },
  calendar: {
    question: "google calendar",
    buttons: [["sync", "ข้อมูลซิงก์อย่างไร"], ["connection", "← การเชื่อมต่อทั้งหมด"], ["features", "ฟีเจอร์ทั้งหมด"]]
  },
  telegram: {
    question: "telegram",
    buttons: [["notifications", "การแจ้งเตือนและโควต้า"], ["connection", "← การเชื่อมต่อทั้งหมด"], ["reminder", "ดู Reminder Mode"]]
  },
  sync: {
    question: "ข้อมูลซิงก์ข้ามอุปกรณ์",
    buttons: [["calendar", "Google Calendar"], ["telegram", "Telegram"], ["connection", "← การเชื่อมต่อทั้งหมด"]]
  },
  assistant: {
    question: "mr.zettascale",
    buttons: [["activity", "ดู Activity Mode"], ["purpose", "T.i.M.E.S. ใช้ทำอะไร"], ["times", "← กลับภาพรวม T.i.M.E.S."]]
  },
  "week-spine": {
    question: "week spine และ cycle คือ",
    buttons: [["activity", "← Activity Mode"], ["category-tag", "Category และ Tag"], ["features", "ฟีเจอร์ทั้งหมด"]]
  },
  "category-tag": {
    question: "category กับ tag",
    buttons: [["activity", "← Activity Mode"], ["week-spine", "Week Spine และ Cycle"], ["features", "ฟีเจอร์ทั้งหมด"]]
  },
  buffer: {
    question: "buffer ของ reminder",
    buttons: [["notifications", "การแจ้งเตือนและโควต้า"], ["reminder", "← Reminder Mode"], ["features", "ฟีเจอร์ทั้งหมด"]]
  },
  notifications: {
    question: "โควต้าการแจ้งเตือน",
    buttons: [["telegram", "Telegram แจ้งเตือน"], ["buffer", "Buffer ทำงานอย่างไร"], ["reminder", "← Reminder Mode"]]
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
    text: nodeId === "general-questions"
      ? "เลือกคำถามทั่วไปที่ต้องการได้เลยครับ"
      : answerTimesQuestion(node.question) || "ผมยังไม่มีข้อมูลยืนยันเกี่ยวกับส่วนนั้นใน T.i.M.E.S. ครับ"
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

function telegramFreeAiAllowedChatIds() {
  return new Set(
    String(process.env.TELEGRAM_FREE_AI_ALLOWED_CHAT_IDS || process.env.TELEGRAM_AI_ALLOWED_CHAT_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function isTelegramFreeAiAllowed(chatId, userId) {
  // Both the linked developer account and exact Telegram chat ID are required.
  // An empty allowlist keeps the private AI mode disabled for everyone.
  if (!userId || !isDeveloperUser(userId)) return false;
  const allowedChatIds = telegramFreeAiAllowedChatIds();
  return allowedChatIds.has(String(chatId));
}

function normalizedTelegramFreeAiHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && ["user", "model"].includes(item.role) && typeof item.text === "string")
    .map((item) => ({ role: item.role, text: item.text.trim().slice(0, TELEGRAM_FREE_AI_HISTORY_MESSAGE_LIMIT) }))
    .filter((item) => item.text)
    .slice(-TELEGRAM_FREE_AI_HISTORY_LIMIT);
}

function telegramFreeAiText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini ไม่ได้ส่งคำตอบกลับมา");
  return text.slice(0, TELEGRAM_FREE_AI_REPLY_LIMIT);
}

function telegramFreeAiSystemInstruction() {
  // Deployments can override the voice without changing the conversation flow.
  return String(process.env.TELEGRAM_FREE_AI_SYSTEM_INSTRUCTION ||
    "You are MR.Zettascale, a calm, thoughtful, and practical conversational assistant for T.i.M.E.S. Speak naturally and answer general questions freely, with clear reasoning and useful detail when requested. You may discuss any topic, not only T.i.M.E.S. When a question concerns T.i.M.E.S. but you have not been given verified project details, say so plainly instead of inventing product behavior. Do not claim to control T.i.M.E.S. or perform actions unless the user explicitly asks and the capability is available.");
}

function freeAiQuotaReply(status) {
  if (status === "window-limited") return "ใช้ AI ครบโควต้าชั่วคราวแล้ว กรุณาลองใหม่ในรอบถัดไปครับ";
  if (status === "day-limited" || status === "global-limited") return "วันนี้ใช้ AI ครบโควต้าแล้ว กรุณาลองใหม่พรุ่งนี้ครับ";
  if (status === "globally-disabled") return "โหมด AI ถูกปิดจากการตั้งค่าระบบอยู่ครับ";
  return "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้โหมด AI ครับ";
}

async function answerTelegramFreeAi(userId, text) {
  const claim = await claimGeminiChatUsage(userId);
  if (claim.status !== "claimed") return { text: freeAiQuotaReply(claim.status), usedAi: false };
  try {
    const auth = (await telegramAuthDoc(userId).get()).data() || {};
    const history = normalizedTelegramFreeAiHistory(auth.telegramFreeAi?.history);
    const payload = await generateContent({
      systemInstruction: { parts: [{ text: telegramFreeAiSystemInstruction() }] },
      contents: [
        ...history.map((item) => ({ role: item.role, parts: [{ text: item.text }] })),
        { role: "user", parts: [{ text }] }
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 3000 }
    });
    const reply = telegramFreeAiText(payload);
    await telegramAuthDoc(userId).set({
      telegramFreeAi: {
        history: normalizedTelegramFreeAiHistory([...history, { role: "user", text }, { role: "model", text: reply }]),
        updatedAt: Date.now()
      }
    }, { merge: true });
    return { text: reply, usedAi: true };
  } catch (error) {
    await releaseGeminiChatUsage(claim).catch(() => {});
    throw error;
  }
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
  // messages. Route the final visible text through the same persistence
  // function as every other bot reply: this keeps ordering, unread state and
  // the web-chat mirror consistent instead of creating a partial message.
  const chatOwner = (await telegramChatOwnerDoc(chatId).get()).data()?.userId;
  if (chatOwner) await saveChatMessage(chatOwner, { direction: "outgoing", text, telegramMessageId: messageId });
}

async function saveChatMessage(userId, { direction, text, telegramMessageId = null, readAt, kind = "chat" } = {}) {
  const messageId = telegramMessageId ? String(telegramMessageId) : crypto.randomUUID();
  const messageRef = telegramMessagesCol(userId).doc(messageId);
  // The unread badge is stored as a single counter document. This lets a
  // closed web chat poll one document instead of repeatedly reading up to 100
  // historical messages just to draw a badge.
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(messageRef);
    const data = {
      direction, text: String(text || "").slice(0, 4_000), telegramMessageId,
      kind: kind === "notification" ? "notification" : "chat",
      createdAt: existing.data()?.createdAt || Date.now()
    };
    // Do not erase an acknowledgement when a Telegram inline keyboard edits
    // an already-rendered message. New outgoing messages remain unread when
    // no readAt is supplied.
    if (readAt !== undefined) data.readAt = readAt;
    transaction.set(messageRef, data, { merge: true });
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

function splitTelegramReply(text) {
  const chunks = [];
  let remaining = String(text || "").trim();
  while (remaining.length > TELEGRAM_MESSAGE_CHUNK_LIMIT) {
    const boundary = Math.max(
      remaining.lastIndexOf("\n", TELEGRAM_MESSAGE_CHUNK_LIMIT),
      remaining.lastIndexOf(" ", TELEGRAM_MESSAGE_CHUNK_LIMIT)
    );
    const end = boundary > TELEGRAM_MESSAGE_CHUNK_LIMIT * 0.6
      ? boundary
      : TELEGRAM_MESSAGE_CHUNK_LIMIT;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function sendTelegramFreeAiReply(userId, chatId, text) {
  for (const chunk of splitTelegramReply(text)) {
    await sendChatReply(userId, chatId, chunk);
  }
}

async function runTelegramFreeAiCommand(chatId, chatOwner, action, reply) {
  if (!isTelegramFreeAiAllowed(chatId, chatOwner)) {
    await reply("⛔ โหมด AI ส่วนตัวใช้ได้เฉพาะ Telegram ที่เชื่อมกับบัญชีเจ้าของเท่านั้น");
    return;
  }
  const authRef = telegramAuthDoc(chatOwner);
  const current = (await authRef.get()).data()?.telegramFreeAi || {};
  if (action === "on") {
    await authRef.set({ telegramFreeAi: { enabled: true, history: normalizedTelegramFreeAiHistory(current.history), updatedAt: Date.now() } }, { merge: true });
    await reply("✦ เปิดโหมด AI แล้วครับ พิมพ์คุยได้อย่างอิสระ ใช้ /ai off เพื่อปิด และ /ai clear เพื่อล้างบริบท");
  } else if (action === "off") {
    await authRef.set({ telegramFreeAi: { enabled: false, history: normalizedTelegramFreeAiHistory(current.history), updatedAt: Date.now() } }, { merge: true });
    await reply("ปิดโหมด AI แล้วครับ ข้อความถัดไปจะกลับไปใช้คำสั่งและคำตอบ T.i.M.E.S. ตามปกติ");
  } else if (action === "clear" || action === "reset") {
    await authRef.set({ telegramFreeAi: { enabled: Boolean(current.enabled), history: [], updatedAt: Date.now() } }, { merge: true });
    await reply("ล้างบริบทการคุย AI แล้วครับ");
  } else {
    await reply(current.enabled
      ? "โหมด AI เปิดอยู่ครับ พิมพ์คุยได้เลย ใช้ /ai off เพื่อปิด"
      : "โหมด AI ปิดอยู่ครับ ใช้ /ai on เพื่อเริ่มคุยอย่างอิสระ");
  }
}

async function handleAiCommandCallback(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const action = String(callbackQuery.data || "").replace(/^ai:/, "");
  if (!chatId || !callbackQuery.id || !["on", "off", "clear", "reset", "status"].includes(action)) return;
  const chatOwner = (await telegramChatOwnerDoc(chatId).get()).data()?.userId || null;
  const reply = chatOwner
    ? (text, options) => sendChatReply(chatOwner, chatId, text, options)
    : (text, options) => sendTelegram(chatId, text, options);
  await answerTelegramCallback(callbackQuery.id);
  await runTelegramFreeAiCommand(chatId, chatOwner, action, reply);
}

function normalizeTelegramNewsTopics(topics) {
  const unique = new Map();
  for (const topic of Array.isArray(topics) ? topics : []) {
    const value = String(topic || "").trim().replace(/\s+/g, " ").slice(0, TELEGRAM_NEWS_TOPIC_LENGTH_LIMIT);
    if (value && !unique.has(value.toLocaleLowerCase("th"))) unique.set(value.toLocaleLowerCase("th"), value);
  }
  return [...unique.values()].slice(0, TELEGRAM_NEWS_TOPIC_LIMIT);
}

async function telegramNewsConfig(chatOwner) {
  if (!chatOwner) return { topics: [], period: "1d" };
  const auth = (await telegramAuthDoc(chatOwner).get()).data() || {};
  const news = auth.telegramNews || {};
  return {
    topics: normalizeTelegramNewsTopics(news.topics),
    period: TELEGRAM_NEWS_PERIODS[news.period] ? news.period : "1d"
  };
}

async function telegramNewsTopics(chatOwner) {
  return (await telegramNewsConfig(chatOwner)).topics;
}

async function saveTelegramNewsConfig(chatOwner, updates) {
  const current = await telegramNewsConfig(chatOwner);
  const next = {
    topics: updates.topics === undefined ? current.topics : normalizeTelegramNewsTopics(updates.topics),
    period: TELEGRAM_NEWS_PERIODS[updates.period] ? updates.period : current.period,
    updatedAt: Date.now()
  };
  await telegramAuthDoc(chatOwner).set({ telegramNews: next }, { merge: true });
  return next;
}

async function saveTelegramNewsTopics(chatOwner, topics) {
  return (await saveTelegramNewsConfig(chatOwner, { topics })).topics;
}

function telegramNewsTopicList(topics) {
  if (!topics.length) {
    return "ยังไม่มีหัวข้อข่าวที่ติดตาม\nเพิ่มได้ด้วย /news_add ตามด้วยหัวข้อ เช่น /news_add AI";
  }
  return "📋 หัวข้อข่าวที่ติดตาม\n\n" + topics.map((topic, index) => `${index + 1}. ${topic}`).join("\n") +
    "\n\nเพิ่ม: /news_add หัวข้อ\nลบ: /news_remove ลำดับหรือชื่อหัวข้อ";
}

function telegramNewsControllerText(config) {
  return "📰 News Controller\n\n" +
    `ช่วงข่าว: ${TELEGRAM_NEWS_PERIODS[config.period]}\n` +
    `หัวข้อที่ติดตาม: ${config.topics.length}/${TELEGRAM_NEWS_TOPIC_LIMIT}\n\n` +
    "เลือกการทำงานจากปุ่มด้านล่าง";
}

function telegramNewsControllerKeyboard(config) {
  return {
    inline_keyboard: [
      [{ text: "📰 อ่านทุกหัวข้อ", callback_data: "news:now" }, { text: "🌐 ข่าวเด่น Google News", callback_data: "news:top" }],
      [{ text: "🔎 ค้นหาข่าว", callback_data: "news:search" }],
      [{ text: `🗂 จัดการหัวข้อ (${config.topics.length})`, callback_data: "news:topics:0" }],
      [
        { text: config.period === "1h" ? "✓ 1 ชม." : "1 ชม.", callback_data: "news:period:1h" },
        { text: config.period === "6h" ? "✓ 6 ชม." : "6 ชม.", callback_data: "news:period:6h" },
        { text: config.period === "1d" ? "✓ 24 ชม." : "24 ชม.", callback_data: "news:period:1d" },
        { text: config.period === "7d" ? "✓ 7 วัน" : "7 วัน", callback_data: "news:period:7d" }
      ],
      [{ text: "↻ รีเฟรชแผง", callback_data: "news:panel" }, { text: "✕ ปิดแผง", callback_data: "news:close" }]
    ]
  };
}

function newsTopicPage(config, page = 0) {
  const pageCount = Math.max(1, Math.ceil(config.topics.length / TELEGRAM_NEWS_TOPIC_PAGE_SIZE));
  const currentPage = Math.max(0, Math.min(page, pageCount - 1));
  const start = currentPage * TELEGRAM_NEWS_TOPIC_PAGE_SIZE;
  return { currentPage, pageCount, start, topics: config.topics.slice(start, start + TELEGRAM_NEWS_TOPIC_PAGE_SIZE) };
}

function newsTopicPagination(prefix, currentPage, pageCount) {
  if (pageCount < 2) return [];
  const buttons = [];
  if (currentPage > 0) buttons.push({ text: "← ก่อนหน้า", callback_data: `news:${prefix}:${currentPage - 1}` });
  buttons.push({ text: `${currentPage + 1}/${pageCount}`, callback_data: "news:noop" });
  if (currentPage + 1 < pageCount) buttons.push({ text: "ถัดไป →", callback_data: `news:${prefix}:${currentPage + 1}` });
  return [buttons];
}

function telegramNewsTopicsText(config, page) {
  const view = newsTopicPage(config, page);
  const list = view.topics.length
    ? view.topics.map((topic, index) => `${view.start + index + 1}. ${topic}`).join("\n")
    : "ยังไม่มีหัวข้อข่าว";
  return `🗂 หัวข้อที่ติดตาม (${config.topics.length}/${TELEGRAM_NEWS_TOPIC_LIMIT})\n\n${list}\n\nกดหัวข้อเพื่ออ่านข่าวล่าสุด`;
}

function telegramNewsTopicsKeyboard(config, page) {
  const view = newsTopicPage(config, page);
  const topicRows = view.topics.map((topic, index) => [{ text: `🗞 ${topic}`, callback_data: `news:topic:${view.start + index}` }]);
  return {
    inline_keyboard: [
      ...topicRows,
      ...newsTopicPagination("topics", view.currentPage, view.pageCount),
      [{ text: "＋ เพิ่มหัวข้อ", callback_data: "news:add" }, { text: "− ลบหัวข้อ", callback_data: `news:remove:0` }],
      [{ text: "← กลับ News Controller", callback_data: "news:panel" }]
    ]
  };
}

function telegramNewsRemoveTopicsKeyboard(config, page) {
  const view = newsTopicPage(config, page);
  const rows = view.topics.map((topic, index) => [{ text: `− ${topic}`, callback_data: `news:remove_item:${view.start + index}` }]);
  return {
    inline_keyboard: [
      ...rows,
      ...newsTopicPagination("remove", view.currentPage, view.pageCount),
      [{ text: "← กลับหัวข้อ", callback_data: `news:topics:${view.currentPage}` }]
    ]
  };
}

function thaiRelativeNewsTime(publishedAt) {
  if (!publishedAt) return "เวลาไม่ระบุ";
  const minutes = Math.max(0, Math.floor((Date.now() - publishedAt) / 60_000));
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

function googleNewsArticleKeyboard(items, trailingRows = []) {
  const articleRows = [];
  for (let index = 0; index < items.length; index += 2) {
    articleRows.push(items.slice(index, index + 2).map((item, offset) => ({
      text: `↗ อ่านข่าว ${index + offset + 1}`,
      url: item.url
    })));
  }
  return { inline_keyboard: [...articleRows, ...trailingRows] };
}

function formatGoogleNewsResults(topic, items, period = "1d") {
  if (period === "top") {
    if (!items.length) return { text: "🌐 ข่าวเด่น Google News\n\nยังไม่มีข่าวเด่นในขณะนี้", items: [] };
    let text = `🌐 ข่าวเด่น Google News\n${items.length} รายการล่าสุด\n`;
    const visibleItems = [];
    for (const item of items) {
      const index = visibleItems.length + 1;
      const metadata = [item.source, thaiRelativeNewsTime(item.publishedAt)].filter(Boolean).join(" · ");
      const entry = `\n${index}. ${item.title}\n   ${metadata}`;
      if ((text + entry).length > TELEGRAM_MESSAGE_CHUNK_LIMIT) break;
      text += entry;
      visibleItems.push(item);
    }
    return { text, items: visibleItems };
  }
  const periodLabel = TELEGRAM_NEWS_PERIODS[period] || TELEGRAM_NEWS_PERIODS["1d"];
  if (!items.length) {
    return {
      text: `📰 ${topic}\n\nไม่มีข่าวใหม่ในช่วง ${periodLabel} ที่ผ่านมา`,
      items: []
    };
  }
  let text = `📰 ${topic}\nข่าวย้อนหลัง ${periodLabel} · ${items.length} รายการ\n`;
  const visibleItems = [];
  for (const item of items) {
    const index = visibleItems.length + 1;
    const metadata = [item.source, thaiRelativeNewsTime(item.publishedAt)].filter(Boolean).join(" · ");
    const entry = `\n${index}. ${item.title}\n   ${metadata}`;
    if ((text + entry).length > TELEGRAM_MESSAGE_CHUNK_LIMIT) break;
    text += entry;
    visibleItems.push(item);
  }
  return { text, items: visibleItems };
}

function telegramNewsResultLimit(period) {
  return TELEGRAM_NEWS_RESULTS_BY_PERIOD[period] || TELEGRAM_NEWS_RESULTS_BY_PERIOD["1d"];
}

function spaceTelegramNewsBrief(brief) {
  const lines = String(brief || "").trim().split("\n").filter((line) => line.trim() !== "·");
  const spaced = [];
  let hasNewsItem = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const startsNewsItem = /^\d+[.)]\s+/.test(trimmed);
    const startsSummary = /^สรุป\s*:/.test(trimmed);
    if ((startsNewsItem && hasNewsItem) || (startsSummary && hasNewsItem)) {
      if (spaced[spaced.length - 1] !== "·") spaced.push("", "·", "");
    }
    spaced.push(line);
    if (startsNewsItem) hasNewsItem = true;
  }
  return spaced.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function summarizeTelegramNewsTopic(userId, topic, items) {
  if (!items.length) return null;
  const claim = await claimGeminiChatUsage(userId);
  if (claim.status !== "claimed") return null;
  try {
    const headlines = items.slice(0, TELEGRAM_NEWS_RESULTS_BY_PERIOD["7d"]).map((item, index) =>
      `${index + 1}. ${item.title}\nแหล่งข่าว: ${item.source || "ไม่ระบุ"}\nเผยแพร่: ${thaiRelativeNewsTime(item.publishedAt)}`
    ).join("\n\n");
    const payload = await generateContent({
      systemInstruction: { parts: [{ text: "You are MR.Zettascale. Write concise Thai news briefs using only the supplied headlines, sources, and publication times. Never infer article details, causes, numbers, or facts that are not explicitly supplied. Write one numbered item for every supplied headline, with each item limited to one short sentence. Put a standalone middle dot '·' on its own line between each news item. End with one short sentence beginning with 'สรุป:' after another standalone middle dot." }] },
      contents: [{
        role: "user",
        parts: [{ text: `หัวข้อข่าว: ${topic}\n\nพาดหัวที่ให้มา:\n${headlines}\n\nตอบเป็นภาษาไทยในรูปแบบ:\n1. ...\n2. ...\nสรุป: ...` }]
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
    });
    return spaceTelegramNewsBrief(telegramFreeAiText(payload).slice(0, TELEGRAM_NEWS_AI_BRIEF_LIMIT));
  } catch (error) {
    await releaseGeminiChatUsage(claim).catch(() => {});
    console.error(`[telegram] AI news brief for "${topic}" failed:`, error.message);
    return null;
  }
}

function formatGoogleNewsBrief(topic, items, period, brief) {
  if (!brief) return formatGoogleNewsResults(topic, items, period);
  const periodLabel = TELEGRAM_NEWS_PERIODS[period] || TELEGRAM_NEWS_PERIODS["1d"];
  return {
    text: `📰 ${topic}\nรายงานจากพาดหัวข่าวย้อนหลัง ${periodLabel}\n\n${brief}`,
    items
  };
}

async function sendTelegramNewsDigest(topics, reply, period = "1d") {
  for (const topic of topics) {
    try {
      const items = await searchGoogleNews(topic, {
        limit: topics.length === 1 ? telegramNewsResultLimit(period) : 2,
        period
      });
      const result = formatGoogleNewsResults(topic, items, period);
      await reply(result.text, { reply_markup: googleNewsArticleKeyboard(result.items) });
    } catch (error) {
      console.error(`[telegram] Google News topic "${topic}" failed:`, error.message);
      await reply(`ตอนนี้ดึงข่าวหัวข้อ “${topic}” ไม่สำเร็จ กรุณาลองใหม่อีกครั้งครับ`);
    }
  }
}

async function handleNewsCommandCallback(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const action = String(callbackQuery.data || "").replace(/^news:/, "");
  if (!chatId || !messageId || !callbackQuery.id) return;
  const chatOwner = (await telegramChatOwnerDoc(chatId).get()).data()?.userId || null;
  const reply = chatOwner
    ? (text, options) => sendChatReply(chatOwner, chatId, text, options)
    : (text, options) => sendTelegram(chatId, text, options);
  if (!chatOwner) {
    await answerTelegramCallback(callbackQuery.id);
    await reply("เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะบันทึกหัวข้อข่าวได้ครับ");
    return;
  }
  if (action === "close") {
    await answerTelegramCallback(callbackQuery.id, "ปิดแผงแล้ว");
    await editTelegramMessage(chatId, messageId, "📰 ปิด News Controller แล้ว");
    return;
  }
  const config = await telegramNewsConfig(chatOwner);
  if (action === "panel") {
    await answerTelegramCallback(callbackQuery.id, "อัปเดตแล้ว");
    await editTelegramMessage(chatId, messageId, telegramNewsControllerText(config), { reply_markup: telegramNewsControllerKeyboard(config) });
    return;
  }
  if (action === "noop") {
    await answerTelegramCallback(callbackQuery.id);
    return;
  }
  const topicsMatch = action.match(/^topics:(\d+)$/);
  if (topicsMatch) {
    const page = Number(topicsMatch[1]);
    await answerTelegramCallback(callbackQuery.id);
    await editTelegramMessage(chatId, messageId, telegramNewsTopicsText(config, page), { reply_markup: telegramNewsTopicsKeyboard(config, page) });
    return;
  }
  if (action === "add" || action === "search") {
    pendingTelegramNewsInputs.set(String(chatId), { action, expiresAt: Date.now() + TELEGRAM_NEWS_INPUT_TTL_MS });
    await answerTelegramCallback(callbackQuery.id, action === "add" ? "รอรับหัวข้อใหม่" : "รอรับคำค้นหา");
    await reply(action === "add"
      ? "＋ ส่งหัวข้อที่ต้องการติดตามในข้อความถัดไป\nเพิ่มหลายหัวข้อได้โดยคั่นด้วยเครื่องหมายจุลภาค"
      : "🔎 ส่งหัวข้อหรือคำค้นหาข่าวในข้อความถัดไป", {
      reply_markup: { force_reply: true, input_field_placeholder: action === "add" ? "AI, เทคโนโลยี, เศรษฐกิจไทย" : "ค้นหาข่าวเรื่อง…" }
    });
    return;
  }
  const removePageMatch = action.match(/^remove:(\d+)$/);
  if (action === "remove" || removePageMatch) {
    const page = removePageMatch ? Number(removePageMatch[1]) : 0;
    await answerTelegramCallback(callbackQuery.id);
    await editTelegramMessage(chatId, messageId, config.topics.length ? "เลือกหัวข้อที่ต้องการลบ" : "ยังไม่มีหัวข้อให้ลบ", {
      reply_markup: telegramNewsRemoveTopicsKeyboard(config, page)
    });
    return;
  }
  const removeMatch = action.match(/^remove_item:(\d+)$/);
  if (removeMatch) {
    const index = Number(removeMatch[1]);
    const removed = config.topics[index];
    if (!removed) {
      await answerTelegramCallback(callbackQuery.id, "ไม่พบหัวข้อนี้");
      return;
    }
    const next = await saveTelegramNewsConfig(chatOwner, { topics: config.topics.filter((_, topicIndex) => topicIndex !== index) });
    await answerTelegramCallback(callbackQuery.id, `ลบ ${removed} แล้ว`);
    await editTelegramMessage(chatId, messageId, telegramNewsControllerText(next), { reply_markup: telegramNewsControllerKeyboard(next) });
    return;
  }
  const periodMatch = action.match(/^period:(1h|6h|1d|7d)$/);
  if (periodMatch) {
    const next = await saveTelegramNewsConfig(chatOwner, { period: periodMatch[1] });
    await answerTelegramCallback(callbackQuery.id, `เลือกข่าวย้อนหลัง ${TELEGRAM_NEWS_PERIODS[next.period]}`);
    await editTelegramMessage(chatId, messageId, telegramNewsControllerText(next), { reply_markup: telegramNewsControllerKeyboard(next) });
    return;
  }
  if (action === "top") {
    await answerTelegramCallback(callbackQuery.id, "กำลังโหลดข่าวเด่น");
    try {
      const items = await getGoogleNewsTopStories({ limit: 10 });
      const result = formatGoogleNewsResults("ข่าวเด่น Google News", items, "top");
      await editTelegramMessage(chatId, messageId, result.text, {
        reply_markup: googleNewsArticleKeyboard(result.items, [[
          { text: "← กลับ News Controller", callback_data: "news:panel" },
          { text: "↻ โหลดใหม่", callback_data: "news:top" }
        ]])
      });
    } catch (error) {
      console.error("[telegram] Google News top stories failed:", error.message);
      await editTelegramMessage(chatId, messageId, "ตอนนี้ดึงข่าวเด่นจาก Google News ไม่สำเร็จ", {
        reply_markup: { inline_keyboard: [[{ text: "← กลับ News Controller", callback_data: "news:panel" }, { text: "ลองใหม่", callback_data: "news:top" }]] }
      });
    }
    return;
  }
  const topicMatch = action.match(/^topic:(\d+)$/);
  if (topicMatch) {
    const topic = config.topics[Number(topicMatch[1])];
    if (!topic) {
      await answerTelegramCallback(callbackQuery.id, "ไม่พบหัวข้อนี้");
      return;
    }
    await answerTelegramCallback(callbackQuery.id, `กำลังโหลด ${topic}`);
    try {
      const items = await searchGoogleNews(topic, {
        limit: telegramNewsResultLimit(config.period),
        period: config.period
      });
      const brief = await summarizeTelegramNewsTopic(chatOwner, topic, items);
      const result = formatGoogleNewsBrief(topic, items, config.period, brief);
      await editTelegramMessage(chatId, messageId, result.text, {
        reply_markup: googleNewsArticleKeyboard(result.items, [[
          { text: "← กลับ News Controller", callback_data: "news:panel" },
          { text: "↻ โหลดใหม่", callback_data: `news:topic:${topicMatch[1]}` }
        ]])
      });
    } catch (error) {
      console.error(`[telegram] Google News topic "${topic}" failed:`, error.message);
      await editTelegramMessage(chatId, messageId, `ตอนนี้ดึงข่าวหัวข้อ “${topic}” ไม่สำเร็จ`, {
        reply_markup: { inline_keyboard: [[{ text: "← กลับ News Controller", callback_data: "news:panel" }, { text: "ลองใหม่", callback_data: `news:topic:${topicMatch[1]}` }]] }
      });
    }
    return;
  }
  if (action === "now") {
    await answerTelegramCallback(callbackQuery.id, "กำลังโหลดข่าวล่าสุด");
    if (!config.topics.length) {
      await reply("ยังไม่มีหัวข้อข่าว กด ＋ เพิ่มหัวข้อ ใน News Controller ก่อนครับ");
      return;
    }
    await sendTelegramNewsDigest(config.topics, reply, config.period);
  }
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
  // same entries to both scopes every time the backend starts.
  const commands = BOT_MENU_COMMANDS.map(({ command, description }) => ({ command, description }));
  const setCommandsForScope = async (scope) => {
    const response = await fetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands, ...(scope ? { scope } : {}) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(`ตั้งเมนูคำสั่ง Telegram ไม่สำเร็จ: ${data.description || response.status}`);
  };

  for (const scope of [undefined, { type: "all_private_chats" }]) {
    await setCommandsForScope(scope);
  }

  // Older releases registered chat-scoped commands before attempting an
  // invalid private-chat chat_member scope. Those successful writes survive
  // deployments and take precedence over all_private_chats. Remove the legacy
  // language-neutral overrides so linked chats inherit the current menu.
  // Page through IDs only; do not load chat messages or user profiles.
  let cursor;
  while (true) {
    let query = db.collection("telegram-chat-owners").select().limit(100);
    if (cursor) query = query.startAfter(cursor);
    const chats = await query.get();
    for (const chat of chats.docs) {
      if (!/^\d+$/.test(chat.id)) continue;
      const response = await fetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/deleteMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: { type: "chat", chat_id: chat.id } })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(`ล้างเมนูคำสั่ง Telegram เก่าไม่สำเร็จ: ${data.description || response.status}`);
    }
    if (chats.size < 100) break;
    cursor = chats.docs[chats.docs.length - 1];
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

// Clears only the app-owned mirror used by MR.Zettascale. Telegram's native
// conversation remains intact: a bot cannot safely erase a person's complete
// chat history on another client, while this mirror is explicitly disposable.
router.delete("/messages", async (req, res, next) => {
  try {
    const collection = telegramMessagesCol(req.userId);
    let removed = 0;
    while (true) {
      const snapshot = await collection.limit(400).get();
      if (snapshot.empty) break;
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      removed += snapshot.size;
    }
    await telegramAuthDoc(req.userId).set({ unreadCount: 0, chatClearedAt: Date.now() }, { merge: true });
    res.json({ ok: true, removed });
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
      telegramMessageId: sentMessage?.message_id,
      kind: "notification"
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

module.exports.webhook = async function telegramWebhook(req, res, next) {
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
    if (callbackQuery?.data?.startsWith("ai:")) {
      await handleAiCommandCallback(callbackQuery);
      return res.sendStatus(200);
    }
    if (callbackQuery?.data?.startsWith("news:")) {
      await handleNewsCommandCallback(callbackQuery);
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

    const pendingNewsInput = pendingTelegramNewsInputs.get(String(chatId));
    if (pendingNewsInput?.expiresAt < Date.now()) pendingTelegramNewsInputs.delete(String(chatId));
    if (pendingTelegramNewsInputs.has(String(chatId)) && text && !text.startsWith("/")) {
      pendingTelegramNewsInputs.delete(String(chatId));
      if (!chatOwner) {
        await reply("เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะใช้ News Controller ได้ครับ");
        return res.sendStatus(200);
      }
      if (pendingNewsInput.action === "search") {
        const topic = normalizeTelegramNewsTopics([text])[0];
        const config = await telegramNewsConfig(chatOwner);
        await sendTelegramNewsDigest(topic ? [topic] : [], reply, config.period);
        return res.sendStatus(200);
      }
      if (pendingNewsInput.action === "add") {
        const additions = normalizeTelegramNewsTopics(text.split(","));
        const current = await telegramNewsTopics(chatOwner);
        const next = await saveTelegramNewsConfig(chatOwner, { topics: [...current, ...additions] });
        const added = next.topics.filter((topic) => !current.some((old) => old.toLocaleLowerCase("th") === topic.toLocaleLowerCase("th")));
        await reply(added.length
          ? `✅ เพิ่มหัวข้อ: ${added.join(", ")}\nเปิด /news เพื่อเลือกอ่านข่าวได้เลย`
          : `ไม่ได้เพิ่มหัวข้อใหม่ อาจมีหัวข้อนี้อยู่แล้วหรือครบ ${TELEGRAM_NEWS_TOPIC_LIMIT} หัวข้อแล้ว`);
        return res.sendStatus(200);
      }
    }

    if (/^\/cmd(?:@\w+)?$/i.test(text)) {
      await reply(COMMAND_HELP_TEXT, { reply_markup: CUSTOM_COMMAND_KEYBOARD });
      return res.sendStatus(200);
    }

    if (/^\/(?:myid|chatid)(?:@\w+)?$/i.test(text)) {
      await reply(`รหัส Telegram chat ของคุณ: ${chatId}\nตั้งค่า TELEGRAM_ANNOUNCEMENT_ADMIN_CHAT_IDS=${chatId} ใน Render เพื่อใช้คำสั่งประกาศ`);
      return res.sendStatus(200);
    }

    if (/^\/news(?:@\w+)?$/i.test(text)) {
      if (!chatOwner) {
        await reply("เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะใช้ News Controller ได้ครับ");
        return res.sendStatus(200);
      }
      const config = await telegramNewsConfig(chatOwner);
      await reply(telegramNewsControllerText(config), { reply_markup: telegramNewsControllerKeyboard(config) });
      return res.sendStatus(200);
    }

    const newsAddMatch = text.match(/^\/news_add(?:@\w+)?(?:\s+([\s\S]+))?$/i);
    if (newsAddMatch) {
      if (!chatOwner) {
        await reply("เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะบันทึกหัวข้อข่าวได้ครับ");
        return res.sendStatus(200);
      }
      const additions = normalizeTelegramNewsTopics(String(newsAddMatch[1] || "").split(","));
      if (!additions.length) {
        await reply("ใส่หัวข้อหลังคำสั่ง เช่น /news_add AI, เทคโนโลยี");
        return res.sendStatus(200);
      }
      const current = await telegramNewsTopics(chatOwner);
      const topics = await saveTelegramNewsTopics(chatOwner, [...current, ...additions]);
      const added = topics.filter((topic) => !current.some((old) => old.toLocaleLowerCase("th") === topic.toLocaleLowerCase("th")));
      await reply(added.length
        ? `✅ เพิ่มหัวข้อ: ${added.join(", ")}\n\n${telegramNewsTopicList(topics)}`
        : `หัวข้อนี้มีอยู่แล้ว หรือครบ ${TELEGRAM_NEWS_TOPIC_LIMIT} หัวข้อแล้ว\n\n${telegramNewsTopicList(topics)}`);
      return res.sendStatus(200);
    }

    if (/^\/news_list(?:@\w+)?$/i.test(text)) {
      const topics = await telegramNewsTopics(chatOwner);
      await reply(chatOwner ? telegramNewsTopicList(topics) : "เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะบันทึกหัวข้อข่าวได้ครับ");
      return res.sendStatus(200);
    }

    const newsRemoveMatch = text.match(/^\/news_remove(?:@\w+)?(?:\s+([\s\S]+))?$/i);
    if (newsRemoveMatch) {
      if (!chatOwner) {
        await reply("เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะบันทึกหัวข้อข่าวได้ครับ");
        return res.sendStatus(200);
      }
      const target = String(newsRemoveMatch[1] || "").trim();
      const current = await telegramNewsTopics(chatOwner);
      const position = /^\d+$/.test(target) ? Number(target) - 1 : -1;
      const removed = position >= 0 && position < current.length
        ? current[position]
        : current.find((topic) => topic.toLocaleLowerCase("th") === target.toLocaleLowerCase("th"));
      if (!removed) {
        await reply("ไม่พบหัวข้อที่ต้องการลบ ดูชื่อและหมายเลขได้ด้วย /news_list");
        return res.sendStatus(200);
      }
      const topics = await saveTelegramNewsTopics(chatOwner, current.filter((topic) => topic !== removed));
      await reply(`ลบหัวข้อ “${removed}” แล้ว\n\n${telegramNewsTopicList(topics)}`);
      return res.sendStatus(200);
    }

    const newsNowMatch = text.match(/^\/news_now(?:@\w+)?(?:\s+([\s\S]+))?$/i);
    if (newsNowMatch) {
      const requestedTopic = String(newsNowMatch[1] || "").trim();
      const config = await telegramNewsConfig(chatOwner);
      const topics = requestedTopic ? normalizeTelegramNewsTopics([requestedTopic]) : config.topics;
      if (!topics.length) {
        await reply(chatOwner ? telegramNewsTopicList(topics) : "ระบุหัวข้อได้โดยตรง เช่น /news_now AI");
        return res.sendStatus(200);
      }
      await sendTelegramNewsDigest(topics, reply, config.period);
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

    if (/^\/ai_commands(?:@\w+)?$/i.test(text)) {
      await reply("🤖 ชุดคำสั่ง AI\n\nเลือกสิ่งที่ต้องการทำได้จากปุ่มด้านล่าง", { reply_markup: AI_COMMAND_COLLECTION_KEYBOARD });
      return res.sendStatus(200);
    }

    const freeAiCommand = text.match(/^\/ai(?:@\w+)?(?:\s+(on|off|clear|reset|status))?$/i)
      || text.match(/^\/ai_(on|off|clear|reset|status)(?:@\w+)?$/i);
    if (freeAiCommand) {
      const action = (freeAiCommand[1] || "status").toLowerCase();
      await runTelegramFreeAiCommand(chatId, chatOwner, action, reply);
      return res.sendStatus(200);
    }

    // When the owner enables free AI mode, ordinary text goes to Gemini before
    // the deterministic T.i.M.E.S. keyword responder. Commands still keep
    // their normal meaning and never become model input by accident.
    if (chatOwner && text && !text.startsWith("/") && isTelegramFreeAiAllowed(chatId, chatOwner)) {
      const freeAi = (await telegramAuthDoc(chatOwner).get()).data()?.telegramFreeAi;
      if (freeAi?.enabled) {
        try {
          const result = await answerTelegramFreeAi(chatOwner, text);
          await sendTelegramFreeAiReply(chatOwner, chatId, result.text);
        } catch (error) {
          console.error("[telegram] free AI reply failed:", error.message);
          await reply("ตอนนี้ AI ตอบไม่ได้ กรุณาลองใหม่อีกครั้งครับ");
        }
        return res.sendStatus(200);
      }
    }

    // Telegram can answer only documented product questions here. This is a
    // deterministic knowledge lookup, so it never calls Gemini or consumes
    // the Activity Mode AI quota.
    const commandName = text.match(/^\/(general_questions|times|features)(?:@\w+)?$/i)?.[1]?.toLowerCase();
    const requestedNode = commandName === "general_questions"
      ? "general-questions"
      : commandName || productNodeForText(text);
    if (commandName === "general_questions") {
      const { node, text: menuText } = productQuestionResponse(requestedNode);
      await reply(menuText, { reply_markup: productQuestionKeyboard(node) });
      return res.sendStatus(200);
    }
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
    // Let the shared error handler classify Firestore RESOURCE_EXHAUSTED,
    // open the quota circuit breaker, and suppress repeated Render logs from
    // Telegram retries. Non-quota failures are still logged centrally.
    next(error);
  }
};
