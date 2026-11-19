import React from "react";

const MONTH_SHORT_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTH_SHORT_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Bottom navigation strip for standard Month view:
 * Allows quick selection of Month (1–12) and Year.
 */
export default function MonthNavBar({
  activeDate,
  onNavigate,
  onSelectDate,
  language = "th"
}) {
  const anchor = activeDate instanceof Date ? activeDate : new Date(activeDate || Date.now());
  const activeYear = anchor.getFullYear();
  const activeMonth = anchor.getMonth();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const monthLabels = language === "th" ? MONTH_SHORT_TH : MONTH_SHORT_EN;

  const yearOptions = Array.from({ length: 11 }, (_, idx) => activeYear - 5 + idx);
  const activeMonthTitle = anchor.toLocaleDateString(language === "th" ? "th-TH-u-ca-gregory" : "en-US", {
    month: "long",
    year: "numeric"
  });

  const selectMonth = (monthIndex) => {
    onSelectDate?.(new Date(activeYear, monthIndex, 1));
  };

  const selectYear = (year) => {
    onSelectDate?.(new Date(year, activeMonth, 1));
  };

  return (
    <div className="lonth-nav-bar month-nav-bar" aria-label="แถบนำทางเดือนและปี">
      <div className="lonth-nav-controls">
        <button
          type="button"
          className="lonth-nav-arrow"
          onClick={() => onNavigate?.(-1)}
          aria-label="เดือนก่อนหน้า"
          title="เดือนก่อนหน้า"
        >
          ‹
        </button>

        <div className="lonth-nav-current-badge">
          <strong>{activeMonthTitle}</strong>
        </div>

        <button
          type="button"
          className="lonth-nav-arrow"
          onClick={() => onNavigate?.(1)}
          aria-label="เดือนถัดไป"
          title="เดือนถัดไป"
        >
          ›
        </button>

        <div className="month-nav-year-picker" role="group" aria-label="เลือกปี">
          <button
            type="button"
            className="lonth-nav-arrow"
            onClick={() => selectYear(activeYear - 1)}
            aria-label="ปีก่อนหน้า"
            title="ปีก่อนหน้า"
          >
            «
          </button>
          <select
            className="month-nav-year-select"
            value={activeYear}
            onChange={(event) => selectYear(Number(event.target.value))}
            aria-label="เลือกปี"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="lonth-nav-arrow"
            onClick={() => selectYear(activeYear + 1)}
            aria-label="ปีถัดไป"
            title="ปีถัดไป"
          >
            »
          </button>
        </div>

        <button
          type="button"
          className="lonth-pill month-nav-today-btn"
          onClick={() => onSelectDate?.(new Date(currentYear, currentMonth, 1))}
          title="ไปยังเดือนปัจจุบัน"
        >
          วันนี้
        </button>
      </div>

      <div className="lonth-pill-strip" role="tablist" aria-label="เลือกเดือนทั้ง 12 เดือน">
        {monthLabels.map((label, monthIndex) => {
          const isActive = monthIndex === activeMonth;
          const isTodayMonth = activeYear === currentYear && monthIndex === currentMonth;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`lonth-pill${isActive ? " is-active" : ""}${isTodayMonth ? " is-today" : ""}`}
              onClick={() => selectMonth(monthIndex)}
              title={`${label} ${activeYear}`}
            >
              {label}
              {isTodayMonth && <span className="lonth-pill-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
