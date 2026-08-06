# คู่มือ Deploy — times-the-calendar (เปิดใช้จริงแบบจำกัดกลุ่ม)

สถาปัตยกรรม: **Frontend → GitHub Pages** (static hosting) + **Backend → Render.com** (Express server ต้องรันตลอดเวลา, GitHub Pages ทำไม่ได้)

> ก่อนเริ่ม: เอกสารนี้สมมติว่าระยะ 0-2 ของ `firebase-migration-plan.md` เสร็จแล้ว (Firebase project + Firestore + Auth พร้อมใช้งาน) ถ้ายังไม่เสร็จให้กลับไปทำตามนั้นก่อน

---

## ขั้นตอนที่ 1 — เตรียม repo

1. Push โค้ดทั้งหมด (frontend + backend) ขึ้น GitHub repo เดียว (public หรือ private ก็ได้ — Render/Pages เชื่อม private repo ได้ทั้งคู่)
2. คัดลอกไฟล์ต่อไปนี้เข้าตำแหน่งที่ระบุ (ผมเตรียมไว้ให้แล้ว ดูท้ายข้อความ):
   - `render.yaml` → root ของ repo
   - `.github/workflows/deploy-frontend.yml` → ตามชื่อ path เป๊ะ (GitHub อ่าน workflow จาก path นี้เท่านั้น)
   - `backend/.env.example` → ทับของเดิม (เพิ่ม `GOOGLE_APPLICATION_CREDENTIALS_JSON`/`FRONTEND_URL`)
   - `backend/index.js`, `backend/firestore-db.js` → ทับของเดิม (แก้ CORS + credential loading)
   - `frontend/vite.config.js` → ทับของเดิม (เพิ่ม `base` path)

---

## ขั้นตอนที่ 2 — Deploy Backend บน Render.com

