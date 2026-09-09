const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

for (const folder of ['functions', 'cloud-run-reminder-worker']) {
  test(`${folder}: current schema routes notifications to the correct user`, async () => {
    const groups = [];
    const reads = [];
    const updates = [];
    const deletes = [];
    let handler;
    const document = (path) => ({
      id: path.split('/').at(-1), ref: { path, id: path.split('/').at(-1) },
      data: () => ({ title: 'Due', type: 'once-at', enabled: true, nextDueAt: 1 })
    });
    const reference = (path) => ({
      collection: (name) => reference(`${path}/${name}`),
      doc: (id) => reference(`${path}/${id}`),
      get: async () => {
        reads.push(path);
        return { docs: [{ data: () => ({ token: 'device-token' }) }] };
      },
      delete: async () => { deletes.push(path); }
    });
    const db = {
      collection: reference,
      collectionGroup: (name) => {
        const filters = [];
        groups.push({ name, filters });
        const query = {
          where: (...args) => { filters.push(args); return query; },
          get: async () => {
            const paths = name === 'reminders' ? [
              'users/alice/modes/reminder-mode/reminders/r1',
              'users/bob/modes/reminder-mode/reminders/r2',
              'users/alice/reminders/legacy',
              'other/alice/modes/reminder-mode/reminders/unrelated'
            ] : [
              'users/alice/modes/activity-mode/activity-notifications/a1',
              'users/alice/activity-notifications/legacy'
            ];
            return { docs: paths.map(document), size: paths.length };
          }
        };
        return query;
      },
      batch: () => ({
        update: (ref) => updates.push(ref.path),
        commit: async () => {}
      })
    };
    const admin = {
      initializeApp() {}, firestore: () => db,
      messaging: () => ({ sendEachForMulticast: async () => ({
        successCount: 0,
        responses: [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }]
      }) })
    };
    const context = {
      require: (name) => {
        if (name === 'firebase-admin') return admin;
        if (name === 'firebase-functions/v2/scheduler') return { onSchedule: (_, fn) => { handler = fn; return fn; } };
        if (name === 'firebase-functions/v2') return { setGlobalOptions() {} };
        return { isOneShotType: () => true, computeNextDueAt: () => null };
      },
      exports: {}, console: { log() {}, warn() {}, error() {} }, process: {}
    };
    let source = readFileSync(join(__dirname, '..', folder, 'index.js'), 'utf8');
    if (folder === 'cloud-run-reminder-worker') source = source.replace('main().then(', 'globalThis.execution = main().then(');
    vm.runInNewContext(source, context);
    if (handler) await handler();
    else await context.execution;
    assert.equal(context.process.exitCode, undefined);
    assert.deepEqual(reads, ['alice', 'bob'].map(uid => `users/${uid}/modes/reminder-mode/fcmTokens`));
    assert.ok(deletes.length >= 2);
    assert.ok(deletes.every(path => /^users\/(alice|bob)\/modes\/reminder-mode\/fcmTokens\/device-token$/.test(path)));
    assert.equal(updates.length, folder === 'functions' ? 2 : 3);
    assert.ok(updates.every(path => path.includes('/modes/')));
    const indexes = JSON.parse(readFileSync(join(__dirname, '..', 'firestore.indexes.json'), 'utf8')).indexes;
    for (const { name, filters } of groups) {
      assert.equal(filters[0][0], 'enabled');
      assert.equal(filters[1][0], 'nextDueAt');
      assert.ok(indexes.some(index => index.collectionGroup === name && index.queryScope === 'COLLECTION_GROUP'
        && index.fields[0].fieldPath === 'enabled' && index.fields[1].fieldPath === 'nextDueAt'));
    }
  });
}
