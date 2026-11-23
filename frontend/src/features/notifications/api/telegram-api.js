import { apiRequest, handleResponse } from "../../../shared/api/client.js";

export async function getTelegramStatus() {
  return handleResponse(await apiRequest("/api/telegram/status"), "GET /api/telegram/status");
}

export async function beginTelegramConnection() {
  return handleResponse(await apiRequest("/api/telegram/connect", { method: "POST" }), "POST /api/telegram/connect");
}

export async function sendTelegramTest() {
  return handleResponse(await apiRequest("/api/telegram/test", { method: "POST" }), "POST /api/telegram/test");
}

export async function sendTelegramReminder(title, notificationKind = "reminder", notificationKey = null) {
  return handleResponse(await apiRequest("/api/telegram/notify", { method: "POST", body: JSON.stringify({ title, notificationKind, notificationKey }) }), "POST /api/telegram/notify");
}

/** Sends an Activity Mode start notification through the connected Telegram bot. */
export async function sendTelegramActivity(title, notificationKey = null) {
  return handleResponse(await apiRequest("/api/telegram/notify", { method: "POST", body: JSON.stringify({ title, notificationKind: "activity", notificationKey }) }), "POST /api/telegram/notify");
}

