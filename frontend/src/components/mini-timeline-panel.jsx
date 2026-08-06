import React from "react";
import { activityDate, formatTime, isSameDay } from "../date-utils.js";
import { getDisplayColor } from "../activity-colors.js";

const WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const WEEKDAY_FULL = {
  "อา": "อาทิตย์", "จ": "จันทร์", "อ": "อังคาร", "พ": "พุธ",
  "พฤ": "พฤหัสบดี", "ศ": "ศุกร์", "ส": "เสาร์"
};

/**
 * Mini timeline: a small read-only panel of a single day's activities. This
 * is the "back face" of the flip card shared with WeeklySummaryPanel (see
 * app.jsx) — it only ever displays whichever day AgendaView selected;
 * picking a different day always happens from the agenda list on the
 * right, never from here.
 *
 * Editing a day's activity times/categories happens inline in AgendaView's
 * own expanded row (its ⚙ button), not here — this panel is view-only.
 *
 * @param {Date|null} expandedDate the day currently shown, or null to hide the panel
 * @param {() => void} onClose flip back to the weekly summary side
 */
export default function MiniTimelinePanel({
  activities,
  categories,
  activityCategoryMap,
  expandedDate,
  onClose
}) {
  if (!expandedDate) return null;

  const timedActivities = activities
    .filter((activity) => {
      const start = activityDate(activity.start);
      return start && isSameDay(start, expandedDate);
    })
    .sort((a, b) => activityDate(a.start) - activityDate(b.start));

  return (
    <aside className="timeline-card">
      <div className="day-timeline-header">
        <p className="day-timeline-title">
          {WEEKDAY_FULL[WEEKDAY_SHORT[expandedDate.getDay()]]} ที่ {expandedDate.getDate()}
        </p>
        <button
          type="button"
          className="day-timeline-nav day-timeline-close"
          onClick={() => onClose?.()}
          aria-label="กลับไปหน้าสรุปสัปดาห์"
        >
          ✕
        </button>
      </div>

      <div className="day-timeline-scroll">
        {timedActivities.length === 0 ? (
          <p className="day-timeline-empty">ไม่มีกิจกรรมตามเวลาในวันนี้</p>
        ) : (
          <ol className="mini-timeline">
            {timedActivities.map((activity) => {
              const start = activityDate(activity.start);
              const end = activityDate(activity.end) || start;
              const color = getDisplayColor(activity, activityCategoryMap, categories);
              return (
                <li key={activity.id} className="mini-timeline-item">
                  <div className="mini-timeline-time">{formatTime(start)}</div>
                  <div className="mini-timeline-track">
                    <span className="mini-timeline-dot" style={{ background: color.border }} />
                    <span className="mini-timeline-line" />
                  </div>
                  <div
                    className="mini-timeline-event"
                    style={{ background: color.bg, borderLeftColor: color.border }}
                    title={activity.summary || "(ไม่มีชื่อ)"}
                  >
                    <span className="mini-timeline-event-title">
                      {activity.summary || "(ไม่มีชื่อ)"}
                    </span>
                    <span className="mini-timeline-event-range">
                      {formatTime(start)} – {formatTime(end)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}
