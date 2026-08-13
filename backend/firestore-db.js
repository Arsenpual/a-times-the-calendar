const { initializeApp, getApps, applicationDefault, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

/**
 * Init Firebase Admin SDK ครั้งเดียวตอน backend เริ่มทำงาน (module นี้ถูก
 * require ครั้งแรกจากที่ไหนก็ได้ แต่ initializeApp() ต้องเรียกแค่ครั้งเดียว
 * ตลอดอายุ process — เช็ค getApps().length กันเรียกซ้ำเวลา require หลายจุด)
 *
 * ใช้ GOOGLE_APPLICATION_CREDENTIALS (env var มาตรฐานของ Google Cloud client
 * libraries ทุกตัว ไม่ใช่แค่ Firebase) ชี้ไปยังไฟล์ service account JSON —
 * applicationDefault() จะไปหาไฟล์จาก env var ตัวนี้ให้เอง โดยไม่ต้อง
 * require(...) ไฟล์ JSON ตรงๆ ในโค้ด (ปลอดภัยกว่า เพราะไม่มี path ไฟล์
 * secret ฝังอยู่ใน source code)
 *
 * หมายเหตุเวอร์ชัน: firebase-admin v12+ เปลี่ยนจาก monolithic `admin`
 * namespace (require("firebase-admin") แล้วเรียก admin.initializeApp(),
 * admin.firestore() ตรงๆ) เป็น "modular API" แบบเดียวกับ client SDK v9+ —
 * ต้อง import ฟังก์ชันแยกจาก submodule ("firebase-admin/app",
 * "firebase-admin/firestore", "firebase-admin/auth") แทน ไม่มี admin.apps /
 * admin.firestore / admin.auth / admin.credential ให้เรียกจาก object เดียว
 * อีกต่อไป — เพิ่ม "firebase-admin/auth" เข้ามาใน Phase 2 (Firebase
 * Authentication) สำหรับ verifyIdToken() ในทุก route ที่ต้องการ userId
 */
let app;
if (getApps().length === 0) {
  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error("ไม่พบ FIREBASE_PROJECT_ID ใน .env");
  }

  // สอง credential source รองรับ 2 สภาพแวดล้อมที่ต่างกัน:
  //
  //   1. Local dev: GOOGLE_APPLICATION_CREDENTIALS ชี้เป็น "path" ไปยัง
  //      ไฟล์ service account JSON บนดิสก์ (เดิมที่ใช้อยู่แล้ว) —
  //      applicationDefault() อ่านจาก path นี้ให้เอง
  //
  //   2. Deploy จริง (เช่น Render.com): ไม่มี persistent disk ให้เก็บไฟล์
  //      secret แบบปลอดภัย (filesystem เป็น ephemeral รีเซ็ตทุกครั้งที่
  //      redeploy) จึงรับ service account เป็น "เนื้อหา JSON ทั้งก้อน" ผ่าน
  //      env var GOOGLE_APPLICATION_CREDENTIALS_JSON แทน (วาง JSON ทั้งไฟล์
  //      เป็นค่าเดียวใน environment variable ของ hosting) แล้ว parse +
  //      ส่งให้ cert() ตรงๆ ไม่ต้องเขียนลงดิสก์เลย
  //
  // เช็ค _JSON ก่อนเสมอ เพราะเป็น production path ที่ตั้งใจให้ priority สูงกว่า
  // — ถ้ามีทั้งคู่ (ไม่ควรเกิด แต่เผื่อไว้) ใช้ตัวที่ปลอดภัยกว่าสำหรับ deploy
  let credential;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    let parsed;
    try {
      parsed = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    } catch (err) {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS_JSON ไม่ใช่ JSON ที่ถูกต้อง — ตรวจสอบว่าคัดลอกเนื้อหาไฟล์ " +
          "service account ทั้งก้อนมาวางแบบไม่มีการตัด/ครอบ quote ผิดพลาด"
      );
    }
    credential = cert(parsed);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = applicationDefault();
  } else {
    throw new Error(
      "ไม่พบทั้ง GOOGLE_APPLICATION_CREDENTIALS (path ไฟล์ — ใช้ตอน dev ในเครื่อง) และ " +
        "GOOGLE_APPLICATION_CREDENTIALS_JSON (เนื้อหา JSON ทั้งก้อน — ใช้ตอน deploy จริงบน " +
        "hosting ที่ไม่มี persistent disk เช่น Render.com) ต้องตั้งค่าตัวใดตัวหนึ่ง"
    );
  }

  app = initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID
  });
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);

