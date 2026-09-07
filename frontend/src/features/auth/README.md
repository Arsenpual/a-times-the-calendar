# Auth

- `api/google-auth.js`: Firebase Google popup login, subscribe/sign-out และ legacy popup reauthentication โดยคง function body เดิม
- `hooks/use-auth.js`: สถานะ login และ flow ตรวจการเชื่อม Calendar เดิม ยังไม่ได้แยก state orchestration ในรอบนี้
- Firebase Auth instance อยู่ที่ `src/shared/config/firebase-auth.js` ใช้ร่วมกันทั้ง Auth, Calendar และ HTTP client

หน้าล็อกอินและ account menu ยังประกอบใน `app.jsx` ตามเดิม ไม่มีการเปลี่ยน OAuth configuration หรือ storage key ในรอบนี้

หลัง build ผ่าน ให้ทดสอบ login/logout, refresh หน้า, การคง session และการเชื่อม Calendar ด้วยบัญชีจริง
