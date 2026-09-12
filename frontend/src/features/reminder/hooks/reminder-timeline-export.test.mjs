import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import { reminderSlotsOnDate, localDateKey } from "../lib/reminder-date-view.js";
import { REMINDER_TYPE } from "../lib/reminder-due-logic.js";
import { getDisplayColor } from "../../activity/lib/activity-colors.js";
import { layoutOverlaps } from "../../activity/lib/timeline-layout.js";

// Load the real date parser without the unrelated JSX localization module.
const dateContext = vm.createContext({});
vm.runInContext(readFileSync(new URL("../../../shared/lib/date-utils.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "")
  + "\nthis.parseActivityDate = activityDate;", dateContext);
const activityDate = dateContext.parseActivityDate;

// Exercise the actual hook bodies with controlled state/effects, without a browser
// or Telegram/network calls. Browser layout is still a separate manual check.
function harness(file, name, dependencies = {}) {
  const state = [], effects = [];
  let cursor = 0;
  const context = vm.createContext({
    ...dependencies,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], (value) => { state[index] = value; }];
    },
    useRef(value) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: value };
      return state[index];
    },
    useMemo: (fn) => fn(),
    useEffect: (fn) => effects.push(fn)
  });
  const source = readFileSync(new URL(file, import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
  vm.runInContext(source + "\nthis.runHook = " + name + ";", context);
  return { effects, render(props) { cursor = 0; return context.runHook(props); } };
}

test("timeline filters, all-day exclusion, spans, zoom and viewport cleanup", () => {
  const day = new Date(2026, 8, 12, 10);
  const weekly = { id: "weekly", title: "Work", type: "weekly", days: [day.getDay()], time: "10:00", enabled: true, groupId: "work" };
  let frame, cancelled = false, timeoutCleared = false, scrolled;
  const h = harness("./use-reminder-timeline.js", "useReminderTimeline", {
    reminderSlotsOnDate, localDateKey, REMINDER_TYPE, activityDate, getDisplayColor, layoutOverlaps,
    requestAnimationFrame: (fn) => { frame = fn; return 1; },
    cancelAnimationFrame: () => { cancelled = true; },
    setTimeout: () => 2, clearTimeout: () => { timeoutCleared = true; }
  });
  const props = {
    reminders: [weekly, { ...weekly, id: "paused", enabled: false }, { ...weekly, id: "done", completedAt: 1 },
      { ...weekly, id: "other-group", groupId: "home" },
      { id: "timer", type: "countdown", title: "Timer", enabled: true, startedAt: day.getTime() - 60000, durationMs: 3600000, groupId: "work" }],
    activities: [
      { id: "all-day", start: { date: "2026-09-12" }, end: { date: "2026-09-13" } },
      { id: "timed", summary: "Activity", start: { dateTime: new Date(day.getTime() - 60000).toISOString() }, end: { dateTime: new Date(day.getTime() + 3600000).toISOString() } }
    ],
    categories: [], activityCategoryMap: {}, selectedDate: day, selectedDateKey: localDateKey(day),
    activeTypeFilter: "weekly", activeGroupFilter: "work", nowTick: day.getTime(),
    defaultLineColor: "#123456", formatDurationClock: String
  };
  let result = h.render(props);
  assert.equal(result.tapeRows.length, 96);
  assert.deepEqual(Array.from(result.tapeRows.flatMap(row => row.flags), item => item.id), ["weekly"]);
  assert.equal(result.calendarTimelineBlocks.length, 1);
  assert.equal(result.calendarTimelineBlocks[0].id, "timed");
  assert.equal(result.activityNowStatus.title, "Activity");
  assert.equal(result.runningReminderSpans.length, 0);
  result = h.render({ ...props, activeTypeFilter: null });
  assert.equal(result.runningReminderSpans.length, 1);
  result.tapeScrollRef.current = { clientHeight: 400, scrollTop: 0, scrollTo: (value) => { scrolled = value; } };
  result.focusReminderOnTimeline(weekly);
  assert.equal(scrolled.behavior, "smooth");
  assert.ok(scrolled.top >= 0);
  result.zoomOut(); result = h.render(props); assert.equal(result.minutesPerRow, 60);
  result.zoomOut(); result = h.render(props); assert.equal(result.minutesPerRow, 60);
  for (let i = 0; i < 5; i++) { result.zoomIn(); result = h.render(props); }
  assert.equal(result.minutesPerRow, 1);
  const cleanups = h.effects.map(effect => effect());
  assert.equal(typeof frame, "function");
  cleanups.forEach(cleanup => cleanup?.());
  assert.equal(cancelled, true);
  assert.equal(timeoutCleared, true);
});

test("export uses fresh reminders and filters; resets busy state on success/failure", async () => {
  let received, fail = false, alertMessage;
  const latest = [{ id: "latest" }];
  const h = harness("./use-reminder-export.js", "useReminderExport", {
    downloadReminderTimelineImage: async (payload) => { received = payload; if (fail) throw new Error("offline"); },
    window: { alert: (message) => { alertMessage = message; } }
  });
  const props = { getExportReminders: async () => latest, selectedDate: new Date(2026, 8, 12), activities: [],
    categories: [], activityCategoryMap: {}, groups: [], activeTypeFilter: "weekly", activeGroupFilter: "work" };
  const pending = h.render(props).exportTimelineImage();
  assert.equal(h.render(props).isExporting, true);
  await pending;
  assert.equal(received.reminders, latest);
  assert.equal(received.date, props.selectedDate);
  assert.equal(received.activeTypeFilter, "weekly");
  assert.equal(received.activeGroupFilter, "work");
  assert.equal(h.render(props).isExporting, false);
  fail = true;
  await h.render(props).exportTimelineImage();
  assert.match(alertMessage, /offline/);
  assert.equal(h.render(props).isExporting, false);
});
