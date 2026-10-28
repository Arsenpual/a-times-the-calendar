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
  { node: "activity.date", field: "date", label: "วัน" },
  { node: "activity.title", field: "title", label: "ชื่อ" },
  { node: "activity.time", field: "time", label: "เวลา" },
  { node: "activity.duration", field: "durationMinutes", label: "ระยะเวลา" },
];


function ActivityAssistantCommandGroups({ canUseGemini, cooldownSeconds, onCreateActivity, onDailySummary, onSend, onSendKnowledge, pending, rootQuestions }) {
  return (
    <div className="activity-ai-command-grid">
      <section className="activity-ai-centered-questions activity-ai-create-questions" aria-label="คำสั่งสร้างกิจกรรม">
        <small>สร้างกิจกรรม</small>
        <div><button type="button" onClick={onCreateActivity} disabled={pending}>สร้างกิจกรรม</button></div>
      </section>
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
      <section className="activity-ai-centered-questions activity-ai-calendar-questions" aria-label="คำสั่ง AI">
        <small>{canUseGemini ? "ทดลอง AI สำหรับนักพัฒนา · ใช้ AI quota 1 ครั้ง" : "ทดลอง AI สำหรับนักพัฒนา · ต้องมีสิทธิ์ AI"}</small>
        <div>
        {AI_COMMANDS.map((command) => (
          <button key={command.label} type="button" onClick={() => onSend(null, command.text, "ai")} disabled={pending || !canUseGemini || cooldownSeconds > 0}>
            {command.label}
          </button>
        ))}
        </div>
      </section>
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
  const [telegramInput, setTelegramInput] = useState("");
  const [telegramSending, setTelegramSending] = useState(false);
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
    railMode,
    railSaving,
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
    startGuidedActivityFromRail,
    advanceGuidedStepFromRail,
    cancelGuidedActivityFromRail,
    saveGuidedActivityFromRail,
    retryGuidedActivityDraft,
    applyActivitySuggestion,
    runDailySummary,
    retryCalendarFailure,
    selectScheduleAlternative,
    selectScheduleOption,
    confirmActivityPlan,
    sendToTelegram,
  } = useActivityAssistantConversation({ ...props, closeOnEscape: presentation !== "page", clearTelegramOnReset: presentation !== "page", freeConversation: presentation === "page", openFormOnGuidedStart: presentation !== "page" });
  const toolCommands = <ActivityAssistantCommandGroups
    canUseGemini={canUseGemini}
    cooldownSeconds={cooldownSeconds}
    onDailySummary={onOpenDailySummary ? runDailySummary : null}
    onSend={send}
    onSendKnowledge={sendKnowledge}
    onCreateActivity={() => selectQuickReply({ kind: "start", next: "activity.date" })}
    pending={pending}
    rootQuestions={rootQuestions}
  />;
  const renderTelegramArchive = (location) => onSendTelegramMessage && (
    <details className={`activity-ai-telegram-archive is-${location}`}>
      <summary>เปิด / ปิดแชท Telegram · {telegramMessages.length}</summary>
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
      {location === "rail" && <form className="activity-ai-telegram-composer" onSubmit={async (event) => {
        event.preventDefault();
        const text = telegramInput.trim();
        if (!text || telegramSending) return;
        setTelegramSending(true);
        setTelegramArchiveError("");
        try { await onSendTelegramMessage(text); setTelegramInput(""); }
        catch (requestError) { setTelegramArchiveError(requestError.message || "ส่งข้อความไป Telegram ไม่สำเร็จ"); }
        finally { setTelegramSending(false); }
      }}>
        <textarea aria-label="ข้อความถึง Telegram" value={telegramInput} onChange={(event) => setTelegramInput(event.target.value)} maxLength={1200} placeholder="เขียนข้อความถึง Telegram…" />
        <button type="submit" disabled={telegramSending || !telegramInput.trim()}>{telegramSending ? "กำลังส่ง…" : "ส่ง Telegram"}</button>
      </form>}
    </details>
  );
  if (!open) return null;
  const assistantHeader = <AssistantHeader presentation={presentation} embedded={presentation === "page" && Boolean(headerTarget)} pending={pending || railSaving} saving={railSaving} canUseGemini={canUseGemini} workRailOpen={workRailOpen} setWorkRailOpen={setWorkRailOpen} confirmResetOpen={confirmResetOpen} setConfirmResetOpen={setConfirmResetOpen} reset={reset} onClose={onClose} />;
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
        <AssistantTranscript presentation={presentation} guidedActivity={guidedActivity} railMode={railMode} toolCommands={toolCommands} messages={messages} sendKnowledge={sendKnowledge} pending={pending} selectScheduleAlternative={selectScheduleAlternative} selectScheduleOption={selectScheduleOption} confirmActivityPlan={confirmActivityPlan} applyActivitySuggestion={applyActivitySuggestion} send={send} renderTelegramArchive={renderTelegramArchive} telegramMessages={telegramMessages} telegramError={telegramError} error={error} calendarFailure={calendarFailure} onReauthCalendar={onReauthCalendar} retryCalendarFailure={retryCalendarFailure} pendingSource={pendingSource} bottomRef={bottomRef} />
        {guidedActivity && !railMode && guidedConversationMode === "template" && (
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
        <AssistantComposer presentation={presentation} guidedActivity={guidedActivity} railMode={railMode} chatStyle={chatStyle} setChatStyle={setChatStyle} input={input} setInput={setInput} send={send} canUseGemini={canUseGemini} conversationNodeId={conversationNodeId} cooldownSeconds={cooldownSeconds} cooldownLabel={cooldownLabel} pending={pending} onSendTelegramMessage={presentation === "page" ? null : onSendTelegramMessage} sendToTelegram={sendToTelegram} />
        </div>
        {presentation === "page" && workRailOpen && <AssistantWorkRail setWorkRailOpen={setWorkRailOpen} guidedActivity={guidedActivity} railMode={railMode} railSaving={railSaving} conversationNodeId={conversationNodeId} scheduleResolution={scheduleResolution} pending={pending} updateGuidedActivityField={updateGuidedActivityField} advanceGuidedStepFromRail={advanceGuidedStepFromRail} startGuidedActivityFromRail={startGuidedActivityFromRail} cancelGuidedActivityFromRail={cancelGuidedActivityFromRail} saveGuidedActivityFromRail={saveGuidedActivityFromRail} retryGuidedActivityDraft={retryGuidedActivityDraft} renderTelegramArchive={renderTelegramArchive} activitySteps={ACTIVITY_STEPS} />}
        </div>
      </section>
    </div>
    </>
  );
}
