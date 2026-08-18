// ⚠️⚠️⚠️ SCAFFOLD — ยังไม่เคย deploy หรือรันผ่าน Firebase Emulator เลย
// สักครั้ง (migration plan v2 เฟส 5) — เขียน logic ไว้ครบตามแผน แต่
// สภาพแวดล้อมที่เขียนโค้ดนี้ไม่มี Firebase CLI/credentials ให้ทดสอบจริง
// ก่อนเอาไปใช้งานจริงต้อง:
//   1. รัน `npm install` ในโฟลเดอร์นี้
//   2. รัน `firebase emulators:start --only functions,firestore` แล้ว
//      ทดสอบด้วยข้อมูลจำลองก่อน (ใส่ reminder ที่ nextDueAt เป็นอดีตลง
//      Firestore emulator ตรงๆ แล้วเรียก checkDueReminders ผ่าน
//      `firebase functions:shell` เพื่อดูว่า query/ส่ง FCM ทำงานถูกต้อง)
//   3. ตรวจสอบว่า Firestore มี composite index ที่ query ด้านล่างต้องการ
//      แล้ว (ดูคอมเมนต์เหนือ query) — ถ้าไม่มี Cloud Function จะ throw
//      error บอก index ที่ขาดพร้อมลิงก์สร้างให้อัตโนมัติ (ปกติของ
//      Firestore) ต้องคลิกลิงก์นั้นสร้าง index ก่อนถึงจะ deploy ใช้งานได้จริง
//   4. เริ่ม deploy จริงด้วย schedule ที่ถี่น้อยกว่านี้ก่อน (เช่นทุก 5 นาที
//      แทน 1 นาที) เพื่อประเมิน cost/invocation count จริงก่อนค่อยลดเวลาลง
//      ตามที่แผนแนะนำไว้ (เฟส 5 risk note: "ควรประเมิน invocation count
//      ต่อเดือนไว้ก่อน")

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { computeNextDueAt, isOneShotType } = require("./reminder-due-logic.js");

admin.initializeApp();
const db = admin.firestore();

// ตั้ง region ให้ตรงกับที่ backend/frontend หลักของโปรเจกต์ deploy อยู่
// (ยังไม่ยืนยันว่า Render.com ฝั่ง backend อยู่ region ไหน — ควรเช็คก่อน
// deploy จริง ไม่จำเป็นต้อง region เดียวกันเป๊ะ แต่ latency ต่ำสุดถ้าใกล้กัน)
setGlobalOptions({ region: "asia-southeast1" });

// ไม่ renotify ซ้ำสำหรับ "รอบเดิม" ของ reminder เดียวกัน — เก็บ lastNotifiedAt
// ไว้เทียบกับ nextDueAt ปัจจุบัน (lastNotifiedAt >= nextDueAt = เคยแจ้งรอบ
// นี้ไปแล้ว ข้าม) เพราะ scheduler รันทุก 1 นาที ถ้าไม่มีเกราะนี้ reminder ที่
// due ค้างอยู่ (ผู้ใช้ยังไม่เปิดแอปมา snooze/complete) จะโดนส่ง push ซ้ำ
// ทุก 1 นาทีไม่จบไม่สิ้น — เป็น "การตัดสินใจเพิ่มเติม" ที่ scaffold นี้ทำ
// เอง เพราะแผนเดิม (migration plan v2 เฟส 5) ไม่ได้ระบุ renotify policy
// ไว้ชัดเจน ควรทบทวนกับทีมอีกครั้งก่อน deploy จริงว่าพฤติกรรมนี้ตรงกับที่
// ต้องการหรือไม่ (ทางเลือกอื่นที่เป็นไปได้: renotify ทุก N นาทีจนกว่าจะ
// ถูก acknowledge, หรือ escalate หลัง renotify ครบ M ครั้ง)
const RENOTIFY_GUARD_FIELD = "lastNotifiedAt";

