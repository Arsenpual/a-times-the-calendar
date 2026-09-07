# Notifications

ช่องทางส่งแจ้งเตือนที่ Activity และ Reminder ใช้ร่วมกัน

```text
notifications/
├── telegram/
│   ├── api.js
│   └── telegram-notification-preferences.js
└── push/
    ├── api.js
    └── hooks/use-push-notifications.js
```

- Telegram API: ดูสถานะ, เชื่อมต่อ, ส่งข้อความทดสอบ และส่งแจ้งเตือน Activity/Reminder
- Telegram preferences: เปิด/ปิดการส่งจากเบราว์เซอร์นี้ แยกตาม user ID โดยคง storage key เดิม
- `telegram/hooks/use-activity-telegram-notifications.js`: ตรวจเวลาเริ่ม Activity และส่ง Telegram ขณะเว็บเปิด
- Push API/hook: ลงทะเบียนและยกเลิก FCM token ตามพฤติกรรมเดิม
- ทั้งสอง API ใช้ `src/shared/api/client.js` ร่วมกับ `src/api.js` สำหรับ Firebase ID token, HTTP request และ error handling

## ขอบเขตรอบนี้

ย้ายไฟล์และแยกฟังก์ชัน API โดยไม่เปลี่ยน endpoint, payload, notificationKey หรือ function body ของ API ระบบ service worker ยังคงที่ `frontend/public/firebase-messaging-sw.js`

ปุ่ม Telegram, flow เชื่อมต่อ และวงรอบ Reminder ยังอยู่ใน `features/reminder/components/reminder-mode.jsx` วงรอบ Activity ยังคงอยู่ใน `app.jsx` การแยก UI และ runtime เป็นงานถัดไป เพื่อทดสอบพฤติกรรมแยกจากการย้ายครั้งนี้

## ตรวจสอบ

Build ผ่าน หลังย้ายทดสอบด้วยบัญชีจริง: เชื่อม Telegram, เปิด/ปิดการส่ง, Reminder ถึงกำหนด, Activity เริ่ม และแจ้งเตือนขณะสลับโหมด การตรวจ build ไม่ได้ทดสอบการส่งถึง Telegram จริง
