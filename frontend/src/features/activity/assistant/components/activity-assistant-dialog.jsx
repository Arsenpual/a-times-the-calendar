import { useActivityAssistantConversation } from "../hooks/use-activity-assistant-conversation.js";
import { useState } from "react";
import { INITIAL_ASSISTANT_MESSAGE } from "../hooks/use-assistant-chat-storage.js";
import {
  CALENDAR_AI_QUESTION_SUGGESTIONS,
  CALENDAR_FACT_SUGGESTIONS,
} from "../config/activity-assistant-conversation-tree.js";
import { formatScheduleOption, formatScheduleRange } from "../lib/schedule-format.js";
import { validatePlanDraft } from "../lib/validate-plan-draft.js";

const PLANNING_COMMANDS = [
  { label: "หาเวลาออกกำลังกาย", text: "ช่วยหาเวลาว่างออกกำลังกาย 1 ชั่วโมงพรุ่งนี้" },
  { label: "แบ่งงาน 3 ชั่วโมง", text: "ช่วยแบ่งงานทำรายงาน 3 ชั่วโมงพรุ่งนี้" },
  { label: "วางแผนพรุ่งนี้", text: "ช่วยวางแผนพรุ่งนี้: อ่านหนังสือ 1 ชั่วโมง, ออกกำลังกาย 30 นาที" },
];

const CALENDAR_COMMANDS = [
  { label: "วันนี้มีอะไร", text: CALENDAR_FACT_SUGGESTIONS[0] },
  { label: "พรุ่งนี้ว่างไหม", text: CALENDAR_FACT_SUGGESTIONS[1] },
  { label: "นัดสัปดาห์นี้", text: CALENDAR_FACT_SUGGESTIONS[2] },
  { label: "ตารางชนไหม", text: CALENDAR_FACT_SUGGESTIONS[3] },
];

const AI_COMMANDS = [
  { label: "จัดตารางวันนี้", text: CALENDAR_AI_QUESTION_SUGGESTIONS[0] },
  { label: "หาเวลาพัก", text: CALENDAR_AI_QUESTION_SUGGESTIONS[1] },
  { label: "วางแผนสัปดาห์หน้า", text: CALENDAR_AI_QUESTION_SUGGESTIONS[2] },
];

const ACTIVITY_STEPS = [
  { node: "activity.title", label: "ชื่อ" },
  { node: "activity.date", label: "วัน" },
  { node: "activity.time", label: "เวลา" },
  { node: "activity.duration", label: "ระยะเวลา" },
];

const TOOL_RESULT_TITLES = {
  calendar: "ผลการอ่านปฏิทิน",
  scheduling: "ช่วงเวลาว่างที่ตรวจพบ",
  planning: "ผลการวางแผน",
  weather: "อากาศกับกิจกรรม",
};

function WeatherPlanningTool({ onRun, pending }) {
  const [location, setLocation] = useState("");
  const [activity, setActivity] = useState("outdoor");
  const [day, setDay] = useState("today");
  const [durationHours, setDurationHours] = useState(1);
  return <section className="activity-ai-weather-tool" aria-label="อากาศกับกิจกรรม">
    <h3>อากาศกับกิจกรรม</h3>
    <p>ดูพยากรณ์และเลือกช่วงเวลา ก่อนเปิดร่างให้ตรวจ</p>
    <form onSubmit={(event) => { event.preventDefault(); onRun({ location, activity, day, durationHours }); }}>
      <label>สถานที่<input value={location} maxLength="120" onChange={(event) => setLocation(event.target.value)} placeholder="เช่น กรุงเทพฯ" /></label>
      <label>กิจกรรม<select value={activity} onChange={(event) => setActivity(event.target.value)}><option value="outdoor">กลางแจ้ง</option><option value="exercise">ออกกำลัง</option><option value="travel">เดินทาง</option><option value="laundry">ซัก/ตากผ้า</option></select></label>
      <label>วัน<select value={day} onChange={(event) => setDay(event.target.value)}><option value="today">วันนี้</option><option value="tomorrow">พรุ่งนี้</option></select></label>
      <label>ระยะเวลา<select value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))}><option value="1">1 ชั่วโมง</option><option value="2">2 ชั่วโมง</option><option value="3">3 ชั่วโมง</option></select></label>
      <button type="submit" disabled={pending || !location.trim()}>ดูอากาศและช่วงแนะนำ</button>
    </form>
  </section>;
}

