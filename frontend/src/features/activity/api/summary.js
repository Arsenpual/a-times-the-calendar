import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/**
 * POST /api/summary/week — คำนวณสรุปสัปดาห์จากกิจกรรมที่ frontend ดึงมาจาก
 * Google Calendar อยู่แล้ว
 * @param {Array} activities รายการกิจกรรมแบบ { id, summary, start, end } (ISO strings)
 */
export async function fetchWeeklySummary(activities) {
  const res = await apiRequest("/api/summary/week", {
    method: "POST",
    body: JSON.stringify({ activities })
  });
  return handleResponse(res, "POST /api/summary/week");
}

export async function fetchDailySummary(date, activities) {
  const res = await apiRequest("/api/summary/day", {
    method: "POST",
    body: JSON.stringify({ date, activities })
  });
  return handleResponse(res, "POST /api/summary/day");
}
