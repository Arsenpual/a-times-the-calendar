const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

function getNextMidnightMs(fromMs = Date.now()) {
  const next = new Date(fromMs);
  next.setHours(24, 0, 0, 0);
  return next.getTime();
}

const DEFAULT_DAILY_TOKEN_LIMIT = 250_000;
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

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

function toFiniteNumberOrNull(val) {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toCleanStringOrNull(val, maxLen = 240) {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

function sanitizeSleepStage(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const minutes = Math.max(0, Math.round(toFiniteNumberOrNull(obj.minutes) ?? 0));
  const hrs = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  const fallbackText =
    minutes > 0
      ? hrs > 0
        ? `${hrs} ชั่วโมง ${remMins} นาที`
        : `${remMins} นาที`
      : "";
  return {
    minutes,
    durationText: toCleanStringOrNull(obj.durationText, 80) ?? fallbackText,
    percent: toFiniteNumberOrNull(obj.percent),
    status: toCleanStringOrNull(obj.status, 40),
    referenceRange: toCleanStringOrNull(obj.referenceRange, 60),
  };
}

function sanitizeSleepRecord(raw, fallbackDate = new Date().toISOString().slice(0, 10)) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const nowIso = new Date().toISOString();
  const rawDate = toCleanStringOrNull(obj.date, 20);
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : fallbackDate;
  const id =
    toCleanStringOrNull(obj.id, 80) ?? `sleep_${date}_${Date.now().toString(36)}`;
  const stagesObj = obj.stages && typeof obj.stages === "object" ? obj.stages : {};
  const deep = sanitizeSleepStage(stagesObj.deep);
  const light = sanitizeSleepStage(stagesObj.light);
  const rem = sanitizeSleepStage(stagesObj.rem);

  const stageSum = deep.minutes + light.minutes + rem.minutes;
  const totalSleepMinutes =
    toFiniteNumberOrNull(obj.totalSleepMinutes) ?? (stageSum > 0 ? stageSum : null);

  const rawInsights = Array.isArray(obj.appInsights)
    ? obj.appInsights
        .map((s) => toCleanStringOrNull(s, 400))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  let aiAnalysis = null;
  if (obj.aiAnalysis && typeof obj.aiAnalysis === "object") {
    const a = obj.aiAnalysis;
    const summary = toCleanStringOrNull(a.summary, 1200);
    if (summary) {
      aiAnalysis = {
        summary,
        strengths: Array.isArray(a.strengths)
          ? a.strengths.map((s) => toCleanStringOrNull(s, 300)).filter(Boolean).slice(0, 6)
          : [],
        concerns: Array.isArray(a.concerns)
          ? a.concerns.map((s) => toCleanStringOrNull(s, 300)).filter(Boolean).slice(0, 6)
          : [],
        actionableTips: Array.isArray(a.actionableTips)
          ? a.actionableTips.map((s) => toCleanStringOrNull(s, 300)).filter(Boolean).slice(0, 6)
          : [],
        circadianNote: toCleanStringOrNull(a.circadianNote, 500) ?? "",
        analyzedAt: toCleanStringOrNull(a.analyzedAt, 40) ?? nowIso,
        model: toCleanStringOrNull(a.model, 60) ?? PRIMARY_MODEL,
      };
    }
  }

  return {
    id,
    date,
    dateLabel: toCleanStringOrNull(obj.dateLabel, 60) ?? date,
    sourceApp: toCleanStringOrNull(obj.sourceApp, 80) ?? "Health App",
    userLabel: toCleanStringOrNull(obj.userLabel, 80),
    sleepScore: toFiniteNumberOrNull(obj.sleepScore),
    percentileBeat: toFiniteNumberOrNull(obj.percentileBeat),
    bedtime: toCleanStringOrNull(obj.bedtime, 20),
    wakeTime: toCleanStringOrNull(obj.wakeTime, 20),
    totalSleepMinutes,
    totalSleepText:
      toCleanStringOrNull(obj.totalSleepText, 80) ??
      (totalSleepMinutes != null
        ? `${Math.floor(totalSleepMinutes / 60)} ชั่วโมง ${totalSleepMinutes % 60} นาที`
        : null),
    totalSleepStatus: toCleanStringOrNull(obj.totalSleepStatus, 40),
    totalSleepReference: toCleanStringOrNull(obj.totalSleepReference, 60),
    stages: { deep, light, rem },
    deepSleepContinuityScore: toFiniteNumberOrNull(obj.deepSleepContinuityScore),
    deepSleepContinuityStatus: toCleanStringOrNull(obj.deepSleepContinuityStatus, 40),
    awakeCount: toFiniteNumberOrNull(obj.awakeCount),
    awakeStatus: toCleanStringOrNull(obj.awakeStatus, 40),
    breathingQualityScore: toFiniteNumberOrNull(obj.breathingQualityScore),
    breathingQualityStatus: toCleanStringOrNull(obj.breathingQualityStatus, 40),
    previousDayStressScore: toFiniteNumberOrNull(obj.previousDayStressScore),
    appInsights: rawInsights,
    appRecommendation: toCleanStringOrNull(obj.appRecommendation, 450),
    aiAnalysis,
    createdAt: toCleanStringOrNull(obj.createdAt, 40) ?? nowIso,
    updatedAt: nowIso,
  };
}

const SLEEP_EXTRACT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    date: { type: "STRING" },
    dateLabel: { type: "STRING" },
    sourceApp: { type: "STRING" },
    userLabel: { type: "STRING" },
    sleepScore: { type: "NUMBER" },
    percentileBeat: { type: "NUMBER" },
    bedtime: { type: "STRING" },
    wakeTime: { type: "STRING" },
    totalSleepMinutes: { type: "NUMBER" },
    totalSleepText: { type: "STRING" },
    totalSleepStatus: { type: "STRING" },
    totalSleepReference: { type: "STRING" },
    deepMinutes: { type: "NUMBER" },
    deepText: { type: "STRING" },
    deepPercent: { type: "NUMBER" },
    deepStatus: { type: "STRING" },
    deepReference: { type: "STRING" },
    lightMinutes: { type: "NUMBER" },
    lightText: { type: "STRING" },
    lightPercent: { type: "NUMBER" },
    lightStatus: { type: "STRING" },
    lightReference: { type: "STRING" },
    remMinutes: { type: "NUMBER" },
    remText: { type: "STRING" },
    remPercent: { type: "NUMBER" },
    remStatus: { type: "STRING" },
    remReference: { type: "STRING" },
    deepSleepContinuityScore: { type: "NUMBER" },
    deepSleepContinuityStatus: { type: "STRING" },
    awakeCount: { type: "NUMBER" },
    awakeStatus: { type: "STRING" },
    breathingQualityScore: { type: "NUMBER" },
    breathingQualityStatus: { type: "STRING" },
    previousDayStressScore: { type: "NUMBER" },
    appInsights: { type: "ARRAY", items: { type: "STRING" } },
    appRecommendation: { type: "STRING" },
  },
  required: ["date", "sourceApp", "totalSleepMinutes"],
};