/**
 * Scheduled function หลัก — รันทุก 1 นาที (ปรับ schedule ได้ที่ onSchedule
 * options ด้านล่าง) เช็ค reminder ทุก user ที่ due แล้วส่ง FCM push
 *
 * Query strategy: ใช้ Firestore Collection Group Query ข้าม user ทุกคน
 * (ต้องเปิด collection group index สำหรับ "reminder-mode" ก่อน — ทำผ่าน
 * Firebase Console > Firestore > Indexes > Collection Group tab หรือ
 * firestore.indexes.json ในโปรเจกต์หลัก) filter แค่ enabled==true ผ่าน
 * query โดยตรง (Firestore query ตรงๆ ได้) ส่วนเงื่อนไขอื่น (completedAt,
 * nextDueAt<=now, ไม่ใช่ routine/stopwatch) filter ต่อใน memory หลัง query
 * กลับมา เพราะ Firestore ไม่รองรับ compound inequality หลายฟิลด์พร้อมกัน
 * ง่ายๆ (nextDueAt<=now ผสมกับเงื่อนไข equality อื่นต้องมี composite index
 * เฉพาะเจาะจง — เริ่มจาก filter ใน memory ก่อนเพื่อความง่าย ค่อยย้ายไป
 * query ฝั่ง Firestore ทั้งหมดทีหลังถ้าจำนวน reminder ทั้งระบบเยอะขึ้นจน
 * filter ใน memory ไม่ไหว)
 */
exports.checkDueReminders = onSchedule("every 1 minutes", async () => {
  const now = Date.now();

  // ใช้ index collection-group (enabled ASC, nextDueAt ASC) ที่ประกาศใน
  // firestore.indexes.json เพื่ออ่านเฉพาะ reminder ที่ถึงเวลาแล้ว แทนการ
  // โหลด reminder enabled ทั้งระบบมา filter ใน memory.
  const snapshot = await db
    .collectionGroup("reminder-mode")
    .where("enabled", "==", true)
    .where("nextDueAt", "<=", now)
    .get();

  console.log(`[checkDueReminders] พบ reminder enabled=true ทั้งหมด ${snapshot.size} รายการ ทุก user รวมกัน`);

  const dueDocsGroupedByUser = new Map(); // userId -> [{ ref, data }]

  for (const doc of snapshot.docs) {
    const reminder = doc.data();

    // filter เงื่อนไขที่เหลือใน memory (ดูเหตุผลใน docstring ด้านบน)
    if (reminder.completedAt) continue;
    if (reminder.type === "routine" || reminder.type === "stopwatch") continue;
    if (!reminder.nextDueAt || reminder.nextDueAt > now) continue;

    // renotify guard — ข้ามถ้าเคยแจ้งรอบนี้ไปแล้ว (ดูคอมเมนต์ RENOTIFY_GUARD_FIELD ด้านบน)
    const lastNotifiedAt = reminder[RENOTIFY_GUARD_FIELD] || 0;
    if (lastNotifiedAt >= reminder.nextDueAt) continue;

    // doc.ref.parent.parent คือ users/{userId} document (โครงสร้างจริง:
    // users/{userId}/reminder-mode/{reminderId} — ดู firestore-db.js's
    // remindersCol) ถ้าโครงสร้างพาธเปลี่ยนในอนาคต ต้องแก้บรรทัดนี้ด้วย
    const userId = doc.ref.parent.parent?.id;
    if (!userId) {
      console.warn(`[checkDueReminders] reminder ${doc.id} ไม่มี parent user document ที่คาดไว้ — ข้าม`);
      continue;
    }

    if (!dueDocsGroupedByUser.has(userId)) dueDocsGroupedByUser.set(userId, []);
    dueDocsGroupedByUser.get(userId).push({ ref: doc.ref, data: reminder });
  }

  console.log(`[checkDueReminders] due จริง (ผ่าน filter ครบ) ${[...dueDocsGroupedByUser.values()].flat().length} รายการ จาก ${dueDocsGroupedByUser.size} user`);

  // ประมวลผลทีละ user (ดึง FCM token ของ user นั้นครั้งเดียว ใช้ส่งให้ทุก
  // reminder ที่ due พร้อมกันของ user คนนั้น ประหยัด Firestore read กว่า
  // ดึง token ซ้ำทุก reminder)
  for (const [userId, dueReminders] of dueDocsGroupedByUser) {
    await processUserDueReminders(userId, dueReminders, now);
  }
});

