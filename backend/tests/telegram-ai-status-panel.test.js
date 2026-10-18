const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function statusPanelHarness({ existingMessageId = null, editError = null, pinError = null } = {}) {
  const calls = [];
  const auth = { telegramFreeAi: { enabled: false, history: [], statusMessageId: existingMessageId } };
  const authRef = {
    get: async () => ({ data: () => auth }),
    set: async (value) => {
      auth.telegramFreeAi = { ...auth.telegramFreeAi, ...value.telegramFreeAi };
      calls.push({ type: "saveAuth", value });
    }
  };
  const source = fs.readFileSync(require.resolve("../routes/telegram.js"), "utf8");
  const start = source.indexOf("function telegramAiStatusPanel(enabled)");
  const end = source.indexOf("async function handleAiCommandCallback", start);
  assert.ok(start >= 0 && end > start);
  const run = vm.runInNewContext(source.slice(start, end) + "\nrunTelegramFreeAiCommand", {
    BOT_API: "https://api.telegram.org",
    requiredEnv: () => "test-token",
    telegramFetch: async (url, options) => {
      assert.ok(url.endsWith("/pinChatMessage"));
      calls.push({ type: "pin", body: JSON.parse(options.body) });
      return { ok: !pinError, status: pinError ? 400 : 200, json: async () => ({ ok: !pinError, description: pinError }) };
    },
    telegramAuthDoc: () => authRef,
    isTelegramFreeAiAllowed: () => true,
    normalizedTelegramFreeAiHistory: history => history,
    editTelegramMessage: async (chatId, messageId, text, options) => {
      calls.push({ type: "edit", chatId, messageId, text, options });
      if (editError) throw new Error(editError);
    },
    saveChatMessage: async (userId, message) => calls.push({ type: "mirror", userId, message }),
    sendChatReply: async (userId, chatId, text, options) => {
      calls.push({ type: "send", userId, chatId, text, options });
      return { message_id: 123 };
    },
    console: { error: (...args) => calls.push({ type: "log", args }) }
  });
  const reply = async text => calls.push({ type: "reply", text });
  return { run: action => run(42, "owner", action, reply), calls, auth };
}

test("enabling AI creates and pins a status panel with a disable button", async () => {
  const harness = statusPanelHarness();
  await harness.run("on");
  assert.equal(harness.auth.telegramFreeAi.enabled, true);
  assert.equal(harness.auth.telegramFreeAi.statusMessageId, 123);
  const sent = harness.calls.find(call => call.type === "send");
  assert.match(sent.text, /🟢 โหมด AI เปิดอยู่/);
  assert.equal(sent.options.reply_markup.inline_keyboard[0][0].callback_data, "ai:off");
  assert.deepEqual(harness.calls.find(call => call.type === "pin").body, {
    chat_id: 42, message_id: 123, disable_notification: true
  });
});

test("disabling AI edits and repins the same status panel", async () => {
  const harness = statusPanelHarness({ existingMessageId: 77 });
  await harness.run("off");
  assert.equal(harness.auth.telegramFreeAi.enabled, false);
  assert.equal(harness.calls.some(call => call.type === "send"), false);
  const edit = harness.calls.find(call => call.type === "edit");
  assert.equal(edit.messageId, 77);
  assert.match(edit.text, /⚫ โหมด AI ปิดอยู่/);
  assert.equal(edit.options.reply_markup.inline_keyboard[0][0].callback_data, "ai:on");
  assert.equal(harness.calls.find(call => call.type === "pin").body.message_id, 77);
});

test("a deleted panel is replaced, while a pin failure does not undo AI mode", async () => {
  const harness = statusPanelHarness({ existingMessageId: 77, editError: "message to edit not found", pinError: "pin unavailable" });
  await harness.run("on");
  assert.equal(harness.auth.telegramFreeAi.enabled, true);
  assert.equal(harness.auth.telegramFreeAi.statusMessageId, 123);
  assert.equal(harness.calls.filter(call => call.type === "send").length, 1);
  assert.equal(harness.calls.some(call => call.type === "log"), true);
  assert.equal(harness.calls.some(call => call.type === "reply"), true);
});
