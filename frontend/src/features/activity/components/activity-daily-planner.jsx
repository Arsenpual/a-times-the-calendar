import PlannerTimeActions from "./planner-time-actions.jsx";
import { usePlannerDrag } from "../hooks/use-planner-drag.js";
import React, { useMemo } from "react";
import { buildWeekSpineData } from "../lib/week-spine-data.js";
import { buildDailyPlannerLayout, minuteLabel } from "../lib/daily-planner-layout.js";
import "../styles/activity-daily-planner.css";

export default function ActivityDailyPlanner({ id, timeChanges, day, activities, categories, activityCategoryMap, lockedActivities, loading, onClose, onAddActivity, onEditActivity }) {
  const { timedSegments, allDayActivities } = useMemo(() => buildWeekSpineData({ activities, weekStart: day, weekEnd: day, categories, activityCategoryMap, lockedActivities }), [activities, day, categories, activityCategoryMap, lockedActivities]);
  const layout = useMemo(() => buildDailyPlannerLayout(timedSegments, day), [timedSegments, day]);
  const { beginDrag, suppressClick, preview } = usePlannerDrag({ day, changes: timeChanges });
  const all = [...allDayActivities, ...layout.items];
  const editActivity = item => {
    if (item.isLocked || suppressClick.current || timeChanges.isSavingTimeChanges) return;
    if (item.source.isOnboardingSample) onAddActivity?.(item.start, { preserveTime: true, end: item.end, title: item.title });
    else onEditActivity?.(item.source);
  };
  const timeLabel = item => item.isAllDay ? "ทั้งวัน" : `${minuteLabel(item.startMinute)}–${minuteLabel(item.endMinute)}`;
  const dateLabel = day.toLocaleDateString("th-TH", { day: "numeric", month: "long" });
  return <section id={id} className="daily-planner" aria-label={`รายละเอียดวัน ${dateLabel}`}>
    {loading && <p role="status">กำลังโหลดกิจกรรม…</p>}
    <div className="daily-planner-axis" aria-hidden="true">{Array.from({ length: 25 }, (_, hour) => <span key={hour} style={{ left: `${hour / 24 * 100}%` }}>{minuteLabel(hour * 60)}</span>)}</div>
    <div data-day={day.toISOString()} className="daily-planner-lanes" aria-label="เส้นเวลา 00:00 ถึง 24:00">
      {allDayActivities.map(item => <div className="daily-planner-lane" key={`all-day:${item.calendarId}`}>
        <button type="button" className="daily-planner-event is-all-day" style={{ left: "0%", width: "100%", "--event-color": item.color.border }} onPointerDown={event => beginDrag(event, item)} onClick={() => editActivity(item)} title={`${item.title} · ทั้งวัน 00:00–24:00`} aria-label={`${item.title} ทั้งวัน 00:00 ถึง 24:00`} disabled={item.isLocked || timeChanges.isSavingTimeChanges}><span className="daily-planner-all-day-badge">ทั้งวัน</span><span>{item.title}</span></button>
      </div>)}
      {(layout.lanes.length ? layout.lanes : allDayActivities.length ? [] : [[]]).map((lane, index) => <div className="daily-planner-lane" key={index}>
        {lane.map(item => <button key={item.segmentId} type="button" className="daily-planner-event" style={{ left: `${item.startMinute / 1440 * 100}%`, width: `${(item.endMinute - item.startMinute) / 1440 * 100}%`, "--event-color": item.color.border }} onPointerDown={event => beginDrag(event, item)} onClick={() => editActivity(item)} title={`${item.title} · ${timeLabel(item)}`} aria-label={`${item.title} ${timeLabel(item)}`} disabled={item.isLocked || timeChanges.isSavingTimeChanges}>{!item.continuesFromPreviousDay && <span className="planner-resize start" aria-label="ปรับเวลาเริ่ม" onPointerDown={event => beginDrag(event, item, "start")} />}
          <span>{item.title}</span>
          {!item.continuesIntoNextDay && <span className="planner-resize end" aria-label="ปรับเวลาสิ้นสุด" onPointerDown={event => beginDrag(event, item, "end")} />}
        </button>)}
      </div>)}
    </div>

    {preview && <output className="planner-drag-preview" aria-live="polite">{preview}</output>}
    <footer className="daily-planner-detail">
      {all.length === 0 && <small>ยังไม่มีกิจกรรมในวันนี้</small>}
      <button type="button" onClick={() => onAddActivity?.(day)}>+ เพิ่มกิจกรรม</button>
      <PlannerTimeActions changes={timeChanges} />
      <button type="button" onClick={onClose} aria-label={`ปิดรายละเอียดวัน ${dateLabel}`}>ย่อ</button>
    </footer>
  </section>;
}
