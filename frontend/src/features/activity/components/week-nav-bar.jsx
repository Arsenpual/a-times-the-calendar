import React from "react";
import { isSameDay, weekdayShortLabels } from "../../../shared/lib/date-utils.js";
import WeekNameField from "./week-name-field.jsx";

/**
 * Bottom navigation strip for Week view:
 * Uses the exact same .lonth-nav-bar layout and primitives as LonthNavBar and MonthNavBar.
 */
export default function WeekNavBar({
  weekStart,
  weekEnd,
  weekDays = [],
  selectedDay,
  today = new Date(),
  language = "th",
  activityHeaderTitle,
  weekNames,
  editingWeekKey,
  weekNameDraft,
  onStartEditingWeekName,
  onWeekNameDraftChange,
  onCommitWeekName,
  onCancelWeekNameEdit,
  onSelectDay,
  onGoToday,
  onNavigateWeek
}) {
  const labels = weekdayShortLabels(language);

  return (
    <nav className="lonth-nav-bar week-nav-bar" aria-label="แถบนำทางรายสัปดาห์">
      <div className="lonth-nav-controls header-calendar-tools">
        <button
          type="button"
          className="lonth-nav-arrow"
          onClick={() => onNavigateWeek?.(-1)}
          aria-label="สัปดาห์ก่อนหน้า"
          title="สัปดาห์ก่อนหน้า"
        >
          ‹
        </button>

        <h1 className="app-title lonth-nav-current-badge week-nav-badge">
          <strong className="app-title-date">
            {weekStart ? (
              <WeekNameField
                className="week-spine-week-name app-title-week-name"
                weekStart={weekStart}
                weekNames={weekNames}
                editingWeekKey={editingWeekKey}
                weekNameDraft={weekNameDraft}
                onStartEditing={onStartEditingWeekName}
                onDraftChange={onWeekNameDraftChange}
                onCommit={onCommitWeekName}
                onCancel={onCancelWeekNameEdit}
              />
            ) : activityHeaderTitle?.date}
          </strong>
          {activityHeaderTitle?.period && (
            <small className="app-title-period">{activityHeaderTitle.period}</small>
          )}
        </h1>

        <button
          type="button"
          className="lonth-nav-arrow"
          onClick={() => onNavigateWeek?.(1)}
          aria-label="สัปดาห์ถัดไป"
          title="สัปดาห์ถัดไป"
        >
          ›
        </button>

        <button
          type="button"
          className="lonth-pill month-nav-today-btn"
          onClick={onGoToday}
          title="ไปยังสัปดาห์ปัจจุบัน"
        >
          วันนี้
        </button>
      </div>

      {weekDays.length > 0 && (
        <div className="lonth-pill-strip" role="tablist" aria-label="เลือกวันในสัปดาห์">
          {weekDays.map((day) => {
            const isOutsideYear = (weekStart && day < weekStart) || (weekEnd && day > weekEnd);
            const isSelected = !isOutsideYear && selectedDay && isSameDay(day, selectedDay);
            const isToday = !isOutsideYear && isSameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                type="button"
                role="tab"
                disabled={isOutsideYear}
                aria-selected={Boolean(isSelected)}
                aria-current={isToday ? "date" : undefined}
                className={`lonth-pill week-nav-day-pill${isSelected ? " is-active" : ""}${isToday ? " is-today" : ""}${isOutsideYear ? " is-outside" : ""}`}
                onClick={() => onSelectDay?.(day)}
                title={isOutsideYear ? "อยู่นอกปีปฏิทิน" : day.toLocaleDateString(language === "th" ? "th-TH" : "en-US", { weekday: "long", day: "numeric", month: "short" })}
              >
                <span>{labels[day.getDay()]}</span>
                {!isOutsideYear && <span>{day.getDate()}</span>}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
