import assert from "node:assert/strict";
import {
  formatActivityDuration,
  previousActivityPopupMode,
  shouldWarnBeforeSeriesAction
} from "./activity-popup-logic.js";
import { createActivityPopupActions, groupActivityPopupActions } from "./activity-popup-actions.js";

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

const handlers = {
  edit() {}, moveDay() {}, duplicate() {}, selectSeries() {}, moveNextDay() {},
  openGoogle() {}, toggleLock() {}, archive() {}, delete() {}
};
const normalActions = createActivityPopupActions({
  activity: { htmlLink: "https://calendar.google.com" }, locked: false, isRecurring: false,
  restrictedToLock: false, busyAction: null, lockFeedback: null, handlers
});
const normalGroups = groupActivityPopupActions(normalActions);
assert.deepEqual(normalGroups.frequent.map((action) => action.id), ["edit", "move-day", "duplicate"]);
assert.ok(normalGroups.manage.some((action) => action.id === "toggle-lock"));
assert.deepEqual(normalGroups.danger.map((action) => action.id), ["delete"]);

const restrictedActions = createActivityPopupActions({
  activity: {}, locked: false, isRecurring: false, restrictedToLock: true,
  busyAction: null, lockFeedback: null, handlers
});
assert.deepEqual(restrictedActions.map((action) => action.id), ["toggle-lock"]);

const lockedActions = createActivityPopupActions({
  activity: {}, locked: true, isRecurring: true, restrictedToLock: false,
  busyAction: null, lockFeedback: null, handlers
});
assert.ok(lockedActions.some((action) => action.id === "unlock" && action.group === "frequent"));
assert.ok(lockedActions.find((action) => action.id === "edit")?.disabled);

console.log("PASS: Activity popup formatting, back navigation and series warning threshold");
