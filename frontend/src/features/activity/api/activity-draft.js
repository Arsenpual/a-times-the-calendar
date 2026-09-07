import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/** Ask the low-cost Gemini model to propose one activity; it never saves it. */
export async function createAiActivityDraft(input) {
  return handleResponse(
    await apiRequest("/api/ai/activity-draft", { method: "POST", body: JSON.stringify(input) }),
    "POST /api/ai/activity-draft"
  );
}
