import { useActivityAssistantConversation } from "../hooks/use-activity-assistant-conversation.js";
import { useState } from "react";
import { INITIAL_ASSISTANT_MESSAGE } from "../hooks/use-assistant-chat-storage.js";
import {
  CALENDAR_AI_QUESTION_SUGGESTIONS,
  CALENDAR_FACT_SUGGESTIONS,
} from "../config/activity-assistant-conversation-tree.js";
import { formatScheduleOption, formatScheduleRange } from "../lib/schedule-format.js";

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

function ActivityAssistantCommandGroups({ canUseGemini, cooldownSeconds, onDailySummary, onSend, onSendKnowledge, pending, rootQuestions }) {
  return (
    <div className="activity-ai-command-grid">
      <section className="activity-ai-centered-questions activity-ai-planning-questions" aria-label="คำสั่งวางแผน">
        <small>วางแผนกิจกรรม</small>
        <div>
        {PLANNING_COMMANDS.map((command) => (
          <button key={command.label} type="button" onClick={() => onSend(null, command.text, "planning")} disabled={pending || cooldownSeconds > 0}>
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
          <button key={command.label} type="button" onClick={() => onSend(null, command.text, "calendar")} disabled={pending || cooldownSeconds > 0}>
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
  const [submitted, setSubmitted] = useState(false);
  const updateDraft = (index, update) => setDrafts((current) => current.map((draft, itemIndex) => itemIndex === index ? { ...draft, ...update } : draft));
  const selectedDrafts = drafts.filter((_, index) => selected.has(index));
  const submitPlan = async () => {
    if (submitted || selectedDrafts.length === 0) return;
    setSubmitted(true);
    const completed = await onConfirm(selectedDrafts);
    if (!completed) setSubmitted(false);
  };
  return (
    <section className="activity-ai-plan-preview" aria-label="ร่างแผนกิจกรรม">
      {drafts.map((draft, index) => (
        <div className="activity-ai-plan-item" key={`${draft.title}-${draft.startLocal}-${index}`}>
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
        </div>
      ))}
      <button type="button" className="btn btn-primary activity-ai-plan-confirm" onClick={submitPlan} disabled={pending || submitted || selectedDrafts.length === 0}>
        {submitted ? "ส่งแผนแล้ว" : `สร้าง ${selectedDrafts.length} กิจกรรม`}
      </button>
    </section>
  );
}

export default function ActivityAssistantDialog(props) {
  const [telegramArchiveError, setTelegramArchiveError] = useState("");
  const {
    open,
    presentation = "dialog",
    onClose,
    activityFormOpen = false,
    dailySummaryOpen = false,
    telegramMessages = [],
    telegramError = "",
    onOpenDailySummary,
    onSendTelegramMessage,
    onClearTelegramMessages,
    assistantInsight,
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
    chatStyle,
    setChatStyle,
    bottomRef,
    rootQuestions,
    quickReplies,
    reset,
    send,
    sendKnowledge,
    selectQuickReply,
    runDailySummary,
    selectScheduleAlternative,
    selectScheduleOption,
    confirmActivityPlan,
    sendToTelegram,
  } = useActivityAssistantConversation({ ...props, closeOnEscape: presentation !== "page", clearTelegramOnReset: presentation !== "page", freeConversation: presentation === "page" });
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
            <small>{presentation === "page" ? "AI Mode · ผู้ช่วยส่วนตัว" : "ผู้ช่วยวางแผนกิจกรรม"}</small>
          </div>
          <div>
            <button type="button" onClick={reset} disabled={pending}>
              {presentation === "page" ? "เริ่มแชทใหม่" : "เคลียร์แชท"}
            </button>
            <button type="button" onClick={onClose} aria-label={presentation === "page" ? "กลับโหมดก่อนหน้า" : "ปิดแชต"}>
              {presentation === "page" ? "กลับ" : "×"}
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
        {assistantInsight && (
          <p className="activity-ai-insight-context">
            ใช้ {assistantInsight.title} เป็นบริบทเฉพาะ session นี้
          </p>
        )}
        <div className="activity-ai-messages">
          {!guidedActivity && (
            <details className="activity-ai-tools" open={presentation !== "page" ? true : undefined}>
              <summary>เครื่องมือและคำสั่ง</summary>
              <ActivityAssistantCommandGroups
              canUseGemini={canUseGemini}
              cooldownSeconds={cooldownSeconds}
              onDailySummary={onOpenDailySummary ? runDailySummary : null}
              onSend={send}
              onSendKnowledge={sendKnowledge}
              pending={pending}
              rootQuestions={rootQuestions}
              />
            </details>
          )}
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className="activity-ai-message-group"
            >
              <div
                className={`activity-ai-message is-${message.role}${["ai", "free-ai", "calendar"].includes(message.source) ? " is-ai-turn" : ""}${message.source === "knowledge" ? " is-knowledge-turn" : ""}${message.source === "template" ? " is-system-turn" : ""}${message.commandTone ? ` is-command-tone-${message.commandTone}` : ""}${message.followUpQuestions?.length > 0 ? " has-followups" : ""}`}
              >
                <span>{presentation === "page" && message.text === INITIAL_ASSISTANT_MESSAGE.text ? "สวัสดีครับ คุยเรื่องทั่วไปได้ในโหมดคุยอิสระ ถ้าต้องการดูตารางหรือสร้างกิจกรรม ใช้เครื่องมือด้านบนหรือสลับเป็นวางแผนกิจกรรมครับ" : message.text}</span>
              </div>
              {presentation === "page" && message.role === "assistant" && index > 0 && (
                <small className="activity-ai-turn-source">{["ai", "free-ai"].includes(message.source) ? "AI" : message.source === "calendar" ? "AI · ปฏิทิน" : message.source === "knowledge" ? "ข้อมูลและกฎในเว็บ" : "คำตอบสำเร็จรูป"}</small>
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
                      {formatScheduleRange(
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
              {message.planDrafts?.length > 0 && (
                <ActivityPlanPreview initialDrafts={message.planDrafts} pending={pending} onConfirm={confirmActivityPlan} />
              )}
            </div>
          ))}
          {presentation === "page" && onSendTelegramMessage && (
            <details className="activity-ai-telegram-archive">
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
          )}
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
          {pending && (
            <p
              className={`activity-ai-message is-assistant is-thinking${pendingSource === "ai" ? " is-ai-turn" : ""}`}
            >
              {pendingSource === "knowledge" ? "กำลังค้นหาคำตอบ…" : pendingSource === "ai"
                ? "กำลังให้ AI ช่วยคิดรายละเอียด…"
                : "กำลังสร้างร่างกิจกรรม…"}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
        {error && <p className="activity-ai-error">{error}</p>}
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
          {presentation === "page" && !guidedActivity && <div className="activity-ai-chat-style" role="group" aria-label="วิธีคุยกับ AI">
            <button type="button" className={chatStyle === "free" ? "is-active" : ""} aria-pressed={chatStyle === "free"} onClick={() => setChatStyle("free")}>คุยอิสระ</button>
            <button type="button" className={chatStyle === "planning" ? "is-active" : ""} aria-pressed={chatStyle === "planning"} onClick={() => setChatStyle("planning")}>วางแผนกิจกรรม</button>
          </div>}
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              guidedActivity
                ? canUseGemini
                  ? "พิมพ์เองเพื่อให้ AI ตอบต่อจากตัวเลือกด้านบน…"
                  : "เลือกขั้นตอนด้านบน หรือพิมพ์ชื่อกิจกรรม"
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
      </section>
    </div>
  );
}
