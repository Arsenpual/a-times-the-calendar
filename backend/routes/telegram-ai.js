const express = require("express");
const { db } = require("../firestore-db.js");
const { generateContent } = require("../gemini-api.js");

const router = express.Router();
const BOT_API = "https://api.telegram.org";
const HISTORY_LIMIT = 16;
const HISTORY_TEXT_LIMIT = 4_000;
const REPLY_LIMIT = 12_000;
const MESSAGE_CHUNK_LIMIT = 3_900;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`ไม่พบ ${name} ใน environment ของ backend`);
  return value;
}

function allowedChatIds() {
  return new Set(String(process.env.TELEGRAM_AI_ALLOWED_CHAT_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));
}

function isAllowed(chatId) {
  return allowedChatIds().has(String(chatId));
}

function sessionDoc(chatId) {
  return db.collection("telegram-ai-sessions").doc(String(chatId));
}

function normalizedHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && ["user", "model"].includes(item.role) && typeof item.text === "string")
    .map((item) => ({ role: item.role, text: item.text.trim().slice(0, HISTORY_TEXT_LIMIT) }))
    .filter((item) => item.text)
    .slice(-HISTORY_LIMIT);
}

function replyText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) throw new Error("Gemini ไม่ได้ส่งคำตอบกลับมา");
  return text.slice(0, REPLY_LIMIT);
}

function systemInstruction() {
  return String(process.env.TELEGRAM_AI_SYSTEM_INSTRUCTION ||
    "You are MR.Zettascale, a calm, thoughtful, and practical conversational assistant. Speak naturally and answer general questions freely. When asked about T.i.M.E.S. without verified project context, say you do not have enough project details rather than inventing behavior.");
}

function splitReply(text) {
  const chunks = [];
  let remaining = String(text || "").trim();
  while (remaining.length > MESSAGE_CHUNK_LIMIT) {
    const boundary = Math.max(remaining.lastIndexOf("\n", MESSAGE_CHUNK_LIMIT), remaining.lastIndexOf(" ", MESSAGE_CHUNK_LIMIT));
    const end = boundary > MESSAGE_CHUNK_LIMIT * 0.6 ? boundary : MESSAGE_CHUNK_LIMIT;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function send(chatId, text) {
  const response = await fetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_AI_BOT_TOKEN")}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(`Telegram AI bot ส่งข้อความไม่สำเร็จ: ${body.description || response.status}`);
}

async function sendReply(chatId, text) {
  for (const chunk of splitReply(text)) await send(chatId, chunk);
}

async function claimTurn(chatId) {
  const now = Date.now();
  const windowKey = String(Math.floor(now / (15 * 60 * 1000)));
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(now));
  const usage = db.collection("telegram-ai-usage").doc(String(chatId));
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usage);
    const data = snapshot.data() || {};
    const windowCount = data.windowKey === windowKey ? Number(data.windowCount || 0) : 0;
    const dayCount = data.dayKey === dayKey ? Number(data.dayCount || 0) : 0;
    if (windowCount >= 40) return false;
    if (dayCount >= 500) return false;
    transaction.set(usage, { windowKey, windowCount: windowCount + 1, dayKey, dayCount: dayCount + 1, updatedAt: now }, { merge: true });
    return true;
  });
}

async function answer(chatId, text) {
  if (!(await claimTurn(chatId))) return "ใช้ AI ครบโควต้าชั่วคราวแล้ว กรุณาลองใหม่ภายหลังครับ";
  const ref = sessionDoc(chatId);
  const history = normalizedHistory((await ref.get()).data()?.history);
  const payload = await generateContent({
    systemInstruction: { parts: [{ text: systemInstruction() }] },
    contents: [...history.map((item) => ({ role: item.role, parts: [{ text: item.text }] })), { role: "user", parts: [{ text }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 3000 }
  });
  const reply = replyText(payload);
  await ref.set({ history: normalizedHistory([...history, { role: "user", text }, { role: "model", text: reply }]), updatedAt: Date.now() }, { merge: true });
  return reply;
}

module.exports = router;

module.exports.webhook = async function telegramAiWebhook(req, res, next) {
  const secret = process.env.TELEGRAM_AI_WEBHOOK_SECRET;
  if (!secret || req.get("X-Telegram-Bot-Api-Secret-Token") !== secret) return res.sendStatus(401);
  try {
    const message = req.body?.message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || "").trim();
    if (!chatId || !text) return res.sendStatus(200);
    if (/^\/start(?:@\w+)?$/i.test(text)) {
      await send(chatId, isAllowed(chatId)
        ? "สวัสดีครับ ผม MR.Zettascale คุยกับผมได้เลย ใช้ /clear เพื่อล้างบริบทสนทนา"
        : `Telegram chat ID นี้คือ ${chatId}\nตั้งค่า TELEGRAM_AI_ALLOWED_CHAT_IDS=${chatId} เพื่ออนุญาตบอตนี้`);
      return res.sendStatus(200);
    }
    if (!isAllowed(chatId)) return res.sendStatus(200);
    if (/^\/(clear|reset)(?:@\w+)?$/i.test(text)) {
      await sessionDoc(chatId).set({ history: [], updatedAt: Date.now() }, { merge: true });
      await send(chatId, "ล้างบริบทการสนทนาแล้วครับ");
      return res.sendStatus(200);
    }
    if (text.startsWith("/")) return res.sendStatus(200);
    try {
      await sendReply(chatId, await answer(chatId, text));
    } catch (error) {
      console.error("[telegram-ai] reply failed:", error.message);
      await send(chatId, "ตอนนี้ AI ตอบไม่ได้ กรุณาลองใหม่อีกครั้งครับ");
    }
    return res.sendStatus(200);
  } catch (error) { next(error); }
};

module.exports.registerWebhook = async function registerWebhook(baseUrl) {
  const missing = [!process.env.TELEGRAM_AI_BOT_TOKEN && "TELEGRAM_AI_BOT_TOKEN", !process.env.TELEGRAM_AI_WEBHOOK_SECRET && "TELEGRAM_AI_WEBHOOK_SECRET", !baseUrl && "webhook base URL"].filter(Boolean);
  if (missing.length) {
    console.warn(`[telegram-ai] ข้ามการตั้ง webhook: ไม่พบ ${missing.join(", ")}`);
    return;
  }
  const response = await fetch(`${BOT_API}/bot${process.env.TELEGRAM_AI_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${baseUrl.replace(/\/$/, "")}/api/telegram-ai/webhook`, secret_token: process.env.TELEGRAM_AI_WEBHOOK_SECRET })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(`ตั้ง Telegram AI webhook ไม่สำเร็จ: ${body.description || response.status}`);
  console.log("[telegram-ai] ตั้ง webhook สำเร็จ");
};
