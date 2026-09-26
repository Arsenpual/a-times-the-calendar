# Activity feature

รอบแรกของการจัด frontend ตามฟีเจอร์: ย้ายไฟล์เดิม 19 ไฟล์และแก้ relative import โดยคง logic และชื่อ export เดิม

## โครงสร้าง

- `components/`: Week Spine, Activity modal/popup, Mini Timeline, Weekly Summary และผลค้นหา tag รวมถึง Activity Mode และ Timeline Editor รุ่นเดิมที่ยังเก็บไว้
- `hooks/`: ข้อมูลปฏิทิน, mutation, modal, onboarding, นำทางสัปดาห์ และค้นหา tag
- `lib/`: ข้อมูล Week Spine, overlap layout, สีหมวดหมู่, recurrence และ export ภาพ

## จุดเชื่อม

`src/app/account-app.jsx` ประกอบหน้าจอและเรียก hooks จากฟีเจอร์นี้ ส่วน `src/features/reminder/components/reminder-mode.jsx` ยังใช้ ActivityPopup, activity-colors และ timeline-layout ผ่านตำแหน่งใหม่ เพื่อคงการแสดงและแก้ไขกิจกรรมใน Reminder Timeline

`hooks/use-archived-activity-ids.js` เป็นเจ้าของชุด ID ของกิจกรรมที่เก็บเข้าคลังใน localStorage และ event อัปเดตคลัง เพื่อให้ App ส่งชุดเดียวกันให้ทุก surface ที่ต้องกรองกิจกรรม

โค้ดส่วนกลางอยู่ใน `src/shared/` ส่วน Calendar API อยู่ที่ `features/calendar-connection/api/google-calendar.js` ส่วน `styles/activity-mode.css` เป็น CSS manifest ที่ import stylesheet ตาม surface ได้แก่ workspace, summaries, mini timeline, timeline editor, popup, modal, assistant, modal fields และ week spine โดย `src/index.css` ยัง import manifest จุดเดิม

Mockup และระบบ preview อยู่ใน `src/dev/mockups/` และถูกโหลดแบบ lazy เฉพาะ dev server ผ่าน alias `@dev-mockups` ส่วน production ใช้ inert stub และมี build guard ป้องกัน mockup หลุดเข้า bundle

## ตรวจหลังย้าย

รัน `npm run build` ภายใน `frontend/` และทดสอบด้วยบัญชีที่เข้าสู่ระบบ: เปิด/แก้ไขกิจกรรม, ลาก/ย่อขยาย, เก็บและนำออกจากคลัง, Mini Timeline, Weekly Summary และแสดง/แก้ไข Activity ใน Reminder Mode
