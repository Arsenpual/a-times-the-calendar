import React from "react";
import BrandWordmark from "../../shared/ui/brand-wordmark.jsx";

export default function AppHeader({
  summaryOpen,
  onToggleSummary,
  summaryContent,
  navigationExpanded,
  onToggleNavigation,
  firebaseUser,
  reminderHeaderRef,
  aiHeaderRef,
  mode,
  goToday,
  navigateDay,
  navigateWeek,
  activityHeaderTitle,
  weekSpineViewMode,
  setWeekSpineView,
  tagSearchTerms,
  setTagSearchTerms,
  tagSearchDraft,
  setTagSearchDraft,
  openAddActivity,
  cursorDate,
  calendarAccessToken,
  accountMenuRef,
  accountMenuOpen,
  setAccountMenuOpen,
  setSettingsOpen,
  handleLogout,
}) {
  return (
    <>
{firebaseUser && (
        <header className={`app-header${mode === "reminder" ? " app-header--reminder" : ""}${mode === "ai" ? " app-header--ai" : ""}`}>
          <div className="app-header-left">
            <button id="app-navigation-toggle" className="btn-icon app-navigation-toggle" type="button" onClick={onToggleNavigation} aria-label={navigationExpanded ? "ซ่อนเมนูฟีเจอร์" : "เปิดเมนูฟีเจอร์"} aria-expanded={Boolean(navigationExpanded)} aria-controls="app-taskbar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <BrandWordmark className="app-logo" />
            {mode === "reminder" && <span className="header-feature-title">Reminder</span>}
            {mode === "activity" && (
              <div className="header-calendar-tools">
                <button className="btn btn-outline" onClick={goToday}>
                  วันนี้
                </button>
                <div className="calendar-nav-pad" role="group" aria-label="ปุ่มนำทางปฏิทิน">
                  <button className="btn-icon calendar-nav-up" onClick={() => navigateDay(-1)} aria-label="วันก่อนหน้า">
                    ▲
                  </button>
                  <button className="btn-icon calendar-nav-left" onClick={() => navigateWeek(-1)} aria-label="สัปดาห์ก่อนหน้า">
                    ◀
                  </button>
                  <span className="calendar-nav-center" aria-hidden="true" />
                  <button className="btn-icon calendar-nav-right" onClick={() => navigateWeek(1)} aria-label="สัปดาห์ถัดไป">
                    ▶
                  </button>
                  <button className="btn-icon calendar-nav-down" onClick={() => navigateDay(1)} aria-label="วันถัดไป">
                    ▼
                  </button>
                </div>
                <h1 className="app-title">
                  <span className="app-title-date">{activityHeaderTitle.date}</span>
                  <span className="app-title-period">{activityHeaderTitle.period}</span>
                </h1>
                <div className="header-week-spine-view-switch" role="group" aria-label="มุมมอง Activity Mode">
                  <button type="button" className={weekSpineViewMode === "week" ? "is-active" : ""} onClick={() => setWeekSpineView("week")}>1 สัปดาห์</button>
                  <button type="button" className={weekSpineViewMode === "four-weeks" ? "is-active" : ""} onClick={() => setWeekSpineView("four-weeks")}>Cycle</button>
                </div>
              </div>
            )}
          </div>

          {mode === "reminder" && (
            <div className="app-header-reminder-slot" ref={reminderHeaderRef} role="group" aria-label="เครื่องมือ Reminder" />
          )}
          {mode === "ai" && (
            <div className="app-header-ai-slot" ref={aiHeaderRef} role="group" aria-label="เครื่องมือ AI Mode" />
          )}

          <div className="app-header-right">
            {mode === "activity" ? (
              <>
                <button type="button" className="btn btn-outline" aria-expanded={Boolean(summaryOpen)} aria-controls="header-summary" onClick={onToggleSummary}>{summaryOpen ? "ซ่อนสรุป" : "แสดงสรุป"}</button>
                <div className="tag-search-wrap">
                  <svg className="tag-search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m16 16 4.5 4.5" />
                  </svg>
                  {tagSearchTerms.map((term) => (
                    <span key={term} className="tag-search-chip">
                      #{term}
                      <button
                        type="button"
                        className="tag-search-chip-remove"
                        onClick={() => setTagSearchTerms((prev) => prev.filter((t) => t !== term))}
                        aria-label={`ลบคำค้นหา ${term}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    className="tag-search-input"
                    placeholder={tagSearchTerms.length === 0 ? "ค้นหาด้วย tag..." : "เพิ่ม tag..."}
                    value={tagSearchDraft}
                    onChange={(e) => setTagSearchDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const trimmed = tagSearchDraft.trim();
                        setTagSearchDraft("");
                        if (!trimmed) return;
                        setTagSearchTerms((prev) =>
                          prev.some((t) => t.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
                        );
                      } else if (e.key === "Backspace" && tagSearchDraft === "" && tagSearchTerms.length > 0) {
                        setTagSearchTerms((prev) => prev.slice(0, -1));
                      }
                    }}
                    aria-label="ค้นหากิจกรรมด้วย tag — พิมพ์แล้วกด Enter เพื่อค้นหาได้หลาย tag พร้อมกัน"
                  />
                  {(tagSearchTerms.length > 0 || tagSearchDraft) && (
                    <button
                      type="button"
                      className="tag-search-clear"
                      onClick={() => {
                        setTagSearchTerms([]);
                        setTagSearchDraft("");
                      }}
                      aria-label="ล้างคำค้นหาทั้งหมด"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => openAddActivity(new Date(cursorDate))}
                  disabled={!calendarAccessToken}
                >
                  + เพิ่มกิจกรรม
                </button>
              </>
            ) : null}
            <div className="account-menu-wrap" ref={accountMenuRef}>
              <button
                type="button"
                className="account-menu-trigger"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-label="เปิดเมนูบัญชีผู้ใช้"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                {firebaseUser.photoURL
                  ? <img src={firebaseUser.photoURL} alt="" referrerPolicy="no-referrer" />
                  : <span className="account-menu-avatar-fallback" aria-hidden="true">{(firebaseUser.displayName || firebaseUser.email || "U").trim().charAt(0).toUpperCase()}</span>}
              </button>
              {accountMenuOpen && (
                <div className="account-menu" role="menu">
                  <div className="account-menu-identity">
                    {firebaseUser.photoURL
                      ? <img src={firebaseUser.photoURL} alt="" referrerPolicy="no-referrer" />
                      : <span className="account-menu-avatar-fallback" aria-hidden="true">{(firebaseUser.displayName || firebaseUser.email || "U").trim().charAt(0).toUpperCase()}</span>}
                    <div>
                      {firebaseUser.displayName && <strong>{firebaseUser.displayName}</strong>}
                      <span>{firebaseUser.email || "ไม่พบอีเมลบัญชี"}</span>
                    </div>
                  </div>
                  <div className="account-menu-actions">
                    <button type="button" role="menuitem" onClick={() => { setSettingsOpen(true); setAccountMenuOpen(false); }}>⚙️ การตั้งค่า</button>
                    <button type="button" role="menuitem" className="is-danger" onClick={() => { setAccountMenuOpen(false); handleLogout(); }}>ออกจากระบบ</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {mode === "activity" && summaryOpen && <div className="app-header-summary" id="header-summary">{summaryContent}</div>}
        </header>
      )}
    </>
  );
}
