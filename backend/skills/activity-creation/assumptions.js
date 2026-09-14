const { localDateTime } = require('./validator.js');
const { TIME_PERIODS, selectedPeriod } = require('./time-periods.js');
function addMinutes(local, minutes) {
  localDateTime(local);
  return new Date(new Date(`${local}:00Z`).getTime() + minutes * 60000).toISOString().slice(0, 16);
}
// Only fill missing values. Explicit dates/times from extraction win.
function applyAssumptions(raw, context) {
  const draft = { ...raw, assumptions: [...(raw.assumptions || [])] };
  const text = context.history.filter(item => item.role === 'user').map(item => item.text).concat(context.text).join(' ');
  let date = draft.startLocal?.slice(0, 10) || draft.date || context.referenceDate;
  if (!draft.date && !draft.startLocal) {
    if (/พรุ่งนี้|\btomorrow\b/i.test(text)) date = addMinutes(`${date}T00:00`, 1440).slice(0, 10);
    draft.assumptions.push(`ใช้วันที่ ${date}`);
  }
  const homework = /การบ้าน|homework/i.test(draft.title || '');
  const period = selectedPeriod(draft.tags);
  if (!draft.startLocal) {
    const time = draft.allDay ? '00:00' : draft.startTime || TIME_PERIODS[period] || (/ช่วงเช้า|\bmorning\b/i.test(text) ? '09:00' : /ช่วงบ่าย|\bafternoon\b/i.test(text) ? '13:00' : '19:00');
    draft.startLocal = `${date}T${time}`;
    if (!draft.startTime) draft.assumptions.push(`เวลาเริ่ม ${time}${period && !draft.allDay ? ` จาก tag ${period}` : ''}`);
  }
  if (!draft.endLocal) {
    const duration = draft.allDay ? 1440 : draft.durationMinutes || (homework ? 120 : 60);
    if (!Number.isInteger(duration) || duration < 1 || duration > 10080) throw new Error('ระยะเวลากิจกรรมไม่ถูกต้อง');
    draft.endLocal = addMinutes(draft.startLocal, duration);
    if (!draft.durationMinutes) draft.assumptions.push(`ระยะเวลา ${duration} นาที`);
  }
  return draft;
}
module.exports = { applyAssumptions, addMinutes };
