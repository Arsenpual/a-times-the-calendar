import { useEffect, useState } from "react";
import { isGuidedActivityFieldComplete } from "../lib/guided-activity-validation.js";
import { activityDate, formatTime, toDateInputValue } from "../../../../shared/lib/date-utils.js";

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

export default function AssistantWorkRail({ setWorkRailOpen, guidedActivity, editingActivity, railMode, railSaving, conversationNodeId, scheduleResolution, pending, updateGuidedActivityField, advanceGuidedStepFromRail, startGuidedActivityFromRail, startGuidedActivityEditFromRail, deleteGuidedActivityFromRail, cancelGuidedActivityFromRail, saveGuidedActivityFromRail, retryGuidedActivityDraft, renderTelegramArchive, activitySteps, activities, onOpenExistingActivity }) {
  const [chosenStep, setChosenStep] = useState(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const hasGuidedActivity = Boolean(guidedActivity);
  useEffect(() => { setChosenStep(null); setDeleteConfirmationOpen(false); }, [conversationNodeId, hasGuidedActivity]);
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

  return (
    <aside id="activity-ai-work-rail" className={`activity-ai-work-rail${hasGuidedActivity ? " is-creating-activity" : ""}`} aria-label="แผงงาน AI">
      <header className="activity-ai-rail-header"><strong>แผงงาน</strong><button type="button" onClick={() => setWorkRailOpen(false)} aria-label="ซ่อนแผงงาน">×</button></header>
      <div className="activity-ai-rail-content">
        {hasGuidedActivity ? <div className="activity-ai-rail-progress">
          <h2>{editingActivity ? "แก้ไขกิจกรรม" : "สร้างกิจกรรม"}</h2>
          <ol aria-label="ขั้นตอนสร้างกิจกรรม">{activitySteps.map((step, index) => (
            <li key={step.node} aria-current={index === currentIndex ? "step" : undefined} className={complete[index] ? "is-done" : ""}>
              <button type="button" aria-label={`เลือกขั้นตอน${step.label}`} onClick={() => chooseStep(index)} disabled={disabled}>
                <span aria-hidden="true">{complete[index] ? "✓" : index + 1}</span>{step.label}
              </button>
            </li>
          ))}</ol>
          <p className="activity-ai-rail-note">เลือกขั้นตอนด้านบนเพื่อกรอกหรือแก้ไขข้อมูล</p>
          {scheduleResolution && <p className="activity-ai-rail-conflict">เวลาที่เลือกชนเกินจำนวนที่รองรับ เลือกเวลาอื่นก่อนบันทึก</p>}
          <div className="activity-ai-rail-fields">
            {currentStep.field === "date" && <>
              <label htmlFor="activity-ai-rail-date">วันที่เริ่มกิจกรรม</label>
              <div className="activity-ai-rail-suggestions">
                <button type="button" onClick={() => changeField("date", nextDate(0), true)} disabled={disabled}>วันนี้</button>
                <button type="button" onClick={() => changeField("date", nextDate(1), true)} disabled={disabled}>พรุ่งนี้</button>
              </div>
              <input id="activity-ai-rail-date" type="date" value={guidedActivity.date || ""} disabled={disabled} onChange={(event) => changeField("date", event.target.value, true)} />
            </>}
            {currentStep.field === "title" && <>
              <label htmlFor="activity-ai-rail-title">ชื่อกิจกรรม</label>
              <input id="activity-ai-rail-title" type="text" value={guidedActivity.title || ""} maxLength="120" disabled={disabled} placeholder="ตั้งชื่อได้ตามต้องการ" onChange={(event) => changeField("title", event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && complete[currentIndex]) { event.preventDefault(); chooseStep(currentIndex + 1); } }} />
            </>}
            {currentStep.field === "time" && <>
              <label htmlFor="activity-ai-rail-time">เวลาเริ่ม</label>
              <input id="activity-ai-rail-time" type="time" value={guidedActivity.time || ""} disabled={disabled} onChange={(event) => changeField("time", event.target.value, true)} />
            </>}
            {currentStep.field === "durationMinutes" && <>
              <label htmlFor="activity-ai-rail-duration">ระยะเวลา (นาที)</label>
              <div className="activity-ai-rail-suggestions">
                {[30, 60, 90].map((minutes) => <button key={minutes} type="button" onClick={() => changeField("durationMinutes", minutes)} disabled={disabled}>{minutes === 60 ? "1 ชั่วโมง" : `${minutes} นาที`}</button>)}
              </div>
              <input id="activity-ai-rail-duration" type="number" min="30" max="720" step="1" value={guidedActivity.durationMinutes ?? ""} disabled={disabled} onChange={(event) => changeField("durationMinutes", event.target.value === "" ? "" : Number(event.target.value))} />
            </>}
          </div>
          {currentIndex < activitySteps.length - 1 && (
            <button type="button" className="activity-ai-rail-next" onClick={() => chooseStep(currentIndex + 1)} disabled={disabled || !complete[currentIndex]}>ถัดไป · {activitySteps[currentIndex + 1].label}</button>
          )}
          {allComplete && <>
            <section className="activity-ai-rail-summary" aria-label="สรุปกิจกรรมก่อนบันทึก"><strong>พร้อมบันทึก</strong><span>{guidedActivity.title}</span><span>{guidedActivity.date} · {guidedActivity.time} · {guidedActivity.durationMinutes} นาที</span></section>
            <button type="button" className="activity-ai-rail-save" onClick={saveGuidedActivityFromRail} disabled={disabled || !allComplete}>{railSaving ? "กำลังบันทึก…" : editingActivity ? "บันทึกการแก้ไข" : "บันทึกกิจกรรม"}</button>
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
      </div>
      {renderTelegramArchive("rail")}
    </aside>
  );
}