const SLEEP_ANALYZE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    concerns: { type: "ARRAY", items: { type: "STRING" } },
    circadianNote: { type: "STRING" },
    actionableTips: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "strengths", "concerns", "circadianNote", "actionableTips"],
};

const PROPOSE_GOOGLE_TASK_TOOL = {
  name: "propose_google_task",
  description:
    "Prepare a new Google Task item to pin on the user home office pinboard (Google Tasks) whenever the user asks to add, create, schedule, remind, or record a task or to-do item, or delegates a scheduled/automatic task to Mina.",
  parameters: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      notes: { type: "STRING" },
      dueDate: { type: "STRING" },
      assignToMina: { type: "BOOLEAN" },
      assistantId: { type: "STRING" },
      scheduledTime: { type: "STRING" },
    },
    required: ["title"],
  },
};

function classifyGeminiError(err) {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  const statusNum = typeof err?.status === "number" ? err.status : undefined;

  if (lower.includes("aborted") || lower.includes("timeout") || err?.name === "TimeoutError") {
    return {
      status: 504,
      code: "TIMEOUT",
      message: "ผู้ช่วย AI ใช้เวลาประมวลผลนานกว่าปกติ กรุณากด “ส่งใหม่” อีกครั้งครับ",
    };
  }
  if (
    raw === "MISSING_API_KEY" ||
    lower.includes("ยังไม่ได้ตั้งค่า gemini_api_key") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key") ||
    statusNum === 401 ||
    statusNum === 503
  ) {
    return {
      status: 401,
      code: "API_KEY_INVALID",
      message: "ยังไม่ได้ตั้งค่าหรือคีย์ Gemini API ไม่ถูกต้อง กรุณาตรวจสอบ GEMINI_API_KEY บนเซิร์ฟเวอร์",
    };
  }
  if (lower.includes("permission_denied") || lower.includes("403") || statusNum === 403) {
    return {
      status: 403,
      code: "PERMISSION_DENIED",
      message: "สิทธิ์การเข้าถึง Gemini API ถูกปฏิเสธ กรุณาตรวจสอบการตั้งค่า API Key",
    };
  }
  if (
    lower.includes("resource_exhausted") ||
    lower.includes("429") ||
    lower.includes("quota") ||
    statusNum === 429
  ) {
    return {
      status: 429,
      code: "RESOURCE_EXHAUSTED",
      message: "ใช้งานเกินโควต้าของ Gemini API ชั่วคราว กรุณารอสักครู่แล้วลองส่งใหม่อีกครั้ง",
    };
  }
  return {
    status: statusNum ?? 500,
    code: String(statusNum ?? err?.code ?? "UNKNOWN"),
    message: "ไม่สามารถเชื่อมต่อกับผู้ช่วย AI ได้ในขณะนี้ กรุณาลองส่งข้อความใหม่อีกครั้ง",
  };
}

