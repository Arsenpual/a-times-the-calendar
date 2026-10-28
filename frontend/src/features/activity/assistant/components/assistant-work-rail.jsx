export default function AssistantWorkRail({ setWorkRailOpen, guidedActivity, conversationNodeId, scheduleResolution, pending, updateGuidedActivityField, retryGuidedActivityDraft, selectQuickReply, toolCommands, weatherTool, renderTelegramArchive, activitySteps }) {
  return (
    <aside id="activity-ai-work-rail" className="activity-ai-work-rail" aria-label="แผงงาน AI">
          <header className="activity-ai-rail-header"><strong>แผงงาน</strong><button type="button" onClick={() => setWorkRailOpen(false)} aria-label="ซ่อนแผงงาน">×</button></header>
          <div className="activity-ai-rail-content">
            {guidedActivity ? <div className="activity-ai-rail-progress">
              <h2>สร้างกิจกรรม</h2>
              <ol aria-label="ขั้นตอนสร้างกิจกรรม">{activitySteps.map((step, index) => {
                const currentIndex = activitySteps.findIndex((item) => item.node === conversationNodeId);
                return <li key={step.node} aria-current={index === currentIndex ? "step" : undefined} className={index < currentIndex ? "is-done" : ""}><span>{index < currentIndex ? "✓" : index + 1}</span>{step.label}</li>;
              })}</ol>
              <p className="activity-ai-rail-note">ตอบคำถามในแชทให้ครบ แล้วตรวจร่างในฟอร์มก่อนบันทึก</p>
              {scheduleResolution && <p className="activity-ai-rail-conflict">เวลาที่เลือกชนเกินจำนวนที่รองรับ เลือกช่วงเวลาแนะนำในแชทหรือแก้เวลาในแผงงาน</p>}
              <div className="activity-ai-rail-fields">
                {(conversationNodeId === "activity.date" || guidedActivity.date !== undefined) && <label>วัน<input type="date" value={guidedActivity.date || ""} disabled={pending} onChange={(event) => conversationNodeId === "activity.date" ? event.target.value && selectQuickReply({ label: event.target.value, value: event.target.value, next: "activity.title" }) : updateGuidedActivityField("date", event.target.value)} /></label>}
                {guidedActivity.title !== undefined && <label>ชื่อ<input type="text" value={guidedActivity.title} maxLength="120" disabled={pending} onChange={(event) => updateGuidedActivityField("title", event.target.value)} /></label>}
                {guidedActivity.time !== undefined && <label>เวลา<input type="time" value={guidedActivity.time} disabled={pending} onChange={(event) => updateGuidedActivityField("time", event.target.value)} /></label>}
                {guidedActivity.durationMinutes !== undefined && <label>ระยะเวลา (นาที)<input type="number" min="30" max="720" value={guidedActivity.durationMinutes} disabled={pending} onChange={(event) => updateGuidedActivityField("durationMinutes", Number(event.target.value) || "")} /></label>}
              </div>
              {guidedActivity.durationMinutes !== undefined && <button type="button" className="activity-ai-rail-retry" onClick={retryGuidedActivityDraft} disabled={pending}>สร้างร่างเพื่อตรวจอีกครั้ง</button>}
              <button type="button" className="activity-ai-rail-cancel" onClick={() => selectQuickReply({ kind: "home", label: "ยกเลิกการสร้างกิจกรรม" })} disabled={pending}>ยกเลิกการสร้างกิจกรรม</button>
            </div> : <>
              <h2>เครื่องมือ</h2>
              {toolCommands}
              {weatherTool}
            </>}
          </div>
          {renderTelegramArchive("rail")}
        </aside>
  );
}
