import { useEffect, useRef, useState } from "react";
import { continueActivityAssistant, getActivityAssistantStatus, setActivityAssistantEnabled } from "../api/activity-assistant.js";
import { toDateInputValue } from "../../../shared/lib/date-utils.js";

const WELCOME = "สวัสดีครับ ผม MR.Zettascale ✦ บอกสิ่งที่อยากทำคร่าว ๆ ได้เลย เช่น “พรุ่งนี้ประชุมทีมช่วงเช้า” แล้วผมจะช่วยเก็บรายละเอียดให้ครบก่อนสร้างกิจกรรม";

export default function ActivityAiAssistant({ open, onClose, categories, onConfirmDraft }) {
  const [messages, setMessages] = useState([{ role: "assistant", text: WELCOME }]);
  const [draft, setDraft] = useState(null);
  const [editingDraft, setEditingDraft] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState(null);
  const bottomRef = useRef(null);
  const savingRef = useRef(false);
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ block: "end" }); }, [open, messages, pending]);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  useEffect(() => {
    if (!open) return;
    getActivityAssistantStatus().then((result) => setAiStatus(result.aiChat)).catch((requestError) => setError(requestError.message));
  }, [open]);
  if (!open) return null;
  const reset = () => { setMessages([{ role: "assistant", text: WELCOME }]); setDraft(null); setEditingDraft(false); setError(""); setInput(""); };
  const send = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages); setInput(""); setPending(true); setError(""); setDraft(null); setEditingDraft(false);
    try {
      const result = await continueActivityAssistant({
        text, history: messages.slice(1), referenceDate: toDateInputValue(new Date()),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        categories: categories.map((category) => category.name)
      });
      setMessages((current) => [...current, { role: "assistant", text: result.reply }]);
      if (result.ready) setDraft(result.draft);
    } catch (requestError) { setError(requestError.message || "MR.Zettascale ยังตอบไม่ได้ในขณะนี้"); }
    finally {
      setPending(false);
      getActivityAssistantStatus().then(result => setAiStatus(result.aiChat)).catch(() => {});
    }
  };
  const confirm = async () => {
    if (!draft || pending || savingRef.current) return;
    savingRef.current = true;
    setPending(true); setError("");
    try { await onConfirmDraft(draft); setDraft(null); setMessages([{ role: "assistant", text: "สร้างกิจกรรมสำเร็จแล้วครับ ต้องการสร้างกิจกรรมใหม่บอกได้เลย" }]); onClose(); }
    catch (requestError) { setError(requestError.message || "สร้างกิจกรรมไม่สำเร็จ"); }
    finally { savingRef.current = false; setPending(false); }
  };
  const updateDraft = (field, value) => setDraft((current) => {
    if (field === 'allDay' && value) {
      const startDate = current.startLocal.slice(0, 10);
      const next = new Date(`${startDate}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      return { ...current, allDay: true, startLocal: `${startDate}T00:00`, endLocal: `${next.toISOString().slice(0, 10)}T00:00` };
    }
    return { ...current, [field]: value };
  });
  const toggleAi = async (enabled) => {
    try {
      setError("");
      const result = await setActivityAssistantEnabled(enabled);
      setAiStatus(result.aiChat);
    } catch (requestError) { setError(requestError.message || "เปลี่ยนสถานะ AI ไม่สำเร็จ"); }
  };
  return <div className="activity-ai-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="activity-ai-assistant" role="dialog" aria-modal="true" aria-label="คุยกับ MR.Zettascale เพื่อสร้างกิจกรรม" onMouseDown={(event) => event.stopPropagation()}>
      <header className="activity-ai-header"><div><span>✦</span><strong>MR.Zettascale</strong><small>ผู้ช่วยวางแผนกิจกรรม</small></div><div>{aiStatus && <label className="activity-ai-switch" title="เปิดหรือพัก AI เพื่อควบคุมโควต้าของคุณ"><input type="checkbox" checked={Boolean(aiStatus.enabled)} disabled={!aiStatus.allowed || !aiStatus.globallyEnabled} onChange={(event) => toggleAi(event.target.checked)} /><span>{aiStatus.enabled ? "AI เปิด" : "AI ปิด"}</span></label>}<button type="button" onClick={reset} disabled={pending}>เริ่มใหม่</button><button type="button" onClick={onClose} aria-label="ปิดแชต">×</button></div></header>
      {aiStatus && <p className="activity-ai-quota">เหลือ {Math.max(0, aiStatus.userDay.limit - aiStatus.userDay.used)}/{aiStatus.userDay.limit} วันนี้ · {Math.max(0, aiStatus.userWindow.limit - aiStatus.userWindow.used)}/{aiStatus.userWindow.limit} ใน 15 นาที</p>}
      <main className="activity-ai-messages">
        {messages.map((message, index) => <p key={`${message.role}-${index}`} className={`activity-ai-message is-${message.role}`}>{message.text}</p>)}
        {pending && <p className="activity-ai-message is-assistant is-thinking">กำลังช่วยคิดรายละเอียด…</p>}
        {draft && <section className="activity-ai-review"><strong>ร่างกิจกรรมพร้อมตรวจสอบ</strong>{draft.assumptions?.length > 0 && <small>ค่าที่สันนิษฐาน: {draft.assumptions.join(" · ")}</small>}{editingDraft ? <div className="activity-ai-manual-editor">
          <label>ชื่อกิจกรรม<input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
          <label><input type="checkbox" checked={Boolean(draft.allDay)} onChange={(event) => updateDraft("allDay", event.target.checked)} /> กิจกรรมทั้งวัน</label>
          <div className="activity-ai-time-fields"><label>เริ่ม<input type={draft.allDay ? "date" : "datetime-local"} value={draft.allDay ? draft.startLocal.slice(0, 10) : draft.startLocal} onChange={(event) => updateDraft("startLocal", draft.allDay ? `${event.target.value}T00:00` : event.target.value)} /></label><label>สิ้นสุด<input type={draft.allDay ? "date" : "datetime-local"} value={draft.allDay ? draft.endLocal.slice(0, 10) : draft.endLocal} onChange={(event) => updateDraft("endLocal", draft.allDay ? `${event.target.value}T00:00` : event.target.value)} /></label></div>
          <label>หมวดหมู่<select value={draft.categoryName || ""} onChange={(event) => updateDraft("categoryName", event.target.value)}><option value="">ไม่ระบุ</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>
          <label>Tags (คั่นด้วย comma)<input value={(draft.tags || []).join(", ")} onChange={(event) => updateDraft("tags", event.target.value.split(",").map(tag => tag.trim()).filter(Boolean))} /></label>
          <label>โน้ต<textarea value={draft.notes || ""} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
        </div> : <><span>{draft.title}</span><small>{draft.allDay ? `ทั้งวัน ${draft.startLocal.slice(0, 10)} ถึง ${draft.endLocal.slice(0, 10)} (ไม่รวมวันสิ้นสุด)` : `${draft.startLocal.replace("T", " ")} – ${draft.endLocal.replace("T", " ")}`}</small>{draft.categoryName && <small>หมวดหมู่: {draft.categoryName}</small>}{draft.notes && <small>{draft.notes}</small>}</>}<div><button type="button" onClick={() => setEditingDraft((current) => !current)}>{editingDraft ? "เสร็จสิ้นการแก้ไข" : "Edit detail"}</button><button type="button" className="btn btn-primary" onClick={confirm} disabled={pending || !draft.title || !draft.startLocal || !draft.endLocal}>Confirm สร้างกิจกรรม</button></div></section>}
        <div ref={bottomRef} />
      </main>
      {error && <p className="activity-ai-error">{error}</p>}
      <form className="activity-ai-composer" onSubmit={send}><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="เล่ากิจกรรมที่ต้องการสร้าง…" maxLength="1200" autoFocus /><button type="submit" className="btn btn-primary" disabled={pending || !input.trim() || aiStatus?.enabled === false}>ส่ง</button></form>
    </section>
  </div>;
}
