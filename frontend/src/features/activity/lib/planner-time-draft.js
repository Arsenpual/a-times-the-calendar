export const localDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function applyTimeDraft(activity, change) {
  if (!change) return activity;
  const allDay = activity.start?.date && !activity.start?.dateTime;
  return { ...activity,
    start: allDay ? { date: localDateKey(change.start) } : { ...activity.start, dateTime: change.start.toISOString() },
    end: allDay ? { date: localDateKey(change.end) } : { ...activity.end, dateTime: change.end.toISOString() }
  };
}
