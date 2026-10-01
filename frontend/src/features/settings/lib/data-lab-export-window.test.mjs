import assert from "node:assert/strict";
import test from "node:test";
import { dataLabExportPath, defaultDataLabExportWindow, validateDataLabExportWindow } from "./data-lab-export-window.js";

test("data lab export defaults to an explicit seven-day window", () => {
  assert.deepEqual(defaultDataLabExportWindow(new Date("2026-10-01T12:00:00Z")), {
    windowStart: "2026-10-01", windowEnd: "2026-10-08"
  });
});

test("data lab export accepts only bounded forward date windows", () => {
  assert.equal(validateDataLabExportWindow("2026-10-01", "2026-10-08"), "");
  assert.match(validateDataLabExportWindow("2026-10-08", "2026-10-01"), /สิ้นสุด/);
  assert.match(validateDataLabExportWindow("2026-10-01", "2026-11-02"), /31/);
  assert.match(validateDataLabExportWindow("not-a-date", "2026-10-08"), /ถูกต้อง/);
  assert.equal(dataLabExportPath("2026-10-01", "2026-10-08"), "/api/data-lab/activity-export?windowStart=2026-10-01&windowEnd=2026-10-08");
});
