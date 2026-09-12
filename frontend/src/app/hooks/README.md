# App hooks

Phase 3 รอบแรกสองขั้นตอน:
- สลับไป Reminder ไม่เรียก goToday ของ Activity อีกต่อไป
- Reminder ใช้ `use-reminder-calendar.js` โหลดตาม selectedDateKey ของตัวเอง (รวมวันก่อนหน้าเพื่อกิจกรรมข้ามคืน) ใช้กับ Timeline และ export
- โหลดเมื่อ Reminder แสดงอยู่ และ refresh เมื่อกิจกรรมต้นทางเปลี่ยน โดยตัด response ของวันที่/บัญชีเก่าออก
- `use-activity-error.js` เก็บ error กิจกรรมแยกจาก Auth; App แสดงผ่าน banner กลางได้ทั้งสองโหมด
- การคำนวณโควตา Composer และระบบส่งแจ้งเตือนยังใช้ข้อมูล/เส้นทางเดิม ไม่ได้เปลี่ยนเป็นข้อมูลของวันที่ที่กำลังเลือกดู

ทดสอบ: `node frontend/tests/app-mode-boundaries.test.mjs`

- `use-app-navigation.js`: mode Activity/Reminder, Settings drawer และคู่มือล็อกอิน เป็น state ชั่วคราวของแอป
- Theme, สี Reminder Timeline, กระจก Summary และความละเอียด Week Spine อยู่ใน `features/settings/hooks/use-display-preferences.js` เก็บใน localStorage ด้วย key เดิม รวมถึง fallback จาก key กระจกแบบเก่า
- `useWeekNavigation({ mode })` ดูแลเฉพาะวัน/สัปดาห์และปุ่มลัด รับ mode เพื่อหยุดปุ่มลัดเมื่ออยู่ Reminder

ทดสอบ: `node frontend/tests/app-navigation-browser.mjs` — สลับโหมด, input focus, preference persistence และค่าเริ่มต้นหลัง reload

- `use-app-shell-ui.js`: state ของ account menu, Activity reading mode และ scroll กลับจุดบนสุด

State นี้เป็นเรื่องของเปลือกแอพและไม่ได้เป็นเจ้าของข้อมูล Activity หรือ Reminder โดยตรง จึงแยกจาก `app.jsx` โดยคง prop และพฤติกรรมเดิม
