// Clock minutes keep every day on the same 00:00–24:00 visual scale.
export const minuteLabel = value => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export function buildDailyPlannerLayout(segments, day) {
  const nextDay = new Date(day);
  nextDay.setHours(0, 0, 0, 0);
  nextDay.setDate(nextDay.getDate() + 1);
  const items = segments.map(segment => ({
    ...segment,
    startMinute: segment.start.getHours() * 60 + segment.start.getMinutes(),
    endMinute: segment.end >= nextDay ? 1440 : segment.end.getHours() * 60 + segment.end.getMinutes(),
  })).filter(item => item.endMinute > item.startMinute).sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
  const lanes = [];
  for (const item of items) {
    let lane = lanes.find(row => row[row.length - 1].endMinute <= item.startMinute);
    if (!lane) { lane = []; lanes.push(lane); }
    lane.push(item);
  }
  const busy = [];
  for (const item of items) {
    const last = busy[busy.length - 1];
    if (last && item.startMinute <= last.end) last.end = Math.max(last.end, item.endMinute);
    else busy.push({ start: item.startMinute, end: item.endMinute });
  }
  const free = [];
  let cursor = 0;
  for (const interval of busy) {
    if (interval.start > cursor) free.push({ start: cursor, end: interval.start });
    cursor = interval.end;
  }
  if (cursor < 1440) free.push({ start: cursor, end: 1440 });
  return { items, lanes, free, busyMinutes: busy.reduce((sum, item) => sum + item.end - item.start, 0) };
}
