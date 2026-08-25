# functions/ — Cloud Functions Scaffold (migration plan v2 เฟส 5)

**สถานะ: ⚠️ SCAFFOLD — ยังไม่เคย deploy จริง**

โฟลเดอร์นี้ถูกสร้างขึ้นเพราะ Cloud Function ยัง deploy/รันผ่าน Firebase Emulator ไม่ได้ในสภาพแวดล้อมที่เขียนโค้ดนี้ (ไม่มี Firebase CLI, ไม่มี credentials, ไม่มี network ให้ `npm install` dependency จริง) — โค้ดทั้งหมดเขียนไว้ครบตามแผน และ **ผ่านการทดสอบ logic แบบ mock แล้ว** (ดูหัวข้อ "ทดสอบอะไรไปแล้วบ้าง" ด้านล่าง) แต่ยังไม่เคยรันบน Cloud Functions จริงสักครั้ง

## ไฟล์ในนี้

| ไฟล์ | คืออะไร |
|---|---|
| `index.js` | Scheduled function หลัก `checkDueReminders` — รันทุก 1 นาที (ปรับได้), query reminder ที่ due ทุก user, ส่ง FCM push, อัปเดต `nextDueAt`/`lastNotifiedAt` |
| `reminder-due-logic.js` | สำเนา CommonJS ของ `frontend/src/reminder-due-logic.js` — **ต้องแก้พร้อมกันทั้งสองไฟล์เสมอ** (ดูคอมเมนต์หัวไฟล์) |
| `package.json` | Dependencies (`firebase-admin`, `firebase-functions`) — ยังไม่เคย `npm install` จริงในสภาพแวดล้อมนี้ |

## ทดสอบอะไรไปแล้วบ้าง

**ทดสอบแล้ว (ผ่าน mock, ไม่ใช่ Firebase จริง):**
- Parity test: `reminder-due-logic.js` (CommonJS) คำนวณตรงกับ `frontend/src/reminder-due-logic.js` (ESM) ทุกกรณี 100% (18/18 เคส) — ยืนยันว่าสองไฟล์นี้ยังไม่ drift จากกัน ณ ตอนที่เขียน
- Business logic ของ `checkDueReminders`: mock ทั้ง `firebase-admin` (Firestore + Messaging) และ `firebase-functions` แล้วเรียก handler ตรงๆ ทดสอบ 14 เคส ครอบคลุม:
  - Reminder ที่ due จริง → ส่ง push + อัปเดตค่าใหม่ถูกต้อง
  - **Renotify guard** (การตัดสินใจเพิ่มเติมที่ scaffold นี้ทำเอง ดูด้านล่าง) → ไม่ส่งซ้ำถ้าเคยแจ้งรอบนี้ไปแล้ว
  - One-shot vs recurring type → พฤติกรรมหลัง due ต่างกันถูกต้อง (ปิด enabled vs เลื่อน nextDueAt)
  - `completedAt`/`routine`/`stopwatch`/`enabled:false`/nextDueAt ในอนาคต → ถูก exclude ถูกต้องทุกเคส
  - Dead FCM token (`messaging/registration-token-not-registered`) → ถูกลบออกจาก `fcmTokens` อัตโนมัติ
  - User ที่ไม่มี token เลย → ข้ามการส่ง push แต่ยัง update reminder ตามปกติ

**ยังทดสอบไม่ได้ในสภาพแวดล้อมนี้ (ต้องมี Firebase project จริง):**
- `firebase emulators:start` — รันจริงผ่าน emulator
- Firestore collection group query จริง (mock จำลอง query shape แต่ไม่ได้ทดสอบว่า index ที่ต้องการถูกต้องจริงหรือไม่)
- `admin.messaging().sendEachForMulticast()` จริง — mock แค่ shape ของ response ไม่ได้ยืนยันว่า Firebase Admin SDK เวอร์ชันจริงทำงานตรงตามที่ mock ไว้
- Cloud Scheduler จริง (ความถี่ `"every 1 minutes"`, timezone, retry behavior)
- Cost/invocation จริงเมื่อ deploy

## ต้องทำอะไรก่อน deploy จริง

1. `cd functions && npm install`
2. สร้าง Firestore **collection group index** สำหรับ `reminder-mode` + field `enabled` (Firebase Console > Firestore > Indexes > Collection Group tab) — ถ้าไม่มี query จะ throw error พร้อมลิงก์สร้างให้อัตโนมัติตอนรันครั้งแรก
3. ทดสอบผ่าน `firebase emulators:start --only functions,firestore` ก่อน ใส่ reminder ตัวอย่างที่ `nextDueAt` เป็นอดีตลง Firestore emulator ตรงๆ แล้วเรียกผ่าน `firebase functions:shell`
4. ตั้งค่า `VITE_FIREBASE_VAPID_KEY` ฝั่ง frontend (`.env`) และเติมค่า Firebase config จริงใน `frontend/public/firebase-messaging-sw.js` (ตอนนี้เป็น `"TODO_ใส่ค่าจริงตอน_deploy"` ทั้งหมด)
5. ยืนยัน `region` ใน `setGlobalOptions()` ให้ตรงกับที่ต้องการ (ตอนนี้ตั้งไว้ที่ `asia-southeast1` แบบเดา — ยังไม่ได้ยืนยันกับ project จริง)
6. เริ่ม deploy ด้วย schedule ที่ถี่น้อยกว่านี้ก่อน (เช่นทุก 5 นาที) เพื่อประเมิน cost ก่อนลดเวลาลงเหลือ 1 นาทีจริง

## การตัดสินใจที่ scaffold นี้ทำเอง (ควรทบทวนกับทีมก่อน deploy)

**Renotify guard policy**: migration plan v2 เฟส 5 ไม่ได้ระบุไว้ชัดเจนว่าควร renotify ซ้ำบ่อยแค่ไหนถ้าผู้ใช้ไม่เปิดแอปมา acknowledge reminder ที่ due — scaffold นี้เลือกนโยบาย **"แจ้งครั้งเดียวต่อรอบ"** (เก็บ `lastNotifiedAt` เทียบกับ `nextDueAt`ปัจจุบัน ถ้าเคยแจ้งไปแล้วสำหรับค่า `nextDueAt` นี้ ข้ามไม่ส่งซ้ำ) จนกว่าจะมีการเปลี่ยน `nextDueAt` (ผู้ใช้เปิดแอปมา snooze/complete เอง) ทางเลือกอื่นที่เป็นไปได้และยังไม่ได้ implement:
- Renotify ซ้ำทุก N นาทีจนกว่าจะถูก acknowledge
- Escalate (เปลี่ยนข้อความ/ความสำคัญ) หลัง renotify ครบ M ครั้ง

ควรตัดสินใจร่วมกับทีมว่านโยบายไหนตรงกับพฤติกรรมที่ต้องการ ก่อน deploy จริง