async function processUserDueReminders(userId, dueReminders, now) {
  const tokensSnapshot = await db.collection("users").doc(userId).collection("fcmTokens").get();
  const tokens = tokensSnapshot.docs.map((d) => d.data().token).filter(Boolean);

  if (tokens.length === 0) {
    console.log(`[checkDueReminders] user ${userId} ไม่มี FCM token ลงทะเบียนไว้ — ข้ามการส่ง push แต่ยัง update nextDueAt/lastNotifiedAt ตามปกติ`);
  }

  const batch = db.batch();

  for (const { ref, data: reminder } of dueReminders) {
    if (tokens.length > 0) {
      // ส่ง data-only message เพื่อให้ service worker เป็นจุดเดียวที่แสดง
      // notification ใน background; ไม่เกิด native notification ซ้ำใน
      // foreground ที่ React มี due banner ของตัวเองอยู่แล้ว.
      const message = {
        data: {
          reminderId: ref.id,
          title: "ถึงเวลาแล้ว",
          body: reminder.title || "(ไม่มีชื่อ)"
        },
        tokens
      };
      try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[checkDueReminders] ส่ง push "${reminder.title}" ให้ user ${userId}: สำเร็จ ${response.successCount}/${tokens.length}`);

        // เก็บ token ที่ส่งไม่สำเร็จเพราะไม่ valid แล้ว (unregistered/
        // expired) ไปลบทิ้งจาก fcmTokens — กัน token เก่าค้างอยู่เรื่อยๆ
        // ทำให้ sendEachForMulticast เสียเวลา/error ซ้ำในรอบถัดไปเปล่าๆ
        response.responses.forEach((r, idx) => {
          if (!r.success && (r.error?.code === "messaging/registration-token-not-registered")) {
            const deadToken = tokens[idx];
            db.collection("users").doc(userId).collection("fcmTokens").doc(encodeURIComponent(deadToken)).delete()
              .catch((e) => console.error(`[checkDueReminders] ลบ dead token ไม่สำเร็จ:`, e));
          }
        });
      } catch (err) {
        console.error(`[checkDueReminders] ส่ง push ให้ user ${userId} ล้มเหลว:`, err);
        // ส่ง push ล้มเหลวไม่ควรบล็อกการ update nextDueAt ด้านล่าง — ผู้ใช้
        // พลาด push รอบนี้ไปก็ยังเห็น due-banner ปกติเมื่อเปิดแอปครั้งถัดไป
      }
    }

    // อัปเดต lastNotifiedAt เสมอ (ส่งสำเร็จหรือไม่ก็ตาม กัน retry storm ถ้า
    // FCM ส่ง error กลับมาซ้ำๆ) + คำนวณ nextDueAt รอบถัดไปให้ type ที่วนซ้ำ
    // (เหมือน markCompleted()/scheduleNext() ฝั่ง client ทำตอนผู้ใช้กด
    // "เตือนอีกครั้ง" — ที่นี่ทำอัตโนมัติแทนเพราะไม่มีใครเปิดแอปอยู่ให้กด)
    const updates = { [RENOTIFY_GUARD_FIELD]: now };
    if (isOneShotType(reminder.type)) {
      // one-shot ที่ยิงแล้วไม่มีใคร acknowledge — ปิด enabled เฉยๆ (ไม่ตั้ง
      // completedAt เพราะนั่นเป็น "ผู้ใช้กดทำเสร็จแล้ว" ไม่ใช่ระบบยิงเอง
      // ระวัง: completedAt ก็ไม่ sync ขึ้น backend ตาม design เดิมของเฟส 4
      // อยู่แล้ว ต่อให้ set ที่นี่ frontend ก็จะไม่เห็นค่านี้เมื่อ sync กลับไป)
      updates.enabled = false;
    } else if (reminder.type === "interval" || reminder.type === "weekly") {
      updates.nextDueAt = computeNextDueAt(reminder, now);
    } else if (reminder.type === "event-anchored") {
      // Event-anchored ถูก arm ใหม่เมื่อผู้ใช้ trigger เหตุการณ์รอบถัดไป;
      // ห้ามคำนวณจาก lastTriggeredAt เดิมซ้ำ เพราะจะได้ due เวลาเดิมและ
      // scheduler จะเห็นมันค้างอยู่ตลอด.
      updates.nextDueAt = null;
    }
    batch.update(ref, updates);
  }

  await batch.commit();
}
