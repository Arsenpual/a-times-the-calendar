export default function AssistantHeader({ presentation, embedded = false, pending, saving = false, canUseGemini, workRailOpen, setWorkRailOpen, confirmResetOpen, setConfirmResetOpen, reset, onClose }) {
  const HeaderTag = embedded ? "div" : "header";
  return (
  <HeaderTag className="activity-ai-header">
    <div>
      <span>✦</span>
      <strong>MR.Zettascale</strong>
      <small>{presentation === "page" ? saving ? "กำลังบันทึกกิจกรรม…" : pending ? "กำลังตอบ…" : canUseGemini ? "พร้อมคุย · ใช้ AI" : "AI จำกัดสิทธิ์ · ใช้เครื่องมือที่ไม่เรียก AI ได้" : "ผู้ช่วยวางแผนกิจกรรม"}</small>
    </div>
    <div>
      {presentation === "page" && <button type="button" className="activity-ai-rail-toggle" aria-expanded={workRailOpen} aria-controls="activity-ai-work-rail" onClick={() => setWorkRailOpen((current) => !current)}>{workRailOpen ? "ซ่อนแผงงาน" : "เปิดแผงงาน"}</button>}
      {presentation === "page" ? <div className="activity-ai-reset-wrap">
        <button type="button" onClick={() => setConfirmResetOpen((current) => !current)} aria-expanded={confirmResetOpen} disabled={pending}>แชท AI ใหม่</button>
        {confirmResetOpen && <div className="activity-ai-reset-confirm" role="dialog" aria-label="ยืนยันเริ่มแชท AI ใหม่">
          <strong>เริ่มแชท AI ใหม่?</strong>
          <p>ล้างเฉพาะบทสนทนา AI บนเว็บ สำเนา Telegram ยังอยู่</p>
          <div><button type="button" onClick={() => setConfirmResetOpen(false)}>ยกเลิก</button><button type="button" onClick={() => { reset(); setConfirmResetOpen(false); }}>เริ่มแชทใหม่</button></div>
        </div>}
      </div> : <button type="button" onClick={reset} disabled={pending}>เคลียร์แชท</button>}
      <button type="button" onClick={onClose} aria-label={presentation === "page" ? "กลับโหมดก่อนหน้า" : "ปิดแชต"}>
        {presentation === "page" ? "กลับ" : "×"}
      </button>
    </div>
  </HeaderTag>
  );
}
