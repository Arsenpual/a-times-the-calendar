function getNextMidnightMs(fromMs = Date.now()) {
  const next = new Date(fromMs);
  next.setHours(24, 0, 0, 0);
  return next.getTime();
}

const DEFAULT_DAILY_TOKEN_LIMIT = 250_000;
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

const userQuotaStates = new Map();
const userCharacterRuntimes = new Map();

function getUserState(userId = "global") {
  const key = userId || "global";
  if (!userQuotaStates.has(key)) {
    userQuotaStates.set(key, {
      tokensLimit: DEFAULT_DAILY_TOKEN_LIMIT,
      tokensUsed: 0,
      resetAt: getNextMidnightMs(),
    });
  }
  if (!userCharacterRuntimes.has(key)) {
    userCharacterRuntimes.set(key, {
      mina: {
        id: "mina",
        name: "มีน่า",
        activeRequests: 0,
        currentTask: null,
        lastErrorReason: null,
        lastErrorCode: null,
        lastErrorUntil: 0,
      },
      antigravity: {
        id: "antigravity",
        name: "Antigravity",
        activeRequests: 0,
        currentTask: null,
        lastErrorReason: null,
        lastErrorCode: null,
        lastErrorUntil: 0,
      },
      ai_studio: {
        id: "ai_studio",
        name: "Google AI Studio",
        activeRequests: 0,
        currentTask: null,
        lastErrorReason: null,
        lastErrorCode: null,
        lastErrorUntil: 0,
      },
    });
  }
  return {
    quotaState: userQuotaStates.get(key),
    characterRuntime: userCharacterRuntimes.get(key),
  };
}

function ensureQuotaWindowFresh(userId) {
  const { quotaState, characterRuntime } = getUserState(userId);
  const now = Date.now();
  if (now >= quotaState.resetAt) {
    quotaState.tokensUsed = 0;
    quotaState.resetAt = getNextMidnightMs(now);
    for (const c of Object.values(characterRuntime)) {
      if (c.lastErrorCode === "RESOURCE_EXHAUSTED" || c.lastErrorCode === "QUOTA_EXHAUSTED") {
        c.lastErrorReason = null;
        c.lastErrorCode = null;
        c.lastErrorUntil = 0;
      }
    }
  }
}

function hasValidGeminiApiKey(env = process.env) {
  const key = String(env.GEMINI_API_KEY || "").trim();
  return Boolean(key && key !== "MY_GEMINI_API_KEY");
}

function summarizeTaskLabel(raw, fallback) {
  const cleaned = String(raw || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.length > 38 ? `${cleaned.slice(0, 38)}…` : cleaned;
}

function beginCharacterTask(userId, id, taskLabel) {
  ensureQuotaWindowFresh(userId);
  const { characterRuntime } = getUserState(userId);
  const c = characterRuntime[id];
  if (!c) return;
  c.activeRequests += 1;
  c.currentTask = taskLabel;
  c.lastErrorReason = null;
  c.lastErrorCode = null;
  c.lastErrorUntil = 0;
}

function endCharacterTask(userId, id) {
  const { characterRuntime } = getUserState(userId);
  const c = characterRuntime[id];
  if (!c) return;
  c.activeRequests = Math.max(0, c.activeRequests - 1);
  if (c.activeRequests === 0) {
    c.currentTask = null;
  }
}

function recordCharacterError(userId, id, code, reason) {
  const { characterRuntime } = getUserState(userId);
  const c = characterRuntime[id];
  if (!c) return;
  c.lastErrorCode = code || "ERROR";
  c.lastErrorReason = reason;
  const durationMs =
    code === "API_KEY_INVALID" || code === "PERMISSION_DENIED"
      ? 30 * 60 * 1000
      : code === "RESOURCE_EXHAUSTED"
        ? 5 * 60 * 1000
        : 90 * 1000;
  c.lastErrorUntil = Date.now() + durationMs;
}

function recordTokenUsage(userId, tokens) {
  ensureQuotaWindowFresh(userId);
  const { quotaState } = getUserState(userId);
  if (Number.isFinite(tokens) && tokens > 0) {
    quotaState.tokensUsed = Math.min(
      quotaState.tokensLimit * 2,
      quotaState.tokensUsed + Math.round(tokens)
    );
  }
}

function estimateFallbackTokens(inputChars, outputChars) {
  return Math.max(40, Math.round((inputChars + outputChars) / 3.2));
}

function formatShortClock(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "00:00 น.";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} น.`;
}

function buildCharacterStatusMap(userId, env = process.env) {
  ensureQuotaWindowFresh(userId);
  const { quotaState, characterRuntime } = getUserState(userId);
  const now = Date.now();
  const apiKeyReady = hasValidGeminiApiKey(env);
  const remaining = Math.max(0, quotaState.tokensLimit - quotaState.tokensUsed);

  const result = {};
  for (const id of ["mina", "antigravity", "ai_studio"]) {
    const c = characterRuntime[id];
    const hasActiveError = Boolean(c.lastErrorReason && now < c.lastErrorUntil);

    let status = "ready";
    let unavailableReason = null;
    let unavailableCode = null;

    if (!apiKeyReady) {
      status = "unavailable";
      unavailableCode = "MISSING_API_KEY";
      unavailableReason = "ยังไม่ได้ตั้งค่า GEMINI_API_KEY";
    } else if (c.activeRequests > 0) {
      status = "busy";
    } else if (remaining <= 0) {
      status = "unavailable";
      unavailableCode = "QUOTA_EXHAUSTED";
      unavailableReason = `Token หมด (รีเซ็ต ${formatShortClock(quotaState.resetAt)})`;
    } else if (hasActiveError) {
      status = "unavailable";
      unavailableCode = c.lastErrorCode;
      unavailableReason = c.lastErrorReason;
    }

    result[id] = {
      id,
      name: c.name,
      status,
      tokensRemaining: remaining,
      tokensUsed: quotaState.tokensUsed,
      tokensLimit: quotaState.tokensLimit,
      resetAt: quotaState.resetAt,
      currentTask: status === "busy" ? c.currentTask : null,
      unavailableReason,
      unavailableCode,
    };
  }
  return result;
}

module.exports = {
  DEFAULT_DAILY_TOKEN_LIMIT,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  getNextMidnightMs,
  getUserState,
  ensureQuotaWindowFresh,
  hasValidGeminiApiKey,
  summarizeTaskLabel,
  beginCharacterTask,
  endCharacterTask,
  recordCharacterError,
  recordTokenUsage,
  estimateFallbackTokens,
  formatShortClock,
  buildCharacterStatusMap,
};
