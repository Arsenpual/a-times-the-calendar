import test from "node:test";
import assert from "node:assert/strict";
import { createActivityPopupHandoff } from "../lib/activity-popup-handoff.js";

test("assistant draft hand-off opens ActivityPopup only for a complete ready draft", () => {
  const result = { ready: true, draft: { title: "ประชุมทีม", startLocal: "2026-09-16T10:00", endLocal: "2026-09-16T11:00", allDay: false } };
  assert.deepEqual(createActivityPopupHandoff(result), { values: { formDraft: result.draft }, changedField: "activityDraft" });
});

test("incomplete or unready assistant output cannot reach ActivityPopup save flow", () => {
  assert.equal(createActivityPopupHandoff({ ready: false, draft: null }), null);
  assert.equal(createActivityPopupHandoff({ ready: true, draft: { title: "", startLocal: "2026-09-16T10:00", endLocal: "2026-09-16T11:00" } }), null);
  assert.equal(createActivityPopupHandoff({ ready: true, draft: { title: "ประชุม", startLocal: "", endLocal: "" } }), null);
});
