# Gemini: developer-only preview

28 กันยายน 2026 — ยังไม่เปิด Gemini ให้ผู้ใช้ทั่วไป

ตั้ง `GEMINI_CHAT_DEVELOPER_UIDS` เป็น Firebase Authentication UID ของนักพัฒนาที่อนุญาต (คั่นด้วย comma) ใน backend/.env สำหรับ local และ Render Environment สำหรับ production แล้ว restart/deploy backend ค่านี้อยู่ฝั่งเซิร์ฟเวอร์ ห้ามใช้ email, Telegram chat ID หรือ client-supplied role แทน

`GEMINI_CHAT_ENABLED=false` ปิด Gemini ให้ทุกบัญชี แม้เป็นนักพัฒนา หากรายชื่อ developer ว่าง ทุกบัญชีจะถูกปิดสิทธิ์โดยอัตโนมัติ ค่า `GEMINI_CHAT_ALLOWED_UIDS` และ `GEMINI_CHAT_ALLOW_LOCAL_DEVELOPMENT` เก่าไม่มีผลแล้ว นักพัฒนายังคงมีโควต้าและข้อจำกัดของระบบ

ผู้ใช้ทั่วไปยังใช้ FAQ, คำถาม Calendar ที่ระบบตอบเอง, การสร้างกิจกรรมผ่านตัวเลือก และข้อความที่ระบุชื่อ/วัน/เวลา/ระยะเวลาครบได้ โดยไม่เรียก Gemini การเติมข้อมูลในร่างผ่าน AI ก็ถูกปิดสำหรับผู้ใช้ทั่วไปด้วย

หน้าเว็บซ่อนกล่องคำถาม AI สีม่วงและแถบโควต้า และใช้ปุ่ม “ส่ง” สำหรับผู้ใช้ทั่วไป การขอให้ AI วิเคราะห์ผ่าน API โดยตรงจะได้ 403 / AI_DEVELOPER_ONLY โดยไม่อ่านข้อมูล Calendar สำหรับ AI หรือใช้โควต้า

การกลับมาเปิดสาธารณะต้องเปลี่ยนนโยบายสิทธิ์โดยตั้งใจ พร้อมทดสอบคุณภาพและโควต้าใหม่ ไม่ใช่เพิ่มคนทั่วไปใน developer UID list

สำหรับ OAuth demo ให้สาธิต Calendar ด้วยคำถามสำเร็จรูปและ Activity Mode ตามปกติ การสาธิต AI ใช้ได้เฉพาะบัญชีนักพัฒนาและต้องระบุว่าเป็น developer preview อย่าอ้างว่าผู้ใช้ทั่วไปใช้ได้แล้ว Privacy Policy ยังอธิบายการส่งข้อมูลไป Vertex AI เพราะยังมีการใช้งานจริงโดยนักพัฒนา
