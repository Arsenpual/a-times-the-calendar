import { useState } from "react";

export default function TelegramWebChat({ isOpen, messages, error, onClose, onSend }) {
  const [draft, setDraft] = useState("");
  if (!isOpen) return null;
  const submit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await onSend(text);
  };
  return <div className="telegram-web-chat-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="telegram-web-chat" role="dialog" aria-modal="true" aria-label="แชตกับ MR.Zettascale" onMouseDown={(event) => event.stopPropagation()}>
      <header><strong>✈ MR.Zettascale</strong><button type="button" onClick={onClose} aria-label="ปิดแชต">×</button></header>
      <div className="telegram-web-chat__messages">
        {messages.length === 0 && <p>ยังไม่มีข้อความในแชตนี้</p>}
        {messages.map((message) => <p key={message.id} className={`telegram-web-chat__message is-${message.direction}`}>{message.text}</p>)}
      </div>
      {error && <p className="telegram-web-chat__error">{error}</p>}
      <form onSubmit={submit}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="พิมพ์ข้อความถึงบอต" maxLength="4000" autoFocus /><button type="submit">ส่ง</button></form>
    </section>
  </div>;
}
