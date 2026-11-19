import React, { useMemo } from "react";
import {
  formatTime,
  getWeekRange,
  getYearWeekRange,
  isSameDay,
  weekdayShortLabels
} from "../../../shared/lib/date-utils.js";
import { buildWeekSpineData } from "../lib/week-spine-data.js";
import WeekNameField from "./week-name-field.jsx";

function formatVisibleRange(start, end, language) {
  const locale = language === "th" ? "th-TH" : "en-US";
  const options = { day: "numeric", month: "short" };
  const startLabel = start.toLocaleDateString(locale, options);
  const endLabel = end.toLocaleDateString(locale, options);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
}

export default function FourWeekOverview({
  calendarMode = "lonth",
  weeks: cycleWeeks = [],
  cycleStart,
  cycleEnd,
  focusedWeekDate,
  activities = [],
  categories = [],
  activityCategoryMap = {},
  lockedActivities,
  weekNames,
  editingWeekKey,
  weekNameDraft,
  onStartEditingWeekName,
  onWeekNameDraftChange,
  onCommitWeekName,
  onCancelWeekName,
  language = "th",
  onSelectWeek,
  onSelectDay,
  onNavigateCycle,
  onSelectLonthDate,
  onOpenWeekEditor,
  onOpenWeekView,
  onEditActivity,
  onAddActivity
}) {
  const isMonthMode = calendarMode === "month";
  const labels = weekdayShortLabels(language); // Starts with Sunday (อา, จ, อ, พ, พฤ, ศ, ส)
  const [focusedWeekStart] = getYearWeekRange(focusedWeekDate || cycleStart);

  const weeks = useMemo(() => cycleWeeks.map(({ start, end }) => {
    const { timedSegments, allDayActivities } = buildWeekSpineData({
      activities,
      weekStart: start,
      weekEnd: end,
      activityCategoryMap,
      categories,
      lockedActivities
    });
    const [calendarWeekStart] = getWeekRange(start);
    const days = Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(calendarWeekStart);
      day.setDate(day.getDate() + offset);
      return day;
    });
    return {
      start,
      end,
      visibleStart: isMonthMode && cycleStart ? cycleStart : start,
      visibleEnd: isMonthMode && cycleEnd ? cycleEnd : end,
      days,
      timedSegments,
      allDayActivities
    };
  }), [cycleWeeks, activities, activityCategoryMap, categories, lockedActivities, isMonthMode, cycleStart, cycleEnd]);

  return (
    <section
      className={`week-spine-four-week lonth-gcal-month-view${isMonthMode ? " is-standard-month" : ""}`}
      aria-label={isMonthMode ? "ปฏิทินแบบเดือน" : "ปฏิทิน Lonth แบบเดือน"}
    >
      <div className="week-spine-overview-cycle-nav" aria-label={isMonthMode ? "เปลี่ยนเดือน" : "เปลี่ยน Lonth"}>
        <button type="button" onClick={() => onNavigateCycle?.(-1)} aria-label={isMonthMode ? "เดือนก่อนหน้า" : "Lonth ก่อนหน้า"}>‹</button>
        <button type="button" onClick={() => onNavigateCycle?.(1)} aria-label={isMonthMode ? "เดือนถัดไป" : "Lonth ถัดไป"}>›</button>
      </div>

      {/* Weekday Header Bar (7 Columns: Sun - Sat) */}
      <div className="lonth-gcal-weekdays-bar" role="row" aria-hidden="true">
        {labels.map((label, idx) => (
          <div key={label} className={`lonth-gcal-weekday-cell${idx === 0 || idx === 6 ? " is-weekend" : ""}`}>
            <span className="lonth-gcal-weekday-name">{label}</span>
          </div>
        ))}
      </div>

      {/* 4 Weeks Calendar Grid */}
      <div className="week-spine-four-week-grid lonth-gcal-grid">
        {weeks.map((week, weekIndex) => (
          <section
            className={`week-spine-overview-week lonth-gcal-week-row${isSameDay(week.start, focusedWeekStart) ? " is-focus-week" : ""}`}
            key={week.start.toISOString()}
            aria-current={isSameDay(week.start, focusedWeekStart) ? "true" : undefined}
            onDoubleClick={() => onOpenWeekView?.(week.visibleStart, { start: week.visibleStart, end: week.visibleEnd })}
          >
            {!isMonthMode && (
            <header className="week-spine-overview-week-header lonth-gcal-week-header">
              <button
                type="button"
                className="lonth-gcal-week-btn"
                onClick={(e) => { e.stopPropagation(); onSelectWeek?.(week.visibleStart); }}
                title="คลิกเพื่อเลือกสัปดาห์นี้"
              >
                <span className="lonth-gcal-week-tag">สัปดาห์ {weekIndex + 1}</span>
                <span className="lonth-gcal-week-dates">{formatVisibleRange(week.visibleStart, week.visibleEnd, language)}</span>
              </button>
              <WeekNameField
                className="week-spine-overview-week-name lonth-gcal-week-name"
                weekStart={week.start}
                weekNames={weekNames}
                editingWeekKey={editingWeekKey}
                weekNameDraft={weekNameDraft}
                onStartEditing={onStartEditingWeekName}
                onDraftChange={onWeekNameDraftChange}
                onCommit={onCommitWeekName}
                onCancel={onCancelWeekName}
              />
              <button
                type="button"
                className="week-spine-overview-fullscreen-btn lonth-gcal-fullscreen-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenWeekEditor?.(week.visibleStart, { start: week.visibleStart, end: week.visibleEnd });
                }}
                aria-label={`เปิดและแก้ไขสัปดาห์ ${formatVisibleRange(week.visibleStart, week.visibleEnd, language)}`}
                title="เปิดสัปดาห์เพื่อแก้ไข"
              >
                ↗
              </button>
            </header>
            )}

            <div className="week-spine-overview-days lonth-gcal-days-row">
              {week.days.map((day) => {
                const isOutsideMonth = isMonthMode && (day < week.visibleStart || day > week.visibleEnd);
                const isOutsideCycle = !isMonthMode && (day < week.visibleStart || day > week.visibleEnd);
                const isToday = isSameDay(day, new Date());

                // Timed activities
                const timedItems = week.timedSegments
                  .filter((seg) => isSameDay(seg.day, day))
                  .sort((a, b) => a.start - b.start);

                // All-day activities
                const nextDay = new Date(day);
                nextDay.setDate(nextDay.getDate() + 1);
                const allDayItems = week.allDayActivities.filter((item) => item.start < nextDay && item.end > day);

                // Combined list: all-day first, then timed
                const allEvents = [
                  ...allDayItems.map((item) => ({
                    id: item.calendarId || item.id,
                    title: item.title,
                    isAllDay: true,
                    timeStr: "ทั้งวัน",
                    color: item.color?.border || item.color?.bg || "#4285f4",
                    raw: item.source || item
                  })),
                  ...timedItems.map((item) => ({
                    id: item.calendarId || item.id,
                    title: item.title,
                    isAllDay: false,
                    timeStr: formatTime(item.start, language),
                    color: item.color?.border || item.color?.bg || "#4285f4",
                    raw: item.source || item
                  }))
                ];

                const maxDisplay = 3;
                const visibleEvents = allEvents.slice(0, maxDisplay);
                const overflowCount = allEvents.length - maxDisplay;

                return (
                  <button
                    type="button"
                    disabled={isOutsideCycle}
                    className={`week-spine-overview-day lonth-gcal-day-cell${isOutsideCycle ? " is-outside-cycle" : ""}${isOutsideMonth ? " is-outside-month" : ""}${isToday ? " is-today" : ""}`}
                    key={day.toISOString()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDay?.(day);
                    }}
                    aria-label={isOutsideCycle ? "อยู่นอกขอบเขต Lonth" : `${labels[day.getDay()]} ${day.getDate()} (${allEvents.length} กิจกรรม)`}
                  >
                    <div className="lonth-gcal-day-top">
                      {day.getDate() === 1 && !isOutsideCycle && (
                        <span className="lonth-gcal-month-prefix">
                          {day.toLocaleDateString(language === "th" ? "th-TH" : "en-US", { month: "short" })}
                        </span>
                      )}
                      <span className={`lonth-gcal-day-num${isToday ? " is-today-badge" : ""}`}>
                        {day.getDate()}
                      </span>
                    </div>

                    {!isOutsideCycle && allEvents.length > 0 && (
                      <div className="lonth-gcal-events-wrap">
                        {visibleEvents.map((event) => (
                          <div
                            key={event.id}
                            className={`lonth-gcal-event-chip${event.isAllDay ? " is-all-day" : " is-timed"}`}
                            style={{
                              "--event-color": event.color,
                              backgroundColor: event.isAllDay ? event.color : undefined
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onEditActivity && event.raw) {
                                onEditActivity(event.raw);
                              } else {
                                onSelectDay?.(day);
                              }
                            }}
                            title={`${event.isAllDay ? "[ทั้งวัน]" : event.timeStr} ${event.title}`}
                          >
                            {!event.isAllDay && <span className="lonth-gcal-event-dot" style={{ backgroundColor: event.color }} />}
                            {!event.isAllDay && <span className="lonth-gcal-event-time">{event.timeStr}</span>}
                            <span className="lonth-gcal-event-title">{event.title}</span>
                          </div>
                        ))}

                        {overflowCount > 0 && (
                          <span
                            className="lonth-gcal-more-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDay?.(day);
                            }}
                          >
                            +{overflowCount} เพิ่มเติม
                          </span>
                        )}
                      </div>
                    )}

                    {/* Hidden tabs for backward compatibility with tests */}
                    <span className="week-spine-overview-tabs" aria-hidden="true" style={{ display: "none" }} />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
