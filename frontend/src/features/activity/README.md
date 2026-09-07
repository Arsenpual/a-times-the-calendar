# Activity feature

รอบแรกของการจัด frontend ตามฟีเจอร์: ย้ายไฟล์เดิม 19 ไฟล์และแก้ relative import โดยคง logic และชื่อ export เดิม

## โครงสร้าง

- `components/`: Week Spine, Activity modal/popup, Mini Timeline, Weekly Summary และผลค้นหา tag รวมถึง Activity Mode และ Timeline Editor รุ่นเดิมที่ยังเก็บไว้
- `hooks/`: ข้อมูลปฏิทิน, mutation, modal, onboarding, นำทางสัปดาห์ และค้นหา tag
- `lib/`: ข้อมูล Week Spine, overlap layout, สีหมวดหมู่, recurrence และ export ภาพ

## จุดเชื่อม

`src/app.jsx` ประกอบหน้าจอและเรียก hooks จากฟีเจอร์นี้ ส่วน `src/features/reminder/components/reminder-mode.jsx` ยังใช้ ActivityPopup, activity-colors และ timeline-layout ผ่านตำแหน่งใหม่ เพื่อคงการแสดงและแก้ไขกิจกรรมใน Reminder Timeline

ไฟล์ส่วนกลาง (`api.js`, `date-utils.js`, `id-utils.js`, `i18n.jsx`, `components/auto-shrink-text.jsx`) ยังอยู่ตำแหน่งเดิม ส่วน Calendar API ย้ายไป `features/calendar-connection/api/google-calendar.js` แล้ว CSS ยังคงอยู่ใน `src/index.css` และ component เดิม

Mockup และระบบ preview ยังอยู่ใน `src/components/` เพื่อคงเส้นทาง `import.meta.glob` เดิม รอบนี้ยังไม่แยก API, CSS หรือ runtime แจ้งเตือน

## ตรวจหลังย้าย

รัน `npm run build` ภายใน `frontend/` และทดสอบด้วยบัญชีที่เข้าสู่ระบบ: เปิด/แก้ไขกิจกรรม, ลาก/ย่อขยาย, เก็บและนำออกจากคลัง, Mini Timeline, Weekly Summary และแสดง/แก้ไข Activity ใน Reminder Mode
