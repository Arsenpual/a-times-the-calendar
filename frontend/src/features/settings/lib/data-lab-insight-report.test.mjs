import assert from "node:assert/strict";
import test from "node:test";
import { parseDataLabInsightReport } from "./data-lab-insight-report.js";

test("recognizes each supported Data Lab report without importing activity detail", () => {
  const quality = parseDataLabInsightReport(JSON.stringify({ summary: { totalActivities: 12, validActivities: 10, invalidActivities: 2, priorityContextReadyActivities: 7 } }));
  const priority = parseDataLabInsightReport(JSON.stringify({ summary: { highConfidence: 2, moderateConfidence: 3, lowConfidence: 4, readyForHumanReview: 2 } }));
  const weekly = parseDataLabInsightReport(JSON.stringify({ summary: { totalScheduledMinutes: 420, allDayActivities: 1, daysWithOverlap: 2, invalidActivities: 0 } }));
  const scheduling = parseDataLabInsightReport(JSON.stringify({ summary: { totalCases: 5, passedCases: 4, failedCases: 1 }, cases: [] }));
  assert.deepEqual([quality.type, priority.type, weekly.type, scheduling.type], ["quality", "priority", "weekly", "scheduling"]);
  assert.equal(quality.metrics.length, 4);
  assert.equal(priority.metrics[0].value, 2);
});

test("rejects malformed or unsupported input", () => {
  assert.throws(() => parseDataLabInsightReport("not json"), /JSON/);
  assert.throws(() => parseDataLabInsightReport(JSON.stringify({})), /summary/);
  assert.throws(() => parseDataLabInsightReport(JSON.stringify({ summary: { unexpected: true } })), /ไม่รู้จัก/);
});
