const { auth } = require("../firestore-db.js");

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
 * Middleware นี้ทำหน้าที่ตรวจตัวตนเท่านั้น ไม่ทำ Firestore migration/seed
 * แอบแฝง เพราะ frontend ยิงหลาย endpoint พร้อมกันตอนเปิดแอป งาน initialize
 * ที่นี่จึงเคยเพิ่ม read/write quota ให้ทุก route โดยไม่เกี่ยวกับข้อมูลที่
 * route นั้นต้องใช้ งาน seed หมวดหมู่ถูกย้ายไป GET /api/categories แล้ว
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

  next();
}

module.exports = { requireAuth };
