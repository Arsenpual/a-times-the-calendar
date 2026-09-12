import { useEffect, useMemo, useState } from "react";
import { getReminderFeatureFlags, logReminderEvent } from "../lib/reminder-telemetry.js";
import { parseReminderQuickInput } from "../lib/reminder-quick-parse.js";
import { REMINDER_TYPE, computeNextDueAt } from "../lib/reminder-due-logic.js";

/** Quick-input state, parser preview and submission; persistence stays in the store. */
export function useReminderOmnibar({
  setDraft, setEditingId, setIsComposerOpen, createBlankDraft,
  updateReminders, defaultLineColor
}) {
  const DEFAULT_LINE_COLOR = defaultLineColor;
  const [omnibarEnabled, setOmnibarEnabled] = useState(false);
  const [omnibarInput, setOmnibarInput] = useState("");
  useEffect(() => {
    getReminderFeatureFlags().then(({ omnibarEnabled: enabled }) => setOmnibarEnabled(enabled));
  }, []);

  const omnibarPreview = useMemo(() => parseReminderQuickInput(omnibarInput), [omnibarInput]);

  // Phase 6: คำสั่งที่ parser เข้าใจจะสร้าง reminder ทันที; คำสั่งที่ยังไม่
  // เข้าใจจะไม่เดาเอง แต่เปิด composer พร้อมข้อความเดิมให้ผู้ใช้ตรวจต่อ.
  const submitOmnibar = () => {
    const title = omnibarInput.trim();
    if (!title) return;

    if (!omnibarPreview.matched) {
      setEditingId(null);
      setDraft({ ...createBlankDraft(), title });
      setIsComposerOpen(true);
      return;
    }

    const parsed = omnibarPreview.reminder;
    const now = Date.now();
    const reminder = {
      id: `reminder-${now}`,
      title: parsed.title,
      type: parsed.type,
      enabled: true,
      groupId: null,
      completedAt: null
    };

    if (parsed.type === REMINDER_TYPE.INTERVAL) {
      reminder.amount = parsed.amount;
      reminder.unit = parsed.unit;
    } else if (parsed.type === REMINDER_TYPE.WEEKLY) {
      reminder.days = parsed.days;
      reminder.time = parsed.time;
    } else if (parsed.type === REMINDER_TYPE.COUNTDOWN) {
      reminder.durationMs = parsed.minutes * 60 * 1000;
      reminder.startedAt = now;
      reminder.lineColor = DEFAULT_LINE_COLOR;
    }

    reminder.nextDueAt = reminder.type === REMINDER_TYPE.INTERVAL
      ? null
      : computeNextDueAt(reminder, now);
    updateReminders((prev) => [...prev, reminder]);
    logReminderEvent("reminder_created", { reminder_type: reminder.type, creation_method: "omnibar" });
    setOmnibarInput("");
  };



  return { omnibarEnabled, omnibarInput, setOmnibarInput, omnibarPreview, submitOmnibar };
}
