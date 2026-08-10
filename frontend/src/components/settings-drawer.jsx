import React, { useEffect } from "react";

/**
 * Slide-over settings drawer, opened from the ⚙️ icon in the header
 * (next to "ออกจากระบบ"). Modal-style overlay + panel from the right,
 * matching the existing .modal-overlay pattern elsewhere in the app
 * rather than introducing a new routing concept — there's no dedicated
 * "settings page", this is just another overlay on top of the dashboard.
 *
 * Currently holds one setting (dark mode) but structured as a list of
 * labeled sections so more settings can be added later without
 * restructuring — each section is its own block with a heading and one
 * or more controls, not a flat list of unrelated toggles.
 *
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {"light"|"dark"} theme current theme
 * @param {(theme: "light"|"dark") => void} onThemeChange
 */
export default function SettingsDrawer({ open, onClose, theme, onThemeChange }) {
  // Escape ปิด drawer ได้ — เหมือน pattern เดียวกับ ActivityModal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="การตั้งค่า"
      >
        <div className="settings-drawer-header">
          <h2 className="settings-drawer-title">การตั้งค่า</h2>
          <button
            type="button"
            className="settings-drawer-close"
            onClick={onClose}
            aria-label="ปิดการตั้งค่า"
          >
            ✕
          </button>
        </div>

        <div className="settings-drawer-body">
          <section className="settings-section">
            <h3 className="settings-section-title">การแสดงผล</h3>
            <div className="settings-row">
              <div className="settings-row-label">
                <span className="settings-row-title">Dark Mode</span>
                <span className="settings-row-desc">เปลี่ยนธีมเป็นโหมดมืด ลดแสงจ้าตอนใช้งานตอนกลางคืน</span>
              </div>
              <button
                type="button"
                className={`settings-toggle${theme === "dark" ? " is-on" : ""}`}
                role="switch"
                aria-checked={theme === "dark"}
                aria-label="สลับ Dark Mode"
                onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
