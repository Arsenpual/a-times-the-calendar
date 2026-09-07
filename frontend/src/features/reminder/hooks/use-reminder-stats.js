import { useEffect, useMemo, useState } from "react";
import {
  appendReminderStat,
  buildReminderStats,
  loadReminderStats,
  saveReminderStats
} from "../lib/reminder-stats.js";

export function useReminderStats({ firebaseUser, reminders }) {
  const [statsEvents, setStatsEvents] = useState(() => loadReminderStats(firebaseUser?.uid));

  const reminderStats = useMemo(
    () => buildReminderStats(reminders, statsEvents),
    [reminders, statsEvents]
  );

  useEffect(() => {
    saveReminderStats(statsEvents, firebaseUser?.uid);
  }, [statsEvents, firebaseUser?.uid]);

  const recordStatsEvent = (type, payload) => {
    setStatsEvents((previous) => appendReminderStat(previous, type, payload));
  };

  return { reminderStats, recordStatsEvent };
}
