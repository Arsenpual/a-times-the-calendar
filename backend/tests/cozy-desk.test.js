const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createCozyDeskRouter } = require("../routes/cozy-desk.js");

function createTestServer({ generateContent, sleepLogsStore = new Map(), env = { GEMINI_API_KEY: "test-key" } } = {}) {
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
