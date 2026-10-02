const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function menuHarness(ids, failDeletion = false) {
  const menus = new Map(ids.map(id => [`chat:${id}`, [{ command: "times" }, { command: "features" }]]));
  let reads = 0;
  const db = { collection(name) {
    assert.equal(name, "telegram-chat-owners");
    let offset = 0;
    let limit;
    return {
      select(...fields) { assert.equal(fields.length, 0); return this; },
      limit(value) { limit = value; return this; },
      startAfter(doc) { offset = ids.indexOf(doc.id) + 1; return this; },
      async get() {
        reads++;
        const docs = ids.slice(offset, offset + limit).map(id => ({ id }));
        return { docs, size: docs.length };
      }
    };
  } };
  const source = fs.readFileSync(require.resolve("../routes/telegram.js"), "utf8");
  const start = source.indexOf("async function registerBotCommands()");
  const end = source.indexOf('\nrouter.get("/status"', start);
  assert.ok(start >= 0 && end > start);
  const register = vm.runInNewContext(source.slice(start, end) + "\nregisterBotCommands", {
    db, BOT_API: "https://api.telegram.org", requiredEnv: () => "test-token",
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      const key = body.scope?.type === "chat" ? `chat:${body.scope.chat_id}` : body.scope?.type || "default";
      const deletion = url.endsWith("/deleteMyCommands");
      assert.ok(deletion || url.endsWith("/setMyCommands"));
      if (deletion && failDeletion) return { ok: false, status: 429, json: async () => ({ ok: false }) };
      if (deletion) menus.delete(key);
      else menus.set(key, body.commands);
      return { ok: true, json: async () => ({ ok: true }) };
    }
  });
  return { register, menus, reads: () => reads };
}

test("legacy chat menu is removed so the single current command becomes effective", async () => {
  const { register, menus } = menuHarness(["123", "-456"]);
  await register();
  assert.equal(menus.has("chat:123"), false);
  assert.equal(menus.has("chat:-456"), true, "group overrides must remain untouched");
  for (const scope of ["default", "all_private_chats"]) {
    assert.deepEqual(menus.get(scope), [{ command: "general_questions", description: "คำถามทั่วไป" }]);
  }
  await register();
  assert.equal(menus.has("chat:123"), false, "cleanup is safe to repeat");
});

test("legacy cleanup reaches chats beyond the first page", async () => {
  const harness = menuHarness(Array.from({ length: 201 }, (_, i) => String(i + 1)));
  await harness.register();
  assert.equal(harness.reads(), 3);
  assert.equal(harness.menus.size, 2);
});

test("failed cleanup propagates to the existing startup retry handler", async () => {
  const harness = menuHarness(["123"], true);
  await assert.rejects(harness.register(), /429/);
  assert.equal(harness.menus.has("chat:123"), true);
});
