const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadAccess(env) {
  let reads = 0;
  let transactions = 0;
  const ref = { collection: () => ref, doc: () => ref, get: async () => { reads++; return { data: () => ({ count: 0 }) }; } };
  const db = { collection: () => ref, runTransaction: async (callback) => {
    transactions++;
    return callback({ get: () => ref.get(), set: () => {} });
  } };
  const context = { module: { exports: {} }, process: { env }, Intl, Date,
    require: () => ({ db, telegramAuthDoc: () => ref }) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../gemini-chat.js'), 'utf8'), context);
  return { api: context.module.exports, counts: () => ({ reads, transactions }) };
}

test('ordinary users cannot spend chat/draft quota even with legacy allowlist/local bypass', async () => {
  for (const NODE_ENV of ['production', 'development']) {
    const { api, counts } = loadAccess({ NODE_ENV, GEMINI_CHAT_ALLOWED_UIDS: 'user', GEMINI_CHAT_ALLOW_LOCAL_DEVELOPMENT: 'true', GEMINI_CHAT_DEVELOPER_UIDS: 'developer' });
    assert.equal((await api.getGeminiChatStatus('user')).enabled, false);
    assert.equal((await api.claimGeminiChatUsage('user')).status, 'not-allowed');
    assert.equal((await api.claimGeminiDraftUsage('user')).status, 'not-allowed');
    assert.deepEqual(counts(), { reads: 0, transactions: 0 });
  }
});

test('only explicit developer UID receives access; global off still wins', async () => {
  const { api } = loadAccess({ GEMINI_CHAT_DEVELOPER_UIDS: ' developer,other ' });
  assert.equal((await api.getGeminiChatStatus('developer')).enabled, true);
  assert.equal((await api.claimGeminiChatUsage('developer')).status, 'claimed');
  assert.equal((await api.claimGeminiDraftUsage('developer')).status, 'claimed');
  const disabled = loadAccess({ GEMINI_CHAT_DEVELOPER_UIDS: 'developer', GEMINI_CHAT_ENABLED: 'false' });
  assert.equal((await disabled.api.claimGeminiChatUsage('developer')).status, 'globally-disabled');
  assert.equal((await disabled.api.claimGeminiDraftUsage('developer')).status, 'globally-disabled');
  assert.equal((await loadAccess({}).api.claimGeminiChatUsage('anyone')).status, 'not-allowed');
});
