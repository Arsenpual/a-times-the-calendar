import React, { useMemo, useState } from "react";
import { activityDate, getWeekRange, toDateInputValue } from "../../../shared/lib/date-utils.js";
import { useLanguage } from "../../../shared/i18n/i18n.jsx";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import { getDisplayColor, UNCATEGORIZED_COLOR } from "../lib/activity-colors.js";

const CHART_WIDTH = 1_000;
const CHART_HEIGHT = 250;

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

function areaPath(upper, lower, maxMinutes) {
  const x = (index) => (index / 6) * CHART_WIDTH;
  const y = (minutes) => CHART_HEIGHT - (minutes / Math.max(1, maxMinutes)) * CHART_HEIGHT;
  const top = upper.map((value, index) => `${index ? "L" : "M"}${x(index)} ${y(value)}`).join(" ");
  const bottom = [...lower].reverse().map((value, index) => `L${x(6 - index)} ${y(value)}`).join(" ");
  return `${top} ${bottom} Z`;
}

/**
 * Full-width weekly time-composition view. It deliberately summarizes real
 * activity durations by category instead of duplicating the editable Week
 * Spine. Selecting a day opens the existing per-day activity panel.
 */
export default function ActivityTimeStreamgraph({ anchorDate, activities = [], categories = [], activityCategoryMap = {}, onSelectDay }) {
  const { language } = useLanguage();
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const model = useMemo(() => {
    const [weekStart] = getWeekRange(anchorDate instanceof Date ? anchorDate : new Date());
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return date;
    });
    const categoryRows = new Map();

    for (const activity of activities) {
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
          minutes: Array(7).fill(0)
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
    const maxMinutes = Math.max(60, ...totals);
    let lower = Array(7).fill(0);
    const streams = rows.map((row) => {
      const upper = row.minutes.map((value, index) => lower[index] + value);
      const stream = { ...row, lower, upper, path: areaPath(upper, lower, maxMinutes) };
      lower = upper;
      return stream;
    });
    return { days, rows, streams, totals, maxMinutes };
  }, [anchorDate, activities, activityCategoryMap, categories]);

  const safeActiveIndex = Math.min(Math.max(activeDayIndex, 0), model.days.length - 1);
  const activeDay = model.days[safeActiveIndex];
  const activeRows = model.rows.filter((row) => row.minutes[safeActiveIndex] > 0);
  const formatter = new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { weekday: "short", day: "numeric", month: "short" });
  const totalMinutes = model.totals.reduce((sum, value) => sum + value, 0);
  const largestCategory = model.rows[0] || null;

  return <section className="activity-time-streamgraph" aria-label="ภาพรวมเวลาตามหมวดหมู่รายสัปดาห์">
    <header className="activity-time-streamgraph-header">
      <div>
        <p>WEEKLY TIME FLOW</p>
        <h3>{language === "th" ? "ภาพรวมเวลาตามหมวดหมู่" : "Time by category"}</h3>
      </div>
      <small>{language === "th" ? "เลือกวันเพื่อดูรายการกิจกรรม" : "Select a day to inspect activities"}</small>
    </header>

    {model.rows.length === 0 ? <p className="activity-time-streamgraph-empty">ยังไม่มีกิจกรรมที่ระบุเวลาในสัปดาห์นี้</p> : <>
      <div className="activity-time-streamgraph-chart" role="group" aria-label="กราฟเวลาแต่ละวัน">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
          {model.streams.map((stream) => <path key={stream.id} d={stream.path} fill={stream.color} opacity="0.86" />)}
        </svg>
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
