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
  const guidedStep = typeof body.guidedStep === 'string' ? body.guidedStep.slice(0, 80) : '';
  const guidedActivity = body.guidedActivity && typeof body.guidedActivity === 'object' ? {
    title: typeof body.guidedActivity.title === 'string' ? body.guidedActivity.title.slice(0, 200) : '',
    date: typeof body.guidedActivity.date === 'string' ? body.guidedActivity.date.slice(0, 10) : '',
    time: typeof body.guidedActivity.time === 'string' ? body.guidedActivity.time.slice(0, 5) : '',
    durationMinutes: Number.isInteger(body.guidedActivity.durationMinutes) ? body.guidedActivity.durationMinutes : 0
  } : null;
  return { text, referenceDate, timeZone, history, categories, guidedStep, guidedActivity };
}
function finishResult(raw, context) {
  if (!raw || typeof raw.ready !== 'boolean' || !raw.draft) fail('AI ส่งข้อมูลไม่ครบ');
  const reply = bounded(raw.reply, 4000, 'คำตอบ');
  if (!reply) fail('AI ไม่ได้ส่งคำตอบ');
  // Product answers and out-of-scope replies must not be mistaken for a
  // stalled activity draft after the second user turn.
  if (raw.mode === 'about' || raw.mode === 'unsupported') return { reply, ready: false, draft: null };
  if (!raw.ready) {
    // Keep safe, partial facts from Gemini so a typed reply to a guided
    // question (for example the activity title) survives into the next step.
    const partial = raw.draft || {};
    const collected = {
      title: typeof partial.title === 'string' ? partial.title.trim().slice(0, 200) : '',
      date: typeof partial.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(partial.date) ? partial.date : '',
      time: typeof partial.startTime === 'string' && /^\d{2}:\d{2}$/.test(partial.startTime) ? partial.startTime : '',
      durationMinutes: Number.isInteger(partial.durationMinutes) && partial.durationMinutes >= 30 && partial.durationMinutes <= 720 ? partial.durationMinutes : 0
    };
    // In the guided flow, a previous field (such as title) may already be in
    // guidedActivity. Never replace Gemini's next-field question with the old
    // generic “please provide a title” fallback.
    const safeReply = context.guidedStep
      ? reply
      : context.history.filter(item => item.role === 'user').length >= 2
        ? 'กรุณาระบุชื่อกิจกรรมที่ต้องการสร้างให้ชัดเจนครับ'
        : reply;
    return { reply: safeReply, ready: false, draft: null, collected };
  }
  return { reply, ready: true, draft: validateDraft(applyAssumptions(raw.draft, context), context.categories) };
}
module.exports = { schema, buildPrompt, prepareContext, finishResult, validateDraft };
