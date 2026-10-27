const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { createAiWeatherPlanRouter } = require("../routes/ai-weather-plan.js");

const hour = (start) => ({
  interval: { startTime: start, endTime: new Date(Date.parse(start) + 3_600_000).toISOString() },
  precipitation: { probability: { percent: 10 } },
  temperature: { degrees: 27, unit: "CELSIUS" },
  wind: { speed: { value: 5, unit: "KILOMETERS_PER_HOUR" } },
  weatherCondition: { type: "CLEAR" }
});
const weather = {
  current: { currentTime: "2026-10-27T01:00:00Z", timeZone: { id: "Asia/Bangkok" }, temperature: { degrees: 27 }, precipitation: { probability: { percent: 10 } }, weatherCondition: { description: { text: "ฟ้าใส" } } },
  hourly: [hour("2026-10-27T02:00:00Z"), hour("2026-10-27T03:00:00Z")],
  daily: [], retrievedAt: "2026-10-27T01:01:00Z"
};

async function withServer(dependencies, run) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.userId = "test-user"; next(); });
  app.use(createAiWeatherPlanRouter(dependencies));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

const post = (baseUrl, body) => fetch(`${baseUrl}/weather-plan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const request = { location: "กรุงเทพฯ", activity: "outdoor", day: "today", durationHours: 1 };

test("web weather plan uses Google data and deterministic slots even without AI access", async () => {
  let lookedUp = 0;
  await withServer({
    find: async query => ({ name: query, latitude: 13.7, longitude: 100.5 }),
    lookup: async (_location, options) => { lookedUp += 1; assert.deepEqual(options, { days: 3, hours: 48 }); return weather; },
    claimUsage: async () => ({ status: "not-allowed" }),
    generateAdvice: async () => { throw new Error("AI must not run"); }
  }, async baseUrl => {
    const response = await post(baseUrl, request);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.source, "google-weather");
    assert.equal(result.weather.asOf, weather.current.currentTime);
    assert.equal(result.weather.current.temperatureC, 27);
    assert.equal(result.recommendation.slots.length, 2);
    assert.equal(result.aiUsed, false);
    assert.equal(result.attribution, "Source: Includes weather data from Google");
    assert.equal("hourly" in result, false, "raw forecast stays on backend");
  });
  assert.equal(lookedUp, 1);
});

test("web weather plan asks AI only with the verified compact weather context", async () => {
  await withServer({
    find: async query => ({ name: query, latitude: 13.7, longitude: 100.5 }),
    lookup: async () => weather,
    claimUsage: async () => ({ status: "claimed" }),
    generateAdvice: async ({ recommendation, weather: compact }) => {
      assert.equal(compact.current.condition, "ฟ้าใส");
      assert.equal(recommendation.slots.length, 2);
      return "ช่วง 09:00 เหมาะกว่าตามเกณฑ์ที่ตรวจได้";
    }
  }, async baseUrl => {
    const result = await (await post(baseUrl, request)).json();
    assert.equal(result.aiUsed, true);
    assert.match(result.aiAdvice, /09:00/);
  });
});

test("weather recheck never claims AI quota", async () => {
  let claims = 0;
  await withServer({
    find: async query => ({ name: query, latitude: 13.7, longitude: 100.5 }),
    lookup: async () => weather,
    claimUsage: async () => { claims += 1; return { status: "claimed" }; }
  }, async baseUrl => {
    const response = await post(baseUrl, { ...request, includeAdvice: false });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.aiUsed, false);
    assert.equal(result.recommendation.slots.length, 2);
  });
  assert.equal(claims, 0);
});

test("invalid web weather request does not call Google", async () => {
  await withServer({ find: async () => { throw new Error("unexpected"); } }, async baseUrl => {
    const response = await post(baseUrl, { ...request, durationHours: 12 });
    assert.equal(response.status, 400);
  });
});

test("incomplete hourly data does not invent a recommended slot", async () => {
  await withServer({
    find: async query => ({ name: query, latitude: 13.7, longitude: 100.5 }),
    lookup: async () => ({ ...weather, hourly: [{ ...hour("2026-10-27T02:00:00Z"), wind: undefined }] }),
    claimUsage: async () => ({ status: "not-allowed" })
  }, async baseUrl => {
    const response = await post(baseUrl, request);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.recommendation.slots, []);
    assert.match(result.recommendation.text, /ข้อมูลครบ/);
  });
});

test("missing forecast timestamp returns a controlled error", async () => {
  await withServer({
    find: async query => ({ name: query, latitude: 13.7, longitude: 100.5 }),
    lookup: async () => ({ current: {}, hourly: [], daily: [] })
  }, async baseUrl => {
    const response = await post(baseUrl, request);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, "WEATHER_UNAVAILABLE");
  });
});

test("Google lookup failure is reported without running the AI planner", async () => {
  await withServer({
    find: async query => ({ name: query, latitude: 13.7, longitude: 100.5 }),
    lookup: async () => { throw new Error("Weather API ไม่พร้อม"); },
    claimUsage: async () => { throw new Error("AI must not run"); }
  }, async baseUrl => {
    const response = await post(baseUrl, request);
    assert.equal(response.status, 502);
    const result = await response.json();
    assert.equal(result.code, "WEATHER_UNAVAILABLE");
    assert.match(result.error, /Weather API ไม่พร้อม/);
  });
});
