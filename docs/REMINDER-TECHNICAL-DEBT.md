# Reminder — Technical Debt

บันทึก: 9 กันยายน 2026

## ข้อตกลงปัจจุบัน

Firebase Functions `checkDueReminders` เป็น server scheduler หลักเพียงตัวเดียว ส่วน Cloud Run Worker ยุติการใช้งานใน source แล้ว การแก้ source ไม่ได้เปลี่ยนทรัพยากรที่ deploy ไว้บน Cloud

## TD-01 — Duplicated due-logic

**สถานะ: แก้การคัดลอกหลักแล้ว; ต้องรักษาไม่ให้เกิดซ้ำ**

เดิม frontend, Firebase Functions และ Cloud Run Worker มีสูตรคำนวณกำหนดเวลาคนละสำเนา ทำให้แก้ไขแล้วอาจได้ผลต่างกัน ปัจจุบันใช้ต้นทางเดียว:

- `functions/domain/reminder-due-logic.js`: การคำนวณ next due และเงื่อนไข due
- `functions/domain/interval-schedule.js`: รอบ interval และสรุปช่วงทำงาน
- `frontend/src/features/reminder/lib/reminder-due-logic.js` และ `interval-schedule.js`: re-export เท่านั้น

สำเนาเดิมใน `functions/reminder-due-logic.js` และ `cloud-run-reminder-worker/reminder-due-logic.js` ถูกนำออกแล้ว จึงไม่ควรบันทึกว่า duplication ทั้งสามชุดยังค้างอยู่

งานติดตาม:

- [ ] ตรวจ logic ตารางเวลาใน UI, export และ Telegram ว่ามีสูตรซ้ำที่ควรใช้ domain ร่วมกันอีกหรือไม่ ก่อนเพิ่มชนิด reminder ใหม่
- [ ] รักษา regression test ที่ยืนยันว่า frontend กับ Functions ใช้ implementation เดียวกัน
- [ ] แยกกฎเวลาออกจากนโยบายช่องทางแจ้งเตือนให้ชัดเมื่อขยายระบบ: interval ยังถูกยกเว้นจาก FCM แต่ Telegram มี flow ต่างหาก ห้ามรวมจนเปลี่ยนพฤติกรรมโดยไม่ตั้งใจ

## TD-02 — Shared package ระดับโปรเจกต์

**สถานะ: ค้าง / ยังไม่เริ่มย้าย package**

แม้ใช้ logic ชุดเดียวแล้ว แต่ frontend ยัง import ข้ามโฟลเดอร์ด้วย `../../../../../functions/domain/...` ทำให้ frontend ผูกกับโครงสร้าง deployment ของ Functions การย้ายไฟล์หรือแยก build อาจทำให้ import แตก

ปัจจุบันวาง domain ไว้ใน Functions เพื่อให้ Firebase deploy รวมไฟล์เหล่านี้ได้โดยตรง เป็นโครงสร้างชั่วคราวที่ใช้งานได้ แต่ยังไม่ใช่ shared package ระดับโปรเจกต์

แนวทางเมื่อกลับมาทำ:

1. สร้าง package เช่น `packages/reminder-domain/` มี public exports ชัดเจน และไม่มี dependency ต่อ Firebase, DOM หรือ React
2. ให้ frontend และ Functions import ผ่านชื่อ package แทน relative path ข้ามโฟลเดอร์
3. กำหนดวิธีติดตั้งและส่ง package ไปกับ Functions deployment ให้ครบ อย่าสมมติว่า workspace symlink หรือ `file:../...` จะถูก upload ตามไปด้วย ต้องตรวจ deployment artifact จริง
4. รองรับ frontend ESM และ Functions CommonJS ที่เรียก dynamic import โดยไม่สร้างสำเนา source ที่ต้องดูแลแยก
5. ย้ายพร้อมอัปเดต build, CI, lockfile และเอกสาร จากนั้นรันทดสอบเดิมทั้งหมด

เกณฑ์ปิดงาน:

- [ ] มีต้นทาง business logic เพียงชุดเดียวใน shared package
- [ ] ไม่มี frontend import ตรงเข้า `functions/domain/`
- [ ] ติดตั้งใหม่และ build frontend ได้จาก clean checkout
- [ ] Functions deployment artifact มี package และโหลดได้โดยไม่อาศัยไฟล์นอก artifact
- [ ] Domain/schema tests และ Firestore Emulator integration tests ผ่าน
- [ ] กฎ interval, weekly, one-shot, event-anchored และ FCM failure ไม่เปลี่ยนจากที่ตกลงไว้

## หลักฐานและขอบเขตการทดสอบ

ชุดทดสอบที่มี: `functions/domain.test.cjs`, `functions/worker-schema.test.cjs` และ `functions/reminder-emulator.test.cjs` โดยรอบล่าสุดผ่าน integration 17 เคส และ domain/schema อีก 2 เคส

Integration ใช้ Firestore Emulator จริงและจำลอง FCM เท่านั้น ไม่ยืนยันการส่งถึงอุปกรณ์จริง, production index readiness หรือ Cloud Scheduler infrastructure ดูคำสั่งรันใน [functions README](../functions/README.md)

เอกสารนี้เป็น backlog สำหรับงานภายหลัง ไม่ใช่คำสั่งให้ย้าย package หรือ deploy ตอนนี้
