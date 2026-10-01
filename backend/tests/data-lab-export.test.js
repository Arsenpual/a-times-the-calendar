const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { createDataLabExportRouter, normalizeActivityId, readWindow } = require("../routes/data-lab-export.js");

function snapshot(documents) {
  return { docs: documents.map(([id, data]) => ({ id, data: () => data })) };
}

function collection(documents) {
  return () => ({ get: async () => snapshot(documents) });
}

async function withTestServer(run) {
  const app = express();
  app.use((req, _res, next) => { req.userId = "test-user"; next(); });
  app.use(createDataLabExportRouter({
    getFreshAccessToken: async (userId) => {
      assert.equal(userId, "test-user");
      return "secret-calendar-token";
    },
    createCalendarReauthRequiredError: () => new Error("reauthorization required"),
    fetchImpl: async (url, options) => {
      assert.match(url, /timeMin=2026-10-01T00%3A00%3A00%2B07%3A00/);
      assert.equal(options.headers.Authorization, "Bearer secret-calendar-token");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          nextPageToken: "more-events",
          items: [
            { id: "series_20261001T030000Z", summary: "ประชุมทีม", start: { dateTime: "2026-10-01T10:00:00+07:00" }, end: { dateTime: "2026-10-01T11:00:00+07:00" } },
            { id: "all-day", summary: "วันหยุด", start: { date: "2026-10-02" }, end: { date: "2026-10-03" } },
            { id: "cancelled", summary: "ไม่ควรออก", status: "cancelled", start: { dateTime: "2026-10-01T12:00:00+07:00" }, end: { dateTime: "2026-10-01T13:00:00+07:00" } },
            { id: "transparent", summary: "ไม่ควรออก", transparency: "transparent", start: { dateTime: "2026-10-01T14:00:00+07:00" }, end: { dateTime: "2026-10-01T15:00:00+07:00" } }
          ]
        })
      };
    },
    categoriesCol: collection([["work", { name: "งาน" }]]),
    activityCategoriesCol: collection([["series", { categoryId: "work" }]]),
    activityTagsCol: collection([["series", { tags: ["meeting"] }]]),
    lockedActivitiesCol: collection([["series", { locked: true }]])
  }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("data lab export joins bounded Calendar data with safe activity metadata", async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/activity-export?windowStart=2026-10-01&windowEnd=2026-10-08`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition"), /times-activity-export\.json/);
    const result = await response.json();
    assert.equal(result.exportVersion, 1);
    assert.equal(result.timeZone, "Asia/Bangkok");
    assert.equal(result.windowStart, "2026-10-01T00:00");
    assert.equal(result.windowEnd, "2026-10-08T00:00");
    assert.equal(result.truncated, true);
    assert.equal(result.activities.length, 2);
    assert.deepEqual(result.activities[0], {
      id: "series_20261001T030000Z",
      title: "ประชุมทีม",
      start: "2026-10-01T10:00:00+07:00",
      end: "2026-10-01T11:00:00+07:00",
      allDay: false,
      category: "งาน",
      tags: ["meeting"],
      locked: true,
      source: "calendar"
    });
    assert.equal(result.activities[1].allDay, true);
    assert.equal("accessToken" in result, false);
  });
});

test("data lab export rejects missing, invalid, reversed, and oversized windows", () => {
  assert.equal(readWindow({}), null);
  assert.equal(readWindow({ windowStart: "2026-10-01", windowEnd: "2026-10-01" }), null);
  assert.equal(readWindow({ windowStart: "2026-10-01", windowEnd: "2026-11-02" }), null);
  assert.deepEqual(readWindow({ windowStart: "2026-10-01", windowEnd: "2026-10-08" }), {
    start: "2026-10-01T00:00",
    end: "2026-10-08T00:00"
  });
  assert.equal(normalizeActivityId("series_20261001T030000Z"), "series");
});
