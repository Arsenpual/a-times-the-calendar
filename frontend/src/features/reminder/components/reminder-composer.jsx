import React from "react";
import { REMINDER_TYPE, supportsEventAnchorSession } from "../lib/reminder-due-logic.js";
import { useLanguage } from "../../../shared/i18n/i18n.jsx";

function ColorPicker({ draft, setDraft, options }) {
  return <div className="color-picker-group">
    {options.map((color) => <button key={color.value} type="button" className={`color-swatch-btn ${draft.lineColor === color.value ? "selected" : ""}`} style={{ backgroundColor: color.value }} title={color.label} aria-label={color.label} onClick={() => setDraft((current) => ({ ...current, lineColor: color.value }))} />)}
    <label className="color-swatch-btn color-swatch-custom" title="เลือกสีเอง" style={{ backgroundColor: draft.lineColor }}>
      <input type="color" value={draft.lineColor} onChange={(event) => setDraft((current) => ({ ...current, lineColor: event.target.value }))} />
    </label>
  </div>;
}

function ComposerPreview({ preview }) {
  const quota = preview.notificationQuota;
  return <section className="reminder-composer-preview" aria-live="polite">
    <p className="reminder-composer-preview-label">สรุปก่อนบันทึก</p>
    <div className="reminder-composer-preview-heading"><strong>{preview.title}</strong><span>{preview.typeLabel}</span></div>
    <div className="reminder-composer-preview-fields">
      {preview.fields.map(({ label, value }) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    {preview.footnote && <p className="reminder-composer-preview-note">{preview.footnote}</p>}
    <div className={`reminder-composer-quota${quota.isAtLimit ? " is-at-limit" : ""}`} role={quota.isAtLimit ? "alert" : undefined}>
      <div className="reminder-composer-quota-heading"><span>โควตาแจ้งเตือนวันนี้</span><strong>{quota.projectedNotificationCount} / {quota.limit}</strong></div>
      <p>Reminder เดิม {quota.existingReminderCount} · Activity {quota.activityNotificationCount} · รายการนี้ {quota.draftNotificationCount}</p>
      {quota.isAtLimit && <p className="reminder-composer-quota-warning">
        {quota.projectedNotificationCount > quota.limit
          ? `เกินขีดจำกัด ${quota.projectedNotificationCount - quota.limit} ครั้ง — ระบบจะไม่ส่งรายการที่เกิน 720 ครั้ง/วัน`
          : "ถึงขีดจำกัด 720 ครั้ง/วันแล้ว — การแจ้งเตือนรายการถัดไปอาจไม่ถูกส่ง"}
      </p>}
    </div>
  </section>;
}

function EventAnchorSessionFields({ draft, update, t }) {
  const renderPhase = (phase) => {
    const isCountdown = phase === "countdown";
    const enabledKey = isCountdown ? "eventAnchorCountdownEnabled" : "eventAnchorStopwatchEnabled";
    const amountKey = isCountdown ? "eventAnchorCountdownAmount" : "eventAnchorStopwatchAmount";
    const unitKey = isCountdown ? "eventAnchorCountdownUnit" : "eventAnchorStopwatchUnit";
    const titleKey = isCountdown ? "eventAnchorCountdownTitle" : "eventAnchorStopwatchTitle";
    const label = t(isCountdown ? "reminder.eventAnchorCountdown" : "reminder.eventAnchorStopwatch");
    return <div className="notification-buffer-row" key={phase}>
      <button type="button" role="switch" aria-checked={draft[enabledKey]} className={`interval-window-toggle${draft[enabledKey] ? " is-active" : ""}`} onClick={() => update({ [enabledKey]: !draft[enabledKey] })}>
        <span className="interval-window-toggle-track" aria-hidden="true" />
        <span>{label}</span>
      </button>
      {draft[enabledKey] && <div className="freq-inline-group notification-buffer-inputs">
        <input className="form-input" type="number" min="1" max={draft[unitKey] === "hours" ? 24 : 1440} value={draft[amountKey]} onChange={(event) => update({ [amountKey]: event.target.value })} aria-label={label} />
        <select className="form-select" value={draft[unitKey]} onChange={(event) => update({ [unitKey]: event.target.value })}>
          <option value="minutes">{t("reminder.minutes")}</option><option value="hours">{t("reminder.hours")}</option>
        </select>
      </div>}
      {draft[enabledKey] && <input className="form-input" value={draft[titleKey]} onChange={(event) => update({ [titleKey]: event.target.value })} placeholder={isCountdown ? "ชื่อ Countdown ชั่วคราว (ไม่บังคับ)" : "ชื่อ Stopwatch ชั่วคราว (ไม่บังคับ)"} aria-label={`ชื่อ ${label}`} />}
    </div>;
  };
  return <section className="form-field notification-buffer-fields">
    <label>{t("reminder.eventAnchorSession")}</label>
    <p className="form-hint">{t("reminder.eventAnchorSessionHint")}</p>
    {renderPhase("countdown")}
    {renderPhase("stopwatch")}
  </section>;
}

/** The complete add/edit surface. Draft state and mutations are injected by the feature shell. */
export default function ReminderComposer({
  open, draft, setDraft, editingId, groups, typeOptions, daysOfWeek, lineColorOptions,
  preview, cardRef, onSubmit, onCancel, onDelete, onToggleDay
}) {
  const { t } = useLanguage();
  if (!open) return null;
  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));
  return <div className="composer-backdrop" onMouseDown={onCancel}>
    <form ref={cardRef} className="composer-card" onMouseDown={(event) => event.stopPropagation()} onSubmit={onSubmit}>
      <div className="form-field">
        <label htmlFor="reminder-title">{t("reminder.title")}</label>
        <input id="reminder-title" className="form-input" value={draft.title} onChange={(event) => update({ title: event.target.value })} placeholder={t("reminder.titlePlaceholder")} />
      </div>
      <div className="form-field">
        <label htmlFor="reminder-type">{t("reminder.type")}</label>
        <select id="reminder-type" className="form-select" value={draft.type} onChange={(event) => update({ type: event.target.value })}>
          {typeOptions.map((option) => <option key={option.type} value={option.type}>{t(option.labelKey)}</option>)}
        </select>
      </div>
      {groups.length > 0 && <div className="form-field">
        <label htmlFor="reminder-group">{t("reminder.groupOptional")}</label>
        <select id="reminder-group" className="form-select" value={draft.groupId ?? ""} onChange={(event) => update({ groupId: event.target.value || null })}>
          <option value="">{t("reminder.noGroup")}</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </div>}
      {draft.type === REMINDER_TYPE.INTERVAL && <>
        <div className="form-field"><label htmlFor="reminder-amount">{t("reminder.frequency")}</label>
          <div className="freq-inline-group"><input id="reminder-amount" className="form-input" type="number" min="1" value={draft.amount} onChange={(event) => update({ amount: event.target.value })} />
            <select className="form-select" value={draft.unit} onChange={(event) => update({ unit: event.target.value })}><option value="minutes">{t("reminder.minutes")}</option><option value="hours">{t("reminder.hours")}</option></select>
          </div>
        </div>
        <div className="form-field">
          <button type="button" role="switch" aria-checked={draft.runAllDay} className={`interval-window-toggle${draft.runAllDay ? " is-active" : ""}`} onClick={() => setDraft((current) => ({ ...current, runAllDay: !current.runAllDay, ...(!current.runAllDay ? { windowStart: "", windowEnd: "" } : {}) }))}><span className="interval-window-toggle-track" aria-hidden="true" /><span>{t("reminder.runAllDay")}</span></button>
          {!draft.runAllDay && <><label>{t("reminder.activeWindow")}</label><div className="composer-row"><input className="form-input" type="time" value={draft.windowStart} onChange={(event) => update({ windowStart: event.target.value })} /><input className="form-input" type="time" value={draft.windowEnd} onChange={(event) => update({ windowEnd: event.target.value })} /></div></>}
        </div>
      </>}
      {draft.type === REMINDER_TYPE.WEEKLY && <>
        <div className="form-field"><label>{t("reminder.selectWeekdays")}</label><div className="day-selector">{daysOfWeek.map((day) => <button key={day.value} type="button" className={`day-btn ${draft.days.includes(day.value) ? "selected" : ""}`} onClick={() => onToggleDay(day.value)}>{t(day.labelKey)}</button>)}</div></div>
        <div className="form-field"><label>{t("reminder.time")}</label>
          {(draft.times || [draft.time]).map((time, index) => <div className="weekly-time-row" key={`${time}-${index}`}><input className="form-input" type="time" value={time} onChange={(event) => setDraft((current) => ({ ...current, times: current.times.map((value, itemIndex) => itemIndex === index ? event.target.value : value) }))} /><button type="button" className="icon-btn" disabled={draft.times.length === 1} onClick={() => setDraft((current) => ({ ...current, times: current.times.filter((_, itemIndex) => itemIndex !== index) }))}>✕</button></div>)}
          <button type="button" className="btn-text weekly-add-time" onClick={() => setDraft((current) => ({ ...current, times: [...current.times, "12:00"] }))}>{t("reminder.addTime")}</button>
        </div>
      </>}
      {draft.type === REMINDER_TYPE.EVENT_ANCHORED && <><div className="form-field"><label>{t("reminder.eventReference")}</label><input className="form-input" value={draft.eventName} onChange={(event) => update({ eventName: event.target.value })} placeholder={t("reminder.eventReferencePlaceholder")} /></div><div className="form-field"><label>{t("reminder.afterEvent")}</label><div className="freq-inline-group"><input className="form-input" type="number" min="1" value={draft.afterAmount} onChange={(event) => update({ afterAmount: event.target.value })} /><select className="form-select" value={draft.afterUnit} onChange={(event) => update({ afterUnit: event.target.value })}><option value="minutes">{t("reminder.minutes")}</option><option value="hours">{t("reminder.hours")}</option></select></div></div></>}
      {draft.type === REMINDER_TYPE.ROUTINE && <div className="form-field"><label>{t("reminder.steps")}</label><input className="form-input" value={draft.routineSteps} onChange={(event) => update({ routineSteps: event.target.value })} placeholder={t("reminder.stepsPlaceholder")} /></div>}
      {draft.type === REMINDER_TYPE.ONCE_AT && <div className="composer-row form-field"><div><label htmlFor="at-date">{t("reminder.date")}</label><input id="at-date" className="form-input" type="date" value={draft.atDate} onChange={(event) => update({ atDate: event.target.value })} /></div><div><label htmlFor="at-time">{t("reminder.time")}</label><input id="at-time" className="form-input" type="time" value={draft.atTime} onChange={(event) => update({ atTime: event.target.value })} /></div></div>}
      {draft.type === REMINDER_TYPE.COUNTDOWN && <><div className="form-field"><label htmlFor="countdown-minutes">{t("reminder.durationMinutes")}</label><input id="countdown-minutes" className="form-input" type="number" min="1" max="1440" value={draft.countdownMinutes} onChange={(event) => update({ countdownMinutes: event.target.value })} /></div><div className="form-field"><label>{t("reminder.timelineColor")}</label><ColorPicker draft={draft} setDraft={setDraft} options={lineColorOptions} /></div></>}
      {draft.type === REMINDER_TYPE.STOPWATCH && <><p className="form-hint">{t("reminder.stopwatchHint")}</p><div className="form-field"><label>{t("reminder.timelineColor")}</label><ColorPicker draft={draft} setDraft={setDraft} options={lineColorOptions} /></div></>}
      {supportsEventAnchorSession(draft.type) && <EventAnchorSessionFields draft={draft} update={update} t={t} />}
      <ComposerPreview preview={preview} />
      <div className="composer-actions">
        {editingId && <button className="btn-text btn-delete-reminder" type="button" onClick={onDelete}>{t("reminder.delete")}</button>}
        <button className="btn-text" type="button" onClick={onCancel}>{t("reminder.cancel")}</button>
        <button className="btn-contained" type="submit">{editingId ? t("reminder.save") : t("reminder.addReminder")}</button>
      </div>
    </form>
  </div>;
}
