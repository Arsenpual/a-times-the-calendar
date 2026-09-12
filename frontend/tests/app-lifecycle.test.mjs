import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
const runtime = join(tmpdir(), "times-reminder-sync-tests/node_modules");
const reactUrl = pathToFileURL(join(runtime, "react/index.js")).href;
const {default: React} = await import(reactUrl);
const {default: Renderer} = await import(pathToFileURL(join(runtime, "react-test-renderer/index.js")).href);
const {act} = Renderer;
async function load(path, replacements = {}) {
  let source = readFileSync(new URL(path, import.meta.url), "utf8").replace('from "react"', `from "${reactUrl}"`);
  for (const [from, to] of Object.entries(replacements)) source = source.replace(from, to);
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}
const requests = [];
globalThis.lifecycleFetch = () => new Promise((resolve, reject) => requests.push({resolve, reject}));
const {useActivityModal} = await load("../src/features/activity/hooks/use-activity-modal.js", {
  'import { getActivity } from "../../calendar-connection/api/google-calendar.js";': 'const getActivity = globalThis.lifecycleFetch;',
  'from "../../../shared/lib/id-utils.js"': `from "${new URL("../src/shared/lib/id-utils.js", import.meta.url).href}"`
});
const {useTagSearch} = await load("../src/features/activity/hooks/use-tag-search.js", {
  'import { fetchActivities, isCalendarAuthExpiredError } from "../../calendar-connection/api/google-calendar.js";': 'const fetchActivities = globalThis.lifecycleFetch; const isCalendarAuthExpiredError = () => false;'
});
const {useSessionTaskGuard} = await load("../src/shared/hooks/use-session-task-guard.js");
const noop = () => {};
let state, renderer, cleanups = 0;
function Account() {
  const modal = useActivityModal({calendarAccessToken:"token", lockedActivities:{}, setError:noop});
  const tags = useTagSearch({calendarAccessToken:"token", setCalendarAccessToken:noop});
  const guard = useSessionTaskGuard();
  React.useEffect(() => () => { cleanups++; }, []);
  state = {modal, tags, guard};
  return null;
}
const render = (uid, mode) => React.createElement(Account, {key:uid, mode});
await act(async () => {renderer = Renderer.create(render("a", "activity"));});
try {
  let pending;
  await act(async () => {pending = state.modal.openEditActivityById("first");});
  await act(async () => state.modal.closeModal());
  await act(async () => {requests.shift().resolve({id:"first"}); await pending;});
  assert.equal(state.modal.modalOpen, false, "closed modal cannot reopen from late response");
  let first, second;
  await act(async () => {first = state.modal.openEditActivityById("first"); second = state.modal.openEditActivityById("second");});
  const old = requests.shift(), recent = requests.shift();
  await act(async () => {recent.resolve({id:"second"}); await second;});
  await act(async () => {old.resolve({id:"first"}); await first;});
  assert.equal(state.modal.modalEditingActivity.id, "second");
  await act(async () => state.tags.setTagSearchTerms(["work"]));
  assert.equal(state.tags.tagSearchLoading, true);
  await act(async () => state.tags.setTagSearchTerms([]));
  assert.equal(state.tags.tagSearchLoading, false);
  await act(async () => requests.shift().resolve([{id:"stale"}]));
  assert.deepEqual(state.tags.tagSearchResults, []);
  await act(async () => renderer.update(render("a", "reminder")));
  assert.equal(state.modal.modalEditingActivity.id, "second", "mode change preserves account runtime");
  assert.equal(cleanups, 0);
  let finish, writes = 0;
  const guarded = state.guard.guardTask(() => new Promise(resolve => {finish = resolve;}));
  const callback = state.guard.guardCallback(() => writes++);
  const result = guarded().then(() => {writes++;}, error => error.name);
  await act(async () => renderer.update(render("b", "activity")));
  finish();
  assert.equal(await result, "AbortError");
  callback();
  assert.equal(writes, 0, "old account must not execute follow-up writes or setters");
  assert.equal(cleanups, 1);
  assert.equal(state.modal.modalOpen, false);
  assert.deepEqual(state.tags.tagSearchTerms, []);
  const app = readFileSync(new URL("../src/app/app.jsx", import.meta.url), "utf8");
  assert.match(app, /<AccountApp key=\{auth\.firebaseUser\?\.uid \|\| "guest"\}/);
  console.log("PASS App lifecycle: modal races, tag cancellation, mode persistence, account teardown, stale task guard");
} finally {
  await act(async () => renderer.unmount());
  delete globalThis.lifecycleFetch;
}

globalThis.lifecycleAuth = {currentUser: {uid:"a"}};
globalThis.lifecycleSubscribe = callback => {globalThis.emitAuth = callback; return noop;};
globalThis.lifecycleStatus = () => new Promise(resolve => requests.push({resolve}));
globalThis.window = {localStorage: {getItem:()=>null, removeItem:noop, setItem:noop}, setTimeout};
const {useAuth} = await load("../src/features/auth/hooks/use-auth.js", {
  'import { auth } from "../../../shared/config/firebase-auth.js";': 'const auth = globalThis.lifecycleAuth;',
  'import { signInWithGoogle, subscribeToAuthState, signOut } from "../api/google-auth.js";': 'const subscribeToAuthState = globalThis.lifecycleSubscribe; const signInWithGoogle = () => {}; const signOut = () => {};',
  'import { beginCalendarAuthorization, getCalendarConnectionStatus } from "../../calendar-connection/api/google-calendar.js";': 'const getCalendarConnectionStatus = globalThis.lifecycleStatus; const beginCalendarAuthorization = () => {};'
});
let authState;
function AuthFixture() {authState = useAuth(); return null;}
await act(async () => {renderer = Renderer.create(React.createElement(AuthFixture));});
try {
  await act(async () => globalThis.emitAuth({uid:"a"}));
  const previous = requests.shift();
  globalThis.lifecycleAuth.currentUser = {uid:"b"};
  await act(async () => globalThis.emitAuth({uid:"b"}));
  await act(async () => requests.shift().resolve({connected:true}));
  await act(async () => previous.resolve({connected:false}));
  assert.equal(authState.calendarAccessToken, "server-managed", "old account cannot revoke new connection");
  console.log("PASS Auth lifecycle: stale account status cannot overwrite active connection");
} finally {
  await act(async () => renderer.unmount());
  for (const key of ["lifecycleAuth", "lifecycleSubscribe", "lifecycleStatus", "emitAuth", "window"]) delete globalThis[key];
}
