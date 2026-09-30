const express = require("express");
const { FieldValue } = require("firebase-admin/firestore");
const { assistantPreferencesDoc } = require("../firestore-db.js");
const {
  PREFERENCE_DEFINITIONS,
  validPreferenceValue,
  normalizePreferenceValues,
  normalizePreferenceCandidates,
  normalizeObservationCorrections
} = require("../skills/activity-creation/preferences.js");

const router = express.Router();

async function readPreferences(userId) {
  const data = (await assistantPreferencesDoc(userId).get()).data();
  const values = normalizePreferenceValues(data?.values);
  return { values, candidates: normalizePreferenceCandidates(data?.candidateCorrections, values), updatedAt: data?.updatedAt || null };
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
    if (!validPreferenceValue(key, value) || typeof enabled !== "boolean") return res.status(400).json({ error: "ค่า preference ไม่ถูกต้อง" });
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
    const safe = normalizeObservationCorrections(req.body?.corrections);
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
