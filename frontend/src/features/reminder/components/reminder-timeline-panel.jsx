import { formatDigitalClock } from "../lib/reminder-formatters.js";
import AutoShrinkText from "../../../shared/ui/auto-shrink-text.jsx";
import { localDateKey } from "../lib/reminder-date-view.js";
import { REMINDER_TYPE } from "../lib/reminder-due-logic.js";

/** Timeline presentation only. Positions and event layouts stay in useReminderTimeline. */
export default function ReminderTimelinePanel({
  t, selectedDateKey, nowTick, isExporting, onExport, zoomIndex, zoomIn, zoomOut,
  minutesPerRow, zoomLevelCount, activityNowStatus, tapeScrollRef, onUserInteraction,
  timelineTrackMinWidth, spacerHeight, timelineRows, runningReminderSpans,
  calendarTimelineBlocks, onEditActivity, onOpenActivityMenu
}) {
  const isToday = selectedDateKey === localDateKey();
  return <aside className="timeline-panel">
    <div className="timeline-header">
      <p className="timeline-title">{t("reminder.timeline24h")} · {selectedDateKey}</p>
      <div className="timeline-header-actions">
        <button type="button" className="timeline-export-btn" title="บันทึกภาพ timeline reminder" disabled={isExporting} onClick={onExport}>⇩ <span>{isExporting ? "…" : "PNG"}</span></button>
        <div className="zoom-controls">
          <button type="button" className="zoom-btn" onClick={zoomOut} disabled={zoomIndex === 0} title={t("reminder.zoomOut")}>−</button>
          <span className="zoom-display">{t("reminder.minutesPerSlot", { minutes: minutesPerRow })}</span>
          <button type="button" className="zoom-btn" onClick={zoomIn} disabled={zoomIndex === zoomLevelCount - 1} title={t("reminder.zoomIn")}>+</button>
        </div>
      </div>
    </div>
    <div className="timeline-viewport">
      {isToday && activityNowStatus && <div className="timeline-activity-status" title={activityNowStatus.title} style={{ "--timeline-status-color": activityNowStatus.color.border }}><AutoShrinkText text={activityNowStatus.title} minScale={0.5} className="timeline-activity-status-title" /><strong>{activityNowStatus.text}</strong></div>}
      <div hidden={!isToday} className="now-indicator" aria-label={`เวลาปัจจุบัน ${formatDigitalClock(nowTick)}`}><span className="now-indicator-clock">{formatDigitalClock(nowTick)}</span></div>
      <div className="tape-scroll-container" ref={tapeScrollRef} onScroll={onUserInteraction} onWheel={onUserInteraction} onTouchMove={onUserInteraction}>
        <div className="tape-track-wrapper" style={{ minWidth: `max(100%, ${timelineTrackMinWidth}px)` }}>
          <div className="tape-spacer tape-spacer-top" style={{ height: `${spacerHeight}px` }} />
          {timelineRows}
          <div className="running-reminder-layer" aria-label="Timer และ Stopwatch ที่กำลังทำงาน">
            {runningReminderSpans.map((span) => <div key={span.id} className={`running-reminder-span is-${span.type}`} style={{ top: `${span.top}px`, height: `${span.height}px`, "--running-reminder-color": span.color }} title={`${span.type === REMINDER_TYPE.COUNTDOWN ? "Timer" : "Stopwatch"}: ${span.title}`} />)}
          </div>
          <div className="calendar-timeline-layer" aria-label="กิจกรรมในปฏิทินของวันนี้">
            {calendarTimelineBlocks.filter((block) => !block.hidden).map((block) => <button key={block.id} type="button" className={`calendar-timeline-block${block.isActive ? " is-current" : ""}${block.titleBelow ? " has-stacked-title" : ""}`} style={{ top: `${block.top}px`, height: `${block.height}px`, left: "84px", width: `calc(100% - ${92 + block.stackIndex * 10}px)`, right: "auto", zIndex: block.stackZ, "--calendar-activity-border": block.color.border, "--calendar-activity-bg": block.color.bg }} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onEditActivity?.(block.activity); }} onContextMenu={(event) => onOpenActivityMenu(event, block)} title={`แก้ไขกิจกรรม: ${block.title}`} aria-label={`แก้ไขกิจกรรม: ${block.title}`}><span className={`calendar-timeline-block-title${block.titleBelow ? " is-stacked" : ""}${block.titleOffsetMinutes > 0 ? " is-relocated" : ""}`} style={block.titleOffsetMinutes > 0 ? { top: `${(block.titleOffsetMinutes / Math.max(1, block.endMin - block.startMin)) * 100}%` } : undefined}>{block.title}</span>{block.hiddenCount > 0 && <small className="calendar-timeline-overflow-count">+{block.hiddenCount}</small>}</button>)}
          </div>
          <div className="tape-spacer tape-spacer-bottom" style={{ height: `${spacerHeight}px` }} />
        </div>
      </div>
    </div>
  </aside>;
}
