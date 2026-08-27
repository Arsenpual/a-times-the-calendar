# Google Calendar Refresh Token setup

ระบบนี้ทำให้ backend ต่ออายุ Google Calendar access token เอง และเก็บ
refresh token แยกตาม Firebase UID ที่ `users/{uid}/private/calendarAuth`.
ค่า token ถูกเข้ารหัส AES-256-GCM ก่อนเขียนลง Firestore และ API จะไม่ส่ง
refresh token กลับ browser ไม่ว่ากรณีใด.

## ตั้งค่า Google Cloud OAuth

1. Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → **Web application**
2. เพิ่ม Authorized redirect URI:

   `https://times-the-calendar-backend.onrender.com/oauth/google/calendar/callback`

3. เปิด Google Calendar API ในโปรเจกต์ OAuth เดียวกัน

## ตั้งค่า Render Environment

ตั้งค่าตาม `backend/.env.example`:

- `FRONTEND_URL=https://arsenpual.github.io/a-times-the-calendar/`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `CALENDAR_TOKEN_ENCRYPTION_KEY` — base64 random 32 bytes
- `GOOGLE_OAUTH_STATE_SECRET` — random secret สำหรับตรวจ OAuth callback state

หลัง deploy ผู้ใช้ต้องกด “เชื่อมต่อ/ยืนยันตัวตน Google Calendar” หนึ่งครั้ง
เพื่อให้ Google ส่ง refresh token แก่ backend. หลังจากนั้นระบบจะต่ออายุ
access token เฉพาะบน server; browser จะไม่มี refresh token หรือ access token
ของ Calendar ถูกเก็บไว้ใน localStorage.

## การเพิกถอนสิทธิ์

เมื่อ refresh token ใช้ไม่ได้ backend เปลี่ยนสถานะเป็น `needs_reauth` และ
ตอบ HTTP 428 พร้อม code `CALENDAR_REAUTH_REQUIRED`; frontend จะพาผู้ใช้ไป
เริ่ม OAuth ใหม่. สถานะของผู้ใช้อื่นไม่กระทบ.
