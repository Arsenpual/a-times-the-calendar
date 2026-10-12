const test = require("node:test");
const assert = require("node:assert/strict");
const { createWeatherController, reportData } = require("../lib/telegram-weather.js");
const { coordinates, lookupGoogleWeather, findGoogleWeatherLocation } = require("../google-weather.js");

function sampleWeather() {
  return {
    location: { name: "เชียงใหม่", latitude: 18.8, longitude: 99 },
    retrievedAt: "2026-10-12T16:00:00Z",
    current: { currentTime: "2026-10-12T16:00:00Z", timeZone: { id: "Asia/Bangkok" }, temperature: { degrees: 28 }, relativeHumidity: 0 },
    daily: [],
    hourly: [
      { interval: { startTime: "2026-10-12T16:00:00Z" }, temperature: { degrees: 28 }, precipitation: { probability: { percent: 0 } } },
      { interval: { startTime: "2026-10-12T17:00:00Z" }, temperature: { degrees: 25 }, precipitation: { probability: { percent: 80 } } }
    ]
  };
}

function harness(options = {}) {
  let stored = {};
  let id = 0;
  const replies = [];
  const calls = [];
  const prompts = [];
  let released = 0;
  const controller = createWeatherController({
    authDoc: () => ({ get: async () => ({ data: () => stored }), set: async value => { stored = { ...stored, ...value }; } }),
    claimUsage: async () => ({ status: "claimed" }),
    releaseUsage: async () => { released++; },
    generate: async payload => { prompts.push(payload); return { text: "เตรียมร่มสำหรับช่วงที่มีโอกาสฝน" }; },
    aiText: payload => payload.text, quotaText: status => status,
    lookup: async (location, params) => { calls.push({ location, params }); return { ...sampleWeather(), location }; },
    find: async query => ({ name: `ตำแหน่ง ${query}`, latitude: 18.8, longitude: 99 }),
    ...options
  });
  const ctx = { userId: "owner", chatId: 123, privateChat: true, reply: async (text, options) => {
    const message = { message_id: ++id, text, ...options };
    replies.push(message);
    return message;
  } };
  return { controller, ctx, replies, calls, prompts, stored: () => stored, released: () => released };
}

test("today/tomorrow use local date across UTC midnight; zero and missing data stay distinct", () => {
  const weather = sampleWeather();
  assert.match(reportData(weather, "today").details, /28°C/);
  assert.doesNotMatch(reportData(weather, "today").details, /25°C/);
  assert.match(reportData(weather, "tomorrow").details, /25°C.*80%/);
  assert.match(reportData(weather, "now").details, /ความชื้น 0%/);
  assert.match(reportData(weather, "now").details, /โอกาสฝน ไม่ระบุ/);
});

test("controller scopes location input to explicit replies; ordinary notes and locations are untouched", async () => {
  const h = harness();
  assert.equal(await h.controller.handle({ ...h.ctx, location: { latitude: 1, longitude: 2 } }), false);
  await h.controller.handle({ ...h.ctx, action: "place" });
  const promptId = h.replies.at(-1).message_id;
  assert.equal(await h.controller.handle({ ...h.ctx, text: "บันทึกสั้น" }), false);
  await h.controller.handle({ ...h.ctx, text: "เชียงใหม่", replyTo: promptId });
  assert.equal(h.calls.length, 1);
  assert.match(h.replies.at(-1).text, /ตำแหน่ง เชียงใหม่/);
  assert.match(h.replies.at(-1).text, /🤖/);
  assert.match(h.replies.at(-1).text, /Google Maps/);
  assert.ok(h.replies.at(-1).reply_markup.inline_keyboard.flat().some(b => b.callback_data === "weather:mode:tomorrow"));
});

test("forecast mode and questions request hourly data; AI receives location and forecast boundaries", async () => {
  const h = harness();
  await h.controller.handle({ ...h.ctx, text: "/weather เชียงใหม่" });
  await h.controller.handle({ ...h.ctx, action: "mode:tomorrow" });
  assert.equal(h.calls.at(-1).params.hours, 48);
  await h.controller.handle({ ...h.ctx, text: "/weather_ask เดือนหน้าเหมาะกับวิ่งไหม" });
  const payload = h.prompts.at(-1);
  const supplied = JSON.parse(payload.contents[0].parts[0].text);
  assert.equal(supplied.question, "เดือนหน้าเหมาะกับวิ่งไหม");
  assert.equal(supplied.weather.hourly.length, 2);
  assert.match(payload.systemInstruction.parts[0].text, /no forecast is available/);
  assert.match(payload.systemInstruction.parts[0].text, /THE AFTERLIGHT UNIVERSE/);
  assert.match(payload.systemInstruction.parts[0].text, /Reporting mode/);
});

test("favorites store user query, not weather or Google geocoded coordinates; selection and deletion work", async () => {
  const h = harness();
  await h.controller.handle({ ...h.ctx, text: "/weather เชียงใหม่" });
  await h.controller.handle({ ...h.ctx, action: "save" });
  await h.controller.handle({ ...h.ctx, text: "บ้าน", replyTo: h.replies.at(-1).message_id });
  assert.deepEqual(h.stored().telegramWeatherFavorites, [{ label: "บ้าน", location: { query: "เชียงใหม่", name: "บ้าน" } }]);
  await h.controller.handle({ ...h.ctx, action: "favorite:0" });
  assert.equal(h.calls.length, 2);
  await h.controller.handle({ ...h.ctx, action: "delete:0" });
  assert.deepEqual(h.stored().telegramWeatherFavorites, []);
});

