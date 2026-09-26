import React from "react";

export default function CalendarConnectionOverlays({
  firebaseUser,
  calendarConnectionState,
  tokenNearingExpiry,
  handleReauthCalendar,
}) {
  return (
    <>
{/* Render อาจต้องตื่นก่อนตอบสถานะ Calendar หลังผู้ใช้หายไปนาน.
          ระหว่าง retry ให้สื่อสารว่าแอปกำลังทำงาน แทนปล่อยให้ดูเหมือน
          ค้างหรือพาไปยืนยัน Google ซ้ำทั้งที่สิทธิ์เดิมอาจยังใช้ได้. */}
      {firebaseUser && calendarConnectionState === "checking" && (
        <div className="token-expiry-backdrop calendar-connection-backdrop">
          <div className="token-expiry-banner" role="status" aria-live="polite">
            <span>กำลังเชื่อมต่อและโหลดข้อมูลจาก Google Calendar…</span>
          </div>
        </div>
      )}

      {/* Blocking heads-up for the Google Calendar token — covers two
          situations with the same visual treatment (dimmed backdrop +
          small banner, top-left corner), just different wording:
            1. Nearing expiry (tokenNearingExpiry): token still works for
               now, this is a proactive nudge (~5 min warning window).
            2. Already expired (!calendarAccessToken): token is dead,
               nothing works until renewed — same urgency, same banner.
          Blocks all other interaction until the person renews (no
          click-to-dismiss — renewing is the only way out, there's no
          "cancel" that makes sense here), same idea as .modal-overlay but
          escalated: letting the token die mid-action (e.g. mid-drag in
          Week Spine) risks losing unsaved work, so forcing a decision
          here is safer than leaving it easy to ignore.

          Persists across refresh in the "already expired" case: nothing
          here needs its own persistence, since it's purely derived from
          calendarAccessToken/tokenNearingExpiry, and calendarAccessToken
          itself is already cleared from localStorage the moment it
          expires (see setCalendarAccessToken above) — so !calendarAccessToken
          still evaluates true after a reload, no separate flag needed.

          Deliberately does NOT auto-open the Google popup from a timer —
          browsers block popups that aren't triggered by a direct click, so
          a button the person presses themselves is the only reliable way
          to renew either way. */}
      {firebaseUser && (tokenNearingExpiry || calendarConnectionState === "needs-reauth") && (
        <div className="token-expiry-backdrop">
          <div
            className="token-expiry-banner"
            role="alertdialog"
            aria-label={
              tokenNearingExpiry
                ? "แจ้งเตือนสิทธิ์เข้าถึง Google Calendar ใกล้หมดอายุ"
                : "ต้องยืนยันตัวตนกับ Google Calendar อีกครั้ง"
            }
          >
            <span>
              {tokenNearingExpiry
                ? "สิทธิ์เข้าถึง Google Calendar ใกล้หมดอายุ — ต่ออายุตอนนี้เพื่อไม่ให้การใช้งานสะดุด"
                : "สิทธิ์เข้าถึง Google Calendar หมดอายุแล้ว — ยืนยันตัวตนอีกครั้งเพื่อดึงปฏิทินของคุณกลับมาแสดง"}
            </span>
            <button type="button" className="btn btn-outline token-expiry-renew-btn" onClick={handleReauthCalendar}>
              {tokenNearingExpiry ? "ต่ออายุตอนนี้" : "ยืนยันตัวตน"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
