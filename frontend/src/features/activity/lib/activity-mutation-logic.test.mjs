import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./activity-mutation-logic.js", import.meta.url), "utf8")
  .replace(
    'import { activityDate } from "../../../shared/lib/date-utils.js";',
    'const activityDate = (value) => new Date(value?.dateTime || `${value?.date}T00:00:00`);'
  );
const logic = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

const activities = [
  { id: "a", summary: "Work", start: { dateTime: "2027-09-02T09:00:00+07:00" }, end: { dateTime: "2027-09-02T10:00:00+07:00" } },
  { id: "b", summary: "Work (copy)", start: { dateTime: "2027-09-02T10:00:00+07:00" }, end: { dateTime: "2027-09-02T11:00:00+07:00" } },
  { id: "c", summary: "Work (copy 3)", start: { dateTime: "2027-09-02T11:00:00+07:00" }, end: { dateTime: "2027-09-02T12:00:00+07:00" } }
];

assert.equal(logic.nextActivityCopySummary(activities, "Work"), "Work (copy 4)");
assert.equal(logic.nextActivityCopySummary(activities, "Plan [A]"), "Plan [A] (copy)");

const candidates = logic.activitySaveCandidateEntries({
  activities,
  existingId: "a",
  activityBody: { start: { dateTime: "2027-09-02T12:00:00+07:00" }, end: { dateTime: "2027-09-02T13:00:00+07:00" } }
});
assert.equal(candidates.length, 3);
assert.equal(candidates.at(-1).id, "a");

const allDay = { id: "all", start: { date: "2027-09-02" }, end: { date: "2027-09-04" } };
assert.deepEqual(logic.buildActivityMoveBody({ activity: allDay, dateStr: "2027-10-31" }), {
  start: { date: "2027-10-31" },
  end: { date: "2027-11-02" }
});
assert.deepEqual(logic.buildActivityDuplicateBody({
  activity: allDay,
  summary: "All day (copy)",
  timeOverride: { start: { dateTime: "2027-10-01T09:00:00Z" }, end: { dateTime: "2027-10-01T10:00:00Z" } }
}), {
  summary: "All day (copy)",
  start: allDay.start,
  end: allDay.end
});

const timed = activities[0];
const movedTimed = logic.buildActivityMoveBody({ activity: timed, dateStr: "2027-09-10" });
assert.equal((new Date(movedTimed.end.dateTime) - new Date(movedTimed.start.dateTime)) / 3600000, 1);

console.log("PASS: Activity mutation overlap, copy naming, duplicate and timed/all-day move payloads");
