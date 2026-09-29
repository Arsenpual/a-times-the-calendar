const DEFAULT_MODEL = "gemini-3.5-flash-lite";

// Server-only Developer API transport. Never put the key in URLs or errors.
async function generateContent(body, { fetchImpl = fetch, env = process.env } = {}) {
  const key = String(env.GEMINI_API_KEY || "").trim();
  if (!key) {
    const error = new Error("ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน environment ของ backend");
    error.status = 503;
    throw error;
  }
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = String(payload?.error?.message || `Gemini Developer API ตอบ ${response.status}`).split(key).join("[redacted]");
    const error = new Error(detail);
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  if (!payload) throw new Error("Gemini Developer API ส่งคำตอบที่อ่านไม่ได้");
  return payload;
}

module.exports = { generateContent };
