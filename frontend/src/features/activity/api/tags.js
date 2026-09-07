import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/** GET /api/activities/tags — mapping ทั้งหมด { [activityId]: string[] } */
export async function fetchActivityTagMap() {
  const res = await apiRequest("/api/activities/tags");
  return handleResponse(res, "GET /api/activities/tags");
}

/**
 * PUT /api/activities/:activityId/tags — แทนที่ tag ทั้งชุดของกิจกรรมนี้
 * @param {string} activityId
 * @param {string[]} tags ส่ง [] เพื่อล้าง tag ทั้งหมดออก
 */
export async function setActivityTags(activityId, tags) {
  const res = await apiRequest(`/api/activities/${activityId}/tags`, {
    method: "PUT",
    body: JSON.stringify({ tags })
  });
  return handleResponse(res, "PUT /api/activities/:id/tags");
}
