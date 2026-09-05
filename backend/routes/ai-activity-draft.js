const express = require("express");
const { GoogleAuth } = require("google-auth-library");

const router = express.Router();
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const MAX_PROMPT_LENGTH = 1200;

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
        categoryName: { type: "STRING", description: "One exact category name from the supplied list, or empty string" },
        notes: { type: "STRING" }
      },
      required: ["title", "startLocal", "endLocal", "categoryName", "notes"]
    };
    const instruction = [
      "Convert the user's Thai/English request into exactly one calendar activity.",
      `Reference local date: ${referenceDate || "today"}. Timezone: ${timeZone}.`,
      "Infer a reasonable one-hour duration only if an end time or duration is absent.",
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
    if (!draft?.title || !draft?.startLocal || !draft?.endLocal) {
      return res.status(502).json({ error: "Gemini ส่งร่างกิจกรรมไม่ครบ" });
    }
    res.json(draft);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
