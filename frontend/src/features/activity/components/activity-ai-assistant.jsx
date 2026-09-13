import { useEffect, useRef, useState } from "react";
import { continueActivityAssistant } from "../api/activity-assistant.js";
import { toDateInputValue } from "../../../shared/lib/date-utils.js";

const WELCOME = "สวัสดีครับ ผม MR.Zettascale ✦ บอกสิ่งที่อยากทำคร่าว ๆ ได้เลย เช่น “พรุ่งนี้ประชุมทีมช่วงเช้า” แล้วผมจะช่วยเก็บรายละเอียดให้ครบก่อนสร้างกิจกรรม";

export default function ActivityAiAssistant({ open, onClose, categories, onConfirmDraft }) {
  const [messages, setMessages] = useState([{ role: "assistant", text: WELCOME }]);
  const [draft, setDraft] = useState(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ block: "end" }); }, [open, messages, pending]);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  const reset = () => { setMessages([{ role: "assistant", text: WELCOME }]); setDraft(null); setError(""); setInput(""); };
  const send = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages); setInput(""); setPending(true); setError(""); setDraft(null);
    try {
      const result = await continueActivityAssistant({
        text, history: nextMessages.slice(1), referenceDate: toDateInputValue(new Date()),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        categories: categories.map((category) => category.name)
      });
      setMessages((current) => [...current, { role: "assistant", text: result.reply }]);
      if (result.ready) setDraft(result.draft);
    } catch (requestError) { setError(requestError.message || "MR.Zettascale ยังตอบไม่ได้ในขณะนี้"); }
    finally { setPending(false); }
  };
  const confirm = () => { if (!draft) return; onConfirmDraft(draft); onClose(); };
  return <div className="activity-ai-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="activity-ai-assistant" role="dialog" aria-modal="true" aria-label="คุยกับ MR.Zettascale เพื่อสร้างกิจกรรม" onMouseDown={(event) => event.stopPropagation()}>
      <header className="activity-ai-header"><div><span>✦</span><strong>MR.Zettascale</strong><small>ผู้ช่วยวางแผนกิจกรรม</small></div><div><button type="button" onClick={reset}>เริ่มใหม่</button><button type="button" onClick={onClose} aria-label="ปิดแชต">×</button></div></header>
      <main className="activity-ai-messages">
        {messages.map((message, index) => <p key={`${message.role}-${index}`} className={`activity-ai-message is-${message.role}`}>{message.text}</p>)}
        {pending && <p className="activity-ai-message is-assistant is-thinking">กำลังช่วยคิดรายละเอียด…</p>}
        {draft && <section className="activity-ai-review"><strong>ร่างกิจกรรมพร้อมตรวจสอบ</strong><span>{draft.title}</span><small>{draft.allDay ? "กิจกรรมทั้งวัน" : `${draft.startLocal.replace("T", " ")} – ${draft.endLocal.replace("T", " ")}`}</small>{draft.categoryName && <small>หมวดหมู่: {draft.categoryName}</small>}<div><button type="button" onClick={() => setDraft(null)}>แก้รายละเอียดต่อ</button><button type="button" className="btn btn-primary" onClick={confirm}>Confirm และตรวจรายละเอียด</button></div></section>}
        <div ref={bottomRef} />
      </main>
      {error && <p className="activity-ai-error">{error}</p>}
      <form className="activity-ai-composer" onSubmit={send}><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="เล่ากิจกรรมที่ต้องการสร้าง…" maxLength="1200" autoFocus /><button type="submit" className="btn btn-primary" disabled={pending || !input.trim()}>ส่ง</button></form>
    </section>
  </div>;
}
