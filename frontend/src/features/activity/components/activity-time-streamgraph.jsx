import React, { useEffect, useMemo, useRef, useState } from "react";
import { activityDate, getYearWeekRange, getYearCycle } from "../../../shared/lib/date-utils.js";
import { useLanguage } from "../../../shared/i18n/i18n.jsx";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import { getDisplayColor, UNCATEGORIZED_COLOR } from "../lib/activity-colors.js";

function startOfDay(day) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfDay(day) {
  const end = startOfDay(day);
  end.setDate(end.getDate() + 1);
  return end;
}

function minutesBetween(start, end) {
  return Math.max(0, Math.round((end - start) / 60_000));
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ""}` : `${remainingMinutes}m`;
}

/**
 * One stacked bar represents the selected week or cycle. Every coloured
 * section is a category and its proportional duration, answering only which
 * categories exist and how much time they received.
 */
export default function ActivityTimeStreamgraph({
  anchorDate, cycleAnchorDate, activities = [], cycleActivities = [], cycleLoading = false,
  categories = [], activityCategoryMap = {}, range = "week", onRangeChange
}) {
  const { language } = useLanguage();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef = useRef(null);

  const model = useMemo(() => {
    const safeAnchor = anchorDate instanceof Date ? anchorDate : new Date();
    const cycle = getYearCycle(cycleAnchorDate instanceof Date ? cycleAnchorDate : safeAnchor);
    const [weekStart, weekEnd] = getYearWeekRange(safeAnchor);
    const rangeStart = range === "cycle" ? startOfDay(cycle.start) : startOfDay(weekStart);
    const rangeEnd = range === "cycle" ? endOfDay(cycle.end) : endOfDay(weekEnd);
    const sourceActivities = range === "cycle" ? cycleActivities : activities;
    const categoryRows = new Map();

    for (const activity of sourceActivities) {
      const start = activityDate(activity.start);
      const end = activityDate(activity.end);
      if (!activity.start?.dateTime || !start || !end || end <= start) continue;
      const clippedStart = new Date(Math.max(start.getTime(), rangeStart.getTime()));
      const clippedEnd = new Date(Math.min(end.getTime(), rangeEnd.getTime()));
      const minutes = minutesBetween(clippedStart, clippedEnd);
      if (!minutes) continue;

      const categoryId = activityCategoryMap[normalizeActivityId(activity.id)] || activity.categoryId;
      const category = categories.find((item) => item.id === categoryId);
      const display = getDisplayColor(activity, activityCategoryMap, categories);
      const key = category?.id || "uncategorized";
      if (!categoryRows.has(key)) {
        categoryRows.set(key, { id: key, name: category?.name || UNCATEGORIZED_COLOR.name, color: display.border, minutes: 0 });
      }
      categoryRows.get(key).minutes += minutes;
    }

    const rows = [...categoryRows.values()]
      .filter((row) => row.minutes > 0)
      .sort((left, right) => right.minutes - left.minutes);
    return { cycle, rows, totalMinutes: rows.reduce((sum, row) => sum + row.minutes, 0) };
  }, [anchorDate, activities, activityCategoryMap, categories, cycleActivities, cycleAnchorDate, range]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === chartRef.current?.closest(".activity-time-streamgraph"));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    const section = chartRef.current?.closest(".activity-time-streamgraph");
    if (!section) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await section.requestFullscreen();
  };

  const isCycle = range === "cycle";
  const title = isCycle
    ? (language === "th" ? `สัดส่วนเวลา Cycle ${model.cycle.cycleNumber}/${model.cycle.totalCycles}` : `Cycle ${model.cycle.cycleNumber}/${model.cycle.totalCycles} time split`)
    : (language === "th" ? "ชั่วโมงสะสมตามหมวดหมู่" : "Accumulated hours by category");

  return <section className={`activity-time-streamgraph activity-time-category-bars ${isCycle ? "is-cycle" : "is-week"}`} aria-label="ชั่วโมงสะสมตามหมวดหมู่">
    <header className="activity-time-streamgraph-header">
      <div>
        <p>{isCycle ? "CYCLE CATEGORY TOTALS" : "WEEKLY CATEGORY TOTALS"}</p>
        <h3>{title}</h3>
      </div>
      <div className="activity-time-streamgraph-controls">
        <div role="group" aria-label="ช่วงเวลาของกราฟ">
          <button type="button" className={!isCycle ? "is-active" : ""} onClick={() => onRangeChange?.("week")}>7 วัน</button>
          <button type="button" className={isCycle ? "is-active" : ""} onClick={() => onRangeChange?.("cycle")}>Cycle</button>
        </div>
        <button type="button" className="activity-time-streamgraph-fullscreen" onClick={toggleFullscreen} aria-label={isFullscreen ? "ออกจากโหมดเต็มจอ" : "ดูกราฟเต็มจอ"}>{isFullscreen ? "×" : "⛶"}</button>
      </div>
    </header>

    {isCycle && cycleLoading ? <p className="activity-time-streamgraph-empty">กำลังรวบรวมกิจกรรมใน Cycle…</p> : model.rows.length === 0 ? <p className="activity-time-streamgraph-empty">ยังไม่มีกิจกรรมที่ระบุเวลาใน{isCycle ? " Cycle นี้" : "สัปดาห์นี้"}</p> : <>
      <div className="activity-time-category-bars-summary" ref={chartRef}>
        <strong>{language === "th" ? "เวลารวม" : "Total time"}<b>{formatMinutes(model.totalMinutes)}</b></strong>
        <div className="activity-time-category-bars-track" role="img" aria-label={`${language === "th" ? "เวลารวม" : "Total time"} ${formatMinutes(model.totalMinutes)}`}>
          {model.rows.map((row) => {
            const percent = (row.minutes / model.totalMinutes) * 100;
            return <span key={row.id} className="activity-time-category-bars-segment" style={{ "--category-color": row.color, "--category-share": `${percent}%` }} title={`${row.name} · ${formatMinutes(row.minutes)} · ${percent.toFixed(percent < 10 ? 1 : 0)}%`} />;
          })}
        </div>
      </div>

      <div className="activity-time-category-bars-legend" aria-label="รายละเอียดเวลาตามหมวดหมู่">
        {model.rows.map((row) => {
          const percent = (row.minutes / model.totalMinutes) * 100;
          return <div key={row.id} className="activity-time-category-bars-row">
            <i style={{ backgroundColor: row.color }} />
            <span>{row.name}</span>
            <b>{formatMinutes(row.minutes)}</b>
            <small>{percent.toFixed(percent < 10 ? 1 : 0)}%</small>
          </div>;
        })}
      </div>
    </>}
  </section>;
}
