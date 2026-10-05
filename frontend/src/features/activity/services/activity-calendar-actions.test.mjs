import assert from "node:assert/strict";
import { createActivityCalendarActions } from "./activity-calendar-actions.js";

const state = {
  activities: [],
  categoryMap: {},
  tagMap: {},
  locks: {},
  errors: [],
  calls: []
};
const setter = (key) => (updater) => {
  state[key] = typeof updater === "function" ? updater(state[key]) : updater;
};
const common = {
  calendarAccessToken: "token",
  activities: state.activities,
  setActivities: setter("activities"),
  activityCategoryMap: state.categoryMap,
  setActivityCategoryMap: setter("categoryMap"),
  activityTagMap: state.tagMap,
  setActivityTagMap: setter("tagMap"),
  lockedActivities: state.locks,
  setLockedActivities: setter("locks"),
  getActivity: async () => null,
  createActivity: async (_token, body) => ({ id: "created", ...body }),
  updateActivity: async (_token, id, body) => ({ id, summary: "updated", ...body }),
  deleteActivity: async (_token, id) => { state.calls.push(["delete", id]); },
  fetchRecurringInstances: async () => [{}, {}],
  assignActivityCategory: async (id, categoryId) => { state.calls.push(["category", id, categoryId]); },
  setActivityTags: async (id, tags) => { state.calls.push(["tags", id, tags]); },
  setActivityLocked: async (id, locked) => { state.calls.push(["lock", id, locked]); },
  deleteActivityNotification: async (id) => { state.calls.push(["delete-notification", id]); },
  syncActivityNotification: async (activity) => { state.calls.push(["notification", activity.id]); },
  clearTokenIfExpired: () => {},
  checkConflict: async () => false,
  isCalendarAuthExpiredError: () => false,
  setCalendarAccessToken: () => {},
  setError: (message) => state.errors.push(message),
  loadActivities: async () => { state.calls.push(["reload"]); },
  refreshTagSearchIfActive: () => { state.calls.push(["refresh-tags"]); }
};

const actions = createActivityCalendarActions(common);
await actions.handleSaveActivity({
  activityBody: { summary: "Focus", start: { dateTime: "2027-09-02T09:00:00Z" }, end: { dateTime: "2027-09-02T10:00:00Z" } },
  categoryId: "work",
  tags: ["deep"],
  existingId: null,
  knownUpdated: null
});
assert.equal(state.categoryMap.created, "work");
assert.deepEqual(state.tagMap.created, ["deep"]);
assert.deepEqual(state.calls.slice(0, 3), [
  ["notification", "created"],
  ["category", "created", "work"],
  ["tags", "created", ["deep"]]
]);
assert.deepEqual(state.calls.slice(-2), [["reload"], ["refresh-tags"]]);

const occurrenceState = {
  ...state,
  activities: [{ id: "occurrence", recurringEventId: "series" }],
  categoryMap: { occurrence: "work" },
  tagMap: { occurrence: ["deep"] },
  locks: {},
  calls: []
};
const occurrenceActions = createActivityCalendarActions({
  ...common,
  activities: occurrenceState.activities,
  setActivities: (updater) => { occurrenceState.activities = updater(occurrenceState.activities); },
  activityCategoryMap: occurrenceState.categoryMap,
  setActivityCategoryMap: (updater) => { occurrenceState.categoryMap = updater(occurrenceState.categoryMap); },
  activityTagMap: occurrenceState.tagMap,
  setActivityTagMap: (updater) => { occurrenceState.tagMap = updater(occurrenceState.tagMap); },
  deleteActivity: async () => {},
  deleteActivityNotification: async () => {},
  loadActivities: async () => {},
  refreshTagSearchIfActive: () => {}
});
await occurrenceActions.handleDeleteActivity("occurrence");
assert.equal(occurrenceState.activities.length, 0);
assert.equal(occurrenceState.categoryMap.occurrence, "work", "occurrence delete must retain series metadata");
assert.deepEqual(occurrenceState.tagMap.occurrence, ["deep"]);

