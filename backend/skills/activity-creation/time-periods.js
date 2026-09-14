// Local-clock windows, not astronomical sunrise/sunset calculations.
// Tags describe a part of the day; they must never overwrite a clock time the
// person explicitly supplied.
const TIME_PERIODS = Object.freeze({
  'late-night': Object.freeze({ start: '00:00', end: '04:59', defaultStart: '01:00' }),
  dawn: Object.freeze({ start: '05:00', end: '06:59', defaultStart: '05:30' }),
  morning: Object.freeze({ start: '07:00', end: '10:59', defaultStart: '09:00' }),
  noon: Object.freeze({ start: '11:00', end: '12:59', defaultStart: '12:00' }),
  afternoon: Object.freeze({ start: '13:00', end: '16:59', defaultStart: '14:00' }),
  dusk: Object.freeze({ start: '17:00', end: '18:59', defaultStart: '18:00' }),
  evening: Object.freeze({ start: '19:00', end: '21:59', defaultStart: '19:00' }),
  night: Object.freeze({ start: '22:00', end: '23:59', defaultStart: '22:00' })
});
const HOUR_TAG_PREFIX = 'hour-';
function selectedPeriod(tags) {
  return Array.isArray(tags) ? tags.find(tag => Object.hasOwn(TIME_PERIODS, tag)) : undefined;
}
function defaultTimeForPeriod(period) {
  return TIME_PERIODS[period]?.defaultStart;
}
function describePeriod(period) {
  const window = TIME_PERIODS[period];
  return window ? `${window.start}–${window.end}` : '';
}
function selectedHourTag(tags) {
  return Array.isArray(tags) ? tags.find(tag => /^hour-(?:[01]\d|2[0-3])$/.test(tag)) : undefined;
}
function timeForHourTag(tag) {
  return selectedHourTag([tag]) ? `${tag.slice(HOUR_TAG_PREFIX.length)}:00` : undefined;
}
function hourTagForLocal(local) {
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}):\d{2}$/.exec(local || '');
  return match ? `${HOUR_TAG_PREFIX}${match[1]}` : undefined;
}
function startTagForLocal(local) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(local || '');
  if (!match) return undefined;
  const minute = Number(match[3]) < 30 ? '00' : '30';
  return `start-${match[2]}-${minute}`;
}
function durationTagForRange(startLocal, endLocal) {
  const start = new Date(`${startLocal}:00Z`).getTime();
  const end = new Date(`${endLocal}:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
  const roundedMinutes = Math.max(30, Math.ceil((end - start) / 60000 / 30) * 30);
  return `duration-${roundedMinutes}m`;
}
function describeHourTag(tag) {
  const time = timeForHourTag(tag);
  if (!time) return '';
  const nextHour = String((Number(time.slice(0, 2)) + 1) % 24).padStart(2, '0');
  return `${time}–${nextHour}:00`;
}
function minuteOfDay(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}
function periodTagsForRange(startLocal, endLocal) {
  const start = new Date(`${startLocal}:00Z`);
  const end = new Date(`${endLocal}:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const tags = new Set();
  // Endpoints are included deliberately: an activity ending exactly at 13:00
  // receives afternoon too, which makes boundary-spanning activities visible.
  for (let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dayStart = cursor.getTime();
    for (const [tag, window] of Object.entries(TIME_PERIODS)) {
      const windowStart = dayStart + minuteOfDay(window.start) * 60000;
      const windowEnd = dayStart + minuteOfDay(window.end) * 60000 + 59999;
      if (start.getTime() <= windowEnd && end.getTime() >= windowStart) tags.add(tag);
    }
  }
  return [...tags];
}
module.exports = { TIME_PERIODS, HOUR_TAG_PREFIX, selectedPeriod, defaultTimeForPeriod, describePeriod, selectedHourTag, timeForHourTag, hourTagForLocal, startTagForLocal, durationTagForRange, describeHourTag, periodTagsForRange };
