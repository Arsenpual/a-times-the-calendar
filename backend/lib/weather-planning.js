const ACTIVITIES = Object.freeze({
  outdoor: { label: "กิจกรรมกลางแจ้ง", button: "🌤 กลางแจ้ง", rainWeight: 1.2, windLimit: 28, idealMin: 21, idealMax: 31, from: 6, until: 22 },
  exercise: { label: "ออกกำลังกาย", button: "🏃 ออกกำลัง", rainWeight: 1.6, windLimit: 22, idealMin: 20, idealMax: 29, from: 6, until: 22 },
  travel: { label: "เดินทาง", button: "🧳 เดินทาง", rainWeight: 1.25, windLimit: 35, idealMin: 19, idealMax: 33, from: 0, until: 24 },
  laundry: { label: "ซัก/ตากผ้า", button: "👕 ซักผ้า", rainWeight: 1.8, windLimit: 40, idealMin: 22, idealMax: 34, from: 7, until: 18 }
});
function localDay(iso, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type).value).join("-");
}
function stamp(iso, timeZone) {
  return new Intl.DateTimeFormat("th-TH", { timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function localHour(iso, timeZone) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date(iso)));
}
function optionalNumber(value) {
  return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
}
function weatherHours(weather, mode, timeZone, now) {
  const today = localDay(now, timeZone);
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const target = mode === "tomorrow" ? tomorrow.toISOString().slice(0, 10) : today;
  return { target, hours: (weather.hourly || []).filter(hour => Number.isFinite(Date.parse(hour.interval?.startTime)) && localDay(hour.interval.startTime, timeZone) === target) };
}
function windKph(hour) {
  const speed = hour?.wind?.speed;
  const value = optionalNumber(speed?.value);
  if (value == null || value < 0) return null;
  const factor = { KILOMETERS_PER_HOUR: 1, MILES_PER_HOUR: 1.609344, METERS_PER_SECOND: 3.6 }[speed.unit];
  return factor ? value * factor : null;
}
function rankHour(hour, activity, timeZone) {
  const preset = ACTIVITIES[activity] || ACTIVITIES.outdoor;
  const precipitation = optionalNumber(hour?.precipitation?.probability?.percent);
  const degrees = optionalNumber(hour?.temperature?.degrees);
  const wind = windKph(hour);
  const valid = precipitation != null && precipitation >= 0 && precipitation <= 100 &&
    degrees != null && (!hour.temperature.unit || hour.temperature.unit === "CELSIUS") && wind != null;
  const reasons = [];
  if (!valid) return { hour, score: null, reasons: ["ข้อมูลฝน อุณหภูมิ หรือลมไม่ครบ"], localHour: localHour(hour.interval.startTime, timeZone) };
  const outside = Math.max(0, preset.idealMin - degrees, degrees - preset.idealMax);
  let score = 100 - precipitation * preset.rainWeight - outside * 5 - Math.min(30, Math.max(0, wind - preset.windLimit) * 2);
  reasons.push(`โอกาสฝน ${Math.round(precipitation)}%`, `${Math.round(degrees)}°C`, `ลม ${Math.round(wind)} กม./ชม.`);
  const thunder = optionalNumber(hour.thunderstormProbability);
  if (/THUNDERSTORM/.test(hour.weatherCondition?.type || "") || (thunder != null && thunder >= 30)) {
    score = 0;
    reasons.push("มีพยากรณ์พายุฝนฟ้าคะนอง");
  }
  return { hour, score: Math.max(0, Math.min(100, Math.round(score))), reasons, localHour: localHour(hour.interval.startTime, timeZone) };
}
function recommendedSlots(weather, mode, timeZone, now, activity = "outdoor", duration = 1) {
  const preset = ACTIVITIES[activity] || ACTIVITIES.outdoor;
  const length = [1, 2, 3].includes(duration) ? duration : 1;
  const empty = text => ({ activity: preset.label, duration: length, slots: [], text });
  if (mode === "days") return empty("เลือก วันนี้ หรือ พรุ่งนี้ เพื่อหาช่วงเวลา");
  const { hours } = weatherHours(weather, mode, timeZone, now);
  const ranked = hours.filter(h => Number.isFinite(Date.parse(h.interval?.startTime)))
    .sort((a, b) => Date.parse(a.interval.startTime) - Date.parse(b.interval.startTime))
    .map(hour => rankHour(hour, activity, timeZone));
  const candidates = [];
  for (let index = 0; index < ranked.length; index++) {
    const window = ranked.slice(index, index + length);
    if (window.length !== length) continue;
    const start = Date.parse(window[0].hour.interval.startTime);
    if (start < Date.parse(now)) continue;
    if (window.some((item, offset) => {
      const at = Date.parse(item.hour.interval.startTime);
      const end = item.hour.interval.endTime ? Date.parse(item.hour.interval.endTime) : at + 3_600_000;
      return item.score == null || item.score < 50 || item.localHour < preset.from ||
        item.localHour >= preset.until || at !== start + offset * 3_600_000 || end !== at + 3_600_000;
    })) continue;
    const end = start + length * 3_600_000;
    const score = Math.min(...window.map(item => item.score));
    const worst = window.find(item => item.score === score);
    candidates.push({ start, end, score, reasons: worst.reasons });
  }
  candidates.sort((a, b) => b.score - a.score || a.start - b.start);
  const chosen = [];
  for (const item of candidates) {
    if (chosen.every(other => item.end <= other.start || item.start >= other.end)) chosen.push(item);
    if (chosen.length === 3) break;
  }
  if (!chosen.length) return empty(`ยังไม่มีช่วง ${length} ชม. ที่ข้อมูลครบและผ่านเกณฑ์สำหรับ${preset.label} ลองเปลี่ยนวันหรือระยะเวลา`);
  const slots = chosen.map(item => ({
    start: new Date(item.start).toISOString(), end: new Date(item.end).toISOString(),
    at: `${stamp(item.start, timeZone)}–${new Intl.DateTimeFormat("th-TH", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(item.end))}`,
    score: item.score, reasons: item.reasons
  }));
  return {
    activity: preset.label, duration: length, slots,
    text: `${preset.label} · ${length} ชม.\n${slots.map((slot, index) => `${index === 0 ? "แนะนำ" : `สำรอง ${index}`}: ${slot.at}\n  ${slot.reasons.join(" · ")}`).join("\n")}\nเกณฑ์เปรียบเทียบของแอป ไม่รับประกันสภาพอากาศ`
  };
}
module.exports = { ACTIVITIES, localDay, stamp, weatherHours, rankHour, recommendedSlots };
