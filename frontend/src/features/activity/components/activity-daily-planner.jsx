import { createPortal } from "react-dom";
import { downloadDayTimelineImage } from "../lib/export-day-image.js";
import { activityDate, isSameDay } from "../../../shared/lib/date-utils.js";
import PlannerTimeActions from "./planner-time-actions.jsx";
import { usePlannerDrag } from "../hooks/use-planner-drag.js";
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildWeekSpineData } from "../lib/week-spine-data.js";
import { buildDailyPlannerLayout, canFitCenteredDuration, durationLabel, minuteLabel } from "../lib/daily-planner-layout.js";
import "../styles/activity-daily-planner.css";

function PlannerEventBar({ item, isAligned, timeText, isDisabled, onContextMenu, onPointerDown, onClick }) {
  const buttonRef = useRef(null);
  const titleRef = useRef(null);
  const durationRef = useRef(null);
  const durationText = durationLabel(item.endMinute - item.startMinute);
  const [showDuration, setShowDuration] = useState(false);

  useLayoutEffect(() => {
    const buttonEl = buttonRef.current;
    const titleEl = titleRef.current;
    const durationEl = durationRef.current;
    if (!buttonEl || !titleEl || !durationEl) return undefined;

    let cancelled = false;
    const update = () => {
      if (cancelled) return;
      const style = getComputedStyle(buttonEl);
      const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const innerWidth = buttonEl.clientWidth - padX;
      const durationWidth = Math.ceil(durationEl.getBoundingClientRect().width);
      const titleWidth = Math.ceil(titleEl.scrollWidth);
      const next = canFitCenteredDuration({ innerWidth, titleWidth, durationWidth });
      setShowDuration(prev => (prev === next ? prev : next));
    };

    update();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    observer?.observe(buttonEl);
    document.fonts?.ready?.then(update);
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [item.title, durationText, item.startMinute, item.endMinute]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`daily-planner-event${isAligned ? " is-aligned" : ""}${showDuration ? "" : " is-duration-hidden"}`}
      style={{
        left: `${item.startMinute / 1440 * 100}%`,
        width: `${(item.endMinute - item.startMinute) / 1440 * 100}%`,
        "--event-color": item.color.border,
      }}
      onContextMenu={event => onContextMenu?.(event, item)}
      onPointerDown={event => onPointerDown(event, item)}
      onClick={() => onClick(item)}
      title={`${item.title} · ${timeText} (${durationText})`}
      aria-label={`${item.title} ${timeText} ${durationText}`}
      aria-disabled={isDisabled}
    >
      {!item.continuesFromPreviousDay && <span className="planner-resize start" aria-label="ปรับเวลาเริ่ม" onPointerDown={event => onPointerDown(event, item, "start")} />}
      <span ref={titleRef} className="daily-planner-event-title">{item.title}</span>
      <span ref={durationRef} className="daily-planner-event-duration" aria-hidden="true">{durationText}</span>
      {!item.continuesIntoNextDay && <span className="planner-resize end" aria-label="ปรับเวลาสิ้นสุด" onPointerDown={event => onPointerDown(event, item, "end")} />}
    </button>
  );
}

