const { localDateTime } = require('./validator.js');
const { TIME_PERIODS, selectedPeriod, defaultTimeForPeriod, describePeriod, selectedHourTag, timeForHourTag, hourTagForLocal, startTagForLocal, durationTagForRange, describeHourTag, periodTagsForRange } = require('./time-periods.js');

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
function inferPeriodFromText(text) {
  const rules = [
    ['late-night', /หลังเที่ยงคืน|ดึกมาก|\blate night\b/i],
    ['dawn', /เช้ามืด|รุ่งเช้า|\bdawn\b/i],
    ['morning', /ช่วงเช้า|ตอนเช้า|\bmorning\b/i],
    ['noon', /ตอนเที่ยง|ช่วงเที่ยง|\bnoon\b/i],
    ['afternoon', /ช่วงบ่าย|ตอนบ่าย|\bafternoon\b/i],
    ['dusk', /ช่วงเย็น|ตอนเย็น|หัวค่ำ|\bdusk\b/i],
    ['evening', /ช่วงค่ำ|ตอนค่ำ|\bevening\b/i],
    ['night', /กลางคืน|ตอนกลางคืน|\bnight\b/i]
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0];
}

function replacePeriodTag(tags, period) {
  const remaining = (Array.isArray(tags) ? tags : []).filter((tag) => !Object.hasOwn(TIME_PERIODS, tag));
  return period ? [...new Set([...remaining, period])] : remaining;
}
function removeSystemTimeTags(tags) {
  return (Array.isArray(tags) ? tags : []).filter((tag) => !/^hour-(?:[01]\d|2[0-3])$/.test(tag) && !/^start-(?:[01]\d|2[0-3])-(?:00|30)$/.test(tag) && !/^duration-\d+m$/.test(tag));
}
function replaceTimeTags(tags, startLocal, endLocal) {
  const hourTags = [hourTagForLocal(startLocal)].filter(Boolean);
  const startTag = startTagForLocal(startLocal);
  const durationTag = durationTagForRange(startLocal, endLocal);
  const periodTags = periodTagsForRange(startLocal, endLocal);
  if (!hourTags.length || !startTag || !durationTag) return Array.isArray(tags) ? tags : [];
  const remaining = (Array.isArray(tags) ? tags : []).filter((tag) => !/^hour-(?:[01]\d|2[0-3])$/.test(tag) && !/^start-(?:[01]\d|2[0-3])-(?:00|30)$/.test(tag) && !/^duration-\d+m$/.test(tag));
  const scopeTag = remaining.find((tag) => tag === 'single-day' || tag === 'multi-day');
  const withoutPeriods = remaining.filter((tag) => !Object.hasOwn(TIME_PERIODS, tag) && tag !== 'single-day' && tag !== 'multi-day');
  // System time metadata takes priority over excess optional tags, while
  // retaining the existing twenty-tag safety limit.
  const systemTags = [...(scopeTag ? [scopeTag] : []), ...periodTags, ...new Set(hourTags), startTag, durationTag];
  return [...withoutPeriods.slice(0, Math.max(0, 20 - systemTags.length)), ...systemTags];
}
function replaceDayScopeTag(tags, startLocal, endLocal, allDay) {
  const remaining = (Array.isArray(tags) ? tags : []).filter((tag) => tag !== 'single-day' && tag !== 'multi-day');
  // Google Calendar all-day events use an exclusive end at the next midnight,
  // but one all-day event still represents one calendar day for this feature.
  const isSingleDay = allDay || startLocal?.slice(0, 10) === endLocal?.slice(0, 10);
  return [...remaining, isSingleDay ? 'single-day' : 'multi-day'];
}
function addMinutes(local, minutes) {
  localDateTime(local);
  return new Date(new Date(`${local}:00Z`).getTime() + minutes * 60000).toISOString().slice(0, 16);
}
function normalizeClock(value) {
  if (typeof value !== 'string') return value;
  const match = /^(\d{1,2})[.:]([0-5]\d)$/.exec(value.trim());
  if (!match || Number(match[1]) > 23) return value;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}
