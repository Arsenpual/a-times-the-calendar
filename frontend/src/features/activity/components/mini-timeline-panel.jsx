import React, { useEffect, useMemo, useState } from "react";
import "../styles/mini-timeline-lanes.css";
import { activityDate, formatTime, isSameDay } from "../../../shared/lib/date-utils.js";
import { getDisplayColor } from "../lib/activity-colors.js";
import { getIncomingSpillover, MAX_OVERLAP_STACKS } from "../lib/timeline-layout.js";
import { downloadDayTimelineImage } from "../lib/export-day-image.js";

const WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const WEEKDAY_FULL = { "อา": "อาทิตย์", "จ": "จันทร์", "อ": "อังคาร", "พ": "พุธ", "พฤ": "พฤหัสบดี", "ศ": "ศุกร์", "ส": "เสาร์" };
const DAY_START_MINUTES = 0;
const DAY_END_MINUTES = 24 * 60;
const DAY_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES;
// 0.475px/min = 28.5px per hour.
const LANE_PIXELS_PER_MINUTE = 0.475;
const LANE_HEIGHT = DAY_MINUTES * LANE_PIXELS_PER_MINUTE;

// This first reintroduction is intentionally a visual preview only. Keeping
// the sample data here lets us judge the new composition without Calendar,
// archive, or edit side effects changing what is on screen.
const PREVIEW_DATE = new Date(2026, 8, 10);
const PREVIEW_CATEGORIES = [
  { id: "work", name: "งาน", color: "#3a5a7a" },
  { id: "personal", name: "ส่วนตัว", color: "#b4632a" },
  { id: "learn", name: "เรียนรู้", color: "#3f7d5c" },
  { id: "health", name: "สุขภาพ", color: "#8a4a9e" }
];
const PREVIEW_ACTIVITIES = [
  ["p1", "ประชุมทีม", "09:00", "10:00", "work"],
  ["p2", "เขียนรายงาน", "09:30", "11:00", "work"],
  ["p3", "โทรหาลูกค้า", "09:45", "10:15", "personal"],
  ["p4", "ทานข้าวเที่ยง", "12:00", "13:00", "personal"],
  ["p5", "ซ้อมเสนองาน", "13:00", "14:00", "work"],
  ["p6", "เรียนภาษาญี่ปุ่น", "13:30", "15:00", "learn"],
  ["p7", "ออกกำลังกาย", "18:00", "19:00", "health"]
].map(([id, summary, start, end, categoryId]) => {
  const at = (time) => new Date(2026, 8, 10, ...time.split(":").map(Number)).toISOString();
  return { id, summary, start: { dateTime: at(start) }, end: { dateTime: at(end) }, categoryId };
});

function minutesFromDayStart(date, day) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  // Absolute minutes from midnight, independent of the displayed window.
  return Math.max(0, Math.min(24 * 60, Math.round((date - start) / 60000)));
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

  return clusters.map((current) => {
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
    return { ...current, entries: placed, laneCount, overflow };

  });
}

/**
 * Compact, read-only daily activity view used only on Activity Mode's left
 * summary column. Reminder Mode deliberately keeps its existing timeline.
 */
