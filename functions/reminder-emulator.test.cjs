const { test, before, beforeEach, after, mock } = require('node:test');
const assert = require('node:assert/strict');

// Never allow integration fixtures or notification sends to reach production.
if (!/^localhost:\d+$|^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Run through Firebase emulators:exec with a localhost Firestore emulator');
}
const projectId = 'demo-reminder-integration';
process.env.GCLOUD_PROJECT = projectId;
process.env.GOOGLE_CLOUD_PROJECT = projectId;
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId });
process.env.TZ = 'Asia/Bangkok';
const admin = require('firebase-admin');
const { checkDueReminders } = require('./index.js');
const db = admin.firestore();
const messaging = admin.messaging();
let now;
let calls;
let deliver;
const at = value => +new Date(value + '+07:00');
const reminder = (id, uid = 'alice') => db.doc(`users/${uid}/modes/reminder-mode/reminders/${id}`);
const token = (id, uid = 'alice') => db.doc(`users/${uid}/modes/reminder-mode/fcmTokens/${encodeURIComponent(id)}`);
const base = extra => ({ title: 'Test', type: 'once-at', enabled: true, nextDueAt: now, ...extra });
const read = async ref => (await ref.get()).data();
const run = async () => {
  // Fix the clock for deterministic due times during this sequential handler run.
  const clock = mock.method(Date, 'now', () => now);
  try { await checkDueReminders.run({}); } finally { clock.mock.restore(); }
};

before(() => {
  mock.method(messaging, 'sendEachForMulticast', async message => {
    calls.push(message);
    return deliver(message);
  });
});
beforeEach(async () => {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
  assert.equal(response.ok, true);
  now = at('2026-09-09T10:00:00'); // Wednesday
  calls = [];
  deliver = async message => ({ successCount: message.tokens.length, responses: message.tokens.map(() => ({ success: true })) });
  await token('device').set({ token: 'device' });
});
after(async () => { mock.restoreAll(); await db.terminate(); await admin.app().delete(); });

for (const [name, fields] of [
  ['24h every minute', { amount: 1, unit: 'minutes' }],
  ['daytime', { amount: 2, unit: 'hours', windowStart: '06:00', windowEnd: '18:00' }],
  ['overnight', { amount: 2, unit: 'hours', windowStart: '18:00', windowEnd: '06:00' }]
]) test(`interval ${name}: FCM exclusion preserves the document`, async () => {
  const ref = reminder('interval');
  const value = base({ type: 'interval', ...fields });
  await ref.set(value); await run();
  assert.deepEqual(await read(ref), value);
  assert.equal(calls.length, 0);
});

