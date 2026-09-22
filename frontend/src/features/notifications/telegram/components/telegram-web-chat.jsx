import { useEffect, useRef, useState } from "react";

export default function TelegramWebChat({ isOpen, messages, error, onClose, onSend, onRead }) {
  const [draft, setDraft] = useState("");
  const messageNodes = useRef({});
  const unreadMessages = messages.filter((message) => message.direction === "outgoing" && !message.readAt);
  const unreadKey = unreadMessages.map((message) => message.id).join(":");
  useEffect(() => {
    if (!isOpen) return;
    const firstUnread = unreadMessages[0];
    const target = firstUnread ? messageNodes.current[firstUnread.id] : messageNodes.current[messages.at(-1)?.id];
    target?.scrollIntoView({ block: firstUnread ? "center" : "end", behavior: "smooth" });
    if (firstUnread) {
      const timer = window.setTimeout(() => onRead?.(), 220);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, unreadKey, messages, onRead]);
  if (!isOpen) return null;
  const submit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await onSend(text);
  };
  return <div className="telegram-web-chat-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="telegram-web-chat" role="dialog" aria-modal="true" aria-label="ข้อความจาก Telegram" onMouseDown={(event) => event.stopPropagation()}>
      <header><strong>✈ Telegram</strong><span className="telegram-web-chat__header-actions"><button type="button" onClick={onClose} aria-label="ปิดข้อความ">×</button></span></header>
      <div className="telegram-web-chat__messages">
        {messages.length === 0 && <p>ยังไม่มีข้อความในแชตนี้</p>}
        {messages.map((message) => <div key={message.id} ref={(node) => { if (node) messageNodes.current[message.id] = node; }} className={`telegram-web-chat__message is-${message.direction}${message.kind === "notification" ? " is-notification" : ""}`}>
          {message.kind === "notification" && <span className="telegram-web-chat__notification-label">MR.Zettascale · แจ้งเตือน</span>}
          <p>{message.text}</p>
        </div>)}
      </div>
      {error && <p className="telegram-web-chat__error">{error}</p>}
      <form onSubmit={submit}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="พิมพ์ข้อความถึงบอต" maxLength="4000" autoFocus /><button type="submit">ส่ง</button></form>
    </section>
  </div>;
}
