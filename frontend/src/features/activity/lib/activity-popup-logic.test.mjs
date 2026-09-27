import assert from "node:assert/strict";
import {
  formatActivityDuration,
  previousActivityPopupMode,
  shouldWarnBeforeSeriesAction
} from "./activity-popup-logic.js";

const start = new Date("2027-09-02T09:00:00Z");
assert.equal(formatActivityDuration(start, new Date("2027-09-02T09:45:00Z")), "45 นาที");
assert.equal(formatActivityDuration(start, new Date("2027-09-02T11:00:00Z")), "2 ชม.");
assert.equal(formatActivityDuration(start, new Date("2027-09-02T10:30:00Z")), "1 ชม. 30 นาที");
assert.equal(previousActivityPopupMode("confirm-delete", true), "recurring-action");
assert.equal(previousActivityPopupMode("confirm-delete", false), "menu");
assert.equal(previousActivityPopupMode("confirm-delete-series", true), "recurring-action");
assert.equal(shouldWarnBeforeSeriesAction(null), true);
assert.equal(shouldWarnBeforeSeriesAction(20), false);
assert.equal(shouldWarnBeforeSeriesAction(21), true);

console.log("PASS: Activity popup formatting, back navigation and series warning threshold");
