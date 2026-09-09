import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { createInFlightReads } from '../src/shared/api/in-flight-reads.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const drain = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
globalThis.perfAuth = { currentUser: { uid: 'a', getIdToken: async () => 'a' } };
globalThis.perfReads = createInFlightReads;
const clientSource = source('../src/shared/api/client.js')
  .replace('import { auth } from "../config/firebase-auth.js";', 'const auth = globalThis.perfAuth;')
  .replace('import { createInFlightReads } from "./in-flight-reads.js";', 'const createInFlightReads = globalThis.perfReads;')
  .replace('import.meta.env.VITE_API_BASE_URL', '"http://test"');
const { apiRequest } = await import(dataUrl(clientSource));
let requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (...args) => { const pending = deferred(); requests.push({ ...pending, args }); return pending.promise; };
const first = apiRequest('/api/reminders');
const second = apiRequest('/api/reminders');
await drain();
assert.equal(requests.length, 1);
requests[0].resolve(new Response('{"ok":true}'));
assert.deepEqual(await (await first).json(), { ok:true });
assert.deepEqual(await (await second).json(), { ok:true });
const fresh = apiRequest('/api/reminders'); await drain();
assert.equal(requests.length, 2); requests[1].resolve(new Response('{}')); await fresh;

const stale = apiRequest('/api/reminders'); await drain();
const write = apiRequest('/api/reminders/a', { method:'DELETE' }); await drain();
requests.at(-1).resolve(new Response(null, { status:204 })); await write;
const afterWrite = apiRequest('/api/reminders'); await drain();
assert.equal(requests.length, 5);
requests[2].resolve(new Response('{}')); requests[4].resolve(new Response('{}'));
await Promise.all([stale, afterWrite]);
const oldAccount = apiRequest('/api/categories'); await drain();
globalThis.perfAuth.currentUser = { uid:'b', getIdToken:async () => 'b' };
const newAccount = apiRequest('/api/categories'); await drain();
requests[5].resolve(new Response('{}')); requests[6].resolve(new Response('{}'));
await assert.rejects(oldAccount, /บัญชีผู้ใช้เปลี่ยน/); await newAccount;
const failed = apiRequest('/api/locks'); await drain(); requests.at(-1).reject(new Error('offline'));
await assert.rejects(failed, /offline/);
const retry = apiRequest('/api/locks'); await drain(); requests.at(-1).resolve(new Response('{}')); await retry;
globalThis.fetch = originalFetch;
console.log('PASS concurrent GETs: 2 callers → 1 request; fresh reads, mutation invalidation, account isolation and retry');

// Same temporary React runtime used by reminder-sync.test.mjs.
const runtime = join(tmpdir(), 'times-reminder-sync-tests/node_modules');
const reactUrl = pathToFileURL(join(runtime, 'react/index.js')).href;
const { default: React } = await import(reactUrl);
const { default: Renderer } = await import(pathToFileURL(join(runtime,'react-test-renderer/index.js')).href);
const { act } = Renderer;
const calendarRequests = [];
let metadataLoads = 0, summaryCalls = 0, hook;
globalThis.calendarPerfApi = {
  fetchActivities: () => { const pending = deferred(); calendarRequests.push(pending); return pending.promise; },
  isCalendarAuthExpiredError: () => false,
  fetchCategories: async () => { metadataLoads++; return []; },
  fetchActivityCategoryMap: async () => ({}), fetchActivityTagMap: async () => ({}), fetchLockedActivities: async () => ({}),
  fetchWeeklySummary: async () => { summaryCalls++; return {}; }
};
const dateSource = source('../src/shared/lib/date-utils.js').replace(/^import .*;$/m, '');
const hookSource = source('../src/features/activity/hooks/use-calendar-data.js')
  .replace('from "react"', `from "${reactUrl}"`)
  .replace(/import \{ ([^}]+) \} from "\.\.\/.*api\/[^"\n]+";/g, 'const { $1 } = globalThis.calendarPerfApi;')
  .replace('from "../../../shared/lib/date-utils.js"', `from "${dataUrl(dateSource)}"`);
const { useCalendarData } = await import(dataUrl(hookSource));
const setError = () => {}, setCalendarAccessToken = () => {};
function App({ day, uid='a' }) {
  hook = useCalendarData({ cursorDate:new Date(2026,8,day), firebaseUser:{uid}, calendarAccessToken:'connected', setError, setCalendarAccessToken });
  return null;
}
let view;
await act(async () => { view = Renderer.create(React.createElement(App,{day:9})); });
await act(async () => { view.update(React.createElement(App,{day:10})); });
assert.equal(calendarRequests.length,1); assert.equal(metadataLoads,1);
await act(async () => { view.update(React.createElement(App,{day:16})); });
const item = { id:'new', start:{dateTime:new Date(2026,8,16,10).toISOString()}, end:{dateTime:new Date(2026,8,16,11).toISOString()} };
await act(async () => { calendarRequests[1].resolve([item]); });
await act(async () => { calendarRequests[0].resolve([{id:'old'}]); });
assert.equal(hook.activities[0].id,'new');
await act(async () => { hook.setActivities([{...item,summary:'1'}]); });
await act(async () => { hook.setActivities([{...item,summary:'2'}]); });
await act(async () => { await new Promise(resolve => setTimeout(resolve,180)); });
assert.equal(summaryCalls,1);
let reload;
await act(async () => { reload = hook.loadActivities(); });
assert.equal(calendarRequests.length,3);
await act(async () => { view.update(React.createElement(App,{day:16,uid:'b'})); });
await act(async () => { calendarRequests[3].resolve([{id:'b'}]); });
await act(async () => { calendarRequests[2].resolve([{id:'a'}]); await reload; });
assert.equal(hook.activities[0].id,'b');
await act(async () => { view.unmount(); });
console.log('PASS same-week navigation: 0 extra reads; stale week/account response rejected; summary burst → 1 request; explicit reload still fetches');
