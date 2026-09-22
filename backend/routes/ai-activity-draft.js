const express = require("express");
const { GoogleAuth } = require("google-auth-library");
const { readCalendarQuestionContext, isCalendarQuestion } = require("../calendar-question.js");

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const { schema, buildPrompt, prepareContext, finishResult, validateDraft, assessDraftSchedule } = require("../skills/activity-creation");
const { answerTimesQuestion } = require("../skills/activity-creation/times-knowledge.js");

function createActivityAssistantRouter({
  claimChatUsage = (...args) => require("../gemini-chat.js").claimGeminiChatUsage(...args),
  releaseChatUsage = (...args) => require("../gemini-chat.js").releaseGeminiChatUsage(...args),
  claimDraftUsage = (...args) => require("../gemini-chat.js").claimGeminiDraftUsage(...args),
  releaseDraftUsage = (...args) => require("../gemini-chat.js").releaseGeminiDraftUsage(...args),
  getChatStatus = (...args) => require("../gemini-chat.js").getGeminiChatStatus(...args),
  readCalendarQuestion = readCalendarQuestionContext,
  generateActivity,
  generateCalendarAnswer,
  answerKnowledge = answerTimesQuestion
} = {}) {
const router = express.Router();
// Default assignment happens inside the factory body because default parameter
// expressions cannot reference a function declared later in that same body.
generateActivity ||= generateActivityWithGemini;
generateCalendarAnswer ||= generateCalendarAnswerWithGemini;

router.post("/activity-validate", (req, res) => {
  try { res.json({ draft: validateDraft(req.body.draft, req.body.categories || []) }); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

// Activity Mode owns the visible control now.  Keep this under /api/ai so
// it does not depend on Telegram being connected just to plan an activity.
router.get("/activity-assistant-status", async (req, res, next) => {
  try { res.json({ aiChat: await getChatStatus(req.userId) }); }
  catch (error) { next(error); }
});

function templateFallback(context, { title, date, time, durationMinutes, categoryName = "" }) {
  return finishResult({
    ready: true,
    reply: "ร่างกิจกรรมจากตัวเลือกพร้อมตรวจสอบแล้วครับ",
    draft: { title, date, startTime: time, startLocal: "", endLocal: "", durationMinutes, allDay: false, categoryName, tags: [], notes: "", assumptions: ["สร้างจากข้อความสำเร็จรูป"] }
  }, context);
}

function calendarDateAfter(date, days) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function explicitDateFromText(text, referenceDate) {
  const isoDate = String(text).match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (isoDate) return isoDate;
  if (/พรุ่งนี้|\btomorrow\b/i.test(text)) return calendarDateAfter(referenceDate, 1);
  if (/วันนี้|\btoday\b/i.test(text)) return referenceDate;
  return "";
}

function durationMinutesFromText(text) {
  const hours = String(text).match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b|(\d+(?:\.\d+)?)\s*(?:ชั่วโมง|ชม\.?)/i);
  if (hours) return Math.round(Number(hours[1] || hours[2]) * 60);
  const minutes = String(text).match(/\b(\d+)\s*(?:minutes?|mins?)\b|(\d+)\s*นาที/i);
  return minutes ? Number(minutes[1] || minutes[2]) : 0;
}

function explicitTimeFromText(text) {
  const match = String(text).match(/\b([01]?\d|2[0-3])[.:]([0-5]\d)\b/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

function completeActivityRequest(context) {
  const { text, referenceDate } = context;
  const date = explicitDateFromText(text, referenceDate);
  const startTime = explicitTimeFromText(text);
  const durationMinutes = durationMinutesFromText(text);
  // This strict branch intentionally accepts only a complete, explicit
  // request. Anything ambiguous still goes to Gemini for a conversation.
  if (!date || !startTime || durationMinutes < 1 || durationMinutes > 720) return null;
  const title = String(text)
    .replace(/\b([01]?\d|2[0-3])[.:]([0-5]\d)\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:hours?|hrs?)\b|\d+(?:\.\d+)?\s*(?:ชั่วโมง|ชม\.?)/gi, " ")
    .replace(/\b\d+\s*(?:minutes?|mins?)\b|\d+\s*นาที/gi, " ")
    .replace(/พรุ่งนี้|วันนี้|\btomorrow\b|\btoday\b|\b\d{4}-\d{2}-\d{2}\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  if (!title || title.length > 200) return null;
  return finishResult({
    ready: true,
    reply: `ร่างกิจกรรม “${title}” สำเร็จแล้วครับ ตรวจสอบรายละเอียดได้ใน Activity Popup`,
    draft: { title, date, startTime, startLocal: "", endLocal: "", durationMinutes, allDay: false, categoryName: "", tags: [], notes: "", assumptions: ["สร้างจากข้อมูลวัน เวลา และระยะเวลาที่ระบุครบถ้วน"] }
  }, context);
}

// The guided flow collects mandatory facts without Gemini. At summary time it
// may use the application's separate AI budget to enrich category and tags.
router.post("/activity-template-draft", async (req, res) => {
  let claim = null;
  try {
    const { title, date, time, durationMinutes, categoryName = "", categories = [] } = req.body || {};
    if (typeof title !== "string" || !title.trim()) throw new Error("ต้องระบุชื่อกิจกรรม");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("วันที่ไม่ถูกต้อง");
    if (!/^\d{2}:\d{2}$/.test(time || "")) throw new Error("เวลาไม่ถูกต้อง");
    if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 720) throw new Error("ระยะเวลาต้องอยู่ระหว่าง 30 ถึง 720 นาที");
    const context = prepareContext({ text: `${title} ${date} ${time} ${durationMinutes} นาที`, referenceDate: date, timeZone: req.body.timeZone || "Asia/Bangkok", categories, scheduleContext: req.body.scheduleContext, assistantPreferences: req.body.assistantPreferences });
    claim = await claimDraftUsage(req.userId);
    if (claim.status === "claimed") {
      try {
        const result = finishResult(await generateActivity(context), context);
        if (result.ready) return res.json({ ...result, schedule: assessDraftSchedule(result.draft, context.scheduleContext), summarySource: "system-ai" });
      } catch (error) {
        await releaseDraftUsage(claim).catch(() => {});
        claim = null;
      }
    }
    const result = templateFallback(context, { title, date, time, durationMinutes, categoryName });
    return res.json({ ...result, schedule: assessDraftSchedule(result.draft, context.scheduleContext), summarySource: "deterministic" });
  } catch (error) {
    if (claim?.status === "claimed") await releaseDraftUsage(claim).catch(() => {});
    res.status(400).json({ error: error.message });
  }
});

function jsonFromGemini(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini ไม่ได้ส่งร่างกิจกรรมกลับมา");
  return JSON.parse(text);
}

function textFromGemini(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini ไม่ได้ส่งคำตอบกลับมา");
  return text;
}

function createVertexAuth() {
  const options = { scopes: ["https://www.googleapis.com/auth/cloud-platform"] };
  // Render stores the service-account file as JSON in an environment variable;
  // GoogleAuth normally only discovers a file path, so pass those credentials
  // explicitly when the deployment uses the JSON variant.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    options.credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
  return new GoogleAuth(options);
}

async function generateActivityWithGemini(context) {
  const instruction = buildPrompt(context);
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  if (!project) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_CLOUD_PROJECT หรือ FIREBASE_PROJECT_ID บน backend");
  const authClient = await createVertexAuth().getClient();
  const token = await authClient.getAccessToken();
  if (!token?.token) throw new Error("ขอ access token สำหรับ Vertex AI ไม่สำเร็จ");
  const response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({ systemInstruction: { parts: [{ text: instruction }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(context) }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.25 } })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `Vertex AI ตอบ ${response.status}`);
  return jsonFromGemini(payload);
}

async function generateCalendarAnswerWithGemini({ text, calendarContext, timeZone }) {
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  if (!project) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_CLOUD_PROJECT หรือ FIREBASE_PROJECT_ID บน backend");
  // A very full calendar can contain thousands of rows. The question already
  // has an explicit bounded date range; cap the model context as a second
  // guard so one request cannot consume an unbounded amount of AI quota.
  const events = calendarContext.events.slice(0, 400);
  const compactContext = { ...calendarContext, events, truncatedForAi: calendarContext.events.length > events.length };
  const instruction = [
    "คุณคือ MR.Zettascale ผู้ช่วยอ่าน Google Calendar ของเจ้าของบัญชี T.i.M.E.S.",
    "ตอบจากข้อมูล JSON ที่ได้รับเท่านั้น ห้ามแต่งข้อมูล ห้ามกล่าวว่าคุณเห็นข้อมูลอื่นนอกช่วงวันที่นี้.",
    "ข้อมูลเป็นชื่อกิจกรรม เวลา และชื่อปฏิทินเท่านั้น ห้ามขอหรืออ้างถึงคำอธิบาย ผู้เข้าร่วม ลิงก์ หรือข้อมูลส่วนตัวที่ไม่มีอยู่.",
    "คุณมีสิทธิ์อ่านอย่างเดียว ห้ามสร้าง แก้ไข ลบ หรือยืนยันการเปลี่ยน Calendar.",
    "ตอบภาษาเดียวกับคำถาม กระชับ ใช้เวลาใน timezone ที่ระบุ. ถ้าถามเวลาว่าง ให้หาเฉพาะช่องว่างภายในช่วงวันที่ที่ส่งมา และแจ้งว่านี่เป็นการประเมินจากกิจกรรมที่อ่านได้."
  ].join(" ");
  const authClient = await createVertexAuth().getClient();
  const token = await authClient.getAccessToken();
  if (!token?.token) throw new Error("ขอ access token สำหรับ Vertex AI ไม่สำเร็จ");
  const response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instruction }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify({ question: text, timeZone, calendar: compactContext }) }] }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 700 }
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `Vertex AI ตอบ ${response.status}`);
  return textFromGemini(payload);
}