function normalizeLocalDateTime(value, allowEndOfDay = false) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim()
    .replace(' ', 'T')
    .replace(/T(\d{1,2})\.([0-5]\d)(?::\d{2})?$/, (_, hour, minute) => `T${hour.padStart(2, '0')}:${minute}`)
    .replace(/T(\d{1,2}):([0-5]\d):\d{2}$/, (_, hour, minute) => `T${hour.padStart(2, '0')}:${minute}`);
  // Models sometimes express midnight after 23:00 as 24:00 on the same date.
  // Calendar local datetimes use the unambiguous next-day 00:00 instead.
  const midnight = /^(\d{4}-\d{2}-\d{2})T24:00$/.exec(normalized);
  if (!midnight || !allowEndOfDay) return normalized;
  const nextDay = new Date(`${midnight[1]}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return `${nextDay.toISOString().slice(0, 10)}T00:00`;
}
function explicitClockFromText(text) {
  const match = /\b([01]?\d|2[0-3])[.:]([0-5]\d)\b/i.exec(text);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : undefined;
}
// Only fill missing values. Explicit dates/times from extraction win.
function applyAssumptions(raw, context) {
  const draft = { ...raw, assumptions: [...(raw.assumptions || [])] };
  draft.startTime = normalizeClock(draft.startTime);
  draft.startLocal = normalizeLocalDateTime(draft.startLocal);
  draft.endLocal = normalizeLocalDateTime(draft.endLocal, true);
  const historyText = context.history.filter(item => item.role === 'user').map(item => item.text).join(' ');
  const latestText = context.text;
  // A new activity intent replaces an unsaved proposal. Do not let “เข้านอน”
  // from an earlier turn bleed into a new “ทานข้าวเช้า” request.
  const latestSituation = inferSituation(latestText);
  const latestPeriod = inferPeriodFromText(latestText);
  const text = latestSituation || latestPeriod ? latestText : `${historyText} ${latestText}`.trim();
  const situation = latestSituation || inferSituation(`${draft.title || ''} ${text}`);
  const statedPeriod = latestPeriod || inferPeriodFromText(text);
  if (latestSituation || latestPeriod) draft.assumptions = [];
  const explicitClock = explicitClockFromText(text);
  const hasExplicitClockTime = Boolean(explicitClock) || /\d{1,2}\s*โมง|\b\d{1,2}\s*(?:am|pm)\b/i.test(text);
  if (!draft.startLocal && !draft.startTime && explicitClock) draft.startTime = explicitClock;
  // A recognisable phrase from the person wins over any incorrect period tag
  // proposed by the model.
  if (!draft.allDay && (situation || statedPeriod)) {
    draft.tags = replacePeriodTag(draft.tags, statedPeriod || situation.tag);
    // These are generated tags, so a named period from the person must be
    // able to replace a stale AI-generated time frame.
    if (!hasExplicitClockTime) draft.tags = removeSystemTimeTags(draft.tags);
  }
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
  if (!draft.allDay && (situation || statedPeriod) && !hasExplicitClockTime) {
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
  draft.tags = replaceDayScopeTag(draft.tags, draft.startLocal, draft.endLocal, draft.allDay);
  if (!draft.allDay) {
    draft.tags = replaceTimeTags(draft.tags, draft.startLocal, draft.endLocal);
    const hourTag = draft.tags.find((tag) => /^hour-(?:[01]\d|2[0-3])$/.test(tag));
    const startTag = draft.tags.find((tag) => /^start-(?:[01]\d|2[0-3])-(?:00|30)$/.test(tag));
    const durationTag = draft.tags.find((tag) => /^duration-\d+m$/.test(tag));
    if (hourTag && startTag && durationTag) draft.assumptions.push(`กรอบเริ่ม ${describeHourTag(hourTag)} · ${startTag} · ${durationTag}`);
  }
  return draft;
}
module.exports = { applyAssumptions, addMinutes, inferSituation, inferPeriodFromText, normalizeClock, normalizeLocalDateTime, explicitClockFromText };
