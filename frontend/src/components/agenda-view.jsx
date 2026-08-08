import React, { useState, useEffect } from "react";
import { getWeekRange, isSameDay, activityDate } from "../date-utils.js";
import { getDisplayColor } from "../activity-colors.js";
import TimelineEditor from "./timeline-editor.jsx";

const WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** Minutes covered by an activity, treating all-day/zero-length as 30min (mirrors the backend). */
function durationMinutes(activity) {
  const start = activityDate(activity.start);
  const end = activityDate(activity.end);
  if (!start || !end) return 30;
  return Math.max(0, (end - start) / 60000) || 30;
}

/**
 * Builds the per-day category proportion segments for the day bar: each
 * segment's width is that category's share of the day's total scheduled
 * minutes, colored the same way as activity chips (life-area color, or the
 * uncategorized gray).
 */
function buildDayBreakdown(dayActivities, activityCategoryMap, categories) {
  const minutesByColor = new Map(); // color -> minutes
  let total = 0;
  for (const activity of dayActivities) {
    const minutes = durationMinutes(activity);
    const color = getDisplayColor(activity, activityCategoryMap, categories);
    const key = color.border;
    minutesByColor.set(key, (minutesByColor.get(key) || 0) + minutes);
    total += minutes;
  }
  if (total === 0) return [];
  return Array.from(minutesByColor.entries()).map(([border, minutes]) => ({
    border,
    percent: (minutes / total) * 100
  }));
}

/**
 * @param {(activityId: string, categoryId: string|null) => void} onAssignCategory used by each row's inline TimelineEditor
 * @param {(activity: object) => void} onEditActivity opens ActivityModal from inside a row's TimelineEditor
 * @param {(changes: Array<{id: string, start: Date, end: Date}>) => Promise<void>} onSaveTimes batched drag-editor save
 * @param {Record<string, boolean>} lockedActivities activityId -> true for locked activities
 * @param {(activityId: string, locked: boolean) => void} onToggleLock
 * @param {(activityId: string) => Promise<void>} onDeleteActivity quick-delete from the activity popup
 * @param {(recurringEventId: string) => Promise<void>} onDeleteSeries deletes an entire recurring series in one call
 * @param {(activity: object) => Promise<void>} onDuplicateActivity
 * @param {(activityId: string, dateStr: string) => Promise<void>} onMoveActivityToDay
 * @param {(activityId: string, colorId: string|null) => Promise<void>} onSetActivityColor
 * @param {(activity: object) => Promise<void>} onEditSeries
 * @param {(recurringEventId: string) => Promise<number|null>} onFetchSeriesCount
 */
export default function AgendaView({
  anchorDate,
  activities,
  categories,
  activityCategoryMap,
  activityTagMap,
  expandedDate,
  onAddActivity,
  onSelectDay,
  onAssignCategory,
  onEditActivity,
  onSaveTimes,
  lockedActivities,
  onToggleLock,
  onDeleteActivity,
  onDeleteSeries,
  onDuplicateActivity,
  onMoveActivityToDay,
  onSetActivityColor,
  onEditSeries,
  onFetchSeriesCount
}) {
  const [weekStart] = getWeekRange(anchorDate);
  const today = new Date();

  // Which row's inline timeline-editor is open, if any — separate from
  // `expandedDate` (which controls the read-only mini timeline on the
  // left), so a row can be expanded for editing independent of that.
  const [editingDay, setEditingDay] = useState(null);

  // Close any open inline timeline-editor whenever the visible week
  // changes. Without this, switching weeks while a row's editor is open
  // (possibly with unsaved draft drag times) leaves it open on return —
  // its drafts are Date objects anchored to the old week's `day`, so a
  // later "save" could silently write the wrong time onto whatever
  // activity now occupies that id. Mirrors the same reset app.jsx already
  // does for `expandedDate`.
  useEffect(() => {
    setEditingDay(null);
  }, [anchorDate]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const activitiesByDay = (day) =>
    activities.filter((activity) => {
      const start = activityDate(activity.start);
      return start && isSameDay(start, day);
    });

  const toggleEditing = (day) => {
    setEditingDay((prev) => (prev && isSameDay(prev, day) ? null : day));
  };

  return (
    <div className="agenda-view">
      {days.map((day) => {
        const isToday = isSameDay(day, today);
        const isExpanded = expandedDate && isSameDay(day, expandedDate);
        const isEditing = editingDay && isSameDay(editingDay, day);
        const dayActivities = activitiesByDay(day);
        const breakdown = buildDayBreakdown(dayActivities, activityCategoryMap, categories);

        return (
          <div
            key={day.toISOString()}
            className={`agenda-row${isToday ? " is-today" : ""}${isEditing ? " is-row-editing" : ""}`}
          >
            <div className="agenda-day-label">
              <span className="agenda-weekday">{WEEKDAY_SHORT[day.getDay()]}</span>
              <span className={`agenda-date${isToday ? " is-today" : ""}`}>{day.getDate()}</span>
            </div>
            <div className="agenda-day-content">
              <div className="agenda-day-bar-row">
                <button
                  type="button"
                  className={`agenda-day-bar-btn${isExpanded ? " is-expanded" : ""}`}
                  onClick={() => onSelectDay?.(day)}
                  aria-label={`ดู mini timeline วันที่ ${day.getDate()} — มี ${dayActivities.length} กิจกรรม`}
                  aria-pressed={!!isExpanded}
                >
                  {breakdown.length > 0 ? (
                    <span className="agenda-day-bar">
                      {breakdown.map((seg, i) => (
                        <span
                          key={i}
                          className="agenda-day-bar-segment"
                          style={{ width: `${seg.percent}%`, background: seg.border }}
                        />
                      ))}
                    </span>
                  ) : (
                    <span className="agenda-day-bar agenda-day-bar-empty" />
                  )}
                  <span className="agenda-day-bar-count">
                    {dayActivities.length > 0 ? `${dayActivities.length} กิจกรรม` : "ไม่มีกิจกรรม"}
                  </span>
                </button>
                <button
                  type="button"
                  className={`agenda-edit-toggle${isEditing ? " is-active" : ""}`}
                  onClick={() => toggleEditing(day)}
                  aria-label={isEditing ? "ปิดโหมดแก้ไขเวลากิจกรรม" : "เปิดโหมดแก้ไขเวลากิจกรรม"}
                  aria-pressed={isEditing}
                  title="แก้ไขเวลากิจกรรม"
                >
                  ⚙
                </button>
              </div>

              {isEditing ? (
                <TimelineEditor
                  day={day}
                  activities={dayActivities}
                  allActivities={activities}
                  categories={categories}
                  activityCategoryMap={activityCategoryMap}
                  activityTagMap={activityTagMap}
                  lockedActivities={lockedActivities}
                  onCancel={() => setEditingDay(null)}
                  onSaveTimes={onSaveTimes}
                  onAssignCategory={onAssignCategory}
                  onEditActivity={onEditActivity}
                  onToggleLock={onToggleLock}
                  onDeleteActivity={onDeleteActivity}
                  onDeleteSeries={onDeleteSeries}
                  onDuplicateActivity={onDuplicateActivity}
                  onMoveActivityToDay={onMoveActivityToDay}
                  onSetActivityColor={onSetActivityColor}
                  onEditSeries={onEditSeries}
                  onFetchSeriesCount={onFetchSeriesCount}
                />
              ) : (
                <button type="button" className="agenda-add-btn" onClick={() => onAddActivity?.(day)}>
                  + เพิ่มกิจกรรม
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
