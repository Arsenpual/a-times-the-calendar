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
  assert.equal(payload.dailyResetAt, "2026-09-27T07:00:00.000Z");
  assert.equal(payload.resetTimeZone, "America/Los_Angeles");
});

test("October incident shows the daily reset at 14:00 Bangkok, independently of retry cooldown", () => {
  const payload = firestoreQuotaExhaustedPayload(new Date("2026-10-29T05:50:59Z"));
  assert.equal(payload.dailyResetAt, "2026-10-29T07:00:00.000Z");
  assert.equal(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).format(new Date(payload.dailyResetAt)), "14:00");
});

test("daily reset follows DST transitions and advances after midnight Pacific", () => {
  assert.equal(nextFirestoreQuotaReset(new Date("2026-11-01T07:01:00Z")).toISOString(), "2026-11-02T08:00:00.000Z");
  assert.equal(nextFirestoreQuotaReset(new Date("2026-03-08T08:01:00Z")).toISOString(), "2026-03-09T07:00:00.000Z");
  assert.equal(nextFirestoreQuotaReset(new Date("2026-10-29T07:00:00Z")).toISOString(), "2026-10-30T07:00:00.000Z");
});
