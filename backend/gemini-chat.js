const { db, telegramAuthDoc } = require("./firestore-db.js");

const WINDOW_MS = 15 * 60 * 1000;
const USER_WINDOW_LIMIT = Number(process.env.GEMINI_CHAT_WINDOW_LIMIT || 20);
const USER_DAILY_LIMIT = Number(process.env.GEMINI_CHAT_DAILY_LIMIT || 100);
const GLOBAL_DAILY_LIMIT = Number(process.env.GEMINI_CHAT_GLOBAL_DAILY_LIMIT || 1000);
const DEVELOPER_WINDOW_LIMIT = Number(process.env.GEMINI_CHAT_DEVELOPER_WINDOW_LIMIT || 120);
const DEVELOPER_DAILY_LIMIT = Number(process.env.GEMINI_CHAT_DEVELOPER_DAILY_LIMIT || 1000);
// AI-assisted final drafts are paid by the application, never by a person's
// daily chat allowance. Keep a separate hard cap to protect the owner.
const DRAFT_GLOBAL_DAILY_LIMIT = Number(process.env.GEMINI_DRAFT_GLOBAL_DAILY_LIMIT || 300);

function bangkokDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function nextBangkokMidnight(now = new Date()) {
  const day = bangkokDayKey(now);
  return new Date(`${day}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000;
}

function waitDetails(status, now = Date.now()) {
  const windowResetAt = (Math.floor(now / WINDOW_MS) + 1) * WINDOW_MS;
  const resetAt = status === "window-limited" ? windowResetAt : nextBangkokMidnight(new Date(now));
  return { status, resetAt, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
}

function isAllowedUser(userId) {
  const allowed = String(process.env.GEMINI_CHAT_ALLOWED_UIDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  // Fail closed during the pilot. An omitted allowlist must never turn a
  // public chat widget into unrestricted paid Gemini access.
  return allowed.includes(userId);
}
function isDeveloperUser(userId) {
  const developers = String(process.env.GEMINI_CHAT_DEVELOPER_UIDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  return developers.includes(userId);
}
function userLimits(userId) {
  return isDeveloperUser(userId)
    ? { window: DEVELOPER_WINDOW_LIMIT, day: DEVELOPER_DAILY_LIMIT }
    : { window: USER_WINDOW_LIMIT, day: USER_DAILY_LIMIT };
}

function enabledGlobally() {
  return String(process.env.GEMINI_CHAT_ENABLED || "true").toLowerCase() !== "false";
}

async function getGeminiChatStatus(userId) {
  const authRef = telegramAuthDoc(userId);
  const now = Date.now();
  const dayKey = bangkokDayKey();
  const windowKey = String(Math.floor(now / WINDOW_MS));
  const limits = userLimits(userId);
  const [day, window, global] = await Promise.all([
    authRef.collection("gemini-usage-days").doc(dayKey).get(),
    authRef.collection("gemini-usage-windows").doc(windowKey).get(),
    db.collection("app-usage").doc(`gemini-chat-${dayKey}`).get()
  ]);
  const enabled = enabledGlobally() && isAllowedUser(userId);
  return {
    enabled, allowed: isAllowedUser(userId), isDeveloper: isDeveloperUser(userId), globallyEnabled: enabledGlobally(),
    userWindow: { used: Number(window.data()?.count || 0), limit: limits.window, resetAt: (Math.floor(now / WINDOW_MS) + 1) * WINDOW_MS },
    userDay: { used: Number(day.data()?.count || 0), limit: limits.day, resetAt: nextBangkokMidnight(new Date(now)) },
    globalDay: { used: Number(global.data()?.count || 0), limit: GLOBAL_DAILY_LIMIT }
  };
}

async function claimGeminiChatUsage(userId) {
  const now = Date.now();
  const dayKey = bangkokDayKey();
  const windowKey = String(Math.floor(now / WINDOW_MS));
  const limits = userLimits(userId);
  const authRef = telegramAuthDoc(userId);
  const dayRef = authRef.collection("gemini-usage-days").doc(dayKey);
  const windowRef = authRef.collection("gemini-usage-windows").doc(windowKey);
  const globalRef = db.collection("app-usage").doc(`gemini-chat-${dayKey}`);
  return db.runTransaction(async (transaction) => {
    const [day, window, global] = await Promise.all([transaction.get(dayRef), transaction.get(windowRef), transaction.get(globalRef)]);
    if (!enabledGlobally()) return { status: "globally-disabled" };
    if (!isAllowedUser(userId)) return { status: "not-allowed" };
    const dayCount = Number(day.data()?.count || 0);
    const windowCount = Number(window.data()?.count || 0);
    const globalCount = Number(global.data()?.count || 0);
    if (windowCount >= limits.window) return waitDetails("window-limited", now);
    if (dayCount >= limits.day) return waitDetails("day-limited", now);
    if (globalCount >= GLOBAL_DAILY_LIMIT) return waitDetails("global-limited", now);
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

async function claimGeminiDraftUsage(userId) {
  const now = Date.now();
  const dayKey = bangkokDayKey();
  const globalRef = db.collection("app-usage").doc(`gemini-draft-${dayKey}`);
  return db.runTransaction(async (transaction) => {
    const global = await transaction.get(globalRef);
    if (!enabledGlobally()) return { status: "globally-disabled" };
    if (!isAllowedUser(userId)) return { status: "not-allowed" };
    const count = Number(global.data()?.count || 0);
    if (count >= DRAFT_GLOBAL_DAILY_LIMIT) return { status: "global-limited" };
    transaction.set(globalRef, { count: count + 1, dayKey, updatedAt: now }, { merge: true });
    return { status: "claimed", refs: { globalRef } };
  });
}

async function releaseGeminiDraftUsage(claim) {
  if (claim?.status !== "claimed") return;
  await db.runTransaction(async (transaction) => {
    const global = await transaction.get(claim.refs.globalRef);
    transaction.set(claim.refs.globalRef, { count: Math.max(0, Number(global.data()?.count || 0) - 1), updatedAt: Date.now() }, { merge: true });
  });
}

module.exports = { getGeminiChatStatus, claimGeminiChatUsage, releaseGeminiChatUsage, claimGeminiDraftUsage, releaseGeminiDraftUsage, isDeveloperUser, userLimits };
