const test = require("node:test");
const assert = require("node:assert/strict");
const { nextFirestoreQuotaReset, firestoreQuotaExhaustedPayload } = require("../lib/firestore-quota.js");

test("Firestore reset uses Pacific midnight during daylight saving time", () => {
  assert.equal(nextFirestoreQuotaReset(new Date("2026-09-27T01:00:00.000Z")).toISOString(), "2026-09-27T07:00:00.000Z");
});

test("Firestore reset uses Pacific midnight during standard time", () => {
  assert.equal(nextFirestoreQuotaReset(new Date("2026-12-15T18:00:00.000Z")).toISOString(), "2026-12-16T08:00:00.000Z");
});

test("quota exhausted payload reports the usable remaining quota", () => {
  const payload = firestoreQuotaExhaustedPayload(new Date("2026-09-27T01:00:00.000Z"));
  assert.equal(payload.remaining, 0);
  assert.equal(payload.dailyLimit, 50_000);
  assert.equal(payload.resetsAt, "2026-09-27T07:00:00.000Z");
});
