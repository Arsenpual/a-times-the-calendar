const express = require("express");
const { GoogleAuth } = require("google-auth-library");
const { claimGeminiChatUsage, releaseGeminiChatUsage, getGeminiChatStatus, setGeminiChatEnabled } = require("../gemini-chat.js");

const router = express.Router();
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const MAX_PROMPT_LENGTH = 1200;

// Activity Mode owns the visible control now.  Keep this under /api/ai so
// it does not depend on Telegram being connected just to plan an activity.
router.get("/activity-assistant-status", async (req, res, next) => {
  try { res.json({ aiChat: await getGeminiChatStatus(req.userId) }); }
  catch (error) { next(error); }
});

router.post("/activity-assistant-status", async (req, res, next) => {
  try {
    if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ error: "ต้องระบุสถานะ enabled ของ AI" });
    res.json({ aiChat: await setGeminiChatEnabled(req.userId, req.body.enabled) });
  } catch (error) { next(error); }
});

function jsonFromGemini(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini ไม่ได้ส่งร่างกิจกรรมกลับมา");
  return JSON.parse(text);
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

router.post("/activity-draft", async (req, res, next) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const referenceDate = typeof req.body?.referenceDate === "string" ? req.body.referenceDate : "";
    const timeZone = typeof req.body?.timeZone === "string" ? req.body.timeZone : "Asia/Bangkok";
    const categories = Array.isArray(req.body?.categories)
      ? req.body.categories.filter((name) => typeof name === "string").slice(0, 50)
      : [];
    if (!text || text.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: "ข้อความสำหรับสร้างกิจกรรมต้องมีความยาว 1–1200 ตัวอักษร" });
    }

    const schema = {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        startLocal: { type: "STRING", description: "YYYY-MM-DDTHH:mm in the supplied timezone" },
        endLocal: { type: "STRING", description: "YYYY-MM-DDTHH:mm in the supplied timezone" },
        allDay: { type: "BOOLEAN", description: "true only when the user explicitly asks for an all-day activity" },
        categoryName: { type: "STRING", description: "One exact category name from the supplied list, or empty string" },
        notes: { type: "STRING" }
      },
      required: ["title", "startLocal", "endLocal", "allDay", "categoryName", "notes"]
    };
    const instruction = [
      "Convert the user's Thai/English request into exactly one calendar activity.",
      `Reference local date: ${referenceDate || "today"}. Timezone: ${timeZone}.`,
      "Infer a reasonable one-hour duration only if an end time or duration is absent.",
      "Set allDay=true only when the user explicitly requests an all-day activity; otherwise set it to false.",
      "For allDay=true, still provide local times 00:00 through 00:00 of the following day.",
      "Use only local datetime strings in YYYY-MM-DDTHH:mm; never use UTC/Z.",
      "If a date or time is genuinely missing, use the reference date and 09:00.",
      `Available category names: ${categories.join(", ") || "none"}.`,
      `User request: ${text}`
    ].join("\n");

    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    if (!project) {
      return res.status(503).json({ error: "ยังไม่ได้ตั้งค่า GOOGLE_CLOUD_PROJECT หรือ FIREBASE_PROJECT_ID บน backend" });
    }
    const authClient = await createVertexAuth().getClient();
    const token = await authClient.getAccessToken();
    if (!token?.token) throw new Error("ขอ access token สำหรับ Vertex AI ไม่สำเร็จ");
    const response = await fetch(
      `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: instruction }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.2
          }
        })
      }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || `Vertex AI ตอบ ${response.status}`;
      return res.status(502).json({ error: `สร้างร่างกิจกรรมไม่สำเร็จ: ${message}` });
    }
    const draft = jsonFromGemini(payload);
    if (!draft?.title || !draft?.startLocal || !draft?.endLocal || typeof draft.allDay !== "boolean") {
      return res.status(502).json({ error: "Gemini ส่งร่างกิจกรรมไม่ครบ" });
    }
    res.json(draft);
  } catch (error) {
    next(error);
  }
});

/**
 * A guided, web-only Activity Mode conversation.  It returns a proposal but
 * never writes Calendar data; the browser must still open ActivityModal and
 * the person must submit that form to create the activity.
 */
router.post("/activity-conversation", async (req, res, next) => {
  let claim = null;
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const referenceDate = typeof req.body?.referenceDate === "string" ? req.body.referenceDate : "";
    const timeZone = typeof req.body?.timeZone === "string" ? req.body.timeZone : "Asia/Bangkok";
    const categories = Array.isArray(req.body?.categories) ? req.body.categories.filter((name) => typeof name === "string").slice(0, 50) : [];
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10).map((item) => ({
      role: item?.role === "assistant" ? "MR.Zettascale" : "ผู้ใช้",
      text: String(item?.text || "").slice(0, 1_000)
    })).filter((item) => item.text) : [];
    if (!text || text.length > MAX_PROMPT_LENGTH) return res.status(400).json({ error: "ข้อความต้องมีความยาว 1–1200 ตัวอักษร" });

    claim = await claimGeminiChatUsage(req.userId);
    if (claim.status !== "claimed") {
      const errors = {
        "user-disabled": "AI ถูกปิดไว้เพื่อรักษาโควต้าของคุณ",
        "globally-disabled": "AI ถูกปิดชั่วคราวโดยระบบ",
        "not-allowed": "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้ AI",
        "window-limited": "ใช้ AI ครบโควต้าช่วง 15 นาทีแล้ว",
        "day-limited": "ใช้ AI ครบโควต้าประจำวันแล้ว",
        "global-limited": "โควต้า AI ของระบบวันนี้เต็มแล้ว"
      };
      return res.status(429).json({ error: errors[claim.status] || "AI ใช้งานไม่ได้ในขณะนี้" });
    }

    const schema = {
      type: "OBJECT",
      properties: {
        reply: { type: "STRING", description: "A concise Thai reply or one focused follow-up question" },
        ready: { type: "BOOLEAN", description: "true only once title, date, start time, and end time/duration are known" },
        draft: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" }, startLocal: { type: "STRING" }, endLocal: { type: "STRING" },
            allDay: { type: "BOOLEAN" }, categoryName: { type: "STRING" }, notes: { type: "STRING" }
          },
          required: ["title", "startLocal", "endLocal", "allDay", "categoryName", "notes"]
        }
      },
      required: ["reply", "ready", "draft"]
    };
    const context = history.map((item) => `${item.role}: ${item.text}`).join("\n");
    const instruction = [
      "You are MR.Zettascale, the Activity Mode planning assistant in T.i.M.E.S. Reply in Thai unless the user writes another language.",
      "Your only task is to help the person prepare exactly one calendar activity. You never create it yourself.",
      "Ask at most one useful follow-up question per turn when essential information is missing. Essential: title, calendar date, start time, and duration/end time. Do not invent a time when the user has not supplied one.",
      "When all essential details are known, set ready=true and reply with a short review. Then return the complete draft.",
      "When not ready, set ready=false and put empty strings for unknown draft fields; allDay must be false unless explicitly requested.",
      `Reference local date: ${referenceDate || "today"}. Timezone: ${timeZone}.`,
      "Datetime values must be YYYY-MM-DDTHH:mm in the supplied timezone, never UTC/Z.",
      `Available category names: ${categories.join(", ") || "none"}. Choose one exact supplied name only when confident; otherwise use an empty string.`,
      context ? `Conversation so far:\n${context}` : "",
      `Latest user message: ${text}`
    ].filter(Boolean).join("\n\n");
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    if (!project) return res.status(503).json({ error: "ยังไม่ได้ตั้งค่า GOOGLE_CLOUD_PROJECT หรือ FIREBASE_PROJECT_ID บน backend" });
    const authClient = await createVertexAuth().getClient();
    const token = await authClient.getAccessToken();
    if (!token?.token) throw new Error("ขอ access token สำหรับ Vertex AI ไม่สำเร็จ");
    const response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: instruction }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.25 } })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || `Vertex AI ตอบ ${response.status}`);
    const result = jsonFromGemini(payload);
    if (!result?.reply || typeof result.ready !== "boolean" || !result.draft) throw new Error("Gemini ส่งผลการวางแผนไม่ครบ");
    if (result.ready && (!result.draft.title || !result.draft.startLocal || !result.draft.endLocal)) {
      result.ready = false;
      result.reply = "ผมยังต้องทราบวันและเวลาให้ครบก่อนครับ ต้องการเริ่มและจบเมื่อไร?";
    }
    res.json(result);
  } catch (error) {
    if (claim?.status === "claimed") await releaseGeminiChatUsage(claim).catch(() => {});
    next(error);
  }
});

module.exports = router;
