import test from "node:test";
import assert from "node:assert/strict";
import { isGuidedActivityFieldComplete, validateGuidedActivity } from "../lib/guided-activity-validation.js";

const valid = { title: "ประชุมทีม", date: "2026-10-28", time: "09:30", durationMinutes: 60 };

test("guided activity accepts a complete draft and rejects invalid rail edits before handoff", () => {
  assert.equal(validateGuidedActivity(valid), "");
  assert.match(validateGuidedActivity({ ...valid, title: "   " }), /ชื่อกิจกรรม/);
  assert.match(validateGuidedActivity({ ...valid, date: "2026-02-30" }), /วันที่/);
  assert.match(validateGuidedActivity({ ...valid, time: "25:00" }), /เวลาเริ่ม/);
  assert.match(validateGuidedActivity({ ...valid, durationMinutes: 0 }), /ระยะเวลา/);
  assert.match(validateGuidedActivity({ ...valid, durationMinutes: 29 }), /30 ถึง 720/);
  assert.match(validateGuidedActivity({ ...valid, durationMinutes: 721 }), /30 ถึง 720/);
});

test("rail marks each step complete from its own valid value", () => {
  for (const [field, value] of Object.entries(valid)) assert.equal(isGuidedActivityFieldComplete(field, value), true);
  assert.equal(isGuidedActivityFieldComplete("date", "2026-02-30"), false);
  assert.equal(isGuidedActivityFieldComplete("title", "  "), false);
  assert.equal(isGuidedActivityFieldComplete("time", "24:00"), false);
  assert.equal(isGuidedActivityFieldComplete("durationMinutes", 0), false);
});
