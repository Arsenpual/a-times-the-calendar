import React, { useMemo } from "react";
import { getCachedYearLonths, findLonthByDate, formatLonthRange } from "../../../shared/lib/date-utils.js";

/**
 * Navigation strip for the 14 Lonth system (TIMES-CAL-001).
 * Displays L01 through L14 with indicators for the active Lonth and today's Lonth.
 */
export default function LonthNavBar({
  activeDate,
  onNavigate,
  onSelectDate,
  language = "th"
}) {
  const safeDate = activeDate instanceof Date && !Number.isNaN(activeDate.getTime()) ? activeDate : new Date();
  const year = safeDate.getFullYear();
  const yearLonths = useMemo(() => getCachedYearLonths(year), [year]);
  const activeLonth = useMemo(() => findLonthByDate(safeDate), [safeDate]);
  const todayLonth = useMemo(() => findLonthByDate(new Date()), []);
  const isThisYear = todayLonth.year === year;

  return (
    <nav className="lonth-nav-bar" aria-label="แถบเลือก Lonth ประจำปี">
      <div className="lonth-nav-controls">
        <button
          type="button"
          className="lonth-nav-arrow"
          onClick={() => onNavigate?.(-1)}
          aria-label="Lonth ก่อนหน้า"
          title="Lonth ก่อนหน้า"
        >
          ‹
        </button>
        <span className="lonth-nav-current-badge">
          <strong>{activeLonth.id}</strong>
          <small>{formatLonthRange(activeLonth, language)}</small>
        </span>
        <button
          type="button"
          className="lonth-nav-arrow"
          onClick={() => onNavigate?.(1)}
          aria-label="Lonth ถัดไป"
          title="Lonth ถัดไป"
        >
          ›
        </button>
      </div>

      <div className="lonth-pill-strip" role="tablist" aria-label="14 Lonths">
        {yearLonths.map((lonth) => {
          const isActive = lonth.id === activeLonth.id;
          const isToday = isThisYear && lonth.id === todayLonth.id;
          const rangeLabel = formatLonthRange(lonth, language);

          return (
            <button
              key={lonth.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "date" : undefined}
              className={`lonth-pill${isActive ? " is-active" : ""}${isToday ? " is-today" : ""}${!lonth.isStandard28 ? " is-boundary" : ""}`}
              onClick={() => onSelectDate?.(lonth.startDate)}
              title={`${lonth.id}: ${rangeLabel} (${lonth.dayCount} วัน)`}
            >
              <span className="lonth-pill-id">{lonth.id}</span>
              {isToday && <span className="lonth-pill-dot" aria-label="Lonth ปัจจุบัน" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
