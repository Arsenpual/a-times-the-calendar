# Settings

`components/settings-drawer.jsx` ย้ายมาจาก `src/components/` โดยปรับ import ของระบบภาษาและคง component เดิม

`src/app/account-app.jsx` ถือ state และส่ง props ของการตั้งค่า ส่วน `app.jsx` เป็น entry/Auth boundary

ทดสอบเปิด/ปิด drawer และการตั้งค่าภาษา สี และค่าที่ใช้งานอยู่ตามปกติ

`Data Lab` ใน Settings ให้ผู้ใช้เลือกช่วงวันไม่เกิน 31 วันและดาวน์โหลด
activity export แบบ authenticated ลงเครื่องเท่านั้น เพื่อนำไปวิเคราะห์ด้วย
Python Data Lab ต่อไป ไม่มีการส่งรายงานกลับขึ้น backend หรือแก้ Calendar.

`Insight Review` อ่านเฉพาะ JSON report ที่ผู้ใช้เลือกจากเครื่องของตนใน
browser session ปัจจุบัน แล้วแสดง summary ที่กำหนดไว้ของ quality, priority
confidence, weekly pattern หรือ scheduling evaluation. ไฟล์และผลสรุปไม่ถูก
อัปโหลดหรือบันทึกเป็น preference.

ผู้ใช้สามารถเลือกให้ summary ที่กำลังเปิดเป็นบริบทของผู้ช่วยใน session
ปัจจุบันได้โดยชัดแจ้งเท่านั้น. Frontend ส่งเพียง `type` และ metric key/value
ที่อยู่ใน allowlist; backend ตรวจชนิด report ซ้ำอีกครั้งก่อนเรียก AI. ไม่มี
รายงานดิบ, ข้อสรุป, หรือ preference ถูกบันทึก และ context นี้ไม่ใช้ตัดสิน
ความเร่งด่วน ความสำคัญ หรือ Eisenhower quadrant.
