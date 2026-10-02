const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
const { TOPICS, answerTimesQuestion } = require("../skills/activity-creation/times-knowledge");

test("reviewed answers match their exact questions and reference existing implementations", () => {
  const reviewed = TOPICS.filter((topic) => topic.question);
  assert.equal(reviewed.length, 16);
  for (const topic of reviewed) {
    assert.equal(answerTimesQuestion(topic.question), topic.answer);
    for (const source of topic.sources) assert.ok(existsSync(resolve(__dirname, "../..", source)), source);
  }
  assert.match(answerTimesQuestion("คำสั่งไหนใช้ AI quota?"), /ไม่เรียก Gemini/);
  assert.match(answerTimesQuestion("Activity Export ต่างจาก report อย่างไร?"), /เปลี่ยนชื่อไฟล์/);
  assert.match(answerTimesQuestion("ระบบใช้ Eisenhower Matrix แล้วหรือยัง?"), /ยังไม่จัด/);
  assert.equal(answerTimesQuestion("ช่วยแบ่งงานทำรายงาน 3 ชั่วโมงพรุ่งนี้"), null);
});

test("every reachable general question has a deterministic backend answer", async () => {
  const tree = await import(pathToFileURL(resolve(__dirname, "../../frontend/src/features/activity/assistant/config/activity-assistant-conversation-tree.js")).href);
  const pending = [...tree.getActivityAssistantRootQuestions()];
  const visited = new Set();
  while (pending.length) {
    const question = pending.shift();
    if (visited.has(question)) continue;
    visited.add(question);
    assert.ok(answerTimesQuestion(question), question);
    pending.push(...tree.getActivityAssistantKnowledgeFollowUps(question));
  }
  for (const topic of TOPICS.filter((item) => item.question)) assert.ok(visited.has(topic.question), topic.question);
});
