# Calendar connection

`api/google-calendar.js` เก็บสถานะการเชื่อมต่อ, เริ่ม OAuth authorization, การอ่าน/เขียนกิจกรรม และการตรวจ Calendar reauth error ที่แยกจากไฟล์ `src/google-calendar.js` เดิม

คง endpoint, error code, function signature และ request body เดิม รวมถึง legacy request helper ที่ยังไม่ได้ลบในรอบจัดโครงสร้าง

Activity hooks และ Auth hook เรียกโมดูลนี้ ส่วนสถานะ checking/reauth อยู่ใน `src/app/components/calendar-connection-overlays.jsx`; backend และ environment ไม่เปลี่ยน

`styles/calendar-connection.css` เก็บ UI สำหรับ token expiry prompt โดยไม่เปลี่ยน OAuth flow

ทดสอบโหลดปฏิทิน, เพิ่ม/แก้ไข/ลบกิจกรรม และขอสิทธิ์ใหม่ผ่านหน้าเว็บด้วยบัญชีจริง
