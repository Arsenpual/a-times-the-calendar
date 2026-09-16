import { activityDate } from "../../../../shared/lib/date-utils.js";
import { normalizeActivityId } from "../../../../shared/lib/id-utils.js";
import { exceedsOverlapLimit } from "../../lib/timeline-layout.js";

function localDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Send only the short planning window around the current request, never the
// person's entire Calendar. The backend repeats validation before using it.
export function buildAssistantScheduleContext(activities, lockedActivities, referenceDate) {
  const start = new Date(`${referenceDate}T00:00:00`);
  start.setDate(start.getDate() - 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 9);
  return {
    windowStartLocal: localDateTime(start),
    windowEndLocal: localDateTime(end),
    activities: activities.filter((activity) => {
      // The save handler counts all-day Calendar activities as their full
      // midnight-to-midnight range for the three-overlap limit. Preserve
      // them here as well, otherwise the assistant can falsely describe a
      // timed slot as available and leave the final save to reject it.
      if (!activity.start || !activity.end) return false;
      const activityStart = activityDate(activity.start);
      const activityEnd = activityDate(activity.end);
      return activityStart && activityEnd && activityEnd > start && activityStart < end;
    }).slice(0, 80).map((activity) => ({
      id: activity.id,
      title: activity.summary || "(ไม่มีชื่อกิจกรรม)",
      startLocal: localDateTime(activityDate(activity.start)),
      endLocal: localDateTime(activityDate(activity.end)),
      locked: Boolean(lockedActivities[normalizeActivityId(activity.id)])
    }))
  };
}

export function collectUserTags(activityTagMap = {}) {
  return [...new Set(Object.values(activityTagMap).flat().filter((tag) => typeof tag === "string" && tag.trim()))].slice(0, 100);
}

function overlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function formatLocalDateTime(date) {
  return localDateTime(date);
}

/**
 * Last-mile guard before ActivityPopup opens. This deliberately calls the
 * exact shared overlap function used by the save handler, so a stale or
 * incomplete API schedule hint cannot let a fourth overlapping activity
 * reach the form and fail only after the person presses Save.
 */
export function assessAssistantDraftOverlap(draft, activities = [], lockedActivities = {}) {
  const start = new Date(draft?.startLocal || "");
  const end = new Date(draft?.endLocal || "");
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return { status: "not-applicable", conflicts: [], alternatives: [] };
  const existing = activities.map((activity) => ({
    activity,
    start: activityDate(activity.start),
    end: activityDate(activity.end)
  })).filter((entry) => entry.start instanceof Date && entry.end instanceof Date && entry.end > entry.start);
  const candidate = { id: "assistant-draft", start, end };
  if (!exceedsOverlapLimit([...existing.map(({ activity, start: entryStart, end: entryEnd }) => ({ id: activity.id, start: entryStart, end: entryEnd })), candidate])) {
    return { status: "available", conflicts: [], alternatives: [] };
  }
  const conflicts = existing.filter(({ start: entryStart, end: entryEnd }) => overlap(entryStart, entryEnd, start, end)).map(({ activity }) => ({
    id: activity.id,
    title: activity.summary || "(ไม่มีชื่อกิจกรรม)",
    startLocal: formatLocalDateTime(activityDate(activity.start)),
    endLocal: formatLocalDateTime(activityDate(activity.end)),
    locked: Boolean(lockedActivities[normalizeActivityId(activity.id)])
  }));
  const duration = end.getTime() - start.getTime();
  const alternatives = [];
  for (const minutes of [-180, -150, -120, -90, -60, -30, 30, 60, 90, 120, 150, 180]) {
    const proposedStart = new Date(start.getTime() + minutes * 60_000);
    const proposedEnd = new Date(proposedStart.getTime() + duration);
    if (!exceedsOverlapLimit([...existing.map(({ activity, start: entryStart, end: entryEnd }) => ({ id: activity.id, start: entryStart, end: entryEnd })), { id: "assistant-draft", start: proposedStart, end: proposedEnd }])) {
      alternatives.push({ startLocal: formatLocalDateTime(proposedStart), endLocal: formatLocalDateTime(proposedEnd) });
      if (alternatives.length === 3) break;
    }
  }
  return { status: "overlap-limit", conflicts, alternatives };
}
