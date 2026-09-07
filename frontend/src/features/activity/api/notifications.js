import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/** Mirror เฉพาะเวลาเริ่มกิจกรรมให้ Cloud Run ส่ง push ได้แม้ปิดเว็บอยู่. */
export async function saveActivityNotification(activity) {
  const res = await apiRequest(`/api/activity-notifications/${encodeURIComponent(activity.activityId)}`, {
    method: "PUT",
    body: JSON.stringify(activity)
  });
  return handleResponse(res, "PUT /api/activity-notifications/:id");
}

export async function deleteActivityNotification(activityId) {
  const res = await apiRequest(`/api/activity-notifications/${encodeURIComponent(activityId)}`, { method: "DELETE" });
  if (res.status === 204) return null;
  return handleResponse(res, "DELETE /api/activity-notifications/:id");
}
