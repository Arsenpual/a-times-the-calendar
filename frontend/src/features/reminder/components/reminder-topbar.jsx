import { useState } from "react";

export default function ReminderTopbar({ t, omnibarInput, setOmnibarInput, submitOmnibar, omnibarEnabled, omnibarPreview, telegramConnection, areTelegramAlertsEnabled, handleTelegramAlertToggle, unreadTelegramMessages = 0, openTelegramChat, isPushEnabled, openStats }) {
const [telegramMenuOpen, setTelegramMenuOpen] = useState(false);
return (
<header className="app-topbar">
        <div className="topbar-logo">
          <span className="topbar-logo-icon" aria-hidden="true">⏰</span>
          <span className="topbar-logo-text">ReminderOS</span>
        </div>
        <div className="topbar-omnibar-wrap">
          <input
            type="text"
            className="topbar-omnibar"
            value={omnibarInput}
            onChange={(event) => setOmnibarInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitOmnibar();
              }
            }}
            placeholder={t("reminder.omnibarPlaceholder")}
            disabled={!omnibarEnabled}
            title={omnibarEnabled ? t("reminder.omnibarCreateHint") : t("reminder.omnibarDisabledHint")}
          />
          {omnibarEnabled && omnibarInput.trim() && (
            <div className={`omnibar-preview ${omnibarPreview.matched ? "is-matched" : ""}`}>
              <span>{omnibarPreview.matched ? `→ ${omnibarPreview.description}` : t("reminder.omnibarUnknown")}</span>
              <button type="button" onClick={submitOmnibar}>{omnibarPreview.matched ? t("reminder.create") : t("reminder.openForm")}</button>
            </div>
          )}
        </div>
        <div className="topbar-actions">
          <div className="topbar-telegram-control">
            <button
              type="button"
              className={`topbar-icon-btn topbar-telegram-btn${areTelegramAlertsEnabled ? " is-active" : " is-muted"}`}
              disabled={telegramConnection.isLoading}
              onClick={() => telegramConnection.isConnected ? setTelegramMenuOpen((open) => !open) : handleTelegramAlertToggle()}
              aria-expanded={telegramConnection.isConnected ? telegramMenuOpen : undefined}
              title={telegramConnection.statusMessage || (telegramConnection.isConnected ? "เมนู Telegram" : t("reminder.connectTelegram"))}
              aria-label={telegramConnection.isConnected ? "เมนู Telegram" : t("reminder.connectTelegram")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21.4 3.2 2.9 10.3c-1.26.5-1.25 1.2-.23 1.51l4.75 1.48 1.84 5.64c.22.61.11.85.76.85.5 0 .72-.23 1-.5l2.3-2.24 4.78 3.53c.88.49 1.52.24 1.74-.82l3.15-14.85c.33-1.3-.5-1.89-1.57-1.42ZM8.4 12.8l10.72-6.77c.54-.33 1.03-.15.62.22l-9.19 8.3-.36 3.87-1.79-5.62Z" /></svg>
              {unreadTelegramMessages > 0 && <span className="topbar-telegram-unread">{unreadTelegramMessages > 99 ? "99+" : unreadTelegramMessages}</span>}
            </button>
            {telegramMenuOpen && <div className="topbar-telegram-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setTelegramMenuOpen(false); handleTelegramAlertToggle(); }}>{areTelegramAlertsEnabled ? "ปิดการแจ้งเตือน" : "เปิดการแจ้งเตือน"}</button>
              <button type="button" role="menuitem" onClick={() => { setTelegramMenuOpen(false); openTelegramChat?.(); }}>เปิดแชต</button>
            </div>}
          </div>
          {/* เก็บปุ่ม Push เดิมไว้เพื่อรักษา layout แต่หยุดการทำงานชั่วคราว:
              Telegram เป็นช่องทางแจ้งเตือนหลักในระยะนี้. */}
          <button
            type="button"
            className={`topbar-icon-btn ${isPushEnabled ? "is-active" : ""}`}
            disabled
            title={t("reminder.pushPaused")}
            aria-label={t("reminder.pushPaused")}
          >
            {isPushEnabled ? "🔔" : "🔕"}
          </button>
          <button type="button" className="topbar-icon-btn" onClick={() => openStats()} title={t("reminder.viewStats")}>📊</button>
        </div>
      </header>
);
}
