import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/** Gets the optional announcement set by the authorised Telegram command. */
export async function getAnnouncement() {
  return handleResponse(await apiRequest("/api/announcement"), "GET /api/announcement");
}
