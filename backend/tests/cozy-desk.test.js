const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createCozyDeskRouter } = require("../routes/cozy-desk.js");

function createTestServer({
  generateContent,
  generateContentStream,
  sleepLogsStore = new Map(),
  env = { GEMINI_API_KEY: "test-key" },
  aiRateLimitMax = 25,
  mutationRateLimitMax = 60,
} = {}) {
  const app = express();
  app.use(express.json({ limit: "15mb" }));
  app.use((req, _res, next) => {
    req.userId = req.headers["x-test-user"] || "user-1";
    next();
  });

  const sleepLogsCol = (userId) => {
    if (!sleepLogsStore.has(userId)) sleepLogsStore.set(userId, new Map());
    const userMap = sleepLogsStore.get(userId);
    return {
      async get() {
        return {
          docs: Array.from(userMap.entries()).map(([id, data]) => ({
            id,
            data: () => data,
          })),
        };
      },
      doc(id) {
        return {
          async set(data) {
            userMap.set(id, { ...(userMap.get(id) || {}), ...data });
          },
          async delete() {
            userMap.delete(id);
          },
        };
      },
    };
  };

  app.use(
    "/api/cozy-desk",
    createCozyDeskRouter({
      generateContent,
      generateContentStream,
      sleepLogsCol,
      env,
      aiRateLimitMax,
      mutationRateLimitMax,
    })
  );

  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

test("Cozy Desk sleep logs CRUD isolates data per userId", async () => {
  const srv = await createTestServer({
    generateContent: async () => ({}),
  });
  try {
    const saveRes = await fetch(`${srv.baseUrl}/api/cozy-desk/sleep/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "alice" },
      body: JSON.stringify({
        record: {
          id: "sleep_2026-11-23",
          date: "2026-11-23",
          sourceApp: "Huawei Health",
          sleepScore: 88,
          totalSleepMinutes: 460,
          stages: {
            deep: { minutes: 120, percent: 26 },
            light: { minutes: 240, percent: 52 },
            rem: { minutes: 100, percent: 22 },
          },
        },
      }),
    });
    assert.equal(saveRes.status, 200);
    const saved = await saveRes.json();
    assert.equal(saved.ok, true);
    assert.equal(saved.logs.length, 1);
    assert.equal(saved.logs[0].sleepScore, 88);

    // Different user sees empty logs
    const bobRes = await fetch(`${srv.baseUrl}/api/cozy-desk/sleep/logs`, {
      headers: { "x-test-user": "bob" },
    });
    const bobData = await bobRes.json();
    assert.equal(bobData.logs.length, 0);

    // Delete log for alice
    const delRes = await fetch(`${srv.baseUrl}/api/cozy-desk/sleep/logs/sleep_2026-11-23`, {
      method: "DELETE",
      headers: { "x-test-user": "alice" },
    });
    const delData = await delRes.json();
    assert.equal(delData.logs.length, 0);

    // Batch import multiple logs in a single request
    const batchRes = await fetch(`${srv.baseUrl}/api/cozy-desk/sleep/logs/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "alice" },
      body: JSON.stringify({
        records: [
          {
            id: "sleep_2026-11-21",
            date: "2026-11-21",
            sourceApp: "Huawei Health",
            sleepScore: 81,
            totalSleepMinutes: 420,
          },
          {
            id: "sleep_2026-11-22",
            date: "2026-11-22",
            sourceApp: "Huawei Health",
            sleepScore: 85,
            totalSleepMinutes: 450,
          },
        ],
      }),
    });
    assert.equal(batchRes.status, 200);
    const batchData = await batchRes.json();
    assert.equal(batchData.ok, true);
    assert.equal(batchData.importedCount, 2);
    assert.equal(batchData.logs.length, 2);
  } finally {
    await srv.close();
  }
});

