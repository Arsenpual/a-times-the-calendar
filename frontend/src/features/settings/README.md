# Settings

`components/settings-drawer.jsx` ย้ายมาจาก `src/components/` โดยปรับ import ของระบบภาษาและคง component เดิม

`app.jsx` ยังถือ state และส่ง props ของการตั้งค่า CSS ยังอยู่ใน `src/index.css` รอบนี้ยังไม่แยก CSS หรือ state

ทดสอบเปิด/ปิด drawer และการตั้งค่าภาษา สี และค่าที่ใช้งานอยู่ตามปกติ
