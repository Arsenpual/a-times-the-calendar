const test = require("node:test");
const assert = require("node:assert/strict");
const { telegramFetch } = require("../lib/telegram-fetch.js");
const url = "https://api.telegram.org/botTEST_SECRET/sendMessage";

function connectFailure(code = "ETIMEDOUT") {
  const error = new TypeError("fetch failed");
  error.cause = { code, syscall: "connect" };
  return error;
}

test("failed connection retries once with the same request; successful response is returned", async () => {
  let calls = 0;
  const response = { ok: true };
  const delays = [];
  const result = await telegramFetch(url, { method: "POST", body: "message" }, {
    fetchImpl: async (requested, options) => {
      calls++;
      assert.equal(requested, url);
      assert.equal(options.body, "message");
      assert.ok(options.signal);
      if (calls === 1) throw connectFailure();
      return response;
    },
    wait: async ms => { delays.push(ms); }
  });
  assert.equal(result, response);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [300]);
});

test("aggregate of failed connections retries; final error identifies operation without exposing token", async () => {
  let calls = 0;
  await assert.rejects(telegramFetch(url, {}, {
    fetchImpl: async () => {
      calls++;
      const error = new TypeError(`fetch failed ${url}`);
      error.cause = Object.assign(new AggregateError([
        { code: "ETIMEDOUT", syscall: "connect" }, { code: "ENETUNREACH", syscall: "connect" }
      ]), { code: "ETIMEDOUT" });
      throw error;
    }, wait: async () => {}
  }), error => {
    assert.equal(error.status, 503);
    assert.equal(error.service, "telegram");
    assert.equal(error.operation, "sendMessage");
    assert.match(error.message, /ETIMEDOUT/);
    assert.doesNotMatch(error.stack, /TEST_SECRET/);
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal(calls, 2);
});

test("ambiguous socket failures or timeouts are never retried", async () => {
  for (const cause of [{ code: "ECONNRESET" }, { code: "ETIMEDOUT", syscall: "read" }, { code: "UND_ERR_SOCKET" }]) {
    let calls = 0;
    await assert.rejects(telegramFetch(url, {}, { fetchImpl: async () => {
      calls++;
      throw Object.assign(new TypeError("fetch failed"), { cause });
    } }));
    assert.equal(calls, 1);
  }
});

test("abort after sending and mixed aggregate failures are never retried", async () => {
  for (const error of [
    Object.assign(new Error("timed out"), { name: "TimeoutError" }),
    Object.assign(new Error("fetch failed"), { cause: new AggregateError([{ syscall: "connect", code: "ETIMEDOUT" }, { code: "ECONNRESET" }]) })
  ]) {
    let calls = 0;
    await assert.rejects(telegramFetch(url, {}, { fetchImpl: async () => { calls++; throw error; } }));
    assert.equal(calls, 1);
  }
});

test("HTTP errors are returned without resending requests", async () => {
  let calls = 0;
  const response = { ok: false, status: 429 };
  assert.equal(await telegramFetch(url, {}, { fetchImpl: async () => { calls++; return response; } }), response);
  assert.equal(calls, 1);
});

test("caller cancellation prevents a retry and preserves the supplied signal", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(telegramFetch(url, { signal: controller.signal }, { fetchImpl: async (_, options) => {
    calls++;
    assert.equal(options.signal, controller.signal);
    throw connectFailure();
  } }));
  assert.equal(calls, 1);
});