let planCreateAttempts = 0;
const planCalls = [];
const planActions = createActivityCalendarActions({
  ...common,
  activityCategoryMap: {},
  activityTagMap: {},
  createActivity: async (_token, body) => {
    planCreateAttempts += 1;
    if (planCreateAttempts === 2) throw new Error("Calendar temporarily unavailable");
    return { id: `plan-${planCreateAttempts}`, ...body };
  },
  setActivityCategoryMap: () => {},
  setActivityTagMap: () => {},
  syncActivityNotification: async () => {},
  assignActivityCategory: async () => {},
  setActivityTags: async () => {},
  loadActivities: async () => { planCalls.push("reload"); },
  refreshTagSearchIfActive: () => { planCalls.push("refresh"); }
});
const planResult = await planActions.handleSaveActivityPlan([
  { activityBody: { summary: "อ่านหนังสือ", start: { dateTime: "2027-09-02T09:00:00Z" }, end: { dateTime: "2027-09-02T10:00:00Z" } }, categoryId: null, tags: [] },
  { activityBody: { summary: "ออกกำลังกาย", start: { dateTime: "2027-09-02T10:00:00Z" }, end: { dateTime: "2027-09-02T11:00:00Z" } }, categoryId: null, tags: [] }
]);
assert.deepEqual(planResult.created, [{ id: "plan-1", title: "อ่านหนังสือ" }]);
assert.deepEqual(planResult.failed, [{ title: "ออกกำลังกาย", error: "Calendar temporarily unavailable" }]);
assert.deepEqual(planCalls, ["reload", "refresh"]);

const calendarEvent = (id, start, end) => ({
  id,
  summary: id,
  start: { dateTime: `2027-09-02T${start}:00Z` },
  end: { dateTime: `2027-09-02T${end}:00Z` }
});
const overcrowdedElsewhere = [1, 2, 3, 4].map(id => calendarEvent(`morning-${id}`, "08:00", "09:00"));
let createdInEmptySlot = 0;
const overlapActions = createActivityCalendarActions({
  ...common,
  activities: overcrowdedElsewhere,
  createActivity: async (_token, body) => { createdInEmptySlot += 1; return { id: `new-${createdInEmptySlot}`, ...body }; },
  syncActivityNotification: async () => {},
  assignActivityCategory: async () => {},
  setActivityTags: async () => {},
  loadActivities: async () => {},
  refreshTagSearchIfActive: () => {}
});
const emptySlotBody = calendarEvent("draft", "14:00", "15:00");
await overlapActions.handleSaveActivity({ activityBody: emptySlotBody, categoryId: null, tags: [], existingId: null });
assert.equal(createdInEmptySlot, 1, "saving in an empty slot must ignore overcrowding elsewhere");
await assert.rejects(
  overlapActions.handleSaveActivity({ activityBody: calendarEvent("draft", "08:30", "09:30"), categoryId: null, tags: [], existingId: null }),
  /ซ้อนกันเกิน 3/
);
assert.equal(createdInEmptySlot, 1, "a new conflict must be rejected before writing to Calendar");
const planInEmptySlot = await overlapActions.handleSaveActivityPlan([
  { activityBody: calendarEvent("plan-one", "14:00", "15:00"), categoryId: null, tags: [] },
  { activityBody: calendarEvent("plan-two", "14:30", "15:30"), categoryId: null, tags: [] }
]);
assert.equal(planInEmptySlot.created.length, 2, "a plan in an empty slot must ignore overcrowding elsewhere");
const crowdedWithMovable = [...overcrowdedElsewhere, calendarEvent("movable", "12:00", "13:00")];
let moved = 0;
const moveActions = createActivityCalendarActions({
  ...common,
  activities: crowdedWithMovable,
  updateActivity: async (_token, id, body) => { moved += 1; return { id, ...body }; },
  syncActivityNotification: async () => {},
  loadActivities: async () => {},
  refreshTagSearchIfActive: () => {}
});
assert.equal(await moveActions.handleSaveTimes([{ id: "movable", start: new Date("2027-09-02T14:00:00Z"), end: new Date("2027-09-02T15:00:00Z") }]), true);
assert.equal(moved, 1, "moving into an empty slot must ignore overcrowding elsewhere");

console.log("PASS: Activity calendar save ordering, overlap boundaries, and recurring occurrence metadata retention");
