const crypto = require("crypto");
const express = require("express");
const { telegramAuthDoc, telegramLinkDoc } = require("../firestore-db.js");

const router = express.Router();
const BOT_API = "https://api.telegram.org";
const LINK_TTL_MS = 10 * 60 * 1000;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`ไม่พบ ${name} ใน environment ของ backend`);
  return value;
}

async function sendTelegram(chatId, text) {
  const response = await fetch(`${BOT_API}/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`Telegram ส่งข้อความไม่สำเร็จ: ${data.description || response.status}`);
}

router.get("/status", async (req, res, next) => {
  try {
    const data = (await telegramAuthDoc(req.userId).get()).data();
    res.json({ connected: Boolean(data?.chatId), username: process.env.TELEGRAM_BOT_USERNAME || null });
  } catch (error) { next(error); }
});

router.post("/connect", async (req, res, next) => {
  try {
    const username = requiredEnv("TELEGRAM_BOT_USERNAME").replace(/^@/, "");
    const token = crypto.randomBytes(24).toString("base64url");
    await telegramLinkDoc(token).set({ userId: req.userId, expiresAt: Date.now() + LINK_TTL_MS, createdAt: new Date().toISOString() });
    res.json({ connectUrl: `https://t.me/${username}?start=${token}`, expiresAt: Date.now() + LINK_TTL_MS });
  } catch (error) { next(error); }
});

router.post("/test", async (req, res, next) => {
  try {
    const data = (await telegramAuthDoc(req.userId).get()).data();
    if (!data?.chatId) return res.status(409).json({ error: "ยังไม่ได้เชื่อม Telegram" });
    await sendTelegram(data.chatId, "✅ MR.Zettascale เชื่อมต่อกับ T.i.M.E.S. สำเร็จแล้ว");
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post("/notify", async (req, res, next) => {
  try {
    const data = (await telegramAuthDoc(req.userId).get()).data();
    if (!data?.chatId) return res.json({ sent: false });
    const title = String(req.body?.title || "Reminder").slice(0, 500);
    await sendTelegram(data.chatId, `🔔 ถึงเวลาของ reminder: ${title}`);
    res.json({ sent: true });
  } catch (error) { next(error); }
});

module.exports = router;

module.exports.registerWebhook = async function registerWebhook(baseUrl) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET || !baseUrl) return;
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
};

module.exports.webhook = async function telegramWebhook(req, res) {
  if (req.get("X-Telegram-Bot-Api-Secret-Token") !== process.env.TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(401);
  try {
    const message = req.body?.message;
    const match = message?.text?.match(/^\/start\s+([A-Za-z0-9_-]{1,64})$/);
    if (!match || !message?.chat?.id) return res.sendStatus(200);
    const ref = telegramLinkDoc(match[1]);
    const link = (await ref.get()).data();
    if (!link || link.expiresAt < Date.now()) return res.sendStatus(200);
    await telegramAuthDoc(link.userId).set({ chatId: String(message.chat.id), connectedAt: new Date().toISOString() }, { merge: true });
    await ref.delete();
    await sendTelegram(message.chat.id, "✅ เชื่อม MR.Zettascale กับ T.i.M.E.S. สำเร็จแล้ว");
    res.sendStatus(200);
  } catch (error) {
    console.error("[telegram] webhook ล้มเหลว:", error.message);
    res.sendStatus(500);
  }
};
