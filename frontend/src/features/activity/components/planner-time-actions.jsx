import React from "react";
export default function PlannerTimeActions({ changes }) {
  const busy = changes.isSavingTimeChanges;
  return <div className="planner-time-actions" aria-label="จัดการการปรับเวลา">
    <button type="button" className="planner-save" disabled={busy || !changes.pendingTimeChanges.size} onClick={changes.savePendingTimeChanges}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
    <button type="button" disabled={busy || !changes.undoTimeChangeHistory.length} onClick={changes.undoTimeChange}>↶ ย้อนกลับ</button>
    <button type="button" disabled={busy || !changes.redoTimeChangeHistory.length} onClick={changes.redoTimeChange}>↷ ทำซ้ำ</button>
  </div>;
}
