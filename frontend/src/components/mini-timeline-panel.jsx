import React, { useEffect, useState } from "react";
import { activityDate, formatTime, isSameDay } from "../date-utils.js";
import { getDisplayColor } from "../activity-colors.js";
import { getIncomingSpillover } from "../timeline-layout.js";
import { downloadDayTimelineImage } from "../export-day-image.js";
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
  onEditActivity,
  userId
}) {
  const archiveStorageKey = `times-activity-archive:${userId || "guest"}`;
  const readArchivedIds = () => {
    try {
      const archive = JSON.parse(window.localStorage.getItem(archiveStorageKey) || "[]");
      return new Set(Array.isArray(archive) ? archive.map((item) => item.calendarId).filter(Boolean) : []);
    } catch {
      return new Set();
    }
  };
  const [archivedIds, setArchivedIds] = useState(readArchivedIds);
  const [focusedActivityId, setFocusedActivityId] = useState(null);

  useEffect(() => {
    setArchivedIds(readArchivedIds());
    const handleArchiveChange = (event) => {
      if (event.detail?.userId === userId) setArchivedIds(readArchivedIds());
    };
    window.addEventListener("times-activity-archive-changed", handleArchiveChange);
    return () => window.removeEventListener("times-activity-archive-changed", handleArchiveChange);
  }, [archiveStorageKey, userId]);

  useEffect(() => {
    setFocusedActivityId(null);
  }, [expandedDate?.getTime()]);

  if (!expandedDate) return null;

  const displayDate = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short"
  }).format(expandedDate);

  const visibleActivities = activities.filter((activity) => !archivedIds.has(activity.id));

  const timedActivities = visibleActivities
    .filter((activity) => {
      const start = activityDate(activity.start);
      return start && isSameDay(start, expandedDate);
    })
    .sort((a, b) => activityDate(a.start) - activityDate(b.start));

  // Activity that started the day before expandedDate and bleeds into it —
  // shown as a single dimmed entry at the top of the list, separate from
  // timedActivities (which stays keyed strictly off each activity's own
  // start date, so this never inflates the day's own activity count).
  const incomingSpillover = visibleActivities
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

  const toggleFocusedActivity = (activityId) => {
    setFocusedActivityId((current) => current === activityId ? null : activityId);
  };

  return (
    <aside className="timeline-card">
      <div className="day-timeline-header">
        <p className="day-timeline-title">
          {WEEKDAY_FULL[WEEKDAY_SHORT[expandedDate.getDay()]]} ที่ {displayDate}
        </p>
        <div className="day-timeline-header-actions">
          <button
            type="button"
            className="day-timeline-nav"
            onClick={() => downloadDayTimelineImage({
              day: expandedDate,
              activities: timedActivities,
              allActivities: visibleActivities,
              categories,
              activityCategoryMap
            })}
            aria-label="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ"
            title="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ (PNG)"
          >
            📷
          </button>
          <button
            type="button"
            className="day-timeline-nav day-timeline-close"
            onClick={() => onClose?.()}
            aria-label="กลับไปหน้าสรุปสัปดาห์"
          >
            ✕
          </button>
        </div>
      </div>

      <div className={`day-timeline-scroll${focusedActivityId ? " has-focused-activity" : ""}`}>
        {incomingSpillover.length > 0 && (
          <ol className="mini-timeline mini-timeline-spillover-list">
            {incomingSpillover.map(({ activity, spilloverEnd }) => {
              const color = getDisplayColor(activity, activityCategoryMap, categories);
              return (
                <li key={`spillover-${activity.id}`} className={`mini-timeline-item${focusedActivityId === activity.id ? " is-focused" : ""}`}>
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
                    onClick={() => toggleFocusedActivity(activity.id)}
                    onDoubleClick={() => onEditActivity?.(activity)}
                  >
                    <AutoShrinkText
                      text={activity.summary || "(ไม่มีชื่อ)"}
                      className="mini-timeline-event-title"
                      minScale={0.5}
                      baseFontSize="12px"
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
                <li key={activity.id} className={`mini-timeline-item${focusedActivityId === activity.id ? " is-focused" : ""}`}>
                  <div className="mini-timeline-time">{formatTime(start)}</div>
                  <div className="mini-timeline-track">
                    <span className="mini-timeline-dot" style={{ background: color.border }} />
                    <span className="mini-timeline-line" />
                  </div>
                  <div
                    className="mini-timeline-event"
                    style={{ background: color.bg, borderLeftColor: color.border }}
                    title={activity.summary || "(ไม่มีชื่อ)"}
                    role="button"
                    tabIndex={0}
                    aria-pressed={focusedActivityId === activity.id}
                    onClick={() => toggleFocusedActivity(activity.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleFocusedActivity(activity.id);
                      }
                    }}
                  >
                    <AutoShrinkText
                      text={activity.summary || "(ไม่มีชื่อ)"}
                      className="mini-timeline-event-title"
                      minScale={0.5}
                      baseFontSize="12px"
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
