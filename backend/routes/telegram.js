const crypto = require("crypto");
const express = require("express");
const { telegramAuthDoc, telegramLinkDoc, announcementDoc } = require("../firestore-db.js");

const router = express.Router();
const BOT_API = "https://api.telegram.org";
const LINK_TTL_MS = 10 * 60 * 1000;
const MAX_ANNOUNCEMENT_LENGTH = 500;

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
    await sendTelegram(data.chatId, "✅ MR.Zettascale เชื่อมต่อกับ T.i.M.E.S. สำเร็จแล้ว");
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post("/notify", async (req, res, next) => {
  try {
    const data = (await telegramAuthDoc(req.userId).get()).data();
    if (!data?.chatId) return res.json({ sent: false });
    const title = String(req.body?.title || "Reminder").slice(0, 500);
    const notificationKind = req.body?.notificationKind === "activity" ? "activity" : "reminder";
    const notificationLabel = notificationKind === "activity" ? "กิจกรรม" : "reminder";
    await sendTelegram(data.chatId, `🔔 ถึงเวลาของ${notificationLabel}: ${title}`);
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
    const chatId = message?.chat?.id;
    const text = String(message?.text || "").trim();
    if (!chatId) return res.sendStatus(200);

    if (/^\/(?:myid|chatid)(?:@\w+)?$/i.test(text)) {
      await sendTelegram(chatId, `รหัส Telegram chat ของคุณ: ${chatId}\nตั้งค่า TELEGRAM_ANNOUNCEMENT_ADMIN_CHAT_IDS=${chatId} ใน Render เพื่อใช้คำสั่งประกาศ`);
      return res.sendStatus(200);
    }

    const announcementMatch = text.match(/^\/announce(?:@\w+)?(?:\s+([\s\S]*))?$/i);
    if (announcementMatch) {
      if (!isAnnouncementAdmin(chatId)) {
        await sendTelegram(chatId, "⛔ คุณไม่มีสิทธิ์เปลี่ยนประกาศ");
        return res.sendStatus(200);
      }

      const nextMessage = (announcementMatch[1] || "").trim();
      if (!nextMessage) {
        await sendTelegram(chatId, "ใช้ /announce ข้อความประกาศ\nหรือ /announce off เพื่อซ่อนประกาศ");
        return res.sendStatus(200);
      }
      if (/^(off|clear)$/i.test(nextMessage)) {
        await announcementDoc().set({ message: null, updatedAt: new Date().toISOString(), updatedByTelegramChatId: String(chatId) }, { merge: true });
        await sendTelegram(chatId, "✅ ซ่อน announcement-ticker แล้ว");
        return res.sendStatus(200);
      }
      if (nextMessage.length > MAX_ANNOUNCEMENT_LENGTH) {
        await sendTelegram(chatId, `ข้อความยาวเกินไป — จำกัด ${MAX_ANNOUNCEMENT_LENGTH} ตัวอักษร`);
        return res.sendStatus(200);
      }

      await announcementDoc().set({ message: nextMessage, updatedAt: new Date().toISOString(), updatedByTelegramChatId: String(chatId) }, { merge: true });
      await sendTelegram(chatId, `✅ อัปเดต announcement-ticker แล้ว\n\n${nextMessage}`);
      return res.sendStatus(200);
    }

    const match = text.match(/^\/start\s+([A-Za-z0-9_-]{1,64})$/);
    if (!match) return res.sendStatus(200);
    const ref = telegramLinkDoc(match[1]);
    const link = (await ref.get()).data();
    if (!link || link.expiresAt < Date.now()) return res.sendStatus(200);
    await telegramAuthDoc(link.userId).set({ chatId: String(chatId), connectedAt: new Date().toISOString() }, { merge: true });
    await ref.delete();
    await sendTelegram(chatId, "✅ เชื่อม MR.Zettascale กับ T.i.M.E.S. สำเร็จแล้ว");
    res.sendStatus(200);
  } catch (error) {
    console.error("[telegram] webhook ล้มเหลว:", error.message);
    res.sendStatus(500);
  }
};
