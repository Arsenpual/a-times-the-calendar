import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/** Firestore-backed activity archive — separate from Google Calendar events. */
export async function fetchActivityArchive() {
  const res = await apiRequest("/api/activity-archive");
  return handleResponse(res, "GET /api/activity-archive");
}

export async function saveActivityArchiveItem(item) {
  const res = await apiRequest(`/api/activity-archive/${encodeURIComponent(item.archiveId)}`, {
    method: "PUT",
    body: JSON.stringify(item)
  });
  return handleResponse(res, "PUT /api/activity-archive/:id");
}

export async function deleteActivityArchiveItem(archiveId) {
  const res = await apiRequest(`/api/activity-archive/${encodeURIComponent(archiveId)}`, { method: "DELETE" });
  if (res.status === 204) return null;
  return handleResponse(res, "DELETE /api/activity-archive/:id");
}
