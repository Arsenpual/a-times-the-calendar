// Explicit, small preference schema for MR.Zettascale. This module has no
// Firebase dependency so its safety rules can be tested without credentials.
const PREFERENCE_DEFINITIONS = {
  homeworkDefaultStart: { type: "time", title: "เวลาเริ่มทำการบ้าน" },
  homeworkDefaultDurationMinutes: { type: "duration", title: "ระยะเวลาทำการบ้าน" },
  exerciseDefaultDurationMinutes: { type: "duration", title: "ระยะเวลาออกกำลังกาย" },
  preferredEveningStart: { type: "time", title: "เวลาเริ่มช่วงเย็น" }
};

function validPreferenceValue(key, value) {
  const definition = PREFERENCE_DEFINITIONS[key];
  if (!definition) return false;
  if (definition.type === "time") return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  return Number.isInteger(value) && value >= 15 && value <= 720;
}

function normalizePreferenceValues(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(Object.keys(PREFERENCE_DEFINITIONS).flatMap((key) => {
    const item = source[key];
    if (!item || !validPreferenceValue(key, item.value)) return [];
    return [[key, { value: item.value, enabled: item.enabled !== false, updatedAt: item.updatedAt || null }]];
  }));
}

function normalizePreferenceCandidates(raw, values) {
  const source = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(Object.keys(PREFERENCE_DEFINITIONS).flatMap((key) => {
    const counts = source[key] && typeof source[key] === "object" ? source[key] : {};
    const winner = Object.entries(counts)
      .filter(([value, count]) => validPreferenceValue(key, PREFERENCE_DEFINITIONS[key].type === "duration" ? Number(value) : value) && Number.isInteger(count) && count >= 2)
      .sort((a, b) => b[1] - a[1])[0];
    if (!winner) return [];
    const value = PREFERENCE_DEFINITIONS[key].type === "duration" ? Number(winner[0]) : winner[0];
    if (values[key]?.value === value) return [];
    return [[key, { value, count: winner[1] }]];
  }));
}

function normalizeObservationCorrections(raw) {
  const corrections = Array.isArray(raw) ? raw.slice(0, 2) : [];
  if (!corrections.length) throw new Error("ไม่พบข้อมูลการแก้ไข");
  const keys = new Set();
  return corrections.map(({ key, value }) => {
    if (keys.has(key)) throw new Error("ส่งข้อมูลการแก้ไขซ้ำกัน");
    keys.add(key);
    const typedValue = PREFERENCE_DEFINITIONS[key]?.type === "duration" ? Number(value) : value;
    if (!validPreferenceValue(key, typedValue)) throw new Error("ข้อมูลการแก้ไขไม่ถูกต้อง");
    return { key, value: String(typedValue) };
  });
}

module.exports = {
  PREFERENCE_DEFINITIONS,
  validPreferenceValue,
  normalizePreferenceValues,
  normalizePreferenceCandidates,
  normalizeObservationCorrections
};
