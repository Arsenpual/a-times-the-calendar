import { activityDate } from "../../../shared/lib/date-utils.js";

export function overlapEntriesFromActivities(items) {
  return items.map((activity) => ({
    id: activity.id,
    start: activityDate(activity.start),
    end: activityDate(activity.end)
  }));
}

export function activitySaveCandidateEntries({ activities, existingId, activityBody }) {
  const entries = overlapEntriesFromActivities(
    activities.filter((activity) => activity.id !== existingId)
  );
  entries.push({
    id: existingId || "new-activity",
    start: activityDate(activityBody.start),
    end: activityDate(activityBody.end)
  });
  return entries;
}

export function nextActivityCopySummary(activities, originalSummary) {
  const base = (originalSummary || "(ไม่มีชื่อ)").replace(/\s*\(copy(?:\s+\d+)?\)\s*$/, "");
  const copyPattern = new RegExp(
    `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(copy(?:\\s+(\\d+))?\\)$`
  );
  let highestExisting = 0;
  for (const existing of activities) {
    const match = (existing.summary || "").match(copyPattern);
    if (!match) continue;
    const copyNumber = match[1] ? parseInt(match[1], 10) : 1;
    if (copyNumber > highestExisting) highestExisting = copyNumber;
  }
  const nextNumber = highestExisting + 1;
  return nextNumber === 1 ? `${base} (copy)` : `${base} (copy ${nextNumber})`;
}

export function buildActivityDuplicateBody({ activity, summary, timeOverride = null }) {
  const isAllDay = Boolean(activity?.start?.date && !activity?.start?.dateTime);
  const safeTimeOverride = isAllDay && timeOverride?.start?.dateTime ? null : timeOverride;
  return {
    summary,
    start: safeTimeOverride?.start || activity.start,
    end: safeTimeOverride?.end || activity.end
  };
}

export function buildActivityMoveBody({ activity, dateStr, savedTimeChanges = [] }) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const isAllDay = Boolean(activity.start?.date && !activity.start?.dateTime);

  if (isAllDay) {
    const [startYear, startMonth, startDay] = activity.start.date.split("-").map(Number);
    const [endYear, endMonth, endDay] = (activity.end?.date || activity.start.date).split("-").map(Number);
    const oldStartDay = Date.UTC(startYear, startMonth - 1, startDay);
    const oldEndDay = Date.UTC(endYear, endMonth - 1, endDay);
    const durationDays = Math.max(1, Math.round((oldEndDay - oldStartDay) / 86400000));
    const newEnd = new Date(year, month - 1, day);
    newEnd.setDate(newEnd.getDate() + durationDays);
    const newEndDate = `${newEnd.getFullYear()}-${String(newEnd.getMonth() + 1).padStart(2, "0")}-${String(newEnd.getDate()).padStart(2, "0")}`;
    return { start: { date: dateStr }, end: { date: newEndDate } };
  }

  const savedTimes = new Map(
    savedTimeChanges.map(({ id, start, end }) => [id, { start: new Date(start), end: new Date(end) }])
  );
  const savedCurrentTime = savedTimes.get(activity.id);
  const oldStart = savedCurrentTime?.start || activityDate(activity.start);
  const oldEnd = savedCurrentTime?.end || activityDate(activity.end);
  const durationMs = oldEnd - oldStart;
  const newStart = new Date(year, month - 1, day, oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds());
  const newEnd = new Date(newStart.getTime() + durationMs);
  return { start: { dateTime: newStart.toISOString() }, end: { dateTime: newEnd.toISOString() } };
}
