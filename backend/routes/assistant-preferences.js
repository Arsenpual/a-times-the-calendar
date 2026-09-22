const express = require("express");
const { FieldValue } = require("firebase-admin/firestore");
const { assistantPreferencesDoc } = require("../firestore-db.js");

const router = express.Router();

// A small explicit schema makes every retained value inspectable. Do not add
// free-form conversation text here: this document is preference memory, not a
// chat transcript.
const PREFERENCE_DEFINITIONS = {
  homeworkDefaultStart: { type: "time", title: "เวลาเริ่มทำการบ้าน" },
  homeworkDefaultDurationMinutes: { type: "duration", title: "ระยะเวลาทำการบ้าน" },
  exerciseDefaultDurationMinutes: { type: "duration", title: "ระยะเวลาออกกำลังกาย" },
  preferredEveningStart: { type: "time", title: "เวลาเริ่มช่วงเย็น" }
};

function validValue(key, value) {
  const definition = PREFERENCE_DEFINITIONS[key];
  if (!definition) return false;
  if (definition.type === "time") return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  return Number.isInteger(value) && value >= 15 && value <= 720;
}

function normalizeValues(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(Object.keys(PREFERENCE_DEFINITIONS).flatMap((key) => {
    const item = source[key];
    if (!item || !validValue(key, item.value)) return [];
    return [[key, { value: item.value, enabled: item.enabled !== false, updatedAt: item.updatedAt || null }]];
  }));
}

async function readPreferences(userId) {
  const data = (await assistantPreferencesDoc(userId).get()).data();
  return { values: normalizeValues(data?.values), updatedAt: data?.updatedAt || null };
}

router.get("/", async (req, res, next) => {
  try { res.json(await readPreferences(req.userId)); }
  catch (error) { next(error); }
});

router.put("/:key", async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!PREFERENCE_DEFINITIONS[key]) return res.status(400).json({ error: "ไม่รู้จักประเภท preference นี้" });
    const { value, enabled = true } = req.body || {};
    if (!validValue(key, value) || typeof enabled !== "boolean") return res.status(400).json({ error: "ค่า preference ไม่ถูกต้อง" });
    const now = new Date().toISOString();
    await assistantPreferencesDoc(req.userId).set({
      values: { [key]: { value, enabled, updatedAt: now } },
      updatedAt: now
    }, { merge: true });
    res.json(await readPreferences(req.userId));
  } catch (error) { next(error); }
});

router.delete("/:key", async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!PREFERENCE_DEFINITIONS[key]) return res.status(400).json({ error: "ไม่รู้จักประเภท preference นี้" });
    await assistantPreferencesDoc(req.userId).set({ [`values.${key}`]: FieldValue.delete(), updatedAt: new Date().toISOString() }, { merge: true });
    res.json(await readPreferences(req.userId));
  } catch (error) { next(error); }
});

module.exports = router;
module.exports.PREFERENCE_DEFINITIONS = PREFERENCE_DEFINITIONS;
module.exports.normalizeValues = normalizeValues;
