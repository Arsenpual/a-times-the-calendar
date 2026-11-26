const { GoogleGenAI, ThinkingLevel } = require("@google/genai");

const DEFAULT_MODEL = "gemini-4-hydrogen";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

const LEGACY_MODEL_MAP = {
  "gemini-1.5-flash": DEFAULT_MODEL,
  "gemini-1.5-pro": DEFAULT_MODEL,
  "gemini-pro": DEFAULT_MODEL,
  "gemini-2.0-flash": DEFAULT_MODEL,
  "gemini-2.0-pro": DEFAULT_MODEL,
  "gemini-2.0-flash-thinking": DEFAULT_MODEL,
  "gemini-2.5-flash": DEFAULT_MODEL,
  "gemini-2.5-pro": DEFAULT_MODEL,
  "gemini-3.8-flash": DEFAULT_MODEL,
  "gemini-3.5-flash-lite": FALLBACK_MODEL,
  "gemini-flash": DEFAULT_MODEL,
  "gemini-4-flash": DEFAULT_MODEL,
  "gemini-hydrogen": DEFAULT_MODEL,
  "gemini-lite": FALLBACK_MODEL,
  "flash-lite": FALLBACK_MODEL,
};

const VALID_GEMINI_MODEL_RE = /^gemini-[a-z0-9][a-z0-9._-]{1,60}$/;

