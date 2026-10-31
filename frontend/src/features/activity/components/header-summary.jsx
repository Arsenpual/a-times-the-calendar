import React, { useMemo } from "react";
import { activityDate, getYearCycle, getYearWeekRange } from "../../../shared/lib/date-utils.js";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import { calculateCycleSummary } from "./cycle-summary-panel.jsx";

export default function HeaderSummary({ period, onPeriodChange, date, activities, archivedActivityIds, connected, loading, categories, activityCategoryMap, weeklySummary, weeklyLoading, weeklyError, cycleAnchor, cycleData }) {
  const daily = useMemo(() => {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(start); end.setDate(end.getDate() + 1);
    let count = 0, minutes = 0;
    const categoryTotals = new Map();
    for (const activity of activities) {
      if (archivedActivityIds.has(activity.id) || archivedActivityIds.has(normalizeActivityId(activity.id))) continue;
      const from = activityDate(activity.start), to = activityDate(activity.end);
      if (!from || !to || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || from >= end || to <= start) continue;
      count += 1;
      const duration = !activity.start?.date || activity.start?.dateTime ? Math.max(0, Math.min(to.getTime(), end.getTime()) - Math.max(from.getTime(), start.getTime())) / 60000 : 0;
      minutes += duration;
      const categoryId = activityCategoryMap[normalizeActivityId(activity.id)] || activity.categoryId || null;
      const name = categories.find((category) => category.id === categoryId)?.name || "ไม่ระบุหมวดหมู่";
      categoryTotals.set(name, (categoryTotals.get(name) || 0) + duration);
    }
    return { count, minutes, categories: [...categoryTotals].sort((a, b) => b[1] - a[1]) };
  }, [activities, archivedActivityIds, date, activityCategoryMap, categories]);
  const cycle = getYearCycle(cycleAnchor);
  const cycleSummary = useMemo(() => calculateCycleSummary(cycle, cycleData.activities, categories, activityCategoryMap), [cycleAnchor, cycleData.activities, categories, activityCategoryMap]);
  const formatDate = (value) => value.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  const formatHours = (minutes) => (minutes / 60).toLocaleString("th-TH", { maximumFractionDigits: 1 });
  const [weekStart, weekEnd] = getYearWeekRange(date);
  const range = period === "day" ? date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : period === "week" ? `${formatDate(weekStart)} – ${formatDate(weekEnd)}` : `${formatDate(cycle.start)} – ${formatDate(cycle.end)}`;
  const busy = period === "day" ? loading : period === "week" ? weeklyLoading : cycleData.loading;
  const error = period === "week" ? weeklyError : period === "cycle" ? cycleData.error : "";
  const stats = period === "day"
    ? [{ value: daily.count, label: "กิจกรรม" }, { value: formatHours(daily.minutes), label: "ชั่วโมงรวม" }, { value: daily.categories[0]?.[0] || "—", label: "หมวดหมู่หลัก" }]
    : period === "week"
      ? [{ value: weeklySummary?.totalActivities ?? 0, label: "กิจกรรม" }, { value: weeklySummary?.byCategory?.[0]?.name || "—", label: "หมวดหมู่หลัก" }, { value: weeklySummary?.busiestDay?.day || "—", label: "วันที่ยุ่งที่สุด" }]
      : [{ value: cycleSummary.totalActivities, label: "กิจกรรม" }, { value: formatHours(cycleSummary.totalMinutes), label: "ชั่วโมงรวม" }, { value: cycleSummary.activeDays, label: "วันที่มีกิจกรรม" }];

  return <section className="header-summary" aria-label="สรุปกิจกรรม">
    <div className="header-summary-top">
      <div className="header-summary-heading"><strong>สรุปกิจกรรม</strong><span>{range}</span></div>
      <div className="header-summary-tabs" role="group" aria-label="ช่วงเวลาสรุป">
        {[["day", "วัน"], ["week", "สัปดาห์"], ["cycle", "Cycle"]].map(([value, label]) => <button type="button" key={value} className={period === value ? "is-active" : ""} aria-pressed={period === value} onClick={() => onPeriodChange(value)}>{label}</button>)}
      </div>
    </div>
    <div className="header-summary-content" aria-live="polite">
      {!connected ? <p>กรุณาเชื่อมต่อ Google Calendar เพื่อดูสรุป</p> : busy ? <p>กำลังโหลดสรุป…</p> : error ? <p role="alert">{error}</p> : <div className="header-summary-stats">{stats.map((stat) => <div key={stat.label}><strong title={String(stat.value)}>{stat.value}</strong><span>{stat.label}</span></div>)}</div>}
    </div>
  </section>;
}
