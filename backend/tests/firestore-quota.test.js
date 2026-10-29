const test = require("node:test");
const assert = require("node:assert/strict");
const { nextFirestoreQuotaReset, firestoreQuotaExhaustedPayload } = require("../lib/firestore-quota.js");

test("Firestore reset uses Pacific midnight during daylight saving time", () => {
  assert.equal(nextFirestoreQuotaReset(new Date("2026-09-27T01:00:00.000Z")).toISOString(), "2026-09-27T07:00:00.000Z");
});

test("Firestore reset uses Pacific midnight during standard time", () => {
  assert.equal(nextFirestoreQuotaReset(new Date("2026-12-15T18:00:00.000Z")).toISOString(), "2026-12-16T08:00:00.000Z");
});

test("resource exhaustion does not invent a daily read balance or reset time", () => {
  const payload = firestoreQuotaExhaustedPayload(new Date("2026-09-27T01:00:00.000Z"));
  assert.equal(payload.metric, null);
  assert.equal(payload.remaining, null);
  assert.equal(payload.dailyLimit, null);
  assert.equal(payload.resetsAt, null);
});
