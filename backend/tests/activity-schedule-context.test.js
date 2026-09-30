const { test } = require("node:test");
const assert = require("node:assert/strict");
const { assessDraftSchedule, buildAvailableWindows, findFreeTimeOptions } = require("../skills/activity-creation/schedule-context.js");

const draft = { title: "ร่างกิจกรรม", startLocal: "2026-09-16T10:00", endLocal: "2026-09-16T11:00", allDay: false };
const activity = (id, title, startLocal, endLocal, locked = false) => ({ id, title, startLocal, endLocal, locked });

test("unrelated calendar overcrowding does not invalidate a free draft", () => {
  const activities = [1, 2, 3, 4].map(id => activity(String(id), "busy", "2026-09-16T08:00", "2026-09-16T09:00"));
  assert.equal(assessDraftSchedule(draft, { activities }).status, "available");
});

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
  assert.equal(schedule.alternatives.length, 3);
  assert.ok(schedule.alternatives.every((alternative) => alternative.startLocal !== draft.startLocal));
});

test("all-day drafts are not evaluated as timed overlaps", () => {
  const schedule = assessDraftSchedule({ ...draft, allDay: true }, { activities: [activity("one", "งานหนึ่ง", "2026-09-16T09:00", "2026-09-16T12:00")] });
  assert.equal(schedule.status, "not-applicable");
});

test("an existing all-day range counts toward a timed draft's overlap limit", () => {
  const schedule = assessDraftSchedule(draft, { activities: [
    activity("all-day", "กิจกรรมทั้งวัน", "2026-09-16T00:00", "2026-09-17T00:00"),
    activity("one", "งานหนึ่ง", "2026-09-16T09:30", "2026-09-16T11:30"),
    activity("two", "งานสอง", "2026-09-16T09:45", "2026-09-16T11:15")
  ] });
  assert.equal(schedule.status, "overlap-limit");
  assert.equal(schedule.conflicts.length, 3);
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

test("today's available windows and alternatives do not point into the past", () => {
  const context = {
    windowStartLocal: "2026-09-16T00:00",
    windowEndLocal: "2026-09-17T00:00",
    currentLocal: "2026-09-16T14:30",
    activities: [
      activity("one", "งานหนึ่ง", "2026-09-16T14:30", "2026-09-16T16:00"),
      activity("two", "งานสอง", "2026-09-16T14:30", "2026-09-16T16:00"),
      activity("three", "งานสาม", "2026-09-16T14:30", "2026-09-16T16:00")
    ]
  };
  assert.deepEqual(buildAvailableWindows(context).slice(0, 2), [
    { startLocal: "2026-09-16T16:00", endLocal: "2026-09-16T22:00" }
  ]);
  const schedule = assessDraftSchedule({ ...draft, startLocal: "2026-09-16T14:30", endLocal: "2026-09-16T15:30" }, context);
  assert.equal(schedule.status, "overlap-limit");
  assert.ok(schedule.alternatives.every((alternative) => alternative.startLocal >= "2026-09-16T14:30"));
});

test("find-time options fit the requested duration and date without overlaps", () => {
  const options = findFreeTimeOptions({
    windowStartLocal: "2026-09-16T00:00",
    windowEndLocal: "2026-09-18T00:00",
    activities: [activity("busy", "ประชุม", "2026-09-17T08:00", "2026-09-17T10:00")]
  }, 60, "2026-09-17");
  assert.deepEqual(options, [
    { startLocal: "2026-09-17T10:00", endLocal: "2026-09-17T11:00" },
    { startLocal: "2026-09-17T10:30", endLocal: "2026-09-17T11:30" },
    { startLocal: "2026-09-17T11:00", endLocal: "2026-09-17T12:00" }
  ]);
});
