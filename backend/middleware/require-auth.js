const { auth, ensureDefaultCategoriesForUser } = require("../firestore-db.js");

/**
 * Middleware บังคับทุก request ต้องแนบ Firebase ID token ถูกต้อง — ตาม
 * firebase-migration-plan.md ระยะ 2 ข้อ 3 ("แก้ backend routes ให้ตรวจ
 * Firebase ID token แล้ว scope ด้วย userId")
 *
 * รูปแบบ header ที่รับ: Authorization: Bearer <idToken>
 * (idToken มาจาก Firebase Auth client SDK ฝั่ง frontend — ไม่ใช่ Google
 * OAuth access token ที่ใช้เรียก Calendar API โดยตรง คนละ token กัน)
 *
 * ถ้า token ไม่มี/ผิด format/verify ไม่ผ่าน/หมดอายุ → ตอบ 401 ทันที ไม่ปล่อย
 * ผ่านไป route handler เลย (ตามที่ตกลงกันไว้ — บังคับทุก endpoint ที่แตะ
 * ข้อมูล user จริง)
 *
 * ถ้าผ่าน: แนบ req.userId (Firebase uid) ให้ route handler ทุกตัวใช้ต่อ
 * เป็น scope สำหรับเลือก subcollection ที่ถูกต้องใต้ users/{userId}/...
 *
 * เรียก ensureDefaultCategoriesForUser() ทุกครั้งที่ token ถูกต้อง (ไม่ใช่
 * แค่ตอน login ครั้งแรก) เพราะ middleware นี้ไม่มีทางรู้ว่าเป็น request
 * แรกของ user คนนั้นหรือเปล่า — ฟังก์ชันนั้นมี in-memory cache ระดับ process
 * ของตัวเองอยู่แล้ว (ดู firestore-db.js) จึงเรียกซ้ำได้ทุก request โดยแทบ
 * ไม่มีต้นทุนเพิ่มหลังครั้งแรกที่ userId นั้นถูกเห็นในอายุของ process นี้
 * (ก่อนหน้านี้ไม่มี cache ชั้นนี้ — ทุก request รัน Firestore transaction
 * เต็มรูปแบบแม้ user จะถูก seed ไปนานแล้วก็ตาม)
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, idToken] = header.split(" ");

  if (scheme !== "Bearer" || !idToken) {
    return res.status(401).json({ error: "ต้องแนบ Firebase ID token ใน header Authorization: Bearer <idToken>" });
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    req.userId = decoded.uid;
  } catch (err) {
    // ครอบคลุมทุกกรณี: token หมดอายุ, ลายเซ็นไม่ถูกต้อง, project id ไม่ตรง,
    // format ผิด ฯลฯ — ไม่แยกแยะเหตุผลให้ client เห็นเพื่อไม่ให้เป็นข้อมูล
    // ช่วย brute-force ฝั่งตรงข้าม แค่ตอบ 401 กลาง ๆ
    return res.status(401).json({ error: "Firebase ID token ไม่ถูกต้องหรือหมดอายุ — กรุณาเข้าสู่ระบบใหม่" });
  }

  try {
    await ensureDefaultCategoriesForUser(req.userId);
  } catch (err) {
    // Seed ล้มเหลว (เช่น Firestore ชั่วคราวมีปัญหา) ไม่ควรบล็อก request
    // ทั้งหมด — ปล่อยผ่านไป route handler ตามปกติ ถ้า collection ยังว่าง
    // จริงๆ endpoint ที่เรียกอยู่ก็แค่เห็นรายการว่างเปล่า ไม่ crash
    console.error(`[requireAuth] seed default categories ล้มเหลวสำหรับ user ${req.userId}:`, err.message);
  }

  next();
}

module.exports = { requireAuth };
