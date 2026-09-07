# Mockups

เก็บ mockup, ตัว preview และ CSS รองรับในโฟลเดอร์เดียวกัน คงรายละเอียด mockup เดิม

## เปิดทดสอบ

กด `Ctrl + Alt + W` บนหน้าหลักขณะที่ไม่ได้พิมพ์ในช่อง input/textarea หรือพื้นที่แก้ไขข้อความ จะเปิด preview ในหน้าต่างใหม่ตามพฤติกรรมเดิม กดปุ่ม Mockup เพื่อเลือกระหว่าง Week Spine และ Focus Rail

เพิ่ม Activity mockup ด้วยชื่อ `activity-mode-<ชื่อ>-mockup.jsx` ในโฟลเดอร์นี้ โดย export default component ระบบ import.meta.glob ใน `src/app/app.jsx` จะพบให้อัตโนมัติ

`reminder-dashboard-mockup.jsx` เก็บเป็นต้นแบบเช่นเดิม ยังไม่อยู่ในรายการ Activity preview

ชื่อ dev เป็นการจัดโฟลเดอร์เท่านั้น: preview ยังคงถูกรวมใน production build ตามเดิม รอบนี้ไม่ได้เปลี่ยนเงื่อนไขคีย์ลัดหรือการเปิดหน้าต่าง