test("AI failure returns real weather and releases claim; no rights still show real data", async () => {
  const h = harness({ generate: async () => { throw new Error("test AI failure"); } });
  await h.controller.handle({ ...h.ctx, text: "/weather เชียงใหม่" });
  assert.match(h.replies.at(-1).text, /28°C/);
  assert.match(h.replies.at(-1).text, /AI ยังไม่พร้อม/);
  assert.equal(h.released(), 1);
  const limited = harness({ claimUsage: async () => ({ status: "not-allowed" }) });
  await limited.controller.handle({ ...limited.ctx, text: "/weather เชียงใหม่" });
  assert.equal(limited.prompts.length, 0);
  assert.match(limited.replies.at(-1).text, /not-allowed/);
});

test("private linked account required; cancel stops pending input", async () => {
  const h = harness();
  await h.controller.handle({ ...h.ctx, privateChat: false, text: "/weather เชียงใหม่" });
  await h.controller.handle({ ...h.ctx, userId: null, text: "/weather เชียงใหม่" });
  assert.equal(h.calls.length, 0);
  await h.controller.handle({ ...h.ctx, action: "place" });
  const id = h.replies.at(-1).message_id;
  await h.controller.handle({ ...h.ctx, text: "/weather_cancel" });
  assert.equal(await h.controller.handle({ ...h.ctx, text: "เชียงใหม่", replyTo: id }), false);
});

test("GPS is accepted only for the place prompt; another command cancels pending input", async () => {
  const h = harness();
  await h.controller.handle({ ...h.ctx, action: "place" });
  await h.controller.handle({ ...h.ctx, location: { latitude: 18.8, longitude: 99 } });
  assert.equal(h.calls.at(-1).location.latitude, 18.8);
  await h.controller.handle({ ...h.ctx, action: "ask" });
  const id = h.replies.at(-1).message_id;
  assert.equal(await h.controller.handle({ ...h.ctx, location: { latitude: 1, longitude: 2 } }), false);
  assert.equal(await h.controller.handle({ ...h.ctx, text: "/news" }), false);
  assert.equal(await h.controller.handle({ ...h.ctx, text: "พรุ่งนี้", replyTo: id }), false);
});

test("quota storage failure still produces the weather report", async () => {
  const h = harness({ claimUsage: async () => { throw new Error("quota unavailable"); } });
  await h.controller.handle({ ...h.ctx, text: "/weather เชียงใหม่" });
  assert.match(h.replies.at(-1).text, /28°C/);
  assert.match(h.replies.at(-1).text, /AI ยังไม่พร้อม/);
  assert.equal(h.released(), 0);
});

test("Google hourly transport follows pagination, rejects invalid coordinates and ambiguous places, and hides keys", async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
  process.env.GOOGLE_WEATHER_API_KEY = "dummy-weather-key";
  const calls = [];
  try {
    global.fetch = async url => {
      const parsed = new URL(url);
      calls.push(parsed);
      let value = {};
      if (parsed.pathname.includes("forecast/hours")) value = parsed.searchParams.has("pageToken") ? { forecastHours: [{ second: true }] } : { forecastHours: [{ first: true }], nextPageToken: "next" };
      if (parsed.pathname.includes("geocode")) value = { status: "OK", results: [1, 2].map(() => ({ geometry: { location: { lat: 1, lng: 2 } } })) };
      return { ok: true, json: async () => value };
    };
    const weather = await lookupGoogleWeather({ name: "GPS", latitude: 1, longitude: 2 }, { hours: 48 });
    assert.equal(weather.hourly.length, 2);
    assert.equal(calls.filter(c => c.pathname.includes("forecast/hours")).length, 2);
    assert.throws(() => coordinates(null, 1), /ไม่ถูกต้อง/);
    assert.throws(() => coordinates(91, 1), /ไม่ถูกต้อง/);
    await assert.rejects(findGoogleWeatherLocation("เมือง"), /ไม่ชัดเจน/);
    global.fetch = async () => ({ ok: true, json: async () => ({ status: "REQUEST_DENIED", error_message: "API not authorized for dummy-weather-key" }) });
    await assert.rejects(findGoogleWeatherLocation("เชียงใหม่"), error => {
      assert.match(error.message, /REQUEST_DENIED.*API not authorized/);
      assert.doesNotMatch(error.message, /dummy-weather-key/);
      return true;
    });
    global.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: { message: "API disabled for dummy-weather-key" } }) });
    await assert.rejects(lookupGoogleWeather({ latitude: 1, longitude: 2 }), error => {
      assert.match(error.message, /403.*API disabled/);
      assert.doesNotMatch(error.message, /dummy-weather-key/);
      return true;
    });
    global.fetch = async () => { throw new Error("https://weather.googleapis.com/?key=dummy-weather-key"); };
    await assert.rejects(lookupGoogleWeather({ latitude: 1, longitude: 2 }), error => !error.message.includes("dummy-weather-key"));
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_WEATHER_API_KEY; else process.env.GOOGLE_WEATHER_API_KEY = originalKey;
  }
});