export default function ActivityDailyPlanner({ id, timeChanges, day, activities, categories, activityCategoryMap, lockedActivities, loading, onClose, onAddActivity, onEditActivity, onContextMenu }) {
  const { timedSegments, allDayActivities } = useMemo(() => buildWeekSpineData({ activities, weekStart: day, weekEnd: day, categories, activityCategoryMap, lockedActivities }), [activities, day, categories, activityCategoryMap, lockedActivities]);
  const layout = useMemo(() => buildDailyPlannerLayout(timedSegments, day), [timedSegments, day]);
  const { beginDrag, suppressClick, preview, ghost } = usePlannerDrag({ day, changes: timeChanges });
  const all = [...allDayActivities, ...layout.items];
  const draft = timeChanges.dragPreview;
  const minute = date => date.getHours() * 60 + date.getMinutes();
  const boundaries = draft ? [minute(draft.start), minute(draft.end)] : [];
  const matches = item => draft && item.calendarId !== draft.id && boundaries.some(value => value === item.startMinute || value === item.endMinute || (value === 0 && item.endMinute === 1440));
  const matchedMinutes = [...new Set(layout.items.filter(matches).flatMap(item => [item.startMinute, item.endMinute].filter(value => boundaries.includes(value) || (value === 1440 && boundaries.includes(0)))))];
  const editActivity = item => {
    if (item.isLocked || suppressClick.current || timeChanges.isSavingTimeChanges) return;
    if (item.source.isOnboardingSample) onAddActivity?.(item.start, { preserveTime: true, end: item.end, title: item.title });
    else onEditActivity?.(item.source);
  };
  const timeLabel = item => item.isAllDay ? "ทั้งวัน" : `${minuteLabel(item.startMinute)}–${minuteLabel(item.endMinute)}`;
  const dateLabel = day.toLocaleDateString("th-TH", { day: "numeric", month: "long" });
  return <section id={id} className="daily-planner" aria-label={`รายละเอียดวัน ${dateLabel}`}>
    {loading && <p role="status">กำลังโหลดกิจกรรม…</p>}
    <div className="daily-planner-axis" aria-hidden="true">{Array.from({ length: 23 }, (_, index) => { const hour = index + 1; return <span key={hour} style={{ left: `${hour / 24 * 100}%` }}>{minuteLabel(hour * 60)}</span>; })}</div>
    <div data-day={day.toISOString()} className="daily-planner-lanes" aria-label="เส้นเวลา 00:00 ถึง 24:00">
      {matchedMinutes.map(value => <span key={value} className="planner-alignment-guide" data-minute={value} style={{ left: `${value / 1440 * 100}%` }} aria-hidden="true" />)}
      {allDayActivities.map(item => <div className="daily-planner-lane" key={`all-day:${item.calendarId}`}>
        <button type="button" className="daily-planner-event is-all-day" style={{ left: "0%", width: "100%", "--event-color": item.color.border }} onContextMenu={event => onContextMenu?.(event, item)} onPointerDown={event => beginDrag(event, item)} onClick={() => editActivity(item)} title={`${item.title} · ทั้งวัน 00:00–24:00`} aria-label={`${item.title} ทั้งวัน 00:00 ถึง 24:00`} aria-disabled={item.isLocked || timeChanges.isSavingTimeChanges}><span className="daily-planner-all-day-badge">ทั้งวัน</span><span>{item.title}</span></button>
      </div>)}
      {(layout.lanes.length ? layout.lanes : allDayActivities.length ? [] : [[]]).map((lane, index) => <div className="daily-planner-lane" key={index}>
        {lane.map(item => (
          <PlannerEventBar
            key={item.segmentId}
            item={item}
            isAligned={matches(item)}
            timeText={timeLabel(item)}
            isDisabled={item.isLocked || timeChanges.isSavingTimeChanges}
            onContextMenu={onContextMenu}
            onPointerDown={beginDrag}
            onClick={editActivity}
          />
        ))}
      </div>)}
    </div>

    {ghost && createPortal(<div className="planner-drag-ghost" style={{ left: Math.min(ghost.x + 16, window.innerWidth - 230), top: Math.min(ghost.y + 18, window.innerHeight - 85), "--event-color": ghost.color }}><strong>{ghost.title}</strong><small>{preview}</small></div>, document.body)}
    {preview && <output className="planner-drag-preview" aria-live="polite">{preview}</output>}
    <footer className="daily-planner-detail">
      {all.length === 0 && <small>ยังไม่มีกิจกรรมในวันนี้</small>}
      <button type="button" onClick={() => onAddActivity?.(day)}>+ เพิ่มกิจกรรม</button>
      <PlannerTimeActions changes={timeChanges} />
      <button type="button" className="day-timeline-nav" onClick={() => downloadDayTimelineImage({ day, activities: activities.filter(activity => { const start = activityDate(activity.start); const end = activityDate(activity.end); if (!start) return false; if (activity.start?.date) { const next = new Date(day); next.setDate(next.getDate() + 1); return start < next && end > day; } return isSameDay(start, day); }), allActivities: activities, categories, activityCategoryMap })} aria-label="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ" title="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ (PNG)"><svg className="day-timeline-aperture" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M14.31 8 20.05 17.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16 3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94"/></svg></button>
      <button type="button" className="daily-planner-normal-view" onClick={onClose} aria-label={`กลับสู่มุมมองปกติ ${dateLabel}`} title="กลับสู่มุมมองปกติ"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 9h10M7 12h10M7 15h7" /></svg></button>
    </footer>
  </section>;
}
