// Run with a temporary React 18 test renderer installation (no production API).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const runtime = join(tmpdir(), 'times-reminder-sync-tests/node_modules');
const reactUrl = pathToFileURL(join(runtime, 'react/index.js')).href;
const { default: React } = await import(reactUrl);
const { default: Renderer } = await import(pathToFileURL(join(runtime, 'react-test-renderer/index.js')).href);
const { act } = Renderer;
const cache = new Map();
globalThis.localStorage = { getItem: k => cache.get(k) ?? null, setItem: (k,v) => cache.set(k,v) };
let cloud = {}, calls = [], release;
globalThis.syncTestApi = {
  fetchReminders: async () => structuredClone(cloud),
  saveReminder: async (id, fields) => {
    calls.push(['PUT', id, fields]);
    if (release) await new Promise(resolve => { release = resolve; });
    cloud[id] = fields;
    return { id, ...fields, updatedAt: 123 };
  },
  deleteReminderRemote: async id => { calls.push(['DELETE', id]); delete cloud[id]; }
};
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const syncSource = readFileSync(new URL('../src/features/reminder/hooks/use-reminders-sync.js', import.meta.url), 'utf8')
  .replace('from "react"', `from "${reactUrl}"`)
  .replace('import { fetchReminders, saveReminder, deleteReminderRemote } from "../api/reminders.js";', 'const { fetchReminders, saveReminder, deleteReminderRemote } = globalThis.syncTestApi;');
const storeSource = readFileSync(new URL('../src/features/reminder/hooks/use-reminder-store.js', import.meta.url), 'utf8')
  .replace('from "react"', `from "${reactUrl}"`)
  .replace('from "./use-reminders-sync.js"', `from "${dataUrl(syncSource)}"`);
const { useReminderStore } = await import(dataUrl(storeSource));
let store;
const extractScheduleFields = ({ title, enabled }) => ({ title, enabled });
function App({ uid = 'a' }) {
  store = useReminderStore({ firebaseUser: { uid }, storageKey: uid, defaultReminders: [], extractScheduleFields });
  return null;
}
cache.set('a', JSON.stringify([{ id: 'deleted', title: 'stale', enabled: true }]));
let view;
await act(async () => { view = Renderer.create(React.createElement(App)); });
assert.deepEqual(store.reminders, []);
assert.deepEqual(calls, []); // Empty cloud must not resurrect local-only IDs.
assert.ok(cache.get('a:before-cloud-first').includes('deleted'));
await act(async () => store.updateReminders(rows => [...rows, { id: 'one', title: 'new', enabled: true }]));
assert.equal(calls.length, 1);
await act(async () => store.setReminders(rows => rows.map(r => ({ ...r, title: 'local repair' }))));
assert.equal(calls.length, 1); // Automatic changes are local, no write effect.
await act(async () => store.updateReminders(rows => rows.map(r => ({ ...r, title: 'edited' }))));
assert.equal(calls.length, 2);
assert.equal(cloud.one.title, 'edited');
await act(async () => store.updateReminders(rows => rows.map(r => ({ ...r, currentIndex: 1 }))));
assert.equal(calls.length, 2); // Runtime-only action does not write schedule.
release = true;
await act(async () => store.updateReminders(rows => rows.map(r => ({ ...r, title: 'slow save' }))));
await act(async () => store.updateReminders(() => []));
assert.equal(calls.at(-1)[0], 'PUT'); // DELETE waits for an in-flight save.
await act(async () => { const resolve = release; release = null; resolve(); });
assert.equal(calls.at(-1)[0], 'DELETE');
assert.deepEqual(cloud, {});
await act(async () => view.unmount());
const priorCalls = calls.length;
await act(async () => { view = Renderer.create(React.createElement(App)); });
assert.equal(calls.length, priorCalls);
assert.deepEqual(store.reminders, []);
cloud = { remote: { title: 'cloud version', enabled: true } };
cache.set('b', JSON.stringify([{ id: 'remote', title: 'outdated', enabled: true }]));
await act(async () => view.update(React.createElement(App, { uid: 'b' })));
assert.equal(store.reminders[0].title, 'cloud version');
assert.equal(calls.length, priorCalls);
await act(async () => view.unmount());
console.log('PASS: cloud hydration, cache backup, explicit mutations, runtime isolation, ordered PUT/DELETE, remount and account change');
