# ตั้งค่า Gemini AI สำหรับ Activity Mode

เอกสารนี้คือสิ่งที่ต้องทำฝั่งผู้ดูแลระบบ เพื่อเปิดใช้ปุ่ม **✨ ร่างด้วย AI** ในหน้าต่างเพิ่มกิจกรรมของ Activity Mode

ระบบใช้โมเดลค่าเริ่มต้น `gemini-2.5-flash-lite` เพื่อแปลงข้อความธรรมดา เช่น

> พรุ่งนี้ประชุมทีม 10 โมง 90 นาที

เป็นร่างกิจกรรมที่มีชื่อ วัน เวลา หมวดหมู่ และโน้ต ผู้ใช้ยังต้องตรวจสอบและกดบันทึกเองก่อนข้อมูลจะถูกส่งเข้า Google Calendar

## 1. เปิดใช้ Vertex AI

ระบบนี้ใช้ **Vertex AI Gemini API** ผ่าน service account ของ backend จึงไม่ต้องสร้างหรือเก็บ `GEMINI_API_KEY`

## 2. ตั้งค่าเครื่อง Local

เปิดไฟล์ `backend/.env` แล้วตรวจว่ามี service account หนึ่งวิธี และเพิ่มค่าด้านล่าง:

```ini
FIREBASE_PROJECT_ID=times-the-calendar
GOOGLE_APPLICATION_CREDENTIALS=secrets/times-the-calendar-service-account.json
GOOGLE_CLOUD_PROJECT=times-the-calendar
GOOGLE_CLOUD_LOCATION=global
```

`GOOGLE_APPLICATION_CREDENTIALS` ใช้เฉพาะ local และต้องเป็น path ไปยังไฟล์ service account JSON จริงที่ไม่ถูก commit ลง Git

ตัวเลือกนี้ไม่จำเป็น เพราะโค้ดตั้งค่าโมเดลเริ่มต้นไว้แล้ว:

```ini
GEMINI_MODEL=gemini-2.5-flash-lite
```

จากนั้นหยุดและเปิด backend ใหม่:

```powershell
cd C:\Users\newwi\Desktop\a-times-the-calendar-main\backend
npm run dev
```

และเปิด frontend ตามปกติ:

```powershell
cd C:\Users\newwi\Desktop\a-times-the-calendar-main\frontend
npm run dev
```

## 3. ทดสอบใน localhost

1. เข้าสู่ระบบ
2. เปิด Activity Mode
3. กด **+ เพิ่มกิจกรรม**
4. กดปุ่ม **✨ ร่างด้วย AI**
5. ลองพิมพ์ข้อความ เช่น `พรุ่งนี้อ่านหนังสือ 19:00 ถึง 20:30`
6. ตรวจสอบชื่อ วัน เวลา หมวดหมู่ และโน้ตที่ AI เติมให้
7. กดบันทึกเองเมื่อข้อมูลถูกต้อง

หาก service account ไม่มีสิทธิ์ Vertex AI ระบบจะตอบ error จาก Vertex AI ซึ่งต้องแก้ตามหัวข้อถัดไป

## 4. ตั้งค่า Render ก่อน deploy

เมื่อทดสอบ local ผ่านแล้ว ให้เปิด Render service ของ backend แล้วตรวจ/เพิ่ม Environment Variables:

```ini
GOOGLE_APPLICATION_CREDENTIALS_JSON={เนื้อหา service-account JSON ทั้งก้อน}
GOOGLE_CLOUD_PROJECT=times-the-calendar
GOOGLE_CLOUD_LOCATION=global
```

หากไม่เพิ่ม `GEMINI_MODEL` ระบบจะเลือก `gemini-2.5-flash-lite` เอง ห้ามใช้ `GOOGLE_APPLICATION_CREDENTIALS` แบบ path บน Render เพราะไม่มีไฟล์ secret ถาวรอยู่บนเครื่อง Render

บันทึกค่า แล้ว deploy backend เวอร์ชันที่มีไฟล์ route AI นี้ หลัง deploy รอ Render ขึ้นสถานะ Live ก่อนจึงทดสอบบนเว็บ public

## ข้อจำกัดของรุ่นทดลองนี้

- สร้างได้ครั้งละ 1 กิจกรรม
- ไม่บันทึก Google Calendar เอง
- จำกัดการเรียก AI ที่ 20 ครั้งต่อ 15 นาทีต่อ IP
- AI อาจตีความวันหรือเวลาไม่ตรงเจตนา จึงต้องให้ผู้ใช้ตรวจฟอร์มก่อนบันทึกทุกครั้ง
- ค่าใช้จ่ายขึ้นอยู่กับโควตาและราคา Gemini บน Google Cloud

## 5. สิทธิ์ Google Cloud ที่ต้องมีครั้งเดียว

1. เปิด **Vertex AI API** ใน Google Cloud project `times-the-calendar`
2. ไปที่ **IAM** แล้วหา service account ตัวเดียวกับใน JSON
3. เพิ่ม role: **Vertex AI User** (`roles/aiplatform.user`)
4. ตรวจว่า billing ของ project เปิดใช้งานอยู่แล้ว

หาก API ยังปิดหรือ role ไม่พอ ระบบจะตอบข้อความ 403/404 จาก Vertex AI; ไม่ใช่ปัญหาของหน้าเว็บ

## ไฟล์ที่ระบบเพิ่ม

- `backend/routes/ai-activity-draft.js` — เรียก Gemini และคืนเฉพาะ JSON ร่างกิจกรรม
- `backend/index.js` — เปิด endpoint `POST /api/ai/activity-draft` พร้อม rate limit
- `frontend/src/components/activity-modal.jsx` — ปุ่มและการนำร่างไปเติมฟอร์ม