// ---- Collection references (Phase 2: per-user, nested under users/{userId}) ----
// เดิม (Phase 0-1) เป็น collection กลางระดับ root: categories/{categoryId},
// activityCategories/{activityId}, lockedActivities/{activityId} — ทุกคนที่
// เรียก backend เห็นข้อมูลชุดเดียวกันหมด (ใช้ได้แค่ single-user)
//
// Phase 2 (Firebase Auth) ย้ายมาเป็น subcollection ใต้ users/{userId} แทน —
// เลือก nested path นี้แทนการเก็บ userId เป็น field ในเอกสารเดิม เพราะ:
//   1. Security Rules (ระยะ 3 ในแผน) เขียนกฎเดียวครอบคลุมทั้ง subtree ได้
//      (match /users/{userId}/{document=**}) แทนที่จะต้องเช็ค field ใน
//      ทุก collection แยกกัน — ปลอดภัยกว่าและพลาดยากกว่า
//   2. ไม่มีทางลืม filter query แล้วข้อมูล user อื่นรั่ว เพราะ path เองก็
//      บังคับ scope อยู่แล้ว ไม่ต้องพึ่ง .where("userId", "==", uid) ทุกจุด
//
// ทุกฟังก์ชันด้านล่างรับ userId แล้ว return collection ref ใต้ user นั้น —
// เรียกใหม่ทุกครั้งที่ต้องใช้ (ไม่ cache เป็น const เหมือนเดิม) เพราะตอนนี้
// ไม่มี "collection เดียว" ให้ผูกไว้ล่วงหน้าอีกต่อไป
function userDoc(userId) {
  return db.collection("users").doc(userId);
}

function categoriesCol(userId) {
  return userDoc(userId).collection("categories");
}

function activityCategoriesCol(userId) {
  return userDoc(userId).collection("activityCategories");
}

// Tags แบบ free-text ต่อกิจกรรม — เก็บ { tags: string[] } ต่อ document เดียวกับ
// รูปแบบ activityCategoriesCol (key = normalized activity id) แต่ค่าเป็น
// array แทนค่าเดียว เพราะกิจกรรมหนึ่งติดได้หลาย tag พร้อมกัน (many-to-many)
// ต่างจาก category ที่ผูกได้ทีละหมวดหมู่เท่านั้น (one-to-one)
function activityTagsCol(userId) {
  return userDoc(userId).collection("activityTags");
}

function lockedActivitiesCol(userId) {
  return userDoc(userId).collection("lockedActivities");
}

// Reminder mode (Phase: initial Firebase sync — day/time/title fields
// only, see routes/reminders.js's module comment for exactly which fields
// this covers). Collection name is "reminder-mode" per request (not
// "reminders") — still nested under users/{userId}/ like every other
// collection here, NOT a top-level collection, so it stays covered by the
// same users/{userId}/{document=**} Security Rules match and the same
// data-isolation guarantee described in this file's module comment above.
// A genuinely top-level reminder-mode collection would need its own
// separate security rule (matching on a userId field inside each
// document instead of the path itself), which reopens exactly the
// "easy to forget a .where(userId==) filter" risk this file's nested
// structure was chosen specifically to avoid.
//
// Document id = the reminder's own client-generated id (same pattern as
// activityCategoriesCol/lockedActivitiesCol using the activity's own id
// as the doc key — no separate id generation needed on the backend).
function remindersCol(userId) {
  return userDoc(userId).collection("reminder-mode");
}

