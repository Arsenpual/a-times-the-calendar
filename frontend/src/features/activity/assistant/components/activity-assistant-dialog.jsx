import { useActivityAssistantConversation } from "../hooks/use-activity-assistant-conversation.js";
import {
  CALENDAR_AI_QUESTION_SUGGESTIONS,
  CALENDAR_FACT_SUGGESTIONS,
} from "../config/activity-assistant-conversation-tree.js";
import { formatScheduleRange } from "../lib/schedule-format.js";

export default function ActivityAssistantDialog(props) {
  const {
    open,
    onClose,
    activityFormOpen = false,
    dailySummaryOpen = false,
    telegramMessages = [],
    telegramError = "",
    onOpenDailySummary,
    onSendTelegramMessage,
  } = props;
  const {
    messages,
    pending,
    pendingSource,
    error,
    aiStatus,
    cooldownSeconds,
    cooldownLabel,
    canUseGemini,
    aiRequestCount,
    guidedActivity,
    guidedConversationMode,
    input,
    setInput,
    bottomRef,
    rootQuestions,
    quickReplies,
    reset,
    send,
    selectQuickReply,
    runDailySummary,
    selectScheduleAlternative,
    sendToTelegram,
  } = useActivityAssistantConversation(props);
  if (!open) return null;
  return (
    <div
      className={`activity-ai-backdrop${activityFormOpen ? " is-activity-form-open" : ""}${dailySummaryOpen ? " is-daily-summary-open" : ""}`}
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="activity-ai-assistant"
        role="dialog"
        aria-modal="true"
        aria-label="คุยกับ MR.Zettascale เพื่อสร้างกิจกรรม"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="activity-ai-header">
          <div>
            <span>✦</span>
            <strong>MR.Zettascale</strong>
            <small>ผู้ช่วยวางแผนกิจกรรม</small>
          </div>
          <div>
            <button type="button" onClick={reset} disabled={pending}>
              เคลียร์แชท
            </button>
            <button type="button" onClick={onClose} aria-label="ปิดแชต">
              ×
            </button>
          </div>
        </header>
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
        <main className="activity-ai-messages">
          {rootQuestions.length > 0 && (
            <section
              className="activity-ai-centered-questions"
              aria-label="คำถามทั่วไป"
            >
              <small>คำถามทั่วไป · ไม่ใช้ข้อมูลส่วนตัว · ไม่ใช้ AI quota</small>
              <div>
                {rootQuestions.map((question) => (
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
            </section>
          )}
          {canUseGemini && (
            <section
              className="activity-ai-centered-questions activity-ai-calendar-questions"
              aria-label="ให้ AI วิเคราะห์ข้อมูลส่วนตัว"
            >
              <small>ทดลอง AI สำหรับนักพัฒนา · ใช้ AI quota 1 ครั้ง</small>
              <div>
                {CALENDAR_AI_QUESTION_SUGGESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => send(null, question)}
                    disabled={pending || cooldownSeconds > 0}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </section>
          )}
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className="activity-ai-message-group"
            >
              <div
                className={`activity-ai-message is-${message.role}${message.source === "ai" || message.source === "calendar" ? " is-ai-turn" : ""}${message.source === "knowledge" ? " is-knowledge-turn" : ""}${message.source === "template" ? " is-system-turn" : ""}${message.followUpQuestions?.length > 0 ? " has-followups" : ""}`}
              >
                <span>{message.text}</span>
              </div>
              {message.followUpQuestions?.length > 0 && (
                <div className="activity-ai-answer-followups">
                  {message.followUpQuestions.map((question) => (
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
                      {formatScheduleRange(
                        alternative.startLocal,
                        alternative.endLocal,
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {telegramMessages.map((message) => (
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
          {telegramError && (
            <p className="activity-ai-error">{telegramError}</p>
          )}
          {pending && (
            <p
              className={`activity-ai-message is-assistant is-thinking${pendingSource === "ai" ? " is-ai-turn" : ""}`}
            >
              {pendingSource === "ai"
                ? "กำลังให้ AI ช่วยคิดรายละเอียด…"
                : "กำลังสร้างร่างกิจกรรม…"}
            </p>
          )}
          <div ref={bottomRef} />
        </main>
        {error && <p className="activity-ai-error">{error}</p>}
        {(!guidedActivity || guidedConversationMode === "template") && (
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
              {onOpenDailySummary && (
                <button
                  type="button"
                  onClick={runDailySummary}
                  disabled={pending}
                >
                  สรุปวันนี้
                </button>
              )}
              {CALENDAR_FACT_SUGGESTIONS.map((question) => (
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
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              guidedActivity
                ? canUseGemini
                  ? "พิมพ์เองเพื่อให้ AI ตอบต่อจากตัวเลือกด้านบน…"
                  : "เลือกขั้นตอนด้านบน หรือพิมพ์ชื่อกิจกรรม"
                : "ทำงาน 08.30 พรุ่งนี้ 3 ชม. · หรือ พรุ่งนี้ว่างช่วงไหน?"
            }
            maxLength="1200"
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
      </section>
    </div>
  );
}