test("Cozy Desk character status and SSE assistant chat work with Gemini transport", async () => {
  const srv = await createTestServer({
    generateContent: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: "propose_google_task",
                  args: {
                    title: "ส่งรายงานประจำสัปดาห์",
                    dueDate: "2026-11-24",
                    assignToMina: true,
                    assistantId: "mina",
                    scheduledTime: "09:00",
                  },
                },
              },
              { text: "เตรียมรายการงานให้แล้วครับ" },
            ],
          },
        },
      ],
      usageMetadata: { totalTokenCount: 150 },
    }),
  });

  try {
    const statusRes = await fetch(`${srv.baseUrl}/api/cozy-desk/characters/status`, {
      headers: { "x-test-user": "alice" },
    });
    const statusData = await statusRes.json();
    assert.equal(statusData.ok, true);
    assert.equal(statusData.characters.mina.status, "ready");

    const chatRes = await fetch(`${srv.baseUrl}/api/cozy-desk/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "alice" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "มีน่า ตั้ง task ส่งรายงานพรุ่งนี้ 09:00" }],
        mode: "qa",
        timeOfDay: "morning",
        localDate: "2026-11-23",
      }),
    });
    assert.equal(chatRes.status, 200);
    const sseText = await chatRes.text();
    assert.match(sseText, /"type":"task_proposal"/);
    assert.match(sseText, /ส่งรายงานประจำสัปดาห์/);
    assert.match(sseText, /"type":"chunk"/);
    assert.match(sseText, /"type":"done"/);
  } finally {
    await srv.close();
  }
});

test("Cozy Desk enforces per-user AI rate limit, daily token quota, and skips fallback retry on 429", async () => {
  let callCount = 0;
  const srv = await createTestServer({
    aiRateLimitMax: 3,
    generateContent: async () => {
      callCount += 1;
      if (callCount === 2) {
        const err = new Error("Resource has been exhausted (e.g. check quota).");
        err.status = 429;
        throw err;
      }
      return {
        candidates: [{ content: { parts: [{ text: "ตอบกลับสำเร็จ" }] } }],
        usageMetadata: { totalTokenCount: 15_000 },
      };
    },
  });

  try {
    // Set daily limit to 10,000 tokens for quota-user
    await fetch(`${srv.baseUrl}/api/cozy-desk/characters/quota-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "quota-user" },
      body: JSON.stringify({ dailyLimit: 10_000, resetUsage: true }),
    });

    // 1st call succeeds and consumes 15,000 tokens (exceeding the 10,000 limit)
    const firstRes = await fetch(`${srv.baseUrl}/api/cozy-desk/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "quota-user" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "สวัสดี" }],
      }),
    });
    assert.equal(firstRes.status, 200);
    await firstRes.text();

    // 2nd call by same user is blocked immediately with 429 QUOTA_EXHAUSTED before hitting Gemini
    const quotaBlockedRes = await fetch(`${srv.baseUrl}/api/cozy-desk/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "quota-user" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "ถามต่อ" }],
      }),
    });
    assert.equal(quotaBlockedRes.status, 429);
    const quotaBlockedBody = await quotaBlockedRes.json();
    assert.equal(quotaBlockedBody.code, "QUOTA_EXHAUSTED");
    assert.equal(callCount, 1);

    // Another user calling /assistant/execute-task when Gemini returns 429 does NOT trigger a 2nd fallback call
    const errTaskRes = await fetch(`${srv.baseUrl}/api/cozy-desk/assistant/execute-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "cooldown-user" },
      body: JSON.stringify({
        assistantId: "mina",
        title: "สรุปงาน",
      }),
    });
    assert.equal(errTaskRes.status, 429);
    assert.equal(callCount, 2); // Only 1 Gemini invocation made (no redundant retry)

    // Subsequent call for cooldown-user while Mina is in 429 cooldown is rejected before calling Gemini
    const cooldownBlockedRes = await fetch(`${srv.baseUrl}/api/cozy-desk/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "cooldown-user" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "ลองใหม่ทันที" }],
      }),
    });
    assert.equal(cooldownBlockedRes.status, 429);
    const cooldownBody = await cooldownBlockedRes.json();
    assert.equal(cooldownBody.code, "RESOURCE_EXHAUSTED");
    assert.equal(callCount, 2);

    // Rate limit user hits the 3-request window limit on the 4th request
    for (let i = 0; i < 3; i += 1) {
      const r = await fetch(`${srv.baseUrl}/api/cozy-desk/aistudio/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-user": "spam-user" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `prompt ${i}` }],
        }),
      });
      assert.equal(r.status, 200);
      await r.text();
    }
    const fourthRes = await fetch(`${srv.baseUrl}/api/cozy-desk/aistudio/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "spam-user" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "prompt 4" }],
      }),
    });
    assert.equal(fourthRes.status, 429);
    const fourthBody = await fourthRes.json();
    assert.equal(fourthBody.code, "RATE_LIMIT_EXCEEDED");
  } finally {
    await srv.close();
  }
});

