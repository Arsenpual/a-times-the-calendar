import assert from "node:assert/strict";
import { deriveEventAnchorSessions } from "../src/features/reminder/lib/event-anchor-session.js";

const primaryAt = new Date("2026-09-14T10:00:00+07:00").getTime();
const source = {
  id: "weekly-work", type: "weekly", title: "ประชุมทีม", enabled: true,
  nextDueAt: primaryAt, eventAnchorCountdownMinutes: 15,
  eventAnchorStopwatchMinutes: 10, lineColor: "#d85a30"
};

const duringCountdown = deriveEventAnchorSessions([source], primaryAt - 5 * 60000);
assert.equal(duringCountdown.length, 1);
assert.equal(duringCountdown[0].type, "countdown");
assert.equal(duringCountdown[0].sourceReminderId, source.id);
assert.equal(duringCountdown[0].durationMs, 15 * 60000);

const duringStopwatch = deriveEventAnchorSessions([{ ...source, eventAnchorStartedAt: primaryAt, nextDueAt: primaryAt + 7 * 86400000 }], primaryAt + 5 * 60000);
assert.equal(duringStopwatch.length, 1);
assert.equal(duringStopwatch[0].type, "stopwatch");
assert.equal(duringStopwatch[0].eventAnchorEndsAt, primaryAt + 10 * 60000);

assert.equal(deriveEventAnchorSessions([{ ...source, eventAnchorStartedAt: primaryAt }], primaryAt + 11 * 60000).length, 0);
assert.equal(deriveEventAnchorSessions([{ ...source, type: "interval" }], primaryAt - 5 * 60000).length, 0);
console.log("event anchor session tests passed");