test('weekly advances to the next time today and does not send the same occurrence twice', async () => {
  const ref = reminder('weekly');
  await ref.set(base({ type: 'weekly', days: [3], times: ['10:00', '18:00'] }));
  await run(); await run();
  assert.equal(calls.length, 1);
  assert.equal((await read(ref)).nextDueAt, at('2026-09-09T18:00:00'));
  now = at('2026-09-09T18:00:00'); await run();
  assert.equal(calls.length, 2);
  assert.equal((await read(ref)).nextDueAt, at('2026-09-16T10:00:00'));
});
test('weekly rejects a stale due date on an unselected day', async () => {
  const value = base({ type: 'weekly', days: [1], time: '10:00' });
  await reminder('weekly').set(value); await run();
  assert.equal(calls.length, 0);
  assert.deepEqual(await read(reminder('weekly')), value);
});
test('weekly permits explicit snooze outside selected weekdays', async () => {
  await reminder('weekly').set(base({ type: 'weekly', days: [1], time: '10:00', snoozedUntil: now }));
  await run();
  assert.equal(calls.length, 1);
  assert.equal((await read(reminder('weekly'))).nextDueAt, at('2026-09-14T10:00:00'));
});
for (const type of ['once-at', 'countdown']) test(`${type}: sends once, disables without marking completed`, async () => {
  const ref = reminder(type);
  await ref.set(base({ type, atMs: now, startedAt: now - 60000, durationMs: 60000 }));
  await run(); await run();
  const value = await read(ref);
  assert.equal(calls.length, 1);
  assert.equal(value.enabled, false);
  assert.equal(value.completedAt, undefined);
  assert.equal(value.lastNotifiedAt, now);
});
test('event-anchored disarms, then sends again only after a new trigger', async () => {
  const ref = reminder('event');
  await ref.set(base({ type: 'event-anchored', lastTriggeredAt: now - 60000, afterAmount: 1, afterUnit: 'minutes' }));
  await run(); await run();
  assert.equal(calls.length, 1);
  assert.equal((await read(ref)).nextDueAt, null);
  assert.equal((await read(ref)).enabled, true);
  now += 60000;
  await ref.update({ lastTriggeredAt: now - 60000, nextDueAt: now });
  await run(); assert.equal(calls.length, 2);
});
test('disabled, completed, future, null, routine, stopwatch and notified records stay unchanged', async () => {
  const cases = [{ enabled: false }, { completedAt: now }, { nextDueAt: now + 1 }, { nextDueAt: null },
    { type: 'routine' }, { type: 'stopwatch' }, { lastNotifiedAt: now }];
  for (const [i, fields] of cases.entries()) await reminder(String(i)).set(base(fields));
  await run(); assert.equal(calls.length, 0);
  for (const [i, fields] of cases.entries()) assert.deepEqual(await read(reminder(String(i))), base(fields));
});
test('FCM throw retains current no-retry policy and processes remaining users', async () => {
  await token('bob-device', 'bob').set({ token: 'bob-device' });
  await reminder('a').set(base({})); await reminder('b', 'bob').set(base({}));
  deliver = async () => { throw new Error('FCM unavailable'); };
  await run(); await run();
  assert.equal(calls.length, 2);
  for (const ref of [reminder('a'), reminder('b', 'bob')]) {
    assert.equal((await read(ref)).enabled, false);
    assert.equal((await read(ref)).lastNotifiedAt, now);
  }
});
test('partial FCM failure removes only unregistered tokens before handler returns', async () => {
  await token('expired').set({ token: 'expired' });
  await token('temporary').set({ token: 'temporary' });
  await reminder('a').set(base({}));
  deliver = async message => ({ successCount: 1, responses: message.tokens.map(value => value === 'device'
    ? { success: true } : { success: false, error: { code: value === 'expired'
      ? 'messaging/registration-token-not-registered' : 'messaging/internal-error' } }) });
  await run();
  assert.equal((await token('expired').get()).exists, false);
  assert.equal((await token('temporary').get()).exists, true);
  assert.equal((await token('device').get()).exists, true);
});
for (const type of ['weekly', 'event-anchored']) test(`FCM failure: ${type} persists its post-attempt state without retry`, async () => {
  const ref = reminder(type);
  await ref.set(base({ type, days: [3], time: '10:00', lastTriggeredAt: now - 60000 }));
  deliver = async () => { throw new Error('Simulated transport failure'); };
  await run(); await run();
  assert.equal(calls.length, 1);
  const value = await read(ref);
  assert.equal(value.enabled, true);
  assert.equal(value.lastNotifiedAt, now);
  assert.equal(value.nextDueAt, type === 'weekly' ? at('2026-09-16T10:00:00') : null);
});
test('no FCM tokens still advances weekly according to existing policy', async () => {
  await token('device').delete();
  await reminder('w').set(base({ type: 'weekly', days: [3], time: '10:00' }));
  await run();
  assert.equal(calls.length, 0);
  assert.equal((await read(reminder('w'))).nextDueAt, at('2026-09-16T10:00:00'));
});
test('current activity mirrors work; legacy and unrelated collection-group paths are ignored', async () => {
  const current = db.doc('users/alice/modes/activity-mode/activity-notifications/a');
  const legacy = db.doc('users/alice/activity-notifications/a');
  const unrelated = db.doc('other/alice/reminders/a');
  for (const ref of [current, legacy, unrelated]) await ref.set(base({ type: 'activity-notification' }));
  await run();
  assert.equal(calls.length, 1);
  assert.equal((await read(current)).enabled, false);
  for (const ref of [legacy, unrelated]) assert.equal((await read(ref)).lastNotifiedAt, undefined);
});
test('more than one write batch persists all due reminders', async () => {
  await token('device').delete();
  for (let offset = 0; offset < 451; offset += 450) {
    const batch = db.batch();
    for (let i = offset; i < Math.min(offset + 450, 451); i++) batch.set(reminder(String(i)), base({}));
    await batch.commit();
  }
  await run();
  const docs = await reminder('0').parent.get();
  assert.equal(docs.size, 451);
  assert.ok(docs.docs.every(doc => doc.data().enabled === false && doc.data().lastNotifiedAt === now));
});