export default function MiniTimelinePanel({ activities = [], categories = [], activityCategoryMap = {}, expandedDate, onClose, onEditActivity, userId, previewOnly = false }) {
  const previewDate = previewOnly ? PREVIEW_DATE : expandedDate;
  const previewActivities = previewOnly ? PREVIEW_ACTIVITIES : activities;
  const previewCategories = previewOnly ? PREVIEW_CATEGORIES : categories;
  const previewCategoryMap = previewOnly
    ? Object.fromEntries(PREVIEW_ACTIVITIES.map((activity) => [activity.id, activity.categoryId]))
    : activityCategoryMap;
  const archiveStorageKey = `times-activity-archive:${userId || "guest"}`;
  const readArchivedIds = () => {
    if (previewOnly) return new Set();
    try {
      const archive = JSON.parse(window.localStorage.getItem(archiveStorageKey) || "[]");
      return new Set(Array.isArray(archive) ? archive.map((item) => item.calendarId).filter(Boolean) : []);
    } catch { return new Set(); }
  };
  const [archivedIds, setArchivedIds] = useState(readArchivedIds);
  const [focusedActivityId, setFocusedActivityId] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (previewOnly) return undefined;
    setArchivedIds(readArchivedIds());
    const refresh = (event) => { if (event.detail?.userId === userId) setArchivedIds(readArchivedIds()); };
    window.addEventListener("times-activity-archive-changed", refresh);
    return () => window.removeEventListener("times-activity-archive-changed", refresh);
  }, [archiveStorageKey, userId, previewOnly]);
  useEffect(() => setFocusedActivityId(null), [previewDate?.getTime()]);

  const view = useMemo(() => {
    if (!previewDate) return { visibleActivities: [], timedActivities: [], clusters: [], focusedCandidates: [] };
    const visibleActivities = previewActivities.filter((activity) => !archivedIds.has(activity.id));
    const timedActivities = visibleActivities.filter((activity) => {
      const start = activityDate(activity.start);
      return activity.start?.dateTime && start && isSameDay(start, previewDate);
    }).sort((left, right) => activityDate(left.start) - activityDate(right.start));
    const incoming = visibleActivities.filter((activity) => activity.start?.dateTime).map((activity) => {
      const start = activityDate(activity.start);
      const end = activityDate(activity.end) || start;
      const spill = getIncomingSpillover(start, end, previewDate);
      return spill && spill.spilloverEndMin > DAY_START_MINUTES
        ? { activity, startMinutes: DAY_START_MINUTES, endMinutes: Math.min(DAY_END_MINUTES, spill.spilloverEndMin), spillover: true }
        : null;
    }).filter(Boolean);
    const regular = timedActivities.map((activity) => {
      const start = activityDate(activity.start);
      const end = activityDate(activity.end) || start;
      const startMinutes = minutesFromDayStart(start, previewDate);
      const endMinutes = Math.max(startMinutes + 1, minutesFromDayStart(end, previewDate));
      if (endMinutes <= DAY_START_MINUTES || startMinutes >= DAY_END_MINUTES) return null;
      return { activity, startMinutes: Math.max(DAY_START_MINUTES, startMinutes), endMinutes: Math.min(DAY_END_MINUTES, endMinutes), spillover: false };
    }).filter(Boolean);
    const clusters = clusterAndAssign([...incoming, ...regular]);
    return { visibleActivities, timedActivities, clusters, focusedCandidates: [...incoming, ...regular] };
  }, [previewActivities, archivedIds, previewDate]);

  if (!previewDate) return null;
  const displayDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(previewDate);
  const focused = view.focusedCandidates.find((entry) => entry.activity.id === focusedActivityId) || null;
  const visibleCategoryIds = new Set(view.timedActivities.map((activity) => previewCategoryMap[activity.id] || activity.categoryId).filter(Boolean));
  const dayCategories = previewCategories.filter((category) => visibleCategoryIds.has(category.id));

  return <aside className="timeline-card mini-lanes-panel">
    <div className="day-timeline-header">
      <p className="day-timeline-title">{WEEKDAY_FULL[WEEKDAY_SHORT[previewDate.getDay()]]} ที่ {displayDate}</p>
      {previewOnly ? <span className="mini-braid-preview-label">ตัวอย่าง</span> : <div className="day-timeline-header-actions">
        <button type="button" className="day-timeline-nav" onClick={() => downloadDayTimelineImage({ day: previewDate, activities: view.timedActivities, allActivities: view.visibleActivities, categories: previewCategories, activityCategoryMap: previewCategoryMap })} aria-label="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ" title="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ (PNG)">📷</button>
        <button type="button" className="day-timeline-nav day-timeline-close" onClick={() => onClose?.()} aria-label="กลับไปหน้าสรุปสัปดาห์">✕</button>
      </div>}
    </div>

    <div className="mini-start-list" aria-label="รายการกิจกรรมตามเวลาเริ่ม">
      {view.timedActivities.map((activity) => {
        const color = getDisplayColor(activity, previewCategoryMap, previewCategories);
        const time = formatTime(activityDate(activity.start));
        const startAt = activityDate(activity.start)?.getTime();
        const endAt = activityDate(activity.end)?.getTime();
        const isLive = Number.isFinite(startAt) && Number.isFinite(endAt) && nowTick >= startAt && nowTick < endAt;
        return <button type="button" className={`mini-start-item${focusedActivityId === activity.id ? " is-active" : ""}`} key={activity.id}
          onClick={() => setFocusedActivityId((current) => current === activity.id ? null : activity.id)}
          aria-pressed={focusedActivityId === activity.id}>
          <span className={`mini-start-dot${isLive ? " is-live" : ""}`} style={{ color: color.border }} aria-label={isLive ? "กำลังทำกิจกรรม" : undefined} aria-hidden="true">•</span>
          <span className="mini-start-name">{activity.summary || "(ไม่มีชื่อ)"}</span>
          <time className="mini-start-time">{time}</time>
        </button>;
      })}
    </div>
    {view.timedActivities.length === 0 && <p className="day-timeline-empty">ไม่มีกิจกรรมตามเวลาในวันนี้</p>}
    <div className="mini-lanes-legend" aria-label="สีหมวดหมู่">
      {dayCategories.map((category) => <span key={category.id}><i style={{ background: category.color }} />{category.name}</span>)}
    </div>
      {focused && <button type="button" className="mini-braid-detail mini-braid-detail-focused" onClick={() => !previewOnly && onEditActivity?.(focused.activity)}>
        <span className="mini-braid-detail-color" style={{ background: getDisplayColor(focused.activity, previewCategoryMap, previewCategories).border }} />
        <span><strong>{focused.activity.summary || "(ไม่มีชื่อ)"}</strong><small>{focused.spillover ? "ต่อเนื่องจากเมื่อคืน · " : ""}{formatTime(activityDate(focused.activity.start))} – {formatTime(activityDate(focused.activity.end))}</small></span><span aria-hidden>›</span>
      </button>}
  </aside>;
}
