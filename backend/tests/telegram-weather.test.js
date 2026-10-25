const test = require("node:test");
const assert = require("node:assert/strict");
const { createWeatherController, reportData, recommendedSlots } = require("../lib/telegram-weather.js");
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

function planningWeather() {
  const weather = sampleWeather();
  weather.current.currentTime = "2026-10-12T23:00:00Z"; // 06:00 in Thailand.
  weather.hourly = Array.from({ length: 24 }, (_, i) => ({
    interval: {
      startTime: new Date(Date.parse(weather.current.currentTime) + i * 3_600_000).toISOString(),
      endTime: new Date(Date.parse(weather.current.currentTime) + (i + 1) * 3_600_000).toISOString()
    },
    temperature: { degrees: 27, unit: "CELSIUS" },
    precipitation: { probability: { percent: 5 } },
    wind: { speed: { value: 8, unit: "KILOMETERS_PER_HOUR" } },
    weatherCondition: { type: "PARTLY_CLOUDY", description: { text: "มีเมฆบางส่วน" } }
  }));
  return weather;
}

test("recommendations use complete continuous windows with non-overlapping alternatives and actual end times", () => {
  const weather = planningWeather();
  const result = recommendedSlots(weather, "today", "Asia/Bangkok", weather.current.currentTime, "exercise", 2);
  assert.equal(result.slots.length, 3);
  assert.equal(result.duration, 2);
  for (const slot of result.slots) assert.equal(Date.parse(slot.end) - Date.parse(slot.start), 2 * 3_600_000);
  for (let i = 1; i < result.slots.length; i++) assert.ok(Date.parse(result.slots[i].start) >= Date.parse(result.slots[i - 1].end));
  assert.match(result.text, /สำรอง 1/);
  assert.match(reportData(weather, "now", "exercise").details, /ไทม์ไลน์ย่อ/);
  assert.match(reportData(weather, "now", "exercise").details, /27°C/);
});

test("missing or adverse weather never produces a recommendation; every hour must pass", () => {
  for (const mutate of [
    hour => { delete hour.wind; },
    hour => { delete hour.precipitation; },
    hour => { hour.precipitation.probability.percent = 95; },
    hour => { hour.thunderstormProbability = 60; },
    hour => { hour.wind.speed.unit = "UNKNOWN"; }
  ]) {
    const weather = planningWeather();
    weather.hourly.forEach(mutate);
    const result = recommendedSlots(weather, "today", "Asia/Bangkok", weather.current.currentTime, "exercise", 1);
    assert.equal(result.slots.length, 0);
    assert.match(result.text, /ยังไม่มีช่วง/);
  }
  const weather = planningWeather();
  weather.hourly = weather.hourly.slice(0, 2);
  weather.hourly[1].precipitation.probability.percent = 90;
  assert.equal(recommendedSlots(weather, "today", "Asia/Bangkok", weather.current.currentTime, "exercise", 2).slots.length, 0);
});

test("windows exclude elapsed hours, gaps, and laundry at night", () => {
  const weather = planningWeather();
  weather.hourly = [weather.hourly[1], weather.hourly[3]];
  assert.equal(recommendedSlots(weather, "today", "Asia/Bangkok", weather.current.currentTime, "exercise", 2).slots.length, 0);
  weather.hourly = planningWeather().hourly.slice(16, 18); // 22:00 and 23:00.
  assert.equal(recommendedSlots(weather, "today", "Asia/Bangkok", weather.current.currentTime, "laundry", 1).slots.length, 0);
  assert.ok(recommendedSlots(weather, "today", "Asia/Bangkok", weather.current.currentTime, "travel", 1).slots.length > 0);
  weather.hourly = planningWeather().hourly.slice(0, 1);
  assert.equal(recommendedSlots(weather, "today", "Asia/Bangkok", "2026-10-12T23:30:00Z", "exercise", 1).slots.length, 0);
});

