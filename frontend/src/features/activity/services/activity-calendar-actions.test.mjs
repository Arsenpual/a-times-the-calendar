import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./activity-calendar-actions.js", import.meta.url), "utf8")
  .replace(
    'import { normalizeActivityId } from "../../../shared/lib/id-utils.js";',
    "const normalizeActivityId = (id) => id;"
  )
  .replace(
    'import { exceedsOverlapLimit } from "../lib/timeline-layout.js";',
    "const exceedsOverlapLimit = () => false;"
  )
  .replace(
    /import \{[\s\S]*?\} from "\.\.\/lib\/activity-mutation-logic\.js";/,
    `const activitySaveCandidateEntries = () => [];
    const overlapEntriesFromActivities = () => [];
    const nextActivityCopySummary = (_, title) => \`${'${title}'} (copy)\`;
    const buildActivityDuplicateBody = ({ activity, summary }) => ({ summary, start: activity.start, end: activity.end });
    const buildActivityMoveBody = ({ dateStr }) => ({ start: { date: dateStr }, end: { date: dateStr } });`
  );
const { createActivityCalendarActions } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

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

console.log("PASS: Activity calendar save ordering and recurring occurrence metadata retention");
