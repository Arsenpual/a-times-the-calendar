const DEFAULT_MODEL = "gemini-3.5-flash-lite";

function parseRetrySeconds(response, payload, detail) {
  const headerVal = response?.headers?.get?.("retry-after");
  if (headerVal) {
    const asNum = Number(headerVal);
    if (Number.isFinite(asNum) && asNum > 0) return Math.ceil(asNum);
    const asDate = Date.parse(headerVal);
    if (Number.isFinite(asDate)) {
      const diff = Math.ceil((asDate - Date.now()) / 1000);
      if (diff > 0) return diff;
    }
  }
  const details = Array.isArray(payload?.error?.details) ? payload.error.details : [];
  for (const d of details) {
    if (typeof d?.retryDelay === "string") {
      const m = d.retryDelay.match(/(\d+(?:\.\d+)?)s/i);
      if (m) return Math.ceil(Number(m[1]));
    }
  }
  const msgMatch = String(detail || "").match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (msgMatch) return Math.ceil(Number(msgMatch[1]));
  return null;
}

function detectQuotaWindow(payload, detail) {
  const text = `${detail || ""} ${JSON.stringify(payload?.error?.details || [])}`.toLowerCase();
  if (text.includes("perday") || text.includes("per_day") || text.includes("daily") || text.includes("rpd")) {
    return "day";
  }
  if (text.includes("perminute") || text.includes("per_minute") || text.includes("rpm") || text.includes("tpm")) {
    return "minute";
  }
  return "unknown";
}

// Server-only Developer API transport. Never put the key in URLs or errors.
async function generateContent(body, { fetchImpl = fetch, env = process.env } = {}) {
  const key = String(env.GEMINI_API_KEY || "").trim();
  if (!key) {
    const error = new Error("ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน environment ของ backend");
    error.status = 503;
    throw error;
  }
  const rawModel = env.GEMINI_MODEL || DEFAULT_MODEL;
  const model = rawModel === "gemini-2.5-flash" ? "gemini-3.8-flash" : rawModel;
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
    if (response.status === 429) {
      error.retryAfterSeconds = parseRetrySeconds(response, payload, detail);
      error.quotaWindow = detectQuotaWindow(payload, detail);
    }
    throw error;
  }
  if (!payload) throw new Error("Gemini Developer API ส่งคำตอบที่อ่านไม่ได้");
  return payload;
}

module.exports = { generateContent };
