const crypto = require("crypto");
const express = require("express");
const { FieldValue, FieldPath } = require("firebase-admin/firestore");
const { db, telegramAuthDoc, telegramLinkDoc, telegramMessagesCol, telegramChatOwnerDoc, announcementDoc } = require("../lib/firestore-db.js");
const { normalizeAnnouncementConfig } = require("../lib/announcement-config.js");
const { answerTimesQuestion } = require("../skills/activity-creation/times-knowledge.js");
const { generateContent } = require("../lib/gemini-api.js");
const { claimGeminiChatUsage, releaseGeminiChatUsage, isDeveloperUser } = require("../lib/gemini-chat.js");
const { searchGoogleNews, getGoogleNewsTopStories } = require("../lib/google-news.js");
const { createWeatherController } = require("../lib/telegram-weather.js");
const { buildZettascaleInstruction } = require("../lib/zettascale-persona.js");
const { telegramFetch } = require("../lib/telegram-fetch.js");

const { createTelegramWebhookHandlers } = require("../lib/telegram-webhook.js");
const {
  PRODUCT_QUESTION_NODES,
  productQuestionKeyboard,
  productQuestionResponse,
  productNodeForText,
  isAnnouncementAdmin,
  formatAnnouncementPanel,
  announcementInlineKeyboard,
} = require("../lib/telegram-product-questions.js");
const {
  normalizeTelegramNewsTopics,
  telegramNewsTopicList,
  telegramNewsControllerText,
  telegramNewsControllerKeyboard,
  telegramNewsTopicsText,
  telegramNewsTopicsKeyboard,
  telegramNewsPriorityText,
  telegramNewsPriorityKeyboard,
  telegramNewsRemoveTopicsKeyboard,
  thaiRelativeNewsTime,
  googleNewsArticleKeyboard,
  formatGoogleNewsResults,
  telegramNewsResultLimit,
  spaceTelegramNewsBrief,
} = require("../lib/telegram-news-controller.js");
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
const TELEGRAM_NEWS_TOPIC_LIMIT = 20;
const TELEGRAM_NEWS_TOPIC_LENGTH_LIMIT = 80;
const TELEGRAM_NEWS_TOPIC_PAGE_SIZE = 4;
const TELEGRAM_NEWS_AI_BRIEF_LIMIT = 2_400;
const TELEGRAM_NEWS_INPUT_TTL_MS = 10 * 60 * 1000;
const TELEGRAM_NEWS_MAX_REPORT_ITEMS = 10;
const TELEGRAM_NEWS_ALL_TOPICS_ITEMS_PER_TOPIC = 3;
const PRIORITY_NEWS_SUBSCRIPTIONS = "telegram-priority-news";
const PRIORITY_NEWS_POLL_MS = Math.max(60_000, Number(process.env.TELEGRAM_PRIORITY_NEWS_POLL_MS || 5 * 60_000));
const PRIORITY_NEWS_RESULT_LIMIT = TELEGRAM_NEWS_MAX_REPORT_ITEMS;
const TELEGRAM_NEWS_PERIODS = Object.freeze({ "1h": "1 ชั่วโมง", "6h": "6 ชั่วโมง", "1d": "24 ชั่วโมง", "7d": "7 วัน" });
const TELEGRAM_NEWS_RESULTS_BY_PERIOD = Object.freeze({ "1h": 3, "6h": 5, "1d": 8, "7d": 10 });
const pendingAnnouncementMessageEdits = new Map();
const pendingTelegramNewsInputs = new Map();
const weatherController = createWeatherController({
  authDoc: telegramAuthDoc, claimUsage: claimGeminiChatUsage, releaseUsage: releaseGeminiChatUsage,
  generate: generateContent, aiText: telegramFreeAiText, quotaText: freeAiQuotaReply
});
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
  { command: "news_priority", description: "ตั้งหัวข้อข่าวเร่งด่วน", help: "เลือกหนึ่งหัวข้อเพื่อรับข่าวใหม่ทันที", usage: "/news_priority หัวข้อ หรือ /news_priority off" },
  { command: "weather", description: "พยากรณ์อากาศด้วย Google", help: "พิมพ์ /weather กรุงเทพฯ หรือส่งตำแหน่งปัจจุบัน" },
  { command: "weather_ask", description: "ถาม AI เรื่องอากาศ", help: "ถามอากาศของสถานที่ที่เลือก เช่น /weather_ask พรุ่งนี้เย็นเหมาะกับวิ่งไหม" },
  { command: "weather_cancel", description: "ปิดแผงพยากรณ์อากาศ", help: "ยกเลิกขั้นตอนและปิด Weather Controller" },
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
  return buildZettascaleInstruction(
    "Answer general questions freely with clear reasoning and useful detail when requested. You may discuss any topic, not only T.i.M.E.S. For questions about T.i.M.E.S., use only verified product details supplied in context; otherwise say what is unknown. Do not claim to control T.i.M.E.S. or perform actions unless explicitly requested and the capability is available.",
    { customInstruction: String(process.env.TELEGRAM_FREE_AI_SYSTEM_INSTRUCTION || "") }
  );
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
  const response = await telegramFetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...options })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`Telegram ส่งข้อความไม่สำเร็จ: ${data.description || response.status}`);
  return data.result;
}

