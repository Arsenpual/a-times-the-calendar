import React, { useMemo } from "react";
import { activityDate } from "../../../shared/lib/date-utils.js";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import { UNCATEGORIZED_COLOR } from "../lib/activity-colors.js";

const hours = (minutes) => (minutes / 60).toLocaleString("th-TH", { maximumFractionDigits: 1 });

export default function ActivitySummaryHero({ days, visibleStart, visibleEnd, activities, categories, activityCategoryMap, onSelectDay, weekName, loading = false }) {
  const data = useMemo(() => {
    const daily = days.map((date) => ({ date, minutes: 0, count: 0 }));
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
      const row = byCategory.get(key) || { key, name: category?.name || UNCATEGORIZED_COLOR.name, color: category?.color || UNCATEGORIZED_COLOR.border, minutes: 0, count: 0 };
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
        day.minutes += minutes;
        row.minutes += minutes;
        totalMinutes += minutes;
        day.count += 1;
      }
      if (visible) {
        count += 1;
        row.count += 1;
        byCategory.set(key, row);
      }
    }
    return { daily, categories: [...byCategory.values()].sort((a, b) => b.minutes - a.minutes), count, totalMinutes };
  }, [activities, categories, activityCategoryMap, days, visibleStart, visibleEnd]);
  const maxMinutes = Math.max(60, ...data.daily.map((day) => day.minutes));
  const topCategory = data.categories[0];
  const dateLabel = `${visibleStart.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} – ${visibleEnd.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`;

  if (loading) return <section className="activity-summary-hero" aria-label="สรุป 7 วัน" aria-busy="true"><div className="activity-summary-hero-main"><div><h2>สรุป 7 วัน</h2><p>{dateLabel}</p>{weekName}</div><p role="status">กำลังโหลดกิจกรรม…</p></div></section>;

  return <section className="activity-summary-hero" aria-label="สรุป 7 วัน">
    <div className="activity-summary-hero-main">
      <div><h2>สรุป 7 วัน</h2><p>{dateLabel}</p>{weekName}</div>
      <div className="activity-summary-hero-stats">
        <div><strong>{data.count}</strong><span>กิจกรรม</span></div>
        <div><strong>{hours(data.totalMinutes)}</strong><span>ชั่วโมงรวม</span></div>
        <div><strong className="is-accent">{topCategory ? hours(topCategory.minutes) : "0"}</strong><span>{topCategory?.name || "หมวดหมู่หลัก"}</span></div>
      </div>
    </div>
    <div className="activity-summary-hero-categories">
      <h3>เวลาแยกตามหมวดหมู่</h3>
      <div className="activity-summary-hero-stack" aria-label="สัดส่วนเวลาตามหมวดหมู่">
        {data.categories.filter((item) => item.minutes > 0).map((item) => <span key={item.key} style={{ flexGrow: item.minutes, background: item.color }} title={`${item.name} ${hours(item.minutes)} ชั่วโมง`} />)}
      </div>
      <div className="activity-summary-hero-legend">
        {data.categories.map((item) => <div key={item.key}><i style={{ background: item.color }} /><span>{item.name}</span><small>{item.count} กิจกรรม</small><b>{hours(item.minutes)} ชม.</b></div>)}
        {data.categories.length === 0 && <p>ยังไม่มีกิจกรรมในช่วงนี้</p>}
      </div>
    </div>
    <div className="activity-summary-hero-days">
      <h3>ภาระงานรายวัน <small>ชั่วโมงต่อวัน</small></h3>
      <div className="activity-summary-hero-bars">
        {data.daily.map((day) => <button key={day.date.toISOString()} type="button" disabled={day.date < visibleStart || day.date > visibleEnd} onClick={() => onSelectDay?.(day.date)} aria-label={`${day.date.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short" })}: ${day.count} กิจกรรม, ${hours(day.minutes)} ชั่วโมง`}>
          <span>{hours(day.minutes)}</span><i style={{ height: `${Math.max(4, day.minutes / maxMinutes * 78)}px` }} /><small>{day.date.toLocaleDateString("th-TH", { weekday: "short" })}</small>
        </button>)}
      </div>
    </div>
  </section>;
}
