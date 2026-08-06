import React, { useEffect, useRef, useState } from "react";
import { activityDate } from "../date-utils.js";
import { getDisplayColor } from "../activity-colors.js";
import ActivityPopup from "./activity-popup.jsx";
import { SNAP_MINUTES, minutesOfDay, layoutOverlaps } from "../timeline-layout.js";
import { downloadDayTimelineImage } from "../export-day-image.js";
/**
 * Google Calendar ส่ง instance id ของ recurring event มาในรูป
 * "<baseId>_<YYYYMMDDTHHmmssZ>" เมื่อใช้ singleEvents=true
 * ต้อง normalize ให้เหลือแค่ base id ก่อน lookup ใน activityCategoryMap
 * และก่อนส่งไป backend — มิฉะนั้นสีและหมวดหมู่จะหายเมื่อดูสัปดาห์อื่น
 */
function normalizeActivityId(id) {
  return id.replace(/_\d{8}T\d{6}Z$/, '');
}

const EDIT_HOUR_HEIGHT = 52; // px per hour row
const EDIT_DAY_START_HOUR = 0; // full 24h day, top to bottom
const EDIT_DAY_END_HOUR = 24;
const OVERLAP_GUTTER = 4; // px gap between side-by-side overlapping activities

function snap(minutes) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function minutesToLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Inline drag-editor for one day's activity times, rendered inside its
 * expanded agenda-row (see agenda-view.jsx) — not a separate panel. The
 * grid spans the full 24-hour day so every activity is visible without
 * scrolling past hidden hours. Overlapping activities lay out side by side,
 * left to right, with the longest-duration activity in the rightmost column.
 *
 * Right-clicking an activity chip opens a small context menu for that
 * specific activity — to reassign its category, lock/unlock it, or open
 * ActivityModal to edit/delete it outright. The popup opens exactly at the
 * click point. Right-clicking empty grid space does nothing (no more
 * "nearest activity" fallback), since guessing which activity was intended
 * from empty space is ambiguous once several activities are close together.
 * Locked activities can't be dragged, resized, or deleted, and are visually
 * dimmed with a lock icon.
 *
 * Purely local for times: dragging updates in-memory draft times only.
 * Nothing syncs to Google Calendar until the person presses "บันทึก",
 * which batches every changed activity through onSaveTimes at once.
 * Category changes and lock toggles apply immediately (same as elsewhere
 * in the app).
 *
 * @param {Date} day the day being edited
 * @param {Array} activities full activity list (filtered to `day` internally)
 * @param {Record<string, boolean>} lockedActivities activityId -> true for locked activities
 * @param {() => void} onCancel close the editor without saving
 * @param {(changes: Array<{id: string, start: Date, end: Date}>) => Promise<void>} onSaveTimes
 * @param {(activityId: string, categoryId: string|null) => void} onAssignCategory
 * @param {(activity: object) => void} onEditActivity opens ActivityModal for full edit/delete
 * @param {(activityId: string, locked: boolean) => void} onToggleLock
 * @param {(activityId: string) => Promise<void>} onDeleteActivity quick-delete from the popup (no full modal)
 * @param {(recurringEventId: string) => Promise<void>} onDeleteSeries deletes an entire recurring series in one call
 * @param {(activity: object) => Promise<void>} onDuplicateActivity clone an activity onto the same day
 * @param {(activityId: string, dateStr: string) => Promise<void>} onMoveActivityToDay dateStr is "YYYY-MM-DD"
 * @param {(activityId: string, colorId: string|null) => Promise<void>} onSetActivityColor colorId null resets to default
 * @param {(activity: object) => Promise<void>} onEditSeries เปิด modal แก้ไขทั้งชุด recurring
 * @param {(recurringEventId: string) => Promise<number|null>} onFetchSeriesCount นับ instances ทั้งชุด
 */
