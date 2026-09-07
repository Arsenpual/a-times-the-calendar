# App composition

`app.jsx` เป็นจุดประกอบฟีเจอร์ของแอพ โดย `src/main.jsx` ยังคงเป็น entry point ที่ mount React และ LanguageProvider

รอบนี้ย้าย App จาก `src/app.jsx` พร้อมแก้ import ของฟีเจอร์ รูปภาพคู่มือล็อกอิน และ `import.meta.glob` ของ mockup ให้ชี้ไปยังไฟล์เดิม คง logic และ JSX เดิมทั้งหมด

Header, Account Menu, ปุ่มสลับโหมด และ state ประสานฟีเจอร์ยังอยู่ใน app.jsx การแยกเป็น component/hook ย่อยเป็นขั้นถัดไป ส่วน style ของ app shell อยู่ที่ `styles/app-shell.css`

หลังย้ายตรวจ build และลองสลับโหมด เปิด Settings/Account Menu และเปิด preview mockup ด้วยคีย์ลัดเดิม
