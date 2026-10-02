import { apiRequest, handleResponse } from "../../../../shared/api/client.js";

export async function fetchProductKnowledge(text) {
  return handleResponse(
    await apiRequest("/api/ai/product-knowledge", { method: "POST", body: JSON.stringify({ text }) }),
    "POST /api/ai/product-knowledge"
  );
}

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

export async function createActivityTemplateDraft(input) {
  return handleResponse(
    await apiRequest("/api/ai/activity-template-draft", { method: "POST", body: JSON.stringify(input) }),
    "POST /api/ai/activity-template-draft"
  );
}
