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

test("non-developers cannot invoke Gemini or load its Calendar context; templates still work", async () => {
  const forbidden = async () => { throw new Error("must not call Gemini or read AI context"); };
  await withTestServer({
    answerKnowledge: () => null,
    claimChatUsage: async () => ({ status: "not-allowed" }),
    claimDraftUsage: async () => ({ status: "not-allowed" }),
    generateActivity: forbidden,
    generateCalendarAnswer: forbidden,
    readCalendarQuestion: forbidden
  }, async (baseUrl) => {
    for (const text of ["ช่วยวิเคราะห์ตารางของฉัน", "ช่วยวางแผนทำการบ้าน"]) {
      const response = await post(baseUrl, { text });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, "AI_DEVELOPER_ONLY");
    }
    const template = await postTemplate(baseUrl, {});
    assert.equal(template.status, 200);
    const result = await template.json();
    assert.equal(result.summarySource, "deterministic");
    assert.equal(result.ready, true);
  });
});

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

test("an explicitly approved bounded insight summary reaches AI context without report content", async () => {
  await withTestServer({
    answerKnowledge: () => null,
    claimChatUsage: async () => ({ status: "claimed" }),
    generateActivity: async (context) => {
      assert.deepEqual(context.insightContext, {
        type: "weekly",
        metrics: [{ key: "totalScheduledMinutes", value: 420 }, { key: "daysWithOverlap", value: 2 }]
      });
      return validGeminiDraft();
    }
  }, async (baseUrl) => {
    const response = await post(baseUrl, {
      text: "พรุ่งนี้ประชุมทีมสิบโมง",
      insightContext: {
        type: "weekly",
        metrics: [
          { key: "totalScheduledMinutes", value: 420, label: "ignored" },
          { key: "daysWithOverlap", value: 2 },
          { key: "notAllowed", value: 999 },
          { key: "totalActivities", value: "not-a-number" }
        ],
        rawReport: { activities: ["must not reach the prompt"] }
      }
    });
    assert.equal(response.status, 200);
  });
});

test("calendar question reads a bounded context and returns a Gemini answer without any Calendar write", async () => {
  let calendarReads = 0;
  let activityGenerations = 0;
  await withTestServer({
    answerKnowledge: () => null,
    claimChatUsage: async () => ({ status: "claimed" }),
    readCalendarQuestion: async (_userId, context) => {
      calendarReads += 1;
      assert.equal(context.text, "พรุ่งนี้ว่างไหม?");
      return {
        range: { start: "2026-09-17", end: "2026-09-17", label: "2026-09-17" },
        events: [{ calendar: "Primary", title: "ประชุมทีม", start: "2026-09-17T10:00:00+07:00", end: "2026-09-17T11:00:00+07:00", allDay: false }],
        calendarCount: 1
      };
    },
    generateCalendarAnswer: async ({ calendarContext }) => {
      assert.equal(calendarContext.events[0].title, "ประชุมทีม");
      return "พรุ่งนี้ว่างก่อน 10:00 และหลัง 11:00 ครับ";
    },
    generateActivity: async () => { activityGenerations += 1; return validGeminiDraft(); }
  }, async (baseUrl) => {
    const response = await post(baseUrl, { text: "พรุ่งนี้ว่างไหม?" });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.source, "calendar");
    assert.equal(result.ready, false);
    assert.match(result.reply, /ก่อน 10:00/);
  });
  assert.equal(calendarReads, 1);
  assert.equal(activityGenerations, 0);
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

test("a find-time request returns up to three reviewable drafts without using AI quota", async () => {
  let quotaCalls = 0;
  await withTestServer({
    answerKnowledge: () => null,
    claimChatUsage: async () => { quotaCalls += 1; return { status: "claimed" }; },
    generateActivity: async () => { throw new Error("must not call Gemini"); }
  }, async (baseUrl) => {
    const response = await post(baseUrl, {
      text: "ช่วยหาเวลาว่างออกกำลังกายหนึ่งชั่วโมงพรุ่งนี้",
      scheduleContext: {
        windowStartLocal: "2026-09-16T00:00",
        windowEndLocal: "2026-09-18T00:00",
        activities: [{ id: "busy", title: "ประชุม", startLocal: "2026-09-17T08:00", endLocal: "2026-09-17T10:00" }]
      }
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.source, "scheduling");
    assert.equal(result.ready, false);
    assert.equal(result.scheduling.options.length, 3);
    assert.equal(result.scheduling.options[0].draft.title, "ออกกำลังกาย");
    assert.equal(result.scheduling.options[0].draft.startLocal, "2026-09-17T10:00");
  });
  assert.equal(quotaCalls, 0);
});

test("a plan-list request returns sequential drafts and keeps an unscheduled task visible", async () => {
  let quotaCalls = 0;
  await withTestServer({
    answerKnowledge: () => null,
    claimChatUsage: async () => { quotaCalls += 1; return { status: "claimed" }; },
    generateActivity: async () => { throw new Error("must not call Gemini"); }
  }, async (baseUrl) => {
    const response = await post(baseUrl, {
      text: "ช่วยวางแผนพรุ่งนี้: อ่านหนังสือ 1 ชั่วโมง, ออกกำลังกาย 30 นาที, งานยาว 8 ชั่วโมง",
      scheduleContext: {
        windowStartLocal: "2026-09-16T00:00",
        windowEndLocal: "2026-09-18T00:00",
        activities: [{ id: "busy", title: "ประชุม", startLocal: "2026-09-17T08:00", endLocal: "2026-09-17T20:00" }]
      }
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.source, "planning");
    assert.equal(result.planning.drafts.length, 2);
    assert.equal(result.planning.drafts[0].title, "อ่านหนังสือ");
    assert.equal(result.planning.drafts[0].startLocal, "2026-09-17T20:00");
    assert.equal(result.planning.drafts[1].startLocal, "2026-09-17T21:00");
    assert.deepEqual(result.planning.unscheduled, [{ title: "งานยาว", durationMinutes: 480 }]);
  });
  assert.equal(quotaCalls, 0);
});

test("a split-task request protects a 90-minute focus block with a 15-minute break", async () => {
  await withTestServer({
    answerKnowledge: () => null,
    claimChatUsage: async () => { throw new Error("must not claim AI quota"); },
    generateActivity: async () => { throw new Error("must not call Gemini"); }
  }, async (baseUrl) => {
    const response = await post(baseUrl, {
      text: "ช่วยแบ่งงานทำรายงาน 3 ชั่วโมงพรุ่งนี้",
      scheduleContext: {
        windowStartLocal: "2026-09-16T00:00",
        windowEndLocal: "2026-09-18T00:00",
        activities: []
      }
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.source, "planning");
    assert.deepEqual(result.planning.drafts.map((draft) => [draft.title, draft.startLocal, draft.endLocal]), [
      ["ทำรายงาน (1/2)", "2026-09-17T08:00", "2026-09-17T09:30"],
      ["พัก 15 นาที", "2026-09-17T09:30", "2026-09-17T09:45"],
      ["ทำรายงาน (2/2)", "2026-09-17T09:45", "2026-09-17T11:15"]
    ]);
  });
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
