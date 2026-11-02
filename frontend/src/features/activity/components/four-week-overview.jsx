import React, { useMemo } from "react";
import { getWeekRange, getYearWeekRange, isSameDay, weekdayShortLabels } from "../../../shared/lib/date-utils.js";
import { buildWeekSpineData } from "../lib/week-spine-data.js";
import WeekNameField from "./week-name-field.jsx";

function formatVisibleRange(start, end, language) {
  const locale = language === "th" ? "th-TH" : "en-US";
  const options = { day: "numeric", month: "short" };
  const startLabel = start.toLocaleDateString(locale, options);
  const endLabel = end.toLocaleDateString(locale, options);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
}

export default function FourWeekOverview({ weeks: cycleWeeks = [], cycleStart, cycleEnd, focusedWeekDate, activities, categories, activityCategoryMap, lockedActivities, weekNames, editingWeekKey, weekNameDraft, onStartEditingWeekName, onWeekNameDraftChange, onCommitWeekName, onCancelWeekName, language, onSelectWeek, onSelectDay, onNavigateCycle, onOpenWeekEditor, onOpenWeekView }) {
  const labels = weekdayShortLabels(language);
  const [focusedWeekStart] = getYearWeekRange(focusedWeekDate || cycleStart);
  const weeks = useMemo(() => cycleWeeks.map(({ start, end }) => {
    const { timedSegments, allDayActivities } = buildWeekSpineData({ activities, weekStart: start, weekEnd: end, activityCategoryMap, categories, lockedActivities });
    const [calendarWeekStart] = getWeekRange(start);
    const days = Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(calendarWeekStart);
      day.setDate(day.getDate() + offset);
      return day;
    });
    return { start, end, visibleStart: start, visibleEnd: end, days, timedSegments, allDayActivities };
  }), [cycleWeeks, activities, activityCategoryMap, categories, lockedActivities]);

  return <section className="week-spine-four-week" aria-label="Cycle สี่สัปดาห์ อ่านอย่างเดียว">
    <div className="week-spine-overview-cycle-nav" aria-label="เปลี่ยน Cycle">
      <button type="button" onClick={() => onNavigateCycle?.(-1)} aria-label="Cycle ก่อนหน้า">‹</button>
      <button type="button" onClick={() => onNavigateCycle?.(1)} aria-label="Cycle ถัดไป">›</button>
    </div>
    <div className="week-spine-four-week-grid">
      {weeks.map((week) => <section className={`week-spine-overview-week${isSameDay(week.start, focusedWeekStart) ? " is-focus-week" : ""}`} key={week.start.toISOString()} aria-current={isSameDay(week.start, focusedWeekStart) ? "true" : undefined} onDoubleClick={() => onOpenWeekView?.(week.visibleStart, { start: week.visibleStart, end: week.visibleEnd })}>
        <header className="week-spine-overview-week-header">
          <h3><button type="button" onClick={(event) => { event.stopPropagation(); onSelectWeek?.(week.visibleStart); }}>{formatVisibleRange(week.visibleStart, week.visibleEnd, language)}</button></h3>
          <WeekNameField className="week-spine-overview-week-name" weekStart={week.start} weekNames={weekNames} editingWeekKey={editingWeekKey} weekNameDraft={weekNameDraft} onStartEditing={onStartEditingWeekName} onDraftChange={onWeekNameDraftChange} onCommit={onCommitWeekName} onCancel={onCancelWeekName} />
          <button type="button" className="week-spine-overview-fullscreen-btn" onClick={(event) => { event.stopPropagation(); onOpenWeekEditor?.(week.visibleStart, { start: week.visibleStart, end: week.visibleEnd }); }} aria-label={`เปิดและแก้ไขสัปดาห์ ${formatVisibleRange(week.visibleStart, week.visibleEnd, language)}`} title="เปิดสัปดาห์เพื่อแก้ไข">↗</button>
        </header>
        <div className="week-spine-overview-days">
          {week.days.map((day) => {
            const isOutsideCycle = day < week.visibleStart || day > week.visibleEnd;
            const items = week.timedSegments.filter((segment) => isSameDay(segment.day, day)).sort((a, b) => a.start - b.start);
            const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
            const allDay = week.allDayActivities.filter(item => item.start < nextDay && item.end > day);
            const groups = new Map();
            for (const item of items) {
              const key = item.color.border;
              const group = groups.get(key) || { color: key, duration: 0 };
              group.duration += item.end - item.start;
              groups.set(key, group);
            }
            const total = [...groups.values()].reduce((sum, group) => sum + group.duration, 0);
            return <button type="button" disabled={isOutsideCycle} className={`week-spine-overview-day${isOutsideCycle ? " is-outside-cycle" : ""}${isSameDay(day, new Date()) ? " is-today" : ""}`} key={day.toISOString()} onClick={(event) => { event.stopPropagation(); onSelectDay?.(day); }} aria-label={isOutsideCycle ? "อยู่นอกขอบเขต Cycle ของปีนี้" : `เปิดรายการกิจกรรม ${labels[day.getDay()]} ${day.getDate()}`}>
              {!isOutsideCycle && <header><span>{labels[day.getDay()]}</span><strong>{day.getDate()}</strong></header>}
              <span className="week-spine-overview-tabs" aria-hidden="true">{[...groups.values()].map(group => <span key={group.color} style={{ "--activity-color": group.color, flex: `${group.duration / total} 1 0` }} />)}{allDay.map(item => <i key={item.calendarId} style={{ "--activity-color": item.color.border }} />)}</span>
              <small className="week-spine-overview-day-count">{items.length + allDay.length}</small>
            </button>;
          })}
        </div>
      </section>)}
    </div>
  </section>;
}
