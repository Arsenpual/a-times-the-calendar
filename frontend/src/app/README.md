# App composition

`src/main.jsx` mount React และ LanguageProvider ส่วน `app.jsx` เป็น entry/router ขนาดเล็กสำหรับ dev mockup และ Auth boundary เท่านั้น การประกอบ feature ตามบัญชีอยู่ใน `account-app.jsx`

อัปเดต 12 กันยายน 2026: จบการแยก state และตรวจ lifecycle ตามขอบเขต Phase 3 ไม่ใช่การแยก JSX ทั้งหมดหรือเปลี่ยน backend

## เจ้าของ state

- `AuthenticatedApp` ใน `app.jsx` เป็นเจ้าของ `useAuth`; `AccountApp` ใช้ Firebase uid เป็น key เพื่อ reset feature state เมื่อเปลี่ยนบัญชี
- `account-app.jsx`: composition และ state wiring ระดับบัญชี โดยคง Reminder runtime ให้ mounted ขณะสลับโหมด
- `components/app-header.jsx`: header, navigation, tag search และ account menu แบบ presentational
- `components/calendar-connection-overlays.jsx`: สถานะ Calendar checking/reauth
- `components/activity-auth-state.jsx`: loading/sign-in UI ก่อนมี Firebase user
- `hooks/use-app-navigation.js`: mode, Settings และคู่มือล็อกอิน
- `hooks/use-app-shell-ui.js`: account menu, reading mode, scroll และ cleanup DOM listeners/animation frame
- `features/settings/hooks/use-display-preferences.js`: ค่าการแสดงผลและ localStorage key เดิม
- Activity hooks: วัน/สัปดาห์, Week/Cycle, modal, tag search, mutations และ Activity error
- `use-activity-collections.js`: แยก Calendar จริงออกจาก archive/demo และ tag-filtered Activity
- `use-cycle-activities.js`: ข้อมูลร่วมของ Cycle Overview/Summary
- `use-reminder-calendar.js`: Calendar ตามวันที่ Reminder เลือก ใช้กับ Timeline/export ไม่เปลี่ยนวันของ Activity

## Lifecycle

สลับโหมดไม่ใช่ logout: account tree และ Reminder runtime ที่ซ่อนยังคงอยู่เพื่อเดินตัวจับเวลา เมื่อ uid เปลี่ยนจึง unmount ทั้งบัญชี

- response เก่าห้ามเปิด modal ที่ปิดไปแล้วหรือทับรายการที่เปิดใหม่
- ล้าง tag search ต้องหยุด loading และไม่รับผลเก่า
- Calendar status ของบัญชีเก่าห้ามเปลี่ยนสิทธิ์บัญชีใหม่
- `shared/hooks/use-session-task-guard.js` กัน Activity mutation ทำขั้นถัดไป/เปลี่ยน state หลัง unmount ไม่ได้ยกเลิก HTTP ที่ส่งแล้วหรือ rollback ข้อมูลที่ server บันทึกแล้ว
- Telegram polling ล้าง interval ทิ้ง response เก่า และไม่ยิง status ซ้อน
- Activity error แยกจาก Auth error

ไม่ได้เปลี่ยนเส้นทางแจ้งเตือนหรือการคำนวณโควตา Composer ให้ผูกกับวันที่กำลังดู

## ทดสอบ

รัน `npm test --prefix frontend` สำหรับ unit/integration และ `npm run test:browser --prefix frontend` สำหรับ browser regression

Browser suites อยู่ใน `frontend/tests/` และ build ด้วย `npm run build --prefix frontend`

ทดสอบ hooks/browser ด้วย API จำลองและ Chrome headless ไม่ใช่การทดสอบ OAuth/Firestore/Telegram จริงบน public ต้อง smoke test บัญชีจริงหลัง deploy อีกครั้ง รอบนี้ไม่มี push/deploy

React renderer และ Playwright อยู่ใน `frontend/devDependencies` ไม่พึ่ง runtime ใน `%TEMP%`
