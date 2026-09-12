// Uses the same temporary React 18 renderer runtime as reminder-sync.test.mjs.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { createTimeChangeState, timeChangeReducer } from '../src/features/activity/lib/week-spine-time-changes.js';
const runtime = join(tmpdir(), 'times-reminder-sync-tests/node_modules');
const reactUrl = pathToFileURL(join(runtime, 'react/index.js')).href;
const { default: React } = await import(reactUrl);
const { default: Renderer } = await import(pathToFileURL(join(runtime, 'react-test-renderer/index.js')).href);
const { act } = Renderer;
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const source = name => readFileSync(new URL('../src/features/activity/hooks/' + name + '.js', import.meta.url), 'utf8');
const load = async (name, replacements = {}) => {
  let code = source(name).replace('from "react"', `from "${reactUrl}"`);
  for (const [from, to] of Object.entries(replacements)) code = code.replace(from, to);
  return import(url(code));
};
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const cache = new Map(), timers = new Map();
let timerId = 0;
globalThis.window = {
  localStorage: { getItem: key => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value) },
  dispatchEvent() {}, setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id)
};
globalThis.CustomEvent = class { constructor(type, init) { Object.assign(this, { type }, init); } };
const originalError = console.error;
const errors = [];
console.error = (...args) => errors.push(args);

globalThis.phase1History = { createTimeChangeState, timeChangeReducer };
const { useWeekSpineTimeChanges } = await load('use-week-spine-time-changes', {
  'import { createTimeChangeState, timeChangeReducer } from "../lib/week-spine-time-changes.js";': 'const { createTimeChangeState, timeChangeReducer } = globalThis.phase1History;'
});
let history, view, saveGate, saveResult = true, calls = [];
const changes = (hour, id = 'a') => [{ id, start: new Date(2026, 8, 12, hour), end: new Date(2026, 8, 12, hour + 1) }];
function History() {
  history = useWeekSpineTimeChanges({ onSaveTimes: async rows => { calls.push(['save', rows]); if (saveGate) await saveGate.promise; return saveResult; }, onMoveActivityToDay: async () => calls.push(['move']), onError: message => calls.push(['error', message]) });
  return null;
}
await act(async () => { view = Renderer.create(React.createElement(History)); });
await act(async () => { history.queueTimeChanges(changes(8)); history.queueTimeChanges(changes(10)); });
assert.equal(history.undoTimeChangeHistory.length, 2);
await act(async () => history.undoTimeChange());
assert.equal(history.pendingTimeChanges.get('a').start.getHours(), 8);
await act(async () => history.redoTimeChange());
assert.equal(history.pendingTimeChanges.get('a').start.getHours(), 10);
await act(async () => history.queueTimeChanges([...changes(11), ...changes(12, 'b')]));
await act(async () => history.undoTimeChange());
assert.equal(history.pendingTimeChanges.has('b'), false);
await act(async () => history.redoTimeChange());
saveGate = deferred(); let saving;
await act(async () => { saving = history.savePendingTimeChanges(); });
await act(async () => { history.queueTimeChanges(changes(15)); history.discardPendingTimeChanges(); });
assert.equal(history.pendingTimeChanges.get('a').start.getHours(), 15);
assert.equal(await history.savePendingTimeChanges(), false);
await act(async () => { saveGate.resolve(); await saving; });
assert.equal(history.pendingTimeChanges.size, 1);
assert.equal(history.pendingTimeChanges.get('a').start.getHours(), 15);
saveGate = null; saveResult = false;
await act(async () => assert.equal(await history.moveActivityToDay('a', '2026-09-13'), false));
assert.equal(calls.some(([type]) => type === 'move'), false);
assert.equal(history.pendingTimeChanges.size, 1);
saveResult = true;
await act(async () => history.moveActivityToDay('a', '2026-09-13'));
assert.deepEqual(calls.slice(-2).map(([type]) => type), ['save', 'move']);
assert.equal(history.pendingTimeChanges.size, 0);
await act(async () => view.unmount());
console.log('PASS history: batch undo/redo, save failure, concurrent edits, duplicate save, save-before-move');

