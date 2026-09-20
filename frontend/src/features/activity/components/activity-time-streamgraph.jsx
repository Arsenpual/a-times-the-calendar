import React, { useEffect, useMemo, useRef, useState } from "react";
import { activityDate, getWeekRange, getYearCycle, toDateInputValue } from "../../../shared/lib/date-utils.js";
import { useLanguage } from "../../../shared/i18n/i18n.jsx";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import { getDisplayColor, UNCATEGORIZED_COLOR } from "../lib/activity-colors.js";

const CHART_WIDTH = 1_000;
const CHART_HEIGHT = 250;
// A compact overview scale. Precise values remain available through the
// crosshair, so the chart does not need a tall row for every single hour.
const PIXELS_PER_HOUR = 3;
const PLOT_LEFT = 52;
const PLOT_RIGHT = 16;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 26;

function startOfDay(day) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  return start;
}

function minutesBetween(start, end) {
  return Math.max(0, Math.round((end - start) / 60_000));
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ""}` : `${remainingMinutes}m`;
}

function formatAxisHours(minutes, language) {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return language === "th" ? `${hours} ชม.` : `${hours}h`;
}

function chartX(index, count) {
  // Every day owns one equal-width cell; plot at the centre of that cell so
  // the line, day label and pointer target always share the same rhythm.
  return PLOT_LEFT + ((index + 0.5) / Math.max(1, count)) * (CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT);
}

function chartY(minutes, maxMinutes, chartHeight) {
  return chartHeight - PLOT_BOTTOM - (minutes / Math.max(1, maxMinutes)) * (chartHeight - PLOT_TOP - PLOT_BOTTOM);
}

function linePath(values, maxMinutes, chartHeight) {
  return values.map((value, index) => `${index ? "L" : "M"}${chartX(index, values.length)} ${chartY(value, maxMinutes, chartHeight)}`).join(" ");
}

/**
 * Full-width cumulative time view. Each category is a thin line whose Y
 * position is its accumulated hours; lines can cross naturally as a person's
 * time distribution changes. Selecting a day opens the usual activity panel.
 */
export default function ActivityTimeStreamgraph({
  anchorDate, cycleAnchorDate, activities = [], cycleActivities = [], cycleLoading = false,
  categories = [], activityCategoryMap = {}, range = "week", onRangeChange, onSelectDay
}) {
  const { language } = useLanguage();
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [pointer, setPointer] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef = useRef(null);
  const model = useMemo(() => {
    const safeAnchor = anchorDate instanceof Date ? anchorDate : new Date();
    const cycle = getYearCycle(cycleAnchorDate instanceof Date ? cycleAnchorDate : safeAnchor);
    const [weekStart] = getWeekRange(safeAnchor);
    const rangeStart = range === "cycle" ? cycle.start : weekStart;
    const dayCount = range === "cycle"
      ? Math.max(1, Math.round((startOfDay(cycle.end) - startOfDay(cycle.start)) / 86_400_000) + 1)
      : 7;
    const sourceActivities = range === "cycle" ? cycleActivities : activities;
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(rangeStart);
      date.setDate(rangeStart.getDate() + index);
      return date;
    });
    const categoryRows = new Map();

    for (const activity of sourceActivities) {
      const start = activityDate(activity.start);
      const end = activityDate(activity.end);
      // All-day records represent availability rather than measured focused
      // time, so leave them out of this duration chart.
      if (!activity.start?.dateTime || !start || !end || end <= start) continue;
      const categoryId = activityCategoryMap[normalizeActivityId(activity.id)] || activity.categoryId;
      const category = categories.find((item) => item.id === categoryId);
      const display = getDisplayColor(activity, activityCategoryMap, categories);
      const key = category?.id || "uncategorized";
      if (!categoryRows.has(key)) {
        categoryRows.set(key, {
          id: key,
          name: category?.name || UNCATEGORIZED_COLOR.name,
          color: display.border,
          minutes: Array(dayCount).fill(0)
        });
      }
      const row = categoryRows.get(key);
      days.forEach((day, index) => {
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayStart.getDate() + 1);
        row.minutes[index] += minutesBetween(new Date(Math.max(start, dayStart)), new Date(Math.min(end, dayEnd)));
      });
    }

    const rows = [...categoryRows.values()]
      .filter((row) => row.minutes.some(Boolean))
      .sort((left, right) => right.minutes.reduce((sum, value) => sum + value, 0) - left.minutes.reduce((sum, value) => sum + value, 0));
    const totals = days.map((_, index) => rows.reduce((sum, row) => sum + row.minutes[index], 0));
    const streams = rows.map((row) => {
      let cumulative = 0;
      const accumulated = row.minutes.map((value) => {
        cumulative += value;
        return cumulative;
      });
      return { ...row, accumulated };
    });
    const maxAccumulatedMinutes = Math.max(60, ...streams.flatMap((stream) => stream.accumulated));
    return { days, rows, streams, totals, maxAccumulatedMinutes, cycle };
  }, [anchorDate, activities, activityCategoryMap, categories, cycleActivities, cycleAnchorDate, range]);

  const safeActiveIndex = Math.min(Math.max(activeDayIndex, 0), model.days.length - 1);
  const activeDay = model.days[safeActiveIndex];
  const activeRows = model.rows.filter((row) => row.minutes[safeActiveIndex] > 0);
  const formatter = new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { weekday: "short", day: "numeric", month: "short" });
  const totalMinutes = model.totals.reduce((sum, value) => sum + value, 0);
  const largestCategory = model.rows[0] || null;
  // Keep a fixed Y scale: growing accumulated time expands the chart instead
  // of compressing the data into the same small rectangle.
  const minimumScaleMinutes = Math.ceil((CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM) / PIXELS_PER_HOUR) * 60;
  const yScaleMinutes = Math.max(minimumScaleMinutes, Math.ceil(model.maxAccumulatedMinutes / 60) * 60);
  const chartHeight = Math.ceil((yScaleMinutes / 60) * PIXELS_PER_HOUR) + PLOT_TOP + PLOT_BOTTOM;
  // Keep the graph precise, but use fewer labelled/grid steps as the amount
  // grows so the Y axis remains scannable instead of listing every hour.
  const axisStepMinutes = yScaleMinutes <= 12 * 60 ? 2 * 60
    : yScaleMinutes <= 24 * 60 ? 4 * 60
      : yScaleMinutes <= 48 * 60 ? 6 * 60 : 12 * 60;
  const yTickMinutes = Array.from({ length: Math.floor(yScaleMinutes / axisStepMinutes) + 1 }, (_, index) => index * axisStepMinutes);
  if (yTickMinutes.at(-1) !== yScaleMinutes) yTickMinutes.push(yScaleMinutes);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === chartRef.current?.closest(".activity-time-streamgraph"));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const updatePointer = (event) => {
    const bounds = chartRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const xPercent = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const yPercent = Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
    const plotXPercent = Math.min(1, Math.max(0, (xPercent - (PLOT_LEFT / CHART_WIDTH) * 100) / ((CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT) / CHART_WIDTH * 100)));
    const plotYPercent = Math.min(1, Math.max(0, (yPercent - (PLOT_TOP / chartHeight) * 100) / ((chartHeight - PLOT_TOP - PLOT_BOTTOM) / chartHeight * 100)));
    const dayIndex = Math.min(model.days.length - 1, Math.max(0, Math.round(plotXPercent * (model.days.length - 1))));
    setActiveDayIndex(dayIndex);
    setPointer({
      xPercent, yPercent, dayIndex,
      tooltipXPercent: Math.min(88, Math.max(12, xPercent)),
      tooltipYPercent: Math.min(88, Math.max(26, yPercent)),
      accumulatedMinutes: (1 - plotYPercent) * yScaleMinutes
    });
  };

  const toggleFullscreen = async () => {
    const section = chartRef.current?.closest(".activity-time-streamgraph");
    if (!section) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await section.requestFullscreen();
  };

  const isCycle = range === "cycle";
  const title = isCycle
    ? (language === "th" ? `ภาพรวม Cycle ${model.cycle.cycleNumber}/${model.cycle.totalCycles}` : `Cycle ${model.cycle.cycleNumber}/${model.cycle.totalCycles} overview`)
    : (language === "th" ? "ภาพรวมเวลาตามหมวดหมู่" : "Time by category");

  return <section className={`activity-time-streamgraph ${isCycle ? "is-cycle" : "is-week"}`} aria-label="ภาพรวมเวลาตามหมวดหมู่">
    <header className="activity-time-streamgraph-header">
      <div>
        <p>{isCycle ? "CYCLE TIME FLOW" : "WEEKLY TIME FLOW"}</p>
        <h3>{title}</h3>
      </div>
      <div className="activity-time-streamgraph-controls">
        <div role="group" aria-label="ช่วงเวลาของกราฟ">
          <button type="button" className={!isCycle ? "is-active" : ""} onClick={() => onRangeChange?.("week")}>7 วัน</button>
          <button type="button" className={isCycle ? "is-active" : ""} onClick={() => onRangeChange?.("cycle")}>Cycle</button>
        </div>
        <small>{language === "th" ? "แกน Y = ชั่วโมงสะสม · เลือกวันเพื่อดูรายการ" : "Y axis = cumulative hours · Select a day to inspect"}</small>
        <button type="button" className="activity-time-streamgraph-fullscreen" onClick={toggleFullscreen} aria-label={isFullscreen ? "ออกจากโหมดเต็มจอ" : "ดูกราฟเต็มจอ"}>{isFullscreen ? "×" : "⛶"}</button>
      </div>
    </header>

    {isCycle && cycleLoading ? <p className="activity-time-streamgraph-empty">กำลังรวบรวมกิจกรรมใน Cycle…</p> : model.rows.length === 0 ? <p className="activity-time-streamgraph-empty">ยังไม่มีกิจกรรมที่ระบุเวลาใน{isCycle ? " Cycle นี้" : "สัปดาห์นี้"}</p> : <>
      <div className="activity-time-streamgraph-chart" ref={chartRef} style={{ "--streamgraph-chart-height": `${chartHeight}px` }} role="group" aria-label="กราฟเวลาแต่ละวัน" onMouseMove={updatePointer} onMouseLeave={() => setPointer(null)}>
        <svg viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`} preserveAspectRatio="none" aria-hidden="true">
          {yTickMinutes.map((minutes) => <g key={minutes}>
            <line className="activity-time-streamgraph-gridline" x1={PLOT_LEFT} x2={CHART_WIDTH - PLOT_RIGHT} y1={chartY(minutes, yScaleMinutes, chartHeight)} y2={chartY(minutes, yScaleMinutes, chartHeight)} />
            <text className="activity-time-streamgraph-y-label" x="4" y={chartY(minutes, yScaleMinutes, chartHeight) + 3}>{formatAxisHours(minutes, language)}</text>
          </g>)}
          {model.streams.map((stream) => <path key={stream.id} className="activity-time-streamgraph-line" d={linePath(stream.accumulated, yScaleMinutes, chartHeight)} stroke={stream.color} />)}
        </svg>
        {pointer && <>
          <i className="activity-time-streamgraph-crosshair activity-time-streamgraph-crosshair--vertical" style={{ left: `${pointer.xPercent}%` }} />
          <i className="activity-time-streamgraph-crosshair activity-time-streamgraph-crosshair--horizontal" style={{ top: `${pointer.yPercent}%` }} />
          <output className="activity-time-streamgraph-tooltip" style={{ left: `${pointer.tooltipXPercent}%`, top: `${pointer.tooltipYPercent}%` }}>
            <b>{formatter.format(model.days[pointer.dayIndex])}</b>
            <span>{language === "th" ? "สะสมประมาณ" : "Approx. accumulated"} {formatMinutes(Math.round(pointer.accumulatedMinutes))}</span>
            <span>{language === "th" ? "วันนี้" : "Day total"} {formatMinutes(model.totals[pointer.dayIndex])}</span>
          </output>
        </>}
        <div className="activity-time-streamgraph-hit-targets">
          {model.days.map((day, index) => <button
            key={toDateInputValue(day)}
            type="button"
            className={index === safeActiveIndex ? "is-active" : ""}
            aria-label={`${formatter.format(day)} · ${formatMinutes(model.totals[index])}`}
            onMouseEnter={() => setActiveDayIndex(index)}
            onFocus={() => setActiveDayIndex(index)}
            onClick={() => onSelectDay?.(day)}
          />)}
        </div>
      </div>

      <div className="activity-time-streamgraph-days" aria-hidden="true">
        {model.days.map((day, index) => <span className={index === safeActiveIndex ? "is-active" : ""} key={toDateInputValue(day)}>{formatter.format(day)}</span>)}
      </div>

      <section className="activity-time-streamgraph-detail" aria-live="polite">
        <strong>{formatter.format(activeDay)} · {formatMinutes(model.totals[safeActiveIndex])}</strong>
        <div>{activeRows.map((row) => <span key={row.id}><i style={{ backgroundColor: row.color }} />{row.name} <b>{formatMinutes(row.minutes[safeActiveIndex])}</b></span>)}</div>
      </section>

      <footer className="activity-time-streamgraph-footer">
        <span>{language === "th" ? "รวม" : "Total"} <b>{formatMinutes(totalMinutes)}</b></span>
        <span>{language === "th" ? "หมวดหลัก" : "Top category"} <b>{largestCategory?.name || "—"}</b></span>
        <div>{model.rows.map((row) => <span key={row.id}><i style={{ backgroundColor: row.color }} />{row.name}</span>)}</div>
      </footer>
    </>}
  </section>;
}
