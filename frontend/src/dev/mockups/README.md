# Mockups

เก็บ mockup, ตัว preview และ CSS รองรับในโฟลเดอร์เดียวกัน โดยแยกออกจาก production bundle อย่างชัดเจน

## เปิดทดสอบ

รันด้วย `npm run dev` แล้วกด `Ctrl + Alt + W` บนหน้าหลักขณะที่ไม่ได้พิมพ์ในช่อง input/textarea หรือพื้นที่แก้ไขข้อความ จะเปิด preview ในหน้าต่างใหม่ กดปุ่ม Mockup เพื่อเลือกตัวอย่างที่มีอยู่

กด `Ctrl + Alt + A` เพื่อเปิดตัวอย่าง AI Mode โดยตรง (นอกช่องพิมพ์เช่นกัน)

กด `Ctrl + Alt + 7` เพื่อเปิดตัวอย่าง Focus 7 วันโดยตรง หรือเลือก `seven day focus` จากรายการ Mockup ตัวอย่างนี้แสดงไฟล์ HTML ต้นฉบับในกรอบแยก เพื่อรักษารูปแบบและการโต้ตอบของต้นฉบับ

เพิ่ม Activity mockup ด้วยชื่อ `activity-mode-<ชื่อ>-mockup.jsx` ในโฟลเดอร์นี้ โดย export default component ระบบ lazy `import.meta.glob` ใน `dev-mockups-entry.jsx` จะพบให้อัตโนมัติ และโหลดไฟล์เมื่อเปิดตัวอย่างนั้นเท่านั้น

## ขอบเขต production

- `vite.config.js` ชี้ alias `@dev-mockups` มาที่ entry นี้เฉพาะ dev server
- production build ใช้ inert stub ที่ `src/app/dev-mockups.production.jsx`
- build guard จะทำให้ `npm run build` ล้มทันที หาก module ใดใต้ `src/dev/mockups/` หลุดเข้า production bundle
- URL `?activity-mode-mockup=1` และคีย์ลัดจะไม่เปิดเครื่องมือ mockup บนเว็บ production
