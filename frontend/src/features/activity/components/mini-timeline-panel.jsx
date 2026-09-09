import React, { useEffect, useMemo, useState } from "react";
import { activityDate, formatTime, isSameDay } from "../../../shared/lib/date-utils.js";
import { getDisplayColor } from "../lib/activity-colors.js";
import { getIncomingSpillover, MAX_OVERLAP_STACKS } from "../lib/timeline-layout.js";
import { downloadDayTimelineImage } from "../lib/export-day-image.js";

const WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const WEEKDAY_FULL = { "อา": "อาทิตย์", "จ": "จันทร์", "อ": "อังคาร", "พ": "พุธ", "พฤ": "พฤหัสบดี", "ศ": "ศุกร์", "ส": "เสาร์" };
const DAY_MINUTES = 24 * 60;
const BRAID_HEIGHT = 384;
const BRAID_WIDTH = 220;
const BRAID_CENTER = BRAID_WIDTH / 2;
const BRAID_LANE_OFFSET = 30;

function minutesFromDayStart(date, day) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  return Math.max(0, Math.min(DAY_MINUTES, Math.round((date - start) / 60000)));
}

function braidPath(startMinutes, endMinutes, targetOffset) {
  // Match the mockup's filled ribbon, easing, width and four-minute samples.
  // Only the vertical time scale changes to fit the complete day in this panel.
  const duration = endMinutes - startMinutes;
  if (duration <= 0) return "";
  const width = Math.min(15, 6 + duration / 30);
  const taper = Math.min(14, duration / 2.2);
  const ease = (f) => f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
  const xAt = (minute) => {
    if (targetOffset === 0) return 0;
    if (minute - startMinutes < taper) return targetOffset * ease((minute - startMinutes) / taper);
    if (endMinutes - minute < taper) return targetOffset * ease((endMinutes - minute) / taper);
    return targetOffset;
  };
  const samples = [];
  for (let minute = startMinutes; minute < endMinutes; minute += 4) samples.push(minute);
  samples.push(endMinutes);
  const edge = (minute, side) => [BRAID_CENTER + xAt(minute) + side * width / 2, minute / DAY_MINUTES * BRAID_HEIGHT];
  const points = [...samples.map((minute) => edge(minute, -1)), ...samples.slice().reverse().map((minute) => edge(minute, 1))];
  return `M ${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} Z`;
}

function clusterAndAssign(entries) {
  const sorted = [...entries].sort((left, right) => left.startMinutes - right.startMinutes);
  const clusters = [];
  let cluster = null;
  for (const entry of sorted) {
    if (!cluster || entry.startMinutes >= cluster.endMinutes) {
      cluster = { startMinutes: entry.startMinutes, endMinutes: entry.endMinutes, entries: [entry] };
      clusters.push(cluster);
    } else {
      cluster.entries.push(entry);
      cluster.endMinutes = Math.max(cluster.endMinutes, entry.endMinutes);
    }
  }

  return clusters.flatMap((current) => {
    const laneEnds = Array(MAX_OVERLAP_STACKS).fill(-Infinity);
    const placed = [];
    const overflow = [];
    current.entries.forEach((entry) => {
      const lane = laneEnds.findIndex((end) => end <= entry.startMinutes);
      if (lane === -1) overflow.push(entry);
      else {
        laneEnds[lane] = entry.endMinutes;
        placed.push({ ...entry, lane });
      }
    });
    const laneCount = Math.max(1, ...placed.map((entry) => entry.lane + 1));
    return [
      ...placed.map((entry) => ({
        ...entry,
        targetOffset: laneCount > 1 ? (entry.lane - (laneCount - 1) / 2) * BRAID_LANE_OFFSET : 0,
        isBraided: laneCount > 1,
        overflowCount: 0
      })),
      ...overflow.map((entry, index) => ({ ...entry, overflow: true, overflowCount: index === 0 ? overflow.length : 0 }))
    ];
  });
}

/**
 * Compact, read-only daily activity view used only on Activity Mode's left
 * summary column. Reminder Mode deliberately keeps its existing timeline.
 */
