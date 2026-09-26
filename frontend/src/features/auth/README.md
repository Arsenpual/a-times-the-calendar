# Auth

- `api/google-auth.js`: Firebase Google popup login, subscribe/sign-out และ legacy popup reauthentication โดยคง function body เดิม
- `hooks/use-auth.js`: สถานะ login และ flow ตรวจการเชื่อม Calendar เดิม ยังไม่ได้แยก state orchestration ในรอบนี้
- Firebase Auth instance อยู่ที่ `src/shared/config/firebase-auth.js` ใช้ร่วมกันทั้ง Auth, Calendar และ HTTP client

หน้าล็อกอินอยู่ใน `src/app/components/activity-auth-state.jsx` และ account menu อยู่ใน `src/app/components/app-header.jsx` โดย `app.jsx` ถือ Auth boundary ไม่มีการเปลี่ยน OAuth configuration หรือ storage key

`styles/auth.css` เป็นเจ้าของ style ของหน้า login และ login guide โดย `src/index.css` import ให้ตามลำดับเดิม

หลัง build ผ่าน ให้ทดสอบ login/logout, refresh หน้า, การคง session และการเชื่อม Calendar ด้วยบัญชีจริง