/**
 * A guided, web-only Activity Mode conversation.  It returns a proposal but
 * never writes Calendar data; the browser must still open ActivityModal and
 * the person must submit that form to create the activity.
 */
router.post("/activity-conversation", async (req, res, next) => {
  let claim = null;
  try {
    const context = prepareContext(req.body);
    // Product FAQ answers are deterministic local lookups. They do not call
    // Gemini, so they never consume the person's AI quota.
    const knowledgeReply = answerKnowledge(context.text);
    if (knowledgeReply) return res.json({ reply: knowledgeReply, ready: false, draft: null, source: "knowledge" });
    const deterministicDraft = completeActivityRequest(context);
    if (deterministicDraft) {
      return res.json({ ...deterministicDraft, schedule: assessDraftSchedule(deterministicDraft.draft, context.scheduleContext), source: "deterministic" });
    }
    // Calendar questions are an explicit, read-only branch. Claim the normal
    // chat quota first, then fetch only the event fields and date range needed
    // for this one question; neither OAuth tokens nor full Calendar objects
    // are ever sent to the browser or Gemini.
    if (isCalendarQuestion(context.text)) {
      claim = await claimChatUsage(req.userId);
      if (claim.status !== "claimed") {
        const errors = {
          "globally-disabled": "AI ถูกปิดชั่วคราวโดยระบบ",
          "not-allowed": "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้ AI",
          "window-limited": "ใช้ AI ครบโควต้าช่วง 15 นาทีแล้ว",
          "day-limited": "ใช้ AI ครบโควต้าประจำวันแล้ว",
          "global-limited": "โควต้า AI ของระบบวันนี้เต็มแล้ว"
        };
        return res.status(429).json({
          error: errors[claim.status] || "AI ใช้งานไม่ได้ในขณะนี้",
          ...(claim.retryAfterSeconds ? { retryAfterSeconds: claim.retryAfterSeconds, retryAfterAt: new Date(claim.resetAt).toISOString() } : {})
        });
      }
      const calendarContext = await readCalendarQuestion(req.userId, context);
      const reply = await generateCalendarAnswer({ text: context.text, calendarContext, timeZone: context.timeZone });
      return res.json({ reply, ready: false, draft: null, source: "calendar", calendarRange: calendarContext.range });
    }
    claim = await claimChatUsage(req.userId);
    if (claim.status !== "claimed") {
      const errors = {
        "globally-disabled": "AI ถูกปิดชั่วคราวโดยระบบ",
        "not-allowed": "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้ AI",
        "window-limited": "ใช้ AI ครบโควต้าช่วง 15 นาทีแล้ว",
        "day-limited": "ใช้ AI ครบโควต้าประจำวันแล้ว",
        "global-limited": "โควต้า AI ของระบบวันนี้เต็มแล้ว"
      };
      return res.status(429).json({
        error: errors[claim.status] || "AI ใช้งานไม่ได้ในขณะนี้",
        ...(claim.retryAfterSeconds ? { retryAfterSeconds: claim.retryAfterSeconds, retryAfterAt: new Date(claim.resetAt).toISOString() } : {})
      });
    }

    const result = finishResult(await generateActivity(context), context);
    res.json(result.ready ? { ...result, schedule: assessDraftSchedule(result.draft, context.scheduleContext) } : result);
  } catch (error) {
    if (claim?.status === "claimed") await releaseChatUsage(claim).catch(() => {});
    if (error?.code === "CALENDAR_REAUTH_REQUIRED") {
      return res.status(428).json({ code: error.code, error: error.message });
    }
    res.status(error.status || 502).json({ error: error.message });
  }
});

return router;
}

const router = createActivityAssistantRouter();
module.exports = router;
module.exports.createActivityAssistantRouter = createActivityAssistantRouter;
