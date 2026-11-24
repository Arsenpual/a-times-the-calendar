const path = require("path");
const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  MAX_DAILY_TOKEN_LIMIT,
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
  checkCharacterAllowance,
  buildCharacterStatusMap,
} = require("../lib/cozy-desk-state.js");
const {
  toFiniteNumberOrNull,
  toCleanStringOrNull,
  buildRawSleepInfographic,
  sanitizeSleepRecord,
  SLEEP_EXTRACT_RESPONSE_SCHEMA,
  SLEEP_ANALYZE_RESPONSE_SCHEMA,
  formatSleepLogsContext,
  buildDeterministicSleepSummary,
} = require("../lib/cozy-desk-sleep.js");
const {
  WORKSPACE_ROOT,
  PROPOSE_GOOGLE_TASK_TOOL,
  classifyGeminiError,
  buildAiStudioSystemInstruction,
  listSafeWorkspaceFiles,
  readSafeWorkspaceFile,
  buildAntigravitySystemInstruction,
  buildMinaSystemInstruction,
} = require("../lib/cozy-desk-prompts.js");

const MAX_SLEEP_IMAGE_BASE64_LENGTH = 5_500_000; // ~4 MB decoded image max

function shouldSkipFallbackRetry(err) {
  const classified = classifyGeminiError(err);
  return (
    classified.code === "RESOURCE_EXHAUSTED" ||
    classified.code === "API_KEY_INVALID" ||
    classified.code === "PERMISSION_DENIED"
  );
}

