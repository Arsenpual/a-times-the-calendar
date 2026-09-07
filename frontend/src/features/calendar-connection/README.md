# Calendar connection

`api/google-calendar.js` เก็บสถานะการเชื่อมต่อ, เริ่ม OAuth authorization, การอ่าน/เขียนกิจกรรม และการตรวจ Calendar reauth error ที่แยกจากไฟล์ `src/google-calendar.js` เดิม

คง endpoint, error code, function signature และ request body เดิม รวมถึง legacy request helper ที่ยังไม่ได้ลบในรอบจัดโครงสร้าง

Activity hooks และ Auth hook เรียกโมดูลนี้ หน้าต่างขอสิทธิ์และ loading ยังอยู่ใน `app.jsx` ส่วน backend และ environment ไม่เปลี่ยน

ทดสอบโหลดปฏิทิน, เพิ่ม/แก้ไข/ลบกิจกรรม และขอสิทธิ์ใหม่ผ่านหน้าเว็บด้วยบัญชีจริง
