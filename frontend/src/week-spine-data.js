// Data adapter for the future Activity Mode Week Spine.
//
// This module deliberately contains no React/UI code and never mutates a
// Google Calendar activity.  It is the one boundary that translates the
// existing calendar model into renderable day segments, so drag/drop and
// multi-day support do not have to reinterpret event data independently.

import { activityDate, isSameDay } from "./date-utils.js";
import { getDisplayColor } from "./activity-colors.js";
import { normalizeActivityId } from "./id-utils.js";

function dayStart(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function nextDay(date) {
  const result = dayStart(date);
  result.setDate(result.getDate() + 1);
  return result;
}

/**
 * Returns the domain record Week Spine needs before it is split into days.
 * `id` is always normalized for local maps; `calendarId` remains the exact
 * Google Calendar instance id needed when an update is sent back.
 */
export function toWeekSpineActivity(activity, { activityCategoryMap = {}, categories = [], lockedActivities = {} } = {}) {
  const start = activityDate(activity?.start);
  const end = activityDate(activity?.end);
  const id = normalizeActivityId(activity?.id);
  const isAllDay = Boolean(activity?.start?.date && !activity?.start?.dateTime);

  if (!activity?.id || !start || !end || end <= start) return null;

  const color = getDisplayColor(activity, activityCategoryMap, categories);
  return {
    id,
    calendarId: activity.id,
    title: activity.summary || "(ไม่มีชื่อกิจกรรม)",
    start,
    end,
    isAllDay,
    isLocked: Boolean(lockedActivities[id]),
    color,
    source: activity,
  };
}

/**
 * Splits one timed activity into the portions visible in each local calendar
 * day inside `rangeStart`–`rangeEnd` (inclusive by date).  The original
 * activity remains one record; segmentId is only a stable render key.
 */
export function splitWeekSpineActivityIntoDaySegments(weekSpineActivity, rangeStart, rangeEnd) {
  if (!weekSpineActivity || weekSpineActivity.isAllDay) return [];

  const firstDay = dayStart(rangeStart);
  const lastDayExclusive = nextDay(rangeEnd);
  const visibleStart = new Date(Math.max(weekSpineActivity.start.getTime(), firstDay.getTime()));
  const visibleEnd = new Date(Math.min(weekSpineActivity.end.getTime(), lastDayExclusive.getTime()));
  if (visibleEnd <= visibleStart) return [];

  const segments = [];
  for (let day = dayStart(visibleStart); day < visibleEnd; day = nextDay(day)) {
    const endOfDay = nextDay(day);
    const segmentStart = new Date(Math.max(weekSpineActivity.start.getTime(), day.getTime()));
    const segmentEnd = new Date(Math.min(weekSpineActivity.end.getTime(), endOfDay.getTime()));
    if (segmentEnd <= segmentStart) continue;

    segments.push({
      ...weekSpineActivity,
      segmentId: `${weekSpineActivity.calendarId}:${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`,
      day,
      start: segmentStart,
      end: segmentEnd,
      startsInSegment: isSameDay(weekSpineActivity.start, day),
      endsInSegment: segmentEnd.getTime() === weekSpineActivity.end.getTime(),
      continuesFromPreviousDay: weekSpineActivity.start < day,
      continuesIntoNextDay: weekSpineActivity.end > endOfDay,
    });
  }
  return segments;
}

/**
 * Adapts a collection for a visible week. All-day activities are retained as
 * separate records so a later UI can give them their own row rather than
 * forcing them into the timed grid.
 */
export function buildWeekSpineData({ activities = [], weekStart, weekEnd, activityCategoryMap, categories, lockedActivities }) {
  const timedSegments = [];
  const allDayActivities = [];

  for (const activity of activities) {
    const adapted = toWeekSpineActivity(activity, { activityCategoryMap, categories, lockedActivities });
    if (!adapted) continue;
    if (adapted.isAllDay) {
      if (adapted.start < nextDay(weekEnd) && adapted.end > dayStart(weekStart)) allDayActivities.push(adapted);
      continue;
    }
    timedSegments.push(...splitWeekSpineActivityIntoDaySegments(adapted, weekStart, weekEnd));
  }

  return { timedSegments, allDayActivities };
}
