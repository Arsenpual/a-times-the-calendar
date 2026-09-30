const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizePreferenceValues, normalizePreferenceCandidates, normalizeObservationCorrections } = require("../skills/activity-creation/preferences.js");

test("assistant preferences retain only explicit valid and inspectable values", () => {
  const values = normalizePreferenceValues({
    homeworkDefaultStart: { value: "18:30", enabled: true },
    preferredEveningStart: { value: "25:00", enabled: true },
    exerciseDefaultDurationMinutes: { value: 60, enabled: false }
  });
  assert.deepEqual(Object.keys(values).sort(), ["exerciseDefaultDurationMinutes", "homeworkDefaultStart"]);
  assert.equal(values.exerciseDefaultDurationMinutes.enabled, false);
});

test("a correction becomes a candidate only after two separate observations", () => {
  const values = normalizePreferenceValues({});
  assert.deepEqual(normalizePreferenceCandidates({ homeworkDefaultStart: { "18:30": 1 } }, values), {});
  assert.deepEqual(normalizePreferenceCandidates({ homeworkDefaultStart: { "18:30": 2 } }, values), {
    homeworkDefaultStart: { value: "18:30", count: 2 }
  });
});

test("one save cannot artificially count the same preference correction twice", () => {
  assert.throws(() => normalizeObservationCorrections([
    { key: "homeworkDefaultStart", value: "18:30" },
    { key: "homeworkDefaultStart", value: "18:30" }
  ]), /ซ้ำกัน/);
  assert.deepEqual(normalizeObservationCorrections([
    { key: "homeworkDefaultStart", value: "18:30" },
    { key: "homeworkDefaultDurationMinutes", value: 90 }
  ]), [
    { key: "homeworkDefaultStart", value: "18:30" },
    { key: "homeworkDefaultDurationMinutes", value: "90" }
  ]);
});
