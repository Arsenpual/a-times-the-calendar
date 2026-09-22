import { apiRequest, handleResponse } from "../../../../shared/api/client.js";

export function getAssistantPreferences() {
  return handleResponse(apiRequest("/api/assistant-preferences", { cache: "no-store" }), "GET /api/assistant-preferences");
}

export function saveAssistantPreference(key, value, enabled = true) {
  return handleResponse(
    apiRequest(`/api/assistant-preferences/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ value, enabled }) }),
    "PUT /api/assistant-preferences/:key"
  );
}

export function deleteAssistantPreference(key) {
  return handleResponse(
    apiRequest(`/api/assistant-preferences/${encodeURIComponent(key)}`, { method: "DELETE" }),
    "DELETE /api/assistant-preferences/:key"
  );
}
