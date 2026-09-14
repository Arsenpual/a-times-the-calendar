const schema = require('./schema.js');
const buildPrompt = require('./prompt.js');
const { applyAssumptions } = require('./assumptions.js');
const { validateDraft, localDateTime, bounded, fail } = require('./validator.js');
function prepareContext(body) {
  const text = bounded(body.text, 1200, 'ข้อความ');
  if (!text) fail('กรุณาระบุข้อความ');
  const referenceDate = body.referenceDate;
  localDateTime(`${referenceDate}T00:00`);
  const timeZone = body.timeZone || 'Asia/Bangkok';
  try { new Intl.DateTimeFormat('en', { timeZone }).format(); } catch { fail('Timezone ไม่ถูกต้อง'); }
  const history = (Array.isArray(body.history) ? body.history : []).slice(-10).map(item => ({
    role: item.role === 'assistant' ? 'assistant' : 'user', text: bounded(item.text, 4000, 'ประวัติแชต')
  }));
  // Defend the API too: callers must not send the current text twice, once as
  // `text` and once as the newest history entry.
  if (history.at(-1)?.role === 'user' && history.at(-1).text === text) history.pop();
  const categories = (Array.isArray(body.categories) ? body.categories : []).slice(0, 50).map(name => bounded(name, 200, 'หมวดหมู่'));
  return { text, referenceDate, timeZone, history, categories };
}
function finishResult(raw, context) {
  if (!raw || typeof raw.ready !== 'boolean' || !raw.draft) fail('AI ส่งข้อมูลไม่ครบ');
  const reply = bounded(raw.reply, 4000, 'คำตอบ');
  if (!reply) fail('AI ไม่ได้ส่งคำตอบ');
  // Product answers and out-of-scope replies must not be mistaken for a
  // stalled activity draft after the second user turn.
  if (raw.mode === 'about' || raw.mode === 'unsupported') return { reply, ready: false, draft: null };
  if (!raw.ready) return { reply: context.history.filter(item => item.role === 'user').length >= 2 ? 'กรุณาระบุชื่อกิจกรรมที่ต้องการสร้างให้ชัดเจนครับ' : reply, ready: false, draft: null };
  return { reply, ready: true, draft: validateDraft(applyAssumptions(raw.draft, context), context.categories) };
}
module.exports = { schema, buildPrompt, prepareContext, finishResult, validateDraft };
