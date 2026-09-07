# Activity APIs

แยกจาก src/api.js โดยคงชื่อ export, endpoint, payload และ error handling เดิม

- categories.js: หมวดหมู่และการผูกหมวดหมู่กิจกรรม
- tags.js: tag ของกิจกรรม
- locks.js: ล็อก/ปลดล็อก
- summary.js: สรุปสัปดาห์
- archive.js: คลังใน Firestore
- notifications.js: บันทึก/ลบข้อมูลเวลาเริ่มกิจกรรมสำหรับระบบแจ้งเตือนฝั่ง server
- activity-draft.js: ขอร่างกิจกรรมด้วย AI

ทุกไฟล์ใช้ shared/api/client.js การอ่าน/เขียน Google Calendar ยังคงอยู่ใน features/calendar-connection/api/google-calendar.js ส่วนการส่ง Telegram อยู่ใน features/notifications/telegram/api.js
