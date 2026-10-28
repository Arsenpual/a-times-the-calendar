export default function AssistantComposer({ presentation, guidedActivity, chatStyle, setChatStyle, input, setInput, send, canUseGemini, conversationNodeId, cooldownSeconds, cooldownLabel, pending, onSendTelegramMessage, sendToTelegram }) {
  return (
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
          ? conversationNodeId === "activity.date"
            ? "พิมพ์ วันนี้, พรุ่งนี้ หรือ YYYY-MM-DD หรือเลือกวันที่ด้านบน"
            : conversationNodeId === "activity.title"
              ? "พิมพ์ชื่อกิจกรรมตามต้องการ หรือเลือกตัวอย่างด้านบน"
              : canUseGemini
                ? "พิมพ์เองเพื่อให้ AI ตอบต่อจากตัวเลือกด้านบน…"
                : "เลือกคำตอบด้านบน หรือแก้ข้อมูลในแผงงาน"
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
      disabled={pending || !input.trim() || (cooldownSeconds > 0 && !guidedActivity)}
    >
      {guidedActivity && ["activity.date", "activity.title"].includes(conversationNodeId)
        ? "ถัดไป"
        : cooldownSeconds > 0
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
  );
}
