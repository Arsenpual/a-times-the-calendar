import { useEffect, useRef, useState } from "react";
import { continueActivityAssistant, createActivityTemplateDraft, getActivityAssistantStatus } from "../api/activity-assistant.js";
import { toDateInputValue } from "../../../shared/lib/date-utils.js";
import { getActivityAssistantConversationNode, getActivityAssistantSuggestedQuestions } from "../config/activity-assistant-conversation-tree.js";

const WELCOME = "สวัสดีครับ ผม MR.Zettascale ✦ บอกสิ่งที่อยากทำคร่าว ๆ ได้เลย เช่น “พรุ่งนี้ประชุมทีมช่วงเช้า” แล้วผมจะช่วยเก็บรายละเอียดให้ครบก่อนสร้างกิจกรรม";
const CHAT_STORAGE_KEY = "times.activity-ai-assistant.chat.v1";
const INITIAL_MESSAGE = { role: "assistant", text: WELCOME, source: "template" };

function loadSavedChat() {
  if (typeof window === "undefined") return { messages: [INITIAL_MESSAGE], conversationNodeId: "home", guidedActivity: null, draft: null };
  try {
    const saved = JSON.parse(window.localStorage.getItem(CHAT_STORAGE_KEY) || "null");
    const messages = Array.isArray(saved?.messages)
      ? saved.messages.slice(-120).filter((message) => ["user", "assistant"].includes(message?.role) && typeof message.text === "string").map((message) => ({ role: message.role, text: message.text.slice(0, 1_200), source: ["ai", "knowledge"].includes(message.source) ? message.source : "template" }))
      : [];
    return {
      messages: messages.length ? messages : [INITIAL_MESSAGE],
      conversationNodeId: typeof saved?.conversationNodeId === "string" ? saved.conversationNodeId : "home",
      guidedActivity: saved?.guidedActivity && typeof saved.guidedActivity === "object" ? saved.guidedActivity : null,
      draft: saved?.draft && typeof saved.draft === "object" ? saved.draft : null
    };
  } catch { return { messages: [INITIAL_MESSAGE], conversationNodeId: "home", guidedActivity: null, draft: null }; }
}

