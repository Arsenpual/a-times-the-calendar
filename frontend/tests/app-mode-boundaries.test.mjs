import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
const runtime = join(tmpdir(), "times-reminder-sync-tests/node_modules");
const reactUrl = pathToFileURL(join(runtime, "react/index.js")).href;
const {default:React} = await import(reactUrl);
const {default:Renderer} = await import(pathToFileURL(join(runtime,"react-test-renderer/index.js")).href);
const {act} = Renderer;
const load = async (path, replacements = {}) => {
  let source = readFileSync(new URL(path,import.meta.url),"utf8").replace('from "react"', 'from "'+reactUrl+'"');
  for (const [a,b] of Object.entries(replacements)) source = source.replace(a,b);
  return import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
};
globalThis.requests = [];
globalThis.testFetch = (...args) => new Promise((resolve,reject) => requests.push({args,resolve,reject}));
const {useReminderCalendar} = await load("../src/features/reminder/hooks/use-reminder-calendar.js",{
  'import { fetchActivities, isCalendarAuthExpiredError } from "../../calendar-connection/api/google-calendar.js";':'const fetchActivities = globalThis.testFetch; const isCalendarAuthExpiredError = e => e.code === "CALENDAR_REAUTH_REQUIRED";',
  'from "../../../shared/lib/id-utils.js"':'from "'+new URL("../src/shared/lib/id-utils.js",import.meta.url).href+'"'
});
const {useActivityError} = await load("../src/features/activity/hooks/use-activity-error.js");
let props = {userId:"a",calendarAccessToken:"token",selectedDateKey:"2026-09-12",enabled:false,activityRevision:[],archivedActivityIds:new Set(),onReauthRequired:()=>{}};
let calendar, activityError, authError, setAuthError, renderer;
function Fixture() {
  calendar = useReminderCalendar(props);
  activityError = useActivityError(props.userId);
  [authError,setAuthError] = React.useState("Auth failure");
  return null;
}
const update = async patch => {props={...props,...patch}; await act(async()=>renderer.update(React.createElement(Fixture)));};
await act(async()=>{renderer=Renderer.create(React.createElement(Fixture));});
try {
  assert.equal(requests.length,0);
  await update({enabled:true});
  assert.equal(requests[0].args[1].getDate(),11);
  assert.equal(requests[0].args[2].getDate(),13);
  await update({selectedDateKey:"2026-10-20"});
  await act(async()=>requests[0].resolve([{id:"old-day"}]));
  assert.deepEqual(calendar.activities,[]);
  await act(async()=>requests[1].resolve([{id:"new-day"},{id:"series_20261020T000000Z"}]));
  assert.equal(calendar.activities.length,2);
  await update({archivedActivityIds:new Set(["series"])});
  assert.deepEqual(calendar.activities,[{id:"new-day"}]);
  assert.equal(requests.length,2);
  await update({activityRevision:[{id:"edited"}]});
  assert.equal(requests.length,3,"Calendar mutation refreshes selected date");
  await act(async()=>requests[2].resolve([{id:"edited"}]));
  assert.deepEqual(calendar.activities,[{id:"edited"}]);
  await act(async()=>activityError.setError("Activity failed"));
  assert.equal(authError,"Auth failure");
  await act(async()=>activityError.setError(null));
  assert.equal(authError,"Auth failure","Activity reload must not clear Auth error");
  const oldSetter = activityError.setError;
  await update({userId:"b"});
  await act(async()=>oldSetter("late account A error"));
  assert.equal(activityError.error,null);
  await act(async()=>requests[3].reject(new Error("offline")));
  assert.equal(calendar.error,"offline");
  assert.equal(authError,"Auth failure");
  await update({enabled:false});
  assert.equal(calendar.error,"");
  await update({enabled:true});
  await act(async()=>requests[4].resolve([{id:"retry"}]));
  assert.deepEqual(calendar.activities,[{id:"retry"}]);
  await update({userId:null});
  assert.deepEqual(calendar.activities,[]);
  await act(async()=>setAuthError(null));
  assert.equal(activityError.error,null);
  console.log("PASS: Reminder date range, stale responses, archive exclusion, edit refresh, retry and independent Auth/Activity errors");
} finally {
  await act(async()=>renderer.unmount());
  delete globalThis.requests; delete globalThis.testFetch;
}

