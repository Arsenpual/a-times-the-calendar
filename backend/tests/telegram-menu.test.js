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
  const catalogStart = source.indexOf("const BOT_MENU_COMMANDS =");
  const catalogEnd = source.indexOf("\nconst COMMAND_HELP_TEXT", catalogStart);
  assert.ok(catalogStart >= 0 && catalogEnd > catalogStart);
  const BOT_MENU_COMMANDS = vm.runInNewContext(source.slice(catalogStart, catalogEnd) + "\nBOT_MENU_COMMANDS");
  const start = source.indexOf("async function registerBotCommands()");
  const end = source.indexOf('\nrouter.get("/status"', start);
  assert.ok(start >= 0 && end > start);
  const register = vm.runInNewContext(source.slice(start, end) + "\nregisterBotCommands", {
    db, BOT_API: "https://api.telegram.org", BOT_MENU_COMMANDS, requiredEnv: () => "test-token",
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

test("legacy chat menu is removed so the current command menu becomes effective", async () => {
  const { register, menus } = menuHarness(["123", "-456"]);
  await register();
  assert.equal(menus.has("chat:123"), false);
  assert.equal(menus.has("chat:-456"), true, "group overrides must remain untouched");
  for (const scope of ["default", "all_private_chats"]) {
    assert.deepEqual(menus.get(scope), [
      { command: "start", description: "เริ่มต้นใช้งาน T.i.M.E.S." },
      { command: "general_questions", description: "คำถามทั่วไป" },
      { command: "cmd", description: "ดูรายการคำสั่งทั้งหมด" },
      { command: "times", description: "T.i.M.E.S. คืออะไร" },
      { command: "features", description: "ดูฟีเจอร์ T.i.M.E.S." },
      { command: "ai", description: "สถานะและโหมด AI ส่วนตัว" },
      { command: "ai_commands", description: "ชุดคำสั่ง AI" },
      { command: "ai_on", description: "เปิดโหมด AI (/ai on)" },
      { command: "ai_off", description: "ปิดโหมด AI (/ai off)" },
      { command: "ai_clear", description: "ล้างบริบท AI (/ai clear)" },
      { command: "ai_reset", description: "ล้างบริบท AI (/ai reset)" },
      { command: "ai_status", description: "ดูสถานะ AI (/ai status)" },
      { command: "myid", description: "ดู Telegram chat ID" },
      { command: "chatid", description: "ดู Telegram chat ID (alias)" },
      { command: "news", description: "เปิดชุดคำสั่งข่าว" },
      { command: "news_add", description: "เพิ่มหัวข้อข่าว" },
      { command: "news_remove", description: "ลบหัวข้อข่าว" },
      { command: "news_list", description: "ดูหัวข้อข่าว" },
      { command: "news_now", description: "อ่านข่าวล่าสุด" },
      { command: "announce", description: "ตั้งค่า announcement-ticker" }
    ]);
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
