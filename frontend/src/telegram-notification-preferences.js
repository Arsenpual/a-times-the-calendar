const STORAGE_KEY_PREFIX = "times-the-calendar:telegram-notifications-disabled";

function storageKey(userId) {
  return `${STORAGE_KEY_PREFIX}:${userId || "guest"}`;
}

// This is deliberately device-local. It lets someone keep an always-on device
// notifying while muting another browser without disconnecting the Telegram bot.
export function areTelegramNotificationsEnabled(userId) {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(storageKey(userId)) !== "true";
}

export function setTelegramNotificationsEnabled(userId, enabled) {
  if (typeof window === "undefined") return;
  const key = storageKey(userId);
  if (enabled) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, "true");
}
