# Reminder Mode — Phase 2

Phase 2 แยก state, actions และ JSX จาก reminder-mode.jsx ครบตามขอบเขตที่ตกลงไว้แล้ว

## โครงสร้าง
- components/reminder-mode.jsx: ประกอบ hooks และเชื่อม callbacks ระหว่าง panels
- components/reminder-topbar.jsx: Omnibar, Telegram toggle และปุ่มสถิติ
- components/telegram-connection-toast.jsx: สถานะการเชื่อมต่อและปิดข้อความ
- components/reminder-alerts.jsx: due banner, snooze และ backdrop ของเมนู
- components/reminder-list-panel.jsx / reminder-card.jsx: ตัวกรองสถานะและรายการ
- components/reminder-composer.jsx: ฟอร์มสร้าง/แก้ไข
- components/reminder-timeline-panel.jsx / reminder-timeline-rows.jsx: Timeline และแถวที่ memoize
- hooks/: เป็นเจ้าของข้อมูล, runtime actions, composer, filters, timeline, export, menus, Telegram และ stats
- lib/reminder-config.js: ตัวเลือก UI และค่าคงที่
- lib/reminder-defaults.js: draft ใหม่คำนวณวันเวลาเมื่อเรียกใช้
- lib/reminder-formatters.js: ข้อความและเวลาร่วมกันระหว่าง card และ timeline
- lib/reminder-sync-fields.js: เลือกฟิลด์สำหรับ sync และแปลง nextDueAt ที่ไม่ finite เป็น null

## Event-anchored session

Event-anchored ไม่ใช่ตัวเลือกสำหรับสร้าง Reminder ใหม่แล้ว แต่เป็น session เสริมสำหรับ Reminder ที่มีเวลาตายตัว: `weekly` และ `once-at`.

- ก่อนเวลาหลัก: สร้าง Countdown ชั่วคราว; หลังเวลาหลัก: สร้าง Stopwatch ชั่วคราว
- แต่ละช่วงตั้งนาทีหรือชั่วโมงได้ (1–1,440 นาที); ปิดทั้งคู่คือไม่มี session เสริม
- ตั้งชื่อ Countdown และ Stopwatch ชั่วคราวแยกจากชื่อ Reminder หลักได้; เก็บ config ใน document หลัก ไม่สร้าง reminder ลูก
- Firebase Function เก็บ `eventAnchorStartedAt` เมื่อ Reminder หลักถึงเวลา; browser ใช้ค่านั้นสร้าง Stopwatch ที่มองเห็นได้จนหมด buffer
- Event-anchored เดิมยังอ่าน/แก้ไขได้เพื่อไม่ให้ข้อมูลเก่าหาย แต่ไม่มีในตัวเลือกตอนสร้างใหม่

`interval`, `routine`, `countdown` และ `stopwatch` ยังไม่รองรับ session: ไม่มี due event หลักที่เหมาะกับ lifecycle นี้

## ขอบเขตความรับผิดชอบ
Components ส่ง action กลับไปยัง hooks โดยไม่เขียนฐานข้อมูลเอง การคำนวณ due หลักยังอยู่ใน reminder-due-logic.js และระบบเดิม ส่วน formatter ใช้แสดงผลเท่านั้น
ปุ่มปิด Telegram เรียก dismissTelegramStatus จาก hook เพื่อปิดข้อความและหยุดตรวจลิงก์ตามพฤติกรรมเดิม
Timeline rows ตรวจทั้งข้อมูลแถวและ callback เพื่อไม่เรียก handler เก่าหลัง render ใหม่

## ตรวจสอบจากรากโปรเจกต์
- npm run build --prefix frontend
- node frontend/tests/reminder-sync.test.mjs
- node frontend/tests/reminder-phase2.test.mjs
- node frontend/tests/event-anchor-session.test.mjs
- node frontend/tests/reminder-phase2-browser.mjs
- node frontend/tests/reminder-shell-browser.mjs
- node frontend/src/features/reminder/hooks/reminder-timeline-export.test.mjs

Browser tests ใช้ Chrome และ Playwright ที่ติดตั้งใน temporary test runtime: times-reminder-sync-tests/node_modules (เช่นเดียวกับชุดทดสอบเดิม)