function normalizeGeminiModel(rawModel) {
  let candidate = String(rawModel || "").trim();
  if (!candidate) return DEFAULT_MODEL;

  // Strip surrounding quotes/backticks that often appear in Secrets/JSON configs
  while (
    candidate.length >= 2 &&
    ((candidate.startsWith('"') && candidate.endsWith('"')) ||
      (candidate.startsWith("'") && candidate.endsWith("'")) ||
      (candidate.startsWith("`") && candidate.endsWith("`")))
  ) {
    candidate = candidate.slice(1, -1).trim();
  }
  if (!candidate) return DEFAULT_MODEL;

  // If a comma/semicolon/newline-separated list was configured, take the first entry
  if (/[,;\r\n]/.test(candidate)) {
    candidate = candidate
      .split(/[,;\r\n]+/)
      .map((part) => part.trim().replace(/^['"`]+|['"`]+$/g, "").trim())
      .find(Boolean) || "";
  }
  if (!candidate) return DEFAULT_MODEL;

  // Extract model segment from full API URLs or repeated models/ prefixes
  const modelsIdx = candidate.toLowerCase().lastIndexOf("/models/");
  if (modelsIdx >= 0) {
    candidate = candidate.slice(modelsIdx + "/models/".length);
  }
  candidate = candidate.replace(/^(?:models\/)+/i, "");

  // Strip RPC method suffixes (:generateContent) or query/hash fragments
  candidate = candidate.split(/[?:@#]/)[0].trim();
  if (!candidate) return DEFAULT_MODEL;

  // Normalize display aliases like "Gemini 4 Hydrogen" -> "gemini-4-hydrogen"
  const lowered = candidate.toLowerCase().replace(/\s+/g, "-");
  if (LEGACY_MODEL_MAP[lowered]) {
    return LEGACY_MODEL_MAP[lowered];
  }

  // Block deprecated Gemini 1.x / 2.0 / unversioned gemini-pro families
  if (
    lowered.startsWith("gemini-1.") ||
    lowered.startsWith("gemini-2.0") ||
    lowered === "gemini-pro" ||
    lowered.startsWith("gemini-pro-")
  ) {
    return DEFAULT_MODEL;
  }

  // Final strict format guard so GenerateContentRequest.model can never fail format validation
  if (!VALID_GEMINI_MODEL_RE.test(lowered)) {
    return DEFAULT_MODEL;
  }

  return lowered;
}

function isGemini4Model(model) {
  return String(model || "").startsWith("gemini-4-");
}

function resolveApiKey(env = process.env) {
  const key = String(env.GEMINI_API_KEY || "").trim();
  if (!key || key === "MY_GEMINI_API_KEY") {
    const error = new Error("ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน environment ของ backend");
    error.status = 503;
    error.code = "MISSING_API_KEY";
    throw error;
  }
  return key;
}

function createGeminiClient({ env = process.env } = {}) {
  const apiKey = resolveApiKey(env);
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

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

function extractSystemInstructionText(systemInstruction) {
  if (!systemInstruction) return undefined;
  if (typeof systemInstruction === "string") {
    return systemInstruction.trim() || undefined;
  }
  if (Array.isArray(systemInstruction.parts)) {
    const joined = systemInstruction.parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("\n")
      .trim();
    return joined || undefined;
  }
  return undefined;
}

function resolveThinkingLevel(rawLevel) {
  const upper = String(rawLevel || "").trim().toUpperCase();
  if (upper === "LOW") return ThinkingLevel.LOW;
  if (upper === "MEDIUM") return ThinkingLevel.MEDIUM;
  if (upper === "HIGH") return ThinkingLevel.HIGH;
  return undefined;
}

function buildSdkConfigFromBody(body = {}, model = DEFAULT_MODEL) {
  const config = {};
  const sysText = extractSystemInstructionText(body.systemInstruction);
  if (sysText) {
    config.systemInstruction = sysText;
  }
  if (Array.isArray(body.tools) && body.tools.length > 0) {
    config.tools = body.tools;
  }

  const genCfg = body.generationConfig && typeof body.generationConfig === "object" ? body.generationConfig : {};
  if (genCfg.responseMimeType) config.responseMimeType = genCfg.responseMimeType;
  if (genCfg.responseSchema) config.responseSchema = genCfg.responseSchema;
  if (Number.isFinite(genCfg.maxOutputTokens)) config.maxOutputTokens = genCfg.maxOutputTokens;
  if (Number.isFinite(genCfg.seed)) config.seed = genCfg.seed;

  if (!isGemini4Model(model)) {
    if (Number.isFinite(genCfg.temperature)) config.temperature = genCfg.temperature;
    if (Number.isFinite(genCfg.topP)) config.topP = genCfg.topP;
    if (Number.isFinite(genCfg.topK)) config.topK = genCfg.topK;
    if (Number.isFinite(genCfg.candidateCount)) config.candidateCount = genCfg.candidateCount;
  }

  const thinkingLevel = resolveThinkingLevel(genCfg.thinkingConfig?.thinkingLevel || body.thinkingLevel);
  if (thinkingLevel) {
    config.thinkingConfig = { thinkingLevel };
  }

  return Object.keys(config).length > 0 ? config : undefined;
}

function normalizeSdkError(err, apiKey) {
  const rawMessage = err instanceof Error ? err.message : String(err || "Gemini API error");
  const redacted = apiKey ? rawMessage.split(apiKey).join("[redacted]") : rawMessage;
  const lower = redacted.toLowerCase();
  const error = new Error(redacted);

  let status = Number(err?.status || err?.statusCode || err?.error?.code);
  if (!Number.isInteger(status) || status < 400 || status >= 600) {
    if (lower.includes("429") || lower.includes("resource_exhausted") || lower.includes("quota")) {
      status = 429;
    } else if (
      lower.includes("503") ||
      lower.includes("unavailable") ||
      lower.includes("high demand") ||
      lower.includes("overloaded")
    ) {
      status = 503;
    } else if (lower.includes("404") || lower.includes("not_found") || lower.includes("not found")) {
      status = 404;
    } else if (lower.includes("403") || lower.includes("permission_denied")) {
      status = 403;
    } else if (lower.includes("401") || lower.includes("api_key_invalid") || lower.includes("api key not valid")) {
      status = 401;
    } else if (lower.includes("400") || lower.includes("invalid_argument")) {
      status = 400;
    } else {
      status = 502;
    }
  }
  error.status = status;

  if (status === 429) {
    error.retryAfterSeconds = parseRetrySeconds(null, null, redacted);
    error.quotaWindow = detectQuotaWindow(null, redacted);
  }
  return error;
}

// Server-only Gemini API transport. Uses @google/genai SDK by default,
// and keeps fetchImpl support for deterministic unit testing.
async function generateContent(body, { fetchImpl, env = process.env, model: explicitModel } = {}) {
  const key = resolveApiKey(env);
  const model = normalizeGeminiModel(explicitModel || env.GEMINI_MODEL || DEFAULT_MODEL);

  if (typeof fetchImpl === "function") {
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
          "User-Agent": "aistudio-build",
        },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify(body),
      }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = String(payload?.error?.message || `Gemini Developer API ตอบ ${response.status}`)
        .split(key)
        .join("[redacted]");
      const error = new Error(detail);
      error.status =
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404 ||
        response.status === 429
          ? response.status
          : 502;
      if (response.status === 429) {
        error.retryAfterSeconds = parseRetrySeconds(response, payload, detail);
        error.quotaWindow = detectQuotaWindow(payload, detail);
      }
      throw error;
    }
    if (!payload) throw new Error("Gemini Developer API ส่งคำตอบที่อ่านไม่ได้");
    return payload;
  }

  try {
    const ai = createGeminiClient({ env });
    const config = buildSdkConfigFromBody(body, model);
    const timeoutMs = Number.isFinite(body?.timeoutMs) ? body.timeoutMs : 50_000;
    let timerId;
    const response = await Promise.race([
      ai.models.generateContent({
        model,
        contents: body?.contents ?? [],
        ...(config ? { config } : {}),
      }),
      new Promise((_, reject) => {
        timerId = setTimeout(() => {
          const timeoutErr = new Error("การเชื่อมต่อ Gemini API ใช้เวลานานเกินกำหนด กรุณาลองใหม่อีกครั้ง");
          timeoutErr.status = 504;
          reject(timeoutErr);
        }, timeoutMs);
      }),
    ]).finally(() => {
      if (timerId) clearTimeout(timerId);
    });
    return response;
  } catch (err) {
    throw normalizeSdkError(err, key);
  }
}

async function generateContentStream(
  { model: explicitModel, contents, systemInstruction, thinkingLevel, tools } = {},
  { env = process.env } = {}
) {
  const key = resolveApiKey(env);
  const model = normalizeGeminiModel(explicitModel || env.GEMINI_MODEL || DEFAULT_MODEL);
  const config = {};

  const sysText = extractSystemInstructionText(systemInstruction);
  if (sysText) {
    config.systemInstruction = sysText;
  }
  if (Array.isArray(tools) && tools.length > 0) {
    config.tools = tools;
  }
  const resolvedThinking = resolveThinkingLevel(thinkingLevel);
  if (resolvedThinking) {
    config.thinkingConfig = { thinkingLevel: resolvedThinking };
  }

  try {
    const ai = createGeminiClient({ env });
    const stream = await ai.models.generateContentStream({
      model,
      contents: contents ?? [],
      ...(Object.keys(config).length > 0 ? { config } : {}),
    });
    return (async function* () {
      try {
        for await (const chunk of stream) {
          yield chunk;
        }
      } catch (streamErr) {
        throw normalizeSdkError(streamErr, key);
      }
    })();
  } catch (err) {
    throw normalizeSdkError(err, key);
  }
}

module.exports = {
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  normalizeGeminiModel,
  createGeminiClient,
  generateContent,
  generateContentStream,
};
