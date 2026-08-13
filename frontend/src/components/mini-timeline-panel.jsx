import React from "react";
import { activityDate, formatTime, isSameDay } from "../date-utils.js";
import { getDisplayColor } from "../activity-colors.js";
import { getIncomingSpillover } from "../timeline-layout.js";
import AutoShrinkText from "./auto-shrink-text.jsx";

const WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const WEEKDAY_FULL = {
  "อา": "อาทิตย์", "จ": "จันทร์", "อ": "อังคาร", "พ": "พุธ",
  "พฤ": "พฤหัสบดี", "ศ": "ศุกร์", "ส": "เสาร์"
};

/**
 * Mini timeline: a small read-only panel of a single day's activities. This
 * is the "back face" of the flip card shared with WeeklySummaryPanel (see
 * app.jsx) — it only ever displays whichever day ActivityMode selected;
 * picking a different day always happens from the agenda list on the
 * right, never from here.
 *
 * Editing a day's activity times/categories happens inline in ActivityMode's
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
  onClose,
  onEditActivity
}) {
  if (!expandedDate) return null;

  const timedActivities = activities
    .filter((activity) => {
      const start = activityDate(activity.start);
      return start && isSameDay(start, expandedDate);
    })
    .sort((a, b) => activityDate(a.start) - activityDate(b.start));

  // Activity that started the day before expandedDate and bleeds into it —
  // shown as a single dimmed entry at the top of the list, separate from
  // timedActivities (which stays keyed strictly off each activity's own
  // start date, so this never inflates the day's own activity count).
  const incomingSpillover = activities
    .filter((activity) => activity.start?.dateTime)
    .map((activity) => {
      const start = activityDate(activity.start);
      const end = activityDate(activity.end) || start;
      const spill = getIncomingSpillover(start, end, expandedDate);
      if (!spill) return null;
      const spilloverEnd = new Date(expandedDate);
      spilloverEnd.setHours(0, 0, 0, 0);
      spilloverEnd.setMinutes(spill.spilloverEndMin);
      return { activity, spilloverEnd };
    })
    .filter(Boolean);

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
        {incomingSpillover.length > 0 && (
          <ol className="mini-timeline mini-timeline-spillover-list">
            {incomingSpillover.map(({ activity, spilloverEnd }) => {
              const color = getDisplayColor(activity, activityCategoryMap, categories);
              return (
                <li key={`spillover-${activity.id}`} className="mini-timeline-item">
                  <div className="mini-timeline-time">⤴</div>
                  <div className="mini-timeline-track">
                    <span className="mini-timeline-dot" style={{ background: color.border }} />
                    <span className="mini-timeline-line" />
                  </div>
                  <button
                    type="button"
                    className="mini-timeline-event mini-timeline-event-spillover"
                    style={{ background: color.bg, borderLeftColor: color.border }}
                    title={`ต่อเนื่องจากเมื่อคืน — ${activity.summary || "(ไม่มีชื่อ)"}`}
                    onClick={() => onEditActivity?.(activity)}
                  >
                    <AutoShrinkText
                      text={activity.summary || "(ไม่มีชื่อ)"}
                      className="mini-timeline-event-title"
                    />
                    <span className="mini-timeline-event-range">
                      ต่อจากเมื่อคืน – {formatTime(spilloverEnd)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {timedActivities.length === 0 ? (
          incomingSpillover.length === 0 && <p className="day-timeline-empty">ไม่มีกิจกรรมตามเวลาในวันนี้</p>
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
                    <AutoShrinkText
                      text={activity.summary || "(ไม่มีชื่อ)"}
                      className="mini-timeline-event-title"
                    />
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
