const express = require("express");
const { GoogleAuth } = require("google-auth-library");
const { claimGeminiChatUsage, releaseGeminiChatUsage, getGeminiChatStatus } = require("../gemini-chat.js");

const router = express.Router();
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const { schema, buildPrompt, prepareContext, finishResult, validateDraft } = require("../skills/activity-creation");

router.post("/activity-validate", (req, res) => {
  try { res.json({ draft: validateDraft(req.body.draft, req.body.categories || []) }); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

// Activity Mode owns the visible control now.  Keep this under /api/ai so
// it does not depend on Telegram being connected just to plan an activity.
router.get("/activity-assistant-status", async (req, res, next) => {
  try { res.json({ aiChat: await getGeminiChatStatus(req.userId) }); }
  catch (error) { next(error); }
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

/**
 * A guided, web-only Activity Mode conversation.  It returns a proposal but
 * never writes Calendar data; the browser must still open ActivityModal and
 * the person must submit that form to create the activity.
 */
router.post("/activity-conversation", async (req, res, next) => {
  let claim = null;
  try {
    const context = prepareContext(req.body);
    claim = await claimGeminiChatUsage(req.userId);
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
    const result = finishResult(jsonFromGemini(payload), context);
    res.json(result);
  } catch (error) {
    if (claim?.status === "claimed") await releaseGeminiChatUsage(claim).catch(() => {});
    res.status(error.status || 502).json({ error: error.message });
  }
});

module.exports = router;
