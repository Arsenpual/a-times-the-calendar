import React, { useEffect, useRef, useState } from "react";
import { activityDate } from "../date-utils.js";
import { getDisplayColor } from "../activity-colors.js";
import ActivityPopup from "./activity-popup.jsx";
import { SNAP_MINUTES, minutesOfDay, minutesFromDayStart, layoutOverlaps, getOutgoingSpillover, getIncomingSpillover } from "../timeline-layout.js";
import { downloadDayTimelineImage } from "../export-day-image.js";
import { normalizeActivityId } from "../id-utils.js";
import AutoShrinkText from "./auto-shrink-text.jsx";

const EDIT_HOUR_HEIGHT = 52; // px per hour row
const EDIT_DAY_START_HOUR = 0; // full 24h day, top to bottom
const EDIT_DAY_END_HOUR = 24;
const OVERLAP_GUTTER = 4; // px gap between side-by-side overlapping activities
// Longest duration reachable by dragging/resizing in the editor — high
// enough to cover a normal overnight activity (e.g. 20:00-02:00, 6h) with
// room to spare, without letting a drag runs away into multi-day
// durations by accident. Activities already longer than this (however
// they were created — e.g. via ActivityModal, which has no such cap) are
// left untouched; this only bounds how far a *drag* can push start/end.
const MAX_DURATION_MINUTES = 12 * 60;

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
 * expanded agenda-row (see activity-mode.jsx) — not a separate panel. The
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
 * @param {(activity: object) => Promise<void>} onEditSeries เปิด modal แก้ไขทั้งชุด recurring
 * @param {(recurringEventId: string) => Promise<number|null>} onFetchSeriesCount นับ instances ทั้งชุด
 */