test("Cozy Desk Google AI Studio chat streams chunks and forwards model and thinkingLevel", async () => {
  let capturedCall = null;
  const srv = await createTestServer({
    generateContentStream: async (params) => {
      capturedCall = params;
      return (async function* () {
        yield { text: "สวัสดีจาก " };
        yield { text: "Google AI Studio", usageMetadata: { totalTokenCount: 84 } };
      })();
    },
  });

  try {
    const res = await fetch(`${srv.baseUrl}/api/cozy-desk/aistudio/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "studio-user" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "ช่วยออกแบบ prompt ให้หน่อย" }],
        mode: "prompt",
        model: "gemini-4-hydrogen",
        thinkingLevel: "HIGH",
        systemInstruction: "ตอบสั้นกระชับ",
      }),
    });
    assert.equal(res.status, 200);
    const sseText = await res.text();
    assert.equal(capturedCall.model, "gemini-4-hydrogen");
    assert.equal(capturedCall.thinkingLevel, "HIGH");
    assert.match(sseText, /"type":"chunk","text":"สวัสดีจาก "/);
    assert.match(sseText, /"type":"chunk","text":"Google AI Studio"/);
    assert.match(sseText, /"type":"usage","tokensUsed":84/);
    assert.match(sseText, /"type":"done"/);
  } finally {
    await srv.close();
  }
});

test("Cozy Desk sleep extraction uses Huawei Health as canonical standard and sets missing other-app fields to null", async () => {
  const { resolveSleepStartDate, sanitizeSleepRecord, countStandardHuaweiFields } = require("../lib/cozy-desk-sleep.js");
  assert.equal(resolveSleepStartDate("2026-03-01", "23:40", "07:10"), "2026-02-28");
  assert.equal(resolveSleepStartDate("2026-11-20", "06:43", "14:47"), "2026-11-20");

  // 1. Full Huawei Health canonical screenshot -> 10/10 standard fields + all sub-metric reference ranges
  const srvHuawei = await createTestServer({
    generateContent: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  isSleepScreenshot: true,
                  detectedLanguage: "th",
                  confidence: "high",
                  scannableSections: ["คะแนนการนอน", "ช่วงเวลานอน", "สเตจการนอน 3 ช่วง", "ตัวชี้วัดย่อย 3 รายการ"],
                  skippedSections: ["ชื่อบัญชีผู้ใช้ (K96380T)", "การวิเคราะห์และคำแนะนำ", "ความเครียดเมื่อวาน"],
                  date: "2026-11-20",
                  dateLabel: "ศ. 20 พ.ย.",
                  sourceApp: "Huawei Health",
                  sleepScore: 89,
                  percentileBeat: 99,
                  starRating: 4.5,
                  bedtime: "06:43",
                  wakeTime: "14:47",
                  totalSleepMinutes: 466,
                  totalSleepText: "7 ชั่วโมง 46 นาที",
                  totalSleepStatus: "ปกติ",
                  totalSleepReference: "ข้อมูลอ้างอิง: 6–10 ชม.",
                  deepMinutes: 127,
                  deepText: "2 ชั่วโมง 7 นาที",
                  deepPercent: 27,
                  deepStatus: "ปกติ",
                  deepReference: "ข้อมูลอ้างอิง: 20–60%",
                  lightMinutes: 239,
                  lightText: "3 ชั่วโมง 59 นาที",
                  lightPercent: 51,
                  lightStatus: "ปกติ",
                  lightReference: "ข้อมูลอ้างอิง: <55%",
                  remMinutes: 100,
                  remText: "1 ชั่วโมง 40 นาที",
                  remPercent: 22,
                  remStatus: "ปกติ",
                  remReference: "ข้อมูลอ้างอิง: 10–30%",
                  deepSleepContinuityScore: 85,
                  deepSleepContinuityStatus: "ปกติ",
                  deepSleepContinuityReference: "ข้อมูลอ้างอิง: 70–100 คะแนน",
                  awakeCount: 1,
                  awakeStatus: "ปกติ",
                  awakeReference: "ข้อมูลอ้างอิง: 0–1 ครั้ง",
                  breathingQualityScore: 86,
                  breathingQualityStatus: "ปกติ",
                  breathingQualityReference: "ข้อมูลอ้างอิง: 70–100 คะแนน",
                }),
              },
            ],
          },
        },
      ],
      usageMetadata: { totalTokenCount: 240 },
    }),
  });

  try {
    const res = await fetch(`${srvHuawei.baseUrl}/api/cozy-desk/sleep/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "huawei-user" },
      body: JSON.stringify({
        imageBase64: Buffer.alloc(120, 0xaa).toString("base64"),
        mimeType: "image/jpeg",
        defaultDate: "2026-11-20",
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.record.sourceApp, "Huawei Health");
    assert.equal(countStandardHuaweiFields(data.record), 10);
    assert.equal(data.record.rawInfographic.schema_version, "2.1-huawei-standard");
    assert.equal(data.record.rawInfographic.scan_metadata.standard, "huawei_health_v1");
    assert.equal(data.record.rawInfographic.scan_metadata.standard_fields_found, 10);
    assert.equal(data.record.rawInfographic.sleep_score_raw.star_rating_raw.derived_numeric_rating, 4.5);
    assert.equal(data.record.rawInfographic.sub_metrics_raw.deep_sleep_continuity.reference_range.min_value, 70);
    assert.equal(data.record.rawInfographic.sub_metrics_raw.awakenings_count.reference_range.max_value, 1);
    assert.equal(data.record.rawInfographic.sub_metrics_raw.breathing_quality.reference_range.max_value, 100);
  } finally {
    await srvHuawei.close();
  }

  // 2. Other app (Apple Health): missing Huawei fields -> strict null, non-Huawei metrics NOT stored in JSON
  const srvApple = await createTestServer({
    generateContent: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  isSleepScreenshot: true,
                  detectedLanguage: "en",
                  confidence: "high",
                  scannableSections: ["Sleep Duration", "Sleep Stages (Deep, Core, REM)"],
                  skippedSections: ["HRV (นอกมาตรฐาน Huawei Health)", "Blood Oxygen / SpO2 (นอกมาตรฐาน Huawei Health)", "Awake Duration (นอกมาตรฐาน Huawei Health)"],
                  date: "2026-11-25",
                  dateLabel: "Wed 25 Nov",
                  sourceApp: "Apple Health",
                  sleepScore: -1,
                  percentileBeat: -1,
                  starRating: -1,
                  bedtime: "23:30",
                  wakeTime: "07:00",
                  totalSleepMinutes: 435,
                  totalSleepText: "7h 15m",
                  totalSleepStatus: "",
                  totalSleepReference: "",
                  deepMinutes: 95,
                  deepText: "1h 35m",
                  deepPercent: 22,
                  deepStatus: "",
                  deepReference: "",
                  lightMinutes: 245,
                  lightText: "4h 05m",
                  lightPercent: 56,
                  lightStatus: "",
                  lightReference: "",
                  remMinutes: -1,
                  remText: "",
                  remPercent: -1,
                  remStatus: "",
                  remReference: "",
                  deepSleepContinuityScore: -1,
                  deepSleepContinuityStatus: "",
                  deepSleepContinuityReference: "",
                  awakeCount: -1,
                  awakeStatus: "",
                  awakeReference: "",
                  breathingQualityScore: -1,
                  breathingQualityStatus: "",
                  breathingQualityReference: "",
                }),
              },
            ],
          },
        },
      ],
      usageMetadata: { totalTokenCount: 210 },
    }),
  });

  try {
    const res = await fetch(`${srvApple.baseUrl}/api/cozy-desk/sleep/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "apple-user" },
      body: JSON.stringify({
        imageBase64: Buffer.alloc(120, 0xab).toString("base64"),
        mimeType: "image/jpeg",
        defaultDate: "2026-11-25",
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.record.sourceApp, "Apple Health");
    assert.equal(data.record.sleepScore, null);
    assert.equal(data.record.percentileBeat, null);
    assert.equal(data.record.stages.rem.minutes, null);
    assert.equal(data.record.deepSleepContinuityScore, null);
    assert.equal(data.record.breathingQualityScore, null);
    assert.equal(data.record.awakeCount, null);
    assert.equal(data.record.rawInfographic.sleep_window.sleep_start_date, "2026-11-24");
    assert.equal(data.record.rawInfographic.sleep_score_raw.star_rating_raw.derived_numeric_rating, null);
    assert.equal(data.record.rawInfographic.sleep_stages_raw.deep_sleep.reference_range, null);
    assert.equal(data.record.rawInfographic.sleep_stages_raw.rem_sleep.duration_total_minutes, null);
    assert.equal("extracted_numeric_metrics" in data.record.rawInfographic, false);
    assert.equal("awake_time" in data.record.rawInfographic.sleep_stages_raw, false);
    assert.equal(data.record.scanSummary.standardFieldsFound, 4);
    assert.equal(data.record.scanSummary.skippedSections.length, 3);
  } finally {
    await srvApple.close();
  }

  // Sanitizing a record with legacy non-standard fields strips them from output
  const sanitized = sanitizeSleepRecord({
    date: "2026-03-01",
    sourceApp: "Garmin Connect",
    sleepScore: 86,
    bedtime: "23:15",
    wakeTime: "06:45",
    totalSleepMinutes: 430,
    awakeMinutes: 20,
    detectedMetrics: [{ key: "hrv", label: "HRV", value: 68, unit: "ms" }],
  });
  assert.equal("detectedMetrics" in sanitized, false);
  assert.equal("awakeMinutes" in sanitized, false);
  assert.equal(sanitized.stages.deep.minutes, null);
});

test("Cozy Desk sleep extraction retries fallback on malformed JSON and returns 422 for non-sleep images", async () => {
  let extractCalls = 0;
  const srvFallback = await createTestServer({
    generateContent: async () => {
      extractCalls += 1;
      if (extractCalls === 1) {
        return {
          candidates: [{ content: { parts: [{ text: "{broken json payload" }] } }],
          usageMetadata: { totalTokenCount: 50 },
        };
      }
      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "```json\n" + JSON.stringify({
                    isSleepScreenshot: true,
                    detectedLanguage: "en",
                    confidence: "medium",
                    scannableSections: ["Sleep Score", "Duration"],
                    skippedSections: ["Skin Temp (นอกมาตรฐาน Huawei Health)"],
                    sourceApp: "Samsung Health",
                    sleepScore: 84,
                    totalSleepMinutes: 450,
                  }) + "\n```",
                },
              ],
            },
          },
        ],
        usageMetadata: { totalTokenCount: 110 },
      };
    },
  });

  try {
    const res = await fetch(`${srvFallback.baseUrl}/api/cozy-desk/sleep/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "retry-user" },
      body: JSON.stringify({
        imageBase64: Buffer.alloc(120, 0xbb).toString("base64"),
        mimeType: "image/png",
        defaultDate: "2026-11-25",
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(extractCalls, 2);
    const data = await res.json();
    assert.equal(data.record.sourceApp, "Samsung Health");
    assert.equal(data.record.sleepScore, 84);
  } finally {
    await srvFallback.close();
  }

  const srvNonSleep = await createTestServer({
    generateContent: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  isSleepScreenshot: false,
                  detectedLanguage: "unknown",
                  confidence: "low",
                  scannableSections: [],
                  skippedSections: ["Non-sleep photo"],
                  sourceApp: "Unknown",
                }),
              },
            ],
          },
        },
      ],
      usageMetadata: { totalTokenCount: 40 },
    }),
  });

  try {
    const res = await fetch(`${srvNonSleep.baseUrl}/api/cozy-desk/sleep/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "nonsleep-user" },
      body: JSON.stringify({
        imageBase64: Buffer.alloc(120, 0xcc).toString("base64"),
        mimeType: "image/jpeg",
        defaultDate: "2026-11-25",
      }),
    });
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, "NOT_A_SLEEP_IMAGE");
  } finally {
    await srvNonSleep.close();
  }
});

