import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { LanguageProvider } from "../../src/shared/i18n/i18n.jsx";
import ReminderComposer from "../../src/features/reminder/components/reminder-composer.jsx";
import { REMINDER_TYPE } from "../../src/features/reminder/lib/reminder-due-logic.js";
import "../../src/features/reminder/styles/reminder-mode.css";

const types = [
  ["interval", "reminder.type.interval"], ["weekly", "reminder.type.weekly"], ["event-anchored", "reminder.type.event-anchored"],
  ["routine", "reminder.type.routine"], ["once-at", "reminder.type.once-at"], ["countdown", "reminder.type.countdown"], ["stopwatch", "reminder.type.stopwatch"]
].map(([type, labelKey]) => ({ type, labelKey }));
const days = [["reminder.day.sun", 0], ["reminder.day.mon", 1], ["reminder.day.tue", 2], ["reminder.day.wed", 3], ["reminder.day.thu", 4], ["reminder.day.fri", 5], ["reminder.day.sat", 6]].map(([labelKey, value]) => ({ labelKey, value }));
const colors = [{ label: "แดง", value: "#ea4335" }, { label: "น้ำเงิน", value: "#4285f4" }];
const blank = () => ({ title: "", type: REMINDER_TYPE.INTERVAL, amount: "30", unit: "minutes", runAllDay: true, windowStart: "", windowEnd: "", atDate: "2026-09-12", atTime: "10:00", days: [1, 3], time: "08:00", times: ["08:00"], eventName: "", afterAmount: "2", afterUnit: "hours", routineSteps: "one, two", countdownMinutes: "20", lineColor: "#ea4335", groupId: null });
function Fixture() {
  const [draft, setDraft] = useState(blank);
  const [open, setOpen] = useState(true);
  const [submitCount, setSubmitCount] = useState(0);
  const cardRef = useRef(null);
  const preview = useMemo(() => ({ title: draft.title || "Reminder ใหม่", typeLabel: draft.type, fields: [{ label: "ทดสอบ", value: "พร้อม" }], notificationQuota: { limit: 720, existingReminderCount: 1, activityNotificationCount: 2, draftNotificationCount: 3, projectedNotificationCount: 6, isAtLimit: false } }), [draft]);
  window.composerFixture = { draft, open, submitCount, reopen: () => setOpen(true) };
  return <LanguageProvider><ReminderComposer open={open} draft={draft} setDraft={setDraft} editingId={null} groups={[{ id: "work", name: "งาน" }]} typeOptions={types} daysOfWeek={days} lineColorOptions={colors} preview={preview} cardRef={cardRef} onSubmit={(event) => { event.preventDefault(); setSubmitCount(value => value + 1); }} onCancel={() => setOpen(false)} onDelete={() => {}} onToggleDay={(day) => setDraft(current => ({ ...current, days: current.days.includes(day) ? current.days.filter(value => value !== day) : [...current.days, day] }))} /></LanguageProvider>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
