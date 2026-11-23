const WEATHER_API_BASE = "https://weather.googleapis.com/v1";
const GEOCODING_API_URL = "https://geocode.googleapis.com/v4/geocode/address";

function weatherApiKey() {
  const key = String(process.env.GOOGLE_WEATHER_API_KEY || "").trim();
  if (!key) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_WEATHER_API_KEY ใน environment ของ backend");
  return key;
}

function googleErrorDetail(payload) {
  let detail = String(payload?.error_message || payload?.error?.message || "");
  const key = String(process.env.GOOGLE_WEATHER_API_KEY || "").trim();
  if (key) detail = detail.split(key).join("[redacted]");
  return detail.replace(/([?&]key=)[^\s&]+/gi, "$1[redacted]").replace(/\s+/g, " ").slice(0, 400);
}

async function googleJson(url, label, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error(`เชื่อมต่อ ${label} ไม่สำเร็จ กรุณาลองใหม่ภายหลัง`);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = googleErrorDetail(payload);
    throw new Error(`${label} ตอบ ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  if (!payload || typeof payload !== "object") throw new Error(`${label} ส่งข้อมูลที่อ่านไม่ได้`);
  return payload;
}

function coordinates(latitude, longitude) {
  if (latitude == null || longitude == null || latitude === "" || longitude === "") throw new Error("ตำแหน่งที่ส่งมาไม่ถูกต้อง");
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error("ตำแหน่งที่ส่งมาไม่ถูกต้อง");
  }
  return { latitude: lat, longitude: lng };
}

async function findGoogleWeatherLocation(query) {
  const address = String(query || "").trim();
  if (!address) throw new Error("ระบุสถานที่ที่ต้องการพยากรณ์อากาศก่อนครับ");
  // Maps Demo Keys support v4, not the legacy /maps/api/geocode/json endpoint.
  const params = new URLSearchParams({ languageCode: "th" });
  const payload = await googleJson(`${GEOCODING_API_URL}/${encodeURIComponent(address)}?${params}`, "Google Geocoding API v4", {
    headers: { "X-Goog-Api-Key": weatherApiKey(), "X-Goog-FieldMask": "results.location,results.formattedAddress" }
  });
  const result = payload?.results?.[0];
  if (!result) throw new Error("ไม่พบสถานที่นี้จาก Google Maps");
  if (!result.location) throw new Error("Google Geocoding API v4 ส่งพิกัดที่อ่านไม่ได้");
  if (payload.results.length > 1) throw new Error("พบสถานที่ไม่ชัดเจน กรุณาระบุอำเภอ จังหวัด หรือส่งพิกัด");
  return {
    name: result.formattedAddress || address,
    ...coordinates(result.location.latitude, result.location.longitude)
  };
}

async function lookupGoogleWeather(location, { days = 3, hours = 0 } = {}) {
  const { latitude, longitude } = coordinates(location.latitude, location.longitude);
  const key = weatherApiKey();
  const query = { key, "location.latitude": String(latitude), "location.longitude": String(longitude), languageCode: "th", unitsSystem: "METRIC" };
  const currentParams = new URLSearchParams(query);
  const forecastParams = new URLSearchParams({ ...query, days: String(Math.max(1, Math.min(Number(days) || 3, 10))) });
  const [current, daily] = await Promise.all([
    googleJson(`${WEATHER_API_BASE}/currentConditions:lookup?${currentParams}`, "Google Weather API"),
    googleJson(`${WEATHER_API_BASE}/forecast/days:lookup?${forecastParams}`, "Google Weather API")
  ]);
  const hourly = [];
  let pageToken;
  const seenTokens = new Set();
  if (hours > 0) {
    do {
      const params = new URLSearchParams({ ...query, hours: String(Math.min(hours, 48)), pageSize: "24" });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await googleJson(`${WEATHER_API_BASE}/forecast/hours:lookup?${params}`, "Google Weather API");
      hourly.push(...(page?.forecastHours || []));
      pageToken = page?.nextPageToken;
      if (pageToken && seenTokens.has(pageToken)) throw new Error("Google Weather API ส่งหน้าข้อมูลซ้ำ กรุณาลองใหม่ภายหลัง");
      if (pageToken) seenTokens.add(pageToken);
      if (seenTokens.size > 48) throw new Error("Google Weather API ส่งข้อมูลไม่ครบ กรุณาลองใหม่ภายหลัง");
    } while (pageToken && hourly.length < Math.min(hours, 48));
  }
  return { location: { ...location, latitude, longitude }, current, daily: daily?.forecastDays || [], hourly, retrievedAt: new Date().toISOString() };
}

module.exports = { findGoogleWeatherLocation, lookupGoogleWeather, coordinates };
