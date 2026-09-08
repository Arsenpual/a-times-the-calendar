import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/**
 * GET /api/reminders — mapping ทั้งหมด { [reminderId]: {...scheduleFields} }
 * เบื้องต้น sync แค่ฟิลด์วัน/เวลาของ reminder (ดู routes/reminders.js
 * ฝั่ง backend สำหรับรายการฟิลด์ทั้งหมด) — ไม่รวม runtime state เช่น
 * startedAt/accumulatedMs ของ countdown/stopwatch ที่กำลังทำงานอยู่
 */
export async function fetchReminders() {
  const res = await apiRequest("/api/reminders", { cache: "no-store" });
  return handleResponse(res, "GET /api/reminders");
}

/**
 * PUT /api/reminders/:reminderId — สร้างหรืออัปเดต schedule fields ของ
 * reminder หนึ่งตัว (upsert เดียว — reminder id เป็น client-generated
 * อยู่แล้วเหมือน activity id ของ Google Calendar)
 * @param {string} reminderId
 * @param {object} fields ฟิลด์วัน/เวลาที่จะบันทึก (type, title, enabled,
 *   amount, unit, windowStart, windowEnd, days, time, atMs, afterAmount,
 *   afterUnit, durationMs, lineColor, eventName, steps) — ฟิลด์ runtime
 *   อื่นที่ไม่อยู่ใน allow-list นี้จะถูกตัดทิ้งฝั่ง backend เงียบๆ ถ้าส่งมา
 */
export async function saveReminder(reminderId, fields) {
  const res = await apiRequest(`/api/reminders/${reminderId}`, {
    method: "PUT",
    body: JSON.stringify(fields)
  });
  return handleResponse(res, "PUT /api/reminders/:id");
}

/** DELETE /api/reminders/:reminderId */
export async function deleteReminderRemote(reminderId) {
  const res = await apiRequest(`/api/reminders/${reminderId}`, { method: "DELETE" });
  if (res.status === 204) {
    if (!res.ok) {
      throw new Error(`[DELETE /api/reminders/:id] backend ตอบ error (${res.status})`);
    }
    return null;
  }
  return handleResponse(res, "DELETE /api/reminders/:id");
}
