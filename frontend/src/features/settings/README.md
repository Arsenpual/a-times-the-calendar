# Settings

`components/settings-drawer.jsx` ย้ายมาจาก `src/components/` โดยปรับ import ของระบบภาษาและคง component เดิม

`src/app/account-app.jsx` ถือ state และส่ง props ของการตั้งค่า ส่วน `app.jsx` เป็น entry/Auth boundary

ทดสอบเปิด/ปิด drawer และการตั้งค่าภาษา สี และค่าที่ใช้งานอยู่ตามปกติ

`Data Lab` ใน Settings ให้ผู้ใช้เลือกช่วงวันไม่เกิน 31 วันและดาวน์โหลด
activity export แบบ authenticated ลงเครื่องเท่านั้น เพื่อนำไปวิเคราะห์ด้วย
Python Data Lab ต่อไป ไม่มีการส่งรายงานกลับขึ้น backend หรือแก้ Calendar.
