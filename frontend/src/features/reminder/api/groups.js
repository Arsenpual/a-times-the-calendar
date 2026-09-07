import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/**
 * Groups/Projects ของ reminder mode (migration plan v2 เฟส 3) — CRUD
 * รูปแบบเดียวกับ fetchCategories/createCategory/deleteCategory ทุก
 * ประการ (one-to-one ต่อ reminder ผ่าน groupId field, ดู
 * backend/routes/reminder-groups.js และ firestore-db.js's
 * reminderGroupsCol comment)
 */

/** GET /api/reminder-groups — รายการกลุ่มทั้งหมด */
export async function fetchReminderGroups() {
  const res = await apiRequest("/api/reminder-groups");
  return handleResponse(res, "GET /api/reminder-groups");
}

/**
 * POST /api/reminder-groups — สร้างกลุ่มใหม่ { name, color }
 * @param {string} name
 * @param {string} color hex สี 6 หลัก เช่น "#1557B0"
 */
export async function createReminderGroup(name, color) {
  const res = await apiRequest("/api/reminder-groups", {
    method: "POST",
    body: JSON.stringify({ name, color })
  });
  return handleResponse(res, "POST /api/reminder-groups");
}

/**
 * DELETE /api/reminder-groups/:id — ลบกลุ่ม
 * reminder ที่เคยผูกกับกลุ่มนี้จะถูกเคลียร์ groupId เป็น null ฝั่ง backend
 * (ไม่ใช่ถูกลบทิ้ง — ดู routes/reminder-groups.js's DELETE handler)
 */
export async function deleteReminderGroup(id) {
  const res = await apiRequest(`/api/reminder-groups/${id}`, { method: "DELETE" });
  if (res.status === 204) {
    if (!res.ok) {
      throw new Error(`[DELETE /api/reminder-groups/:id] backend ตอบ error (${res.status})`);
    }
    return null;
  }
  return handleResponse(res, "DELETE /api/reminder-groups/:id");
}
