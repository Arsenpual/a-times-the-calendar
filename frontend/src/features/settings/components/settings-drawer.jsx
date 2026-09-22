import React, { useEffect, useState } from "react";
import { useLanguage, SUPPORTED_LANGUAGES } from "../../../shared/i18n/i18n.jsx";
import { ASSISTANT_PREFERENCE_FIELDS } from "../../activity/assistant/hooks/use-assistant-preferences.js";

function AssistantPreferenceRow({ field, item, onSave, onDelete }) {
  const [draft, setDraft] = useState(item?.value ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setDraft(item?.value ?? ""); }, [item?.value]);
  const save = async (enabled = item?.enabled !== false) => {
    if (draft === "") return setError("กรุณาระบุค่า");
    setPending(true); setError("");
    try { await onSave?.(field.key, field.type === "duration" ? Number(draft) : draft, enabled); }
    catch (requestError) { setError(requestError.message || "บันทึกไม่สำเร็จ"); }
    finally { setPending(false); }
  };
  return <div className="settings-assistant-preference">
    <div className="settings-row-label">
      <span className="settings-row-title">{field.label}</span>
      <span className="settings-row-desc">{item ? (item.enabled ? "ใช้งานเป็นค่าเริ่มต้น" : "บันทึกไว้แต่ยังไม่ใช้งาน") : "ยังไม่ได้ตั้งค่า"}</span>
    </div>
    <div className="settings-assistant-preference-controls">
      <input type={field.type === "time" ? "time" : "number"} min={field.type === "duration" ? "15" : undefined} max={field.type === "duration" ? "720" : undefined} step={field.type === "duration" ? "15" : undefined} value={draft} onChange={(event) => setDraft(event.target.value)} aria-label={field.label} />
      {field.type === "duration" && <span className="settings-assistant-unit">นาที</span>}
      <button type="button" className="settings-assistant-action" disabled={pending} onClick={() => save()}>บันทึก</button>
      {item && <button type="button" className={`settings-toggle${item.enabled ? " is-on" : ""}`} role="switch" aria-checked={item.enabled} disabled={pending} aria-label={`เปิดหรือปิด ${field.label}`} onClick={() => save(!item.enabled)}><span className="settings-toggle-knob" /></button>}
      {item && <button type="button" className="settings-assistant-delete" disabled={pending} onClick={async () => { setPending(true); setError(""); try { await onDelete?.(field.key); } catch (requestError) { setError(requestError.message || "ลบไม่สำเร็จ"); } finally { setPending(false); } }}>ลบ</button>}
    </div>
    {error && <p className="settings-assistant-error" role="alert">{error}</p>}
  </div>;
}

/**
 * Slide-over settings drawer, opened from the ⚙️ icon in the header — in
 * dashboard mode that's next to the sign-out button; in reminder mode
 * it's the only header-right button, since sign-out/tag-search/add-
 * activity are dashboard-only concepts. Both buttons open this exact same
 * component (rendered once, mode-independent, at the bottom of app.jsx)
 * rather than each mode having its own drawer, so theme/language always
 * stay in sync regardless of which mode was active when they were
 * changed. Modal-style overlay + panel from the right, matching the
 * existing .modal-overlay pattern elsewhere in the app rather than
 * introducing a new routing concept — there's no dedicated "settings
 * page", this is just another overlay on top of whichever mode is active.
 *
 * Holds dark mode and language, structured as a list of labeled sections
 * so more settings can be added later without restructuring — each
 * section is its own block with a heading and one or more controls, not a
 * flat list of unrelated toggles.
 *
 * Reads/writes language via useLanguage() directly (not through props
 * like theme is) since LanguageProvider already owns that state globally
 * — no need for app.jsx to thread language/onLanguageChange down as
 * separate props when this component can just reach the context itself,
 * the same way any other component that needs a translated string does.
 *
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {"light"|"dark"} theme current theme
 * @param {(theme: "light"|"dark") => void} onThemeChange
 * @param {{nowIndicator:string}} reminderTimelineColors
 * @param {(partial: object) => void} onReminderTimelineColorsChange
 */
