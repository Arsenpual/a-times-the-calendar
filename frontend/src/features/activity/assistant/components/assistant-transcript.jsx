import { useState } from "react";
import { INITIAL_ASSISTANT_MESSAGE } from "../hooks/use-assistant-chat-storage.js";
import { formatScheduleOption } from "../lib/schedule-format.js";
import { validatePlanDraft } from "../lib/validate-plan-draft.js";

const TOOL_RESULT_TITLES = {
  calendar: "ผลการอ่านปฏิทิน",
  scheduling: "ช่วงเวลาว่างที่ตรวจพบ",
  planning: "ผลการวางแผน",
  weather: "อากาศกับกิจกรรม",
};
function replaceLocalDateTime(value, part, next) {
  if (typeof value !== "string" || !next) return value;
  return part === "date" ? `${next}${value.slice(10)}` : `${value.slice(0, 11)}${next}`;
}

function ActivityPlanPreview({ initialDrafts, pending, onConfirm }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selected, setSelected] = useState(() => new Set(initialDrafts.map((_, index) => index)));
  const [editing, setEditing] = useState(null);
  const [submissionState, setSubmissionState] = useState("idle");
  const [submissionResult, setSubmissionResult] = useState(null);
  const submitted = submissionState !== "idle";
  const updateDraft = (index, update) => setDrafts((current) => current.map((draft, itemIndex) => itemIndex === index ? { ...draft, ...update } : draft));
  const selectedDrafts = drafts.filter((_, index) => selected.has(index));
  const hasInvalidSelection = selectedDrafts.some((draft) => validatePlanDraft(draft));
  const submitPlan = async () => {
    if (submitted || selectedDrafts.length === 0 || hasInvalidSelection) return;
    setSubmissionState("sending");
    const result = await onConfirm(selectedDrafts);
    if (!result) setSubmissionState("idle");
    else {
      setSubmissionResult(result);
      setSubmissionState("done");
    }
  };
  return (
    <section className="activity-ai-plan-preview" aria-label="ร่างแผนกิจกรรม">
      {drafts.map((draft, index) => (
        <div className="activity-ai-plan-item" key={index}>
          <label>
            <input type="checkbox" checked={selected.has(index)} onChange={() => setSelected((current) => {
              const next = new Set(current);
              if (next.has(index)) next.delete(index); else next.add(index);
              return next;
            })} disabled={pending || submitted} />
            <span>{draft.title} · {formatScheduleOption(draft.startLocal, draft.endLocal)}</span>
          </label>
          <button type="button" onClick={() => setEditing(editing === index ? null : index)} disabled={pending || submitted}>
            {editing === index ? "เสร็จ" : "แก้ไข"}
          </button>
          {editing === index && (
            <div className="activity-ai-plan-edit">
              <input aria-label="ชื่อกิจกรรม" value={draft.title} onChange={(event) => updateDraft(index, { title: event.target.value })} />
              <input aria-label="วันเริ่ม" type="date" value={draft.startLocal.slice(0, 10)} onChange={(event) => updateDraft(index, { startLocal: replaceLocalDateTime(draft.startLocal, "date", event.target.value) })} />
              <input aria-label="เวลาเริ่ม" type="time" value={draft.startLocal.slice(11, 16)} onChange={(event) => updateDraft(index, { startLocal: replaceLocalDateTime(draft.startLocal, "time", event.target.value) })} />
              <input aria-label="วันสิ้นสุด" type="date" value={draft.endLocal.slice(0, 10)} onChange={(event) => updateDraft(index, { endLocal: replaceLocalDateTime(draft.endLocal, "date", event.target.value) })} />
              <input aria-label="เวลาสิ้นสุด" type="time" value={draft.endLocal.slice(11, 16)} onChange={(event) => updateDraft(index, { endLocal: replaceLocalDateTime(draft.endLocal, "time", event.target.value) })} />
            </div>
          )}
          {selected.has(index) && validatePlanDraft(draft) && <p className="activity-ai-plan-error" role="alert">{validatePlanDraft(draft)}</p>}
        </div>
      ))}
      <button type="button" className="btn btn-primary activity-ai-plan-confirm" onClick={submitPlan} disabled={pending || submitted || selectedDrafts.length === 0 || hasInvalidSelection}>
        {submissionState === "sending" ? "กำลังบันทึก…" : submissionState === "done" ? submissionResult?.failed?.length || submissionResult?.warnings?.length ? "ส่งแล้ว · ตรวจผลในแชท" : "ส่งแผนแล้ว" : `สร้าง ${selectedDrafts.length} กิจกรรม`}
      </button>
    </section>
  );
}

