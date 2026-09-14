const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareContext, finishResult, validateDraft } = require('../skills/activity-creation');
const context = (text = 'อ่านหนังสือ') => prepareContext({ text, referenceDate: '2026-09-14', timeZone: 'Asia/Bangkok', categories: ['งาน'], history: [] });
const extraction = (patch = {}) => ({ title: 'อ่านหนังสือ', startLocal: '', endLocal: '', allDay: false, categoryName: '', notes: '', ...patch });
const finish = (patch, text) => finishResult({ ready: true, reply: 'ร่างพร้อมแล้ว', draft: extraction(patch) }, context(text)).draft;
const valid = () => finish({});
for (const [tag, window] of Object.entries(require('../skills/activity-creation/time-periods').TIME_PERIODS)) {
  test(`period ${tag} sets missing time`, () => {
    const draft = finish({ tags: [tag] });
    assert.equal(draft.startLocal, `2026-09-14T${window.defaultStart}`);
    assert.ok(draft.assumptions.some(item => item.includes(`tag ${tag}`)));
  });
}
test('explicit start time wins over period', () => assert.equal(finish({ startTime: '16:30', tags: ['morning'] }).startLocal, '2026-09-14T16:30'));
test('explicit datetime wins over period', () => assert.equal(finish({ startLocal: '2026-09-15T16:30', tags: ['morning'] }).startLocal, '2026-09-15T16:30'));
test('period does not change all-day midnight', () => assert.equal(finish({ allDay: true, tags: ['night'] }).startLocal, '2026-09-14T00:00'));
test('unknown tag falls back', () => assert.equal(finish({ tags: ['unrecognized'] }).startLocal, '2026-09-14T19:00'));
test('homework evening retains two-hour duration', () => assert.equal(finish({ title: 'ทำการบ้าน', tags: ['evening'] }).endLocal, '2026-09-14T21:00'));
test('Thai breakfast gets morning tag and 06:00–08:00 immediately', () => {
  const draft = finish({ title: 'ทานข้าวตอนเช้า', tags: [] }, 'ทานข้าวตอนเช้า');
  assert.deepEqual(draft.tags, ['single-day', 'dawn', 'morning', 'hour-06', 'hour-08']);
  assert.equal(draft.startLocal, '2026-09-14T06:00');
  assert.equal(draft.endLocal, '2026-09-14T08:00');
});
test('Thai breakfast corrects an incorrect model period tag', () => {
  const draft = finish({ title: 'ทานข้าวตอนเช้า', tags: ['night'] }, 'ทานข้าวตอนเช้า');
  assert.deepEqual(draft.tags, ['single-day', 'dawn', 'morning', 'hour-06', 'hour-08']);
});
test('Thai breakfast replaces an arbitrary model time when user gave no clock time', () => {
  const draft = finish({ title: 'ทานข้าวตอนเช้า', startLocal: '2026-09-14T19:00', endLocal: '2026-09-14T20:00' }, 'ทานข้าวตอนเช้า');
  assert.equal(draft.startLocal, '2026-09-14T06:00');
  assert.equal(draft.endLocal, '2026-09-14T08:00');
});
test('a generic morning activity uses the morning default, not breakfast time', () => {
  const draft = finish({ title: 'ประชุมทีม', tags: ['morning'] }, 'ประชุมทีมตอนเช้า');
  assert.equal(draft.startLocal, '2026-09-14T09:00');
  assert.equal(draft.endLocal, '2026-09-14T10:00');
});
test('explicit clock time wins over an inferred situation tag', () => {
  const draft = finish({ title: 'ทานข้าวตอนเช้า', startTime: '07:30', durationMinutes: 30 }, 'ทานข้าวตอนเช้า 7:30');
  assert.equal(draft.startLocal, '2026-09-14T07:30');
  assert.equal(draft.endLocal, '2026-09-14T08:00');
});
test('every timed activity gets precise start and end hour tags', () => {
  const draft = finish({ startTime: '07:30', durationMinutes: 30 });
  assert.ok(draft.tags.includes('hour-07'));
  assert.ok(draft.tags.includes('hour-08'));
  assert.equal(draft.tags.filter(tag => tag.startsWith('hour-')).length, 2);
});
test('a supplied hour tag supplies an empty start time', () => {
  const draft = finish({ tags: ['morning', 'hour-10'] }, 'ประชุมตอนเช้า');
  assert.equal(draft.startLocal, '2026-09-14T10:00');
  assert.ok(draft.tags.includes('hour-10'));
});
test('hour tag rolls over cleanly at midnight', () => {
  const { describeHourTag } = require('../skills/activity-creation/time-periods');
  assert.equal(describeHourTag('hour-23'), '23:00–00:00');
});
test('one-calendar-day activity receives a single-day tag', () => {
  const draft = finish({ startTime: '09:00', durationMinutes: 60 });
  assert.ok(draft.tags.includes('single-day'));
  assert.ok(!draft.tags.includes('multi-day'));
});
test('one all-day activity receives a single-day tag despite exclusive end', () => {
  const draft = finish({ allDay: true });
  assert.ok(draft.tags.includes('single-day'));
});
test('an overnight activity receives a multi-day tag', () => {
  const draft = finish({ startTime: '23:30', durationMinutes: 90 });
  assert.ok(draft.tags.includes('multi-day'));
  assert.ok(!draft.tags.includes('single-day'));
});
test('a long activity receives each crossed time-period tag', () => {
  const draft = finish({ startTime: '05:00', durationMinutes: 480 });
  assert.deepEqual(draft.tags.filter(tag => !tag.startsWith('hour-')), ['single-day', 'dawn', 'morning', 'noon', 'afternoon']);
  assert.ok(draft.tags.includes('hour-05'));
  assert.ok(draft.tags.includes('hour-13'));
});
test('generic defaults today evening', () => assert.equal(valid().startLocal, '2026-09-14T19:00'));
test('generic lasts one hour', () => assert.equal(valid().endLocal, '2026-09-14T20:00'));
test('homework lasts two hours', () => assert.equal(finish({ title: 'ทำการบ้าน' }).endLocal, '2026-09-14T21:00'));
test('tomorrow Thai', () => assert.equal(finish({}, 'พรุ่งนี้อ่านหนังสือ').startLocal, '2026-09-15T19:00'));
test('tomorrow English', () => assert.equal(finish({}, 'read tomorrow').startLocal, '2026-09-15T19:00'));
test('explicit date wins', () => assert.equal(finish({ date: '2026-10-01' }).startLocal, '2026-10-01T19:00'));
test('explicit time and duration', () => assert.equal(finish({ startTime: '10:00', durationMinutes: 90 }).endLocal, '2026-09-14T11:30'));
test('overnight duration', () => assert.equal(finish({ startTime: '23:30', durationMinutes: 90 }).endLocal, '2026-09-15T01:00'));
test('all day exclusive end', () => assert.equal(finish({ allDay: true }).endLocal, '2026-09-15T00:00'));
test('unknown category cleared', () => assert.equal(finish({ categoryName: 'ไม่มี' }).categoryName, ''));
test('known category preserved', () => assert.equal(finish({ categoryName: 'งาน' }).categoryName, 'งาน'));
test('tags deduplicated while retaining system time tags', () => assert.deepEqual(finish({ tags: ['a', 'a'] }).tags, ['a', 'single-day', 'evening', 'hour-19', 'hour-20']));
test('assumptions are visible data', () => assert.ok(valid().assumptions.length >= 3));
test('missing title rejected', () => assert.throws(() => finish({ title: '' })));
test('invalid date rejected', () => assert.throws(() => finish({ startLocal: '2026-02-30T10:00' })));
test('24:00 rejected', () => assert.throws(() => finish({ startLocal: '2026-09-14T24:00' })));
test('UTC output rejected', () => assert.throws(() => finish({ startLocal: '2026-09-14T10:00Z' })));
test('end before start rejected', () => assert.throws(() => finish({ endLocal: '2026-09-14T18:00' })));
test('oversized notes rejected', () => assert.throws(() => finish({ notes: 'a'.repeat(4001) })));
test('recurrence rejected in single activity phase', () => assert.throws(() => finish({ recurrence: ['RRULE:FREQ=DAILY'] })));
test('manual invalid all day rejected', () => assert.throws(() => validateDraft({ ...valid(), allDay: true })));
test('bad timezone rejected before AI call', () => assert.throws(() => prepareContext({ text: 'test', referenceDate: '2026-09-14', timeZone: 'bad' })));
test('incomplete AI result rejected', () => assert.throws(() => finishResult({}, context())));
test('unclear title can request clarification', () => assert.equal(finishResult({ ready: false, reply: 'ทำอะไรครับ?', draft: {} }, context()).draft, null));
test('third unclear turn requests manual title without inventing one', () => {
  const ctx = context(); ctx.history = [{ role: 'user', text: 'นัด' }, { role: 'user', text: 'ไม่รู้' }];
  const result = finishResult({ ready: false, reply: 'ถามต่อ', draft: {} }, ctx);
  assert.equal(result.ready, false); assert.match(result.reply, /ชื่อกิจกรรม/);
});
