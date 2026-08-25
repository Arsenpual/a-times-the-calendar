/**
 * ทดสอบ firestore.rules ผ่าน Firebase Emulator Suite ก่อน deploy จริง —
 * ตามขั้นตอนที่ 2 ของระยะ 3 ใน firebase-migration-plan.md
 *
 * วิธีรัน (จาก root ของโปรเจกต์ ที่มี firebase.json):
 *   npm install --save-dev @firebase/rules-unit-testing mocha
 *   firebase emulators:exec --only firestore "mocha backend/scripts/firestore-rules.test.js"
 *
 * หรือรัน emulator แยกไว้ก่อนแล้วรัน mocha เอง (ดีกว่าเวลา debug ทีละเคส):
 *   firebase emulators:start --only firestore
 *   # อีก terminal:
 *   npx mocha backend/scripts/firestore-rules.test.js
 *
 * ครอบคลุมกรณีหลักที่ระยะ 3 ต้องการ:
 *   1. user อ่าน/เขียนข้อมูลของตัวเองได้
 *   2. user อ่าน/เขียนข้อมูลของ user อื่นไม่ได้เลย
 *   3. เขียน/ลบ activityCategories ของกิจกรรมที่ "ไม่ได้ lock" ได้ตามปกติ
 *   4. เขียน/ลบ activityCategories ของกิจกรรมที่ "lock ไว้" ต้องถูกปฏิเสธ —
 *      นี่คือเคสที่สำคัญที่สุดของระยะ 3 ทั้งหมด
 *   5. ปลด lock แล้วเขียนได้ตามปกติอีกครั้ง (lock ไม่ใช่ค่าถาวร)
 *   6. request ที่ไม่ได้ login (unauthenticated) ทำอะไรไม่ได้เลย
 */
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require("@firebase/rules-unit-testing");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "times-the-calendar-rules-test";
const USER_A = "user-a-uid";
const USER_B = "user-b-uid";

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, "..", "..", "firestore.rules"), "utf8")
    }
  });
});

after(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

/** Firestore client ที่ authenticate เป็น uid ที่กำหนด (ไม่ผ่าน Admin SDK — ใช้ client SDK ตรงเพื่อให้ Security Rules มีผลจริง) */
function asUser(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

function asAnonymous() {
  return testEnv.unauthenticatedContext().firestore();
}

describe("Firestore Security Rules — times-the-calendar (ระยะ 3)", () => {
  describe("การแยกข้อมูลระหว่าง user (data isolation)", () => {
    it("user อ่านหมวดหมู่ของตัวเองได้", async () => {
      // Seed ข้อมูลผ่าน admin context เพื่อข้าม rules ตอน setup (ไม่ใช่สิ่งที่กำลังทดสอบ)
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await adminCtx
          .firestore()
          .doc(`users/${USER_A}/categories/work`)
          .set({ name: "งาน", color: "#1557B0" });
      });

      const db = asUser(USER_A);
      await assertSucceeds(db.doc(`users/${USER_A}/categories/work`).get());
    });

    it("user อ่านหมวดหมู่ของ user อื่นไม่ได้", async () => {
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await adminCtx
          .firestore()
          .doc(`users/${USER_A}/categories/work`)
          .set({ name: "งาน", color: "#1557B0" });
      });

      const dbAsB = asUser(USER_B);
      await assertFails(dbAsB.doc(`users/${USER_A}/categories/work`).get());
    });

    it("user เขียนข้อมูลใต้ userId ของ user อื่นไม่ได้", async () => {
      const dbAsB = asUser(USER_B);
      await assertFails(
        dbAsB.doc(`users/${USER_A}/categories/hacked`).set({ name: "แฮ็ก", color: "#000000" })
      );
    });

    it("request ที่ไม่ได้ login ทำอะไรไม่ได้เลย", async () => {
      const anon = asAnonymous();
      await assertFails(anon.doc(`users/${USER_A}/categories/work`).get());
      await assertFails(
        anon.doc(`users/${USER_A}/categories/work`).set({ name: "x", color: "#000000" })
      );
    });
  });

  describe("Lock enforcement (หัวใจของระยะ 3)", () => {
    it("เขียน activityCategories ของกิจกรรมที่ไม่ได้ lock ได้ตามปกติ", async () => {
      const db = asUser(USER_A);
      await assertSucceeds(
        db.doc(`users/${USER_A}/activityCategories/event123`).set({ categoryId: "work" })
      );
    });

    it("เขียน activityCategories ของกิจกรรมที่ lock ไว้ต้องถูกปฏิเสธ", async () => {
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await adminCtx
          .firestore()
          .doc(`users/${USER_A}/lockedActivities/event123`)
          .set({ locked: true });
      });

      const db = asUser(USER_A);
      await assertFails(
        db.doc(`users/${USER_A}/activityCategories/event123`).set({ categoryId: "work" })
      );
    });

    it("ลบ activityCategories ของกิจกรรมที่ lock ไว้ต้องถูกปฏิเสธด้วย (ไม่ใช่แค่เขียน)", async () => {
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const admin = adminCtx.firestore();
        await admin.doc(`users/${USER_A}/activityCategories/event123`).set({ categoryId: "work" });
        await admin.doc(`users/${USER_A}/lockedActivities/event123`).set({ locked: true });
      });

      const db = asUser(USER_A);
      await assertFails(db.doc(`users/${USER_A}/activityCategories/event123`).delete());
    });

    it("ปลด lock แล้วเขียน activityCategories ได้ตามปกติอีกครั้ง", async () => {
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await adminCtx
          .firestore()
          .doc(`users/${USER_A}/lockedActivities/event123`)
          .set({ locked: true });
      });

      const db = asUser(USER_A);
      // ยังล็อกอยู่ — ต้องล้มเหลว
      await assertFails(
        db.doc(`users/${USER_A}/activityCategories/event123`).set({ categoryId: "work" })
      );

      // ปลด lock (การปลด lock เองไม่มีเงื่อนไขพิเศษ แค่ isOwner ก็พอ)
      await assertSucceeds(db.doc(`users/${USER_A}/lockedActivities/event123`).delete());

      // ปลดแล้ว — ต้องเขียนได้ตามปกติ
      await assertSucceeds(
        db.doc(`users/${USER_A}/activityCategories/event123`).set({ categoryId: "work" })
      );
    });

    it("lockedActivities document ที่มี locked: false ไม่ถือว่า lock (เผื่อ backend เขียนแบบนี้ในอนาคต)", async () => {
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await adminCtx
          .firestore()
          .doc(`users/${USER_A}/lockedActivities/event123`)
          .set({ locked: false });
      });

      const db = asUser(USER_A);
      await assertSucceeds(
        db.doc(`users/${USER_A}/activityCategories/event123`).set({ categoryId: "work" })
      );
    });
  });
});