// 4 หมวดเริ่มต้น — เหมือนเดิมทุกประการจาก Phase 0-1 (DEFAULT_DATA เดิมใน
// db.js) แค่ตอนนี้ seed ให้ "ต่อ user" แทนที่จะ seed ครั้งเดียวตอน server
// start (ดู ensureDefaultCategoriesForUser ด้านล่าง)
const DEFAULT_CATEGORIES = [
  { id: "work", name: "งาน", color: "#1557B0" },
  { id: "personal", name: "ส่วนตัว", color: "#B71C1C" },
  { id: "health", name: "สุขภาพ", color: "#F29900" },
  { id: "family", name: "ครอบครัว", color: "#0B6B33" }
];

/**
 * เรียกจาก requireAuth middleware (ดู middleware/require-auth.js) ทุกครั้งที่
 * มี request เข้ามาจาก userId ที่ยังไม่เคยเห็นมาก่อน (เช็คว่า categories
 * subcollection ของ user นั้นว่างเปล่าหรือไม่) — ถ้าว่าง แปลว่าเป็น user
 * ใหม่ที่เพิ่ง login ครั้งแรก ใส่ 4 หมวดเริ่มต้นให้อัตโนมัติ เหมือน
 * พฤติกรรมเดิมของ ensureDefaultCategories() ใน Phase 0-1 (ตอนนั้น seed
 * ระดับ collection กลางครั้งเดียวตอน server start) แต่ตอนนี้ต้อง seed
 * "ต่อ user" แทน เพราะแต่ละ user มี categories subcollection เป็นของตัวเอง
 *
 * ไม่ทำอะไรถ้า user นั้นมีข้อมูลอยู่แล้ว (ไม่ทับของเดิม) — ปลอดภัยเรียกซ้ำได้
 * ทุก request โดยไม่มีผลข้างเคียงถ้า user เคยถูก seed ไปแล้ว
 *
 * *** แก้ไข (race condition) ***
 * เดิมใช้ check-then-write ธรรมดา (query .limit(1).get() แล้วค่อยเขียนถ้า
 * ว่าง) — ไม่ atomic เพราะ requireAuth เรียกฟังก์ชันนี้จากทุก request แบบ
 * ขนานกัน (frontend ยิงหลาย request พร้อมกันตอน mount แรกเสมอ เช่น
 * fetchCategories/fetchActivityCategoryMap/fetchLockedActivities/
 * fetchActivityTagMap ใน api.js) ผู้ใช้ใหม่คนเดียวจึงมักโดนหลาย request
 * เข้ามาพร้อมกันตั้งแต่ครั้งแรกที่ login เสมอ ไม่ใช่กรณีขอบ — ทุก request
 * เห็น snapshot ว่างเหมือนกันหมดก่อนตัวไหนจะเขียนเสร็จ ทำให้เขียนซ้ำหลายรอบ
 * (ปลอดภัยจากข้อมูลซ้ำเพราะใช้ id คงที่ + .set() แต่ยังเสีย write quota
 * โดยไม่จำเป็นทุกครั้งที่ user ใหม่ล็อกอิน)
 *
 * ใช้ Firestore transaction คร่อม "marker document" เดี่ยว (users/{userId},
 * field defaultCategoriesSeeded) แทนการเช็คทั้ง subcollection — transaction
 * รับประกันว่าถ้าหลาย request แข่งกันเข้ามา จะมีแค่ตัวเดียวที่ read เห็น
 * marker เป็น false/ไม่มี แล้วชนะเขียนได้ ตัวที่เหลือ Firestore จะ auto-retry
 * ให้เอง ตัว retry จะเห็น marker เป็น true แล้วออกจาก transaction โดยไม่
 * เขียนซ้ำ — marker เป็น field เดี่ยวบน parent doc (ไม่ใช่ query กับทั้ง
 * subcollection แบบเดิม) เพราะ transaction ของ Firestore อ่าน "document" ได้
 * เท่านั้น ไม่รองรับ query ภายใน transaction
 *
 * *** เพิ่มเติม (ลดภาษี read ต่อ request) ***
 * เดิม requireAuth เรียกฟังก์ชันนี้ (และรัน transaction ข้างต้นเต็มรูปแบบ)
 * ทุกครั้งที่ token ผ่าน ไม่ใช่แค่ตอน user ใหม่ — กลายเป็นภาษี Firestore
 * read ถาวรที่ขยายตาม traffic ทั้งที่ marker เป็น true มานานแล้วก็ตาม ตอนนี้
 * เพิ่ม in-memory cache ระดับ process (seededUserIds) คร่อมไว้อีกชั้น:
 * userId ที่เคยผ่าน transaction แล้วในอายุของ process นี้จะ short-circuit
 * กลับทันทีโดยไม่แตะ Firestore เลย — cache ไม่ persist ข้าม
 * restart/redeploy แต่นั่นแค่เท่ากับพฤติกรรมเดิมของทุก request (ไม่ได้แย่
 * ลงกว่าเดิม) ในขณะที่ตัด read ที่ไม่จำเป็นออกไปเกือบทั้งหมดในสภาพ
 * การใช้งานจริงที่ process มีอายุยาวกว่าหนึ่ง request
 */
