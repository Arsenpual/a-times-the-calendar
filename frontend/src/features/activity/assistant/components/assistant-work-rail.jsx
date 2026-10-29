import { useEffect, useState } from "react";
import { isGuidedActivityFieldComplete } from "../lib/guided-activity-validation.js";
import { activityDate, buildMonthGrid, formatMonthYear, formatTime, toDateInputValue, weekdayShortLabels } from "../../../../shared/lib/date-utils.js";

function nextDate(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toDateInputValue(date);
}

function upcomingActivities(activities) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (Array.isArray(activities) ? activities : [])
    .map((activity) => ({ activity, start: activityDate(activity?.start) }))
    .filter(({ start }) => start && start >= today)
    .sort((left, right) => left.start - right.start)
    .slice(0, 5);
}

function activityWhen({ activity, start }) {
  const isAllDay = Boolean(activity?.start?.date && !activity?.start?.dateTime);
  const date = start.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  return `${date} · ${isAllDay ? "ทั้งวัน" : formatTime(start)}`;
}

function requiresFullActivityEditor(activity) {
  return Boolean(
    activity?.recurringEventId ||
    (Array.isArray(activity?.recurrence) && activity.recurrence.length > 0) ||
    (activity?.start?.date && !activity?.start?.dateTime)
  );
}

