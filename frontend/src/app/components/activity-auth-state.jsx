import React from "react";

export default function ActivityAuthState({
  authReady,
  firebaseUser,
  brandWordmarkSrc,
  privacyPolicyUrl,
  handleLogin,
}) {
  return (
    <>
{!authReady && (
              <div className="empty-state">
                <p>กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</p>
              </div>
            )}

            {authReady && !firebaseUser && (
              <div className="login-screen">
                <div className="login-card">
                  <img className="login-logo" src={brandWordmarkSrc} alt="T.i.M.E.S." />
                  <h1 className="login-headline">สรุปชีวิตคุณ ทุกสัปดาห์</h1>
                  <p className="login-subtext">
                    T.i.M.E.S. ช่วยวางแผนกิจกรรม ดูภาพรวมเวลา และจัดการ Reminder ของคุณ โดยเชื่อม Google Calendar เมื่อคุณเลือกเชื่อมต่อ
                  </p>
                  <ul className="login-feature-list">
                    <li>ดู สร้าง แก้ไข และลบกิจกรรมใน Google Calendar</li>
                    <li>สรุปเวลาและหมวดหมู่กิจกรรมรายสัปดาห์</li>
                    <li>ตั้ง Reminder และการแจ้งเตือนส่วนตัว</li>
                  </ul>
                  <button className="google-signin-btn" onClick={handleLogin}>
                    <svg className="google-signin-icon" viewBox="0 0 18 18" aria-hidden="true">
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                    </svg>
                    เข้าสู่ระบบด้วย Google
                  </button>
                  <p className="login-privacy-note">
                    การเข้าสู่ระบบใช้สำหรับระบุตัวตนเท่านั้น คุณจะเลือกเชื่อม Google Calendar ในขั้นตอนถัดไป
                    <a href={privacyPolicyUrl} target="_blank" rel="noreferrer">อ่านนโยบายความเป็นส่วนตัว</a>
                  </p>
                </div>
              </div>
            )}
    </>
  );
}
