import { apiRequest, handleResponse } from "../../../shared/api/client.js";

/**
 * FCM device tokens (migration plan v2 เฟส 5) — ลงทะเบียน/เลิกลงทะเบียน
 * token ของอุปกรณ์นี้กับ backend เพื่อให้ Cloud Function (ยัง scaffold
 * อยู่ ดู /functions) รู้ว่าจะส่ง push แจ้งเตือนไปที่ไหนบ้าง
 */

/**
 * POST /api/fcm-tokens — ลงทะเบียน token ของอุปกรณ์นี้ (upsert — เรียกซ้ำ
 * ด้วย token เดิมได้ปลอดภัย ไม่สร้างซ้ำ ดู backend/routes/fcm-tokens.js)
 * @param {string} token จาก Firebase Messaging SDK's getToken()
 */
export async function registerFcmToken(token) {
  const res = await apiRequest("/api/fcm-tokens", {
    method: "POST",
    body: JSON.stringify({ token, userAgent: navigator.userAgent })
  });
  return handleResponse(res, "POST /api/fcm-tokens");
}

/** DELETE /api/fcm-tokens/:token — เลิกลงทะเบียน token นี้ (ตอนผู้ใช้ปิดการแจ้งเตือนเอง) */
export async function unregisterFcmToken(token) {
  const res = await apiRequest(`/api/fcm-tokens/${encodeURIComponent(token)}`, { method: "DELETE" });
  if (res.status === 204) {
    if (!res.ok) {
      throw new Error(`[DELETE /api/fcm-tokens/:token] backend ตอบ error (${res.status})`);
    }
    return null;
  }
  return handleResponse(res, "DELETE /api/fcm-tokens/:token");
}