export default function ActivityAiAssistant({ open, onClose, categories, onConfirmDraft }) {
  const [initialChat] = useState(loadSavedChat);
  const [messages, setMessages] = useState(initialChat.messages);
  const [draft, setDraft] = useState(initialChat.draft);
  const [editingDraft, setEditingDraft] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingSource, setPendingSource] = useState("");
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [guidedActivity, setGuidedActivity] = useState(initialChat.guidedActivity);
  const [conversationNodeId, setConversationNodeId] = useState(initialChat.conversationNodeId);
  const [now, setNow] = useState(Date.now());
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
  useEffect(() => {
    if (!cooldownUntil || cooldownUntil <= Date.now()) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);
  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
        messages: messages.slice(-120), conversationNodeId, guidedActivity, draft
      }));
    } catch { /* Storage may be disabled or full; chat still works in memory. */ }
  }, [messages, conversationNodeId, guidedActivity, draft]);
  if (!open) return null;
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const cooldownLabel = cooldownSeconds > 0 ? `${Math.floor(cooldownSeconds / 60)}:${String(cooldownSeconds % 60).padStart(2, "0")}` : "";
  const aiRequestCount = messages.filter((message) => message.source === "ai" && message.role === "user").length;
  const reset = () => { setMessages([INITIAL_MESSAGE]); setDraft(null); setEditingDraft(false); setError(""); setInput(""); setGuidedActivity(null); setConversationNodeId("home"); };
  const addMessages = (...newMessages) => setMessages((current) => [...current, ...newMessages]);
  const finishGuidedActivity = async (selected) => {
    if (!selected?.title || !selected.date || !selected.time || !selected.durationMinutes) return;
    setGuidedActivity(null); setConversationNodeId("home"); setPending(true); setPendingSource("template"); setError("");
    try {
      const result = await createActivityTemplateDraft({ title: selected.title, date: selected.date, time: selected.time, durationMinutes: selected.durationMinutes, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, categories: categories.map((category) => category.name) });
      addMessages({ role: "assistant", text: result.reply, source: "template" }); setDraft(result.draft);
    } catch (requestError) { setError(requestError.message || "สร้างร่างจากข้อความสำเร็จรูปไม่สำเร็จ"); }
    finally { setPending(false); setPendingSource(""); }
  };
  const selectQuickReply = async (option) => {
    if (option.kind === "home") {
      const homeNode = getActivityAssistantConversationNode("home");
      setGuidedActivity(null); setConversationNodeId("home");
      addMessages({ role: "user", text: option.label, source: "template" }, { role: "assistant", text: homeNode.prompt, source: "template" });
      return;
    }
    if (option.kind === "branch") {
      const nextNode = getActivityAssistantConversationNode(option.next);
      setGuidedActivity(null); setConversationNodeId(option.next);
      addMessages({ role: "user", text: option.label, source: "template" }, { role: "assistant", text: nextNode.prompt, source: "template" });
      return;
    }
    if (option.kind === "start") {
      const nextNode = getActivityAssistantConversationNode(option.next);
      setDraft(null); setEditingDraft(false); setError(""); setGuidedActivity({}); setConversationNodeId(option.next);
      addMessages({ role: "user", text: "ฉันต้องการสร้างกิจกรรม", source: "template" }, { role: "assistant", text: nextNode.prompt, source: "template" });
      return;
    }
    const node = getActivityAssistantConversationNode(conversationNodeId);
    const value = option.dateOffset === undefined ? option.value : (() => { const date = new Date(); date.setDate(date.getDate() + option.dateOffset); return toDateInputValue(date); })();
    const selected = { ...guidedActivity, [node.field]: value };
    addMessages({ role: "user", text: option.label, source: "template" });
    if (option.complete) { await finishGuidedActivity(selected); return; }
    const nextNode = getActivityAssistantConversationNode(option.next);
    setGuidedActivity(selected); setConversationNodeId(option.next);
    addMessages({ role: "assistant", text: nextNode.prompt, source: "template" });
  };
  const conversationNode = getActivityAssistantConversationNode(conversationNodeId);
  const quickReplies = conversationNode.options.filter((option) => option.available !== false);
  const suggestedQuestions = getActivityAssistantSuggestedQuestions(conversationNodeId);
  const send = async (event, suggestedText = "") => {
    event?.preventDefault();
    const text = (suggestedText || input).trim();
    if (!text || pending || cooldownSeconds > 0) return;
    const nextMessages = [...messages, { role: "user", text, source: "ai" }];
    setMessages(nextMessages); setInput(""); setPending(true); setPendingSource("ai"); setError(""); setDraft(null); setEditingDraft(false);
    try {
      const history = messages.slice(1);
      // `text` is the current turn. Keep an accidentally duplicated current
      // message out of history so it cannot be interpreted as stale intent.
      if (history.at(-1)?.role === "user" && history.at(-1).text.trim() === text) history.pop();
      const result = await continueActivityAssistant({
        text, history, referenceDate: toDateInputValue(new Date()),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        categories: categories.map((category) => category.name)
      });
      const responseSource = result.source === "knowledge" ? "knowledge" : "ai";
      if (responseSource === "ai") { setGuidedActivity(null); setConversationNodeId("home"); }
      setMessages((current) => {
        const withCorrectedUserSource = responseSource === "knowledge"
          ? current.map((message, index) => index === current.length - 1 ? { ...message, source: "knowledge" } : message)
          : current;
        return [...withCorrectedUserSource, { role: "assistant", text: result.reply, source: responseSource }];
      });
      if (result.ready) setDraft(result.draft);
    } catch (requestError) {
      setError(requestError.message || "MR.Zettascale ยังตอบไม่ได้ในขณะนี้");
      if (requestError.retryAfterSeconds) setCooldownUntil(Date.now() + requestError.retryAfterSeconds * 1000);
    }
    finally {
      setPending(false); setPendingSource("");
      getActivityAssistantStatus().then(result => setAiStatus(result.aiChat)).catch(() => {});
    }
  };
  const confirm = async () => {
    if (!draft || pending || savingRef.current) return;
    savingRef.current = true;
    setPending(true); setPendingSource("template"); setError("");
    try { await onConfirmDraft(draft); setDraft(null); setMessages((current) => [...current, { role: "assistant", text: "สร้างกิจกรรมสำเร็จแล้วครับ ต้องการสร้างกิจกรรมใหม่บอกได้เลย", source: "template" }]); onClose(); }
    catch (requestError) { setError(requestError.message || "สร้างกิจกรรมไม่สำเร็จ"); }
    finally { savingRef.current = false; setPending(false); setPendingSource(""); }
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
  return <div className="activity-ai-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="activity-ai-assistant" role="dialog" aria-modal="true" aria-label="คุยกับ MR.Zettascale เพื่อสร้างกิจกรรม" onMouseDown={(event) => event.stopPropagation()}>
      <header className="activity-ai-header"><div><span>✦</span><strong>MR.Zettascale</strong><small>ผู้ช่วยวางแผนกิจกรรม</small></div><div><button type="button" onClick={reset} disabled={pending}>เริ่มใหม่</button><button type="button" onClick={onClose} aria-label="ปิดแชต">×</button></div></header>
      {aiStatus && <p className="activity-ai-quota">{aiStatus.isDeveloper ? "Developer quota · " : ""}เหลือ {Math.max(0, aiStatus.userDay.limit - aiStatus.userDay.used)}/{aiStatus.userDay.limit} วันนี้ · {Math.max(0, aiStatus.userWindow.limit - aiStatus.userWindow.used)}/{aiStatus.userWindow.limit} ใน 15 นาที · AI ในแชตนี้ {aiRequestCount} ครั้ง</p>}
      <main className="activity-ai-messages">
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`activity-ai-message is-${message.role}${message.source === "ai" ? " is-ai-turn" : ""}${message.source === "knowledge" ? " is-knowledge-turn" : ""}`}><small className="activity-ai-source">{message.source === "template" ? "● ข้อความสำเร็จรูป · ไม่ใช้ AI quota" : message.source === "knowledge" ? message.role === "user" ? "● คำถามทั่วไป · ไม่ใช้ AI quota" : "● คำตอบทั่วไปจาก T.i.M.E.S. · ไม่ใช้ AI quota" : message.role === "user" ? "✦ คำถามเฉพาะ/สร้างกิจกรรม · ใช้ AI quota 1 ครั้งวันนี้" : "✦ คำตอบจาก Gemini · ใช้ quota จากคำถามสีม่วงก่อนหน้าแล้ว"}</small><span>{message.text}</span></div>)}
        {pending && <p className={`activity-ai-message is-assistant is-thinking${pendingSource === "ai" ? " is-ai-turn" : ""}`}>{pendingSource === "ai" ? "กำลังให้ AI ช่วยคิดรายละเอียด…" : "กำลังสร้างร่างกิจกรรม…"}</p>}
        {draft && <section className="activity-ai-review"><strong>ร่างกิจกรรมพร้อมตรวจสอบ</strong>{draft.assumptions?.length > 0 && <small>ค่าที่สันนิษฐาน: {draft.assumptions.join(" · ")}</small>}{editingDraft ? <div className="activity-ai-manual-editor">
          <label>ชื่อกิจกรรม<input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
          <label><input type="checkbox" checked={Boolean(draft.allDay)} onChange={(event) => updateDraft("allDay", event.target.checked)} /> กิจกรรมทั้งวัน</label>
          <div className="activity-ai-time-fields"><label>เริ่ม<input type={draft.allDay ? "date" : "datetime-local"} value={draft.allDay ? draft.startLocal.slice(0, 10) : draft.startLocal} onChange={(event) => updateDraft("startLocal", draft.allDay ? `${event.target.value}T00:00` : event.target.value)} /></label><label>สิ้นสุด<input type={draft.allDay ? "date" : "datetime-local"} value={draft.allDay ? draft.endLocal.slice(0, 10) : draft.endLocal} onChange={(event) => updateDraft("endLocal", draft.allDay ? `${event.target.value}T00:00` : event.target.value)} /></label></div>
          <label>หมวดหมู่<select value={draft.categoryName || ""} onChange={(event) => updateDraft("categoryName", event.target.value)}><option value="">ไม่ระบุ</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>
          <label>Tags (คั่นด้วย comma)<input value={(draft.tags || []).join(", ")} onChange={(event) => updateDraft("tags", event.target.value.split(",").map(tag => tag.trim()).filter(Boolean))} /></label>
          <label>โน้ต<textarea value={draft.notes || ""} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
        </div> : <><span>{draft.title}</span><small>{draft.allDay ? `ทั้งวัน ${draft.startLocal.slice(0, 10)} ถึง ${draft.endLocal.slice(0, 10)} (ไม่รวมวันสิ้นสุด)` : `${draft.startLocal.replace("T", " ")} – ${draft.endLocal.replace("T", " ")}`}</small>{draft.tags?.length > 0 && <small>Tags: {draft.tags.map((tag) => `#${tag}`).join(" ")}</small>}{draft.categoryName && <small>หมวดหมู่: {draft.categoryName}</small>}{draft.notes && <small>{draft.notes}</small>}</>}<div><button type="button" onClick={() => setEditingDraft((current) => !current)}>{editingDraft ? "เสร็จสิ้นการแก้ไข" : "Edit detail"}</button><button type="button" className="btn btn-primary" onClick={confirm} disabled={pending || !draft.title || !draft.startLocal || !draft.endLocal}>Confirm สร้างกิจกรรม</button></div></section>}
        <div ref={bottomRef} />
      </main>
      {error && <p className="activity-ai-error">{error}</p>}
      {suggestedQuestions.length > 0 && <div className="activity-ai-suggested-questions" aria-label="คำถามทั่วไป"><small>คำถามทั่วไปสำหรับขั้นตอนนี้ · ไม่ใช้ AI quota</small>{suggestedQuestions.map((question) => <button key={question} type="button" onClick={() => send(null, question)} disabled={pending}>{question}</button>)}</div>}
      <div className="activity-ai-quick-replies" aria-label="ข้อความสำเร็จรูป"><small>ข้อความสำเร็จรูป · ไม่ใช้ AI quota</small>{quickReplies.map((reply) => <button key={reply.id} type="button" onClick={() => selectQuickReply(reply)} disabled={pending}>{reply.label}</button>)}</div>
      <form className="activity-ai-composer" onSubmit={send}><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={guidedActivity ? "พิมพ์เองเพื่อให้ AI ตอบต่อจากตัวเลือกด้านบน…" : "พิมพ์เพื่อให้ AI ช่วยต่อจากบทสนทนานี้…"} maxLength="1200" autoFocus /><button type="submit" className="btn btn-primary" disabled={pending || !input.trim() || aiStatus?.enabled === false || cooldownSeconds > 0}>{cooldownSeconds > 0 ? `รอ ${cooldownLabel}` : "ส่งให้ AI"}</button></form>
    </section>
  </div>;
}
