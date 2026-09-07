# Reminder feature

รอบย้ายไฟล์ตามฟีเจอร์: ย้ายไฟล์เดิม 10 ไฟล์และปรับ relative import โดยคง logic, export, CSS, storage key และรูปแบบข้อมูลเดิม

- `components/`: reminder-mode.jsx และ reminder-stats-panel.jsx
- `hooks/`: use-reminder-store.js, use-reminders-sync.js และ use-reminder-groups.js
- `lib/`: reminder-due-logic.js, reminder-quick-parse.js, reminder-stats.js และ reminder-telemetry.js
- `styles/`: reminder-material.css

## จุดเชื่อม

`src/app.jsx` ยังคง mount Reminder Mode ไว้เพื่อให้การแจ้งเตือนทำงานเมื่อเปิด Activity Mode ส่วน ActivityPopup และฟังก์ชันสี/จัด layout กิจกรรมอ้างถึง `features/activity/` ตามเดิมผ่านตำแหน่ง import ใหม่

API ของ Reminder, Firebase config, ภาษา, date/id helpers และ AutoShrinkText ยังอยู่ตำแหน่งเดิม ส่วน Telegram API/preference และ Push hook ย้ายไป `features/notifications/` แล้ว ระบบ mockup ยังอยู่ใน `src/components/`

ยังไม่ได้แยกไฟล์ reminder-mode.jsx หรือ runtime แจ้งเตือนในรอบนี้ สำเนา reminder-due-logic.js ใน functions/ และ cloud-run-reminder-worker/ ยังคงอยู่; ต้นฉบับ frontend อยู่ที่ `src/features/reminder/lib/reminder-due-logic.js` แล้ว

## การตรวจสอบ

ตรวจ relative imports และ build ผ่าน หลังย้ายควรทดสอบเพิ่ม/แก้ไข/ลบ reminder, snooze, ทำสำเร็จและ reuse, ตัวกรองกลุ่ม/ประเภท, timeline, เปิด/ปิด Telegram และแจ้งเตือนระหว่างอยู่ Activity Mode ด้วยบัญชีจริง