export default function MiniTimelinePanel({ activities, categories, activityCategoryMap, expandedDate, onClose, onEditActivity, userId }) {
  const archiveStorageKey = `times-activity-archive:${userId || "guest"}`;
  const readArchivedIds = () => {
    try {
      const archive = JSON.parse(window.localStorage.getItem(archiveStorageKey) || "[]");
      return new Set(Array.isArray(archive) ? archive.map((item) => item.calendarId).filter(Boolean) : []);
    } catch { return new Set(); }
  };
  const [archivedIds, setArchivedIds] = useState(readArchivedIds);
  const [focusedActivityId, setFocusedActivityId] = useState(null);

  useEffect(() => {
    setArchivedIds(readArchivedIds());
    const refresh = (event) => { if (event.detail?.userId === userId) setArchivedIds(readArchivedIds()); };
    window.addEventListener("times-activity-archive-changed", refresh);
    return () => window.removeEventListener("times-activity-archive-changed", refresh);
  }, [archiveStorageKey, userId]);
  useEffect(() => setFocusedActivityId(null), [expandedDate?.getTime()]);

  const view = useMemo(() => {
    if (!expandedDate) return { visibleActivities: [], timedActivities: [], ribbons: [], focusedCandidates: [] };
    const visibleActivities = activities.filter((activity) => !archivedIds.has(activity.id));
    const timedActivities = visibleActivities.filter((activity) => {
      const start = activityDate(activity.start);
      return activity.start?.dateTime && start && isSameDay(start, expandedDate);
    }).sort((left, right) => activityDate(left.start) - activityDate(right.start));
    const incoming = visibleActivities.filter((activity) => activity.start?.dateTime).map((activity) => {
      const start = activityDate(activity.start);
      const end = activityDate(activity.end) || start;
      const spill = getIncomingSpillover(start, end, expandedDate);
      return spill ? { activity, startMinutes: 0, endMinutes: spill.spilloverEndMin, spillover: true } : null;
    }).filter(Boolean);
    const regular = timedActivities.map((activity) => {
      const start = activityDate(activity.start);
      const end = activityDate(activity.end) || start;
      return { activity, startMinutes: minutesFromDayStart(start, expandedDate), endMinutes: Math.max(15, minutesFromDayStart(end, expandedDate)), spillover: false };
    });
    const ribbons = clusterAndAssign([...incoming, ...regular]);
    return { visibleActivities, timedActivities, ribbons, focusedCandidates: [...incoming, ...regular] };
  }, [activities, archivedIds, expandedDate]);

  if (!expandedDate) return null;
  const displayDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(expandedDate);
  const focused = view.focusedCandidates.find((entry) => entry.activity.id === focusedActivityId) || null;
  const hourMarks = [0, 6, 12, 18, 24];

  return <aside className="timeline-card mini-braid-panel">
    <div className="day-timeline-header">
      <p className="day-timeline-title">{WEEKDAY_FULL[WEEKDAY_SHORT[expandedDate.getDay()]]} ที่ {displayDate}</p>
      <div className="day-timeline-header-actions">
        <button type="button" className="day-timeline-nav" onClick={() => downloadDayTimelineImage({ day: expandedDate, activities: view.timedActivities, allActivities: view.visibleActivities, categories, activityCategoryMap })} aria-label="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ" title="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ (PNG)">📷</button>
        <button type="button" className="day-timeline-nav day-timeline-close" onClick={() => onClose?.()} aria-label="กลับไปหน้าสรุปสัปดาห์">✕</button>
      </div>
    </div>

    {view.ribbons.length === 0 ? <p className="day-timeline-empty">ไม่มีกิจกรรมตามเวลาในวันนี้</p> : <>
      <div className="mini-braid-canvas" aria-label="เส้นเวลาของกิจกรรมวันนี้">
        <div className="mini-braid-hours" aria-hidden="true">{hourMarks.map((hour) => <span key={hour} style={{ top: `${(hour / 24) * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}</div>
        <svg className="mini-braid-svg" viewBox={`0 0 ${BRAID_WIDTH} ${BRAID_HEIGHT}`} role="group" aria-label="กิจกรรมแสดงเป็นเส้นสีตามหมวดหมู่">
          {hourMarks.map((hour) => <line key={hour} x1="0" x2={BRAID_WIDTH} y1={(hour / 24) * BRAID_HEIGHT} y2={(hour / 24) * BRAID_HEIGHT} className="mini-braid-hour-line" />)}
          <line x1={BRAID_CENTER} x2={BRAID_CENTER} y1="0" y2={BRAID_HEIGHT} className="mini-braid-trunk" />
          {view.ribbons.filter((entry) => !entry.overflow).map((entry) => {
            const color = getDisplayColor(entry.activity, activityCategoryMap, categories);
            const isFocused = focusedActivityId === entry.activity.id;
            return <path key={entry.activity.id} d={braidPath(entry.startMinutes, entry.endMinutes, entry.targetOffset)} fill={color.border} stroke="rgba(255,255,255,0.55)" strokeWidth={1} className={`mini-braid-ribbon${entry.spillover ? " is-spillover" : ""}${focusedActivityId && !isFocused ? " is-dimmed" : ""}${isFocused ? " is-focused" : ""}`} role="button" tabIndex={0} aria-label={`${entry.activity.summary || "ไม่มีชื่อ"}, ${formatTime(activityDate(entry.activity.start))} ถึง ${formatTime(activityDate(entry.activity.end))}`} onClick={() => setFocusedActivityId((current) => current === entry.activity.id ? null : entry.activity.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setFocusedActivityId((current) => current === entry.activity.id ? null : entry.activity.id); } }}><title>{entry.activity.summary || "(ไม่มีชื่อ)"} · {formatTime(activityDate(entry.activity.start))}–{formatTime(activityDate(entry.activity.end))}</title></path>;
          })}
        </svg>
        {view.ribbons.filter((entry) => entry.overflow && entry.overflowCount > 0).map((entry) => <span key={`overflow-${entry.activity.id}`} className="mini-braid-overflow" style={{ top: `${(entry.startMinutes / DAY_MINUTES) * 100}%` }} title={`มีอีก ${entry.overflowCount} กิจกรรมที่ทับช่วงเวลาเดียวกัน`}>+{entry.overflowCount}</span>)}
      </div>
      <p className="mini-braid-hint">เส้นสีคือหมวดหมู่ · เส้นแยกเมื่อกิจกรรมทับกัน · คลิกเส้นเพื่อดูรายละเอียด</p>
      {focused && <button type="button" className="mini-braid-detail" onClick={() => onEditActivity?.(focused.activity)}>
        <span className="mini-braid-detail-color" style={{ background: getDisplayColor(focused.activity, activityCategoryMap, categories).border }} />
        <span><strong>{focused.activity.summary || "(ไม่มีชื่อ)"}</strong><small>{focused.spillover ? "ต่อเนื่องจากเมื่อคืน · " : ""}{formatTime(activityDate(focused.activity.start))} – {formatTime(activityDate(focused.activity.end))}</small></span><span aria-hidden>›</span>
      </button>}
    </>}
  </aside>;
}
