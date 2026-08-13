import React from "react";
import { dateForWeekdayLabel, getWeekRange } from "../date-utils.js";
import { UNCATEGORIZED_COLOR } from "../activity-colors.js";

const WEEKDAY_FULL = {
  "อา": "อาทิตย์", "จ": "จันทร์", "อ": "อังคาร", "พ": "พุธ",
  "พฤ": "พฤหัสบดี", "ศ": "ศุกร์", "ส": "เสาร์"
};

const PIE_SIZE = 120;
const PIE_STROKE = 22;
const PIE_RADIUS = (PIE_SIZE - PIE_STROKE) / 2;
const PIE_CIRCUMFERENCE = 2 * Math.PI * PIE_RADIUS;

/**
 * The backend's /api/summary/week response includes each category's color
 * as a snapshot taken at request time — but the frontend's own `categories`
 * state (the same one ActivityMode/TimelineEditor read from) is the live
 * source of truth and can be edited (e.g. recoloring a category) without
 * necessarily re-triggering a summary refetch. To guarantee the donut
 * chart and legend always show the exact same color as everywhere else in
 * the app, resolve color from live `categories` by id here instead of
 * trusting `c.color` from the summary payload — the summary is only used
 * for `name`/`percent`/`minutes`, never color.
 */
function resolveCategoryColor(categoryId, categories) {
  if (!categoryId) return UNCATEGORIZED_COLOR.border;
  const category = categories.find((cat) => cat.id === categoryId);
  return category ? category.color : UNCATEGORIZED_COLOR.border;
}

/**
 * Renders the category breakdown as a ring/pie chart (SVG, stroke-based —
 * no charting library needed). Each category becomes one stroke segment
 * whose length is its percent share of the circle's circumference.
 */
function CategoryPieChart({ byCategory, categories }) {
  let offset = 0;
  return (
    <svg
      className="summary-pie"
      width={PIE_SIZE}
      height={PIE_SIZE}
      viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
      role="img"
      aria-label="สัดส่วนเวลาตามหมวดหมู่"
    >
      <circle
        cx={PIE_SIZE / 2}
        cy={PIE_SIZE / 2}
        r={PIE_RADIUS}
        fill="none"
        stroke="var(--border)"
        strokeWidth={PIE_STROKE}
      />
      {byCategory.map((c) => {
        const length = (c.percent / 100) * PIE_CIRCUMFERENCE;
        const segment = (
          <circle
            key={c.categoryId || "none"}
            cx={PIE_SIZE / 2}
            cy={PIE_SIZE / 2}
            r={PIE_RADIUS}
            fill="none"
            stroke={resolveCategoryColor(c.categoryId, categories)}
            strokeWidth={PIE_STROKE}
            strokeDasharray={`${length} ${PIE_CIRCUMFERENCE - length}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${PIE_SIZE / 2} ${PIE_SIZE / 2})`}
          />
        );
        offset += length;
        return segment;
      })}
    </svg>
  );
}

/**
 * Weekly stats card: totals, category breakdown (pie chart), insight, and a
 * shortcut to open the busiest day's timeline. Day selection otherwise
 * lives entirely on the ActivityMode side (see app.jsx) — this panel no
 * longer offers its own day strip, it only reads `expandedDate` to render
 * its busiest-day shortcut correctly.
 *
 * @param {(date: Date) => void} onSelectDay open a specific day's timeline (used by the busiest-day shortcut)
 * @param {Array<{id:string,color:string}>} categories live category list — used to resolve pie/legend colors instead of the backend summary's own (potentially stale) color snapshot
 */
export default function WeeklySummaryPanel({
  anchorDate,
  summary,
  loading,
  error,
  onSelectDay,
  categories
}) {
  const [weekStart] = getWeekRange(anchorDate);

  const openBusiestDay = () => {
    if (!summary?.busiestDay) return;
    const date = dateForWeekdayLabel(weekStart, summary.busiestDay.day);
    if (!date) return;
    onSelectDay?.(date);
  };

  return (
    <aside className="summary-panel">
      <p className="summary-label">สรุปสัปดาห์นี้</p>

      {loading && <p className="summary-loading">กำลังคำนวณ...</p>}
      {error && <p className="summary-error">{error}</p>}

      {summary && !loading && (
        <>
          <p className="summary-total">{summary.totalActivities} กิจกรรม</p>

          {summary.byCategory.length > 0 && (
            <div className="summary-breakdown">
              <p className="summary-breakdown-label">สัดส่วนตามหมวดหมู่</p>
              <div className="summary-pie-row">
                <CategoryPieChart byCategory={summary.byCategory} categories={categories} />
                <div className="summary-legend">
                  {summary.byCategory.map((c) => (
                    <div key={c.categoryId || "none"} className="summary-legend-item">
                      <span
                        className="summary-dot"
                        style={{ background: resolveCategoryColor(c.categoryId, categories) }}
                      />
                      {c.name} {c.percent}%
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {summary.insight && <div className="summary-insight">{summary.insight}</div>}

          {summary.busiestDay && (
            <div>
              <p className="summary-breakdown-label">วันที่ยุ่งที่สุด</p>
              <button className="summary-busiest-btn" onClick={openBusiestDay}>
                {WEEKDAY_FULL[summary.busiestDay.day] || summary.busiestDay.day} —{" "}
                {summary.busiestDay.count} กิจกรรม
                <span className="summary-busiest-arrow">→</span>
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