function buildAiStudioSystemInstruction(mode, customInstruction) {
  const modeGuidance = {
    prompt: [
      "โหมดปัจจุบัน: Prompt Lab (ออกแบบ ทดสอบ และปรับแต่ง Prompt)",
      "- ช่วยวิเคราะห์โจทย์ เขียน/รีไรต์ Prompt ให้คมชัด แยกโครงสร้าง Role / Context / Constraints / Output Format",
      "- แนะนำวิธีปรับจูนให้ผลลัพธ์แม่นยำและสม่ำเสมอขึ้น",
    ].join("\n"),
    build: [
      "โหมดปัจจุบัน: App Builder (วางโครงสร้างและออกแบบต้นแบบเว็บแอพ)",
      "- เสนอสถาปัตยกรรมคอมโพเนนต์ โฟลว์การใช้งาน UI และตัวอย่างโค้ด React + TypeScript + Tailwind CSS ที่พร้อมต่อยอด",
      "- ชี้จุดควรระวังด้าน UX และ Edge Cases อย่างกระชับ",
    ].join("\n"),
    schema: [
      "โหมดปัจจุบัน: JSON & Schema (ออกแบบ Structured Output / JSON Schema / TypeScript Interface)",
      "- สร้าง JSON Schema หรือ TypeScript Type ที่สะอาด ถูกต้องตามมาตรฐาน พร้อมตัวอย่าง JSON ที่ใช้งานได้จริง",
      "- อธิบายฟิลด์สำคัญสั้นๆ ในรูปแบบอ่านง่าย",
    ].join("\n"),
  };

  return [
    'คุณคือ "Google AI Studio" ตัวละครผู้เชี่ยวชาญด้าน Prompt Engineering, การสร้างต้นแบบแอพ และการออกแบบ Structured Schema ประจำสถานี AI Lab ในห้องทำงาน Cozy Desk (โหมดหนึ่งใน T.i.M.E.S.)',
    "บุคลิกของคุณ: ทันสมัย เป็นระบบ ฉับไว เป็นมิตร และเน้นผลลัพธ์ที่นำไปใช้จริงได้ทันที",
    "ภาษา: ตอบเป็นภาษาไทยอย่างเป็นธรรมชาติเป็นหลัก (ใช้ศัพท์เทคนิคและโค้ดภาษาอังกฤษตามมาตรฐาน)",
    modeGuidance[mode] ?? modeGuidance.prompt,
    customInstruction?.trim()
      ? `คำสั่งเพิ่มเติมจากผู้ใช้ (System Instruction):\n${customInstruction.trim().slice(0, 2000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", ".gemini", "secrets"]);
const WORKSPACE_ROOT = path.resolve(__dirname, "../..");

async function listSafeWorkspaceFiles(dir = WORKSPACE_ROOT, prefix = "", depth = 0) {
  if (depth > 3) return [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const sub = await listSafeWorkspaceFiles(path.join(dir, entry.name), rel, depth + 1);
        results.push(...sub);
      } else if (/\.(ts|tsx|js|jsx|json|css|html|md)$/i.test(entry.name) && !/secret|credential/i.test(entry.name)) {
        results.push(rel);
      }
      if (results.length >= 80) break;
    }
    return results.slice(0, 80);
  } catch {
    return [];
  }
}

async function readSafeWorkspaceFile(relPath) {
  try {
    const cleanRel = String(relPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!cleanRel || cleanRel.includes("..") || cleanRel.startsWith(".env") || /secret|credential/i.test(cleanRel)) {
      return null;
    }
    const segs = cleanRel.split("/");
    if (segs.some((seg) => EXCLUDED_DIRS.has(seg) || seg.startsWith("."))) {
      return null;
    }
    const fullPath = path.resolve(WORKSPACE_ROOT, cleanRel);
    const rootWithSep = WORKSPACE_ROOT.endsWith(path.sep) ? WORKSPACE_ROOT : `${WORKSPACE_ROOT}${path.sep}`;
    if (!fullPath.startsWith(rootWithSep)) {
      return null;
    }
    const stat = await fs.stat(fullPath);
    if (!stat.isFile() || stat.size > 250_000) {
      return null;
    }
    const raw = await fs.readFile(fullPath, "utf8");
    return raw.slice(0, 14_000);
  } catch {
    return null;
  }
}

function buildAntigravitySystemInstruction(mode, workspaceFiles, fileContexts) {
  const modeGuidance = {
    code: [
      "โหมดปัจจุบัน: Code & Debug (เขียนโค้ด แก้บัค และรีวิวโค้ด)",
      "- วิเคราะห์ปัญหาอย่างแม่นยำ พร้อมแสดงตัวอย่างโค้ด TypeScript / React / Node.js ที่สะอาด ปลอดภัย และไม่เสี่ยงเกิดบัค",
      "- ชี้จุดที่ควรระวัง (Edge Cases) และวิธีทดสอบอย่างกระชับ",
    ].join("\n"),
    workspace: [
      "โหมดปัจจุบัน: Workspace Explorer (สำรวจและอธิบายไฟล์ในโปรเจกต์บน localhost)",
      "- อ้างอิงจากรายชื่อไฟล์และเนื้อหาไฟล์ในโปรเจกต์ที่แนบให้ด้านล่างตามจริง",
      "- อธิบายการทำงานของแต่ละไฟล์ ความเชื่อมโยงของระบบ และจุดที่สามารถปรับปรุงต่อได้",
    ].join("\n"),
    arch: [
      "โหมดปัจจุบัน: Architecture & Localhost CLI (ออกแบบสถาปัตยกรรมและคำสั่งรันงาน)",
      "- แนะนำโครงสร้างระบบ การเชื่อมต่อ API บน localhost คำสั่ง CLI/Terminal และแนวทางที่เสถียรที่สุด",
      "- จัดลำดับขั้นตอนเป็นข้อๆ ที่นำไปรันหรือพัฒนาต่อได้ทันที",
    ].join("\n"),
  };

  const fileListBlock =
    workspaceFiles.length > 0
      ? `รายชื่อไฟล์ในโปรเจกต์ (${path.basename(WORKSPACE_ROOT)}):\n${workspaceFiles.map((f) => `- ${f}`).join("\n")}`
      : "";

  const attachedFilesBlock =
    fileContexts.length > 0
      ? `เนื้อหาไฟล์จริงที่ถูกดึงมาตรวจสอบ:\n\n${fileContexts
          .map((f) => `### ไฟล์: \`${f.path}\`\n\`\`\`\n${f.content}\n\`\`\``)
          .join("\n\n")}`
      : "";

  return [
    'คุณคือ "Antigravity (AGY)" ตัวละคร AI Coding & Localhost Agent ประจำสถานี Dev Station ในห้องทำงานของ Cozy Desk (โหมดหนึ่งใน T.i.M.E.S.)',
    "บุคลิกของคุณ: เชี่ยวชาญด้านวิศวกรรมซอฟต์แวร์ เฉียบคม สุภาพ เป็นกันเอง เน้นความเสถียรของระบบ (Zero-Bug Mindset) และอธิบายเรื่องเทคนิคให้เข้าใจง่าย",
    "ภาษา: ตอบเป็นภาษาไทยอย่างเป็นธรรมชาติ (ใช้ศัพท์เทคนิคและโค้ดภาษาอังกฤษตามมาตรฐาน)",
    "รูปแบบการตอบ: ใช้ Markdown และ Code Block ที่มีระบุภาษาชัดเจน กระชับ ตรงประเด็น",
    modeGuidance[mode] ?? modeGuidance.code,
    fileListBlock,
    attachedFilesBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatGoogleTasksContext(tasksContext, localDate) {
  const status = tasksContext?.status;
  if (!tasksContext || status === "not_signed_in") {
    return [
      "สถานะ Google Tasks ปัจจุบัน: ผู้ใช้ยังไม่ได้เชื่อมต่อสิทธิ์ Google Tasks ในโหมด Cozy Desk",
      '- หากผู้ใช้ถามถึงงานใน Google Tasks ให้แจ้งอย่างสุภาพว่ายังมองไม่เห็นรายการงานเพราะยังไม่ได้กดปุ่ม "Sign in with Google" ในแถบ Google Tasks ด้านบนช่องแชทก่อน (ห้ามเดาหรือแต่งชื่องานขึ้นมาเอง)',
    ].join("\n");
  }
  if (status === "auth_expired") {
    return [
      "สถานะ Google Tasks ปัจจุบัน: เซสชัน Google หมดอายุหรือยังไม่มีสิทธิ์เข้าถึง Google Tasks",
      '- หากผู้ใช้ถามถึงรายการงาน ให้แจ้งอย่างสุภาพว่าสิทธิ์เชื่อมต่อ Google หมดอายุแล้ว กรุณากด "Sign in with Google" ใหม่อีกครั้ง',
    ].join("\n");
  }
  if (status === "unavailable") {
    return [
      `สถานะ Google Tasks ปัจจุบัน: ไม่สามารถดึงข้อมูลจาก Google Tasks ได้ชั่วคราว${tasksContext.errorDetail ? ` (${tasksContext.errorDetail})` : ""}`,
      '- หากผู้ใช้ถามถึงรายการงาน ให้แนะนำให้กดปุ่ม "ซิงค์" ในแถบ Google Tasks หรือเปิดดูที่กระดานโน้ตในห้องทำงานแล้วลองถามใหม่อีกครั้ง',
    ].join("\n");
  }

  const rawLists = Array.isArray(tasksContext.lists) ? tasksContext.lists.slice(0, 50) : [];
  const MAX_RENDERED_TASKS = 300;
  const preparedLists = rawLists.map((list) => {
    const listTitle = typeof list?.title === "string" && list.title.trim() ? list.title.trim().slice(0, 100) : "รายการงาน";
    const rawTasks = Array.isArray(list?.tasks) ? list.tasks : [];
    const pending = rawTasks.filter((t) => t?.status !== "completed");
    const completed = rawTasks
      .filter((t) => t?.status === "completed")
      .sort((a, b) => String(b.updated ?? "").localeCompare(String(a.updated ?? "")));
    return { title: listTitle, pending, completed, lines: [] };
  });

  const totalPending = preparedLists.reduce((acc, l) => acc + l.pending.length, 0);
  const totalCompleted = preparedLists.reduce((acc, l) => acc + l.completed.length, 0);

  const formatTaskLine = (task, isDone) => {
    const title = typeof task?.title === "string" && task.title.trim() ? task.title.trim().slice(0, 200) : "(ไม่มีชื่องาน)";
    const dueDate = typeof task?.due === "string" && /^\d{4}-\d{2}-\d{2}/.test(task.due) ? task.due.slice(0, 10) : "";
    const notes = typeof task?.notes === "string" && task.notes.trim() ? task.notes.trim().replace(/\s+/g, " ").slice(0, 180) : "";
    let dueTag = "";
    if (dueDate) {
      if (!isDone && dueDate < localDate) dueTag = ` | กำหนดส่ง: ${dueDate} (เลยกำหนด)`;
      else if (!isDone && dueDate === localDate) dueTag = ` | กำหนดส่ง: ${dueDate} (วันนี้)`;
      else dueTag = ` | กำหนดส่ง: ${dueDate}`;
    }
    const notesTag = notes ? ` | โน้ต: ${notes}` : "";
    const indent = task.parent ? "    ↳ " : "  - ";
    return `${indent}[${isDone ? "✓ เสร็จแล้ว" : "ยังไม่เสร็จ"}] ${title}${dueTag}${notesTag}`;
  };

  let renderedTaskCount = 0;
  for (const list of preparedLists) {
    for (const task of list.pending) {
      if (renderedTaskCount >= MAX_RENDERED_TASKS) break;
      list.lines.push(formatTaskLine(task, false));
      renderedTaskCount += 1;
    }
  }
  const remainingForCompleted = Math.max(0, MAX_RENDERED_TASKS - renderedTaskCount);
  if (remainingForCompleted > 0 && preparedLists.length > 0) {
    const listsWithCompleted = preparedLists.filter((l) => l.completed.length > 0);
    const perListQuota = Math.max(5, Math.floor(remainingForCompleted / Math.max(1, listsWithCompleted.length)));
    for (const list of listsWithCompleted) {
      let addedInList = 0;
      for (const task of list.completed) {
        if (renderedTaskCount >= MAX_RENDERED_TASKS || addedInList >= perListQuota) break;
        list.lines.push(formatTaskLine(task, true));
        renderedTaskCount += 1;
        addedInList += 1;
      }
    }
  }

  const listBlocks = preparedLists.map((list) =>
    list.lines.length === 0
      ? `• รายการ "${list.title}" (ไม่มีงานในรายการนี้)`
      : `• รายการ "${list.title}" (ค้าง ${list.pending.length} / เสร็จแล้ว ${list.completed.length}):\n${list.lines.join("\n")}`
  );

  return [
    `ข้อมูล Google Tasks จริงล่าสุดทั้งหมดของผู้ใช้ (ณ ${localDate} | ทั้งหมด ${preparedLists.length} รายการ | งานค้างทั้งหมด ${totalPending} งาน, เสร็จแล้ว ${totalCompleted} งาน):`,
    listBlocks.length > 0 ? listBlocks.join("\n\n") : "(ยังไม่มีรายการงานใน Google Tasks)",
  ].join("\n");
}

function formatSleepLogsContext(sleepLogs) {
  const logs = Array.isArray(sleepLogs) ? sleepLogs.slice(0, 7) : [];
  if (logs.length === 0) {
    return [
      "ข้อมูลบันทึกการนอนประจำวัน (จากภารกิจในห้องนอน): ยังไม่มีข้อมูลการนอนที่บันทึกไว้",
      "- หากผู้ใช้ถามถึงคุณภาพการนอน ให้แนะนำว่าสามารถเดินไปที่โต๊ะข้างเตียงฝั่งขวาในห้องนอนใหญ่เพื่ออัปโหลดภาพสถิติการนอนแปลงเป็นไฟล์ .json ให้ AI วิเคราะห์ได้เลย",
    ].join("\n");
  }
  const lines = logs.map((log) => {
    const dur =
      log.totalSleepText ||
      (typeof log.totalSleepMinutes === "number"
        ? `${Math.floor(log.totalSleepMinutes / 60)} ชม. ${log.totalSleepMinutes % 60} นาที`
        : "ไม่ระบุ");
    const score = typeof log.sleepScore === "number" ? `${log.sleepScore} คะแนน` : "ไม่ระบุคะแนน";
    const windowStr = log.bedtime && log.wakeTime ? `เวลานอน ${log.bedtime}–${log.wakeTime}` : "ไม่ระบุช่วงเวลา";
    return `- วันที่ ${log.date} (${log.dateLabel || log.date}, ${log.sourceApp || "Health App"}): ${score} | ${dur} | ${windowStr}`;
  });
  return [`ข้อมูลบันทึกการนอนประจำวันจริง (.json ล่าสุด ${logs.length} วัน):`, ...lines].join("\n");
}

function buildMinaSystemInstruction(mode, timeOfDay, localDate, tasksContext, sleepLogsContext) {
  const timeContext = {
    morning: "ตอนนี้เป็นช่วงเช้าในบ้าน บรรยากาศสดใสเหมาะกับการวางแผนและเริ่มงาน",
    afternoon: "ตอนนี้เป็นช่วงบ่ายอุ่นๆ ในบ้าน บรรยากาศสบายๆ เหมาะกับการโฟกัสและต่อยอดงาน",
    evening: "ตอนนี้เป็นช่วงค่ำในห้องทำงาน เปิดโคมไฟอุ่นๆ บรรยากาศสงบเหมาะกับการสรุปและร่างงาน",
  };
  const modeGuidance = {
    qa: "โหมดปัจจุบัน: ถาม-ตอบช่วยทำงาน (Work Q&A)\n- ตอบคำถามอย่างตรงประเด็น กระชับ ชัดเจน และนำไปใช้งานได้จริง",
    brainstorm: "โหมดปัจจุบัน: คิดไอเดียและระดมสมอง (Brainstorm)\n- เสนอไอเดียหลากหลายมุมมองอย่างน้อย 3–5 แนวทาง พร้อมชื่อแนวคิดสั้นๆ และจุดเด่น",
    draft: "โหมดปัจจุบัน: ร่างเอกสารและข้อความ (Document Drafting)\n- ร่างข้อความหรือเอกสารให้สมบูรณ์พร้อมนำไปคัดลอกใช้งานได้ทันที",
  };
  return [
    'คุณคือ "มีน่า (Mina)" ผู้ช่วยทำงานประจำโต๊ะคอมพิวเตอร์ในห้องทำงานของบ้านจำลอง 2D Cozy Desk (โหมดหนึ่งใน T.i.M.E.S.)',
    timeContext[timeOfDay] ?? timeContext.afternoon,
    `วันที่ปัจจุบันของผู้ใช้คือ ${localDate}`,
    "บุคลิกของคุณ: อบอุ่น เป็นกันเอง สุภาพ ฉลาดจัดระเบียบ และพูดจาเป็นธรรมชาติเหมือนเพื่อนร่วมโต๊ะทำงานที่พึ่งพาได้",
    "ความสามารถเสริม — ดู/รายงาน และเพิ่มงานลง Google Tasks บนกระดานโน้ตในห้องทำงาน:",
    "- หากผู้ใช้สั่งให้เพิ่มงาน สร้าง task จดสิ่งที่ต้องทำ หรือสั่งให้มีน่า/Antigravity/AI Studio ทำงานอัตโนมัติลง Task ให้เรียกเครื่องมือ `propose_google_task`",
    formatGoogleTasksContext(tasksContext, localDate),
    formatSleepLogsContext(sleepLogsContext),
    modeGuidance[mode] ?? modeGuidance.qa,
  ].join("\n\n");
}

function createCozyDeskRouter({
  generateContent = (...args) => require("../gemini-api.js").generateContent(...args),
  sleepLogsCol = (...args) => require("../firestore-db.js").cozySleepLogsCol(...args),
  env = process.env,
} = {}) {
  const router = express.Router();

  async function readSleepLogs(userId) {
    const snap = await sleepLogsCol(userId).get();
    return snap.docs
      .map((doc) => sanitizeSleepRecord({ ...doc.data(), id: doc.id }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  }

  router.get("/sleep/logs", async (req, res) => {
    try {
      const logs = await readSleepLogs(req.userId);
      res.json({ ok: true, logs });
    } catch (err) {
      console.error("[cozy-desk] Failed to read sleep logs:", err);
      res.status(500).json({ error: "ไม่สามารถอ่านคลังข้อมูลการนอนได้" });
    }
  });

  router.post("/sleep/logs", async (req, res) => {
    try {
      const body = req.body ?? {};
      if (!body.record || typeof body.record !== "object") {
        return res.status(400).json({ error: "ข้อมูลการนอนไม่ถูกต้อง" });
      }
      const cleanRecord = sanitizeSleepRecord(body.record);
      await sleepLogsCol(req.userId).doc(cleanRecord.id).set(cleanRecord, { merge: true });
      const logs = await readSleepLogs(req.userId);
      res.json({ ok: true, record: cleanRecord, logs });
    } catch (err) {
      console.error("[cozy-desk] Failed to save sleep log:", err);
      res.status(500).json({ error: "ไม่สามารถบันทึกไฟล์ข้อมูลการนอนได้" });
    }
  });

  router.delete("/sleep/logs/:id", async (req, res) => {
    try {
      const targetId = String(req.params.id || "").trim();
      if (!targetId) {
        return res.status(400).json({ error: "ไม่พบรหัสบันทึกการนอน" });
      }
      await sleepLogsCol(req.userId).doc(targetId).delete();
      const logs = await readSleepLogs(req.userId);
      res.json({ ok: true, logs });
    } catch (err) {
      console.error("[cozy-desk] Failed to delete sleep log:", err);
      res.status(500).json({ error: "ไม่สามารถลบบันทึกการนอนได้" });
    }
  });

  router.post("/sleep/extract", async (req, res) => {
    const body = req.body ?? {};
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "image/jpeg";
    const defaultDate =
      typeof body.defaultDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.defaultDate.trim())
        ? body.defaultDate.trim()
        : new Date().toISOString().slice(0, 10);

    const allowedMimes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!imageBase64 || imageBase64.length < 100 || !allowedMimes.has(mimeType)) {
      return res.status(400).json({ error: "กรุณาอัปโหลดไฟล์รูปภาพ (.jpg, .png หรือ .webp) ที่ชัดเจนครับ" });
    }

    const extractPrompt = [
      "คุณคือระบบสกัดข้อมูลสุขภาพการนอน (Sleep Data OCR & Structured JSON Parser) ที่แม่นยำสูง",
      `วันที่อ้างอิงปัจจุบันคือ ${defaultDate} (ใช้ปี ค.ศ. จากวันที่อ้างอิงนี้หากในรูปแสดงเฉพาะวัน/เดือน)`,
      "จงอ่านข้อมูลทุกตัวเลขและข้อความจากภาพหน้าจอแอพสุขภาพการนอนนี้ แล้วแปลงเป็น JSON ตาม Schema ที่กำหนดอย่างครบถ้วน:",
      "- แปลงระยะเวลาแต่ละช่วงให้เป็นจำนวนนาทีที่ถูกต้อง",
      "- ดึงเวลานอน (bedtime) และเวลาตื่น (wakeTime) ในรูปแบบ 24 ชั่วโมง HH:mm",
      "- สำหรับฟิลด์ตัวเลขที่ไม่มีในรูปให้ใส่ -1 และข้อความที่ไม่มีให้ใส่ \"\"",
    ].join("\n");

    try {
      const payload = await generateContent(
        {
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType, data: imageBase64 } },
                { text: extractPrompt },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SLEEP_EXTRACT_RESPONSE_SCHEMA,
          },
        },
        { env }
      );

      const rawText = (
        payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || ""
      ).trim();
      const parsed = JSON.parse(rawText);
      const numOrNull = (v) => {
        const n = toFiniteNumberOrNull(v);
        return n !== null && n >= 0 ? n : null;
      };
      const extractedDate =
        typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date.trim())
          ? parsed.date.trim()
          : defaultDate;

      const record = sanitizeSleepRecord(
        {
          id: `sleep_${extractedDate}`,
          date: extractedDate,
          dateLabel: toCleanStringOrNull(parsed.dateLabel, 60) ?? extractedDate,
          sourceApp: toCleanStringOrNull(parsed.sourceApp, 80) ?? "Health App",
          userLabel: toCleanStringOrNull(parsed.userLabel, 80),
          sleepScore: numOrNull(parsed.sleepScore),
          percentileBeat: numOrNull(parsed.percentileBeat),
          bedtime: toCleanStringOrNull(parsed.bedtime, 20),
          wakeTime: toCleanStringOrNull(parsed.wakeTime, 20),
          totalSleepMinutes: numOrNull(parsed.totalSleepMinutes),
          totalSleepText: toCleanStringOrNull(parsed.totalSleepText, 80),
          totalSleepStatus: toCleanStringOrNull(parsed.totalSleepStatus, 40),
          totalSleepReference: toCleanStringOrNull(parsed.totalSleepReference, 60),
          stages: {
            deep: {
              minutes: numOrNull(parsed.deepMinutes) ?? 0,
              durationText: toCleanStringOrNull(parsed.deepText, 80) ?? "",
              percent: numOrNull(parsed.deepPercent),
              status: toCleanStringOrNull(parsed.deepStatus, 40),
              referenceRange: toCleanStringOrNull(parsed.deepReference, 60),
            },
            light: {
              minutes: numOrNull(parsed.lightMinutes) ?? 0,
              durationText: toCleanStringOrNull(parsed.lightText, 80) ?? "",
              percent: numOrNull(parsed.lightPercent),
              status: toCleanStringOrNull(parsed.lightStatus, 40),
              referenceRange: toCleanStringOrNull(parsed.lightReference, 60),
            },
            rem: {
              minutes: numOrNull(parsed.remMinutes) ?? 0,
              durationText: toCleanStringOrNull(parsed.remText, 80) ?? "",
              percent: numOrNull(parsed.remPercent),
              status: toCleanStringOrNull(parsed.remStatus, 40),
              referenceRange: toCleanStringOrNull(parsed.remReference, 60),
            },
          },
          deepSleepContinuityScore: numOrNull(parsed.deepSleepContinuityScore),
          deepSleepContinuityStatus: toCleanStringOrNull(parsed.deepSleepContinuityStatus, 40),
          awakeCount: numOrNull(parsed.awakeCount),
          awakeStatus: toCleanStringOrNull(parsed.awakeStatus, 40),
          breathingQualityScore: numOrNull(parsed.breathingQualityScore),
          breathingQualityStatus: toCleanStringOrNull(parsed.breathingQualityStatus, 40),
          previousDayStressScore: numOrNull(parsed.previousDayStressScore),
          appInsights: Array.isArray(parsed.appInsights) ? parsed.appInsights : [],
          appRecommendation: toCleanStringOrNull(parsed.appRecommendation, 450),
        },
        defaultDate
      );

      const usedTokens =
        payload?.usageMetadata?.totalTokenCount ??
        estimateFallbackTokens(extractPrompt.length + 1200, rawText.length);
      recordTokenUsage(req.userId, usedTokens);

      res.json({ ok: true, record, model: env.GEMINI_MODEL || PRIMARY_MODEL });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json({ error: classified.message });
    }
  });

  router.post("/sleep/analyze", async (req, res) => {
    const body = req.body ?? {};
    if (!body.targetRecord || typeof body.targetRecord !== "object") {
      return res.status(400).json({ error: "กรุณาเลือกข้อมูลการนอนที่ต้องการวิเคราะห์" });
    }
    const target = sanitizeSleepRecord(body.targetRecord);
    const history = Array.isArray(body.historyRecords)
      ? body.historyRecords
          .slice(0, 14)
          .map((r) => sanitizeSleepRecord(r))
          .filter((r) => r.id !== target.id)
      : [];

    const analyzePrompt = [
      "คุณคือผู้เชี่ยวชาญด้านเวชศาสตร์การนอนหลับและโค้ชสุขภาพประจำบ้าน Cozy Desk ที่อบอุ่นและวิเคราะห์เชิงลึกจากข้อมูลจริง",
      "จงวิเคราะห์ข้อมูลการนอนในรูปแบบ JSON ด้านล่างเป็นภาษาไทยที่อ่านง่าย ตรงจุด และอ้างอิงตัวเลขจริง:",
      JSON.stringify({ ...target, aiAnalysis: undefined }, null, 2),
      history.length > 0
        ? `\nประวัติการนอนวันอื่นๆ ย้อนหลัง (${history.length} วัน):\n${JSON.stringify(history, null, 2)}`
        : "",
    ].join("\n");

    try {
      const payload = await generateContent(
        {
          contents: [{ role: "user", parts: [{ text: analyzePrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SLEEP_ANALYZE_RESPONSE_SCHEMA,
          },
        },
        { env }
      );
      const rawText = (
        payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || ""
      ).trim();
      const parsed = JSON.parse(rawText);
      const analysis = {
        summary: toCleanStringOrNull(parsed.summary, 1200) ?? "วิเคราะห์ข้อมูลการนอนเรียบร้อยแล้ว",
        strengths: Array.isArray(parsed.strengths)
          ? parsed.strengths.map((s) => toCleanStringOrNull(s, 300)).filter(Boolean).slice(0, 6)
          : [],
        concerns: Array.isArray(parsed.concerns)
          ? parsed.concerns.map((s) => toCleanStringOrNull(s, 300)).filter(Boolean).slice(0, 6)
          : [],
        circadianNote: toCleanStringOrNull(parsed.circadianNote, 500) ?? "",
        actionableTips: Array.isArray(parsed.actionableTips)
          ? parsed.actionableTips.map((s) => toCleanStringOrNull(s, 300)).filter(Boolean).slice(0, 6)
          : [],
        analyzedAt: new Date().toISOString(),
        model: env.GEMINI_MODEL || PRIMARY_MODEL,
      };
      const usedTokens =
        payload?.usageMetadata?.totalTokenCount ??
        estimateFallbackTokens(analyzePrompt.length, rawText.length);
      recordTokenUsage(req.userId, usedTokens);
      res.json({ ok: true, analysis });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json({ error: classified.message });
    }
  });

  router.get("/characters/status", (req, res) => {
    res.json({
      ok: true,
      characters: buildCharacterStatusMap(req.userId, env),
      updatedAt: Date.now(),
    });
  });

  router.post("/characters/quota-config", (req, res) => {
    ensureQuotaWindowFresh(req.userId);
    const { quotaState, characterRuntime } = getUserState(req.userId);
    const body = req.body ?? {};
    if (typeof body.dailyLimit === "number" && Number.isFinite(body.dailyLimit)) {
      quotaState.tokensLimit = Math.max(10_000, Math.min(10_000_000, Math.round(body.dailyLimit)));
    }
    if (body.resetUsage) {
      quotaState.tokensUsed = 0;
      quotaState.resetAt = getNextMidnightMs();
      for (const c of Object.values(characterRuntime)) {
        if (c.lastErrorCode === "RESOURCE_EXHAUSTED" || c.lastErrorCode === "QUOTA_EXHAUSTED") {
          c.lastErrorReason = null;
          c.lastErrorCode = null;
          c.lastErrorUntil = 0;
        }
      }
    }
    res.json({
      ok: true,
      characters: buildCharacterStatusMap(req.userId, env),
      updatedAt: Date.now(),
    });
  });

  function sanitizeIncomingMessages(rawMessages) {
    const filtered = (Array.isArray(rawMessages) ? rawMessages : [])
      .filter(
        (m) =>
          Boolean(m) &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      )
      .slice(-20);

    const sanitized = [];
    for (const m of filtered) {
      const role = m.role === "assistant" ? "model" : "user";
      const text = m.content.trim().slice(0, 6000);
      const prev = sanitized[sanitized.length - 1];
      if (prev && prev.role === role) {
        prev.parts[0].text = `${prev.parts[0].text}\n\n${text}`.slice(0, 8000);
      } else {
        sanitized.push({ role, parts: [{ text }] });
      }
    }
    return sanitized;
  }

  router.post("/aistudio/chat", async (req, res) => {
    const body = req.body ?? {};
    const mode = body.mode === "build" || body.mode === "schema" ? body.mode : "prompt";
    const customSysInst = typeof body.systemInstruction === "string" ? body.systemInstruction : "";
    const sanitizedMessages = sanitizeIncomingMessages(body.messages);

    if (sanitizedMessages.length === 0 || sanitizedMessages[sanitizedMessages.length - 1].role !== "user") {
      return res.status(400).json({ error: "กรุณาพิมพ์ Prompt ก่อนส่งให้ Google AI Studio ครับ" });
    }

    const latestPrompt = sanitizedMessages[sanitizedMessages.length - 1].parts[0].text;
    beginCharacterTask(req.userId, "ai_studio", summarizeTaskLabel(latestPrompt, "ทดลอง Prompt Lab"));

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      const systemInstruction = buildAiStudioSystemInstruction(mode, customSysInst);
      const payload = await generateContent(
        {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: sanitizedMessages,
        },
        { env }
      );
      const text = (
        payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || ""
      ).trim();
      const inputChars =
        systemInstruction.length + sanitizedMessages.reduce((acc, m) => acc + m.parts[0].text.length, 0);
      const usedTokens =
        payload?.usageMetadata?.totalTokenCount ?? estimateFallbackTokens(inputChars, text.length);
      recordTokenUsage(req.userId, usedTokens);

      if (text) {
        res.write(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: "usage", tokensUsed: usedTokens })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    } catch (err) {
      const classified = classifyGeminiError(err);
      recordCharacterError(req.userId, "ai_studio", classified.code, classified.message);
      res.write(`data: ${JSON.stringify({ type: "error", error: classified.message })}\n\n`);
    } finally {
      endCharacterTask(req.userId, "ai_studio");
      res.end();
    }
  });

  router.get("/antigravity/status", async (_req, res) => {
    const files = await listSafeWorkspaceFiles();
    res.json({
      ok: true,
      agent: "Antigravity Localhost Agent",
      host: "http://localhost:4000",
      endpoint: "/api/cozy-desk/antigravity/chat",
      workspace: path.basename(WORKSPACE_ROOT),
      model: env.GEMINI_MODEL || PRIMARY_MODEL,
      fileCount: files.length,
      files,
    });
  });

  router.post("/antigravity/chat", async (req, res) => {
    const body = req.body ?? {};
    const mode = body.mode === "workspace" || body.mode === "arch" ? body.mode : "code";
    const requestedFiles = Array.isArray(body.focusFiles)
      ? body.focusFiles.filter((f) => typeof f === "string")
      : [];
    const sanitizedMessages = sanitizeIncomingMessages(body.messages);

    if (sanitizedMessages.length === 0 || sanitizedMessages[sanitizedMessages.length - 1].role !== "user") {
      return res.status(400).json({ error: "กรุณาพิมพ์คำสั่งหรือคำถามก่อนส่งให้ Antigravity ครับ" });
    }

    const latestPrompt = sanitizedMessages[sanitizedMessages.length - 1].parts[0].text;
    beginCharacterTask(req.userId, "antigravity", summarizeTaskLabel(latestPrompt, "ตรวจโค้ด & แก้บัค"));

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      const workspaceFiles = await listSafeWorkspaceFiles();
      const lastUserText = latestPrompt.toLowerCase();
      const matchedPaths = [];
      for (const reqFile of requestedFiles) {
        if (workspaceFiles.includes(reqFile) && !matchedPaths.includes(reqFile)) {
          matchedPaths.push(reqFile);
        }
      }
      for (const wf of workspaceFiles) {
        if (matchedPaths.length >= 3) break;
        const base = path.posix.basename(wf).toLowerCase();
        if (
          !matchedPaths.includes(wf) &&
          (lastUserText.includes(wf.toLowerCase()) || (base.length >= 5 && lastUserText.includes(base)))
        ) {
          matchedPaths.push(wf);
        }
      }

      const fileContexts = [];
      for (const relPath of matchedPaths.slice(0, 3)) {
        const content = await readSafeWorkspaceFile(relPath);
        if (content) fileContexts.push({ path: relPath, content });
      }

      if (fileContexts.length > 0) {
        res.write(
          `data: ${JSON.stringify({
            type: "inspected_files",
            files: fileContexts.map((f) => f.path),
          })}\n\n`
        );
      }

      const systemInstruction = buildAntigravitySystemInstruction(mode, workspaceFiles, fileContexts);
      const payload = await generateContent(
        {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: sanitizedMessages,
        },
        { env }
      );
      const text = (
        payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || ""
      ).trim();
      const inputChars =
        systemInstruction.length + sanitizedMessages.reduce((acc, m) => acc + m.parts[0].text.length, 0);
      const usedTokens =
        payload?.usageMetadata?.totalTokenCount ?? estimateFallbackTokens(inputChars, text.length);
      recordTokenUsage(req.userId, usedTokens);

      if (text) {
        res.write(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: "usage", tokensUsed: usedTokens })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    } catch (err) {
      const classified = classifyGeminiError(err);
      recordCharacterError(req.userId, "antigravity", classified.code, classified.message);
      res.write(`data: ${JSON.stringify({ type: "error", error: classified.message })}\n\n`);
    } finally {
      endCharacterTask(req.userId, "antigravity");
      res.end();
    }
  });

  router.get("/youtube/oembed", async (req, res) => {
    const rawId = typeof req.query.videoId === "string" ? req.query.videoId.trim() : "";
    if (!/^[a-zA-Z0-9_-]{11}$/.test(rawId)) {
      return res.status(400).json({ error: "Invalid YouTube video ID" });
    }
    try {
      const targetUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${rawId}`
      )}&format=json`;
      const upstream = await fetch(targetUrl, { signal: AbortSignal.timeout(5000) });
      if (!upstream.ok) {
        return res.status(404).json({ error: "Video metadata unavailable" });
      }
      const data = await upstream.json();
      res.json({
        title: typeof data.title === "string" ? data.title : `YouTube Video (${rawId})`,
        channel: typeof data.author_name === "string" ? data.author_name : "YouTube",
      });
    } catch {
      res.status(502).json({ error: "Failed to fetch YouTube metadata" });
    }
  });

  router.post("/assistant/chat", async (req, res) => {
    const body = req.body ?? {};
    const mode = body.mode === "brainstorm" || body.mode === "draft" ? body.mode : "qa";
    const timeOfDay = body.timeOfDay === "morning" || body.timeOfDay === "evening" ? body.timeOfDay : "afternoon";
    const localDate =
      typeof body.localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.localDate)
        ? body.localDate
        : new Date().toISOString().slice(0, 10);
    const sanitizedMessages = sanitizeIncomingMessages(body.messages);

    if (sanitizedMessages.length === 0 || sanitizedMessages[sanitizedMessages.length - 1].role !== "user") {
      return res.status(400).json({ error: "กรุณาพิมพ์ข้อความก่อนส่งให้ผู้ช่วย AI ครับ" });
    }

    const latestPrompt = sanitizedMessages[sanitizedMessages.length - 1].parts[0].text;
    beginCharacterTask(req.userId, "mina", summarizeTaskLabel(latestPrompt, "ตอบคำถามช่วยงาน"));

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      const systemInstruction = buildMinaSystemInstruction(
        mode,
        timeOfDay,
        localDate,
        body.tasksContext,
        body.sleepLogsContext
      );

      const payload = await generateContent(
        {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: sanitizedMessages,
          tools: [{ functionDeclarations: [PROPOSE_GOOGLE_TASK_TOOL] }],
        },
        { env }
      );

      const parts = payload?.candidates?.[0]?.content?.parts || [];
      let emittedTaskProposal = false;
      let emittedText = "";

      for (const part of parts) {
        if (part.functionCall && part.functionCall.name === "propose_google_task" && !emittedTaskProposal) {
          const args = part.functionCall.args || {};
          const rawTitle = typeof args.title === "string" ? args.title.trim().slice(0, 160) : "";
          if (rawTitle) {
            const rawNotes = typeof args.notes === "string" && args.notes.trim() ? args.notes.trim().slice(0, 1000) : undefined;
            const rawDue = typeof args.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.dueDate.trim()) ? args.dueDate.trim() : undefined;
            const assignToMina = args.assignToMina === true;
            const rawAssistantId = args.assistantId === "antigravity" || args.assistantId === "ai_studio" ? args.assistantId : "mina";
            const rawScheduledTime =
              typeof args.scheduledTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(args.scheduledTime.trim())
                ? args.scheduledTime.trim()
                : undefined;

            emittedTaskProposal = true;
            res.write(
              `data: ${JSON.stringify({
                type: "task_proposal",
                task: {
                  title: rawTitle,
                  ...(rawNotes ? { notes: rawNotes } : {}),
                  ...(rawDue ? { dueDate: rawDue } : {}),
                  ...(assignToMina ? { assignToMina: true, assistantId: rawAssistantId } : {}),
                  ...(rawScheduledTime ? { scheduledTime: rawScheduledTime } : {}),
                },
              })}\n\n`
            );
          }
        }
        if (typeof part.text === "string" && !part.thought) {
          emittedText += part.text;
        }
      }

      if (emittedText.trim()) {
        res.write(`data: ${JSON.stringify({ type: "chunk", text: emittedText })}\n\n`);
      } else if (emittedTaskProposal) {
        res.write(
          `data: ${JSON.stringify({
            type: "chunk",
            text: "รับทราบครับ! มีน่าเตรียมรายการงานสำหรับ **Google Tasks** ให้เรียบร้อยแล้ว ตรวจสอบและกดยืนยันด้านล่างได้เลย เดี๋ยวมีน่าเดินไปปักหมุดบนกระดานโน้ตให้ทันทีครับ",
          })}\n\n`
        );
      }

      const inputChars =
        systemInstruction.length + sanitizedMessages.reduce((acc, m) => acc + m.parts[0].text.length, 0);
      const usedTokens =
        payload?.usageMetadata?.totalTokenCount ?? estimateFallbackTokens(inputChars, emittedText.length);
      recordTokenUsage(req.userId, usedTokens);

      res.write(`data: ${JSON.stringify({ type: "usage", tokensUsed: usedTokens })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    } catch (err) {
      const classified = classifyGeminiError(err);
      recordCharacterError(req.userId, "mina", classified.code, classified.message);
      res.write(`data: ${JSON.stringify({ type: "error", error: classified.message })}\n\n`);
    } finally {
      endCharacterTask(req.userId, "mina");
      res.end();
    }
  });

  router.post("/assistant/execute-task", async (req, res) => {
    const body = req.body ?? {};
    const assistantId =
      body.assistantId === "antigravity" || body.assistantId === "ai_studio" ? body.assistantId : "mina";
    const rawTitle = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    if (!rawTitle) {
      return res.status(400).json({ error: "กรุณาระบุชื่องานที่ต้องการให้ผู้ช่วย AI ทำครับ" });
    }

    const rawNotes = typeof body.notes === "string" ? body.notes.trim().slice(0, 3000) : "";
    const dueDate = typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate.trim()) ? body.dueDate.trim() : "";
    const scheduledTime = typeof body.scheduledTime === "string" && /^\d{2}:\d{2}$/.test(body.scheduledTime.trim()) ? body.scheduledTime.trim() : "";
    const localDate =
      typeof body.localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.localDate.trim())
        ? body.localDate.trim()
        : new Date().toISOString().slice(0, 10);
    const refineInstruction = typeof body.refineInstruction === "string" ? body.refineInstruction.trim().slice(0, 600) : "";
    const previousSummary = typeof body.previousSummary === "string" ? body.previousSummary.trim().slice(0, 2000) : "";

    const personaHeader =
      assistantId === "antigravity"
        ? 'คุณคือ "Antigravity (AGY)" ผู้ช่วยวิศวกรซอฟต์แวร์และ Localhost Agent ประจำสถานี Dev Station ในบ้าน Cozy Desk'
        : assistantId === "ai_studio"
          ? 'คุณคือ "AI Studio" ผู้ช่วยออกแบบ Prompt, System Instruction และสถาปัตยกรรม AI ในบ้าน Cozy Desk'
          : 'คุณคือ "มีน่า (Mina)" ผู้ช่วย AI ประจำห้องทำงานในบ้าน Cozy Desk';

    const systemInstruction = [
      personaHeader,
      `วันที่ปัจจุบัน: ${localDate}`,
      'ผู้ใช้ได้มอบหมายงานนี้ผ่านกระดาน Google Tasks เพื่อให้คุณลงมือทำและเขียน "สรุปผลงาน" ลงในช่องโน้ตของ Task',
      "- ตอบเป็นภาษาไทยที่สุภาพ กระชับ ชัดเจน อ่านง่าย และนำไปใช้ต่อได้จริงทันที",
      "- ความยาวกระชับพอดีอ่านในโน้ต (ประมาณ 4–14 บรรทัด หรือไม่เกิน 1,800 ตัวอักษร)",
    ].join("\n");

    const userPrompt = [
      `ชื่องาน (Task): ${rawTitle}`,
      dueDate ? `กำหนดวันที่: ${dueDate}${scheduledTime ? ` เวลา ${scheduledTime} น.` : ""}` : "",
      rawNotes ? `คำสั่งและรายละเอียดจากผู้ใช้:\n${rawNotes}` : "",
      refineInstruction && previousSummary
        ? `ผลงานเดิม:\n${previousSummary}\n\nคำสั่งปรับแก้:\n${refineInstruction}`
        : refineInstruction
          ? `คำสั่งเพิ่มเติม:\n${refineInstruction}`
          : "",
    ]
      .filter(Boolean)
      .join("\n");

    beginCharacterTask(req.userId, assistantId, summarizeTaskLabel(rawTitle, "ทำงานตาม Task"));

    try {
      const payload = await generateContent(
        {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        },
        { env }
      );
      const text = (
        payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || ""
      ).trim();
      const summary = (text || "ดำเนินการตามรายการนี้เรียบร้อยแล้ว กรุณาตรวจสอบรายละเอียดได้เลยครับ").slice(0, 2400);
      const usedTokens =
        payload?.usageMetadata?.totalTokenCount ??
        estimateFallbackTokens(systemInstruction.length + userPrompt.length, summary.length);
      recordTokenUsage(req.userId, usedTokens);

      res.json({
        assistantId,
        summary,
        tokensUsed: usedTokens,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      const classified = classifyGeminiError(err);
      recordCharacterError(req.userId, assistantId, classified.code, classified.message);
      res.status(classified.status).json({ error: classified.message });
    } finally {
      endCharacterTask(req.userId, assistantId);
    }
  });

  return router;
}

const router = createCozyDeskRouter();
module.exports = router;
module.exports.createCozyDeskRouter = createCozyDeskRouter;
module.exports.sanitizeSleepRecord = sanitizeSleepRecord;
