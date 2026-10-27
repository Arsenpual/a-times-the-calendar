const express = require("express");
const { findGoogleWeatherLocation, lookupGoogleWeather } = require("../google-weather.js");
const { ACTIVITIES, recommendedSlots } = require("../lib/weather-planning.js");
const { buildZettascaleInstruction } = require("../lib/zettascale-persona.js");
const { generateContent } = require("../gemini-api.js");

async function generateWeatherAdvice({ location, weather, recommendation, day, activity }) {
  const compact = {
    location,
    asOf: weather.asOf,
    timeZone: weather.timeZone,
    day,
    activity,
    current: weather.current,
    slots: recommendation.slots.map(({ start, end, score, reasons }) => ({ start, end, score, reasons })),
    recommendationText: recommendation.text
  };
  const payload = await generateContent({
    systemInstruction: { parts: [{ text: buildZettascaleInstruction("ตอบภาษาไทยไม่เกิน 3 ประโยค ใช้เฉพาะข้อมูลอากาศและช่วงเวลาที่ส่งมา ห้ามเสนอวันหรือเวลาที่ไม่มีใน slots ห้ามยืนยันว่าปลอดภัยหรือฝนไม่ตก ถ้าไม่มี slots ให้บอกว่าข้อมูลไม่พอหรือไม่ผ่านเกณฑ์ตามที่ระบุ แยกข้อมูลอากาศจากคำแนะนำของแอป", { reporting: true }) }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify(compact) }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
  });
  return String(payload?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "").trim().slice(0, 1200);
}

function createAiWeatherPlanRouter({
  find = findGoogleWeatherLocation,
  lookup = lookupGoogleWeather,
  claimUsage = (...args) => require("../gemini-chat.js").claimGeminiChatUsage(...args),
  releaseUsage = (...args) => require("../gemini-chat.js").releaseGeminiChatUsage(...args),
  generateAdvice = generateWeatherAdvice
} = {}) {
  const router = express.Router();
  const numericOrNull = value => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
  router.post("/weather-plan", async (req, res) => {
    const locationQuery = typeof req.body?.location === "string" ? req.body.location.trim() : "";
    const activity = req.body?.activity;
    const day = req.body?.day;
    const durationHours = req.body?.durationHours;
    if (!locationQuery || locationQuery.length > 120 || !ACTIVITIES[activity] || !["today", "tomorrow"].includes(day) || ![1, 2, 3].includes(durationHours)) {
      return res.status(400).json({ error: "ระบุสถานที่ กิจกรรม วัน และระยะเวลาให้ถูกต้อง" });
    }
    let location;
    let raw;
    try {
      location = await find(locationQuery);
      raw = await lookup(location, { days: 3, hours: 48 });
    } catch (error) {
      return res.status(502).json({ code: "WEATHER_UNAVAILABLE", error: error.message || "ดึงข้อมูลอากาศไม่สำเร็จ" });
    }
    const timeZone = raw.current?.timeZone?.id || "Asia/Bangkok";
    const asOf = raw.current?.currentTime || raw.retrievedAt;
    let recommendation;
    try {
      if (!Number.isFinite(Date.parse(asOf))) throw new Error("missing timestamp");
      recommendation = recommendedSlots(raw, day, timeZone, asOf, activity, durationHours);
    } catch {
      return res.status(502).json({ code: "WEATHER_UNAVAILABLE", error: "ข้อมูลเวลาในพยากรณ์อากาศไม่ครบ กรุณาลองใหม่" });
    }
    const weather = {
      asOf,
      timeZone,
      current: {
        condition: raw.current?.weatherCondition?.description?.text || "ไม่ระบุ",
        temperatureC: numericOrNull(raw.current?.temperature?.degrees),
        rainPercent: numericOrNull(raw.current?.precipitation?.probability?.percent)
      }
    };
    let aiAdvice = "";
    let aiUsed = false;
    let claim;
    try {
      claim = await claimUsage(req.userId);
      if (claim.status === "claimed") {
        aiAdvice = await generateAdvice({ location: location.name, weather, recommendation, day, activity: ACTIVITIES[activity].label });
        aiUsed = Boolean(aiAdvice);
        if (!aiUsed) await releaseUsage(claim).catch(() => {});
      }
    } catch (error) {
      if (claim?.status === "claimed") await releaseUsage(claim).catch(() => {});
    }
    return res.json({
      source: "google-weather",
      location: location.name,
      weather,
      activity: ACTIVITIES[activity].label,
      durationHours,
      day,
      recommendation: { text: recommendation.text, slots: recommendation.slots },
      aiAdvice,
      aiUsed,
      attribution: "Source: Includes weather data from Google"
    });
  });
  return router;
}

module.exports = { createAiWeatherPlanRouter };
