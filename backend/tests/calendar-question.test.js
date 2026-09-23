const test = require("node:test");
const assert = require("node:assert/strict");
const { answerDeterministicCalendarQuestion, calendarRangeForQuestion, isCalendarQuestion, isDeterministicCalendarQuestion } = require("../calendar-question.js");

test("calendar questions detect common Thai planning intents", () => {
  assert.equal(isCalendarQuestion("พรุ่งนี้ว่างช่วงไหน?"), true);
  assert.equal(isCalendarQuestion("สรุปตารางสัปดาห์นี้"), true);
  assert.equal(isCalendarQuestion("เดือนนี้มีนัดอะไรบ้าง?"), true);
  assert.equal(isCalendarQuestion("ทำการบ้านพรุ่งนี้ 20:00 2 ชม."), false);
  assert.equal(isCalendarQuestion("ช่วยจัดตารางวันนี้ให้สมดุลหน่อย"), true);
});

test("factual Calendar questions are answered without an AI interpretation", () => {
  const context = {
    range: { start: "2026-09-22", end: "2026-09-22", label: "2026-09-22" },
    events: [
      { title: "ประชุมทีม", start: "2026-09-22T02:00:00.000Z", end: "2026-09-22T03:00:00.000Z", allDay: false },
      { title: "อ่านหนังสือ", start: "2026-09-22T04:00:00.000Z", end: "2026-09-22T05:00:00.000Z", allDay: false }
    ]
  };
  assert.equal(isDeterministicCalendarQuestion("วันนี้มีอะไรบ้าง?"), true);
  assert.match(answerDeterministicCalendarQuestion("วันนี้มีอะไรบ้าง?", context), /ประชุมทีม/);
  assert.match(answerDeterministicCalendarQuestion("พรุ่งนี้ว่างช่วงไหน?", context), /ช่วงว่าง/);
  assert.equal(isDeterministicCalendarQuestion("ช่วยจัดตารางวันนี้ให้สมดุลหน่อย"), false);
});

test("calendar question date ranges stay bounded and support past/current/next periods", () => {
  const referenceDate = "2026-09-22";
  assert.deepEqual(calendarRangeForQuestion("เมื่อวานมีอะไร?", referenceDate).label, "2026-09-21");
  assert.deepEqual(calendarRangeForQuestion("สัปดาห์นี้ว่างไหม?", referenceDate).label, "2026-09-20 ถึง 2026-09-26");
  assert.deepEqual(calendarRangeForQuestion("สัปดาห์หน้ามีนัดอะไร?", referenceDate).label, "2026-09-27 ถึง 2026-10-03");
  assert.deepEqual(calendarRangeForQuestion("เดือนก่อนมีประชุมกี่ครั้ง?", referenceDate).label, "2026-08-01 ถึง 2026-08-31");
});
