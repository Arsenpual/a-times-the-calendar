import test from "node:test";
import assert from "node:assert/strict";
import { assessAssistantDraftOverlap } from "../lib/activity-schedule-context.js";
import { assistantChatStorageKey, loadSavedChat } from "../hooks/use-assistant-chat-storage.js";
import { collectPreferenceCorrections } from "../lib/preference-corrections.js";

const event = (id, start, end) => ({ id, summary: id, start: { dateTime: start }, end: { dateTime: end } });
const draft = { startLocal: "2026-09-30T14:30", endLocal: "2026-09-30T15:30" };
const now = new Date("2026-09-30T14:30");

test("alternatives stay in the future and respect the candidate overlap limit", () => {
  const events = [1, 2, 3].map(id => event(String(id), draft.startLocal, "2026-09-30T16:00"));
  const result = assessAssistantDraftOverlap(draft, events, {}, now);
  assert.equal(result.status, "overlap-limit");
  assert.equal(result.alternatives.length, 3);
  for (const alternative of result.alternatives) {
    assert.ok(new Date(alternative.startLocal) >= now);
    assert.equal(assessAssistantDraftOverlap(alternative, events, {}, now).status, "available");
  }
});

test("unrelated overcrowding cannot block an empty candidate slot", () => {
  const events = [1, 2, 3, 4].map(id => event(String(id), "2026-09-30T08:00", "2026-09-30T09:00"));
  assert.equal(assessAssistantDraftOverlap(draft, events, {}, now).status, "available");
});

test("all-day assistant drafts are outside the timed overlap rule", () => {
  const events = [1, 2, 3].map(id => event(String(id), draft.startLocal, draft.endLocal));
  assert.equal(assessAssistantDraftOverlap({ ...draft, allDay: true }, events, {}, now).status, "not-applicable");
});

test("chat restore isolates accounts and never adopts ownerless legacy history", () => {
  const previous = globalThis.window;
  const storage = new Map([
    ["times.activity-ai-assistant.chat.v1", JSON.stringify({ messages: [{ role: "user", text: "legacy secret" }] })],
    [assistantChatStorageKey("alice"), JSON.stringify({ messages: [{ role: "user", text: "Alice only" }] })]
  ]);
  globalThis.window = { localStorage: { getItem: key => storage.get(key) } };
  try {
    assert.equal(loadSavedChat("alice").messages[0].text, "Alice only");
    assert.notEqual(loadSavedChat("bob").messages[0].text, "Alice only");
    assert.notEqual(loadSavedChat("bob").messages[0].text, "legacy secret");
    assert.equal(assistantChatStorageKey(null), null);
  } finally { globalThis.window = previous; }
});

test("preference learning observes supported corrections only", () => {
  const payload = {
    assistantProposal: { title: "ทำการบ้าน", startLocal: "2026-09-30T19:00", endLocal: "2026-09-30T20:00" },
    activityBody: { start: { dateTime: "2026-09-30T18:30" }, end: { dateTime: "2026-09-30T20:00" } }
  };
  assert.deepEqual(collectPreferenceCorrections(payload), [
    { key: "homeworkDefaultStart", value: "18:30" },
    { key: "homeworkDefaultDurationMinutes", value: 90 }
  ]);
  assert.deepEqual(collectPreferenceCorrections({ ...payload, assistantProposal: null }), []);
  assert.deepEqual(collectPreferenceCorrections({ ...payload, activityBody: { start: { date: "2026-09-30" }, end: { date: "2026-10-01" } } }), []);
});
