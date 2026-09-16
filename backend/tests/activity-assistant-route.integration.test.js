const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { createActivityAssistantRouter } = require("../routes/ai-activity-draft.js");

function validGeminiDraft() {
  return {
    ready: true,
    reply: "ร่างกิจกรรมพร้อมตรวจสอบครับ",
    draft: {
      title: "ประชุมทีม",
      startLocal: "2026-09-16T10:00",
      endLocal: "2026-09-16T11:00",
      allDay: false,
      categoryName: "งาน",
      tags: [],
      recurrence: null,
      notes: "",
      assumptions: []
    }
  };
}

async function withTestServer(dependencies, run) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.userId = "integration-user"; next(); });
  app.use(createActivityAssistantRouter(dependencies));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function post(baseUrl, body) {
  return fetch(`${baseUrl}/activity-conversation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ referenceDate: "2026-09-16", timeZone: "Asia/Bangkok", categories: ["งาน"], history: [], ...body })
  });
}

function postTemplate(baseUrl, body) {
  return fetch(`${baseUrl}/activity-template-draft`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ date: "2026-09-16", time: "10:00", durationMinutes: 60, title: "ร่างกิจกรรม", timeZone: "Asia/Bangkok", categories: ["งาน"], ...body })
  });
}

test("knowledge answer is deterministic and skips Gemini quota", async () => {
  let quotaCalls = 0;
  let geminiCalls = 0;
  await withTestServer({
    answerKnowledge: () => "คำตอบจากความรู้ในเครื่อง",
    claimChatUsage: async () => { quotaCalls += 1; return { status: "claimed" }; },
    generateActivity: async () => { geminiCalls += 1; return validGeminiDraft(); }
  }, async (baseUrl) => {
    const response = await post(baseUrl, { text: "T.i.M.E.S. คืออะไร?" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reply: "คำตอบจากความรู้ในเครื่อง", ready: false, draft: null, source: "knowledge" });
  });
  assert.equal(quotaCalls, 0);
  assert.equal(geminiCalls, 0);
});

test("a complete explicit activity request skips AI quota and opens a reviewable draft", async () => {
  let quotaCalls = 0;
  let geminiCalls = 0;
  await withTestServer({
    answerKnowledge: () => null,
    claimChatUsage: async () => { quotaCalls += 1; return { status: "claimed" }; },
    generateActivity: async () => { geminiCalls += 1; return validGeminiDraft(); }
  }, async (baseUrl) => {
    const response = await post(baseUrl, { text: "ทำงาน 08.30 พรุ่งนี้ 3 ชม." });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.source, "deterministic");
    assert.equal(result.ready, true);
    assert.match(result.reply, /Activity Popup/);
    assert.equal(result.draft.title, "ทำงาน");
    assert.equal(result.draft.startLocal, "2026-09-17T08:30");
    assert.equal(result.draft.endLocal, "2026-09-17T11:30");
  });
  assert.equal(quotaCalls, 0);
  assert.equal(geminiCalls, 0);
});

test("valid Gemini result becomes a reviewable draft and never calls a Calendar writer", async () => {
  let geminiCalls = 0;
  await withTestServer({
    answerKnowledge: () => null,
    claimChatUsage: async () => ({ status: "claimed", id: "usage-1" }),
    generateActivity: async () => { geminiCalls += 1; return validGeminiDraft(); }
  }, async (baseUrl) => {
    const response = await post(baseUrl, { text: "พรุ่งนี้ประชุมทีมสิบโมง" });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.ready, true);
    assert.equal(result.draft.title, "ประชุมทีม");
    assert.equal(result.draft.startLocal, "2026-09-16T10:00");
    assert.equal(result.draft.endLocal, "2026-09-16T11:00");
  });
  assert.equal(geminiCalls, 1);
});

test("malformed Gemini datetime is rejected and its claimed quota is released", async () => {
  let releases = 0;
  await withTestServer({
    answerKnowledge: () => null,
    claimChatUsage: async () => ({ status: "claimed", id: "usage-2" }),
    releaseChatUsage: async () => { releases += 1; },
    generateActivity: async () => ({ ...validGeminiDraft(), draft: { ...validGeminiDraft().draft, startLocal: "not-a-date" } })
  }, async (baseUrl) => {
    const response = await post(baseUrl, { text: "ประชุมทีม" });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /YYYY-MM-DDTHH:mm/);
  });
  assert.equal(releases, 1);
});

test("guided template drafts use the same overlap limit as typed AI drafts", async () => {
  await withTestServer({
    claimDraftUsage: async () => ({ status: "day-limited" })
  }, async (baseUrl) => {
    const response = await postTemplate(baseUrl, {
      scheduleContext: {
        activities: [
          { id: "one", title: "หนึ่ง", startLocal: "2026-09-16T09:30", endLocal: "2026-09-16T11:30" },
          { id: "two", title: "สอง", startLocal: "2026-09-16T09:45", endLocal: "2026-09-16T11:15" },
          { id: "three", title: "สาม", startLocal: "2026-09-16T10:00", endLocal: "2026-09-16T11:00" }
        ]
      }
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.ready, true);
    assert.equal(result.schedule.status, "overlap-limit");
    assert.ok(result.schedule.alternatives.length > 0);
  });
});
