# Shared

โค้ดที่หลายฟีเจอร์ใช้ร่วมกัน ไม่มี dependency กลับไปยัง features หรือ app

```text
shared/
├── api/client.js
├── config/
│   ├── firebase-config.js
│   └── firebase-auth.js
├── i18n/i18n.jsx
├── lib/
│   ├── date-utils.js
│   └── id-utils.js
├── styles/global.css
└── ui/auto-shrink-text.jsx
```

ย้ายไฟล์เพิ่ม 5 ไฟล์และปรับ import โดยคง logic เดิม ทั้ง HTTP client และ Firebase Auth ใช้ Firebase config จากตำแหน่งนี้

`styles/global.css` เก็บ design token, theme และ reset ที่ใช้ร่วมกัน ส่วน `src/index.css` ทำหน้าที่เป็น CSS manifest เพื่อ import style ของแต่ละ feature ตามลำดับ cascade. Endpoint เดิมใน `src/api.js` แยกไปยัง API ของ Activity, Reminder และ Announcements ครบแล้ว ทุกส่วนใช้ `shared/api/client.js` ร่วมกัน

หลัง build ผ่าน ให้ลองเปลี่ยนภาษา/ธีม, แสดงวันเวลา, ชื่อกิจกรรมยาว และ login/โหลดข้อมูลด้วยบัญชีจริง
