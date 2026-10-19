import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import AppHeader from "../../src/app/components/app-header.jsx";
import ReminderTopbar from "../../src/features/reminder/components/reminder-topbar.jsx";
import { LanguageProvider, useLanguage } from "../../src/shared/i18n/i18n.jsx";
import "../../src/features/reminder/styles/reminder-material.css";
import "../../src/features/reminder/styles/reminder-mode.css";
import "../../src/index.css";

window.headerFixture = { submits: [], alerts: 0, chats: 0, stats: 0, settings: 0, mounts: 0, ticks: 0 };
const noop = () => {};

function ReminderRuntime({ target, mode }) {
  const { t } = useLanguage();
  const [input, setInput] = useState("");
  const [alerts, setAlerts] = useState(true);
  useEffect(() => {
    window.headerFixture.mounts += 1;
    const timer = setInterval(() => { window.headerFixture.ticks += 1; }, 50);
    return () => clearInterval(timer);
  }, []);
  return <div className="reminder-mode-runtime" hidden={mode !== "reminder"}>
    <ReminderTopbar headerTarget={target} isVisible={mode === "reminder"}
      t={t} omnibarInput={input} setOmnibarInput={setInput} omnibarEnabled
      omnibarPreview={{ matched: true, description: "ตัวอย่าง Reminder" }}
      submitOmnibar={() => window.headerFixture.submits.push(input)}
      telegramConnection={{ isConnected: true, isLoading: false }}
      areTelegramAlertsEnabled={alerts}
      handleTelegramAlertToggle={() => { setAlerts(value => !value); window.headerFixture.alerts += 1; }}
      unreadTelegramMessages={3} openTelegramChat={() => { window.headerFixture.chats += 1; }}
      isPushEnabled={false} openStats={() => { window.headerFixture.stats += 1; }} />
  </div>;
}

function Fixture() {
  const [mode, setMode] = useState("reminder");
  const [target, setTarget] = useState(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  return <div className={`app app--${mode}`}>
    <AppHeader firebaseUser={{ displayName: "Header preview" }} mode={mode} setMode={setMode}
      reminderHeaderRef={setTarget} accountMenuRef={menuRef} accountMenuOpen={menu} setAccountMenuOpen={setMenu}
      setSettingsOpen={() => { window.headerFixture.settings += 1; }} handleLogout={noop}
      goToday={noop} navigateDay={noop} navigateWeek={noop} weekSpineViewMode="week" setWeekSpineView={noop}
      activityHeaderTitle="Activity" tagSearchTerms={[]} tagSearchDraft="" setTagSearchTerms={noop} setTagSearchDraft={noop} />
    <main className="app-main"><ReminderRuntime target={target} mode={mode} /></main>
  </div>;
}
createRoot(document.getElementById("root")).render(<LanguageProvider><Fixture /></LanguageProvider>);