test("Cozy Desk /sleep/extract handles real Huawei Health prototype (sporthealth-1) with awakeCount=0 and ต่ำ continuity", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const samplePath = path.resolve(
    __dirname,
    "../../frontend/public/cozy-desk/aistudio/sporthealth-1-20261123-182816_1fde3a7c.jpg"
  );
  const sampleBase64 = fs.readFileSync(samplePath).toString("base64");

  const srv = await createTestServer({
    generateContent: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  isSleepScreenshot: true,
                  detectedLanguage: "th",
                  confidence: "high",
                  scannableSections: [
                    "คะแนนการนอน (84 คะแนน)",
                    "ช่วงเวลานอน (11:02–18:06)",
                    "การนอนกลางคืน (7 ชั่วโมง 4 นาที)",
                    "สเตจการนอน 3 ช่วง (หลับลึก 34%, หลับตื้น 41%, REM 25%)",
                    "ตัวชี้วัดย่อย 3 รายการ (ความต่อเนื่อง 67 ต่ำ, ตื่น 0 ครั้ง, หายใจ 88)",
                  ],
                  skippedSections: [
                    "ชื่อบัญชีผู้ใช้ (K96380T)",
                    "กราฟช่วงการหลับ (Hypnogram)",
                    "กราฟแท่งเปรียบเทียบย้อนหลัง",
                    "การวิเคราะห์และคำแนะนำ",
                  ],
                  date: "2026-11-23",
                  dateLabel: "จ. 23 พ.ย.",
                  sourceApp: "Huawei Health",
                  sleepScore: 84,
                  percentileBeat: 91,
                  starRating: 4.5,
                  bedtime: "11:02",
                  wakeTime: "18:06",
                  totalSleepMinutes: 424,
                  totalSleepText: "7 ชั่วโมง 4 นาที",
                  totalSleepStatus: "ปกติ",
                  totalSleepReference: "ข้อมูลอ้างอิง: 6–10 ชม.",
                  deepMinutes: 144,
                  deepText: "2 ชั่วโมง 24 นาที",
                  deepPercent: 34,
                  deepStatus: "ปกติ",
                  deepReference: "ข้อมูลอ้างอิง: 20–60%",
                  lightMinutes: 174,
                  lightText: "2 ชั่วโมง 54 นาที",
                  lightPercent: 41,
                  lightStatus: "ปกติ",
                  lightReference: "ข้อมูลอ้างอิง: <55%",
                  remMinutes: 106,
                  remText: "1 ชั่วโมง 46 นาที",
                  remPercent: 25,
                  remStatus: "ปกติ",
                  remReference: "ข้อมูลอ้างอิง: 10–30%",
                  deepSleepContinuityScore: 67,
                  deepSleepContinuityStatus: "ต่ำ",
                  deepSleepContinuityReference: "ข้อมูลอ้างอิง: 70–100 คะแนน",
                  awakeCount: 0,
                  awakeStatus: "ปกติ",
                  awakeReference: "ข้อมูลอ้างอิง: 0–1 ครั้ง",
                  breathingQualityScore: 88,
                  breathingQualityStatus: "ปกติ",
                  breathingQualityReference: "ข้อมูลอ้างอิง: 70–100 คะแนน",
                }),
              },
            ],
          },
        },
      ],
      usageMetadata: { totalTokenCount: 240 },
    }),
  });

  try {
    const res = await fetch(`${srv.baseUrl}/api/cozy-desk/sleep/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "huawei-proto-user" },
      body: JSON.stringify({
        imageBase64: sampleBase64,
        mimeType: "image/jpeg",
        defaultDate: "2026-11-23",
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.record.date, "2026-11-23");
    assert.equal(data.record.dateLabel, "จ. 23 พ.ย.");
    assert.equal(data.record.sleepScore, 84);
    assert.equal(data.record.percentileBeat, 91);
    assert.equal(data.record.awakeCount, 0);
    assert.equal(data.record.deepSleepContinuityScore, 67);
    assert.equal(data.record.deepSleepContinuityStatus, "ต่ำ");
    assert.equal(data.record.scanSummary.standardFieldsFound, 10);
    assert.equal(data.record.rawInfographic.sleep_window.sleep_start_date, "2026-11-23");
    assert.equal(data.record.rawInfographic.sleep_stages_raw.light_sleep.label_th, "นอนหลับตื้น");
    assert.equal(data.record.rawInfographic.sub_metrics_raw.awakenings_count.numeric_value, 0);
    assert.equal(data.record.rawInfographic.sub_metrics_raw.awakenings_count.raw_text, "0 ครั้ง");
    assert.equal(data.record.rawInfographic.sub_metrics_raw.deep_sleep_continuity.status_label_th, "ต่ำ");
    assert.equal(data.record.rawInfographic.sleep_score_raw.star_rating_raw.derived_numeric_rating, 4.5);
  } finally {
    await srv.close();
  }
});

test("Cozy Desk /sleep/extract retries fallback on 503 high-demand spike and classifies persistent 503 as SERVICE_UNAVAILABLE (not API_KEY_INVALID)", async () => {
  let attempts = 0;
  const modelsSeen = [];
  const srvRecover = await createTestServer({
    generateContent: async (_body, opts) => {
      attempts += 1;
      modelsSeen.push(opts?.model || opts?.env?.GEMINI_MODEL);
      if (attempts === 1) {
        const err = new Error(
          JSON.stringify({
            error: {
              code: 503,
              message: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
              status: "UNAVAILABLE",
            },
          })
        );
        err.status = 503;
        throw err;
      }
      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    isSleepScreenshot: true,
                    detectedLanguage: "th",
                    confidence: "high",
                    scannableSections: ["คะแนนการนอน"],
                    skippedSections: [],
                    date: "2026-11-23",
                    dateLabel: "จ. 23 พ.ย.",
                    sourceApp: "Huawei Health",
                    sleepScore: 84,
                    totalSleepMinutes: 424,
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: { totalTokenCount: 120 },
      };
    },
  });

  try {
    const res = await fetch(`${srvRecover.baseUrl}/api/cozy-desk/sleep/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "spike-recover-user" },
      body: JSON.stringify({
        imageBase64: Buffer.alloc(120, 0xaa).toString("base64"),
        mimeType: "image/jpeg",
        defaultDate: "2026-11-23",
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(attempts, 2);
    assert.equal(modelsSeen[0], "gemini-4-hydrogen");
    assert.equal(modelsSeen[1], "gemini-3.1-flash-lite");
  } finally {
    await srvRecover.close();
  }

  const srvBoth503 = await createTestServer({
    generateContent: async () => {
      const err = new Error(
        JSON.stringify({
          error: {
            code: 503,
            message: "This model is currently experiencing high demand.",
            status: "UNAVAILABLE",
          },
        })
      );
      err.status = 503;
      throw err;
    },
  });

  try {
    const res = await fetch(`${srvBoth503.baseUrl}/api/cozy-desk/sleep/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "spike-503-user" },
      body: JSON.stringify({
        imageBase64: Buffer.alloc(120, 0xaa).toString("base64"),
        mimeType: "image/jpeg",
        defaultDate: "2026-11-23",
      }),
    });
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.code, "SERVICE_UNAVAILABLE");
    assert.doesNotMatch(data.error, /GEMINI_API_KEY/);
  } finally {
    await srvBoth503.close();
  }
});

test("Cozy Desk /sleep/extract scans date first and skips full extraction when date already exists unless forceRescan is true", async () => {
  let callCount = 0;
  const modelsUsed = [];
  const srv = await createTestServer({
    generateContent: async (body, opts) => {
      callCount += 1;
      modelsUsed.push(opts?.model || opts?.env?.GEMINI_MODEL);
      const schemaProps = body?.generationConfig?.responseSchema?.properties || {};
      const isDateCheck = !("sleepScore" in schemaProps);
      if (isDateCheck) {
        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      isSleepScreenshot: true,
                      date: "2026-11-23",
                      dateLabel: "จ. 23 พ.ย.",
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 45 },
        };
      }
      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    isSleepScreenshot: true,
                    detectedLanguage: "th",
                    confidence: "high",
                    scannableSections: ["คะแนนการนอน"],
                    skippedSections: [],
                    date: "2026-11-23",
                    dateLabel: "จ. 23 พ.ย.",
                    sourceApp: "Huawei Health",
                    sleepScore: 84,
                    totalSleepMinutes: 424,
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: { totalTokenCount: 180 },
      };
    },
  });

  try {
    // 1. Existing date -> stops after lightweight date pre-scan (1 call only!)
    const dupRes = await fetch(`${srv.baseUrl}/api/cozy-desk/sleep/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "prescan-user" },
      body: JSON.stringify({
        imageBase64: Buffer.alloc(120, 0xaa).toString("base64"),
        mimeType: "image/jpeg",
        defaultDate: "2026-11-25",
        existingDates: ["2026-11-23", "2026-11-24"],
      }),
    });
    assert.equal(dupRes.status, 200);
    const dupData = await dupRes.json();
    assert.equal(dupData.ok, true);
    assert.equal(dupData.skippedDuplicate, true);
    assert.equal(dupData.duplicateDate, "2026-11-23");
    assert.equal(callCount, 1);
    assert.equal(modelsUsed[0], "gemini-3.1-flash-lite");

    // 2. Non-matching existingDates -> date pre-scan + full extraction (2 calls)
    callCount = 0;
    modelsUsed.length = 0;
    const newRes = await fetch(`${srv.baseUrl}/api/cozy-desk/sleep/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "prescan-user" },
      body: JSON.stringify({
        imageBase64: Buffer.alloc(120, 0xaa).toString("base64"),
        mimeType: "image/jpeg",
        defaultDate: "2026-11-25",
        existingDates: ["2026-11-20"],
      }),
    });
    assert.equal(newRes.status, 200);
    const newData = await newRes.json();
    assert.equal(newData.ok, true);
    assert.equal(newData.skippedDuplicate, undefined);
    assert.equal(newData.record.date, "2026-11-23");
    assert.equal(newData.record.sleepScore, 84);
    assert.equal(callCount, 2);

    // 3. forceRescan: true -> skips date pre-scan and runs full extraction directly (1 call)
    callCount = 0;
    modelsUsed.length = 0;
    const forceRes = await fetch(`${srv.baseUrl}/api/cozy-desk/sleep/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": "prescan-user" },
      body: JSON.stringify({
        imageBase64: Buffer.alloc(120, 0xaa).toString("base64"),
        mimeType: "image/jpeg",
        defaultDate: "2026-11-25",
        existingDates: ["2026-11-23"],
        forceRescan: true,
      }),
    });
    assert.equal(forceRes.status, 200);
    const forceData = await forceRes.json();
    assert.equal(forceData.ok, true);
    assert.equal(forceData.record.date, "2026-11-23");
    assert.equal(callCount, 1);
    assert.equal(modelsUsed[0], "gemini-4-hydrogen");
  } finally {
    await srv.close();
  }
});