1. ไปที่ [render.com](https://render.com) สมัคร/login ด้วย GitHub
2. **New → Blueprint** → เลือก repo นี้ — Render จะอ่าน `render.yaml` แล้วสร้าง service ให้อัตโนมัติ
3. หลังสร้างเสร็จ ไปที่ service → **Environment** แล้วเติมค่าที่ `render.yaml` จงใจเว้นว่างไว้ (`sync: false`):
   - `FIREBASE_PROJECT_ID` — ชื่อ project เดียวกับที่ backend ใช้ตอน dev
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON` — เปิดไฟล์ `backend/secrets/*.json` ในเครื่อง **คัดลอกเนื้อหาทั้งไฟล์** มาวางเป็นค่าเดียว (ไม่ต้องแก้ format ใดๆ — วางทั้งก้อน `{...}`)
   - `FRONTEND_URL` — ใส่ URL ของ GitHub Pages ที่จะได้ในขั้นตอนที่ 3 (รูปแบบ `https://<username>.github.io/<repo-name>`) — ถ้ายังไม่รู้ตอนนี้ ใส่ไปก่อนแบบเดาได้ แล้วย้อนมาแก้ทีหลังได้เสมอ
4. กด **Manual Deploy** เพื่อ deploy ครั้งแรก รอจนสถานะเป็น "Live"
5. จด URL ของ backend ไว้ (รูปแบบ `https://times-the-calendar-backend.onrender.com`) — ต้องใช้ในขั้นตอนถัดไป

> **ข้อจำกัดของ Render free tier**: service จะ "หลับ" หลังไม่มี request เข้ามา ~15 นาที แล้วตื่นช้า (10-30 วินาที) ตอนมี request แรกเข้ามาใหม่ — เหมาะกับกลุ่มผู้ใช้จำกัดที่ไม่ได้ใช้ตลอดเวลา ถ้ากลุ่มผู้ใช้ใหญ่ขึ้นหรือต้องการ response เร็วสม่ำเสมอ ค่อยอัปเกรดเป็น paid plan ทีหลังได้

---

## ขั้นตอนที่ 3 — เตรียม GitHub Pages

1. ไปที่ repo → **Settings → Pages** → ตั้ง Source เป็น **GitHub Actions** (ไม่ใช่ "Deploy from a branch")
2. ไปที่ **Settings → Secrets and variables → Actions** เพิ่ม secrets ต่อไปนี้ (ค่ามาจาก `frontend/.env` เดิมที่ใช้ตอน dev):
   - `VITE_API_BASE_URL` — ใส่ URL backend จาก Render (ขั้นตอนที่ 2 ข้อ 5) เช่น `https://times-the-calendar-backend.onrender.com`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. Push ขึ้น `main` (หรือกด **Run workflow** เองจากแท็บ Actions) — workflow จะ build แล้ว deploy อัตโนมัติ
4. รอ 2-3 นาที เช็ค URL ที่ได้ใน **Settings → Pages** (รูปแบบ `https://<username>.github.io/<repo-name>/`)

---

## ขั้นตอนที่ 4 — อัปเดต Google Cloud OAuth (สำคัญมาก — พลาดจุดนี้แล้ว login ไม่ได้)

Firebase Auth popup ใช้ Google OAuth เบื้องหลัง ต้องบอก Google ว่าโดเมนไหน "เชื่อถือได้" ก่อน ไม่งั้น login จะ error ทันที:

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) → เลือก Firebase project เดียวกัน
2. **APIs & Services → Credentials** → เปิด OAuth 2.0 Client ID ที่ Firebase สร้างให้อัตโนมัติ
3. เพิ่มใน **Authorized JavaScript origins**: `https://<username>.github.io` (ไม่ต้องมี path ต่อท้าย ไม่ต้องมี `/` ปิดท้าย)
4. ถ้าแอปยังอยู่ในโหมด **Testing** (ไม่ได้ publish OAuth consent screen) — ไปที่ **OAuth consent screen → Test users** เพิ่มอีเมล Google ของทุกคนในกลุ่มที่จะให้ใช้แอป (จำกัดแค่คนที่เพิ่มไว้เท่านั้นที่ login ได้ — ตรงกับโจทย์ "เปิดจำกัด" พอดี)

---

## ขั้นตอนที่ 5 — Deploy Firestore Security Rules (ระยะ 3 ที่เตรียมไว้ก่อนหน้า)

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

(ควรรัน `firestore-rules.test.js` ผ่าน Emulator ให้ผ่านหมดก่อน ตามที่ระบุใน `firebase-migration-plan.md` ระยะ 3)

---

## ขั้นตอนที่ 6 — ทดสอบจริง

1. เปิด URL จาก GitHub Pages ด้วยบัญชี Google ที่เพิ่มใน Test users แล้ว
2. Login → ควรเห็น popup ขอสิทธิ์ Google + Calendar โดยไม่มี error
3. ลองสร้าง/แก้ไข/ลบกิจกรรม, ตั้งหมวดหมู่, ตั้ง tag — ยืนยันว่า backend บน Render ตอบกลับได้ (ถ้าเพิ่ง deploy ครั้งแรกและ Render กำลัง "หลับ" การเรียกครั้งแรกอาจช้า 10-30 วิ ตามที่อธิบายไว้ในขั้นตอนที่ 2)
4. เปิด browser console เช็คว่าไม่มี CORS error (ถ้ามี แปลว่า `FRONTEND_URL` บน Render ตั้งไม่ตรงกับโดเมน Pages จริง — กลับไปแก้ที่ Render Dashboard → Environment)

---

## สรุปสิ่งที่ต้องทำเอง (ไม่มีทางอัตโนมัติได้)

- [ ] สร้าง Render service + เติม 3 environment variables
- [ ] เพิ่ม 7 GitHub Actions secrets
- [ ] เพิ่มโดเมน GitHub Pages ใน Google Cloud OAuth authorized origins
- [ ] เพิ่มอีเมลผู้ใช้กลุ่มจำกัดใน OAuth Test users
- [ ] Deploy Firestore Security Rules
- [ ] ทดสอบ end-to-end ด้วยบัญชีจริงอย่างน้อย 1 ครั้งก่อนแจกลิงก์ให้กลุ่ม