export default function SettingsDrawer({
  open,
  onClose,
  theme,
  onThemeChange,
  reminderTimelineColors,
  onReminderTimelineColorsChange,
  summaryPanelGlassEnabled = false,
  onSummaryPanelGlassChange,
  assistantPreferences = {},
  assistantPreferenceCandidates = {},
  assistantPreferencesLoading = false,
  onSaveAssistantPreference,
  onDeleteAssistantPreference,
  onDismissAssistantPreferenceCandidate
}) {
  const { language, setLanguage, t } = useLanguage();
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
        aria-label={t("settings.title")}
      >
        <div className="settings-drawer-header">
          <h2 className="settings-drawer-title">{t("settings.title")}</h2>
          <button
            type="button"
            className="settings-drawer-close"
            onClick={onClose}
            aria-label={t("settings.close")}
          >
            ✕
          </button>
        </div>

        <div className="settings-drawer-body">
          <section className="settings-section">
            <h3 className="settings-section-title">{t("settings.display")}</h3>
            <div className="settings-row">
              <div className="settings-row-label">
                <span className="settings-row-title">{t("settings.darkMode")}</span>
                <span className="settings-row-desc">{t("settings.darkModeDesc")}</span>
              </div>
              <button
                type="button"
                className={`settings-toggle${theme === "dark" ? " is-on" : ""}`}
                role="switch"
                aria-checked={theme === "dark"}
                aria-label={t("settings.darkMode")}
                onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>

            <div className="settings-row">
              <div className="settings-row-label">
                <span className="settings-row-title">{t("settings.summaryPanelGlass")}</span>
                <span className="settings-row-desc">{t("settings.summaryPanelGlassDesc")}</span>
              </div>
              <button
                type="button"
                className={`settings-toggle${summaryPanelGlassEnabled ? " is-on" : ""}`}
                role="switch"
                aria-checked={summaryPanelGlassEnabled}
                aria-label={t("settings.summaryPanelGlass")}
                onClick={() => onSummaryPanelGlassChange?.(!summaryPanelGlassEnabled)}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>

            {/* ภาษา: segmented control สองปุ่มแทน toggle เดี่ยวแบบ dark mode
                — เพราะนี่ไม่ใช่ binary on/off แต่เป็นการ "เลือกหนึ่งจาก N
                ตัวเลือก" ซึ่งขยายรองรับภาษาที่ 3 ในอนาคตได้ง่ายกว่าแค่สลับ
                true/false (ดู SUPPORTED_LANGUAGES ใน i18n.jsx) */}
            <div className="settings-row">
              <div className="settings-row-label">
                <span className="settings-row-title">{t("settings.language")}</span>
                <span className="settings-row-desc">{t("settings.languageDesc")}</span>
              </div>
              <div className="settings-lang-switch" role="radiogroup" aria-label={t("settings.language")}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    className={`settings-lang-option${language === lang ? " is-active" : ""}`}
                    role="radio"
                    aria-checked={language === lang}
                    onClick={() => setLanguage(lang)}
                  >
                    {t(lang === "th" ? "settings.languageTh" : "settings.languageEn")}
                  </button>
                ))}
              </div>
            </div>

          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">สี Timeline Reminder</h3>
            <div className="settings-color-list">
              {[["nowIndicator", "เส้นเวลาปัจจุบัน", "เส้น now-indicator และข้อความสถานะกลาง Timeline"]].map(([key, title, description]) => (
                <label className="settings-color-row" key={key}>
                  <span className="settings-row-label">
                    <span className="settings-row-title">{title}</span>
                    <span className="settings-row-desc">{description}</span>
                  </span>
                  <input
                    type="color"
                    className="settings-color-input"
                    value={reminderTimelineColors?.[key]}
                    onChange={(event) => onReminderTimelineColorsChange?.({ [key]: event.target.value })}
                    aria-label={`เลือกสี${title}`}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">ค่าเริ่มต้นของ MR.Zettascale</h3>
            <p className="settings-section-note">ใช้เฉพาะเมื่อคุณไม่ได้ระบุเวลา/ระยะเวลาด้วยตัวเอง แก้ไข ปิดใช้ หรือลบได้ทุกเมื่อ</p>
            {Object.entries(assistantPreferenceCandidates).map(([key, candidate]) => {
              const field = ASSISTANT_PREFERENCE_FIELDS.find((item) => item.key === key);
              if (!field) return null;
              const label = field.type === "duration" ? `${candidate.value} นาที` : candidate.value;
              return <div className="settings-assistant-candidate" key={key}>
                <span>MR.Zettascale สังเกตว่าคุณแก้ “{field.label}” เป็น <strong>{label}</strong> ซ้ำ {candidate.count} ครั้ง</span>
                <div><button type="button" className="settings-assistant-action" onClick={() => onSaveAssistantPreference?.(key, candidate.value, true)}>ใช้เป็นค่าเริ่มต้น</button><button type="button" className="settings-assistant-delete" onClick={() => onDismissAssistantPreferenceCandidate?.(key)}>ไม่ใช้</button></div>
              </div>;
            })}
            {assistantPreferencesLoading ? <p className="settings-section-note">กำลังโหลดค่าเริ่มต้น…</p> : ASSISTANT_PREFERENCE_FIELDS.map((field) => <AssistantPreferenceRow key={field.key} field={field} item={assistantPreferences[field.key]} onSave={onSaveAssistantPreference} onDelete={onDeleteAssistantPreference} />)}
          </section>
        </div>
      </div>
    </div>
  );
}
