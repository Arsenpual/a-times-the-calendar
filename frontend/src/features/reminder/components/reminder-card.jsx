import { formatDurationClock, describeReminder, describeEventAnchorSession } from "../lib/reminder-formatters.js";
import { createPortal } from "react-dom";
import { REMINDER_TYPE, isOneShotType } from "../lib/reminder-due-logic.js";
import { getIntervalWorkSummary } from "../lib/interval-schedule.js";

const TYPE_ACCENT_COLOR = {
  [REMINDER_TYPE.INTERVAL]: "var(--g-blue)",
  [REMINDER_TYPE.WEEKLY]: "var(--g-green)",
  [REMINDER_TYPE.EVENT_ANCHORED]: "var(--g-purple)",
  [REMINDER_TYPE.ROUTINE]: "var(--g-teal)",
  [REMINDER_TYPE.ONCE_AT]: "var(--g-red)",
  [REMINDER_TYPE.COUNTDOWN]: "var(--g-yellow)",
  [REMINDER_TYPE.STOPWATCH]: "var(--g-on-surface-variant)"
};

function priorityFor(reminder, nowTick, t) {
  if (reminder.completedAt) return { label: t("reminder.completed"), tone: "completed" };
  if (!reminder.enabled) return { label: t("reminder.status.paused"), tone: "paused" };
  if (Number.isFinite(reminder.nextDueAt)) {
    const remainingSeconds = Math.ceil((reminder.nextDueAt - nowTick) / 1000);
    if (remainingSeconds <= 0) return { label: t("reminder.status.due"), tone: "due" };
    return { label: t("reminder.status.next", { time: formatDurationClock(remainingSeconds) }), tone: "next" };
  }
  if (reminder.type === REMINDER_TYPE.EVENT_ANCHORED) return { label: t("reminder.status.waiting"), tone: "waiting" };
  return { label: t("reminder.status.active"), tone: "active" };
}

function typeIcon(type) {
  if (type === REMINDER_TYPE.WEEKLY) return "📅";
  if (type === REMINDER_TYPE.EVENT_ANCHORED) return "⚓";
  if (type === REMINDER_TYPE.ROUTINE) return "📋";
  if (type === REMINDER_TYPE.ONCE_AT) return "1x";
  if (type === REMINDER_TYPE.COUNTDOWN) return "⏱";
  if (type === REMINDER_TYPE.STOPWATCH) return "⏱️";
  return "↻";
}

function activeEventSessionLabel(session, nowTick) {
  if (session.eventAnchorPhase === "countdown") {
    const remainingSeconds = Math.max(0, Math.ceil(((session.startedAt + session.durationMs) - nowTick) / 1000));
    return `⏳ ${session.title} · ${formatDurationClock(remainingSeconds)}`;
  }
  const elapsedSeconds = Math.max(0, Math.floor((nowTick - session.startedAt) / 1000));
  return `⏱ ${session.title} · ${formatDurationClock(elapsedSeconds)}`;
}