export default function AssistantTranscript({ presentation, guidedActivity, railMode = false, toolCommands, messages, sendKnowledge, pending, selectScheduleAlternative, selectScheduleOption, selectWeatherSlot, runWeatherPlan, confirmActivityPlan, send, renderTelegramArchive, telegramMessages, telegramError, error, calendarFailure, onReauthCalendar, retryCalendarFailure, pendingSource, bottomRef }) {
  return (
  <div className="activity-ai-messages" role={presentation === "page" ? "log" : undefined} aria-label={presentation === "page" ? "บทสนทนา" : undefined} aria-live={presentation === "page" ? "polite" : undefined}>
    {!guidedActivity && presentation !== "page" && (
      <details className="activity-ai-tools" open={presentation !== "page" ? true : undefined}>
        <summary>เครื่องมือและคำสั่ง</summary>
        {toolCommands}
      </details>
    )}
    {!guidedActivity && presentation === "page" && <details className="activity-ai-tools activity-ai-mobile-tools"><summary>เครื่องมือและคำสั่ง</summary>{toolCommands}</details>}
    {messages.map((message, index) => (
      <div
        key={`${message.role}-${index}`}
        className={`activity-ai-message-group${presentation === "page" && message.role === "assistant" ? " is-assistant-turn" : ""}`}
      >
        {presentation === "page" && message.role === "assistant" && (
          <div className="activity-ai-message-meta">
            <strong>MR.Zettascale</strong>
            <small className="activity-ai-turn-source">{message.sourceLabel || (["ai", "free-ai"].includes(message.source) ? "AI" : message.source === "calendar" ? "AI · ปฏิทิน" : message.source === "knowledge" ? "ข้อมูลและกฎในเว็บ" : "คำตอบสำเร็จรูป")}{message.calendarRange?.label && !message.toolKind ? ` · ช่วง ${message.calendarRange.label}` : ""}</small>
          </div>
        )}
        <div
          className={`activity-ai-message is-${message.role}${["ai", "free-ai", "calendar"].includes(message.source) ? " is-ai-turn" : ""}${message.source === "knowledge" ? " is-knowledge-turn" : ""}${message.source === "template" ? " is-system-turn" : ""}${message.commandTone ? ` is-command-tone-${message.commandTone}` : ""}${message.followUpQuestions?.length > 0 ? " has-followups" : ""}${presentation === "page" && message.role === "assistant" && TOOL_RESULT_TITLES[message.toolKind] ? ` activity-ai-tool-result is-tool-${message.toolKind}` : ""}`}
          role={presentation === "page" && message.role === "assistant" && TOOL_RESULT_TITLES[message.toolKind] ? "region" : undefined}
          aria-label={presentation === "page" && message.role === "assistant" ? TOOL_RESULT_TITLES[message.toolKind] : undefined}
        >
          {presentation === "page" && message.role === "assistant" && TOOL_RESULT_TITLES[message.toolKind] && <strong className="activity-ai-tool-result-title">{TOOL_RESULT_TITLES[message.toolKind]}{message.calendarRange?.label && <small>ช่วง {message.calendarRange.label}</small>}</strong>}
          <span>{presentation === "page" && message.text === INITIAL_ASSISTANT_MESSAGE.text ? "สวัสดีครับ คุยเรื่องทั่วไปได้ในโหมดคุยอิสระ ถ้าต้องการดูตารางหรือสร้างกิจกรรม ใช้เครื่องมือด้านบนหรือสลับเป็นวางแผนกิจกรรมครับ" : message.text}</span>
        </div>
        {message.followUpQuestions?.length > 0 && (
          <div className={`activity-ai-answer-followups${message.commandTone ? ` is-command-tone-${message.commandTone}` : ""}`}>
            {message.followUpQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => sendKnowledge(question, message.commandTone || "knowledge")}
                disabled={pending}
              >
                {question}
              </button>
            ))}
          </div>
        )}
        {message.scheduleAlternatives?.length > 0 && (
          <div className="activity-ai-schedule-options">
            {message.scheduleAlternatives.map((alternative) => (
              <button
                key={`${alternative.startLocal}-${alternative.endLocal}`}
                type="button"
                onClick={() =>
                  selectScheduleAlternative(
                    alternative,
                    message.scheduleResolution,
                  )
                }
                disabled={pending || !message.scheduleResolution}
              >
                เลือก{" "}
                {formatScheduleOption(
                  alternative.startLocal,
                  alternative.endLocal,
                )}
              </button>
            ))}
          </div>
        )}
        {message.scheduleOptions?.length > 0 && (
          <div className="activity-ai-schedule-options">
            {message.scheduleOptions.map((option) => (
              <button
                key={`${option.startLocal}-${option.endLocal}`}
                type="button"
                onClick={() => selectScheduleOption(option)}
                disabled={pending || !option.draft}
              >
                เลือก {formatScheduleOption(option.startLocal, option.endLocal)}
              </button>
            ))}
          </div>
        )}
        {message.weatherSlots?.length > 0 && <div className="activity-ai-weather-slots" aria-label="ช่วงเวลาที่อากาศผ่านเกณฑ์">
          {message.weatherSlots.map((slot) => <button key={`${slot.start}-${slot.end}`} type="button" onClick={() => selectWeatherSlot(slot, message.weatherContext)} disabled={pending}>ร่างกิจกรรม · {slot.at} · {slot.score} คะแนน</button>)}
        </div>}
        {message.toolKind === "weather" && message.weatherContext?.activityId && <div className="activity-ai-weather-followup">
          <button type="button" onClick={() => runWeatherPlan({ location: message.weatherContext.location, activity: message.weatherContext.activityId, day: message.weatherContext.day === "today" ? "tomorrow" : "today", durationHours: message.weatherContext.durationHours })} disabled={pending}>
            {message.weatherContext.day === "today" ? "พรุ่งนี้ที่เดิม" : "วันนี้ที่เดิม"}
          </button>
        </div>}
        {message.planDrafts?.length > 0 && (
          <ActivityPlanPreview initialDrafts={message.planDrafts} pending={pending} onConfirm={confirmActivityPlan} />
        )}
        {presentation === "page" && message.toolResultCount > 0 && (
          (message.toolKind === "scheduling" && !message.scheduleOptions?.length) ||
          (message.toolKind === "planning" && !message.planDrafts?.length) ||
          (message.toolKind === "weather" && !message.weatherSlots?.length)
        ) && <section className="activity-ai-expired-options" aria-label="ตัวเลือกหมดอายุ">
          <p>{message.toolKind === "weather" ? "ช่วงแนะนำจากพยากรณ์ครั้งก่อนหมดอายุแล้ว" : "ตัวเลือกจากตารางครั้งก่อนหมดอายุแล้ว คำนวณใหม่เพื่อดูช่วงเวลาล่าสุด"}</p>
          {message.toolKind === "weather" ? <p>เลือกสถานที่และกดดูอากาศอีกครั้งในแผงงาน</p> : messages[index - 1]?.role === "user" && <button type="button" onClick={() => send(null, messages[index - 1].text, message.commandTone || "planning")} disabled={pending}>คำนวณใหม่</button>}
        </section>}
      </div>
    ))}
    {presentation === "page" && guidedActivity && !railMode && Object.values(guidedActivity).some(Boolean) && (
      <section className="activity-ai-guided-preview" aria-label="ข้อมูลกิจกรรมที่กำลังกรอก">
        <strong>ข้อมูลกิจกรรมที่กำลังกรอก</strong>
        {guidedActivity.date && <span>วัน: {guidedActivity.date}</span>}
        {guidedActivity.title && <span>ชื่อ: {guidedActivity.title}</span>}
        {guidedActivity.time && <span>เวลา: {guidedActivity.time}</span>}
        {guidedActivity.durationMinutes && <span>ระยะเวลา: {guidedActivity.durationMinutes} นาที</span>}
      </section>
    )}
    {presentation === "page" && renderTelegramArchive("mobile")}
    {presentation !== "page" && telegramMessages.map((message) => (
      <div
        key={`telegram-${message.id}`}
        className="activity-ai-message-group"
      >
        <div
          className={`activity-ai-message is-${message.direction === "incoming" ? "user" : "assistant"} is-telegram-turn${message.direction !== "incoming" ? " is-system-turn" : ""}${message.kind === "notification" ? " is-telegram-notification" : ""}`}
        >
          <span>{message.text}</span>
        </div>
      </div>
    ))}
    {presentation !== "page" && telegramError && (
      <p className="activity-ai-error">{telegramError}</p>
    )}
    {error && <p className="activity-ai-error activity-ai-chat-error" role="alert">{error}</p>}
    {calendarFailure && <section className="activity-ai-calendar-failure" role="alert" aria-label="อ่าน Google Calendar ไม่สำเร็จ">
      <strong>{calendarFailure.kind === "reauth" ? "ต้องเชื่อม Google Calendar อีกครั้ง" : "ยังอ่าน Google Calendar ไม่ได้"}</strong>
      <p>{calendarFailure.kind === "reauth" ? "สิทธิ์การเชื่อมต่อใช้ไม่ได้แล้ว หลังยืนยันตัวตนให้ลองคำถามนี้อีกครั้ง" : "การอ่านข้อมูลล้มเหลวชั่วคราว ยังไม่มีข้อมูลตารางสำหรับคำถามนี้"}</p>
      <div>
        {calendarFailure.kind === "reauth" && onReauthCalendar && <button type="button" onClick={onReauthCalendar}>ยืนยันตัวตนกับ Google</button>}
        <button type="button" onClick={retryCalendarFailure} disabled={pending}>ลองอีกครั้ง</button>
      </div>
    </section>}
    {pending && pendingSource !== "rail-save" && (
      <p
        className={`activity-ai-message is-assistant is-thinking${pendingSource === "ai" ? " is-ai-turn" : ""}`}
      >
        {pendingSource === "weather" ? "กำลังดึงข้อมูลอากาศและหาช่วงเวลา…" : pendingSource === "knowledge" ? "กำลังค้นหาคำตอบ…" : pendingSource === "ai"
          ? "กำลังให้ AI ช่วยคิดรายละเอียด…"
          : "กำลังสร้างร่างกิจกรรม…"}
      </p>
    )}
    <div ref={bottomRef} />
  </div>
  );
}