function dateMonth(dateValue) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateValue || "") ? new Date(`${dateValue}T00:00`) : new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function AssistantWorkRail({ setWorkRailOpen, guidedActivity, editingActivity, railMode, railSaving, conversationNodeId, scheduleResolution, pending, updateGuidedActivityField, advanceGuidedStepFromRail, startGuidedActivityFromRail, startGuidedActivityEditFromRail, deleteGuidedActivityFromRail, cancelGuidedActivityFromRail, saveGuidedActivityFromRail, retryGuidedActivityDraft, renderTelegramArchive, activitySteps, activities, onOpenExistingActivity, telegramUnreadCount = 0, onMarkTelegramRead }) {
  const [chosenStep, setChosenStep] = useState(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [repeatDates, setRepeatDates] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => dateMonth());
  const [calendarPickerDate, setCalendarPickerDate] = useState("");
  const [telegramOpen, setTelegramOpen] = useState(false);
  const hasGuidedActivity = Boolean(guidedActivity);
  useEffect(() => { setChosenStep(null); setDeleteConfirmationOpen(false); if (!hasGuidedActivity || editingActivity) { setRepeatDates([]); setCalendarMonth(dateMonth()); setCalendarPickerDate(""); } }, [conversationNodeId, hasGuidedActivity, editingActivity]);
  useEffect(() => {
    if (!editingActivity && guidedActivity?.date && repeatDates.length === 0) setRepeatDates([guidedActivity.date]);
  }, [editingActivity, guidedActivity?.date, repeatDates.length]);
  const currentIndex = Math.max(0, activitySteps.findIndex((step) => step.node === (chosenStep || conversationNodeId)));
  const currentStep = activitySteps[currentIndex];
  const complete = activitySteps.map((step) => isGuidedActivityFieldComplete(step.field, guidedActivity?.[step.field]));
  const allComplete = complete.every(Boolean);
  const upcoming = upcomingActivities(activities);
  const chooseStep = (index) => {
    if (pending || railSaving) return;
    setChosenStep(activitySteps[index].node);
  };
  const changeField = (field, value, advance = false) => {
    updateGuidedActivityField(field, value);
    if (advance && currentIndex < activitySteps.length - 1 && isGuidedActivityFieldComplete(field, value)) {
      advanceGuidedStepFromRail(activitySteps[currentIndex + 1].node);
      setChosenStep(activitySteps[currentIndex + 1].node);
    }
  };
  const disabled = pending || railSaving;
  const calendarDays = buildMonthGrid(calendarMonth).filter((date) => date.getMonth() === calendarMonth.getMonth());
  const todayValue = toDateInputValue(new Date());
  const selectRepeatDate = (date) => {
    const value = toDateInputValue(date);
    setRepeatDates((current) => {
      const exists = current.includes(value);
      const next = exists ? current.filter((item) => item !== value) : [...current, value].sort();
      if (!next.length) return current;
      if (next.length > 28) return current;
      setCalendarPickerDate(value);
      updateGuidedActivityField("date", next[0]);
      return next;
    });
  };
  const setSingleDate = (value, advance = false) => {
    setCalendarPickerDate(value);
    setCalendarMonth(dateMonth(value));
    setRepeatDates(value ? [value] : []);
    changeField("date", value, advance);
  };
  const addDateFromPicker = (value) => {
    if (!value) return;
    setCalendarMonth(dateMonth(value));
    selectRepeatDate(new Date(`${value}T00:00`));
  };
  const clearRepeatDates = () => {
    setRepeatDates([]);
    setCalendarPickerDate("");
    updateGuidedActivityField("date", "");
  };
  const toggleTelegram = () => {
    setTelegramOpen((current) => {
      const next = !current;
      if (next) onMarkTelegramRead?.();
      return next;
    });
  };

  return (
    <aside id="activity-ai-work-rail" className={`activity-ai-work-rail${hasGuidedActivity ? " is-creating-activity" : ""}`} aria-label="แผงงาน AI">
      <header className="activity-ai-rail-header"><strong>{telegramOpen ? "Telegram" : "แผงงาน"}</strong><div><button type="button" className={`activity-ai-rail-telegram-toggle${telegramOpen ? " is-active" : ""}`} onClick={toggleTelegram} aria-label={telegramOpen ? "กลับไปแผงงาน" : "เปิดแชท Telegram"} title={telegramOpen ? "กลับไปแผงงาน" : "เปิดแชท Telegram"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.7 3.4 18.5 20c-.2 1.2-1 1.5-1.9.9l-5.2-3.8-2.5 2.4c-.3.3-.5.5-1 .5l.4-5.3 9.7-8.8c.4-.4-.1-.6-.7-.2L5.4 13.2.3 11.6c-1.1-.4-1.1-1.1.2-1.6L20.3 2.4c.9-.3 1.7.2 1.4 1Z" /></svg>{telegramUnreadCount > 0 && <span className="activity-ai-rail-telegram-unread" aria-label={`${telegramUnreadCount > 99 ? "99+" : telegramUnreadCount} ข้อความยังไม่อ่าน`}>{telegramUnreadCount > 99 ? "99+" : telegramUnreadCount}</span>}</button><button type="button" onClick={() => setWorkRailOpen(false)} aria-label="ซ่อนแผงงาน">×</button></div></header>
      <div className={`activity-ai-rail-content${telegramOpen ? " is-telegram-open" : ""}`}>
        {telegramOpen ? renderTelegramArchive("rail-full") : <>
        {hasGuidedActivity ? <div className="activity-ai-rail-progress">
          <h2>{editingActivity ? "แก้ไขกิจกรรม" : "สร้างกิจกรรม"}</h2>
          <ol aria-label="ขั้นตอนสร้างกิจกรรม">{activitySteps.map((step, index) => (
            <li key={step.node} aria-current={index === currentIndex ? "step" : undefined} className={complete[index] ? "is-done" : ""}>
              <button type="button" aria-label={`เลือกขั้นตอน${step.label}`} onClick={() => chooseStep(index)} disabled={disabled}>
                <span aria-hidden="true">{complete[index] ? "✓" : index + 1}</span>{step.label}
              </button>
            </li>
          ))}</ol>
          {scheduleResolution && <p className="activity-ai-rail-conflict">เวลาที่เลือกชนเกินจำนวนที่รองรับ เลือกเวลาอื่นก่อนบันทึก</p>}
          <div className="activity-ai-rail-fields">
            {currentStep.field === "date" && <>
              <label htmlFor="activity-ai-rail-date">วันที่เริ่มกิจกรรม</label>
              <div className="activity-ai-rail-suggestions">
                <button type="button" onClick={() => setSingleDate(nextDate(0), true)} disabled={disabled}>วันนี้</button>
                <button type="button" onClick={() => setSingleDate(nextDate(1), true)} disabled={disabled}>พรุ่งนี้</button>
              </div>
              {editingActivity && <input id="activity-ai-rail-date" type="date" value={guidedActivity.date || ""} disabled={disabled} onChange={(event) => setSingleDate(event.target.value, true)} />}
              {!editingActivity && <section className="activity-ai-mini-calendar" aria-label="เลือกวันสร้างกิจกรรม">
                <div><strong>{formatMonthYear(calendarMonth)}</strong><small>เลือกได้สูงสุด 28 วัน</small></div>
                <label className="activity-ai-mini-calendar-controls" htmlFor="activity-ai-rail-date"><span>เลือกวัน</span><input id="activity-ai-rail-date" type="date" value={calendarPickerDate || guidedActivity.date || ""} disabled={disabled} onChange={(event) => addDateFromPicker(event.target.value)} /></label>
                <div className="activity-ai-mini-calendar-weekdays">{weekdayShortLabels().map((label) => <span key={label}>{label}</span>)}</div>
                <div className="activity-ai-mini-calendar-days">{Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }).map((_, index) => <span key={`blank-${index}`} />)}{calendarDays.map((date) => {
                  const value = toDateInputValue(date);
                  const selected = repeatDates.includes(value) || (!repeatDates.length && guidedActivity.date === value);
                  return <button key={value} type="button" aria-label={`${value}${value === todayValue ? " วันนี้" : ""}`} aria-pressed={selected} className={value === todayValue ? "is-today" : ""} onClick={() => selectRepeatDate(date)} disabled={disabled}>{date.getDate()}</button>;
                })}</div>
                {repeatDates.length > 1 && <p>สร้างซ้ำ {repeatDates.length} วัน: {repeatDates.join(", ")}</p>}
                {repeatDates.length > 0 && <button type="button" className="activity-ai-mini-calendar-clear" onClick={clearRepeatDates} disabled={disabled}>ล้างวันที่เลือก</button>}
              </section>}
            </>}
            {currentStep.field === "title" && <>
              <label htmlFor="activity-ai-rail-title">ชื่อกิจกรรม</label>
              <div className="activity-ai-rail-suggestions">
                {["ประชุม", "อ่านหนังสือ", "ออกกำลังกาย"].map((title) => <button key={title} type="button" aria-label={`ตั้งชื่อเป็น ${title}`} onClick={() => changeField("title", title)} disabled={disabled}>{title}</button>)}
              </div>
              <input id="activity-ai-rail-title" type="text" value={guidedActivity.title || ""} maxLength="120" disabled={disabled} placeholder="ตั้งชื่อได้ตามต้องการ" onChange={(event) => changeField("title", event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && complete[currentIndex]) { event.preventDefault(); chooseStep(currentIndex + 1); } }} />
            </>}
            {currentStep.field === "time" && <>
              <label htmlFor="activity-ai-rail-time">เวลาเริ่ม</label>
              <div className="activity-ai-rail-suggestions">
                {["09:00", "13:00", "18:00"].map((time) => <button key={time} type="button" onClick={() => changeField("time", time, true)} disabled={disabled}>{time}</button>)}
              </div>
              <input id="activity-ai-rail-time" type="time" value={guidedActivity.time || ""} disabled={disabled} onChange={(event) => changeField("time", event.target.value, true)} />
            </>}
            {currentStep.field === "durationMinutes" && <>
              <label htmlFor="activity-ai-rail-duration">ระยะเวลา (นาที)</label>
              <div className="activity-ai-rail-suggestions">
                {[30, 60, 90, 120].map((minutes) => <button key={minutes} type="button" onClick={() => changeField("durationMinutes", minutes)} disabled={disabled}>{minutes === 60 ? "1 ชั่วโมง" : minutes === 120 ? "2 ชั่วโมง" : `${minutes} นาที`}</button>)}
              </div>
              <input id="activity-ai-rail-duration" type="number" min="30" max="720" step="1" value={guidedActivity.durationMinutes ?? ""} disabled={disabled} onChange={(event) => changeField("durationMinutes", event.target.value === "" ? "" : Number(event.target.value))} />
            </>}
          </div>
          {currentIndex < activitySteps.length - 1 && (
            <button type="button" className="activity-ai-rail-next" onClick={() => chooseStep(currentIndex + 1)} disabled={disabled || !complete[currentIndex]}>ถัดไป · {activitySteps[currentIndex + 1].label}</button>
          )}
          {allComplete && <>
            <section className="activity-ai-rail-summary" aria-label="สรุปกิจกรรมก่อนบันทึก"><strong>พร้อมบันทึก</strong><span>{guidedActivity.title}</span><span>{guidedActivity.date} · {guidedActivity.time} · {guidedActivity.durationMinutes} นาที</span></section>
            <button type="button" className="activity-ai-rail-save" onClick={() => saveGuidedActivityFromRail(repeatDates)} disabled={disabled || !allComplete}>{railSaving ? "กำลังบันทึก…" : editingActivity ? "บันทึกการแก้ไข" : repeatDates.length > 1 ? `บันทึก ${repeatDates.length} กิจกรรม` : "บันทึกกิจกรรม"}</button>
          </>}
          {!railMode && currentIndex === activitySteps.length - 1 && guidedActivity.durationMinutes !== undefined && <button type="button" className="activity-ai-rail-retry" onClick={retryGuidedActivityDraft} disabled={disabled}>สร้างร่างเพื่อตรวจอีกครั้ง</button>}
          {editingActivity && (deleteConfirmationOpen ? <div className="activity-ai-rail-delete-confirm" role="alert"><span>ลบ “{guidedActivity.title || "กิจกรรมนี้"}” ใช่ไหม</span><div><button type="button" onClick={() => setDeleteConfirmationOpen(false)} disabled={disabled}>ยกเลิก</button><button type="button" onClick={deleteGuidedActivityFromRail} disabled={disabled}>ยืนยันการลบ</button></div></div> : <button type="button" className="activity-ai-rail-delete" onClick={() => setDeleteConfirmationOpen(true)} disabled={disabled}>ลบกิจกรรม…</button>)}
          <button type="button" className="activity-ai-rail-cancel" onClick={cancelGuidedActivityFromRail} disabled={disabled}>{editingActivity ? "ยกเลิกการแก้ไข" : "ยกเลิกการสร้างกิจกรรม"}</button>
        </div> : <>
          <h2>เครื่องมือ</h2>
          <button type="button" className="activity-ai-rail-create" onClick={startGuidedActivityFromRail} disabled={disabled}>+ สร้างกิจกรรมในแผงงาน</button>
          <section className="activity-ai-rail-activities" aria-label="กิจกรรมที่กำลังจะถึง">
            <h2>กิจกรรมที่กำลังจะถึง</h2>
            {upcoming.length > 0 ? <ul>{upcoming.map(({ activity, start }) => {
              const requiresFullEditor = requiresFullActivityEditor(activity);
              return <li key={activity.id}>
                <button type="button" onClick={() => requiresFullEditor ? onOpenExistingActivity?.(activity) : startGuidedActivityEditFromRail(activity)} disabled={disabled} aria-label={`${requiresFullEditor ? "เปิด" : "แก้ไข"} ${activity.summary || "กิจกรรมไม่มีชื่อ"}`}>
                  <strong>{activity.summary || "กิจกรรมไม่มีชื่อ"}</strong>
                  <span>{activityWhen({ activity, start })}{activity.recurringEventId || activity.recurrence?.length ? " · ทำซ้ำ" : activity.start?.date && !activity.start?.dateTime ? " · ทั้งวัน" : ""}</span>
                </button>
              </li>
            })}</ul> : <p className="activity-ai-rail-note">ยังไม่มีกิจกรรมในตารางช่วงถัดไป</p>}
          </section>
        </>}
        </>}
      </div>
    </aside>
  );
}
