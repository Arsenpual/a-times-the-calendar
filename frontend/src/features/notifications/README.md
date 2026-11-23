# Notifications

ช่องทางส่งแจ้งเตือน (Push และ Telegram) ที่ประกอบเข้ากับ Activity Mode และ Reminder Mode จากระดับบัญชีผู้ใช้

```text
notifications/
├── api/
│   ├── push-api.js
│   ├── telegram-api.js
│   └── telegram-chat-api.js
├── components/
│   ├── telegram-chat-launcher.jsx
│   └── telegram-connection-toast.jsx
├── hooks/
│   ├── use-activity-telegram-notifications.js
│   ├── use-push-notifications.js
│   ├── use-telegram-connection.js
│   └── use-telegram-web-chat.js
└── lib/
    └── telegram-notification-preferences.js
```
