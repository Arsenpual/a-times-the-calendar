import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

const runtime = join(tmpdir(), "times-reminder-sync-tests/node_modules");
const reactUrl = pathToFileURL(join(runtime, "react/index.js")).href;
const { default: React } = await import(reactUrl);
const { default: Renderer } = await import(pathToFileURL(join(runtime, "react-test-renderer/index.js")).href);
const { act } = Renderer;
const idsUrl = new URL("../src/shared/lib/id-utils.js", import.meta.url).href;
const source = readFileSync(new URL("../src/features/activity/hooks/use-activity-collections.js", import.meta.url), "utf8")
  .replace('from "react"', 'from "' + reactUrl + '"')
  .replace('from "../../../shared/lib/id-utils.js"', 'from "' + idsUrl + '"');
const { useActivityCollections } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const event = id => ({ id, summary: id });
const a = event("a"), recurring = event("series_20260912T030000Z"), archived = event("archived");
const demo = event("demo"), distant = event("other-week");
let props = {
  activities: [a, recurring, archived],
  onboardingActivities: [demo],
  archivedActivityIds: new Set(["archived"]),
  tagSearchTerms: [], tagSearchResults: [a, recurring, archived, distant],
  activityTagMap: { a: ["Work"], series: ["HEALTH"], archived: ["work"], "other-week": ["Work"] }
};
let result, renderer;
function Harness() { result = useActivityCollections(props); return null; }
const render = async patch => {
  props = { ...props, ...patch };
  await act(async () => renderer.update(React.createElement(Harness)));
};
const ids = list => list.map(item => item.id);
await act(async () => { renderer = Renderer.create(React.createElement(Harness)); });
try {
  assert.deepEqual(ids(result.calendarActivities), [a.id, recurring.id]);
  assert.deepEqual(ids(result.visibleActivities), [a.id, recurring.id, demo.id]);
  const calendar = result.calendarActivities;
  await render({ tagSearchTerms: ["wor"] });
  assert.deepEqual(ids(result.visibleActivities), [a.id, distant.id]);
  assert.equal(result.calendarActivities, calendar, "tag search must not change Reminder input or its reference");
  await render({ tagSearchTerms: ["wor", "health"] });
  assert.deepEqual(ids(result.visibleActivities), [a.id, recurring.id, distant.id]);
  await render({ archivedActivityIds: new Set(["archived", "series"]) });
  assert.deepEqual(ids(result.calendarActivities), [a.id]);
  assert.deepEqual(ids(result.visibleActivities), [a.id, distant.id]);
  await render({ tagSearchTerms: [], activities: [a], onboardingActivities: [] });
  assert.deepEqual(ids(result.calendarActivities), [a.id], "deleted items disappear");
  await render({ activities: [a, recurring], archivedActivityIds: new Set() });
  assert.deepEqual(ids(result.calendarActivities), [a.id, recurring.id], "restored item returns");
  assert.equal(result.calendarActivities[0], a, "retain source object for editing and locks");
  await render({ activities: [], onboardingActivities: [], tagSearchResults: [] });
  assert.deepEqual(result.calendarActivities, []);
  assert.deepEqual(result.visibleActivities, []);
  console.log("PASS: isolated Reminder data, tag OR/substring matching, recurring archives, delete/restore and source identity");
} finally {
  await act(async () => renderer.unmount());
}
