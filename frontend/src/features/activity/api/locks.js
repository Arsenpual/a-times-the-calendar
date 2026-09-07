import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/** GET /api/activities/locks — mapping ทั้งหมด { [activityId]: true } ของกิจกรรมที่ถูก lock ไว้ */
export async function fetchLockedActivities() {
  const res = await apiRequest("/api/activities/locks");
  return handleResponse(res, "GET /api/activities/locks");
}

/**
 * PUT /api/activities/:activityId/lock — ตั้ง/ปลด lock ของกิจกรรมหนึ่งอัน
 * กิจกรรมที่ถูก lock จะแก้ไข/ลาก/ลบไม่ได้จนกว่าจะปลดล็อกอีกครั้ง
 */
export async function setActivityLocked(activityId, locked) {
  const res = await apiRequest(`/api/activities/${activityId}/lock`, {
    method: "PUT",
    body: JSON.stringify({ locked })
  });
  return handleResponse(res, "PUT /api/activities/:id/lock");
}
