const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("../routes/telegram.js"), "utf8");

test("unchanged chat reads only metadata; changed revision loads bounded messages", async () => {
  let route, messageReads = 0, metadataReads = 0;
  let revision = "v1";
  const start = source.indexOf('router.get("/messages",');
  const end = source.indexOf('router.get("/messages/summary",', start);
  vm.runInNewContext(source.slice(start, end), {
    router: { get: (_, handler) => { route = handler; } },
    telegramAuthDoc: () => ({ get: async () => { metadataReads++; return { data: () => ({ chatRevision: revision }) }; } }),
    telegramMessagesCol: () => ({ orderBy: () => ({ limit: limit => {
      assert.equal(limit, 30);
      return { get: async () => { messageReads += 30; return { docs: [] }; } };
    } }) })
  });
  const res = { set() {}, status(code) { this.code = code; return this; }, end() {}, json(data) { this.body = data; } };
  const next = error => { throw error; };
  await route({ userId: "a", query: {} }, res, next);
  assert.equal(res.body.revision, "v1:30");
  for (let i = 0; i < 10; i++) await route({ userId: "a", query: { revision: "v1:30" } }, res, next);
  assert.equal(messageReads, 30, "idle polls never reread the message window");
  assert.equal(metadataReads, 11);
  assert.equal(res.code, 304);
  revision = "v2";
  await route({ userId: "a", query: { revision: "v1:30", limit: "1000" } }, res, next);
  assert.equal(messageReads, 60);
  assert.equal(res.body.revision, "v2:30");
});

test("unchanged news uses supplied snapshot and performs no transaction or writes", async () => {
  let transactions = 0;
  const start = source.indexOf("async function checkPriorityNewsSubscription(");
  const end = source.indexOf("async function runPriorityNewsChecks", start);
  const check = vm.runInNewContext(source.slice(start, end) + "\ncheckPriorityNewsSubscription", {
    searchGoogleNews: async () => [{ key: "seen" }],
    PRIORITY_NEWS_RESULT_LIMIT: 10,
    googleNewsItemKey: item => item.key,
    db: { runTransaction: async () => { transactions++; throw new Error("unexpected transaction"); } }
  });
  await check({ get: () => { throw new Error("duplicate read"); } }, { userId: "a", chatId: "1", topic: "news", seenItemKeys: ["seen"] });
  assert.equal(transactions, 0);
});

test("news watcher scans beyond 100 subscriptions and other instances skip the same interval", async () => {
  let lease = {}, scans = 0, checked = 0;
  const leaseRef = {};
  const page = count => ({ size: count, docs: Array.from({ length: count }, () => ({ ref: {}, data: () => ({}) })) });
  const query = { orderBy() { return this; }, limit(count) { return count === 1 ? { get: async () => ({ empty: false }) } : this; }, startAfter() { return this; }, get: async () => page(++scans === 1 ? 100 : 3) };
  const start = source.indexOf("async function runPriorityNewsChecks(");
  const end = source.indexOf("async function handleNewsCommandCallback", start);
  const run = vm.runInNewContext(source.slice(start, end) + "\nrunPriorityNewsChecks", {
    db: {
      collection: name => name === "server-jobs" ? { doc: () => leaseRef } : query,
      runTransaction: callback => callback({ get: async () => ({ data: () => lease }), set: (_, data) => { lease = data; } })
    },
    FieldPath: { documentId: () => "__name__" }, PRIORITY_NEWS_SUBSCRIPTIONS: "news", PRIORITY_NEWS_POLL_MS: 300_000,
    checkPriorityNewsSubscription: async () => { checked++; }, console
  });
  await run();
  await run();
  assert.equal(scans, 2);
  assert.equal(checked, 103);
});

test("mark-read skips history when the unread counter is zero", async () => {
  let route, reads = 0;
  const start = source.indexOf('router.post("/messages/read",');
  const end = source.indexOf('router.post("/messages",', start);
  vm.runInNewContext(source.slice(start, end), {
    router: { post: (_, handler) => { route = handler; } },
    telegramAuthDoc: () => ({}),
    telegramMessagesCol: () => { throw new Error("unnecessary history read"); },
    db: { runTransaction: callback => callback({ get: async () => { reads++; return { data: () => ({ unreadCount: 0 }) }; } }) }
  });
  await route({ userId: "a" }, { json() {} }, error => { throw error; });
  assert.equal(reads, 1);
});

test("news changed/deleted during search is not delivered or written", async () => {
  const start = source.indexOf("async function checkPriorityNewsSubscription(");
  const end = source.indexOf("async function runPriorityNewsChecks", start);
  const check = vm.runInNewContext(source.slice(start, end) + "\ncheckPriorityNewsSubscription", {
    searchGoogleNews: async () => [{ key: "new" }], PRIORITY_NEWS_RESULT_LIMIT: 10,
    googleNewsItemKey: item => item.key,
    db: { runTransaction: callback => callback({ get: async () => ({ data: () => undefined }), set: () => { throw new Error("recreated subscription"); } }) },
    claimDelivery: () => { throw new Error("delivered after unsubscribe"); }
  });
  await check({}, { userId: "a", chatId: "1", topic: "news", seenItemKeys: [] });
});

test("repair marker survives process restarts; incomplete repairs remain retryable", async () => {
  const dbSource = fs.readFileSync(require.resolve("../firestore-db.js"), "utf8");
  const start = dbSource.indexOf("async function repairLegacyActivityCategoryMappings(");
  const fn = dbSource.slice(start, dbSource.indexOf("\n}", start) + 2);
  let marker = {}, scans = 0, fail = true;
  const collection = { get: async () => { scans++; return { docs: [{ id: "x", data: () => ({ categoryId: "c" }) }] }; }, doc: () => ({}) };
  const makeProcess = () => vm.runInNewContext(fn + "\nrepairLegacyActivityCategoryMappings", {
    repairedActivityCategoryUsers: new Set(), activityCategoryRepairPromises: new Map(),
    userDoc: () => ({ get: async () => ({ data: () => marker }), set: async data => { marker = data; }, collection: () => collection }),
    activityCategoriesCol: () => ({ ...collection, get: async () => { scans++; return { docs: [] }; } }),
    db: { batch: () => ({ set() {}, commit: async () => { if (fail) throw new Error("write failed"); } }) },
    console: { log() {} }
  });
  await assert.rejects(makeProcess()("a"), /write failed/);
  assert.equal(marker.activityCategoryRepairVersion, undefined);
  fail = false;
  await makeProcess()("a");
  assert.equal(marker.activityCategoryRepairVersion, 1);
  const before = scans;
  await makeProcess()("a");
  assert.equal(scans, before, "new process skips both collection scans");
});
