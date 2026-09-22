const schema = require('./schema.js');
const buildPrompt = require('./prompt.js');
const { applyAssumptions } = require('./assumptions.js');
const { validateDraft, localDateTime, bounded, fail } = require('./validator.js');
const { normalizeScheduleContext, buildAvailableWindows, assessDraftSchedule } = require('./schedule-context.js');

function hasCompleteExplicitTiming(draft) {
  if (!draft || typeof draft.title !== 'string' || !draft.title.trim()) return false;
  const hasDate = typeof draft.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(draft.date);
  const hasStart = typeof draft.startLocal === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.startLocal)
    || hasDate && typeof draft.startTime === 'string' && /^\d{2}:\d{2}$/.test(draft.startTime);
  const hasEnd = typeof draft.endLocal === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.endLocal)
    || Number.isInteger(draft.durationMinutes) && draft.durationMinutes >= 30;
  return hasStart && hasEnd;
}

function fallbackReplyForDraft(raw) {
  const title = typeof raw?.draft?.title === 'string' ? raw.draft.title.trim().slice(0, 200) : '';
  if (raw?.ready) {
    return title
      ? `สรุปร่างกิจกรรม “${title}” พร้อมให้ตรวจสอบแล้วครับ`
      : 'สรุปร่างกิจกรรมพร้อมให้ตรวจสอบแล้วครับ';
  }
  return title
    ? `ผมรับรายละเอียดของ “${title}” แล้วครับ`
    : 'ผมรับรายละเอียดกิจกรรมแล้วครับ';
}

function normalizeAssistantPreferences(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const time = (key) => /^([01]\d|2[0-3]):[0-5]\d$/.test(source[key]?.value || "") && source[key]?.enabled !== false
    ? source[key].value : "";
  const duration = (key) => Number.isInteger(source[key]?.value) && source[key]?.value >= 15 && source[key]?.value <= 720 && source[key]?.enabled !== false
    ? source[key].value : 0;
  return {
    homeworkDefaultStart: time("homeworkDefaultStart"),
    homeworkDefaultDurationMinutes: duration("homeworkDefaultDurationMinutes"),
    exerciseDefaultDurationMinutes: duration("exerciseDefaultDurationMinutes"),
    preferredEveningStart: time("preferredEveningStart")
  };
}
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
  const userTags = (Array.isArray(body.userTags) ? body.userTags : []).slice(0, 100).filter(tag => typeof tag === 'string').map(tag => tag.trim().slice(0, 40)).filter(Boolean);
  const scheduleContext = {
    activities: normalizeScheduleContext(body.scheduleContext),
    availableWindows: buildAvailableWindows(body.scheduleContext)
  };
  const assistantPreferences = normalizeAssistantPreferences(body.assistantPreferences);
  return { text, referenceDate, timeZone, history, categories, userTags, scheduleContext, guidedStep, guidedActivity, assistantPreferences };
}
function finishResult(raw, context) {
  if (!raw || typeof raw.ready !== 'boolean' || !raw.draft) fail('AI ส่งข้อมูลไม่ครบ');
  // Vertex may rarely return a schema-valid draft with an empty optional
  // text part. The draft is still reviewable, so provide a deterministic
  // Thai summary instead of discarding the complete activity request.
  const reply = bounded(raw.reply, 4000, 'คำตอบ') || fallbackReplyForDraft(raw);
  // Product answers and out-of-scope replies must not be mistaken for a
  // stalled activity draft after the second user turn.
  if (raw.mode === 'about' || raw.mode === 'unsupported') return { reply, ready: false, draft: null };
  // Gemini may decide a short input is enough for a draft. During the guided
  // flow it is only a field collector: final drafting is allowed exclusively
  // after title, date, start time, and duration have all been collected.
  // Gemini sometimes returns a complete structured draft but phrases its
  // reply as a confirmation question. A complete explicit request should
  // still go straight to ActivityPopup; that popup is the real review gate.
  const promoteCompleteDraft = !context.guidedStep && !raw.ready && hasCompleteExplicitTiming(raw.draft);
  if ((!raw.ready && !promoteCompleteDraft) || context.guidedStep) {
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
module.exports = { schema, buildPrompt, prepareContext, finishResult, validateDraft, assessDraftSchedule, normalizeAssistantPreferences };