let cloud = [], archiveCalls = [], fetchGate, writeGate, failWrite = false;
globalThis.phase1ArchiveApi = {
  fetchActivityArchive: async () => fetchGate ? fetchGate.promise : structuredClone(cloud),
  saveActivityArchiveItem: async item => {
    archiveCalls.push(['PUT', item.archiveId, item.title]);
    if (writeGate) await writeGate.promise;
    if (failWrite) throw new Error('offline');
    cloud = [...cloud.filter(row => row.archiveId !== item.archiveId), structuredClone(item)];
  },
  deleteActivityArchiveItem: async id => { archiveCalls.push(['DELETE', id]); cloud = cloud.filter(row => row.archiveId !== id); }
};
const { useActivityArchiveState } = await load('use-activity-archive-state');
const { useActivityArchiveEditor } = await load('use-activity-archive-editor');
const { useActivityArchiveSync } = await load('use-activity-archive-sync', {
  'import { deleteActivityArchiveItem, fetchActivityArchive, saveActivityArchiveItem } from "../api/archive.js";': 'const { deleteActivityArchiveItem, fetchActivityArchive, saveActivityArchiveItem } = globalThis.phase1ArchiveApi;'
});
let archive, editor;
function Archive({ uid }) {
  archive = useActivityArchiveState();
  useActivityArchiveSync({ archiveState: archive, archiveStorageKey: uid, userId: uid });
  editor = useActivityArchiveEditor({ archiveState: archive });
  return null;
}
const row = (id, title = id) => ({ archiveId: id, title, start: null, end: null, archivedAt: '2026-09-12' });
cache.set('a', JSON.stringify([row('old'), row('edit')]));
fetchGate = deferred();
await act(async () => { view = Renderer.create(React.createElement(Archive, { uid: 'a', key: 'a' })); });
await act(async () => { editor.deleteArchivedActivity('old'); editor.updateArchivedActivity('edit', 'title', 'new title'); });
await act(async () => { fetchGate.resolve([row('old'), row('edit')]); });
fetchGate = null;
assert.equal(archive.activityArchive.some(item => item.archiveId === 'old'), false);
assert.equal(archive.activityArchive.find(item => item.archiveId === 'edit').title, 'new title');
assert.ok(archiveCalls.some(([type, id]) => type === 'DELETE' && id === 'old'));
failWrite = true;
await act(async () => editor.updateArchivedActivity('edit', 'title', 'retry title'));
assert.notEqual(JSON.parse(archive.archiveSnapshotRef.current.get('edit')).title, 'retry title');
failWrite = false;
await act(async () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); });
assert.equal(cloud.find(item => item.archiveId === 'edit').title, 'retry title');
writeGate = deferred();
await act(async () => editor.updateArchivedActivity('edit', 'title', 'slow title'));
await act(async () => editor.deleteArchivedActivity('edit'));
assert.equal(archiveCalls.at(-1)[0], 'PUT');
await act(async () => { writeGate.resolve(); });
writeGate = null;
assert.equal(archiveCalls.at(-1)[0], 'DELETE');
assert.equal(cloud.length, 0);
await act(async () => view.unmount());
fetchGate = deferred();
const staleGate = fetchGate;
await act(async () => { view = Renderer.create(React.createElement(Archive, { uid: 'a', key: 'a' })); });
fetchGate = null; cloud = [row('b-only')];
await act(async () => view.update(React.createElement(Archive, { uid: 'b', key: 'b' })));
await act(async () => staleGate.resolve([row('a-late')]));
assert.deepEqual(archive.activityArchive.map(item => item.archiveId), ['b-only']);
assert.equal(cache.get('b').includes('a-late'), false);
await act(async () => view.unmount());
assert.equal(timers.size, 0);
console.log('PASS archive: edit/delete while hydrating, failed-write retry, serialized PUT/DELETE, stale account response, cleanup');

const { useWeekNames } = await load('use-week-names', {
  'import { toDateInputValue, weekOfYear } from "../../../shared/lib/date-utils.js";': 'const toDateInputValue = date => date.toISOString().slice(0,10); const weekOfYear = () => 37;'
});
let names;
function Names({ uid }) { names = useWeekNames(uid); return null; }
cache.set('times-activity-week-names:a', JSON.stringify({ '2026-09-07': 'Alpha' }));
cache.set('times-activity-week-names:b', JSON.stringify({ '2026-09-07': 'Beta' }));
await act(async () => { view = Renderer.create(React.createElement(Names, { uid: 'a' })); });
await act(async () => view.update(React.createElement(Names, { uid: 'b' })));
assert.equal(names.weekNames['2026-09-07'], 'Beta');
assert.equal(JSON.parse(cache.get('times-activity-week-names:b'))['2026-09-07'], 'Beta');
await act(async () => names.startEditingWeekName(new Date('2026-09-07T00:00:00Z')));
await act(async () => names.setWeekNameDraft('Changed'));
await act(async () => names.cancelWeekNameEdit());
assert.equal(names.weekNames['2026-09-07'], 'Beta');
await act(async () => view.unmount());
console.log('PASS week names: account switch and cancel editing');
const { useActivityArchiveCalendarActions } = await load('use-activity-archive-calendar-actions', {
  'import { deleteActivityArchiveItem, saveActivityArchiveItem } from "../api/archive.js";': 'const { deleteActivityArchiveItem, saveActivityArchiveItem } = globalThis.phase1ArchiveApi;',
  'import { normalizeActivityId } from "../../../shared/lib/id-utils.js";': 'const normalizeActivityId = id => id;'
});
let commands, calendarDeletes = 0, restoreResult = false;
function Commands() {
  archive = useActivityArchiveState();
  commands = useActivityArchiveCalendarActions({ archiveState: archive, activityCategoryMap: {}, activityTagMap: {},
    onDeleteActivity: async () => { calendarDeletes++; return false; }, onRestoreArchivedActivity: async () => restoreResult,
    showInteractionWarning: () => {} });
  return null;
}
await act(async () => { view = Renderer.create(React.createElement(Commands)); });
const segment = { calendarId: 'a', id: 'a', title: 'Task', start: new Date(2026, 8, 12, 8), end: new Date(2026, 8, 12, 9), color: { border: '#123456' } };
await act(async () => commands.archiveActivity(segment));
assert.equal(calendarDeletes, 1);
assert.equal(archive.activityArchive.length, 0);
assert.equal(archiveCalls.at(-1)[0], 'DELETE');
const retained = { ...row('retained'), start: segment.start.toISOString(), end: segment.end.toISOString() };
await act(async () => archive.setActivityArchive([retained]));
await act(async () => commands.restoreArchivedActivity(retained));
assert.equal(archive.activityArchive.length, 1);
writeGate = deferred(); let archiving;
await act(async () => { archiving = commands.archiveActivity(segment); });
await act(async () => view.unmount());
await act(async () => { writeGate.resolve(); await archiving; });
writeGate = null;
assert.equal(calendarDeletes, 1); // No Calendar mutation after the account's component unmounts.
console.log('PASS Calendar/archive boundary: failed delete rollback, failed restore retention, unmounted session guard');
console.error = originalError;
assert.ok(errors.every(args => args.join(' ').includes('offline')), errors.map(args => args.join(' ')).join('\n'));
