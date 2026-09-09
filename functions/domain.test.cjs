const { test } = require('node:test');
const assert = require('node:assert/strict');

test('frontend and Functions share the same scheduling implementations', async () => {
  const rules = await import('./domain/reminder-due-logic.js');
  const ui = await import('../frontend/src/features/reminder/lib/reminder-due-logic.js');
  const intervals = await import('./domain/interval-schedule.js');
  const uiIntervals = await import('../frontend/src/features/reminder/lib/interval-schedule.js');
  assert.equal(ui.computeNextDueAt, rules.computeNextDueAt);
  assert.equal(ui.isReminderDue, rules.isReminderDue);
  assert.equal(uiIntervals.intervalScheduleMinutes, intervals.intervalScheduleMinutes);
  assert.deepEqual(intervals.intervalScheduleMinutes({
    amount: 6, unit: 'hours', windowStart: '18:00', windowEnd: '06:00'
  }), [0, 360, 1080]);
  assert.equal(intervals.intervalScheduleMinutes({ amount: 1, unit: 'minutes' }).length, 1440);
  assert.equal(rules.computeNextDueAt({ type: 'countdown', startedAt: 100, durationMs: 200 }, 0), 300);
  const due = { enabled: true, nextDueAt: 1, type: 'once-at' };
  assert.equal(rules.isReminderDue(due, 2), true);
  assert.equal(rules.isReminderDue({ ...due, completedAt: 1 }, 2), false);
  for (const type of ['interval', 'routine', 'stopwatch']) {
    assert.equal(rules.isReminderDue({ ...due, type }, 2), false);
  }
});
