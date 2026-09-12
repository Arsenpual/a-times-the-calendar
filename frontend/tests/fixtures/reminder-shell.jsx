import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ReminderTopbar from "../../src/features/reminder/components/reminder-topbar.jsx";
import TelegramConnectionToast from "../../src/features/reminder/components/telegram-connection-toast.jsx";
import ReminderAlerts from "../../src/features/reminder/components/reminder-alerts.jsx";
import ReminderTimelineRows from "../../src/features/reminder/components/reminder-timeline-rows.jsx";
import { extractScheduleFields } from "../../src/features/reminder/lib/reminder-sync-fields.js";
import { createBlankDraft } from "../../src/features/reminder/lib/reminder-defaults.js";
import { formatDurationClock, describeReminder } from "../../src/features/reminder/lib/reminder-formatters.js";
window.calls = [];
window.helpers = { extractScheduleFields, createBlankDraft, formatDurationClock, describeReminder };
const record = (...args) => window.calls.push(args);
const rows = [{ key: "10", label: "10:00", flags: [{ id: "r", title: "Meeting", type: "weekly", time: "10:00", enabled: true }] }];
function Fixture() {
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("Connected");
  const [snooze, setSnooze] = useState(null);
  const [revision, setRevision] = useState(0);
  const connection = { isConnected: true, statusMessage: message };
  return <>
    <style>{".dropdown-backdrop { position: fixed; right: 0; bottom: 0; width: 40px; height: 40px; }"}</style>
    <ReminderTopbar t={key => key} omnibarInput={input} setOmnibarInput={setInput} submitOmnibar={() => record("submit", input)} omnibarEnabled omnibarPreview={{ matched: true, description: "preview" }} telegramConnection={connection} areTelegramAlertsEnabled handleTelegramAlertToggle={() => record("telegram")} isPushEnabled={false} openStats={() => record("stats")} />
    <TelegramConnectionToast telegramConnection={connection} onClose={() => setMessage("")} />
    <ReminderAlerts t={(key, args) => args?.minutes ? String(args.minutes) : key} cardMenu={null} snoozeMenuForId={snooze} closeAllMenus={() => setSnooze(null)} dueReminders={[{ id: "r", title: "Meeting" }]} toggleSnoozeMenu={setSnooze} scheduleNext={(...args) => record("schedule", ...args)} closeSnoozeMenu={() => setSnooze(null)} markCompleted={id => record("complete", id)} />
    <button onClick={() => setRevision(1)}>Update handler</button>
    <ReminderTimelineRows tapeRows={rows} nowTick={0} onEditReminder={r => record("edit", r.id, revision)} />
  </>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
