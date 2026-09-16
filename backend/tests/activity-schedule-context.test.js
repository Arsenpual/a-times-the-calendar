const { test } = require("node:test");
const assert = require("node:assert/strict");
const { assessDraftSchedule, buildAvailableWindows } = require("../skills/activity-creation/schedule-context.js");

const draft = { title: "ร่างกิจกรรม", startLocal: "2026-09-16T10:00", endLocal: "2026-09-16T11:00", allDay: false };
const activity = (id, title, startLocal, endLocal, locked = false) => ({ id, title, startLocal, endLocal, locked });

test("a draft may share a time range with up to three activities", () => {
  const schedule = assessDraftSchedule(draft, { activities: [
    activity("one", "งานหนึ่ง", "2026-09-16T09:30", "2026-09-16T10:30"),
    activity("two", "งานสอง", "2026-09-16T10:00", "2026-09-16T11:00")
  ] });
  assert.equal(schedule.status, "available");
  assert.equal(schedule.conflicts.length, 2);
});

test("a fourth overlapping activity is blocked and offers nearby alternatives", () => {
  const schedule = assessDraftSchedule(draft, { activities: [
    activity("one", "งานหนึ่ง", "2026-09-16T09:30", "2026-09-16T11:30", true),
    activity("two", "งานสอง", "2026-09-16T09:45", "2026-09-16T11:15"),
    activity("three", "งานสาม", "2026-09-16T10:00", "2026-09-16T11:00")
  ] });
  assert.equal(schedule.status, "overlap-limit");
  assert.equal(schedule.conflicts.length, 3);
  assert.equal(schedule.conflicts[0].locked, true);
  assert.ok(schedule.alternatives.length > 0);
  assert.ok(schedule.alternatives.every((alternative) => alternative.startLocal !== draft.startLocal));
});

test("all-day drafts are not evaluated as timed overlaps", () => {
  const schedule = assessDraftSchedule({ ...draft, allDay: true }, { activities: [activity("one", "งานหนึ่ง", "2026-09-16T09:00", "2026-09-16T12:00")] });
  assert.equal(schedule.status, "not-applicable");
});

test("available windows are compact, daytime-only schedule hints", () => {
  const windows = buildAvailableWindows({
    windowStartLocal: "2026-09-16T00:00",
    windowEndLocal: "2026-09-17T00:00",
    activities: [activity("one", "ประชุม", "2026-09-16T10:00", "2026-09-16T11:00")]
  });
  assert.deepEqual(windows, [
    { startLocal: "2026-09-16T08:00", endLocal: "2026-09-16T10:00" },
    { startLocal: "2026-09-16T11:00", endLocal: "2026-09-16T22:00" }
  ]);
});
