import React, { useMemo } from "react";
import { activityDate } from "../../../shared/lib/date-utils.js";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";

const formatMinutes = value => `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, "0")}`;

export default function ActivitySummaryHero({ visibleStart, visibleEnd, activities = [], activityCategoryMap = {}, weekName, header, loading = false, period = "week", error = "" }) {
  const overview = useMemo(() => {
    const start = new Date(visibleStart); start.setHours(0, 0, 0, 0);
    const end = new Date(visibleEnd); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 1);
    const ranges = [], ids = new Set(), categoryIds = new Set();
    for (const activity of activities) {
      const from = activityDate(activity.start), to = activityDate(activity.end);
      if (!from || !to || !Number.isFinite(+from) || !Number.isFinite(+to) || to <= from || from >= end || to <= start) continue;
      ids.add(activity.id);
      const category = activityCategoryMap[normalizeActivityId(activity.id)] || activity.categoryId;
      if (category) categoryIds.add(category);
      if (!activity.start?.date || activity.start?.dateTime) ranges.push([Math.max(+start, +from), Math.min(+end, +to)]);
    }
    ranges.sort((a, b) => a[0] - b[0]);
    let occupied = 0, lastEnd = +start;
    for (const [from, to] of ranges) { occupied += Math.max(0, to - Math.max(from, lastEnd)); lastEnd = Math.max(lastEnd, to); }
    const total = Math.round((end - start) / 60000), scheduled = Math.round(occupied / 60000);
    return { days: Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000), total, scheduled, free: Math.max(0, total - scheduled), count: ids.size, categories: categoryIds.size };
  }, [activities, activityCategoryMap, visibleStart, visibleEnd]);
  return <section className={`activity-summary-hero${period === "cycle" ? " is-cycle" : ""}`} aria-label={period === "cycle" ? "สรุป Cycle" : "สรุป 7 วัน"} aria-busy={loading || undefined}>
    <div className="activity-summary-hero-header">{header}{weekName && <div className="activity-summary-week-info">{weekName}</div>}</div>
    <div className="activity-summary-hero-main">
      <section className="weekly-overview" aria-label={period === "cycle" ? "ภาพรวม Cycle" : "ภาพรวมสัปดาห์"}>
        {loading ? <p role="status">กำลังโหลดกิจกรรม…</p> : error ? <p role="alert">{error}</p> : <>
          <div className="weekly-overview-content">
          <div className="weekly-overview-total"><strong>{formatMinutes(overview.total)} h</strong><span>เวลาทั้งหมดในช่วงนี้</span></div>
          <div className="weekly-overview-grid">
            <div><strong>{formatMinutes(overview.scheduled)}</strong><span>เวลาที่วางแผน</span></div>
            <div><strong>{formatMinutes(overview.free)}</strong><span>เวลาที่ยังไม่ได้วางแผน</span></div>
            <div><strong>{overview.count}</strong><span>จำนวนกิจกรรม</span></div>
            <div><strong>{overview.categories}</strong><span>หมวดหมู่ที่ใช้</span></div>
          </div>
          </div>
        </>}
      </section>
    </div>
  </section>;
}
