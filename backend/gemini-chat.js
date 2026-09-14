const { db, telegramAuthDoc } = require("./firestore-db.js");

const WINDOW_MS = 15 * 60 * 1000;
const USER_WINDOW_LIMIT = Number(process.env.GEMINI_CHAT_WINDOW_LIMIT || 20);
const USER_DAILY_LIMIT = Number(process.env.GEMINI_CHAT_DAILY_LIMIT || 100);
const GLOBAL_DAILY_LIMIT = Number(process.env.GEMINI_CHAT_GLOBAL_DAILY_LIMIT || 1000);

function bangkokDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function isAllowedUser(userId) {
  const allowed = String(process.env.GEMINI_CHAT_ALLOWED_UIDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  // Fail closed during the pilot. An omitted allowlist must never turn a
  // public chat widget into unrestricted paid Gemini access.
  return allowed.includes(userId);
}

function enabledGlobally() {
  return String(process.env.GEMINI_CHAT_ENABLED || "true").toLowerCase() !== "false";
}

async function getGeminiChatStatus(userId) {
  const authRef = telegramAuthDoc(userId);
  const now = Date.now();
  const dayKey = bangkokDayKey();
  const windowKey = String(Math.floor(now / WINDOW_MS));
  const [auth, day, window, global] = await Promise.all([
    authRef.get(), authRef.collection("gemini-usage-days").doc(dayKey).get(),
    authRef.collection("gemini-usage-windows").doc(windowKey).get(),
    db.collection("app-usage").doc(`gemini-chat-${dayKey}`).get()
  ]);
  const enabled = enabledGlobally() && isAllowedUser(userId) && auth.data()?.aiChatEnabled !== false;
  return {
    enabled, allowed: isAllowedUser(userId), globallyEnabled: enabledGlobally(),
    userWindow: { used: Number(window.data()?.count || 0), limit: USER_WINDOW_LIMIT },
    userDay: { used: Number(day.data()?.count || 0), limit: USER_DAILY_LIMIT },
    globalDay: { used: Number(global.data()?.count || 0), limit: GLOBAL_DAILY_LIMIT }
  };
}

async function setGeminiChatEnabled(userId, enabled) {
  await telegramAuthDoc(userId).set({ aiChatEnabled: Boolean(enabled), aiChatUpdatedAt: Date.now() }, { merge: true });
  return getGeminiChatStatus(userId);
}

async function claimGeminiChatUsage(userId) {
  const now = Date.now();
  const dayKey = bangkokDayKey();
  const windowKey = String(Math.floor(now / WINDOW_MS));
  const authRef = telegramAuthDoc(userId);
  const dayRef = authRef.collection("gemini-usage-days").doc(dayKey);
  const windowRef = authRef.collection("gemini-usage-windows").doc(windowKey);
  const globalRef = db.collection("app-usage").doc(`gemini-chat-${dayKey}`);
  return db.runTransaction(async (transaction) => {
    const [auth, day, window, global] = await Promise.all([transaction.get(authRef), transaction.get(dayRef), transaction.get(windowRef), transaction.get(globalRef)]);
    if (!enabledGlobally()) return { status: "globally-disabled" };
    if (!isAllowedUser(userId)) return { status: "not-allowed" };
    if (auth.data()?.aiChatEnabled === false) return { status: "user-disabled" };
    const dayCount = Number(day.data()?.count || 0);
    const windowCount = Number(window.data()?.count || 0);
    const globalCount = Number(global.data()?.count || 0);
    if (windowCount >= USER_WINDOW_LIMIT) return { status: "window-limited" };
    if (dayCount >= USER_DAILY_LIMIT) return { status: "day-limited" };
    if (globalCount >= GLOBAL_DAILY_LIMIT) return { status: "global-limited" };
    transaction.set(windowRef, { count: windowCount + 1, windowKey, updatedAt: now, expiresAt: now + WINDOW_MS * 2 }, { merge: true });
    transaction.set(dayRef, { count: dayCount + 1, dayKey, updatedAt: now }, { merge: true });
    transaction.set(globalRef, { count: globalCount + 1, dayKey, updatedAt: now }, { merge: true });
    return { status: "claimed", refs: { windowRef, dayRef, globalRef }, dayKey };
  });
}

async function releaseGeminiChatUsage(claim) {
  if (claim?.status !== "claimed") return;
  await db.runTransaction(async (transaction) => {
    const [window, day, global] = await Promise.all([transaction.get(claim.refs.windowRef), transaction.get(claim.refs.dayRef), transaction.get(claim.refs.globalRef)]);
    transaction.set(claim.refs.windowRef, { count: Math.max(0, Number(window.data()?.count || 0) - 1), updatedAt: Date.now() }, { merge: true });
    transaction.set(claim.refs.dayRef, { count: Math.max(0, Number(day.data()?.count || 0) - 1), updatedAt: Date.now() }, { merge: true });
    transaction.set(claim.refs.globalRef, { count: Math.max(0, Number(global.data()?.count || 0) - 1), updatedAt: Date.now() }, { merge: true });
  });
}

module.exports = { getGeminiChatStatus, setGeminiChatEnabled, claimGeminiChatUsage, releaseGeminiChatUsage };
