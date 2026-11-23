import assert from "node:assert/strict";
import test from "node:test";
import { assertWeatherDraftCurrent, isWeatherSlotStillRecommended } from "../lib/weather-slot-validation.js";

const slot = { start: "2026-10-29T02:00:00Z", end: "2026-10-29T03:00:00Z", score: 88, reasons: ["โอกาสฝน 10%"] };

test("weather slot recheck accepts only an unchanged recommendation", () => {
  assert.equal(isWeatherSlotStillRecommended(slot, { recommendation: { slots: [slot] } }), true);
  assert.equal(isWeatherSlotStillRecommended(slot, { recommendation: { slots: [{ ...slot, score: 70 }] } }), false);
  assert.equal(isWeatherSlotStillRecommended(slot, { recommendation: { slots: [{ ...slot, reasons: ["โอกาสฝน 30%"] }] } }), false);
  assert.equal(isWeatherSlotStillRecommended(slot, { recommendation: { slots: [] } }), false);
});

test("weather draft rechecks at save without AI and blocks changed forecasts or edited time", async () => {
  const validation = { request: { location: "กรุงเทพฯ", activity: "outdoor", day: "tomorrow", durationHours: 1 }, slot };
  const activityBody = { start: { dateTime: slot.start }, end: { dateTime: slot.end } };
  let calls = 0;
  await assertWeatherDraftCurrent({ validation, activityBody, fetchPlan: async (request) => {
    calls += 1;
    assert.equal(request.includeAdvice, false);
    return { recommendation: { slots: [slot] } };
  } });
  assert.equal(calls, 1);
  await assert.rejects(assertWeatherDraftCurrent({ validation, activityBody, fetchPlan: async () => ({ recommendation: { slots: [] } }) }), /พยากรณ์อากาศเปลี่ยนแล้ว/);
  await assert.rejects(assertWeatherDraftCurrent({ validation, activityBody: { ...activityBody, end: { dateTime: "2026-10-29T04:00:00Z" } }, fetchPlan: async () => { throw new Error("must not fetch"); } }), /เวลาในร่างเปลี่ยน/);
});
