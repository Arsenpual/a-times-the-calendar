const { GoogleAuth } = require("google-auth-library");
const { db, telegramAuthDoc } = require("./firestore-db.js");

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const MAX_INPUT_LENGTH = 2_000;
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

function createVertexAuth() {
  const options = { scopes: ["https://www.googleapis.com/auth/cloud-platform"] };
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    options.credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
  return new GoogleAuth(options);
}

function textFromGemini(payload) {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
}

/** Answers one chat turn without granting Gemini permission to mutate data. */
async function askMrZettascale(message, history = []) {
  const prompt = String(message || "").trim();
  if (!prompt || prompt.length > MAX_INPUT_LENGTH) throw new Error("ข้อความถึงผู้ช่วยต้องมีความยาว 1–2,000 ตัวอักษร");
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  if (!project) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_CLOUD_PROJECT หรือ FIREBASE_PROJECT_ID บน backend");
  const context = history.slice(-8).map((item) => (
    `${item.direction === "incoming" ? "ผู้ใช้" : "MR.Zettascale"}: ${String(item.text || "").slice(0, 1_000)}`
  )).join("\n");
  const authClient = await createVertexAuth().getClient();
  const token = await authClient.getAccessToken();
  if (!token?.token) throw new Error("ขอ access token สำหรับ Vertex AI ไม่สำเร็จ");
  const response = await fetch(
    `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "You are MR.Zettascale, the concise, thoughtful assistant inside the T.i.M.E.S. calendar and reminder app. Reply in Thai unless the user uses another language. Help with planning, reminders, activities, and questions. You cannot directly create, edit, delete, or send calendar/reminder data; explain what the user can do in the app instead. Keep answers practical, friendly, and under 700 Thai characters." }]
        },
        contents: [{ role: "user", parts: [{ text: `${context ? `บริบทแชตก่อนหน้า:\n${context}\n\n` : ""}ข้อความใหม่จากผู้ใช้: ${prompt}` }] }],
        generationConfig: { temperature: 0.45, maxOutputTokens: 500 }
      })
    }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `Vertex AI ตอบ ${response.status}`);
  const answer = textFromGemini(payload);
  if (!answer) throw new Error("Gemini ไม่ได้ส่งคำตอบกลับมา");
  return answer.slice(0, 4_000);
}

module.exports = { askMrZettascale, getGeminiChatStatus, setGeminiChatEnabled, claimGeminiChatUsage, releaseGeminiChatUsage };
