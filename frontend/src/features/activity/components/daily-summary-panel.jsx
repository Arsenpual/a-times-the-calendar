import React from "react";

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours ? `${hours} ชม.${remaining ? ` ${remaining} นาที` : ""}` : `${remaining} นาที`;
};

const formatTime = (iso) => iso ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "";

export default function DailySummaryPanel({ summary, loading, error, onClose }) {
  return <aside className="summary-panel daily-summary-panel">
    <div className="daily-summary-panel__header"><div><p className="summary-label">สรุปกิจกรรมวันนี้</p><strong>{summary?.date || "กำลังโหลด…"}</strong></div><button type="button" onClick={onClose} aria-label="กลับสรุปสัปดาห์">×</button></div>
    {loading && <p className="summary-loading">กำลังสรุปกิจกรรมวันนี้…</p>}
    {error && <p className="summary-error">{error}</p>}
    {summary && !loading && <>
      <p className="summary-total">{summary.totalActivities} กิจกรรม · {formatDuration(summary.totalMinutes)}</p>
      {summary.allDayActivities > 0 && <p className="daily-summary-panel__all-day">กิจกรรมทั้งวัน {summary.allDayActivities} รายการ</p>}
      {summary.byCategory.length > 0 && <div className="summary-breakdown"><p className="summary-breakdown-label">เวลาแยกตามหมวดหมู่</p>{summary.byCategory.map((item) => <div className="daily-summary-panel__category" key={item.categoryId || "none"}><span style={{ background: item.color }} /><span>{item.name}</span><strong>{formatDuration(item.minutes)}</strong></div>)}</div>}
      <div className="daily-summary-panel__list"><p className="summary-breakdown-label">รายการวันนี้</p>{summary.activities.length ? summary.activities.map((activity) => <div key={activity.id} className="daily-summary-panel__activity"><span>{activity.allDay ? "ทั้งวัน" : `${formatTime(activity.start)}–${formatTime(activity.end)}`}</span><strong>{activity.title}</strong></div>) : <p>วันนี้ยังไม่มีกิจกรรม</p>}</div>
    </>}
  </aside>;
}
