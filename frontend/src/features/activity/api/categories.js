import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/** GET /api/categories — รายการหมวดหมู่ชีวิตทั้งหมด */
export async function fetchCategories() {
  const res = await apiRequest("/api/categories");
  return handleResponse(res, "GET /api/categories");
}

/**
 * POST /api/categories — สร้างหมวดหมู่ชีวิตใหม่ { name, color }
 * @param {string} name
 * @param {string} color hex สี 6 หลัก เช่น "#1557B0"
 */
export async function createCategory(name, color) {
  const res = await apiRequest("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name, color })
  });
  return handleResponse(res, "POST /api/categories");
}

/**
 * DELETE /api/categories/:id — ลบหมวดหมู่ชีวิต
 * mapping ของกิจกรรมที่เคยผูกกับหมวดหมู่นี้จะถูกลบตามไปด้วยฝั่ง backend
 * (ดู routes/categories.js) — กิจกรรมเหล่านั้นจะกลายเป็น "ไม่ระบุหมวดหมู่"
 */
export async function deleteCategory(id) {
  const res = await apiRequest(`/api/categories/${id}`, { method: "DELETE" });
  // 204 No Content — ไม่มี body ให้ parse เป็น JSON, handleResponse เดิม
  // คาดหวัง response ว่างแล้ว throw เพราะ !text ดังนั้นจัดการ 204 แยกตรงนี้
  if (res.status === 204) {
    if (!res.ok) {
      throw new Error(`[DELETE /api/categories/:id] backend ตอบ error (${res.status})`);
    }
    return null;
  }
  return handleResponse(res, "DELETE /api/categories/:id");
}

/** GET /api/activities/categories — mapping ทั้งหมด { [activityId]: categoryId } */
export async function fetchActivityCategoryMap() {
  const res = await apiRequest("/api/activities/categories");
  return handleResponse(res, "GET /api/activities/categories");
}

/** PUT /api/activities/:activityId/category — ผูก/เปลี่ยนหมวดหมู่ของกิจกรรม */
export async function assignActivityCategory(activityId, categoryId) {
  const res = await apiRequest(`/api/activities/${activityId}/category`, {
    method: "PUT",
    body: JSON.stringify({ categoryId })
  });
  return handleResponse(res, "PUT /api/activities/:id/category");
}
