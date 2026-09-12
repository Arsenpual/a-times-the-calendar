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
globalThis.cycleRequests = [];
globalThis.fetchCycleTest = (...args) => new Promise((resolve, reject) => cycleRequests.push({args,resolve,reject}));
const source = readFileSync(new URL("../src/features/activity/hooks/use-cycle-activities.js", import.meta.url), "utf8")
  .replace('from "react"', 'from "' + reactUrl + '"')
  .replace('import { fetchActivities } from "../../calendar-connection/api/google-calendar.js";', 'const fetchActivities = globalThis.fetchCycleTest;')
  .replace('from "../../../shared/lib/id-utils.js"', 'from "' + new URL("../src/shared/lib/id-utils.js", import.meta.url).href + '"');
const { useCycleActivities } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
let props = {viewMode:"week",calendarAccessToken:"token",userId:"a",cycleStart:new Date(2026,8,6),cycleEnd:new Date(2026,9,3),archivedActivityIds:new Set()};
let result, renderer;
function Fixture() { result = useCycleActivities(props); return null; }
const update = async patch => { props = {...props,...patch}; await act(async () => renderer.update(React.createElement(Fixture))); };
await act(async () => { renderer = Renderer.create(React.createElement(Fixture)); });
try {
  assert.equal(cycleRequests.length,0);
  await update({viewMode:"four-weeks"});
  assert.equal(result.loading,true);
  await update({cycleStart:new Date(props.cycleStart),cycleEnd:new Date(props.cycleEnd)});
  assert.equal(cycleRequests.length,1);
  await act(async () => cycleRequests[0].resolve([{id:"one"},{id:"series_20260912T030000Z"}]));
  assert.equal(result.activities.length,2);
  await update({archivedActivityIds:new Set(["series"])});
  assert.deepEqual(result.activities,[{id:"one"}]);
  assert.equal(cycleRequests.length,1);
  await update({cycleStart:new Date(2026,9,4),cycleEnd:new Date(2026,9,31)});
  assert.deepEqual(result.activities,[]);
  await update({userId:"b"});
  await act(async () => cycleRequests[1].resolve([{id:"old-account"}]));
  assert.deepEqual(result.activities,[]);
  assert.equal(result.loading,true);
  await act(async () => cycleRequests[2].reject(new Error("offline")));
  assert.equal(result.error,"offline");
  await update({viewMode:"week"});
  assert.equal(result.error,"");
  assert.equal(result.loading,false);
  await update({viewMode:"four-weeks"});
  await act(async () => cycleRequests[3].resolve([{id:"fresh"}]));
  assert.deepEqual(result.activities,[{id:"fresh"}]);
  await update({calendarAccessToken:null,userId:null});
  assert.deepEqual(result.activities,[]);
  await update({calendarAccessToken:"new",userId:"c"});
  await act(async () => renderer.unmount());
  await act(async () => cycleRequests[4].resolve([{id:"late"}]));
  console.log("PASS: Cycle fetch, archive filtering, range/account isolation, failure/retry, logout and unmount");
} finally { await act(async () => renderer.unmount()); delete globalThis.fetchCycleTest; delete globalThis.cycleRequests; }