function createCozyDeskRouter({
  generateContent = (...args) => require("../lib/gemini-api.js").generateContent(...args),
  sleepLogsCol = (...args) => require("../lib/firestore-db.js").cozySleepLogsCol(...args),
  env = process.env,
  aiRateLimitMax = 25,
  aiRateLimitWindowMs = 15 * 60 * 1000,
  mutationRateLimitMax = 60,
  mutationRateLimitWindowMs = 15 * 60 * 1000,
} = {}) {
  const router = express.Router();

  const cozyAiLimiter = rateLimit({
    windowMs: aiRateLimitWindowMs,
    limit: aiRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.userId || req.ip || "anonymous",
    validate: false,
    handler: (req, res, _next, options) => {
      const resetAt = req.rateLimit?.resetTime?.getTime?.() || Date.now() + options.windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      res.status(options.statusCode).json({
        code: "RATE_LIMIT_EXCEEDED",
        error: `ส่งคำสั่งถึงผู้ช่วย AI ถี่เกินไป กรุณารออีกประมาณ ${retryAfterSeconds} วินาทีแล้วลองใหม่ครับ`,
        retryAfterSeconds,
        retryAfterAt: new Date(resetAt).toISOString(),
      });
    },
  });

  const cozyMutationLimiter = rateLimit({
    windowMs: mutationRateLimitWindowMs,
    limit: mutationRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.userId || req.ip || "anonymous",
    validate: false,
    handler: (req, res, _next, options) => {
      const resetAt = req.rateLimit?.resetTime?.getTime?.() || Date.now() + options.windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      res.status(options.statusCode).json({
        code: "RATE_LIMIT_EXCEEDED",
        error: "ส่งคำขอแก้ไขข้อมูลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ครับ",
        retryAfterSeconds,
      });
    },
  });

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

  router.post("/sleep/logs", cozyMutationLimiter, async (req, res) => {
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

  router.delete("/sleep/logs/:id", cozyMutationLimiter, async (req, res) => {
    try {
      const targetId = String(req.params.id || "").trim();
      if (!targetId || targetId.length > 100) {
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

  router.post("/sleep/extract", cozyAiLimiter, async (req, res) => {
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
    if (imageBase64.length > MAX_SLEEP_IMAGE_BASE64_LENGTH) {
      return res.status(413).json({
        code: "PAYLOAD_TOO_LARGE",
        error: "ไฟล์รูปภาพมีขนาดใหญ่เกินกำหนด (สูงสุด ~4 MB) กรุณาย่อขนาดภาพก่อนอัปโหลดครับ",
      });
    }

    const allowance = checkCharacterAllowance(req.userId, "mina", env);
    if (!allowance.allowed) {
      if (allowance.retryAfterSeconds) {
        res.set("Retry-After", String(allowance.retryAfterSeconds));
      }
      return res.status(allowance.status).json({
        error: allowance.message,
        code: allowance.code,
        retryAfterSeconds: allowance.retryAfterSeconds,
      });
    }

    const extractPrompt = [
      "คุณคือระบบสกัดข้อมูลดิบการนอน (Sleep Data OCR & Raw Structured JSON Parser) ที่แม่นยำสูง",
      `วันที่อ้างอิงปัจจุบันคือ ${defaultDate} (ใช้ปี ค.ศ. จากวันที่อ้างอิงนี้หากในรูปแสดงเฉพาะวัน/เดือน และใช้ dateLabel เป็นข้อความหัวข้อวันที่สั้นตามรูป เช่น "ศ. 20 พ.ย.")`,
      "กฎเหล็ก — ต้องใช้เฉพาะข้อมูลสถิติการนอนเท่านั้น ตัดส่วนที่ไม่เกี่ยวข้องออกทั้งหมด:",
      "- ห้ามดึงชื่อบัญชีผู้ใช้ (เช่น K96380T), โลโก้/ชื่อแอปด้านล่าง, กราฟแท่ง 7 วัน, และห้ามดึงข้อความจากส่วน \"การวิเคราะห์และคำแนะนำ\" ด้านล่าง (เช่น ระดับความเครียด, อินซูลิน/น้ำตาลในเลือด, คอร์สสมาธิ)",
      "- ดึงเฉพาะตัวเลขและข้อความสถิติการนอนจริง: คะแนนการนอน, เปอร์เซ็นต์ดีกว่าผู้ใช้, จำนวนดาว (starRating เช่น 4.5), เวลานอน (bedtime HH:mm), เวลาตื่น (wakeTime HH:mm), เวลานอนรวม, ระยะหลับลึก/หลับตื้น/REM (นาที, ข้อความ, %, สถานะ, เกณฑ์อ้างอิง), ความต่อเนื่องของการนอนหลับลึก, คุณภาพการหายใจ และจำนวนครั้งที่ตื่นนอน",
      "- แปลงระยะเวลาแต่ละช่วงให้เป็นจำนวนนาทีที่ถูกต้อง",
      "- สำหรับฟิลด์ตัวเลขที่ไม่มีในรูปให้ใส่ -1 และข้อความที่ไม่มีให้ใส่ \"\"",
    ].join("\n");

    beginCharacterTask(req.userId, "mina", "สกัดข้อมูลการนอนจากภาพ");

    try {
      let payload;
      try {
        payload = await generateContent(
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
      } catch (primaryErr) {
        if (shouldSkipFallbackRetry(primaryErr)) {
          throw primaryErr;
        }
        console.warn("[cozy-desk] /sleep/extract primary attempt failed, retrying without strict schema:", primaryErr?.message || primaryErr);
        const currentModel = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
        const fallbackModel =
          currentModel === "gemini-3.5-flash-lite" ? "gemini-3.8-flash" : "gemini-3.5-flash-lite";
        const fallbackPrompt = [
          extractPrompt,
          "",
          "ตอบกลับเป็น JSON object เท่านั้น (ห้ามใส่ markdown ```json) โดยมีคีย์:",
          "date (YYYY-MM-DD), dateLabel, sourceApp, sleepScore, percentileBeat, starRating, bedtime (HH:mm), wakeTime (HH:mm), totalSleepMinutes, totalSleepText, totalSleepStatus, totalSleepReference, deepMinutes, deepText, deepPercent, deepStatus, deepReference, lightMinutes, lightText, lightPercent, lightStatus, lightReference, remMinutes, remText, remPercent, remStatus, remReference, deepSleepContinuityScore, deepSleepContinuityStatus, awakeCount, awakeStatus, breathingQualityScore, breathingQualityStatus",
        ].join("\n");
        payload = await generateContent(
          {
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType, data: imageBase64 } },
                  { text: fallbackPrompt },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          },
          { env: fallbackModel ? { ...env, GEMINI_MODEL: fallbackModel } : env }
        );
      }

      const rawText = (
        payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || ""
      )
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const parsed = JSON.parse(rawText);
      const numOrNull = (v) => {
        const n = toFiniteNumberOrNull(v);
        return n !== null && n >= 0 ? n : null;
      };
      const extractedDate =
        typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date.trim())
          ? parsed.date.trim()
          : defaultDate;

      const baseExtracted = {
        id: `sleep_${extractedDate}`,
        date: extractedDate,
        dateLabel: toCleanStringOrNull(parsed.dateLabel, 60) ?? extractedDate,
        sourceApp: toCleanStringOrNull(parsed.sourceApp, 80) ?? "Huawei Health",
        userLabel: null,
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
        previousDayStressScore: null,
        appInsights: [],
        appRecommendation: null,
      };
      const starHint = numOrNull(parsed.starRating);
      baseExtracted.rawInfographic = buildRawSleepInfographic(baseExtracted, starHint);

      const record = sanitizeSleepRecord(baseExtracted, defaultDate);

      const usedTokens =
        payload?.usageMetadata?.totalTokenCount ??
        estimateFallbackTokens(extractPrompt.length + 1200, rawText.length);
      recordTokenUsage(req.userId, usedTokens);

      res.json({ ok: true, record, model: env.GEMINI_MODEL || PRIMARY_MODEL });
    } catch (err) {
      console.error("[cozy-desk] /sleep/extract failed:", err);
      const classified = classifyGeminiError(err);
      recordCharacterError(req.userId, "mina", classified.code, classified.message);
      const detail = err instanceof Error ? err.message.slice(0, 220) : undefined;
      res.status(classified.status).json({ error: classified.message, code: classified.code, detail });
    } finally {
      endCharacterTask(req.userId, "mina");
    }
  });

  router.post("/sleep/analyze", cozyAiLimiter, async (req, res) => {
    const body = req.body ?? {};
    if (!body.targetRecord || typeof body.targetRecord !== "object") {
      return res.status(400).json({ error: "กรุณาเลือกข้อมูลการนอนที่ต้องการวิเคราะห์" });
    }

    const allowance = checkCharacterAllowance(req.userId, "mina", env);
    if (!allowance.allowed) {
      if (allowance.retryAfterSeconds) {
        res.set("Retry-After", String(allowance.retryAfterSeconds));
      }
      return res.status(allowance.status).json({
        error: allowance.message,
        code: allowance.code,
        retryAfterSeconds: allowance.retryAfterSeconds,
      });
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

    beginCharacterTask(req.userId, "mina", "วิเคราะห์ข้อมูลการนอน");

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
      console.error("[cozy-desk] /sleep/analyze failed:", err);
      const classified = classifyGeminiError(err);
      recordCharacterError(req.userId, "mina", classified.code, classified.message);
      const detail = err instanceof Error ? err.message.slice(0, 220) : undefined;
      res.status(classified.status).json({ error: classified.message, code: classified.code, detail });
    } finally {
      endCharacterTask(req.userId, "mina");
    }
  });

  router.get("/characters/status", (req, res) => {
    res.json({
      ok: true,
      characters: buildCharacterStatusMap(req.userId, env),
      updatedAt: Date.now(),
    });
  });

  router.post("/characters/quota-config", cozyMutationLimiter, (req, res) => {
    ensureQuotaWindowFresh(req.userId);
    const { quotaState, characterRuntime } = getUserState(req.userId);
    const body = req.body ?? {};
    if (typeof body.dailyLimit === "number" && Number.isFinite(body.dailyLimit)) {
      quotaState.tokensLimit = Math.max(10_000, Math.min(MAX_DAILY_TOKEN_LIMIT, Math.round(body.dailyLimit)));
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

  router.post("/aistudio/chat", cozyAiLimiter, async (req, res) => {
    const body = req.body ?? {};
    const mode = body.mode === "build" || body.mode === "schema" ? body.mode : "prompt";
    const customSysInst = typeof body.systemInstruction === "string" ? body.systemInstruction : "";
    const sanitizedMessages = sanitizeIncomingMessages(body.messages);

    if (sanitizedMessages.length === 0 || sanitizedMessages[sanitizedMessages.length - 1].role !== "user") {
      return res.status(400).json({ error: "กรุณาพิมพ์ Prompt ก่อนส่งให้ Google AI Studio ครับ" });
    }

    const allowance = checkCharacterAllowance(req.userId, "ai_studio", env);
    if (!allowance.allowed) {
      if (allowance.retryAfterSeconds) {
        res.set("Retry-After", String(allowance.retryAfterSeconds));
      }
      return res.status(allowance.status).json({
        error: allowance.message,
        code: allowance.code,
        retryAfterSeconds: allowance.retryAfterSeconds,
      });
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

  router.post("/antigravity/chat", cozyAiLimiter, async (req, res) => {
    const body = req.body ?? {};
    const mode = body.mode === "workspace" || body.mode === "arch" ? body.mode : "code";
    const requestedFiles = Array.isArray(body.focusFiles)
      ? body.focusFiles.filter((f) => typeof f === "string")
      : [];
    const sanitizedMessages = sanitizeIncomingMessages(body.messages);

    if (sanitizedMessages.length === 0 || sanitizedMessages[sanitizedMessages.length - 1].role !== "user") {
      return res.status(400).json({ error: "กรุณาพิมพ์คำสั่งหรือคำถามก่อนส่งให้ Antigravity ครับ" });
    }

    const allowance = checkCharacterAllowance(req.userId, "antigravity", env);
    if (!allowance.allowed) {
      if (allowance.retryAfterSeconds) {
        res.set("Retry-After", String(allowance.retryAfterSeconds));
      }
      return res.status(allowance.status).json({
        error: allowance.message,
        code: allowance.code,
        retryAfterSeconds: allowance.retryAfterSeconds,
      });
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

  router.post("/assistant/chat", cozyAiLimiter, async (req, res) => {
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

    const allowance = checkCharacterAllowance(req.userId, "mina", env);
    if (!allowance.allowed) {
      if (allowance.retryAfterSeconds) {
        res.set("Retry-After", String(allowance.retryAfterSeconds));
      }
      return res.status(allowance.status).json({
        error: allowance.message,
        code: allowance.code,
        retryAfterSeconds: allowance.retryAfterSeconds,
      });
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

  router.post("/assistant/execute-task", cozyAiLimiter, async (req, res) => {
    const body = req.body ?? {};
    const assistantId =
      body.assistantId === "antigravity" || body.assistantId === "ai_studio" ? body.assistantId : "mina";
    const rawTitle = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    if (!rawTitle) {
      return res.status(400).json({ error: "กรุณาระบุชื่องานที่ต้องการให้ผู้ช่วย AI ทำครับ" });
    }

    const isSleepSummaryTask = body.taskType === "sleep_summary" || body.taskType === "sleep_analysis";
    const hasDeterministicSleepFallback =
      isSleepSummaryTask && Array.isArray(body.sleepLogsContext) && body.sleepLogsContext.length > 0;

    const allowance = checkCharacterAllowance(req.userId, assistantId, env);
    if (!allowance.allowed && !hasDeterministicSleepFallback) {
      if (allowance.retryAfterSeconds) {
        res.set("Retry-After", String(allowance.retryAfterSeconds));
      }
      return res.status(allowance.status).json({
        error: allowance.message,
        code: allowance.code,
        retryAfterSeconds: allowance.retryAfterSeconds,
      });
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

    const sleepContextBlock =
      Array.isArray(body.sleepLogsContext) && body.sleepLogsContext.length > 0
        ? formatSleepLogsContext(body.sleepLogsContext)
        : "";

    const systemInstruction = [
      personaHeader,
      `วันที่ปัจจุบัน: ${localDate}`,
      isSleepSummaryTask
        ? [
            "ผู้ใช้ส่งข้อมูลบันทึกการนอนประจำวัน (.json) ทั้งหมดที่เก็บสะสมไว้มาให้คุณสรุปภาพรวมและส่งงานทางแชท",
            "กฎเหล็ก — ห้ามมีข้อมูลที่ไม่เกี่ยวข้องกับการนอนเด็ดขาด:",
            "- ห้ามกล่าวถึงความเครียด (แม้แต่คำว่า 'ค่าความเครียด: ไม่พบข้อมูล' ก็ห้ามใส่), ชื่อแอป (เช่น Huawei Health), ชื่อบัญชี, น้ำตาลในเลือด, อินซูลิน หรือบทวิเคราะห์/คำแนะนำสุขภาพ",
            "- ใช้เทมเพลต Markdown ต่อไปนี้ในการตอบเสมอ:",
            "สวัสดีค่ะคุณผู้ใช้ มีน่า (Mina) จัดเตรียมสรุปภาพรวมข้อมูลการนอนมาให้แล้วนะคะ ...",
            "---",
            "### 📊 ภาพรวมสถิติการนอนทั้งหมด",
            "* **จำนวนวันที่บันทึก:** ... วัน",
            "* **ช่วงวันที่:** ...",
            "* **คะแนนการนอน (Sleep Score):** ค่าเฉลี่ย / ต่ำสุด / สูงสุด",
            "* **ระยะเวลานอนรวม:** ค่าเฉลี่ย / ต่ำสุด / สูงสุด",
            "* **ช่วงเวลาเข้านอน – ตื่นนอน (โดยรวม):** ...",
            "* **สัดส่วนและระยะเวลาเฉลี่ยของคุณภาพการนอน:** หลับลึก (Deep Sleep), หลับตื้น (Light Sleep), REM Sleep",
            "* **ค่าตัวชี้วัดเสริม (ภาพรวม):** ความต่อเนื่องในการหลับลึก, คะแนนการหายใจ, จำนวนครั้งที่ตื่น",
            "---",
            "### 📅 รายการสรุปรายวัน",
            "**1. วัน...ที่ ...** (คะแนนการนอน, ระยะเวลานอน, ช่วงเวลาเข้านอน–ตื่นนอน, โครงสร้างการนอน 3 ระยะ, ตัวชี้วัดอื่น ๆ: ต่อเนื่องหลับลึก | คะแนนหายใจ | ตื่น ... ครั้ง)",
          ].join("\n")
        : 'ผู้ใช้ได้มอบหมายงานนี้ผ่านกระดาน Google Tasks เพื่อให้คุณลงมือทำและเขียน "สรุปผลงาน" ลงในช่องโน้ตของ Task',
      "- ตอบเป็นภาษาไทยที่สุภาพ กระชับ ชัดเจน อ่านง่าย และนำไปใช้ต่อได้จริงทันที",
      isSleepSummaryTask
        ? "- ความยาวไม่เกิน 3,400 ตัวอักษร และยึดตามตัวเลขจริงที่บันทึกไว้เท่านั้น"
        : "- ความยาวกระชับพอดีอ่านในโน้ต (ประมาณ 4–14 บรรทัด หรือไม่เกิน 1,800 ตัวอักษร)",
      sleepContextBlock,
    ]
      .filter(Boolean)
      .join("\n\n");

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
      let payload = null;
      let fallbackSummary = null;
      if (!allowance.allowed && hasDeterministicSleepFallback) {
        fallbackSummary = buildDeterministicSleepSummary(body.sleepLogsContext);
      } else {
        try {
          payload = await generateContent(
            {
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            },
            { env }
          );
        } catch (primaryErr) {
          if (shouldSkipFallbackRetry(primaryErr)) {
            if (hasDeterministicSleepFallback) {
              fallbackSummary = buildDeterministicSleepSummary(body.sleepLogsContext);
            } else {
              throw primaryErr;
            }
          } else {
            console.warn(
              "[cozy-desk] /assistant/execute-task primary attempt failed, retrying with fallback model:",
              primaryErr?.message || primaryErr
            );
            const currentModel = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
            const fallbackModel =
              currentModel === "gemini-3.5-flash-lite" ? "gemini-3.8-flash" : "gemini-3.5-flash-lite";
            try {
              payload = await generateContent(
                {
                  systemInstruction: { parts: [{ text: systemInstruction }] },
                  contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                },
                { env: { ...env, GEMINI_MODEL: fallbackModel } }
              );
            } catch (secondaryErr) {
              if (hasDeterministicSleepFallback) {
                console.warn(
                  "[cozy-desk] /assistant/execute-task using deterministic sleep summary fallback:",
                  secondaryErr?.message || secondaryErr
                );
                fallbackSummary = buildDeterministicSleepSummary(body.sleepLogsContext);
              } else {
                throw secondaryErr;
              }
            }
          }
        }
      }
      const text =
        fallbackSummary ??
        (payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "").trim();
      const summary = (text || "ดำเนินการตามรายการนี้เรียบร้อยแล้ว กรุณาตรวจสอบรายละเอียดได้เลยครับ").slice(
        0,
        isSleepSummaryTask ? 3600 : 2400
      );
      const usedTokens =
        fallbackSummary != null
          ? 0
          : payload?.usageMetadata?.totalTokenCount ??
            estimateFallbackTokens(systemInstruction.length + userPrompt.length, summary.length);
      if (usedTokens > 0) {
        recordTokenUsage(req.userId, usedTokens);
      }

      res.json({
        assistantId,
        summary,
        tokensUsed: usedTokens,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[cozy-desk] /assistant/execute-task failed:", err);
      const classified = classifyGeminiError(err);
      const detail = err instanceof Error ? err.message.slice(0, 220) : undefined;
      recordCharacterError(req.userId, assistantId, classified.code, classified.message);
      res.status(classified.status).json({ error: classified.message, code: classified.code, detail });
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
