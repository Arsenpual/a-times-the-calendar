import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const runtime = join(tmpdir(), "times-reminder-sync-tests/node_modules");
const reactUrl = pathToFileURL(join(runtime, "react/index.js")).href;
const { default: React } = await import(reactUrl);
const { default: Renderer } = await import(pathToFileURL(join(runtime, "react-test-renderer/index.js")).href);
const { act } = Renderer;
const asDataUrl = (value) => "data:text/javascript;base64," + Buffer.from(value).toString("base64");
const source = readFileSync(new URL("../src/features/reminder/hooks/use-reminder-actions.js", import.meta.url), "utf8")
  .replace('from "react"', `from "${reactUrl}"`)
  .replace('import { REMINDER_TYPE, computeNextDueAt, initializeEventAnchorSchedule } from "../lib/reminder-due-logic.js";', 'const REMINDER_TYPE = { INTERVAL: "interval", COUNTDOWN: "countdown", ONCE_AT: "once-at", ROUTINE: "routine", STOPWATCH: "stopwatch" }; const computeNextDueAt = (_, now) => now + 60000; const initializeEventAnchorSchedule = (_, now) => ({ nextDueAt: now + 60000 });')
  .replace('import { logReminderEvent } from "../lib/reminder-telemetry.js";', 'const logReminderEvent = (...event) => globalThis.events.push(event);');
const { useReminderActions } = await import(asDataUrl(source));
globalThis.events = [];
const originalNow = Date.now;
Date.now = () => 1_000_000;
let reminders = [
  { id: "routine", type: "routine", enabled: true, steps: ["first", "last"], currentIndex: 0, completionCount: 2 },
  { id: "watch", type: "stopwatch", enabled: false, accumulatedMs: 50 },
  { id: "count", type: "countdown", enabled: false, durationMs: 30000, completedAt: 1 },
  { id: "past", type: "once-at", enabled: false, atMs: 999999 },
  { id: "interval", type: "interval", enabled: false, completedAt: 1 }
];
let actions, stats = [], warnings = [];
function Fixture() {
  const [, rerender] = React.useState(0);
  const updateReminders = (update) => { reminders = typeof update === "function" ? update(reminders) : update; rerender((value) => value + 1); };
  actions = useReminderActions({ updateReminders, recordStatsEvent: (...event) => stats.push(event), onWarning: (message) => warnings.push(message) });
  return null;
}
let view;
await act(async () => { view = Renderer.create(React.createElement(Fixture)); });
await act(async () => actions.advanceRoutine("routine"));
assert.equal(reminders.find((item) => item.id === "routine").currentIndex, 1);
await act(async () => actions.advanceRoutine("routine"));
const routine = reminders.find((item) => item.id === "routine");
assert.equal(routine.enabled, false);
assert.equal(routine.completionCount, 3);
assert.equal(stats.at(-1)[0], "completed");
await act(async () => actions.toggleStopwatch("watch"));
assert.equal(reminders.find((item) => item.id === "watch").startedAt, 1_000_000);
Date.now = () => 1_000_250;
await act(async () => actions.toggleStopwatch("watch"));
assert.deepEqual(reminders.find((item) => item.id === "watch"), { id: "watch", type: "stopwatch", enabled: false, accumulatedMs: 300, startedAt: null });
await act(async () => actions.resetStopwatch("watch"));
assert.equal(reminders.find((item) => item.id === "watch").accumulatedMs, 0);
await act(async () => actions.toggleReminder("count"));
const countdown = reminders.find((item) => item.id === "count");
assert.equal(countdown.enabled, true);
assert.equal(countdown.completedAt, null);
assert.equal(countdown.nextDueAt, 1_000_250 + 60000);
await act(async () => actions.toggleReminder("past"));
assert.equal(reminders.find((item) => item.id === "past").enabled, false);
assert.equal(warnings.length, 1);
await act(async () => actions.toggleReminder("interval"));
assert.equal(reminders.find((item) => item.id === "interval").nextDueAt, null);
await act(async () => view.unmount());
Date.now = originalNow;
console.log("PASS: reminder actions retain routine stats, stopwatch accumulation, countdown restart and one-shot safeguards");
