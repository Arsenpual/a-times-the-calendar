# Frontend refactor baseline

บันทึกก่อนเริ่มย้ายโครงสร้างรอบใหม่ เพื่อให้ทุก phase ตรวจได้ว่า behavior สำคัญยังทำงานเหมือนเดิม

วันที่บันทึก: 26 กันยายน 2026

## คำสั่งตรวจมาตรฐาน

| คำสั่ง | ใช้ตรวจ |
| --- | --- |
| `npm test` | unit/integration tests 11 ชุด |
| `npm run test:browser` | browser smoke tests (5 ชุด ณ baseline; 6 ชุดหลัง Phase 1) ใช้ Chrome ที่ติดตั้งในเครื่อง |
| `npm run test:all` | รันทั้ง 16 ชุด |
| `npm run build` | production build |
| `npm run verify` | unit/integration tests แล้ว build |
| `npm run verify:full` | tests ทั้งหมดแล้ว build |

Test dependencies อยู่ใน `frontend/devDependencies` แล้ว จึงไม่ต้องติดตั้ง React renderer หรือ Playwright ไว้ในโฟลเดอร์ Temp อีกต่อไป

## Baseline ที่ผ่านแล้ว

- Unit/integration: 11/11 ชุด
- Browser smoke: 5/5 ชุด
- Vite production build: ผ่าน
- Source files ใต้ `src/`: 168 ไฟล์
- Main JavaScript bundle: 740.58 kB (gzip 216.90 kB)
- Main CSS bundle: 169.41 kB (gzip 28.34 kB)

Vite ยังเตือนว่า main JavaScript chunk ใหญ่กว่า 500 kB ซึ่งเก็บไว้แก้ใน phase performance/code splitting ภายหลัง ไม่ใช่เป้าหมายของ F0

## ผลหลัง Phase 1 — Dev mockup isolation

- mockup registry และ CSS โหลดเฉพาะ Vite dev server
- แต่ละ mockup โหลดแบบ lazy เมื่อเปิด preview
- production ใช้ inert stub และมี Rollup build guard ป้องกัน `src/dev/mockups/` หลุดเข้า bundle
- เพิ่ม browser regression สำหรับ dev mockup route ทำให้ browser suite รวมเป็น 6 ชุด
- Main JavaScript ลดจาก 740.58 kB เหลือ 669.52 kB (gzip 216.90 → 199.11 kB)
- Main CSS ลดจาก 169.41 kB เหลือ 164.32 kB (gzip 28.34 → 27.36 kB)

## ผลหลัง Phase 2 — Feature CSS split

- `activity-mode.css` เหลือเป็น manifest 9 imports และแยก CSS ตาม Activity surface
- `reminder-mode.css` เหลือเป็น manifest 6 imports และแยก CSS ตาม Reminder surface
- ไฟล์ CSS ที่ใหญ่ที่สุดหลังแยกคือ `reminder-list-cards.css` 658 บรรทัด
- production CSS hash และขนาดเท่ากับหลัง Phase 1 (`index-Dmb67cHh.css`, 164.32 kB) ยืนยันว่า mechanical split ไม่เปลี่ยน bundled CSS

## ผลหลัง Phase 3 — App composition boundary

- `app.jsx` ลดจาก 994 เหลือ 14 บรรทัด และรับผิดชอบเฉพาะ dev route กับ Auth boundary
- ย้าย account-scoped hook composition ไป `account-app.jsx`; Firebase uid key และ Reminder mounted lifecycle ยังอยู่เหมือนเดิม
- แยก shell UI เป็น `components/app-header.jsx`, `calendar-connection-overlays.jsx` และ `activity-auth-state.jsx`
- `account-app.jsx` ลดเหลือประมาณ 734 บรรทัด โดยไม่ย้าย business state ไปอยู่ใน presentational components

## ไฟล์ใหญ่ที่ต้องลดความรับผิดชอบ

| ไฟล์ | จำนวนบรรทัด ณ baseline |
| --- | ---: |
| `src/features/activity/styles/activity-mode.css` | 2,941 |
| `src/features/reminder/styles/reminder-mode.css` | 1,915 |
| `src/app/app.jsx` | 1,012 |
| `src/features/activity/components/activity-modal.jsx` | 995 |
| `src/features/activity/hooks/use-activity-mutations.js` | 670 |
| `src/features/activity/components/activity-popup.jsx` | 582 |
| `src/shared/i18n/i18n.jsx` | 529 |

## กติกาสำหรับ phase ถัดไป

1. ย้ายหรือแยกทีละ boundary และไม่เปลี่ยน UI/behavior พร้อมกันโดยไม่จำเป็น
2. หลังแต่ละชุดการเปลี่ยนแปลงให้รันอย่างน้อย `npm run verify`
3. ถ้าแตะ navigation, popup, drag/resize, Reminder composer หรือ Telegram topbar ให้รัน `npm run test:browser` เพิ่ม
4. ห้ามนำ `dev/mockups` เข้าสู่ production dependency graph
5. ถ้าขนาด bundle เพิ่มขึ้นอย่างมีนัยสำคัญ ให้ระบุเหตุผลก่อนเดิน phase ต่อ

## Manual smoke checklist ก่อน deploy

- สลับ Activity/Reminder Mode และสถานะ panel ไม่หลุด
- Activity: week/cycle/fullscreen, drag, resize, undo/redo และเปิด popup
- Reminder: สร้าง/แก้ไข/ลบ, snooze, complete, buffer และ timeline export
- Google Calendar: โหลด, reconnect และแก้ไขกิจกรรม
- Telegram/MR.Zettascale: เปิดเมนู, mute/unmute, เปิดแชต และ unread count
- Theme/language/settings: reload แล้วยังคงค่าที่เลือก
