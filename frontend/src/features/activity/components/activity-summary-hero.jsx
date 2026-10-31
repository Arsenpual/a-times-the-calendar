import React, { useMemo } from "react";
import { activityDate } from "../../../shared/lib/date-utils.js";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import { UNCATEGORIZED_COLOR } from "../lib/activity-colors.js";

const hours = (minutes) => (minutes / 60).toLocaleString("th-TH", { maximumFractionDigits: 1 });

export default function ActivitySummaryHero({ days, visibleStart, visibleEnd, activities, categories, activityCategoryMap, weekName, header, loading = false }) {
  const data = useMemo(() => {
    const daily = days.map((date) => ({ date }));
    const byCategory = new Map();
    let count = 0;
    let totalMinutes = 0;
    for (const activity of activities) {
      const from = activityDate(activity.start);
      const to = activityDate(activity.end);
      if (!from || !to || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) continue;
      const isAllDay = Boolean(activity.start?.date && !activity.start?.dateTime);
      const categoryId = activityCategoryMap[normalizeActivityId(activity.id)] || activity.categoryId || null;
      const category = categories.find((item) => item.id === categoryId);
      const key = category?.id || "uncategorized";
      const row = byCategory.get(key) || { key, name: category?.name || UNCATEGORIZED_COLOR.name, minutes: 0 };
      let visible = false;
      for (const day of daily) {
        if (day.date < visibleStart || day.date > visibleEnd) continue;
        const next = new Date(day.date);
        next.setDate(next.getDate() + 1);
        const overlap = Math.max(0, Math.min(to.getTime(), next.getTime()) - Math.max(from.getTime(), day.date.getTime()));
        if (!overlap) continue;
        visible = true;
        // All-day items count as activities but do not claim 24 hours of focused work.
        const minutes = isAllDay ? 0 : overlap / 60000;
        row.minutes += minutes;
        totalMinutes += minutes;
      }
      if (visible) {
        count += 1;
        byCategory.set(key, row);
      }
    }
    return { categories: [...byCategory.values()].sort((a, b) => b.minutes - a.minutes), count, totalMinutes };
  }, [activities, categories, activityCategoryMap, days, visibleStart, visibleEnd]);
  const topCategory = data.categories[0];
  const dateLabel = `${visibleStart.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} – ${visibleEnd.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`;

  if (loading) return <section className="activity-summary-hero" aria-label="สรุป 7 วัน" aria-busy="true">{header && <div className="activity-summary-hero-header">{header}</div>}<div className="activity-summary-hero-main"><div><h2>สรุป 7 วัน</h2><p>{dateLabel}</p>{weekName}</div><p role="status">กำลังโหลดกิจกรรม…</p></div></section>;

  return <section className="activity-summary-hero" aria-label="สรุป 7 วัน">
    {header && <div className="activity-summary-hero-header">{header}</div>}
    <div className="activity-summary-hero-main">
      <div><h2>สรุป 7 วัน</h2><p>{dateLabel}</p>{weekName}</div>
      <div className="activity-summary-hero-stats">
        <div><strong>{data.count}</strong><span>กิจกรรม</span></div>
        <div><strong>{hours(data.totalMinutes)}</strong><span>ชั่วโมงรวม</span></div>
        <div><strong className="is-accent">{topCategory ? hours(topCategory.minutes) : "0"}</strong><span>{topCategory?.name || "หมวดหมู่หลัก"}</span></div>
      </div>
    </div>
  </section>;
}
