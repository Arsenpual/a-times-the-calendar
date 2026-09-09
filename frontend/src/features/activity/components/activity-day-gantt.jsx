import React, { useEffect, useMemo, useState } from "react";
import { activityDate, formatTime, isSameDay } from "../../../shared/lib/date-utils.js";
import { getDisplayColor } from "../lib/activity-colors.js";
import { MAX_OVERLAP_STACKS } from "../lib/timeline-layout.js";

const DAY_MINUTES = 24 * 60;
const TRACK_HEIGHT = 38;
const TRACK_GAP = 6;
const MIN_BAR_WIDTH = 34;

function minutesSinceMidnight(value) {
  return value.getHours() * 60 + value.getMinutes();
}

/**
 * Assigns a stable, reusable row to each activity. This intentionally reads
 * like a compact Gantt chart rather than a second vertical calendar: a row is
 * reused as soon as its earlier activity ends. More than three concurrent
 * activities become small overflow markers instead of making the panel tall.
 */
function assignTracks(entries) {
  const trackEnds = Array(MAX_OVERLAP_STACKS).fill(-Infinity);
  const placed = [];
  const overflow = [];

  [...entries]
    .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes)
    .forEach((entry) => {
      const track = trackEnds.findIndex((end) => end <= entry.startMinutes);
      if (track === -1) {
        overflow.push(entry);
        return;
      }
      trackEnds[track] = entry.endMinutes;
      placed.push({ ...entry, track });
    });

  return { placed, overflow };
}

function dayLabel(day) {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(day);
}

/**
 * Read-only, horizontal daily Gantt placed below Week Spine. It replaces the
 * former left-column Mini Timeline and the duplicated week-spine detail list.
 * Clicking a bar still uses the normal Activity modal, so there is only one
 * editor and one source of truth for an activity.
 */
export default function ActivityDayGantt({ day, activities, categories, activityCategoryMap, onEditActivity }) {
  const [zoom, setZoom] = useState(1);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => setActiveId(null), [day?.getTime()]);

  const { placed, overflow } = useMemo(() => {
    if (!(day instanceof Date) || Number.isNaN(day.getTime())) return { placed: [], overflow: [] };
    const entries = activities
      .filter((activity) => {
        const start = activityDate(activity.start);
        return activity.start?.dateTime && start && isSameDay(start, day);
      })
      .map((activity) => {
        const start = activityDate(activity.start);
        const end = activityDate(activity.end) || start;
        const endsAfterDay = !isSameDay(end, day) && end > start;
        return {
          activity,
          startMinutes: Math.max(0, Math.min(DAY_MINUTES, minutesSinceMidnight(start))),
          endMinutes: endsAfterDay
            ? DAY_MINUTES
            : Math.max(0, Math.min(DAY_MINUTES, Math.max(minutesSinceMidnight(start) + 1, minutesSinceMidnight(end))))
        };
      });
    return assignTracks(entries);
  }, [activities, day]);

  const pixelsPerMinute = zoom;
  const width = DAY_MINUTES * pixelsPerMinute;
  const trackAreaHeight = MAX_OVERLAP_STACKS * (TRACK_HEIGHT + TRACK_GAP) + (overflow.length ? 18 : 0);
  const hours = Array.from({ length: 25 }, (_, index) => index);

  return (
    <section className="activity-day-gantt" aria-label={`แผนกิจกรรม ${dayLabel(day)}`}>
      <header className="activity-day-gantt-header">
        <div>
          <h3>{dayLabel(day)}</h3>
          <p>แผนกิจกรรมรายวัน</p>
        </div>
        <div className="activity-day-gantt-zoom" role="group" aria-label="ขนาดแผนกิจกรรม">
          {[0.65, 1, 1.5].map((value) => (
            <button key={value} type="button" className={zoom === value ? "is-active" : ""} onClick={() => setZoom(value)}>
              {value === 0.65 ? "ย่อ" : value === 1 ? "ปกติ" : "ขยาย"}
            </button>
          ))}
        </div>
      </header>

      <div className="activity-day-gantt-scroll">
        <div className="activity-day-gantt-canvas" style={{ width, "--activity-day-gantt-hour-width": `${60 * pixelsPerMinute}px` }}>
          <div className="activity-day-gantt-axis" aria-hidden="true">
            {hours.map((hour) => <span key={hour} style={{ left: hour * 60 * pixelsPerMinute }}>{String(hour).padStart(2, "0")}:00</span>)}
          </div>
          <div className="activity-day-gantt-tracks" style={{ height: trackAreaHeight }}>
            {Array.from({ length: MAX_OVERLAP_STACKS }, (_, track) => <span className="activity-day-gantt-track-line" key={track} style={{ top: (track + 1) * TRACK_HEIGHT + track * TRACK_GAP }} />)}
            {placed.map((entry) => {
              const color = getDisplayColor(entry.activity, activityCategoryMap, categories);
              const isActive = activeId === entry.activity.id;
              return <button
                key={entry.activity.id}
                type="button"
                className={`activity-day-gantt-bar${isActive ? " is-active" : ""}`}
                style={{
                  left: entry.startMinutes * pixelsPerMinute,
                  top: entry.track * (TRACK_HEIGHT + TRACK_GAP),
                  width: Math.max(MIN_BAR_WIDTH, (entry.endMinutes - entry.startMinutes) * pixelsPerMinute),
                  height: TRACK_HEIGHT,
                  backgroundColor: color.border
                }}
                title={`${entry.activity.summary || "(ไม่มีชื่อกิจกรรม)"} · ${formatTime(activityDate(entry.activity.start))}–${formatTime(activityDate(entry.activity.end))}`}
                onClick={() => {
                  setActiveId(entry.activity.id);
                  onEditActivity?.(entry.activity);
                }}
              >
                <span>{entry.activity.summary || "(ไม่มีชื่อกิจกรรม)"}</span>
                <small>{formatTime(activityDate(entry.activity.start))}–{formatTime(activityDate(entry.activity.end))}</small>
              </button>;
            })}
            {overflow.map((entry) => <span key={entry.activity.id} className="activity-day-gantt-overflow" style={{ left: entry.startMinutes * pixelsPerMinute }} title={`กิจกรรมซ้อนเกิน ${MAX_OVERLAP_STACKS}: ${entry.activity.summary || "(ไม่มีชื่อกิจกรรม)"}`}>+1</span>)}
          </div>
        </div>
      </div>
      {placed.length === 0 && <p className="activity-day-gantt-empty">ไม่มีกิจกรรมตามเวลาในวันนี้</p>}
      {overflow.length > 0 && <p className="activity-day-gantt-hint">+1 คือกิจกรรมที่ทับซ้อนเกิน {MAX_OVERLAP_STACKS} รายการในช่วงเวลาเดียวกัน</p>}
    </section>
  );
}
