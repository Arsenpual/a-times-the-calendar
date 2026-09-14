const { localDateTime } = require('./validator.js');
const { TIME_PERIODS, selectedPeriod, defaultTimeForPeriod, describePeriod, selectedHourTag, timeForHourTag, hourTagForLocal, describeHourTag } = require('./time-periods.js');

const SITUATION_RULES = [
  { match: /ทานข้าวตอนเช้า|กินข้าวเช้า|อาหารเช้า|มื้อเช้า|\bbreakfast\b/i, tag: 'morning', preferredStart: '06:00', durationMinutes: 120 },
  { match: /ทานข้าวกลางวัน|กินข้าวกลางวัน|อาหารกลางวัน|มื้อกลางวัน|\blunch\b/i, tag: 'noon', preferredStart: '12:00', durationMinutes: 60 },
  { match: /ทานข้าวเย็น|กินข้าวเย็น|อาหารเย็น|มื้อเย็น|\bdinner\b/i, tag: 'dusk', preferredStart: '18:00', durationMinutes: 120 },
  { match: /ทำการบ้าน|\bhomework\b/i, tag: 'evening', preferredStart: '19:00', durationMinutes: 120 },
  { match: /ก่อนนอน|เข้านอน|\bbefore bed\b|\bsleep\b/i, tag: 'night', preferredStart: '21:00', durationMinutes: 60 }
];

function inferSituation(text) {
  return SITUATION_RULES.find((rule) => rule.match.test(text)) || null;
}

function replacePeriodTag(tags, period) {
  const remaining = (Array.isArray(tags) ? tags : []).filter((tag) => !Object.hasOwn(TIME_PERIODS, tag));
  return period ? [...new Set([...remaining, period])] : remaining;
}
function replaceHourTag(tags, local) {
  const hourTag = hourTagForLocal(local);
  if (!hourTag) return Array.isArray(tags) ? tags : [];
  const remaining = (Array.isArray(tags) ? tags : []).filter((tag) => !/^hour-(?:[01]\d|2[0-3])$/.test(tag));
  // The hour tag is system metadata and takes priority over an excess optional
  // tag, while retaining the existing twenty-tag safety limit.
  return [...remaining.slice(0, 19), hourTag];
}
function addMinutes(local, minutes) {
  localDateTime(local);
  return new Date(new Date(`${local}:00Z`).getTime() + minutes * 60000).toISOString().slice(0, 16);
}
// Only fill missing values. Explicit dates/times from extraction win.
function applyAssumptions(raw, context) {
  const draft = { ...raw, assumptions: [...(raw.assumptions || [])] };
  const text = context.history.filter(item => item.role === 'user').map(item => item.text).concat(context.text).join(' ');
  const situation = inferSituation(`${draft.title || ''} ${text}`);
  const hasExplicitClockTime = /\b\d{1,2}(?::|\.)\d{2}\b|\d{1,2}\s*โมง|\b\d{1,2}\s*(?:am|pm)\b/i.test(text);
  // A recognisable phrase from the person wins over any incorrect period tag
  // proposed by the model.
  if (!draft.allDay && situation) draft.tags = replacePeriodTag(draft.tags, situation.tag);
  let date = draft.startLocal?.slice(0, 10) || draft.date || context.referenceDate;
  if (!draft.date && !draft.startLocal) {
    if (/พรุ่งนี้|\btomorrow\b/i.test(text)) date = addMinutes(`${date}T00:00`, 1440).slice(0, 10);
    draft.assumptions.push(`ใช้วันที่ ${date}`);
  }
  const homework = /การบ้าน|homework/i.test(draft.title || '');
  const period = selectedPeriod(draft.tags);
  const taggedHour = selectedHourTag(draft.tags);
  const duration = draft.allDay ? 1440 : draft.durationMinutes || situation?.durationMinutes || (homework ? 120 : 60);
  if (!Number.isInteger(duration) || duration < 1 || duration > 10080) throw new Error('ระยะเวลากิจกรรมไม่ถูกต้อง');
  // Gemini may return an arbitrary exact time for a broad phrase. When the
  // person gave no clock time, choose a suitable slot inside the tag's window;
  // a breakfast and a morning meeting therefore need not start together.
  // Limit this correction to recognised situations. A raw clock value can also
  // come from the manual editor, and must remain editable even when its tag is
  // broad (for example, a 16:30 task deliberately tagged #morning).
  if (!draft.allDay && situation && !hasExplicitClockTime) {
    draft.startLocal = '';
    draft.endLocal = '';
    draft.startTime = situation?.preferredStart || timeForHourTag(taggedHour) || defaultTimeForPeriod(period);
    draft.durationMinutes = duration;
  }
  if (!draft.startLocal) {
    const time = draft.allDay ? '00:00' : draft.startTime || timeForHourTag(taggedHour) || (period ? defaultTimeForPeriod(period) : '') || (/ช่วงเช้า|\bmorning\b/i.test(text) ? '09:00' : /ช่วงบ่าย|\bafternoon\b/i.test(text) ? '14:00' : '19:00');
    draft.startLocal = `${date}T${time}`;
    if (!raw.startTime && !raw.startLocal) draft.assumptions.push(`เวลาเริ่ม ${time}${period && !draft.allDay ? ` ภายใน tag ${period} (${describePeriod(period)})` : ''}`);
  }
  if (!draft.endLocal) {
    draft.endLocal = addMinutes(draft.startLocal, duration);
    if (!raw.durationMinutes) draft.assumptions.push(`ระยะเวลา ${duration} นาที`);
  }
  if (!draft.allDay) {
    draft.tags = replaceHourTag(draft.tags, draft.startLocal);
    const hourTag = selectedHourTag(draft.tags);
    if (hourTag) draft.assumptions.push(`กรอบเวลา ${describeHourTag(hourTag)} จาก tag ${hourTag}`);
  }
  return draft;
}
module.exports = { applyAssumptions, addMinutes, inferSituation };
