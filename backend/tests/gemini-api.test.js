const test = require('node:test');
const assert = require('node:assert/strict');
const { generateContent } = require('../gemini-api.js');

test('Developer API uses server header and preserves structured output settings', async () => {
  const body = { contents: [], generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' } } };
  const result = await generateContent(body, { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), body);
    return { ok: true, json: async () => ({ candidates: [] }) };
  } });
  assert.deepEqual(result, { candidates: [] });
});

test('missing key fails before network; quota and errors are safe', async () => {
  await assert.rejects(generateContent({}, { env: {}, fetchImpl: () => assert.fail('network called') }), { status: 503 });
  await assert.rejects(generateContent({}, { env: { GEMINI_API_KEY: 'secret' }, fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'limit secret' } }) }) }), { status: 429, message: 'limit [redacted]' });
});
