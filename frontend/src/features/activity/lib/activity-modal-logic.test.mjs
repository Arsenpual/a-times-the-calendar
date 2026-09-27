import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./activity-modal-logic.js", import.meta.url), "utf8")
  .replace(
    'import { combineDateAndTime, toDateInputValue } from "../../../shared/lib/date-utils.js";',
    `const toDateInputValue = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return \`${'${year}'}-${'${month}'}-${'${day}'}\`;
    };
    const combineDateAndTime = (dateValue, timeValue) => new Date(\`${'${dateValue}'}T${'${timeValue}'}:00\`);`
  )
  .replace(
    'import { buildRRule } from "./rrule-utils.js";',
    "const buildRRule = () => null;"
  );

const {
  activityDatePlusDays,
  activityDateTimeValue,
  buildActivityCalendarBody,
  canonicalAllDayDate,
  computeActivityStartEnd,
  normalizeActivityRepeatState
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

assert.equal(activityDateTimeValue("2027-09-02", "11:21"), "2027-09-02T11:21");
assert.equal(activityDateTimeValue("", "11:21"), "");
assert.equal(activityDatePlusDays("2027-12-31", 1), "2028-01-01");
assert.equal(canonicalAllDayDate("2027-09-02"), "2027-09-02");
assert.equal(canonicalAllDayDate("2027-02-30"), "");

assert.deepEqual(
  normalizeActivityRepeatState({ end: "never", count: 40 }, 28),
  { end: "count", count: 28 }
);
assert.deepEqual(
  normalizeActivityRepeatState({ end: "count", count: 60 }, 28),
  { end: "count", count: 28 }
);

const overnight = computeActivityStartEnd({
  date: "2027-09-02",
  startTime: "23:00",
  endDate: "2027-09-02",
  endTime: "01:00"
});
assert.equal((overnight.end - overnight.start) / 3600000, 2);

const repeatNone = { mode: "none", freq: "DAILY", interval: 1, end: "count", count: 1, byDay: [], until: "" };
assert.deepEqual(buildActivityCalendarBody({
  title: " ทั้งวัน ",
  notes: "",
  isAllDay: true,
  date: "2027-09-02",
  endDate: "2027-09-03",
  startTime: "00:00",
  endTime: "00:00",
  recurrenceEditable: true,
  repeat: repeatNone,
  isEditing: false,
  initialRecurrence: null,
  timeZone: "Asia/Bangkok"
}), {
  summary: "ทั้งวัน",
  description: null,
  start: { date: "2027-09-02" },
  end: { date: "2027-09-03" }
});

const timed = buildActivityCalendarBody({
  title: "กลางคืน",
  notes: "note",
  isAllDay: false,
  date: "2027-09-02",
  endDate: "2027-09-02",
  startTime: "23:00",
  endTime: "01:00",
  recurrenceEditable: true,
  repeat: repeatNone,
  isEditing: false,
  initialRecurrence: null,
  timeZone: "Asia/Bangkok"
});
assert.equal(timed.summary, "กลางคืน");
assert.equal(timed.description, "note");
assert.equal(timed.start.timeZone, "Asia/Bangkok");
assert.equal((new Date(timed.end.dateTime) - new Date(timed.start.dateTime)) / 3600000, 2);

console.log("PASS: Activity modal dates, all-day payload, overnight payload and repeat normalization");