export default function TimelineEditor({
  day,
  activities,
  categories,
  activityCategoryMap,
  activityTagMap,
  lockedActivities,
  onCancel,
  onSaveTimes,
  onAssignCategory,
  onEditActivity,
  onToggleLock,
  onDeleteActivity,
  onDeleteSeries,
  onDuplicateActivity,
  onMoveActivityToDay,
  onSetActivityColor,
  onEditSeries,
  onFetchSeriesCount
}) {
  const [draftTimes, setDraftTimes] = useState({}); // activityId -> { start: Date, end: Date }
  const [saving, setSaving] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { activityId, x, y }
  const [isFullscreen, setIsFullscreen] = useState(false);
  const gridRef = useRef(null);

  const timedActivities = activities.filter((activity) => activity.start?.dateTime);

  const isLocked = (activityId) => !!lockedActivities?.[normalizeActivityId(activityId)];

  const getTimes = (activity) => {
    if (draftTimes[activity.id]) return draftTimes[activity.id];
    return { start: activityDate(activity.start), end: activityDate(activity.end) || activityDate(activity.start) };
  };

  const hasChanges = Object.keys(draftTimes).length > 0;

  const saveEditing = async () => {
    const changes = Object.entries(draftTimes).map(([id, times]) => ({
      id,
      start: times.start,
      end: times.end
    }));
    if (changes.length === 0) {
      onCancel?.();
      return;
    }
    setSaving(true);
    try {
      await onSaveTimes?.(changes);
      onCancel?.();
    } finally {
      setSaving(false);
    }
  };

  const gridMinutesFromClientY = (clientY) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const y = clientY - rect.top;
    const hourFromTop = y / EDIT_HOUR_HEIGHT;
    return EDIT_DAY_START_HOUR * 60 + hourFromTop * 60;
  };

  const startDrag = (e, activity, mode) => {
    if (e.button === 2) return; // right-click opens the context menu instead
    if (isLocked(activity.id)) return; // locked activities can't be moved or resized
    e.preventDefault();
    setContextMenu(null);
    const times = getTimes(activity);
    setDragState({
      activityId: activity.id,
      mode,
      originStart: minutesOfDay(times.start),
      originEnd: minutesOfDay(times.end),
      originGrabMinutes: gridMinutesFromClientY(e.clientY)
    });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onDragMove = (e) => {
    if (!dragState) return;
    const currentMinutes = gridMinutesFromClientY(e.clientY);
    if (currentMinutes === null) return;
    const delta = currentMinutes - dragState.originGrabMinutes;

    let nextStart = dragState.originStart;
    let nextEnd = dragState.originEnd;

    if (dragState.mode === "move") {
      const duration = dragState.originEnd - dragState.originStart;
      nextStart = snap(Math.max(0, Math.min(1440 - duration, dragState.originStart + delta)));
      nextEnd = nextStart + duration;
    } else if (dragState.mode === "resize-start") {
      nextStart = snap(Math.max(0, Math.min(dragState.originEnd - SNAP_MINUTES, dragState.originStart + delta)));
    } else if (dragState.mode === "resize-end") {
      nextEnd = snap(Math.max(dragState.originStart + SNAP_MINUTES, Math.min(1440, dragState.originEnd + delta)));
    }

    const base = new Date(day);
    base.setHours(0, 0, 0, 0);
    const start = new Date(base.getTime() + nextStart * 60000);
    const end = new Date(base.getTime() + nextEnd * 60000);

    setDraftTimes((prev) => ({ ...prev, [dragState.activityId]: { start, end } }));
  };

  const endDrag = () => setDragState(null);

  const openContextMenu = (e, activityId) => {
    e.preventDefault();
    e.stopPropagation();
    // .activity-popup is `position: absolute` inside this same scrollable
    // container (day-timeline-scroll-edit, gridRef's parent), so its
    // top/left are relative to the container's scrolled content — not the
    // viewport. getBoundingClientRect() only gives the container's visible
    // on-screen position, so without adding back scrollTop/scrollLeft the
    // popup lands at the click's position *as if the grid were scrolled to
    // the top* — off by however far the grid has actually been scrolled,
    // which is why it looked like it opened at a "random" spot.
    const container = gridRef.current?.parentElement;
    const rect = container?.getBoundingClientRect();
    setContextMenu({
      activityId,
      x: rect ? e.clientX - rect.left + container.scrollLeft : e.clientX,
      y: rect ? e.clientY - rect.top + container.scrollTop : e.clientY
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKey);
    // Lock page scroll while the editor covers the viewport, so scrolling
    // the grid itself doesn't also scroll the page behind it.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickAway = () => closeContextMenu();
    const handleKey = (e) => {
      if (e.key === "Escape") closeContextMenu();
    };
    document.addEventListener("pointerdown", handleClickAway);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handleClickAway);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const editHours = Array.from(
    { length: EDIT_DAY_END_HOUR - EDIT_DAY_START_HOUR },
    (_, i) => EDIT_DAY_START_HOUR + i
  );
  const editGridHeight = editHours.length * EDIT_HOUR_HEIGHT;
  const contextActivity = contextMenu ? timedActivities.find((activity) => activity.id === contextMenu.activityId) : null;
  const contextLocked = contextActivity ? isLocked(contextActivity.id) : false;

  const overlapLayout = layoutOverlaps(
    timedActivities.map((activity) => {
      const { start, end } = getTimes(activity);
      const startMin = minutesOfDay(start);
      const endMin = Math.max(startMin + SNAP_MINUTES, minutesOfDay(end));
      return { id: activity.id, startMin, endMin };
    })
  );

  return (
    <div className={`timeline-editor${isFullscreen ? " is-fullscreen" : ""}`}>
      <div className="timeline-editor-header">
        <p className="timeline-editor-hint">
          ลากเพื่อย้าย หรือดึงขอบบน/ล่างเพื่อปรับเวลา — คลิกขวาที่แถบกิจกรรมเพื่อตั้งค่า
          — กด "บันทึก" เพื่อ sync กลับ Google Calendar
        </p>
        <button
          type="button"
          className="btn-icon timeline-editor-export"
          onClick={() =>
            downloadDayTimelineImage({ day, activities: timedActivities, categories, activityCategoryMap })
          }
          aria-label="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ"
          title="ดาวน์โหลดแผนวันนี้เป็นรูปภาพ (PNG)"
        >
          📷
        </button>
        <button
          type="button"
          className="btn-icon timeline-editor-fullscreen-toggle"
          onClick={() => setIsFullscreen((prev) => !prev)}
          aria-label={isFullscreen ? "ออกจากโหมดเต็มจอ" : "ขยายเต็มจอ"}
          title={isFullscreen ? "ออกจากโหมดเต็มจอ" : "ขยายเต็มจอ"}
        >
          {isFullscreen ? "⤡" : "⤢"}
        </button>
      </div>

      {timedActivities.length === 0 ? (
        <p className="day-timeline-empty">ไม่มีกิจกรรมตามเวลาในวันนี้</p>
      ) : (
        <div className="day-timeline-scroll day-timeline-scroll-edit" style={{ position: "relative" }}>
          <div
            className="day-timeline-grid"
            ref={gridRef}
            style={{ height: editGridHeight }}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {editHours.map((h) => (
              <div
                key={h}
                className="day-timeline-hour-row"
                style={{ top: (h - EDIT_DAY_START_HOUR) * EDIT_HOUR_HEIGHT, height: EDIT_HOUR_HEIGHT }}
              >
                <span className="day-timeline-hour-label">{String(h).padStart(2, "0")}:00</span>
                <div className="day-timeline-hour-line" />
              </div>
            ))}

            <div className="day-timeline-events-layer">
              {timedActivities.map((activity) => {
                const { start, end } = getTimes(activity);
                const startMin = minutesOfDay(start);
                const endMin = Math.max(startMin + SNAP_MINUTES, minutesOfDay(end));
                const top = ((startMin - EDIT_DAY_START_HOUR * 60) / 60) * EDIT_HOUR_HEIGHT;
                const height = ((endMin - startMin) / 60) * EDIT_HOUR_HEIGHT;
                const color = getDisplayColor(activity, activityCategoryMap, categories);
                const isDragging = dragState?.activityId === activity.id;
                const locked = isLocked(activity.id);
                const { column, columns } = overlapLayout[activity.id] || { column: 0, columns: 1 };
                const widthPercent = 100 / columns;
                const leftPercent = column * widthPercent;
                return (
                  <div
                    key={activity.id}
                    className={`day-timeline-editable-event${isDragging ? " is-dragging" : ""}${
                      draftTimes[activity.id] ? " is-changed" : ""
                    }${locked ? " is-locked" : ""}`}
                    style={{
                      top,
                      height,
                      left: `calc(${leftPercent}% + ${column > 0 ? OVERLAP_GUTTER / 2 : 0}px)`,
                      width: `calc(${widthPercent}% - ${OVERLAP_GUTTER}px)`,
                      background: color.bg,
                      borderLeftColor: color.border
                    }}
                    onPointerDown={(e) => startDrag(e, activity, "move")}
                    onContextMenu={(e) => openContextMenu(e, activity.id)}
                    title={locked ? "ล็อกอยู่ — ปลดล็อกก่อนแก้ไข" : undefined}
                  >
                    {!locked && (
                      <div
                        className="day-timeline-resize-handle day-timeline-resize-handle-top"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          startDrag(e, activity, "resize-start");
                        }}
                      />
                    )}
                    <span className="day-timeline-event-title">
                      {locked && <span className="day-timeline-lock-icon">🔒</span>}
                      {activity.summary || "(ไม่มีชื่อ)"}
                    </span>
                    <span className="day-timeline-event-time">
                      {minutesToLabel(startMin)} – {minutesToLabel(endMin)}
                    </span>
                    {!locked && (
                      <div
                        className="day-timeline-resize-handle day-timeline-resize-handle-bottom"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          startDrag(e, activity, "resize-end");
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {contextMenu && contextActivity && (
            <ActivityPopup
              activity={contextActivity}
              start={getTimes(contextActivity).start}
              end={getTimes(contextActivity).end}
              position={{ x: contextMenu.x, y: contextMenu.y }}
              locked={contextLocked}
              categories={categories}
              categoryId={activityCategoryMap[normalizeActivityId(contextActivity.id)] || null}
              tags={activityTagMap?.[normalizeActivityId(contextActivity.id)] || []}
              displayColor={getDisplayColor(contextActivity, activityCategoryMap, categories).border}
              onClose={closeContextMenu}
              onAssignCategory={(categoryId) => onAssignCategory?.(normalizeActivityId(contextActivity.id), categoryId)}
              onToggleLock={(locked) => onToggleLock?.(normalizeActivityId(contextActivity.id), locked)}
              onEditActivity={() => onEditActivity?.(contextActivity)}
              onDelete={() => onDeleteActivity?.(normalizeActivityId(contextActivity.id))}
              onDeleteSeries={
                contextActivity.recurringEventId
                  ? () => onDeleteSeries?.(contextActivity.recurringEventId)
                  : undefined
              }
              onDuplicate={() => onDuplicateActivity?.(contextActivity)}
              onMoveToDay={(dateStr) => onMoveActivityToDay?.(normalizeActivityId(contextActivity.id), dateStr)}
              onSetColor={(colorId) => onSetActivityColor?.(normalizeActivityId(contextActivity.id), colorId)}
              onEditSeries={() => onEditSeries?.(contextActivity)}
              onFetchSeriesCount={contextActivity.recurringEventId ? () => onFetchSeriesCount?.(contextActivity.recurringEventId) : undefined}
            />
          )}
        </div>
      )}

      <div className="timeline-editor-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>
          ยกเลิก
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={saveEditing}
          disabled={saving || !hasChanges}
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  );
}
