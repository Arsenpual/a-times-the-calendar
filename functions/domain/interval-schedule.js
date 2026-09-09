// Wall-clock intervals anchored to the configured window, including an end
// boundary only when the frequency lands on it. Overnight windows retain
// their phase across midnight. An all-day schedule resets at midnight.
export function intervalScheduleMinutes(reminder) {
  const step = Number(reminder.amount) * (reminder.unit === 'hours' ? 60 : 1);
  if (!Number.isFinite(step) || step < 1) return [];
  const parse = value => {
    if (!/^\d{2}:\d{2}$/.test(value || '')) return null;
    const [h, m] = value.split(':').map(Number);
    return h < 24 && m < 60 ? h * 60 + m : null;
  };
  const start = parse(reminder.windowStart);
  const end = parse(reminder.windowEnd);
  const allDay = start === null || end === null || start === end;
  const anchor = allDay ? 0 : start;
  const duration = allDay ? 1440 : (end - start + 1440) % 1440;
  const slots = [];
  for (let offset = 0; allDay ? offset < duration : offset <= duration; offset += step) {
    slots.push((anchor + offset) % 1440);
  }
  return [...new Set(slots)].sort((a, b) => a - b);
}

/** Compact card data. `notificationCount` is the actual number of scheduled
 * slots, including a configured end boundary when the interval lands on it. */
export function getIntervalWorkSummary(reminder) {
  const parse = value => {
    if (!/^\d{2}:\d{2}$/.test(value || '')) return null;
    const [hours, minutes] = value.split(':').map(Number);
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
  };
  const start = parse(reminder.windowStart);
  const end = parse(reminder.windowEnd);
  const allDay = start === null || end === null || start === end;
  const workMinutes = allDay ? 1440 : (end - start + 1440) % 1440;
  return {
    workMinutes,
    notificationCount: intervalScheduleMinutes(reminder).length,
    range: allDay ? null : `${reminder.windowStart}–${reminder.windowEnd}`
  };
}

export function nextIntervalDue(reminder, from) {
  const slots = intervalScheduleMinutes(reminder);
  for (let day = 0; day < 2; day++) {
    for (const minute of slots) {
      const target = new Date(from);
      target.setDate(target.getDate() + day);
      target.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      if (+target > from) return +target;
    }
  }
  return Infinity;
}
