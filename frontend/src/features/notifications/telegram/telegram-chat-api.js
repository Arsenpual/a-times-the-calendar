import { apiRequest, handleResponse } from "../../../shared/api/client.js";

export async function getTelegramChat(limit = 30) {
  return handleResponse(await apiRequest(`/api/telegram/messages?limit=${limit}`, { cache: "no-store" }), "GET /api/telegram/messages");
}

export async function getTelegramChatSummary() {
  return handleResponse(await apiRequest("/api/telegram/messages/summary", { cache: "no-store" }), "GET /api/telegram/messages/summary");
}

export async function markTelegramChatRead() {
  return handleResponse(await apiRequest("/api/telegram/messages/read", { method: "POST" }), "POST /api/telegram/messages/read");
}

export async function sendTelegramChatMessage(text) {
  return handleResponse(await apiRequest("/api/telegram/messages", { method: "POST", body: JSON.stringify({ text }) }), "POST /api/telegram/messages");
}
