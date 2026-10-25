import React from "react";

function TaskbarIcon({ name }) {
  const paths = {
    activity: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 10h16m-12 4h3m2 3h3" /></>,
    reminder: <><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9m4 12h4" /></>,
    assistant: <><rect x="3" y="6" width="18" height="15" rx="5" /><path d="M12 3v3m-5 6h2m6 0h2m-9 5h8" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function AppTaskbar({ mode, expanded, onClose, onSelectMode, onOpenAssistant, unreadCount = 0, onSyncGoogleCalendar, googleCalendarSyncing = false }) {
  const closeAndFocus = () => {
    onClose();
    document.getElementById("app-navigation-toggle")?.focus();
  };
  return <nav id="app-taskbar" className={`app-taskbar${expanded ? " is-expanded" : ""}`} aria-label="ฟีเจอร์หลัก" onKeyDown={(event) => {
    if (event.key === "Escape" && expanded) { event.stopPropagation(); closeAndFocus(); }
  }}>
    <div className="taskbar-destinations">
      {[{ id: "activity", label: "Activity" }, { id: "reminder", label: "Reminder" }].map(({ id, label }) =>
        <button key={id} type="button" className={`taskbar-item${mode === id ? " is-active" : ""}`} aria-current={mode === id ? "page" : undefined} onClick={() => { onSelectMode(id); document.getElementById("app-navigation-toggle")?.focus(); }}>
          <span className="taskbar-icon"><TaskbarIcon name={id} /></span><span>{label}</span>
        </button>
      )}
      <button type="button" className={`taskbar-item${mode === "ai" ? " is-active" : ""}`} onClick={() => { onOpenAssistant(); document.getElementById("app-navigation-toggle")?.focus(); }} aria-pressed={mode === "ai"} aria-controls="ai-mode-workspace" aria-label={`${mode === "ai" ? "ออกจาก AI Mode" : "เปิด AI Mode MR.Zettascale"}${unreadCount > 0 ? ` มี ${unreadCount} ข้อความที่ยังไม่อ่าน` : ""}`}><span className="taskbar-icon"><TaskbarIcon name="assistant" />{unreadCount > 0 && <span className="taskbar-unread" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}</span><span>AI Mode</span></button>
    </div>
    <button type="button" className="taskbar-item google-calendar-sync-btn" onClick={onSyncGoogleCalendar} disabled={googleCalendarSyncing} aria-busy={googleCalendarSyncing} aria-label={googleCalendarSyncing ? "กำลังซิงค์ Google Calendar" : "ซิงค์ Google Calendar"} title="ดึงกิจกรรมสัปดาห์นี้">
      <span className="taskbar-icon"><img src={`${import.meta.env.BASE_URL}logo/google-calendar.svg`} alt="" /></span>
      <span>{googleCalendarSyncing ? "กำลังซิงค์" : "Sync"}</span>
    </button>
  </nav>;
}
