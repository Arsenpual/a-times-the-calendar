# Gemini: developer-only preview

## Gemini Developer API — อัปเดต 30 กันยายน 2026

Backend ใช้ `generativelanguage.googleapis.com` แทน Vertex AI แล้ว สร้าง key ที่ https://aistudio.google.com/api-keys และเลือก project ที่ AI Studio แสดง Free Tier จากนั้นตั้งค่าทั้ง backend/.env และ Render Environment:

```env
GEMINI_API_KEY=ใส่_key_เฉพาะใน_environment
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_CHAT_ENABLED=true
GEMINI_CHAT_DEVELOPER_UIDS=Firebase_UID_นักพัฒนา
```

Restart local backend และ deploy backend ใหม่หลังตั้งค่า อย่าส่ง key ในแชทหรือใส่ตัวแปร VITE_ คง credential Firebase เดิมไว้ เพราะ Firestore ยังใช้ การเลือก Free Tier/โควต้าจริงขึ้นกับ project ใน AI Studio; โค้ดไม่ได้รับประกันว่า key จาก project ที่เปิด Billing จะใช้งานฟรี

Free Tier มีข้อกำหนดการใช้ข้อมูลต่างจาก Vertex AI: Google อาจนำ input/output ไปพัฒนาบริการและให้ผู้ตรวจสอบอ่าน ใช้ข้อมูลกิจกรรมจำลองในการทดลอง อย่าส่งข้อมูลส่วนตัวหรือความลับ ดู https://ai.google.dev/gemini-api/terms

ยังต้องใส่ key และทดสอบจริงจึงจะยืนยันการเชื่อมต่อได้ การทดสอบอัตโนมัติใช้ mock และไม่เรียกบัญชี Google จริง

28 กันยายน 2026 — ยังไม่เปิด Gemini ให้ผู้ใช้ทั่วไป

ตั้ง `GEMINI_CHAT_DEVELOPER_UIDS` เป็น Firebase Authentication UID ของนักพัฒนาที่อนุญาต (คั่นด้วย comma) ใน backend/.env สำหรับ local และ Render Environment สำหรับ production แล้ว restart/deploy backend ค่านี้อยู่ฝั่งเซิร์ฟเวอร์ ห้ามใช้ email, Telegram chat ID หรือ client-supplied role แทน

`GEMINI_CHAT_ENABLED=false` ปิด Gemini ให้ทุกบัญชี แม้เป็นนักพัฒนา หากรายชื่อ developer ว่าง ทุกบัญชีจะถูกปิดสิทธิ์โดยอัตโนมัติ ค่า `GEMINI_CHAT_ALLOWED_UIDS` และ `GEMINI_CHAT_ALLOW_LOCAL_DEVELOPMENT` เก่าไม่มีผลแล้ว นักพัฒนายังคงมีโควต้าและข้อจำกัดของระบบ

ผู้ใช้ทั่วไปยังใช้ FAQ, คำถาม Calendar ที่ระบบตอบเอง, การสร้างกิจกรรมผ่านตัวเลือก และข้อความที่ระบุชื่อ/วัน/เวลา/ระยะเวลาครบได้ โดยไม่เรียก Gemini การเติมข้อมูลในร่างผ่าน AI ก็ถูกปิดสำหรับผู้ใช้ทั่วไปด้วย

หน้าเว็บซ่อนกล่องคำถาม AI สีม่วงและแถบโควต้า และใช้ปุ่ม “ส่ง” สำหรับผู้ใช้ทั่วไป การขอให้ AI วิเคราะห์ผ่าน API โดยตรงจะได้ 403 / AI_DEVELOPER_ONLY โดยไม่อ่านข้อมูล Calendar สำหรับ AI หรือใช้โควต้า

การกลับมาเปิดสาธารณะต้องเปลี่ยนนโยบายสิทธิ์โดยตั้งใจ พร้อมทดสอบคุณภาพและโควต้าใหม่ ไม่ใช่เพิ่มคนทั่วไปใน developer UID list

สำหรับ OAuth demo ให้สาธิต Calendar ด้วยคำถามสำเร็จรูปและ Activity Mode ตามปกติ การสาธิต AI ใช้ได้เฉพาะบัญชีนักพัฒนาและต้องระบุว่าเป็น developer preview อย่าอ้างว่าผู้ใช้ทั่วไปใช้ได้แล้ว ปัจจุบัน AI ใช้ Gemini Developer API
