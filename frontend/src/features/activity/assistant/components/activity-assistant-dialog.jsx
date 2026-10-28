import { useActivityAssistantConversation } from "../hooks/use-activity-assistant-conversation.js";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  CALENDAR_AI_QUESTION_SUGGESTIONS,
  CALENDAR_FACT_SUGGESTIONS,
} from "../config/activity-assistant-conversation-tree.js";
import AssistantHeader from "./assistant-header.jsx";
import AssistantTranscript from "./assistant-transcript.jsx";
import AssistantComposer from "./assistant-composer.jsx";
import AssistantWorkRail from "./assistant-work-rail.jsx";

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
  { node: "activity.date", label: "วัน" },
  { node: "activity.title", label: "ชื่อ" },
  { node: "activity.time", label: "เวลา" },
  { node: "activity.duration", label: "ระยะเวลา" },
];


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


export default function ActivityAssistantDialog(props) {
  const [telegramArchiveError, setTelegramArchiveError] = useState("");
  const [workRailOpen, setWorkRailOpen] = useState(true);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const {
    open,
    presentation = "dialog",
    headerTarget,
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
  const assistantHeader = <AssistantHeader presentation={presentation} embedded={presentation === "page" && Boolean(headerTarget)} pending={pending} canUseGemini={canUseGemini} workRailOpen={workRailOpen} setWorkRailOpen={setWorkRailOpen} confirmResetOpen={confirmResetOpen} setConfirmResetOpen={setConfirmResetOpen} reset={reset} onClose={onClose} />;
  return (
    <>
      {presentation === "page" && headerTarget && createPortal(assistantHeader, headerTarget)}
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
        {(presentation !== "page" || headerTarget === undefined) && assistantHeader}
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
        <AssistantTranscript presentation={presentation} guidedActivity={guidedActivity} toolCommands={toolCommands} messages={messages} sendKnowledge={sendKnowledge} pending={pending} selectScheduleAlternative={selectScheduleAlternative} selectScheduleOption={selectScheduleOption} selectWeatherSlot={selectWeatherSlot} runWeatherPlan={runWeatherPlan} confirmActivityPlan={confirmActivityPlan} send={send} renderTelegramArchive={renderTelegramArchive} telegramMessages={telegramMessages} telegramError={telegramError} error={error} calendarFailure={calendarFailure} onReauthCalendar={onReauthCalendar} retryCalendarFailure={retryCalendarFailure} pendingSource={pendingSource} bottomRef={bottomRef} />
        {!guidedActivity && (
          <div className="activity-ai-choice-strip activity-ai-create-shortcut">
            <div className="activity-ai-quick-replies">
              <button type="button" onClick={() => selectQuickReply({ kind: "start", next: "activity.date" })} disabled={pending}>
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
        <AssistantComposer presentation={presentation} guidedActivity={guidedActivity} chatStyle={chatStyle} setChatStyle={setChatStyle} input={input} setInput={setInput} send={send} canUseGemini={canUseGemini} conversationNodeId={conversationNodeId} cooldownSeconds={cooldownSeconds} cooldownLabel={cooldownLabel} pending={pending} onSendTelegramMessage={onSendTelegramMessage} sendToTelegram={sendToTelegram} />
        </div>
        {presentation === "page" && workRailOpen && <AssistantWorkRail setWorkRailOpen={setWorkRailOpen} guidedActivity={guidedActivity} conversationNodeId={conversationNodeId} scheduleResolution={scheduleResolution} pending={pending} updateGuidedActivityField={updateGuidedActivityField} retryGuidedActivityDraft={retryGuidedActivityDraft} selectQuickReply={selectQuickReply} toolCommands={toolCommands} weatherTool={<WeatherPlanningTool onRun={runWeatherPlan} pending={pending} />} renderTelegramArchive={renderTelegramArchive} activitySteps={ACTIVITY_STEPS} />}
        </div>
      </section>
    </div>
    </>
  );
}
