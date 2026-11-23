import test from "node:test";
import assert from "node:assert/strict";
import { validatePlanDraft } from "../lib/validate-plan-draft.js";

const draft = { title: "ประชุมทีม", startLocal: "2026-10-28T09:00", endLocal: "2026-10-28T10:00" };

test("edited plan drafts require a title and a real forward local-time range", () => {
  assert.equal(validatePlanDraft(draft), "");
  assert.match(validatePlanDraft({ ...draft, title: "   " }), /ชื่อกิจกรรม/);
  assert.match(validatePlanDraft({ ...draft, endLocal: "2026-10-28T08:00" }), /เวลาสิ้นสุด/);
  assert.match(validatePlanDraft({ ...draft, startLocal: "2026-02-30T09:00" }), /เวลาสิ้นสุด/);
  assert.match(validatePlanDraft({ ...draft, endLocal: "" }), /วันและเวลา/);
});
