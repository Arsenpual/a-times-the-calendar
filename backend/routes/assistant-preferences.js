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

function normalizeCandidates(raw, values) {
  const source = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(Object.keys(PREFERENCE_DEFINITIONS).flatMap((key) => {
    const counts = source[key] && typeof source[key] === "object" ? source[key] : {};
    const winner = Object.entries(counts)
      .filter(([value, count]) => validValue(key, PREFERENCE_DEFINITIONS[key].type === "duration" ? Number(value) : value) && Number.isInteger(count) && count >= 2)
      .sort((a, b) => b[1] - a[1])[0];
    if (!winner) return [];
    const value = PREFERENCE_DEFINITIONS[key].type === "duration" ? Number(winner[0]) : winner[0];
    // Do not prompt a person to accept what they have already explicitly set.
    if (values[key]?.value === value) return [];
    return [[key, { value, count: winner[1] }]];
  }));
}

async function readPreferences(userId) {
  const data = (await assistantPreferencesDoc(userId).get()).data();
  const values = normalizeValues(data?.values);
  return { values, candidates: normalizeCandidates(data?.candidateCorrections, values), updatedAt: data?.updatedAt || null };
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
      candidateCorrections: { [key]: FieldValue.delete() },
      updatedAt: now
    }, { merge: true });
    res.json(await readPreferences(req.userId));
  } catch (error) { next(error); }
});

// This route receives only a narrowly scoped correction signal after a person
// changes an AI-proposed activity in the review form. It never receives chat
// transcripts or activity titles, and it only becomes a visible candidate
// after the same correction happens at least twice.
router.post("/observations", async (req, res, next) => {
  try {
    const corrections = Array.isArray(req.body?.corrections) ? req.body.corrections.slice(0, 2) : [];
    if (!corrections.length) return res.status(400).json({ error: "ไม่พบข้อมูลการแก้ไข" });
    const safe = corrections.map(({ key, value }) => {
      const typedValue = PREFERENCE_DEFINITIONS[key]?.type === "duration" ? Number(value) : value;
      if (!validValue(key, typedValue)) throw new Error("ข้อมูลการแก้ไขไม่ถูกต้อง");
      return { key, value: String(typedValue) };
    });
    await assistantPreferencesDoc(req.userId).firestore.runTransaction(async (transaction) => {
      const ref = assistantPreferencesDoc(req.userId);
      const current = (await transaction.get(ref)).data() || {};
      const next = { ...(current.candidateCorrections || {}) };
      for (const correction of safe) {
        const values = { ...(next[correction.key] || {}) };
        values[correction.value] = Math.min(10, (Number(values[correction.value]) || 0) + 1);
        next[correction.key] = values;
      }
      transaction.set(ref, { candidateCorrections: next, updatedAt: new Date().toISOString() }, { merge: true });
    });
    res.json(await readPreferences(req.userId));
  } catch (error) { next(error); }
});

router.delete("/candidates/:key", async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!PREFERENCE_DEFINITIONS[key]) return res.status(400).json({ error: "ไม่รู้จักประเภท preference นี้" });
    await assistantPreferencesDoc(req.userId).set({ [`candidateCorrections.${key}`]: FieldValue.delete(), updatedAt: new Date().toISOString() }, { merge: true });
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