/** Presentational card; all state mutations remain in ReminderDashboard hooks. */
export default function ReminderCard({
  reminder, nowTick, t, groups, typeOptions, daysOfWeek, cardMenu,
  onFocusTimeline, onStartEdit, onTriggerAnchor, onAdvanceRoutine,
  onToggleStopwatch, onResetStopwatch, onToggleReminder, onToggleMenu,
  onCloseMenu, onMarkCompleted, onDelete
}) {
  const priority = priorityFor(reminder, nowTick, t);
  const typeLabel = t(typeOptions.find((option) => option.type === reminder.type)?.labelKey);
  const group = reminder.groupId ? groups.find((item) => item.id === reminder.groupId) : null;
  const weeklyDaysLabel = reminder.type === REMINDER_TYPE.WEEKLY
    ? daysOfWeek.filter((day) => reminder.days?.includes(day.value)).map((day) => t(day.labelKey)).join(" · ")
    : null;
  const intervalWorkSummary = reminder.type === REMINDER_TYPE.INTERVAL ? getIntervalWorkSummary(reminder) : null;
  const intervalHours = intervalWorkSummary && intervalWorkSummary.workMinutes / 60;
  const intervalWorkLabel = intervalHours % 1 === 0 ? `${intervalHours} ชม.` : `${intervalWorkSummary?.workMinutes} นาที`;
  const isMenuOpen = cardMenu?.id === reminder.id;
  const accentColor = TYPE_ACCENT_COLOR[reminder.type];
  const eventAnchorSummary = describeEventAnchorSession(reminder);
  const isDerivedSession = Boolean(reminder.isEventAnchorDerived);
  const sourceReminder = reminder.sourceReminder || reminder;
  const activeEventAnchorSessions = reminder.activeEventAnchorSessions || [];

  return <div className={`reminder-card ${reminder.enabled ? "active" : ""}${isMenuOpen ? " menu-open" : ""}`} style={{ borderLeftColor: accentColor }}>
    <button type="button" className="reminder-type-icon" style={{ backgroundColor: accentColor, color: reminder.type === REMINDER_TYPE.COUNTDOWN ? "#202124" : "#fff" }} onClick={() => onFocusTimeline(reminder)} title="เลื่อน Timeline มาที่เวลาของ Reminder" aria-label={`เลื่อน Timeline มาที่ ${reminder.title}`}>{typeIcon(reminder.type)}</button>
    <div className="reminder-info" role="button" tabIndex={0} onClick={() => onStartEdit(sourceReminder)} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onStartEdit(sourceReminder); }
    }} title="คลิกเพื่อแก้ไข Reminder">
      <div className="reminder-card-title-row"><p className="title">{reminder.title}</p><span className={`reminder-priority reminder-priority--${priority.tone}`}>{priority.label}</span></div>
      <p className="reminder-schedule-detail">{describeReminder(reminder, nowTick)}</p>
      {eventAnchorSummary && <p className="reminder-buffer-detail">⏳ {eventAnchorSummary}</p>}
      {eventAnchorSummary && <span className="reminder-type-chip">Event session พร้อมใช้</span>}
      {activeEventAnchorSessions.map((session) => <p key={session.id} className="reminder-active-event-session" title={session.eventAnchorPhase === "countdown" ? "Countdown ชั่วคราวกำลังทำงาน" : "Stopwatch ชั่วคราวกำลังทำงาน"}>
        {activeEventSessionLabel(session, nowTick)}
      </p>)}
      {isDerivedSession && <p className="reminder-buffer-detail">ชั่วคราว · จาก {sourceReminder.title}</p>}
      {weeklyDaysLabel && <p className="reminder-weekly-days-detail"><span>{t("reminder.weeklyDays")}</span>{weeklyDaysLabel}</p>}
      {reminder.completedAt && <span className="reminder-completed-badge">✓ ทำเสร็จแล้ว{reminder.type === REMINDER_TYPE.ROUTINE ? ` · ทำครบ ${reminder.completionCount || 0} ครั้ง` : ""}</span>}
      {intervalWorkSummary && <p className="reminder-interval-summary" title={`ช่วงทำงาน ${intervalWorkSummary.range || "ตลอดวัน"} · แจ้งเตือน ${intervalWorkSummary.notificationCount} ครั้ง`}><span>{intervalWorkLabel}</span><span aria-hidden="true">·</span><strong>{intervalWorkSummary.notificationCount} รอบ</strong></p>}
      <div className="reminder-card-metadata"><span className="reminder-type-chip">{typeLabel}</span>{group && <span className="reminder-group-chip"><span className="reminder-group-chip-dot" style={{ background: group.color }} />{group.name}</span>}</div>
      {reminder.type === REMINDER_TYPE.EVENT_ANCHORED && <button type="button" className="btn-action-small" onClick={(event) => { event.stopPropagation(); onTriggerAnchor(reminder.id); }}>⚡ เริ่มเหตุการณ์ "{reminder.eventName}"</button>}
      {reminder.type === REMINDER_TYPE.ROUTINE && reminder.enabled && <button type="button" className="btn-action-small" onClick={(event) => { event.stopPropagation(); onAdvanceRoutine(reminder.id); }}>✓ ทำเสร็จแล้ว ({reminder.steps[reminder.currentIndex]})</button>}
    </div>
    {!isDerivedSession && (reminder.type === REMINDER_TYPE.STOPWATCH ? <div className="stopwatch-controls"><button type="button" className={`btn-stopwatch ${reminder.enabled ? "stop" : "start"}`} onClick={() => onToggleStopwatch(reminder.id)}>{reminder.enabled ? "⏸ Stop" : "▶ Start"}</button><button type="button" className="icon-btn" onClick={() => onResetStopwatch(reminder.id)} title="รีเซ็ตเป็น 0">↺</button></div> : <button type="button" className={`toggle-switch ${reminder.enabled ? "on" : ""}`} onClick={() => onToggleReminder(reminder.id)} aria-label="สวิตช์เปิดปิด" />)}
    {!isDerivedSession && <div className={`reminder-card-actions ${isMenuOpen ? "menu-open" : ""}`}><button type="button" className="icon-btn" onClick={(event) => onToggleMenu(event, reminder.id)} title="ตัวเลือกเพิ่มเติม" aria-haspopup="true" aria-expanded={isMenuOpen}>⋮</button>
      {isMenuOpen && createPortal(<div className="card-dropdown-menu" role="menu" onPointerDown={(event) => event.stopPropagation()} style={{ "--card-menu-x": `${cardMenu.position.x}px`, "--card-menu-y": `${cardMenu.position.y}px` }}><button type="button" role="menuitem" onClick={() => { onCloseMenu(); onStartEdit(reminder); }}>✏️ แก้ไข</button>{isOneShotType(reminder.type) && !reminder.completedAt && <button type="button" role="menuitem" onClick={() => { onCloseMenu(); onMarkCompleted(reminder.id); }}>✓ ทำเสร็จแล้ว</button>}<button type="button" role="menuitem" className="is-danger" onClick={() => { onCloseMenu(); onDelete(reminder.id); }}>🗑️ ลบ</button></div>, document.body)}
    </div>}
  </div>;
}
