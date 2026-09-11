import React, { useEffect, useMemo, useState } from "react";
import "../styles/mini-timeline-panel.css";
import { activityDate, formatTime, isSameDay } from "../../../shared/lib/date-utils.js";
import { getDisplayColor } from "../lib/activity-colors.js";
import { downloadDayTimelineImage } from "../lib/export-day-image.js";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";

const WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const WEEKDAY_FULL = { "อา": "อาทิตย์", "จ": "จันทร์", "อ": "อังคาร", "พ": "พุธ", "พฤ": "พฤหัสบดี", "ศ": "ศุกร์", "ส": "เสาร์" };
// Static data is used only when the component is opened through the mockup
// preview. The normal Activity Mode always receives real calendar data.
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

/**
 * Daily activity list in Activity Mode's summary column. It combines the
 * start-time list, live-activity card, archive exclusion, blur controls and
 * direct editing. Reminder Mode keeps its own timeline.
 */
export default function MiniTimelinePanel({ activities = [], categories = [], activityCategoryMap = {}, lockedActivities = {}, expandedDate, onClose, onEditActivity, userId, previewOnly = false }) {
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
  const [blurredActivityIds, setBlurredActivityIds] = useState(() => new Set());
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
  useEffect(() => setBlurredActivityIds(new Set()), [previewDate?.getTime()]);

  const dayView = useMemo(() => {
    if (!previewDate) return { visibleActivities: [], scheduledActivities: [] };
    const visibleActivities = previewActivities.filter((activity) => !archivedIds.has(activity.id));
    const scheduledActivities = visibleActivities.filter((activity) => {
      const start = activityDate(activity.start);
      if (!start) return false;
      const isAllDay = Boolean(activity.start?.date && !activity.start?.dateTime);
      if (!isAllDay) return Boolean(activity.start?.dateTime) && isSameDay(start, previewDate);
      const end = activityDate(activity.end) || start;
      const dayStart = new Date(previewDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      // Google Calendar all-day end dates are exclusive, so a multi-day
      // activity appears on every covered day but not on its end date.
      return start < dayEnd && end > dayStart;
    }).sort((left, right) => {
      const leftAllDay = Boolean(left.start?.date && !left.start?.dateTime);
      const rightAllDay = Boolean(right.start?.date && !right.start?.dateTime);
      if (leftAllDay !== rightAllDay) return leftAllDay ? -1 : 1;
      return activityDate(left.start) - activityDate(right.start);
    });
    return { visibleActivities, scheduledActivities };
  }, [previewActivities, archivedIds, previewDate]);

  if (!previewDate) return null;
  const displayedDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(previewDate);
  const usedCategoryIds = new Set(dayView.scheduledActivities.map((activity) => previewCategoryMap[normalizeActivityId(activity.id)] || activity.categoryId).filter(Boolean));
  const usedCategories = previewCategories.filter((category) => usedCategoryIds.has(category.id));

  return <aside className="timeline-card mini-timeline-panel">
    <div className="day-timeline-header">
      <p className="day-timeline-title">{WEEKDAY_FULL[WEEKDAY_SHORT[previewDate.getDay()]]} ที่ {displayedDate}</p>
      {previewOnly ? <span className="mini-timeline-preview-label">ตัวอย่าง</span> : <div className="day-timeline-header-actions">
        <button type="button" className="day-timeline-nav" onClick={() => downloadDayTimelineImage({ day: previewDate, activities: dayView.scheduledActivities, allActivities: dayView.visibleActivities, categories: previewCategories, activityCategoryMap: previewCategoryMap })} aria-label="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ" title="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ (PNG)">📷</button>
        <button type="button" className="day-timeline-nav day-timeline-close" onClick={() => onClose?.()} aria-label="กลับไปหน้าสรุปสัปดาห์">✕</button>
      </div>}
    </div>

    <div className="mini-start-list" aria-label="รายการกิจกรรมตามเวลาเริ่ม">
      {dayView.scheduledActivities.map((activity) => {
        const color = getDisplayColor(activity, previewCategoryMap, previewCategories);
        const isAllDay = Boolean(activity.start?.date && !activity.start?.dateTime);
        const time = isAllDay ? "ทั้งวัน" : formatTime(activityDate(activity.start));
        const startAt = activityDate(activity.start)?.getTime();
        const endAt = activityDate(activity.end)?.getTime();
        const isLive = Number.isFinite(startAt) && Number.isFinite(endAt) && nowTick >= startAt && nowTick < endAt;
        const remainingRatio = isLive ? Math.max(0, Math.min(1, (endAt - nowTick) / Math.max(1, endAt - startAt))) : 0;
        const isLocked = Boolean(lockedActivities[activity.id]);
        const isBlurred = blurredActivityIds.has(activity.id);
        const toggleBlur = (event) => {
          event.stopPropagation();
          setBlurredActivityIds((current) => {
            const next = new Set(current);
            next.has(activity.id) ? next.delete(activity.id) : next.add(activity.id);
            return next;
          });
        };
        const openEditor = () => {
          if (!isLocked && !previewOnly) onEditActivity?.(activity);
        };
        if (isLive) {
          const energyPercent = Math.max(0, remainingRatio * 100);
          return <div className={`mini-start-row${isBlurred ? " is-blurred" : ""}`} key={activity.id}>
            <button type="button" className="mini-start-visibility" onClick={toggleBlur} aria-label={isBlurred ? "แสดงกิจกรรม" : "เบลอกิจกรรม"} title={isBlurred ? "แสดงกิจกรรม" : "เบลอกิจกรรม"}>👁</button>
            <button type="button" className={`mini-braid-detail mini-start-live-detail${isLocked ? " is-locked" : ""}`} onClick={openEditor} disabled={isLocked} aria-label={isLocked ? "กิจกรรมถูกล็อก" : `แก้ไข ${activity.summary || "กิจกรรม"}`}>
              <span className="mini-braid-detail-color" style={{ background: `linear-gradient(to top, ${color.border} 0%, ${color.border} ${energyPercent}%, transparent ${energyPercent}%, transparent 100%)` }} aria-label="พลังงานเวลาที่เหลือ" />
              <span className="mini-start-live-copy">
                <span className="mini-start-live-heading"><strong>{activity.summary || "(ไม่มีชื่อ)"}</strong><time>{isAllDay ? "ทั้งวัน" : `${time} – ${formatTime(activityDate(activity.end))}`}</time></span>
                <small>เหลือ {Math.max(0, Math.ceil((endAt - nowTick) / 60000))} นาที</small>
              </span>
              <span aria-hidden>{isLocked ? "🔒" : "›"}</span>
            </button>
          </div>;
        }
        return <div className={`mini-start-row${isBlurred ? " is-blurred" : ""}`} key={activity.id}>
          <button type="button" className="mini-start-visibility" onClick={toggleBlur} aria-label={isBlurred ? "แสดงกิจกรรม" : "เบลอกิจกรรม"} title={isBlurred ? "แสดงกิจกรรม" : "เบลอกิจกรรม"}>👁</button>
          <button type="button" className={`mini-start-item${isLocked ? " is-locked" : ""}`} onClick={openEditor} disabled={isLocked} aria-label={isLocked ? "กิจกรรมถูกล็อก" : `แก้ไข ${activity.summary || "กิจกรรม"}`}>
            <span className="mini-start-dot" style={{ color: color.border }} aria-hidden="true">•</span>
            <span className="mini-start-name">{activity.summary || "(ไม่มีชื่อ)"}</span>
            <time className="mini-start-time">{time}</time>
          </button>
        </div>;
      })}
    </div>
    {dayView.scheduledActivities.length === 0 && <p className="day-timeline-empty">ไม่มีกิจกรรมตามเวลาในวันนี้</p>}
    <div className="mini-timeline-category-legend" aria-label="สีหมวดหมู่">
      {usedCategories.map((category) => <span key={category.id}><i style={{ background: category.color }} />{category.name}</span>)}
    </div>
  </aside>;
}
