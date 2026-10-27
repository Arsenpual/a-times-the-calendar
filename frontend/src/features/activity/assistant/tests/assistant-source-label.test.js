import test from "node:test";
import assert from "node:assert/strict";
import { assistantSourceLabel } from "../lib/assistant-source-label.js";

test("assistant labels distinguish AI from calendar and deterministic planning", () => {
  assert.equal(assistantSourceLabel({ source: "calendar" }), "AI · ปฏิทิน");
  assert.equal(assistantSourceLabel({ source: "deterministic", calendarRange: { start: "2026-10-27" } }), "ปฏิทิน");
  assert.equal(assistantSourceLabel({ source: "scheduling" }), "ปฏิทิน · ช่วงว่าง");
  assert.equal(assistantSourceLabel({ source: "planning" }), "วางแผนจากตาราง");
  assert.equal(assistantSourceLabel({ source: "deterministic" }), "ร่างจากข้อความ");
  assert.equal(assistantSourceLabel({ source: "knowledge" }), "ข้อมูล T.i.M.E.S.");
  assert.equal(assistantSourceLabel({ source: "ai" }), "AI");
});
