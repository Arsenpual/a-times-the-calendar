const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createCozyDeskRouter } = require("../routes/cozy-desk.js");

function createTestServer({
  generateContent,
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
