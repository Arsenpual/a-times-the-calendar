import assert from "node:assert/strict";
import { createActivityMetadataActions } from "./activity-metadata-actions.js";

const state = {
  locks: {},
  categoryMap: { old: "cat-a", keep: "cat-b" },
  categories: [{ id: "cat-a" }, { id: "cat-b" }],
  errors: []
};
const apply = (key) => (updater) => {
  state[key] = typeof updater === "function" ? updater(state[key]) : updater;
};

const actions = createActivityMetadataActions({
  lockedActivities: state.locks,
  setLockedActivities: apply("locks"),
  setActivityLocked: async () => {},
  fetchLockedActivities: async () => ({ server: true }),
  setError: (message) => state.errors.push(message),
  checkConflict: async () => false,
  setActivityCategoryMap: apply("categoryMap"),
  assignActivityCategory: async () => {},
  fetchActivityCategoryMap: async () => ({}),
  createCategory: async (name, color) => ({ id: "new", name, color }),
  deleteCategory: async () => {},
  setCategories: apply("categories")
});

await actions.handleToggleLock("activity", true);
assert.equal(state.locks.activity, true);
await actions.handleAssignCategory("activity", "cat-b");
assert.equal(state.categoryMap.activity, "cat-b");
const created = await actions.handleCreateCategory("Focus", "#D85A30");
assert.equal(created.id, "new");
assert.equal(state.categories.at(-1).name, "Focus");
await actions.handleDeleteCategory("cat-a");
assert.equal(state.categories.some((category) => category.id === "cat-a"), false);
assert.equal("old" in state.categoryMap, false);
assert.equal(state.categoryMap.keep, "cat-b");

const rollbackState = { locks: {}, errors: [] };
const rollbackActions = createActivityMetadataActions({
  lockedActivities: rollbackState.locks,
  setLockedActivities: (updater) => {
    rollbackState.locks = typeof updater === "function" ? updater(rollbackState.locks) : updater;
  },
  setActivityLocked: async () => { throw new Error("offline"); },
  fetchLockedActivities: async () => ({ restored: true }),
  setError: (message) => rollbackState.errors.push(message),
  checkConflict: async () => false,
  setActivityCategoryMap: () => {},
  assignActivityCategory: async () => {},
  fetchActivityCategoryMap: async () => ({}),
  createCategory: async () => ({}),
  deleteCategory: async () => {},
  setCategories: () => {}
});
await rollbackActions.handleToggleLock("activity", true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(rollbackState.locks, { restored: true });
assert.match(rollbackState.errors[0], /offline/);

console.log("PASS: Activity metadata actions update category state and recover failed lock writes");
