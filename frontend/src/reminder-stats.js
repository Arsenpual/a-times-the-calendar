const STORAGE_KEY = "times-reminder-stats-v1";
const MAX_EVENTS = 500;

function storageKey(userId) {
  return `${STORAGE_KEY}:${userId || "guest"}`;
}

export function loadReminderStats(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function saveReminderStats(events, userId) {
  localStorage.setItem(storageKey(userId), JSON.stringify(events.slice(-MAX_EVENTS)));
}

export function appendReminderStat(events, type, payload = {}) {
  return [...events, { type, at: Date.now(), ...payload }].slice(-MAX_EVENTS);
}

export function buildReminderStats(reminders, events) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyEvents = events.filter((event) => event.at >= weekAgo);
  const completions = weeklyEvents.filter((event) => event.type === "completed");
  const snoozes = weeklyEvents.filter((event) => event.type === "snoozed");
  const stopwatchSessions = weeklyEvents.filter((event) => event.type === "stopwatch-session");
  const snoozeCounts = new Map();
  snoozes.forEach((event) => snoozeCounts.set(event.title, (snoozeCounts.get(event.title) || 0) + 1));
  const mostSnoozed = [...snoozeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const averageStopwatchMs = stopwatchSessions.length
    ? stopwatchSessions.reduce((sum, event) => sum + event.durationMs, 0) / stopwatchSessions.length
    : 0;
  const routineTotal = reminders.filter((reminder) => reminder.type === "routine").length;
  const routineCompleted = completions.filter((event) => event.reminderType === "routine").length;

  return {
    active: reminders.filter((reminder) => reminder.enabled && !reminder.completedAt).length,
    paused: reminders.filter((reminder) => !reminder.enabled && !reminder.completedAt).length,
    completed: reminders.filter((reminder) => !!reminder.completedAt).length,
    weeklyCompletions: completions.length,
    mostSnoozed,
    averageStopwatchMs,
    routineTotal,
    routineCompleted
  };
}

export function formatStatsDuration(milliseconds) {
  const totalMinutes = Math.round(milliseconds / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} นาที`;
  return `${Math.floor(totalMinutes / 60)} ชม. ${totalMinutes % 60} นาที`;
}