function ActivityAssistantCommandGroups({ canUseGemini, cooldownSeconds, onDailySummary, onSend, onSendKnowledge, pending, rootQuestions }) {
  return (
    <div className="activity-ai-command-grid">
      <section className="activity-ai-centered-questions activity-ai-planning-questions" aria-label="คำสั่งวางแผน">
        <small>วางแผนกิจกรรม</small>
        <div>
        {PLANNING_COMMANDS.map((command) => (
          <button key={command.label} type="button" onClick={() => onSend(null, command.text, "planning")} disabled={pending}>
            {command.label}
          </button>
        ))}
        </div>
      </section>
      <section className="activity-ai-centered-questions activity-ai-calendar-fact-questions" aria-label="คำสั่งดูตาราง">
        <small>ดูตาราง</small>
        <div>
          {onDailySummary && <button type="button" onClick={onDailySummary} disabled={pending}>สรุปวันนี้</button>}
        {CALENDAR_COMMANDS.map((command) => (
          <button key={command.label} type="button" onClick={() => onSend(null, command.text, "calendar")} disabled={pending}>
            {command.label}
          </button>
        ))}
        </div>
      </section>
      {canUseGemini && (
        <section className="activity-ai-centered-questions activity-ai-calendar-questions" aria-label="คำสั่ง AI">
          <small>ทดลอง AI สำหรับนักพัฒนา · ใช้ AI quota 1 ครั้ง</small>
          <div>
          {AI_COMMANDS.map((command) => (
            <button key={command.label} type="button" onClick={() => onSend(null, command.text, "ai")} disabled={pending || cooldownSeconds > 0}>
              {command.label}
            </button>
          ))}
          </div>
        </section>
      )}
      {rootQuestions.length > 0 && (
        <section className="activity-ai-centered-questions activity-ai-knowledge-questions" aria-label="คำถามทั่วไป">
          <small>คำถามทั่วไป · ไม่ใช้ข้อมูลส่วนตัว · ไม่ใช้ AI quota</small>
          <div>
            {rootQuestions.map((question) => (
              <button key={question} type="button" onClick={() => onSendKnowledge(question, "knowledge")} disabled={pending}>
                {question}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

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

export default function ActivityAssistantDialog(props) {
  const [telegramArchiveError, setTelegramArchiveError] = useState("");
  const [workRailOpen, setWorkRailOpen] = useState(true);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const {
    open,
    presentation = "dialog",
    onClose,
    activityFormOpen = false,
    dailySummaryOpen = false,
    telegramMessages = [],
    telegramError = "",
    onOpenDailySummary,
    onReauthCalendar,
    onSendTelegramMessage,
    onClearTelegramMessages,
    assistantInsight,
  } = props;
  const {
    messages,
    pending,
    pendingSource,
    error,
    calendarFailure,
    aiStatus,
    cooldownSeconds,
    cooldownLabel,
    canUseGemini,
    aiRequestCount,
    guidedActivity,
    scheduleResolution,
    conversationNodeId,
    guidedConversationMode,
    input,
    setInput,
    chatStyle,
    setChatStyle,
    bottomRef,
    rootQuestions,
    quickReplies,
    reset,
    send,
    sendKnowledge,
    selectQuickReply,
    updateGuidedActivityField,
    retryGuidedActivityDraft,
    runDailySummary,
    retryCalendarFailure,
    selectScheduleAlternative,
    selectScheduleOption,
    confirmActivityPlan,
    sendToTelegram,
    runWeatherPlan,
    selectWeatherSlot,
  } = useActivityAssistantConversation({ ...props, closeOnEscape: presentation !== "page", clearTelegramOnReset: presentation !== "page", freeConversation: presentation === "page", openFormOnGuidedStart: presentation !== "page" });
  const toolCommands = <ActivityAssistantCommandGroups
    canUseGemini={canUseGemini}
    cooldownSeconds={cooldownSeconds}
    onDailySummary={onOpenDailySummary ? runDailySummary : null}
    onSend={send}
    onSendKnowledge={sendKnowledge}
    pending={pending}
    rootQuestions={rootQuestions}
  />;
  const renderTelegramArchive = (location) => onSendTelegramMessage && (
    <details className={`activity-ai-telegram-archive is-${location}`}>
      <summary>ข้อความ Telegram · {telegramMessages.length}</summary>
      <p>สำเนาข้อความจาก Telegram แยกจากบทสนทนา AI บนเว็บ</p>
      {onClearTelegramMessages && telegramMessages.length > 0 && <button type="button" disabled={pending} onClick={async () => {
        setTelegramArchiveError("");
        try { await onClearTelegramMessages(); }
        catch (requestError) { setTelegramArchiveError(requestError.message || "ล้างสำเนา Telegram ไม่สำเร็จ"); }
      }}>ล้างสำเนา Telegram ในเว็บ</button>}
      {telegramArchiveError && <p className="activity-ai-error" role="alert">{telegramArchiveError}</p>}
      {telegramError && <p className="activity-ai-error">{telegramError}</p>}
      {telegramMessages.map((message) => (
        <div key={`telegram-${message.id}`} className="activity-ai-message-group">
          <div className={`activity-ai-message is-${message.direction === "incoming" ? "user" : "assistant"} is-telegram-turn${message.direction !== "incoming" ? " is-system-turn" : ""}${message.kind === "notification" ? " is-telegram-notification" : ""}`}><span>{message.text}</span></div>
        </div>
      ))}
    </details>
  );
  if (!open) return null;
  return (
    <div
      id={presentation === "page" ? "ai-mode-workspace" : undefined}
      className={presentation === "page" ? "activity-ai-page" : `activity-ai-backdrop${activityFormOpen ? " is-activity-form-open" : ""}${dailySummaryOpen ? " is-daily-summary-open" : ""}`}
      role="presentation"
      onMouseDown={presentation === "page" ? undefined : onClose}
    >
      <section
        className="activity-ai-assistant"
        role={presentation === "page" ? "region" : "dialog"}
        aria-modal={presentation === "page" ? undefined : "true"}
        aria-label={presentation === "page" ? "AI Mode MR.Zettascale" : "คุยกับ MR.Zettascale เพื่อสร้างกิจกรรม"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="activity-ai-header">
          <div>
            <span>✦</span>
            <strong>MR.Zettascale</strong>
            <small>{presentation === "page" ? pending ? "กำลังตอบ…" : canUseGemini ? "พร้อมคุย · ใช้ AI" : "AI จำกัดสิทธิ์ · ใช้เครื่องมือที่ไม่เรียก AI ได้" : "ผู้ช่วยวางแผนกิจกรรม"}</small>
          </div>
          <div>
            {presentation === "page" && <button type="button" className="activity-ai-rail-toggle" aria-expanded={workRailOpen} aria-controls="activity-ai-work-rail" onClick={() => setWorkRailOpen((current) => !current)}>{workRailOpen ? "ซ่อนแผงงาน" : "เปิดแผงงาน"}</button>}
            {presentation === "page" ? <div className="activity-ai-reset-wrap">
              <button type="button" onClick={() => setConfirmResetOpen((current) => !current)} aria-expanded={confirmResetOpen} disabled={pending}>แชท AI ใหม่</button>
              {confirmResetOpen && <div className="activity-ai-reset-confirm" role="dialog" aria-label="ยืนยันเริ่มแชท AI ใหม่">
                <strong>เริ่มแชท AI ใหม่?</strong>
                <p>ล้างเฉพาะบทสนทนา AI บนเว็บ สำเนา Telegram ยังอยู่</p>
                <div><button type="button" onClick={() => setConfirmResetOpen(false)}>ยกเลิก</button><button type="button" onClick={() => { reset(); setConfirmResetOpen(false); }}>เริ่มแชทใหม่</button></div>
              </div>}
            </div> : <button type="button" onClick={reset} disabled={pending}>เคลียร์แชท</button>}
            <button type="button" onClick={onClose} aria-label={presentation === "page" ? "กลับโหมดก่อนหน้า" : "ปิดแชต"}>
              {presentation === "page" ? "กลับ" : "×"}
            </button>
          </div>
        </header>
        <div className="activity-ai-workspace-body">
        <div className="activity-ai-chat-column">
        {canUseGemini && (
          <p className="activity-ai-quota">
            Developer preview · เหลือ{" "}
            {Math.max(0, aiStatus.userDay.limit - aiStatus.userDay.used)}/
            {aiStatus.userDay.limit} วันนี้ ·{" "}
            {Math.max(0, aiStatus.userWindow.limit - aiStatus.userWindow.used)}/
            {aiStatus.userWindow.limit} ใน 15 นาที · AI ในแชตนี้{" "}
            {aiRequestCount} ครั้ง
          </p>
        )}
        {assistantInsight && (
          <p className="activity-ai-insight-context">
            ใช้ {assistantInsight.title} เป็นบริบทเฉพาะ session นี้
          </p>
        )}
        <div className="activity-ai-messages">
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
              className="activity-ai-message-group"
            >
              <div
                className={`activity-ai-message is-${message.role}${["ai", "free-ai", "calendar"].includes(message.source) ? " is-ai-turn" : ""}${message.source === "knowledge" ? " is-knowledge-turn" : ""}${message.source === "template" ? " is-system-turn" : ""}${message.commandTone ? ` is-command-tone-${message.commandTone}` : ""}${message.followUpQuestions?.length > 0 ? " has-followups" : ""}${presentation === "page" && message.role === "assistant" && TOOL_RESULT_TITLES[message.toolKind] ? ` activity-ai-tool-result is-tool-${message.toolKind}` : ""}`}
                role={presentation === "page" && message.role === "assistant" && TOOL_RESULT_TITLES[message.toolKind] ? "region" : undefined}
                aria-label={presentation === "page" && message.role === "assistant" ? TOOL_RESULT_TITLES[message.toolKind] : undefined}
              >
                {presentation === "page" && message.role === "assistant" && TOOL_RESULT_TITLES[message.toolKind] && <strong className="activity-ai-tool-result-title">{TOOL_RESULT_TITLES[message.toolKind]}{message.calendarRange?.label && <small>ช่วง {message.calendarRange.label}</small>}</strong>}
                <span>{presentation === "page" && message.text === INITIAL_ASSISTANT_MESSAGE.text ? "สวัสดีครับ คุยเรื่องทั่วไปได้ในโหมดคุยอิสระ ถ้าต้องการดูตารางหรือสร้างกิจกรรม ใช้เครื่องมือด้านบนหรือสลับเป็นวางแผนกิจกรรมครับ" : message.text}</span>
              </div>
              {presentation === "page" && message.role === "assistant" && index > 0 && (
                <small className="activity-ai-turn-source">{message.sourceLabel || (["ai", "free-ai"].includes(message.source) ? "AI" : message.source === "calendar" ? "AI · ปฏิทิน" : message.source === "knowledge" ? "ข้อมูลและกฎในเว็บ" : "คำตอบสำเร็จรูป")}{message.calendarRange?.label && !message.toolKind ? ` · ช่วง ${message.calendarRange.label}` : ""}</small>
              )}
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
          {presentation === "page" && guidedActivity && Object.values(guidedActivity).some(Boolean) && (
            <section className="activity-ai-guided-preview" aria-label="ข้อมูลกิจกรรมที่กำลังกรอก">
              <strong>ข้อมูลกิจกรรมที่กำลังกรอก</strong>
              {guidedActivity.title && <span>ชื่อ: {guidedActivity.title}</span>}
              {guidedActivity.date && <span>วัน: {guidedActivity.date}</span>}
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
          {pending && (
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
        {!guidedActivity && (
          <div className="activity-ai-choice-strip activity-ai-create-shortcut">
            <div className="activity-ai-quick-replies">
              <button type="button" onClick={() => selectQuickReply({ kind: "start", next: "activity.title" })} disabled={pending}>
                สร้างกิจกรรม
              </button>
            </div>
          </div>
        )}
        {guidedActivity && guidedConversationMode === "template" && (
          <div
            className="activity-ai-choice-strip"
            aria-label="คำสั่งสร้างกิจกรรมและข้อมูลส่วนตัว"
          >
            <div className="activity-ai-quick-replies">
              {quickReplies.map((reply) => (
                <button
                  key={reply.id}
                  type="button"
                  onClick={() => selectQuickReply(reply)}
                  disabled={pending}
                >
                  {reply.label}
                </button>
              ))}
              {presentation !== "page" && onOpenDailySummary && (
                <button
                  type="button"
                  onClick={runDailySummary}
                  disabled={pending}
                >
                  สรุปวันนี้
                </button>
              )}
              {presentation !== "page" && CALENDAR_FACT_SUGGESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => send(null, question)}
                  disabled={pending}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
        <form className="activity-ai-composer" onSubmit={send}>
          {presentation === "page" && !guidedActivity && <div className="activity-ai-chat-style" role="group" aria-label="วิธีคุยกับ AI">
            <button type="button" className={chatStyle === "free" ? "is-active" : ""} aria-pressed={chatStyle === "free"} onClick={() => setChatStyle("free")}>คุยอิสระ</button>
            <button type="button" className={chatStyle === "planning" ? "is-active" : ""} aria-pressed={chatStyle === "planning"} onClick={() => setChatStyle("planning")}>วางแผนกิจกรรม</button>
          </div>}
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (presentation === "page" && event.key === "Enter" && !event.shiftKey && !event.nativeEvent?.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                send(event);
              }
            }}
            placeholder={
              guidedActivity
                ? canUseGemini
                  ? "พิมพ์เองเพื่อให้ AI ตอบต่อจากตัวเลือกด้านบน…"
                  : conversationNodeId === "activity.title" ? "พิมพ์ชื่อกิจกรรม หรือเลือกตัวอย่างด้านบน" : "เลือกคำตอบด้านบน หรือแก้ข้อมูลในแผงงาน"
                : presentation === "page" && chatStyle === "free"
                  ? "คุยหรือถามเรื่องที่สนใจ… ใช้เครื่องมือด้านบนเมื่ออยากให้ช่วยดูตาราง"
                  : "ทำงาน 08.30 พรุ่งนี้ 3 ชม. · หรือ พรุ่งนี้ว่างช่วงไหน?"
            }
            maxLength="1200"
            aria-label="ข้อความถึง MR.Zettascale"
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending || !input.trim() || cooldownSeconds > 0}
          >
            {cooldownSeconds > 0
              ? `รอ ${cooldownLabel}`
              : canUseGemini
                ? "ส่งให้ AI"
                : "ส่ง"}
          </button>
          {onSendTelegramMessage && (
            <button
              type="button"
              className="activity-ai-telegram-send"
              onClick={sendToTelegram}
              disabled={pending || !input.trim()}
            >
              ส่ง Telegram
            </button>
          )}
        </form>
        </div>
        {presentation === "page" && workRailOpen && <aside id="activity-ai-work-rail" className="activity-ai-work-rail" aria-label="แผงงาน AI">
          <header className="activity-ai-rail-header"><strong>แผงงาน</strong><button type="button" onClick={() => setWorkRailOpen(false)} aria-label="ซ่อนแผงงาน">×</button></header>
          <div className="activity-ai-rail-content">
            {guidedActivity ? <div className="activity-ai-rail-progress">
              <h2>สร้างกิจกรรม</h2>
              <ol aria-label="ขั้นตอนสร้างกิจกรรม">{ACTIVITY_STEPS.map((step, index) => {
                const currentIndex = ACTIVITY_STEPS.findIndex((item) => item.node === conversationNodeId);
                return <li key={step.node} aria-current={index === currentIndex ? "step" : undefined} className={index < currentIndex ? "is-done" : ""}><span>{index < currentIndex ? "✓" : index + 1}</span>{step.label}</li>;
              })}</ol>
              <p className="activity-ai-rail-note">ตอบคำถามในแชทให้ครบ แล้วตรวจร่างในฟอร์มก่อนบันทึก</p>
              {scheduleResolution && <p className="activity-ai-rail-conflict">เวลาที่เลือกชนเกินจำนวนที่รองรับ เลือกช่วงเวลาแนะนำในแชทหรือแก้เวลาในแผงงาน</p>}
              <div className="activity-ai-rail-fields">
                {guidedActivity.title !== undefined && <label>ชื่อ<input type="text" value={guidedActivity.title} maxLength="120" disabled={pending} onChange={(event) => updateGuidedActivityField("title", event.target.value)} /></label>}
                {guidedActivity.date !== undefined && <label>วัน<input type="date" value={guidedActivity.date} disabled={pending} onChange={(event) => updateGuidedActivityField("date", event.target.value)} /></label>}
                {guidedActivity.time !== undefined && <label>เวลา<input type="time" value={guidedActivity.time} disabled={pending} onChange={(event) => updateGuidedActivityField("time", event.target.value)} /></label>}
                {guidedActivity.durationMinutes !== undefined && <label>ระยะเวลา (นาที)<input type="number" min="30" max="720" value={guidedActivity.durationMinutes} disabled={pending} onChange={(event) => updateGuidedActivityField("durationMinutes", Number(event.target.value) || "")} /></label>}
              </div>
              {guidedActivity.durationMinutes !== undefined && <button type="button" className="activity-ai-rail-retry" onClick={retryGuidedActivityDraft} disabled={pending}>สร้างร่างเพื่อตรวจอีกครั้ง</button>}
              <button type="button" className="activity-ai-rail-cancel" onClick={() => selectQuickReply({ kind: "home", label: "ยกเลิกการสร้างกิจกรรม" })} disabled={pending}>ยกเลิกการสร้างกิจกรรม</button>
            </div> : <>
              <h2>เครื่องมือ</h2>
              {toolCommands}
              <WeatherPlanningTool onRun={runWeatherPlan} pending={pending} />
            </>}
          </div>
          {renderTelegramArchive("rail")}
        </aside>}
        </div>
      </section>
    </div>
  );
}
