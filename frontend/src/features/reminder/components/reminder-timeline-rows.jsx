import React from "react";
import { ROW_HEIGHT_PX } from "../hooks/use-reminder-timeline.js";
import { describeReminder } from "../lib/reminder-formatters.js";
const ReminderTimelineRows = React.memo(
  function TimelineRows({ tapeRows, nowTick, onEditReminder }) {
    return tapeRows.map(({ key, isMajor, label, flags }) => (
      <div key={key} className={`time-row${isMajor ? " major-hour" : ""}`} style={{ height: `${ROW_HEIGHT_PX}px`, "--row-height": `${ROW_HEIGHT_PX}px` }}>
        <span className="time-label">{label}</span>
        {flags.length > 0 && (
          <span className="event-chip-group">
            {flags.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`event-chip${r.enabled ? "" : " disabled"}`}
                title={`แก้ไข: ${r.title} · ${describeReminder(r, nowTick)}`}
                onClick={() => onEditReminder(r)}
              >
                <span className="chip-dot" />{r.title}
              </button>
            ))}
          </span>
        )}
      </div>
    ));
  },
  (prevProps, nextProps) => prevProps.tapeRows === nextProps.tapeRows && prevProps.onEditReminder === nextProps.onEditReminder
);


export default ReminderTimelineRows;
