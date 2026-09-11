import React, { useEffect, useMemo, useRef, useState } from "react";
import { activityDate, formatWeekRange, getYearCycle } from "../../../shared/lib/date-utils.js";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import { UNCATEGORIZED_COLOR } from "../lib/activity-colors.js";

function formatHours(minutes) {
  if (minutes < 60) return `${minutes} นาที`;
  const hours = minutes / 60;
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)} ชม.`;
}

function formatCategoryPercent(percent) {
  if (!Number.isFinite(percent) || percent <= 0) return "0%";
  // Keep the normal compact whole-number display for meaningful shares, but
  // never round a real, tiny category down to 0%. Two decimals make it clear
  // that the category exists; the floor prevents values below 0.005% from
  // becoming the misleading "0.00%".
  if (percent < 1) return `${Math.max(0.01, Number(percent.toFixed(2))).toFixed(2)}%`;
  return `${Math.round(percent)}%`;
}

function colorFor(categoryId, categories) {
  if (!categoryId) return UNCATEGORIZED_COLOR.border;
  return categories.find((category) => category.id === categoryId)?.color || UNCATEGORIZED_COLOR.border;
}

function SlowOverflowText({ children }) {
  const textRef = useRef(null);
  const [overflowDistance, setOverflowDistance] = useState(0);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;
    const measure = () => setOverflowDistance(Math.max(0, element.scrollWidth - element.clientWidth));
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [children]);

  return <strong ref={textRef} className={`cycle-summary-stat-value${overflowDistance ? " is-overflowing" : ""}`} title={String(children)}>
    <span style={overflowDistance ? { "--cycle-stat-scroll-distance": `${overflowDistance}px` } : undefined}>{children}</span>
  </strong>;
}

/**
 * The four-week counterpart to WeeklySummaryPanel. It is intentionally
 * calculated in the browser from the exact activities rendered in Cycle,
 * avoiding a second summary endpoint and keeping its totals in lockstep with
 * the coloured tabs in the four-week view.
 */
export default function CycleSummaryPanel({
  anchorDate,
  activities = [],
  loading,
  error,
  categories = [],
  activityCategoryMap = {},
  onSelectWeek,
  onSelectDay
}) {
  const cycle = getYearCycle(anchorDate);
  const cycleStart = cycle.start;
  const cycleEnd = cycle.end;

  const summary = useMemo(() => {
    const weeks = Array.from({ length: cycle.weekCount }, (_, index) => {
      const start = new Date(cycleStart);
      start.setDate(start.getDate() + index * 7);
      return { start, count: 0, minutes: 0 };
    });
    const categoryStats = new Map();
    const dayStats = new Map();
    let totalMinutes = 0;
    let totalActivities = 0;

    activities.forEach((activity) => {
      const start = activityDate(activity.start);
      const end = activityDate(activity.end);
      if (!start || !end || start < cycleStart || start > cycleEnd) return;

      const minutes = Math.max(0, Math.round((end - start) / 60000)) || 30;
      const categoryId = activityCategoryMap[normalizeActivityId(activity.id)] || null;
      const previous = categoryStats.get(categoryId) || { categoryId, minutes: 0, count: 0 };
      previous.minutes += minutes;
      previous.count += 1;
      categoryStats.set(categoryId, previous);

      const weekIndex = Math.min(cycle.weekCount - 1, Math.max(0, Math.floor((start - cycleStart) / (7 * 24 * 60 * 60 * 1000))));
      weeks[weekIndex].count += 1;
      weeks[weekIndex].minutes += minutes;

      const dayKey = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      const day = dayStats.get(dayKey) || { date: new Date(start), count: 0 };
      day.count += 1;
      dayStats.set(dayKey, day);
      totalActivities += 1;
      totalMinutes += minutes;
    });

    const byCategory = [...categoryStats.values()]
      .map((item) => ({
        ...item,
        name: item.categoryId ? categories.find((category) => category.id === item.categoryId)?.name || "ไม่ระบุหมวดหมู่" : "ไม่ระบุหมวดหมู่",
        percent: totalMinutes ? (item.minutes / totalMinutes) * 100 : 0
      }))
      .sort((left, right) => right.minutes - left.minutes);
    const busiestDay = [...dayStats.values()].sort((left, right) => right.count - left.count)[0] || null;
    return { weeks, byCategory, busiestDay, totalActivities, totalMinutes, activeDays: dayStats.size };
  }, [activities, activityCategoryMap, categories, cycleStart, cycleEnd, cycle.weekCount]);

  return <aside className="summary-panel cycle-summary-panel">
    <p className="summary-label">สรุป Cycle · 4 สัปดาห์</p>
    <p className="cycle-summary-range">{formatWeekRange(cycleStart)} – {formatWeekRange(new Date(cycleEnd))}</p>
    {loading && <p className="summary-loading">กำลังคำนวณ Cycle...</p>}
    {error && <p className="summary-error">{error}</p>}
    {!loading && !error && <>
      <div className="cycle-summary-stats">
        <div><SlowOverflowText>{summary.totalActivities}</SlowOverflowText><span>กิจกรรม</span></div>
        <div><SlowOverflowText>{formatHours(summary.totalMinutes)}</SlowOverflowText><span>เวลาที่วางแผน</span></div>
        <div><SlowOverflowText>{summary.activeDays}</SlowOverflowText><span>วันที่มีกิจกรรม</span></div>
      </div>

      <section className="cycle-summary-weeks" aria-label="สรุปรายสัปดาห์ใน Cycle">
        <p className="summary-breakdown-label">ภาพรวมแต่ละสัปดาห์</p>
        <div>{summary.weeks.map((week, index) => <button type="button" key={week.start.toISOString()} onClick={() => onSelectWeek?.(week.start)}>
          <span>สัปดาห์ {index + 1}</span><strong>{week.count}</strong><small>{formatHours(week.minutes)}</small>
        </button>)}</div>
      </section>

      {summary.byCategory.length > 0 && <section className="cycle-summary-categories">
        <p className="summary-breakdown-label">สัดส่วนตามหมวดหมู่</p>
        {summary.byCategory.map((category) => <div className="cycle-summary-category" key={category.categoryId || "uncategorized"}>
          <span className="summary-dot" style={{ background: colorFor(category.categoryId, categories) }} />
          <span>{category.name}</span><strong>{formatCategoryPercent(category.percent)}</strong><small>{formatHours(category.minutes)}</small>
        </div>)}
      </section>}

      {summary.busiestDay && <button type="button" className="summary-busiest-btn" onClick={() => onSelectDay?.(summary.busiestDay.date)}>
        วันยุ่งที่สุด · {summary.busiestDay.date.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short" })}
        <strong>{summary.busiestDay.count} กิจกรรม</strong><span className="summary-busiest-arrow">→</span>
      </button>}
    </>}
  </aside>;
}