export default function TimelineEditor({
  day,
  activities,
  allActivities,
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
  onEditSeries,
  onFetchSeriesCount
}) {
  const [draftTimes, setDraftTimes] = useState({}); // activityId -> { start: Date, end: Date }
  const [saving, setSaving] = useState(false);
  const [overlapError, setOverlapError] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { activityId, x, y }
  const [isFullscreen, setIsFullscreen] = useState(false);
  const gridRef = useRef(null);
  const dragAnimationFrameRef = useRef(null);
  const pendingDragPreviewRef = useRef(null);
  const dragStartLayoutRef = useRef(null);

  const timedActivities = activities.filter((activity) => activity.start?.dateTime);

  // Activity that started the day before `day` and whose end time bleeds
  // into `day` — rendered as a dimmed, non-interactive-for-dragging block
  // at the top of the grid so it's visually obvious it's a carryover from
  // last night, not one of today's own activities. Looked up from
  // `allActivities` (the full fetched range) rather than `activities`
  // (already filtered to `day`), since by definition this activity's own
  // start date is yesterday, not `day`.
  const incomingSpillover = (allActivities || [])
    .filter((activity) => activity.start?.dateTime)
    .map((activity) => {
      const start = activityDate(activity.start);
      const end = activityDate(activity.end) || start;
      const spill = getIncomingSpillover(start, end, day);
      return spill ? { activity, start, end, spilloverEndMin: spill.spilloverEndMin } : null;
    })
    .filter(Boolean);

  const isLocked = (activityId) => !!lockedActivities?.[normalizeActivityId(activityId)];

  const getTimes = (activity) => {
    if (draftTimes[activity.id]) return draftTimes[activity.id];
    return { start: activityDate(activity.start), end: activityDate(activity.end) || activityDate(activity.start) };
  };

  const hasChanges = Object.keys(draftTimes).length > 0;

  const saveEditing = async () => {
    setOverlapError(null);
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
    // ตรึงคอลัมน์ของงานอื่นไว้ตลอด gesture นี้: ถ้าปล่อยให้คำนวณ overlap
    // layout ทุก pixel ที่เลื่อน บล็อกจะสลับคอลัมน์/เปลี่ยนความกว้างทันที
    // ที่แตะงานข้างเคียงจนดูเหมือนดีดออกไป.
    dragStartLayoutRef.current = overlapLayout;
    setDragState({
      activityId: activity.id,
      mode,
      originStart: minutesOfDay(times.start),
      originEnd: minutesFromDayStart(times.end, day),
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
      // The activity's start must stay within this day's own grid (dragging
      // a block shouldn't silently move its start onto a different day) —
      // but its end is intentionally NOT clamped back down to 1440 here,
      // since an activity that starts late in the day is allowed to run
      // past midnight (e.g. 20:00-02:00). durationMinutes still bounds how
      // long a single drag can stretch it, independent of the day boundary.
      nextStart = snap(Math.max(0, Math.min(1440 - SNAP_MINUTES, dragState.originStart + delta)));
      nextEnd = nextStart + duration;
    } else if (dragState.mode === "resize-start") {
      // Dragging the top edge later can't push nextStart past nextEnd, and
      // can't push it earlier than (end - MAX_DURATION_MINUTES) so the
      // activity doesn't silently grow beyond the drag cap from this edge
      // either.
      const earliestStart = dragState.originEnd - MAX_DURATION_MINUTES;
      nextStart = snap(
        Math.max(Math.max(0, earliestStart), Math.min(dragState.originEnd - SNAP_MINUTES, dragState.originStart + delta))
      );
    } else if (dragState.mode === "resize-end") {
      // No longer clamped to 1440 (midnight) — dragging the bottom edge
      // past midnight is exactly how an overnight activity (e.g.
      // 20:00-02:00) gets created from the editor. The only limits are: at
      // least SNAP_MINUTES long, and no longer than MAX_DURATION_MINUTES
      // total so a drag can't run away into a multi-day span by accident.
      const latestEnd = dragState.originStart + MAX_DURATION_MINUTES;
      nextEnd = snap(Math.max(dragState.originStart + SNAP_MINUTES, Math.min(latestEnd, dragState.originEnd + delta)));
    }

    const base = new Date(day);
    base.setHours(0, 0, 0, 0);
    const start = new Date(base.getTime() + nextStart * 60000);
    const end = new Date(base.getTime() + nextEnd * 60000);

    // Pointer events เกิดถี่กว่า refresh rate ของจอได้มาก การ setState ทุก
    // event ทำให้ทั้งกริด 24 ชั่วโมงคำนวณ layout ใหม่ถี่เกินจำเป็นและเกิด
    // อาการกระตุก จึงรวม update เหลืออย่างมากหนึ่งครั้งต่อ animation frame.
    pendingDragPreviewRef.current = {
      activityId: dragState.activityId,
      times: { start, end },
      overlapError: null
    };
    if (dragAnimationFrameRef.current !== null) return;
    dragAnimationFrameRef.current = requestAnimationFrame(() => {
      dragAnimationFrameRef.current = null;
      const preview = pendingDragPreviewRef.current;
      pendingDragPreviewRef.current = null;
      if (!preview) return;
      setOverlapError(preview.overlapError);
      setDraftTimes((prev) => ({ ...prev, [preview.activityId]: preview.times }));
    });
  };

  const endDrag = () => {
    // Commit preview ล่าสุดทันทีถ้า pointer ถูกปล่อยระหว่างที่ rAF ยังไม่รัน
    // เพื่อไม่ให้ตำแหน่งสุดท้ายหล่นหายหนึ่ง frame.
    if (dragAnimationFrameRef.current !== null) {
      cancelAnimationFrame(dragAnimationFrameRef.current);
      dragAnimationFrameRef.current = null;
      const preview = pendingDragPreviewRef.current;
      pendingDragPreviewRef.current = null;
      if (preview) {
        setOverlapError(preview.overlapError);
        setDraftTimes((prev) => ({ ...prev, [preview.activityId]: preview.times }));
      }
    }
    dragStartLayoutRef.current = null;
    setDragState(null);
  };

  useEffect(() => () => {
    if (dragAnimationFrameRef.current !== null) cancelAnimationFrame(dragAnimationFrameRef.current);
  }, []);

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

  const overlapLayout = dragState && dragStartLayoutRef.current
    ? dragStartLayoutRef.current
    : layoutOverlaps([
    ...timedActivities.map((activity) => {
      const { start, end } = getTimes(activity);
      const startMin = minutesOfDay(start);
      const endMin = Math.max(startMin + SNAP_MINUTES, minutesFromDayStart(end, day));
      return { id: activity.id, startMin, endMin };
    }),
    // Incoming spillover blocks (yesterday's activity bleeding into `day`)
    // get their own entries too, using a prefixed id so they can never
    // collide with a real activity id — this lets them share columns with
    // whatever's actually happening early this morning instead of always
    // rendering full width and overlapping other blocks visually.
    ...incomingSpillover.map(({ activity, spilloverEndMin }) => ({
      id: `spillover-in-${activity.id}`,
      startMin: 0,
      endMin: Math.max(SNAP_MINUTES, spilloverEndMin)
    }))
    ]);
  // ระหว่างลากใช้ layout ตอนเริ่ม gesture สำหรับงานที่ไม่ได้ถูกโฟกัส จึงไม่
  // คำนวณใหม่หรือทำให้กริด reflow. บล็อกที่โฟกัสถูกบังคับเป็นซ้ายสุดด้านล่าง.

  return (
    <div className={`timeline-editor${isFullscreen ? " is-fullscreen" : ""}`}>
      <div className="timeline-editor-header">
        <p className="timeline-editor-hint">
          ลากเพื่อย้าย หรือดึงขอบบน/ล่างเพื่อปรับเวลา — เวลา Activity ต้องไม่ซ้อนกัน
          — คลิกขวาที่แถบกิจกรรมเพื่อตั้งค่า
          — กด "บันทึก" เพื่อ sync กลับ Google Calendar
        </p>
        <button
          type="button"
          className="btn-icon timeline-editor-export"
          onClick={() =>
            downloadDayTimelineImage({ day, activities: timedActivities, allActivities, categories, activityCategoryMap })
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

      {/* Reserve status space so non-overlap save feedback never shifts the
          grid beneath the pointer during a drag. */}
      <div className="timeline-editor-status" aria-live="polite">
        {overlapError && <p className="timeline-editor-error" role="alert">{overlapError}</p>}
      </div>

      {timedActivities.length === 0 && incomingSpillover.length === 0 ? (
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

            <div className={`day-timeline-events-layer${dragState ? " is-direct-dragging" : ""}`}>
              {incomingSpillover.map(({ activity, spilloverEndMin }) => {
                const height = (spilloverEndMin / 60) * EDIT_HOUR_HEIGHT;
                const color = getDisplayColor(activity, activityCategoryMap, categories);
                const { column, columns } = overlapLayout[`spillover-in-${activity.id}`] || { column: 0, columns: 1 };
                const widthPercent = 100 / columns;
                const leftPercent = column * widthPercent;
                return (
                  <div
                    key={`spillover-in-${activity.id}`}
                    className="day-timeline-editable-event day-timeline-spillover"
                    style={{
                      top: 0,
                      height,
                      left: `calc(${leftPercent}% + ${column > 0 ? OVERLAP_GUTTER / 2 : 0}px)`,
                      width: `calc(${widthPercent}% - ${OVERLAP_GUTTER}px)`,
                      background: color.bg,
                      borderLeftColor: color.border
                    }}
                    onClick={() => onEditActivity?.(activity)}
                    title={`ต่อเนื่องจากเมื่อคืน — ${activity.summary || "(ไม่มีชื่อ)"}`}
                  >
                    <span className="day-timeline-event-title-row">
                      <AutoShrinkText
                        text={`⤴ ${activity.summary || "(ไม่มีชื่อ)"}`}
                        className="day-timeline-event-title"
                      />
                    </span>
                    <span className="day-timeline-event-time">ต่อจากเมื่อคืน – {minutesToLabel(spilloverEndMin)}</span>
                  </div>
                );
              })}

              {timedActivities.map((activity) => {
                const { start, end } = getTimes(activity);
                const startMin = minutesOfDay(start);
                // For an overnight activity (end on a later calendar day
                // than start), the visible block should stop at midnight
                // (1440) — plain minutesOfDay(end) would incorrectly wrap
                // "02:00 next day" back to 120, which is LESS than
                // startMin, making the block render far too short instead
                // of extending to the bottom of the grid. isOvernight
                // checks the actual calendar day, not just whether the
                // clock time looks earlier.
                const isOvernight = end.getFullYear() !== start.getFullYear() ||
                  end.getMonth() !== start.getMonth() ||
                  end.getDate() !== start.getDate();
                const endMin = isOvernight
                  ? 1440
                  : Math.max(startMin + SNAP_MINUTES, minutesOfDay(end));
                const top = ((startMin - EDIT_DAY_START_HOUR * 60) / 60) * EDIT_HOUR_HEIGHT;
                const height = ((endMin - startMin) / 60) * EDIT_HOUR_HEIGHT;
                const color = getDisplayColor(activity, activityCategoryMap, categories);
                const isDragging = dragState?.activityId === activity.id;
                const locked = isLocked(activity.id);
                const layout = isDragging
                  ? { column: 0, columns: 1 }
                  : (overlapLayout[activity.id] || { column: 0, columns: 1 });
                const { column, columns } = layout;
                const widthPercent = 100 / columns;
                const leftPercent = column * widthPercent;
                // Uses the real (un-wrapped) end time, not endMin above — so
                // this correctly detects "runs past midnight" even while
                // endMin itself is clamped back to display within the grid.
                const outgoing = getOutgoingSpillover(start, end, day);
                const spilloverHeight = outgoing
                  ? (Math.min(outgoing.spilloverMinutes, 1440) / 60) * EDIT_HOUR_HEIGHT
                  : 0;
                // The label always shows the real end time (e.g. "20:00 –
                // 02:00") — plain minutesOfDay(end) is fine here since it's
                // just wall-clock hours:minutes, no day-boundary math needed
                // for display purposes.
                const endLabel = minutesToLabel(minutesOfDay(end));
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
                    <span className="day-timeline-event-title-row">
                      {locked && <span className="day-timeline-lock-icon">🔒</span>}
                      <AutoShrinkText
                        text={activity.summary || "(ไม่มีชื่อ)"}
                        className="day-timeline-event-title"
                      />
                    </span>
                    <span className="day-timeline-event-time">
                      {minutesToLabel(startMin)} – {endLabel}
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
                    {outgoing && (
                      <div
                        className="day-timeline-spillover-tail"
                        style={{ height: spilloverHeight }}
                        title={`ต่อไปถึงพรุ่งนี้ — ${minutesToLabel(outgoing.spilloverMinutes)} น. (แสดงในวันถัดไปด้วย)`}
                      >
                        <span className="day-timeline-spillover-tail-label">ต่อพรุ่งนี้ ⤵</span>
                      </div>
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
              // Keep the raw recurring occurrence id for a one-instance
              // delete. Normalizing it targets the recurring master instead.
              onDelete={() => onDeleteActivity?.(contextActivity.id)}
              onDeleteSeries={
                contextActivity.recurringEventId
                  ? () => onDeleteSeries?.(contextActivity.recurringEventId)
                  : undefined
              }
              onDuplicate={() => onDuplicateActivity?.(contextActivity)}
              onMoveToDay={(dateStr) => onMoveActivityToDay?.(normalizeActivityId(contextActivity.id), dateStr)}
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
