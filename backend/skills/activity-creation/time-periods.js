// Local-clock defaults, not astronomical sunrise/sunset calculations.
const TIME_PERIODS = Object.freeze({
  dawn: '05:00', morning: '09:00', noon: '12:00', afternoon: '13:00',
  dusk: '18:00', evening: '19:00', night: '21:00'
});
function selectedPeriod(tags) {
  return Array.isArray(tags) ? tags.find(tag => Object.hasOwn(TIME_PERIODS, tag)) : undefined;
}
module.exports = { TIME_PERIODS, selectedPeriod };
