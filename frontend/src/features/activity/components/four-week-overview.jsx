import React, { useMemo } from "react";
import { getWeekRange, isSameDay, weekdayShortLabels, formatWeekRange, formatTime } from "../../../shared/lib/date-utils.js";
import { buildWeekSpineData } from "../lib/week-spine-data.js";
import WeekNameField from "./week-name-field.jsx";

export default function FourWeekOverview({ weekStart, weekCount = 4, focusedWeekDate, activities, categories, activityCategoryMap, lockedActivities, weekNames, editingWeekKey, weekNameDraft, onStartEditingWeekName, onWeekNameDraftChange, onCommitWeekName, onCancelWeekName, language, onSelectWeek, onSelectDay, onNavigateCycle, onOpenWeekEditor, onOpenWeekView }) {
  const labels = weekdayShortLabels(language);
  const [focusedWeekStart] = getWeekRange(focusedWeekDate || weekStart);
  const weeks = useMemo(() => Array.from({ length: weekCount }, (_, offset) => {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const { timedSegments, allDayActivities } = buildWeekSpineData({ activities, weekStart: start, weekEnd: end, activityCategoryMap, categories, lockedActivities });
    return { start, end, timedSegments, allDayActivities };
  }), [weekStart.getTime(), weekCount, activities, activityCategoryMap, categories, lockedActivities]);

  return <section className="week-spine-four-week" aria-label="Cycle สี่สัปดาห์ อ่านอย่างเดียว">
    <div className="week-spine-overview-cycle-nav" aria-label="เปลี่ยน Cycle">
      <button type="button" onClick={() => onNavigateCycle?.(-1)} aria-label="Cycle ก่อนหน้า">‹</button>
      <button type="button" onClick={() => onNavigateCycle?.(1)} aria-label="Cycle ถัดไป">›</button>
    </div>
    <div className="week-spine-four-week-grid">
      {weeks.map((week) => <section className={`week-spine-overview-week${isSameDay(week.start, focusedWeekStart) ? " is-focus-week" : ""}`} key={week.start.toISOString()} aria-current={isSameDay(week.start, focusedWeekStart) ? "true" : undefined} onDoubleClick={() => onOpenWeekView?.(week.start)}>
        <header className="week-spine-overview-week-header">
          <h3><button type="button" onClick={(event) => { event.stopPropagation(); onSelectWeek?.(week.start); }}>{formatWeekRange(week.start, language)}</button></h3>
          <WeekNameField className="week-spine-overview-week-name" weekStart={week.start} weekNames={weekNames} editingWeekKey={editingWeekKey} weekNameDraft={weekNameDraft} onStartEditing={onStartEditingWeekName} onDraftChange={onWeekNameDraftChange} onCommit={onCommitWeekName} onCancel={onCancelWeekName} />
          <button type="button" className="week-spine-overview-fullscreen-btn" onClick={(event) => { event.stopPropagation(); onOpenWeekEditor?.(week.start); }} aria-label={`เปิดและแก้ไขสัปดาห์ ${formatWeekRange(week.start, language)}`} title="เปิดเพื่อแก้ไขแบบเต็มจอ">⛶</button>
        </header>
        {week.allDayActivities.length > 0 && <div className="week-spine-overview-all-day">{week.allDayActivities.slice(0, 3).map((activity) => <span key={activity.calendarId} style={{ "--activity-color": activity.color.border }} title={`กิจกรรมทั้งวัน: ${activity.title}`} />)}{week.allDayActivities.length > 3 && <small>+{week.allDayActivities.length - 3}</small>}</div>}
        <div className="week-spine-overview-days">
          {Array.from({ length: 7 }, (_, offset) => {
            const day = new Date(week.start); day.setDate(day.getDate() + offset);
            const items = week.timedSegments.filter((segment) => isSameDay(segment.day, day)).sort((a, b) => a.start - b.start);
            return <button type="button" className={`week-spine-overview-day${isSameDay(day, new Date()) ? " is-today" : ""}`} key={day.toISOString()} onClick={(event) => { event.stopPropagation(); onSelectDay?.(day); }} aria-label={`เปิดรายการกิจกรรม ${labels[day.getDay()]} ${day.getDate()}`}>
              <header><span>{labels[day.getDay()]}</span><strong>{day.getDate()}</strong></header>
              <div className="week-spine-overview-tabs">{items.map((item) => <span key={item.segmentId} style={{ "--activity-color": item.color.border }} title={`${formatTime(item.start, language)} ${item.title}`} />)}</div>
            </button>;
          })}
        </div>
      </section>)}
    </div>
  </section>;
}
