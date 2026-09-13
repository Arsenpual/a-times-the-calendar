const { GoogleAuth } = require("google-auth-library");

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const MAX_INPUT_LENGTH = 2_000;

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

module.exports = { askMrZettascale };
