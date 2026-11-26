const test = require('node:test');
const assert = require('node:assert/strict');
const { generateContent, normalizeGeminiModel, DEFAULT_MODEL, FALLBACK_MODEL } = require('../lib/gemini-api.js');

test('Developer API uses server header and preserves structured output settings', async () => {
  const body = { contents: [], generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' } } };
  const result = await generateContent(body, { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl: async (url, options) => {
    assert.equal(url, `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`);
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    assert.equal(options.headers['User-Agent'], 'aistudio-build');
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), body);
    return { ok: true, json: async () => ({ candidates: [] }) };
  } });
  assert.deepEqual(result, { candidates: [] });
});

test('legacy and invalid model aliases normalize to active Gemini models', () => {
  assert.equal(normalizeGeminiModel('gemini-3.5-flash-lite'), FALLBACK_MODEL);
  assert.equal(normalizeGeminiModel('gemini-3.8-flash'), DEFAULT_MODEL);
  assert.equal(normalizeGeminiModel('gemini-2.5-flash'), DEFAULT_MODEL);
  assert.equal(normalizeGeminiModel('gemini-4-hydrogen'), 'gemini-4-hydrogen');
  assert.equal(normalizeGeminiModel('gemini-3.1-flash-lite'), 'gemini-3.1-flash-lite');
  // Malformed env/secret formats that previously triggered unexpected model name format 400
  assert.equal(normalizeGeminiModel('"gemini-2.5-flash"'), DEFAULT_MODEL);
  assert.equal(normalizeGeminiModel("'gemini-4-hydrogen'"), 'gemini-4-hydrogen');
  assert.equal(normalizeGeminiModel('models/gemini-2.5-flash'), DEFAULT_MODEL);
  assert.equal(normalizeGeminiModel('models/models/gemini-4-hydrogen'), 'gemini-4-hydrogen');
  assert.equal(
    normalizeGeminiModel('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'),
    DEFAULT_MODEL
  );
  assert.equal(normalizeGeminiModel('gemini-2.5-flash,gemini-2.0-flash'), DEFAULT_MODEL);
  assert.equal(normalizeGeminiModel('Gemini 4 Hydrogen'), 'gemini-4-hydrogen');
  assert.equal(normalizeGeminiModel('Gemini 2.5 Flash'), DEFAULT_MODEL);
  assert.equal(normalizeGeminiModel('MY_GEMINI_MODEL'), DEFAULT_MODEL);
  assert.equal(normalizeGeminiModel('models/'), DEFAULT_MODEL);
});

test('missing key fails before network; quota and errors are safe', async () => {
  await assert.rejects(generateContent({}, { env: {}, fetchImpl: () => assert.fail('network called') }), { status: 503 });
  await assert.rejects(generateContent({}, { env: { GEMINI_API_KEY: 'secret' }, fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'limit secret' } }) }) }), { status: 429, message: 'limit [redacted]' });
});
