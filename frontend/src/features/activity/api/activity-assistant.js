import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/** A single planning turn. It can only propose a draft; it never saves Calendar data. */
export async function continueActivityAssistant(input) {
  return handleResponse(
    await apiRequest("/api/ai/activity-conversation", { method: "POST", body: JSON.stringify(input) }),
    "POST /api/ai/activity-conversation"
  );
}

export async function getActivityAssistantStatus() {
  return handleResponse(await apiRequest("/api/ai/activity-assistant-status", { cache: "no-store" }), "GET /api/ai/activity-assistant-status");
}

export async function validateActivityAssistantDraft(draft, categories) {
  return handleResponse(await apiRequest("/api/ai/activity-validate", { method: "POST", body: JSON.stringify({ draft, categories }) }), "POST /api/ai/activity-validate");
}
