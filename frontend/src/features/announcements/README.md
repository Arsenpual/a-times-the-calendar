# Announcements

ฟีเจอร์นี้ดูแลข้อความประกาศสั้น ๆ ที่แสดงเป็นหน้าต่างลอยด้านบนของแอป เช่น ข่าวอัปเดตหรือข้อความจากผู้ดูแล โดยใช้ร่วมกันได้ทั้ง Activity Mode และ Reminder Mode ผ่านจุดประกอบใน `app/`

## โครงสร้าง

```text
announcements/
├── api/
│   └── announcement.js              # อ่านประกาศจาก backend
├── components/
│   └── announcement-ticker.jsx      # แสดงผลและควบคุมรอบการแสดง
├── hooks/
│   └── use-announcement-message.js  # โหลดข้อความและ refresh เมื่อกลับมาโฟกัสหน้า
└── styles/
    └── announcement-ticker.css      # layout, mask และ animation การเลื่อน
```

## ลำดับการทำงาน

1. `use-announcement-message.js` เรียก `api/announcement.js` หลังผู้ใช้เข้าสู่ระบบ และโหลดใหม่เมื่อแท็บกลับมา active
2. App ส่งข้อความที่ได้ให้ `AnnouncementTicker` ผ่าน prop `message`
3. ถ้าไม่มีข้อความ component จะไม่ render อะไร
4. เมื่อมีข้อความ component วัดความกว้างเพื่อคำนวณเวลาเลื่อนตามความเร็วคงที่
5. CSS animation เลื่อนข้อความจากขวาไปซ้ายจนพ้นขอบ
6. เมื่อจบรอบ ticker ซ่อนตามช่วงพัก แล้วเริ่มรอบใหม่อัตโนมัติ

การวัดความกว้างและการเลื่อนยังคงอยู่ใน component เดียวกัน เพื่อให้ความยาวข้อความและขนาดหน้าจอมีผลต่อเวลาอย่างถูกต้อง ส่วน CSS ไม่ถือ state ของรอบการแสดง

## การแก้ไขและทดสอบ

- เปลี่ยน endpoint หรือรูปแบบข้อมูล: แก้ที่ `api/announcement.js`
- เปลี่ยนวิธีโหลด/refresh: แก้ที่ `use-announcement-message.js`
- เปลี่ยนรอบการแสดงหรือความเร็วการเลื่อน: แก้ที่ `announcement-ticker.jsx`
- เปลี่ยนสี หน้าต่าง mask หรือระยะเลื่อน: แก้ที่ `styles/announcement-ticker.css`

ตรวจสอบเบื้องต้นด้วย `npm run build` ภายใน `frontend/` และทดสอบให้ข้อความเลื่อนจากขวาไปซ้ายในเบราว์เซอร์จริง