async function answerTelegramCallback(callbackQueryId, text = "") {
  const response = await telegramFetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`ตอบ Telegram Inline Keyboard ไม่สำเร็จ: ${data.description || response.status}`);
}

async function editTelegramMessage(chatId, messageId, text, options = {}) {
  const response = await telegramFetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/editMessageText`, {
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
    transaction.set(telegramAuthDoc(userId), {
      chatRevision: crypto.randomUUID(),
      ...(!existing.exists && direction === "outgoing" && !readAt ? { unreadCount: FieldValue.increment(1) } : {})
    }, { merge: true });
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

function telegramAiStatusPanel(enabled) {
  return {
    text: enabled
      ? "🟢 โหมด AI เปิดอยู่\nข้อความทั่วไปที่ส่งในแชตนี้จะให้ AI ตอบ\nใช้ /ai off เพื่อปิดโหมด"
      : "⚫ โหมด AI ปิดอยู่\nใช้ /ai on เพื่อเปิดโหมด AI",
    reply_markup: { inline_keyboard: [[{
      text: enabled ? "⚫ ปิดโหมด AI" : "🟢 เปิดโหมด AI",
      callback_data: enabled ? "ai:off" : "ai:on"
    }]] }
  };
}

async function pinTelegramMessage(chatId, messageId) {
  const response = await telegramFetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/pinChatMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, disable_notification: true })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`ปักหมุดสถานะ AI ไม่สำเร็จ: ${data.description || response.status}`);
}

async function syncTelegramAiStatusPanel(chatId, chatOwner, enabled, statusMessageId) {
  const panel = telegramAiStatusPanel(enabled);
  let messageId = Number(statusMessageId);
  if (Number.isSafeInteger(messageId) && messageId > 0) {
    try {
      await editTelegramMessage(chatId, messageId, panel.text, { reply_markup: panel.reply_markup });
      await saveChatMessage(chatOwner, { direction: "outgoing", text: panel.text, telegramMessageId: messageId });
    } catch (error) {
      // The user may have deleted the old panel for both sides of the chat.
      if (!/message to edit not found|message_id_invalid|message can't be edited/i.test(error.message)) throw error;
      messageId = null;
    }
  } else {
    messageId = null;
  }
  if (!messageId) {
    const sent = await sendChatReply(chatOwner, chatId, panel.text, { reply_markup: panel.reply_markup });
    messageId = sent.message_id;
    await telegramAuthDoc(chatOwner).set({ telegramFreeAi: { statusMessageId: messageId } }, { merge: true });
  }
  await pinTelegramMessage(chatId, messageId);
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
    await syncTelegramAiStatusPanel(chatId, chatOwner, true, current.statusMessageId)
      .catch(error => console.error("[telegram] AI status panel failed:", error.message));
    await reply("✦ เปิดโหมด AI แล้วครับ พิมพ์คุยได้อย่างอิสระ ใช้ /ai off เพื่อปิด และ /ai clear เพื่อล้างบริบท");
  } else if (action === "off") {
    await authRef.set({ telegramFreeAi: { enabled: false, history: normalizedTelegramFreeAiHistory(current.history), updatedAt: Date.now() } }, { merge: true });
    await syncTelegramAiStatusPanel(chatId, chatOwner, false, current.statusMessageId)
      .catch(error => console.error("[telegram] AI status panel failed:", error.message));
    await reply("ปิดโหมด AI แล้วครับ ข้อความถัดไปจะกลับไปใช้คำสั่งและคำตอบ T.i.M.E.S. ตามปกติ");
  } else if (action === "clear" || action === "reset") {
    await authRef.set({ telegramFreeAi: { enabled: Boolean(current.enabled), history: [], updatedAt: Date.now() } }, { merge: true });
    await reply("ล้างบริบทการคุย AI แล้วครับ");
  } else {
    if (current.enabled) {
      await syncTelegramAiStatusPanel(chatId, chatOwner, true, current.statusMessageId)
        .catch(error => console.error("[telegram] AI status panel failed:", error.message));
    }
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

async function telegramNewsConfig(chatOwner) {
  if (!chatOwner) return { topics: [], priorityTopic: null, period: "1d" };
  const auth = (await telegramAuthDoc(chatOwner).get()).data() || {};
  const news = auth.telegramNews || {};
  const topics = normalizeTelegramNewsTopics(news.topics);
  const requestedPriority = normalizeTelegramNewsTopics([news.priorityTopic])[0];
  const panelMessageId = Number.isInteger(Number(news.panelMessageId)) && Number(news.panelMessageId) > 0 ? Number(news.panelMessageId) : null;
  return {
    topics,
    priorityTopic: requestedPriority && topics.find(topic => topic.toLocaleLowerCase("th") === requestedPriority.toLocaleLowerCase("th")) || null,
    panelMessageId,
    period: TELEGRAM_NEWS_PERIODS[news.period] ? news.period : "1d"
  };
}

async function telegramNewsTopics(chatOwner) {
  return (await telegramNewsConfig(chatOwner)).topics;
}

async function saveTelegramNewsConfig(chatOwner, updates) {
  const current = await telegramNewsConfig(chatOwner);
  const topics = updates.topics === undefined ? current.topics : normalizeTelegramNewsTopics(updates.topics);
  const requestedPriority = updates.priorityTopic === undefined ? current.priorityTopic : normalizeTelegramNewsTopics([updates.priorityTopic])[0];
  const next = {
    topics,
    priorityTopic: requestedPriority && topics.find(topic => topic.toLocaleLowerCase("th") === requestedPriority.toLocaleLowerCase("th")) || null,
    ...(current.panelMessageId ? { panelMessageId: current.panelMessageId } : {}),
    period: TELEGRAM_NEWS_PERIODS[updates.period] ? updates.period : current.period,
    updatedAt: Date.now()
  };
  await telegramAuthDoc(chatOwner).set({ telegramNews: next }, { merge: true });
  return next;
}

async function saveTelegramNewsTopics(chatOwner, topics) {
  return (await saveTelegramNewsConfig(chatOwner, { topics })).topics;
}

async function closePreviousNewsPanel(userId, chatId) {
  const auth = (await telegramAuthDoc(userId).get()).data() || {};
  const messageId = Number(auth.telegramNews?.panelMessageId);
  if (!Number.isInteger(messageId) || messageId <= 0) return;
  try {
    await editTelegramMessage(chatId, messageId, "📰 ปิด News Controller แล้ว");
  } catch (error) {
    // A panel can have been deleted manually or become too old for Telegram to
    // edit. It must not prevent a fresh /news panel from opening.
    console.warn("[telegram] close previous news panel failed:", error.message);
  } finally {
    await telegramAuthDoc(userId).set({ telegramNews: { panelMessageId: FieldValue.delete() } }, { merge: true });
  }
}

async function rememberNewsPanel(userId, messageId) {
  if (!Number.isInteger(Number(messageId)) || Number(messageId) <= 0) return;
  await telegramAuthDoc(userId).set({ telegramNews: { panelMessageId: Number(messageId) } }, { merge: true });
}

async function clearRememberedNewsPanel(userId, messageId) {
  if (!userId) return;
  const auth = (await telegramAuthDoc(userId).get()).data() || {};
  if (Number(auth.telegramNews?.panelMessageId) === Number(messageId)) {
    await telegramAuthDoc(userId).set({ telegramNews: { panelMessageId: FieldValue.delete() } }, { merge: true });
  }
}

async function summarizeTelegramNewsTopic(userId, topic, items, { includeSummary = true } = {}) {
  if (!userId || !items.length) return null;
  const claim = await claimGeminiChatUsage(userId);
  if (claim.status !== "claimed") return null;
  try {
    const headlines = items.slice(0, TELEGRAM_NEWS_MAX_REPORT_ITEMS).map((item, index) =>
      `${index + 1}. ${item.title}\nแหล่งข่าว: ${item.source || "ไม่ระบุ"}\nเผยแพร่: ${thaiRelativeNewsTime(item.publishedAt)}`
    ).join("\n\n");
    const payload = await generateContent({
      systemInstruction: { parts: [{ text: buildZettascaleInstruction(`Write concise Thai news briefs using only the supplied headlines, sources, and publication times. Never infer article details, causes, numbers, or facts that are not explicitly supplied. Rewrite every supplied headline into plain, easy Thai in one short numbered sentence of at most 24 Thai words. Keep the important named people, places, dates, and figures only when supplied. Put a standalone middle dot '·' on its own line between each news item.${includeSummary ? " Return every block in this exact order: numbered news items; a standalone middle dot; the heading '📅 กำหนดการสำคัญ'; key dates; a standalone middle dot; one sentence beginning with 'สรุป:'. List every date, time, deadline, hearing, election, announcement, or scheduled event explicitly stated in the supplied material, whether it is past, current, or upcoming, in the form '• วันที่ — เหตุการณ์'. Write '• ไม่พบกำหนดการที่ระบุชัด' when none are stated." : " Do not add a conclusion, key-date section, or overall summary."}`, { reporting: true }) }] },
      contents: [{
        role: "user",
        parts: [{ text: `หัวข้อข่าว: ${topic}\n\nพาดหัวที่ให้มา:\n${headlines}\n\nตอบเป็นภาษาไทยในรูปแบบ:\n1. ...\n2. ...${includeSummary ? "\n📅 กำหนดการสำคัญ\n• วันที่ — เหตุการณ์\nสรุป: ..." : ""}` }]
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
  const label = period === "top"
    ? "🤖 🌐 ข่าวเด่น Google News\nรายงานจากพาดหัวข่าวล่าสุด"
    : `🤖 📰 ${topic}\nรายงานจากพาดหัวข่าวย้อนหลัง ${TELEGRAM_NEWS_PERIODS[period] || TELEGRAM_NEWS_PERIODS["1d"]}`;
  return {
    text: `${label}\n\n${brief}`,
    items
  };
}

async function sendTelegramNewsDigest(userId, topics, reply, period = "1d", { includeSummary = false, maxItemsPerTopic } = {}) {
  for (const topic of topics) {
    try {
      const items = await searchGoogleNews(topic, {
        limit: Math.min(TELEGRAM_NEWS_MAX_REPORT_ITEMS, maxItemsPerTopic || (topics.length === 1 ? telegramNewsResultLimit(period) : TELEGRAM_NEWS_ALL_TOPICS_ITEMS_PER_TOPIC)),
        period
      });
      const brief = await summarizeTelegramNewsTopic(userId, topic, items, { includeSummary });
      const result = formatGoogleNewsBrief(topic, items, period, brief);
      await reply(result.text, { reply_markup: googleNewsArticleKeyboard(result.items) });
    } catch (error) {
      console.error(`[telegram] Google News topic "${topic}" failed:`, error.message);
      await reply(`ตอนนี้ดึงข่าวหัวข้อ “${topic}” ไม่สำเร็จ กรุณาลองใหม่อีกครั้งครับ`);
    }
  }
}

function priorityNewsSubscriptionDoc(userId) {
  return db.collection(PRIORITY_NEWS_SUBSCRIPTIONS).doc(String(userId));
}

function googleNewsItemKey(item) {
  return crypto.createHash("sha256").update(`${item.url || ""}\n${item.title || ""}\n${item.publishedAt || ""}`).digest("base64url");
}

async function syncPriorityNewsSubscription(userId, priorityTopic) {
  const ref = priorityNewsSubscriptionDoc(userId);
  if (!priorityTopic) {
    await ref.delete();
    return null;
  }
  const auth = (await telegramAuthDoc(userId).get()).data() || {};
  if (!auth.chatId) throw new Error("ยังไม่ได้เชื่อม Telegram");
  const existing = (await ref.get()).data() || {};
  const topicChanged = existing.topic?.toLocaleLowerCase("th") !== priorityTopic.toLocaleLowerCase("th");
  await ref.set({
    userId, chatId: String(auth.chatId), topic: priorityTopic,
    seenItemKeys: topicChanged ? [] : Array.isArray(existing.seenItemKeys) ? existing.seenItemKeys.slice(0, 100) : [],
    updatedAt: Date.now()
  }, { merge: true });
  return ref;
}

async function checkPriorityNewsSubscription(subscriptionRef, before) {
  if (!before?.userId || !before?.chatId || !before?.topic) return;
  const items = await searchGoogleNews(before.topic, { limit: PRIORITY_NEWS_RESULT_LIMIT, period: "1d" });
  const previousKeys = new Set(before.seenItemKeys || []);
  if (!items.some(item => !previousKeys.has(googleNewsItemKey(item)))) return;
  const freshItems = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(subscriptionRef);
    const current = snapshot.data();
    if (!current?.userId || current.topic !== before.topic) return [];
    const seen = new Set(Array.isArray(current.seenItemKeys) ? current.seenItemKeys : []);
    const fresh = items.filter(item => !seen.has(googleNewsItemKey(item)));
    if (!fresh.length) return [];
    const allKeys = [...items.map(googleNewsItemKey), ...seen].slice(0, 100);
    transaction.set(subscriptionRef, { seenItemKeys: allKeys, lastCheckedAt: Date.now() }, { merge: true });
    return fresh;
  });
  if (!freshItems.length) return;
  const deliveryKey = `priority-news:${before.topic}:${freshItems.map(googleNewsItemKey).join(",")}`;
  const deliveryClaim = await claimDelivery(before.userId, deliveryKey, "priority-news", `ข่าวใหม่: ${before.topic}`);
  if (deliveryClaim.status !== "claimed") return;
  try {
    // Breaking-news alerts should be immediately scannable: short numbered
    // reports and article links only, with no key-date section or final recap.
    // If AI is unavailable, the existing formatter still provides the Google
    // News titles and article links as its fallback.
    const priorityTopic = `⚡ ข่าวด่วน: ${before.topic}`;
    const brief = await summarizeTelegramNewsTopic(before.userId, priorityTopic, freshItems, { includeSummary: false });
    const result = formatGoogleNewsBrief(priorityTopic, freshItems, "1h", brief);
    await sendChatReply(before.userId, before.chatId, result.text, { reply_markup: googleNewsArticleKeyboard(result.items) });
  } catch (error) {
    await releaseDeliveryClaim(deliveryClaim).catch(() => {});
    throw error;
  }
}

async function runPriorityNewsChecks() {
  // Empty installations should not create a periodic lease write at all.
  const anySubscription = await db.collection(PRIORITY_NEWS_SUBSCRIPTIONS).limit(1).get();
  if (anySubscription.empty) return;
  // One scan per interval across backend instances. The lease expires after
  // a crash; local single-flight below also prevents overlapping slow scans.
  const lease = db.collection("server-jobs").doc("priority-news");
  const claimed = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(lease);
    if ((snapshot.data()?.nextRunAt || 0) > Date.now()) return false;
    transaction.set(lease, { nextRunAt: Date.now() + PRIORITY_NEWS_POLL_MS });
    return true;
  });
  if (!claimed) return;
  let cursor;
  while (true) {
    let query = db.collection(PRIORITY_NEWS_SUBSCRIPTIONS).orderBy(FieldPath.documentId()).limit(100);
    if (cursor) query = query.startAfter(cursor);
    const subscriptions = await query.get();
    for (const subscription of subscriptions.docs) {
      try {
        await checkPriorityNewsSubscription(subscription.ref, subscription.data());
      } catch (error) {
        console.error(`[telegram] priority news check failed for ${subscription.id}:`, error.message);
      }
    }
    if (subscriptions.size < 100) break;
    cursor = subscriptions.docs.at(-1);
  }
}


async function handleNewsCommandCallback(callbackQuery) {
  return getWebhookHandlers().handleNewsCommandCallback(callbackQuery);
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
    const response = await telegramFetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/setMyCommands`, {
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
}

async function cleanupLegacyBotCommands() {
  const marker = db.collection("server-jobs").doc("telegram-menu-cleanup-v1");
  if ((await marker.get()).data()?.completed) return;
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
      const response = await telegramFetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/deleteMyCommands`, {
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
  await marker.set({ completed: true, completedAt: Date.now() }, { merge: true });
}

router.get("/status", async (req, res, next) => {
  try {
    const data = (await telegramAuthDoc(req.userId).get()).data();
    // Repair legacy chat ownership once, not on every status request.
    if (data?.chatId && data.chatOwnerIndexedFor !== String(data.chatId)) {
      const batch = db.batch();
      batch.set(telegramChatOwnerDoc(data.chatId), { userId: req.userId, updatedAt: Date.now() }, { merge: true });
      batch.set(telegramAuthDoc(req.userId), { chatOwnerIndexedFor: String(data.chatId) }, { merge: true });
      await batch.commit();
    }
    res.json({ connected: Boolean(data?.chatId), username: process.env.TELEGRAM_BOT_USERNAME || null });
  } catch (error) { next(error); }
});

router.get("/messages", async (req, res, next) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 30)) : 30;
    const auth = (await telegramAuthDoc(req.userId).get()).data();
    const revision = `${auth?.chatRevision || "initial"}:${limit}`;
    res.set("Cache-Control", "no-store");
    if (req.query.revision === revision) return res.status(304).end();
    const snapshot = await telegramMessagesCol(req.userId).orderBy("createdAt", "desc").limit(limit).get();
    const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).reverse();
    // A person's own messages are never unread. Only bot replies and sent
    // notifications wait for acknowledgement in the web chat.
    res.json({ revision, messages, unreadCount: messages.filter((message) => message.direction === "outgoing" && !message.readAt).length });
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
    await db.runTransaction(async transaction => {
      const authRef = telegramAuthDoc(req.userId);
      const auth = await transaction.get(authRef);
      // Undefined counters on legacy accounts still need the first scan.
      if (auth.data()?.unreadCount === 0) return;
      const snapshot = await transaction.get(telegramMessagesCol(req.userId).orderBy("createdAt", "desc").limit(30));
      const unread = snapshot.docs.filter(doc => doc.data().direction === "outgoing" && !doc.data().readAt);
      if (!unread.length) return;
      unread.forEach(doc => transaction.update(doc.ref, { readAt: Date.now() }));
      const remainingUnread = Math.max(0, Number(auth.data()?.unreadCount || 0) - unread.length);
      transaction.set(authRef, { unreadCount: remainingUnread, chatRevision: crypto.randomUUID() }, { merge: true });
    });
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
    await telegramAuthDoc(req.userId).set({ unreadCount: 0, chatClearedAt: Date.now(), chatRevision: crypto.randomUUID() }, { merge: true });
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

let priorityNewsTimer = null;
module.exports = router;
module.exports.registerBotCommands = registerBotCommands;
module.exports.cleanupLegacyBotCommands = cleanupLegacyBotCommands;
module.exports.startPriorityNewsWatcher = function startPriorityNewsWatcher() {
  if (priorityNewsTimer) return;
  let running = false;
  let retryAt = 0;
  const run = async () => {
    if (running || Date.now() < retryAt) return;
    running = true;
    try { await runPriorityNewsChecks(); }
    catch (error) {
      retryAt = Date.now() + Math.max(PRIORITY_NEWS_POLL_MS, 5 * 60_000);
      console.error("[telegram] priority news watcher failed:", error.message);
    } finally { running = false; }
  };
  const initial = setTimeout(run, 15_000);
  initial.unref?.();
  priorityNewsTimer = setInterval(run, PRIORITY_NEWS_POLL_MS);
  priorityNewsTimer.unref?.();
  console.log(`[telegram] เปิดตัวตรวจหัวข้อข่าวเร่งด่วนทุก ${Math.round(PRIORITY_NEWS_POLL_MS / 60_000)} นาที`);
};

module.exports.registerWebhook = async function registerWebhook(baseUrl) {
  const missing = [
    !process.env.TELEGRAM_BOT_TOKEN && "TELEGRAM_BOT_TOKEN",
    !process.env.TELEGRAM_WEBHOOK_SECRET && "TELEGRAM_WEBHOOK_SECRET",
    !baseUrl && "webhook base URL"
  ].filter(Boolean);
  if (missing.length) {
    // Deliberately report only variable names—never token or secret values.
    console.warn(`[telegram] ข้ามการตั้ง webhook และ Bot Command Menu: ไม่พบ ${missing.join(", ")}`);
    return false;
  }
  try {
    const identityResponse = await telegramFetch(`${BOT_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
    const identity = await identityResponse.json().catch(() => ({}));
    if (!identityResponse.ok || !identity.ok) {
      throw new Error(`ตรวจ Telegram bot ไม่สำเร็จ: ${identity.description || identityResponse.status}`);
    }
    console.log(`[telegram] ยืนยัน bot @${identity.result?.username || "unknown"} สำเร็จ`);
  } catch (error) {
    if (error.service !== "telegram" || error.operation !== "getMe") throw error;
    // A connection timeout on this diagnostic call must not prevent an
    // independent setWebhook attempt. Telegram still validates the token.
    console.warn(`[telegram] ตรวจ bot ผ่าน getMe ไม่สำเร็จ; จะลอง setWebhook ต่อ: ${error.message}`);
  }
  const response = await telegramFetch(`${BOT_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`ตั้ง Telegram webhook ไม่สำเร็จ: ${data.description || response.status}`);
  console.log(`[telegram] ตั้ง webhook สำเร็จ: ${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`);
  return true;
};

let _webhookHandlers = null;
function getWebhookHandlers() {
  if (!_webhookHandlers) {
    _webhookHandlers = createTelegramWebhookHandlers({
      announcementDoc,
      normalizeAnnouncementConfig,
      formatAnnouncementPanel,
      announcementInlineKeyboard,
      isAnnouncementAdmin,
      answerTelegramCallback,
      editTelegramMessage,
      sendTelegram,
      pendingAnnouncementMessageEdits,
      ANNOUNCEMENT_EDIT_TTL_MS,
      MAX_ANNOUNCEMENT_LENGTH,
      PRODUCT_QUESTION_NODES,
      productQuestionResponse,
      productQuestionKeyboard,
      productNodeForText,
      answerTimesQuestion,
      telegramChatOwnerDoc,
      telegramAuthDoc,
      telegramLinkDoc,
      saveChatMessage,
      sendChatReply,
      clearRememberedNewsPanel,
      telegramNewsConfig,
      telegramNewsTopics,
      saveTelegramNewsConfig,
      saveTelegramNewsTopics,
      closePreviousNewsPanel,
      rememberNewsPanel,
      telegramNewsTopicList,
      telegramNewsControllerText,
      telegramNewsControllerKeyboard,
      telegramNewsPriorityText,
      telegramNewsPriorityKeyboard,
      telegramNewsTopicsText,
      telegramNewsTopicsKeyboard,
      telegramNewsRemoveTopicsKeyboard,
      syncPriorityNewsSubscription,
      checkPriorityNewsSubscription,
      pendingTelegramNewsInputs,
      TELEGRAM_NEWS_INPUT_TTL_MS,
      TELEGRAM_NEWS_PERIODS,
      TELEGRAM_NEWS_MAX_REPORT_ITEMS,
      TELEGRAM_NEWS_ALL_TOPICS_ITEMS_PER_TOPIC,
      TELEGRAM_NEWS_TOPIC_LIMIT,
      normalizeTelegramNewsTopics,
      getGoogleNewsTopStories,
      searchGoogleNews,
      telegramNewsResultLimit,
      summarizeTelegramNewsTopic,
      formatGoogleNewsBrief,
      googleNewsArticleKeyboard,
      sendTelegramNewsDigest,
      weatherController,
      handleAiCommandCallback,
      COMMAND_HELP_TEXT,
      CUSTOM_COMMAND_KEYBOARD,
      AI_COMMAND_COLLECTION_KEYBOARD,
      runTelegramFreeAiCommand,
      isTelegramFreeAiAllowed,
      answerTelegramFreeAi,
      sendTelegramFreeAiReply,
    });
  }
  return _webhookHandlers;
}

module.exports.webhook = async function telegramWebhook(req, res, next) {
  return getWebhookHandlers().telegramWebhook(req, res, next);
};