test("wind units are normalized and three-day reports ask for a day before ranking", () => {
  const weather = planningWeather();
  const baseline = recommendedSlots(weather, "today", "Asia/Bangkok", weather.current.currentTime, "exercise", 1);
  weather.hourly.forEach(hour => { hour.wind.speed = { value: 8 / 3.6, unit: "METERS_PER_SECOND" }; });
  const converted = recommendedSlots(weather, "today", "Asia/Bangkok", weather.current.currentTime, "exercise", 1);
  assert.deepEqual(converted.slots, baseline.slots);
  assert.equal(recommendedSlots(weather, "days", "Asia/Bangkok", weather.current.currentTime).slots.length, 0);
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

test("activity buttons refresh a full forecast and give the deterministic recommendation to AI", async () => {
  const h = harness();
  await h.controller.handle({ ...h.ctx, text: "/weather เชียงใหม่" });
  await h.controller.handle({ ...h.ctx, action: "activity:exercise" });
  assert.equal(h.calls.at(-1).params.hours, 48);
  assert.match(h.replies.at(-1).text, /ออกกำลังกาย/);
  const supplied = JSON.parse(h.prompts.at(-1).contents[0].parts[0].text);
  assert.equal(supplied.weather.recommendation.activity, "ออกกำลังกาย");
  assert.ok(h.replies.at(-1).reply_markup.inline_keyboard.flat().some(button => button.callback_data === "weather:activity:laundry"));
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

test("duration and activity choices reach AI, and criteria do not consume API quota", async () => {
  const h = harness({ lookup: async () => planningWeather() });
  await h.controller.handle({ ...h.ctx, text: "/weather เชียงใหม่" });
  await h.controller.handle({ ...h.ctx, action: "activity:laundry" });
  let supplied = JSON.parse(h.prompts.at(-1).contents[0].parts[0].text);
  assert.equal(supplied.weather.recommendation.duration, 3);
  assert.match(h.replies.at(-1).text, /ซัก\/ตากผ้า/);
  await h.controller.handle({ ...h.ctx, action: "duration:2" });
  supplied = JSON.parse(h.prompts.at(-1).contents[0].parts[0].text);
  assert.equal(supplied.weather.recommendation.duration, 2);
  const prompts = h.prompts.length;
  await h.controller.handle({ ...h.ctx, action: "criteria" });
  assert.match(h.replies.at(-1).text, /07:00–18:00/);
  assert.match(h.replies.at(-1).text, /ไม่ใช่มาตรฐานความปลอดภัย/);
  assert.equal(h.prompts.length, prompts);
  await h.controller.handle({ ...h.ctx, action: "duration:99" });
  assert.equal(h.prompts.length, prompts);
});

test("expanded reports show more hours, split Telegram messages, and keep controls at the end", async () => {
  const weather = planningWeather();
  weather.hourly.forEach(hour => { hour.weatherCondition.description.text = "เมฆมาก ".repeat(50); });
  const h = harness({ lookup: async () => weather, generate: async () => ({ text: "ก".repeat(1000) }) });
  await h.controller.handle({ ...h.ctx, text: "/weather เชียงใหม่" });
  const start = h.replies.length;
  await h.controller.handle({ ...h.ctx, action: "view:details" });
  const replies = h.replies.slice(start + 1); // Skip loading message.
  assert.ok(replies.length > 1);
  assert.ok(replies.every(reply => reply.text.length <= 3800));
  assert.match(replies.map(reply => reply.text).join("\n"), /ไทม์ไลน์รายชั่วโมง/);
  assert.equal(replies[0].reply_markup, undefined);
  assert.ok(replies.at(-1).reply_markup.inline_keyboard.flat().some(button => button.callback_data === "weather:view:compact"));
  await h.controller.handle({ ...h.ctx, action: "view:compact" });
  assert.match(h.replies.at(-1).text, /ไทม์ไลน์ย่อ/);
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
      if (parsed.pathname.includes("geocode")) value = { results: [1, 2].map(() => ({ location: { latitude: 1, longitude: 2 } })) };
      return { ok: true, json: async () => value };
    };
    const weather = await lookupGoogleWeather({ name: "GPS", latitude: 1, longitude: 2 }, { hours: 48 });
    assert.equal(weather.hourly.length, 2);
    assert.equal(calls.filter(c => c.pathname.includes("forecast/hours")).length, 2);
    assert.throws(() => coordinates(null, 1), /ไม่ถูกต้อง/);
    assert.throws(() => coordinates(91, 1), /ไม่ถูกต้อง/);
    await assert.rejects(findGoogleWeatherLocation("เมือง"), /ไม่ชัดเจน/);
    global.fetch = async (url, options) => {
      const parsed = new URL(url);
      assert.equal(parsed.origin, "https://geocode.googleapis.com");
      assert.equal(decodeURIComponent(parsed.pathname), "/v4/geocode/address/7/1 เชียงใหม่ + #1");
      assert.equal(parsed.searchParams.get("languageCode"), "th");
      assert.equal(parsed.searchParams.has("key"), false);
      assert.equal(options.headers["X-Goog-Api-Key"], "dummy-weather-key");
      assert.equal(options.headers["X-Goog-FieldMask"], "results.location,results.formattedAddress");
      return { ok: true, json: async () => ({ results: [{ formattedAddress: "เชียงใหม่ ประเทศไทย", location: { latitude: 18.8, longitude: 99 } }] }) };
    };
    assert.deepEqual(await findGoogleWeatherLocation("7/1 เชียงใหม่ + #1"), { name: "เชียงใหม่ ประเทศไทย", latitude: 18.8, longitude: 99 });
    global.fetch = async () => ({ ok: true, json: async () => ({}) });
    await assert.rejects(findGoogleWeatherLocation("ไม่มีสถานที่"), /ไม่พบสถานที่/);
    global.fetch = async () => ({ ok: true, json: async () => ({ results: [{ location: { latitude: 91, longitude: 99 } }] }) });
    await assert.rejects(findGoogleWeatherLocation("เชียงใหม่"), /ไม่ถูกต้อง/);
    global.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: { status: "PERMISSION_DENIED", message: "API not authorized for dummy-weather-key" } }) });
    await assert.rejects(findGoogleWeatherLocation("เชียงใหม่"), error => {
      assert.match(error.message, /v4.*403.*API not authorized/);
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
