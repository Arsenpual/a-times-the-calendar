# Shared

โค้ดที่หลายฟีเจอร์ใช้ร่วมกัน ไม่มี dependency ย้อนกลับไปยัง `features/` หรือ `app/` (ตรวจอัตโนมัติด้วย `tests/architecture-boundaries.test.mjs`)

```text
shared/
├── api/
│   ├── client.js
│   ├── firestore-quota-status.js
│   ├── google-calendar.js
│   └── in-flight-reads.js
├── config/
│   ├── assistant-preference-fields.js
│   ├── firebase-auth.js
│   └── firebase-config.js
├── hooks/
│   └── use-session-task-guard.js
├── i18n/
│   ├── i18n.jsx          # React provider/context
│   └── i18n-catalog.js   # dictionary และ locale data แบบ pure JS
├── lib/
│   ├── activity-colors.js
│   ├── date-utils.js
│   ├── id-utils.js
│   ├── lonth-engine.js
│   └── timeline-layout.js
├── styles/
│   ├── global.css
│   ├── popup-layer.css
│   └── portal-theme.css
└── ui/
    ├── auto-shrink-text.jsx
    ├── brand-wordmark.jsx
    └── popup-layer.jsx
```
