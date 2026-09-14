// Local-clock windows, not astronomical sunrise/sunset calculations.
// Tags describe a part of the day; they must never overwrite a clock time the
// person explicitly supplied.
const TIME_PERIODS = Object.freeze({
  dawn: Object.freeze({ start: '05:00', end: '07:00', defaultStart: '05:30' }),
  morning: Object.freeze({ start: '06:00', end: '12:00', defaultStart: '09:00' }),
  noon: Object.freeze({ start: '11:30', end: '13:30', defaultStart: '12:00' }),
  afternoon: Object.freeze({ start: '13:00', end: '17:30', defaultStart: '14:00' }),
  dusk: Object.freeze({ start: '17:30', end: '19:30', defaultStart: '18:00' }),
  evening: Object.freeze({ start: '18:00', end: '21:00', defaultStart: '19:00' }),
  night: Object.freeze({ start: '20:00', end: '23:30', defaultStart: '21:00' })
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
function describeHourTag(tag) {
  const time = timeForHourTag(tag);
  if (!time) return '';
  const nextHour = String((Number(time.slice(0, 2)) + 1) % 24).padStart(2, '0');
  return `${time}–${nextHour}:00`;
}
module.exports = { TIME_PERIODS, HOUR_TAG_PREFIX, selectedPeriod, defaultTimeForPeriod, describePeriod, selectedHourTag, timeForHourTag, hourTagForLocal, describeHourTag };