/**
 * In-memory cache (per Node process) ของ userId ที่รู้แล้วว่า seed เสร็จ
 * แล้ว — ก่อนหน้านี้ ensureDefaultCategoriesForUser() รัน Firestore
 * transaction (read+write บน marker document) ทุกครั้งที่ requireAuth
 * เรียก ซึ่งคือ "ทุก request ที่ token ผ่าน" ตลอดไป ไม่ใช่แค่ตอน user ใหม่
 * — เป็นภาษี read เปล่าๆ ที่ขยายตามปริมาณ traffic แม้ว่า marker จะ true
 * มาตั้งนานแล้วก็ตาม
 *
 * Set นี้ทำให้ transaction รันแค่ครั้งแรกที่ userId นั้น "ถูกเห็น" ในอายุ
 * ของ process ปัจจุบัน (ไม่ persist ข้าม redeploy/restart — แต่นั่นก็แค่
 * เท่ากับพฤติกรรมเดิมของทุก request ตอนนี้อยู่แล้ว ไม่ได้แย่ลง) ปลอดภัย
 * เพราะกรณีเดียวที่ cache "ผิด" (คิดว่ายังไม่ seed ทั้งที่จริง seed แล้ว
 * จาก process อื่น/ก่อน restart) ก็แค่ไปเรียก transaction ซ้ำ ซึ่ง
 * transaction เองก็ idempotent อยู่แล้ว (เช็ค marker ก่อนเขียนเสมอ) —
 * ไม่มีทาง "ผิด" ในทิศทางตรงข้าม (คิดว่า seed แล้วทั้งที่ยังไม่ได้ seed)
 * เพราะ set เข้าคีย์นี้เฉพาะหลัง transaction สำเร็จเท่านั้น
 */
const seededUserIds = new Set();

async function ensureDefaultCategoriesForUser(userId) {
  if (seededUserIds.has(userId)) return;

  const userRef = userDoc(userId);
  const col = categoriesCol(userId);

  const seeded = await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (userSnap.exists && userSnap.data().defaultCategoriesSeeded) {
      return false; // เคย seed แล้ว (หรือกำลังถูก request อื่นชนะไปก่อน) — ไม่ต้องทำอะไร
    }
    tx.set(userRef, { defaultCategoriesSeeded: true }, { merge: true });
    for (const cat of DEFAULT_CATEGORIES) {
      const { id, ...rest } = cat;
      tx.set(col.doc(id), rest);
    }
    return true;
  });

  seededUserIds.add(userId);

  if (seeded) {
    console.log(`[firestore-db] user ${userId}: categories ว่างเปล่า — ใส่ 4 หมวดเริ่มต้นให้แล้ว`);
  }
}

module.exports = {
  db,
  auth,
  categoriesCol,
  activityCategoriesCol,
  activityTagsCol,
  lockedActivitiesCol,
  remindersCol,
  ensureDefaultCategoriesForUser
};
