const WEATHER_API_BASE = "https://weather.googleapis.com/v1";
const GEOCODING_API_URL = "https://maps.googleapis.com/maps/api/geocode/json";

function weatherApiKey() {
  const key = String(process.env.GOOGLE_WEATHER_API_KEY || "").trim();
  if (!key) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_WEATHER_API_KEY ใน environment ของ backend");
  return key;
}

async function googleJson(url, label) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${label} ตอบ ${response.status}`);
  return payload;
}

function coordinates(latitude, longitude) {
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
  const params = new URLSearchParams({ address, language: "th", key: weatherApiKey() });
  const payload = await googleJson(`${GEOCODING_API_URL}?${params}`, "Google Geocoding API");
  const result = payload?.results?.[0];
  if (payload?.status !== "OK" || !result?.geometry?.location) throw new Error("ไม่พบสถานที่นี้จาก Google Maps");
  return {
    name: result.formatted_address || address,
    ...coordinates(result.geometry.location.lat, result.geometry.location.lng)
  };
}

async function lookupGoogleWeather(location, { days = 3 } = {}) {
  const { latitude, longitude } = coordinates(location.latitude, location.longitude);
  const key = weatherApiKey();
  const query = { key, "location.latitude": String(latitude), "location.longitude": String(longitude), languageCode: "th", unitsSystem: "METRIC" };
  const currentParams = new URLSearchParams(query);
  const forecastParams = new URLSearchParams({ ...query, days: String(Math.max(1, Math.min(Number(days) || 3, 10))) });
  const [current, daily] = await Promise.all([
    googleJson(`${WEATHER_API_BASE}/currentConditions:lookup?${currentParams}`, "Google Weather API"),
    googleJson(`${WEATHER_API_BASE}/forecast/days:lookup?${forecastParams}`, "Google Weather API")
  ]);
  return { location: { ...location, latitude, longitude }, current, daily: daily?.forecastDays || [] };
}

module.exports = { findGoogleWeatherLocation, lookupGoogleWeather, coordinates };
