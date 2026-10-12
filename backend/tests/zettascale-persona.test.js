const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { buildZettascaleInstruction } = require("../lib/zettascale-persona.js");
const source = fs.readFileSync(require.resolve("../routes/telegram.js"), "utf8");

test("Telegram conversation composes Afterlight character, optional owner tone and open conversation requirements", () => {
  const start = source.indexOf("function telegramFreeAiSystemInstruction()");
  const end = source.indexOf("function freeAiQuotaReply", start);
  const getInstruction = vm.runInNewContext(source.slice(start, end) + "\ntelegramFreeAiSystemInstruction", {
    buildZettascaleInstruction,
    process: { env: { TELEGRAM_FREE_AI_SYSTEM_INSTRUCTION: "Prefer short answers." } }
  });
  const text = getInstruction();
  assert.match(text, /THE AFTERLIGHT UNIVERSE/);
  assert.match(text, /Do not assume the user is Paul/);
  assert.match(text, /Prefer short answers/);
  assert.match(text, /You may discuss any topic/);
  assert.ok(text.indexOf("Task requirements") > text.indexOf("Prefer short answers"));
});

test("news generation receives the character without changing the report template and factual restrictions", async () => {
  const start = source.indexOf("async function summarizeTelegramNewsTopic(");
  const end = source.indexOf("function formatGoogleNewsBrief", start);
  let instruction;
  const summarize = vm.runInNewContext(source.slice(start, end) + "\nsummarizeTelegramNewsTopic", {
    buildZettascaleInstruction,
    claimGeminiChatUsage: async () => ({ status: "claimed" }),
    generateContent: async body => { instruction = body.systemInstruction.parts[0].text; return {}; },
    telegramFreeAiText: () => "รายงาน",
    spaceTelegramNewsBrief: text => text,
    TELEGRAM_NEWS_RESULTS_BY_PERIOD: { "7d": 10 }, TELEGRAM_NEWS_AI_BRIEF_LIMIT: 2400,
    thaiRelativeNewsTime: () => "วันนี้"
  });
  await summarize("owner", "ข่าวเด่น", [{ title: "ข่าว", source: "แหล่งข่าว", publishedAt: Date.now() }]);
  assert.match(instruction, /Reporting mode/);
  assert.match(instruction, /without banter, lore/);
  assert.match(instruction, /📅 กำหนดการสำคัญ/);
  assert.match(instruction, /whether it is past, current, or upcoming/);
  assert.match(instruction, /Never infer article details/);
  await summarize("owner", "ทุกหัวข้อ", [{ title: "ข่าว" }], { includeSummary: false });
  assert.match(instruction, /Do not add a conclusion, key-date section, or overall summary/);
});
