const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { startStartupTask } = require("../lib/startup-task.js");

test("quota backoff retries only cleanup; successful webhook and menu stay complete", async () => {
  const scheduled = [], logs = [];
  const options = { schedule: (fn, delay) => { scheduled.push({ fn, delay }); return { unref() {} }; }, logger: { error: (...args) => logs.push(args), log() {} } };
  let webhook = 0, menu = 0, cleanup = 0;
  await startStartupTask("webhook", async () => {
    webhook++;
    await startStartupTask("menu", async () => { menu++; }, options);
    await startStartupTask("cleanup", async () => {
      if (++cleanup === 1) throw Object.assign(new Error("Quota exceeded"), { code: 8 });
    }, options);
  }, options);
  assert.equal(scheduled[0].delay, 300_000);
  await scheduled[0].fn();
  assert.deepEqual({ webhook, menu, cleanup }, { webhook: 1, menu: 1, cleanup: 2 });
  assert.match(logs[0][0], /cleanup/);
});

test("transient startup failures retry with bounded backoff", async () => {
  const pending = [];
  await startStartupTask("webhook", async () => { throw new Error("offline"); }, {
    schedule: (fn, delay) => { pending.push({ fn, delay }); return {}; }, logger: { error() {}, log() {} }
  });
  for (let i = 0; i < 5; i++) await pending[i].fn();
  assert.deepEqual(pending.map(item => item.delay), [3000, 10000, 30000, 60000, 300000, 300000]);
});

test("webhook registration succeeds independently of Firestore and menu cleanup", async () => {
  const source = fs.readFileSync(require.resolve("../routes/telegram.js"), "utf8");
  const start = source.indexOf("module.exports.registerWebhook =");
  const end = source.indexOf("module.exports.webhook =", start);
  const module = { exports: {} };
  const calls = [];
  vm.runInNewContext(source.slice(start, end), {
    module, process: { env: { TELEGRAM_BOT_TOKEN: "test", TELEGRAM_WEBHOOK_SECRET: "secret" } },
    BOT_API: "https://api.telegram.org", console: { log() {}, warn() {} },
    telegramFetch: async url => { calls.push(url.split("/").at(-1)); return { ok: true, json: async () => ({ ok: true, result: { username: "test" } }) }; },
    registerBotCommands: () => { throw new Error("must be independent"); },
    db: { collection: () => { throw new Error("Firestore unavailable"); } }
  });
  assert.equal(await module.exports.registerWebhook("https://example.test"), true);
  assert.deepEqual(calls, ["getMe", "setWebhook"]);
});
