import React from "react";
import BrandWordmark from "../../shared/ui/brand-wordmark.jsx";

export default function AppHeader({
  navigationExpanded,
  onToggleNavigation,
  firebaseUser,
  reminderHeaderRef,
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
  setCalendarTokenExpiresAtState,
  calendarTokenExpiresAtStorageKey,
  onTestFirestoreQuota,
  firestoreQuotaTestActive,
  accountMenuRef,
  accountMenuOpen,
  setAccountMenuOpen,
  setSettingsOpen,
  handleLogout,
}) {
  return (
    <>
{firebaseUser && (
        <header className={`app-header${mode === "reminder" ? " app-header--reminder" : ""}`}>
          <div className="app-header-left">
            <button id="app-navigation-toggle" className="btn-icon app-navigation-toggle" type="button" onClick={onToggleNavigation} aria-label={navigationExpanded ? "ย่อเมนูฟีเจอร์" : "เปิดเมนูฟีเจอร์"} aria-expanded={Boolean(navigationExpanded)} aria-controls="app-taskbar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <BrandWordmark className="app-logo" />
            {mode === "reminder" && <span className="header-feature-title">Reminder</span>}
            {mode === "ai" && <span className="header-feature-title">AI Mode</span>}
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

          <div className="app-header-right">
            {mode === "activity" ? (
              <>
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
                {/* 🧪 DEV TEST BUTTON — เดิมไม่มี guard ใดๆ ทำให้ปุ่มนี้ขึ้น
                    ในโปรดักชันจริงด้วย ตอนนี้ห่อด้วย import.meta.env.DEV
                    (Vite inject ให้เป็น false เสมอใน build production —
                    ทั้ง `npm run build` และ `npm run preview` ตัด branch
                    นี้ทิ้งไปเลยตอน tree-shaking ไม่ใช่แค่ซ่อนด้วย CSS) จึง
                    ไม่มีทางหลุดไป deploy จริงได้อีกไม่ว่าจะลืมลบเองหรือไม่
                    จำลอง token "ใกล้หมดอายุ" — ตั้ง calendarTokenExpiresAt
                    ให้เหลือ 4 นาทีจากตอนนี้ (น้อยกว่า
                    CALENDAR_TOKEN_WARNING_WINDOW_MS ที่ตั้งไว้ 5 นาที แต่
                    ยังมากกว่า 0) เพื่อให้ผ่านเงื่อนไขทั้งสองใน checkExpiry()
                    ด้านบนพร้อมกัน (msRemaining > 0 && msRemaining <= 5
                    นาที) แล้วเห็นการ์ดเตือนใกล้หมดอายุทันที โดยไม่ต้องรอ
                    token ใกล้หมดอายุจริง (~55 นาทีหลัง login) — เขียนลง
                    localStorage ควบคู่ด้วยเพื่อให้ค่าคงอยู่ข้าม refresh
                    เหมือนกับที่ setCalendarAccessToken ทำกับ token เอง
                    ไม่ได้เรียก setCalendarAccessToken ตรงนี้ เพราะต้องคง
                    calendarAccessToken เดิมไว้ (การ์ดนี้ต้องมี token อยู่
                    จริงถึงจะขึ้น — ดูเงื่อนไข render ด้านล่าง) ถ้าลบ token
                    ไปด้วยจะไปโดนการ์ด "หมดอายุแล้ว" แทน ไม่ใช่การ์ดนี้ */}
                {import.meta.env.DEV && (
                  <button
                    type="button"
                    className="btn-icon dev-test-btn"
                    onClick={() => {
                      const fakeExpiresAt = Date.now() + 4 * 60 * 1000;
                      setCalendarTokenExpiresAtState(fakeExpiresAt);
                      try {
                        window.localStorage.setItem(
                          calendarTokenExpiresAtStorageKey,
                          String(fakeExpiresAt)
                        );
                      } catch {
                        // localStorage ไม่พร้อมใช้งาน — การ์ดยังขึ้นได้ปกติ
                        // จาก state ในตอนนี้ แค่ไม่รอดข้าม refresh เท่านั้น
                      }
                    }}
                    disabled={!calendarAccessToken}
                    aria-label="[ทดสอบ] จำลอง token ใกล้หมดอายุ"
                    title="[DEV] จำลอง token ใกล้หมดอายุ (เหลือ 4 นาที) — ปุ่มนี้แสดงเฉพาะ dev build เท่านั้น"
                  >
                    ⏰
                  </button>
                )}
                {import.meta.env.DEV && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) && (
                  <button
                    type="button"
                    className={`btn-icon dev-test-btn${firestoreQuotaTestActive ? " is-active" : ""}`}
                    onClick={onTestFirestoreQuota}
                    aria-pressed={firestoreQuotaTestActive}
                    aria-label="[ทดสอบ] สลับตัวอย่างแจ้งเตือนโควต้า Firestore"
                    title="[LOCAL DEV] เปิด/ปิดตัวอย่างแจ้งเตือนโควต้า Firestore"
                  >
                    🗄️
                  </button>
                )}
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
        </header>
      )}
    </>
  );
}
