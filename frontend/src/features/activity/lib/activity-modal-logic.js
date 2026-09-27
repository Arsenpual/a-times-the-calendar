import { combineDateAndTime, toDateInputValue } from "../../../shared/lib/date-utils.js";
import { buildRRule } from "./rrule-utils.js";

export function normalizeActivityRepeatState(state, maxRepeatCount) {
  if (state.end === "never") {
    return { ...state, end: "count", count: Math.min(state.count || 12, maxRepeatCount) };
  }
  if (state.end === "count" && state.count > maxRepeatCount) {
    return { ...state, count: maxRepeatCount };
  }
  return state;
}

export function activityDateTimeValue(dateValue, timeValue) {
  return dateValue && timeValue ? `${dateValue}T${timeValue}` : "";
}

export function activityDatePlusDays(dateValue, amount) {
  if (!dateValue) return "";
  const next = new Date(`${dateValue}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return toDateInputValue(next);
}

export function canonicalAllDayDate(dateValue) {
  const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) || toDateInputValue(parsed) !== dateValue ? "" : dateValue;
}

export function computeActivityStartEnd({ date, startTime, endDate, endTime }) {
  const start = combineDateAndTime(date, startTime);
  let end = combineDateAndTime(endDate, endTime);
  if (end <= start && endDate === date) {
    end = new Date(end.getTime() + 24 * 60 * 60000);
  }
  return { start, end };
}

export function buildActivityCalendarBody({
  title,
  notes,
  isAllDay,
  date,
  endDate,
  startTime,
  endTime,
  recurrenceEditable,
  repeat,
  isEditing,
  initialRecurrence,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
}) {
  const body = {
    summary: title.trim() || "(ไม่มีชื่อ)",
    description: notes.trim() || null
  };

  if (isAllDay) {
    const startDate = canonicalAllDayDate(date);
    const endDateExclusive = canonicalAllDayDate(endDate);
    body.start = { date: startDate };
    body.end = { date: endDateExclusive };
    if (recurrenceEditable) {
      const rrule = buildRRule(repeat, combineDateAndTime(startDate, "00:00"));
      if (rrule) body.recurrence = [rrule];
      else if (isEditing && initialRecurrence?.length) body.recurrence = [];
    }
    return body;
  }

  const { start, end } = computeActivityStartEnd({ date, startTime, endDate, endTime });
  body.start = { dateTime: start.toISOString(), timeZone };
  body.end = { dateTime: end.toISOString(), timeZone };

  if (recurrenceEditable) {
    const rrule = buildRRule(repeat, start);
    if (rrule) body.recurrence = [rrule];
    else if (isEditing && initialRecurrence?.length) body.recurrence = [];
  }

  return body;
}
