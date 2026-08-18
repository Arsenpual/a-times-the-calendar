# Backend Documentation (`backend.md`)

> เอกสารนี้อธิบายฝั่ง Backend ของ TIMES THE CALENDAR ตามสภาพโค้ดจริง ณ ปัจจุบัน (ไม่ใช่แผนหรือ spec) — ปรับปรุงจากฉบับก่อนหน้าที่มีจุดไม่ตรงกับโค้ดแล้วหลายจุด (ดูหัวข้อ 9)

---

## 1. ภาพรวมระบบและสถาปัตยกรรม

ระบบฝั่ง Backend พัฒนาด้วย **Node.js + Express** แบบ RESTful API ทำหน้าที่จัดการ**ข้อมูลเสริม**ของกิจกรรม (metadata) — หมวดหมู่ชีวิต (life-area category), tag, การล็อกกิจกรรม, และคำนวณสรุปสถิติรายสัปดาห์ **ไม่ได้เก็บตัวกิจกรรมเอง** (ชื่อ, เวลา, การทำซ้ำ) เพราะนั่นอยู่ที่ Google Calendar โดยตรง ฝั่ง frontend คุยกับ Google Calendar API ตรงๆ แยกออกไปเลย (ดู `frontend.md` หัวข้อ 5)

สถาปัตยกรรมเป็น **multi-tenant แบบ per-user subcollection** บน Google Cloud Firestore ร่วมกับ Firebase Authentication — ข้อมูลของแต่ละผู้ใช้แยกกันเด็ดขาดใต้ path `users/{userId}/...`

```
[ Frontend (Vite/React) ]
         |
         |  Authorization: Bearer <Firebase ID token>
         v
[ requireAuth middleware ] <---> [ Firebase Admin SDK: auth.verifyIdToken() ]
         |
         |  req.userId = decoded.uid
         |  (+ เรียก ensureDefaultCategoriesForUser ทุก request ที่ token ผ่าน)
         v
   +-----+------+------+
   |            |            |
[ categories ] [ activity-  ] [ summary ]
[   router   ] [ categories ] [ router  ]
                [   router   ]
   |            |            |
   +-----+------+------+
         v
[ firestore-db.js ]  ← จุดเดียวที่คุยกับ Firestore SDK ตรงๆ
         v
Firestore:
  users/{userId}/
    ├── categories/{categoryId}
    ├── activityCategories/{normalizedActivityId}
    ├── activityTags/{normalizedActivityId}
    └── lockedActivities/{normalizedActivityId}
```

**หมายเหตุสำคัญที่เอกสารฉบับก่อนไม่ได้พูดถึง**: โปรเจกต์นี้อยู่ระหว่างการย้ายระบบเป็นเฟส (ดู `firebase-migration-plan.md`) — โค้ดปัจจุบันเป็น **"Phase 2" (Firebase Authentication)** แล้ว แต่ยังมีไฟล์จาก Phase ก่อนหน้าเหลืออยู่ในโฟลเดอร์แบบ deprecated (ดูหัวข้อ 7) ไม่ใช่โค้ดที่ทำงานจริงในระบบปัจจุบัน — สำคัญมากเวลาอ่านโค้ดในโฟลเดอร์นี้ไม่ให้สับสนว่าไฟล์ไหนยังทำงานอยู่

---

## 2. เครื่องมือและเทคโนโลยีที่ใช้

- **Runtime**: Node.js
- **Web Framework**: Express (`express.json()`, `cors` — ไม่มี middleware เสริมอื่นอย่าง helmet/morgan)
- **Database & Auth**: Firebase Admin SDK — **modular API** (แยก import จาก `firebase-admin/app`, `firebase-admin/firestore`, `firebase-admin/auth` คนละ submodule) ไม่ใช่ `require("firebase-admin")` แบบ namespace เดียวที่ Admin SDK รุ่นก่อน v12 ใช้ — สำคัญเวลาแก้/เพิ่มโค้ดใหม่ ต้อง import ให้ตรงรูปแบบนี้เสมอ
- **Testing**: `@firebase/rules-unit-testing` + `mocha` — ทดสอบ **เฉพาะ Firestore Security Rules** ผ่าน Firebase Emulator (ไม่มี unit test ของ route handler เอง)
- **Environment**: `dotenv`

---

## 3. โครงสร้างฐานข้อมูล (Firestore — ระบบปัจจุบัน)

```
users/
  └── {userId}/
       ├── categories/{categoryId}
       │     ├── name: string
       │     └── color: string  (hex 6 หลัก เช่น "#1557B0" — บังคับด้วย regex ที่ route)
       │
       ├── activityCategories/{normalizedActivityId}
       │     └── categoryId: string
       │
       ├── activityTags/{normalizedActivityId}
       │     └── tags: string[]        (ไม่มี document นี้เลยถ้ากิจกรรมนั้นไม่มี tag — ดูหัวข้อ 5.3)
       │
       └── lockedActivities/{normalizedActivityId}
             └── locked: true          (มีเฉพาะกิจกรรมที่ล็อกอยู่เท่านั้น — ปลดล็อกคือลบ document ทิ้ง ไม่ใช่ set locked: false)
```

**หมายเหตุ — field ที่เอกสารฉบับก่อนระบุแต่ไม่มีในโค้ดจริง**: เอกสารเดิมระบุว่าทุก collection มี `updatedAt`/`createdAt`/`isAuto` timestamp — **โค้ดปัจจุบันไม่ได้เขียน field พวกนี้เลยสักที่เดียว** (`categoriesCol().doc(id).set({ name, color })`, `activityCategoriesCol().doc(id).set({ categoryId })` ฯลฯ ไม่มี timestamp field ผสมเข้าไปเลย) ถ้าต้องการ audit trail ต้องเพิ่มเข้าไปเองในอนาคต ไม่ใช่ของที่มีอยู่แล้ว

### กฎการจัดการข้อมูลสำคัญ

**1. Normalize activity id ก่อน read/write เสมอ** — Google Calendar ส่ง instance id ของ recurring event มาในรูป `<baseId>_<YYYYMMDDTHHmmssZ>` (เช่น `abc123_20260801T040000Z`) เมื่อ frontend เรียกด้วย `singleEvents=true` แต่ base event id จริงคือ `abc123` เท่านั้น ทุก route ที่แตะ `activityCategories`/`activityTags`/`lockedActivities` ต้อง strip suffix นี้ก่อนเสมอ (ฟังก์ชัน `normalizeId` — **implement แยกกัน 2 ที่** ใน `routes/activity-categories.js` และ `routes/summary.js` เป็น regex เดียวกันเป๊ะ `/_\d{8}T\d{6}Z$/` แต่ **ไม่ได้ share เป็น utility กลาง** ต่างจากฝั่ง frontend ที่รวมไว้ที่ `id-utils.js` ไฟล์เดียว — ถ้าต้องแก้ pattern นี้ในอนาคตต้องแก้ให้ตรงกันทั้ง 2 จุดฝั่ง backend เอง)

**2. Seed หมวดหมู่เริ่มต้นต่อ user** — เมื่อ `categories` subcollection ของ user ว่างเปล่า (เช็คด้วย `.limit(1).get()`) จะใส่ 4 หมวดให้อัตโนมัติ: **Work** (`#1557B0`), **Personal** (`#B71C1C`), **Health** (`#F29900`), **Family** (`#0B6B33`) — **สีต่างจากที่เอกสารฉบับก่อนระบุ** (เอกสารเดิมให้ Personal เป็น `#137333`, Health เป็น `#C5221F`, Family เป็น `#B06000` — ไม่ตรงกับ `DEFAULT_CATEGORIES` ในโค้ดจริงเลยสักสี) การ seed นี้เรียกจาก `requireAuth` middleware **ทุก request** ที่ token ผ่านการยืนยัน ไม่ใช่แค่ "ตอนยืนยันตัวตนครั้งแรก" อย่างที่ฟังดูจากเอกสารเดิม — ฟังก์ชันเช็คเองว่า collection ว่างหรือไม่ก่อนเขียน จึงเรียกซ้ำได้ทุก request โดยไม่มีผลข้างเคียงถ้าเคย seed ไปแล้ว (เลือกออกแบบแบบนี้เพราะ middleware เองไม่มีทางรู้ว่าเป็น request แรกของ user คนนั้นจริงๆ หรือเปล่า)

---

## 4. ระบบ Middleware และความปลอดภัย

### `requireAuth` (`middleware/require-auth.js`)

1. อ่าน header `Authorization: Bearer <idToken>` — ถ้า scheme ไม่ใช่ `Bearer` หรือไม่มี token เลย ตอบ `401` ทันที
2. ตรวจสอบด้วย `admin.auth().verifyIdToken(idToken)` (Firebase Admin SDK) — ครอบคลุมทุกกรณี (หมดอายุ, ลายเซ็นผิด, project id ไม่ตรง) ด้วยข้อความ 401 **เดียวกันหมด ไม่แยกเหตุผลให้ client เห็น** ตั้งใจไม่บอกรายละเอียดเพื่อไม่ให้เป็นข้อมูลช่วย brute-force
3. ผ่านแล้ว → แนบ `req.userId = decoded.uid` ให้ route handler ทุกตัวใช้ scope query
4. เรียก `ensureDefaultCategoriesForUser(req.userId)` แบบ **fire แล้ว catch เอง** — ถ้า seed ล้มเหลว (เช่น Firestore มีปัญหาชั่วคราว) **ไม่ block request** แค่ log error แล้วปล่อยผ่านต่อ (ผลคือ endpoint ที่เรียกอยู่จะเห็นแค่ collection ว่างเปล่า ไม่ crash)

**Token สำคัญ**: `idToken` ที่ตรวจในนี้คือ **Firebase ID token** — คนละตัวกับ Google OAuth access token ที่ frontend ใช้เรียก Google Calendar API ตรงๆ (ดู `frontend.md` หัวข้อ 6) `requireAuth` middleware นี้ไม่เกี่ยวกับ/ไม่ตรวจ Google Calendar token เลย

`/api/health` เป็น endpoint เดียวที่**ไม่ผ่าน** middleware นี้

---

## 5. ตารางเส้นทาง API

### 5.1 ระบบทั่วไป

| Endpoint | Method | ยืนยันตัวตน | รายละเอียด |
|---|---|---|---|
| `/api/health` | GET | ไม่ต้อง | Health check — ตอบ `{ ok: true }` เฉยๆ |

### 5.2 หมวดหมู่ (`/api/categories`) — `routes/categories.js`

| Endpoint | Method | รายละเอียด |
|---|---|---|
| `/api/categories` | GET | คืน array ของหมวดหมู่ทั้งหมดของ user (`{ id, name, color }[]`) |
| `/api/categories` | POST | สร้างหมวดหมู่ใหม่ — body `{ name, color }` ทั้งคู่บังคับ, `color` ต้องผ่าน regex `^#[0-9A-Fa-f]{6}$` มิฉะนั้น `400` — id สร้างด้วย `randomUUID()` (ไม่ใช่ auto-id ของ Firestore) |
| `/api/categories/:id` | PUT | แก้ `name`/`color` (ส่งอย่างใดอย่างหนึ่งหรือทั้งคู่ก็ได้ — เฉพาะ field ที่ส่งมาแบบ truthy เท่านั้นที่ถูกอัปเดต) ไม่พบหมวดหมู่ → `404` |
| `/api/categories/:id` | DELETE | ลบหมวดหมู่ **พร้อม batch ลบ `activityCategories` ทุก doc ที่ผูกกับหมวดหมู่นี้ในคราวเดียว** (query `where("categoryId", "==", id)` แล้ว batch delete) ป้องกันไม่ให้เหลือ mapping ชี้ไปหมวดหมู่ที่ไม่มีอยู่แล้ว — ตอบ `204 No Content` |

**เหตุผลที่บังคับ hex color 6 หลัก**: frontend เอาค่า `color` ไปต่อ string ตรงๆ ทำ alpha-tint (`${color}33`) ถ้า format ผิดจะได้ CSS color ที่ invalid แล้ว browser เงียบๆ ไม่แสดงสีเลยโดยไม่มี error — backend เลยเช็คตั้งแต่ทางเข้าแทนที่จะปล่อยให้พังแบบเงียบๆ ที่ฝั่ง UI

### 5.3 กิจกรรม (`/api/activities`) — `routes/activity-categories.js`

ชื่อไฟล์ (`activity-categories.js`) ครอบคลุมทั้ง category mapping, tags, และ locks ของกิจกรรม ไม่ได้จำกัดแค่ category ตามชื่อไฟล์เพียงอย่างเดียว

| Endpoint | Method | รายละเอียด |
|---|---|---|
| `/api/activities/categories` | GET | mapping ทั้งหมด `{ [normalizedActivityId]: categoryId }` — ดึงครั้งเดียวตอน frontend โหลดสัปดาห์ แทนยิงทีละกิจกรรม |
| `/api/activities/:activityId/category` | GET | ดูหมวดหมู่ของกิจกรรมเดียว — คืน `{ activityId, categoryId }` (`categoryId: null` ถ้าไม่มี) |
| `/api/activities/:activityId/category` | PUT | ผูก/ยกเลิกหมวดหมู่ — body `{ categoryId }`. ถ้า `categoryId !== null` เช็คก่อนว่าหมวดหมู่นั้นมีอยู่จริง (`400` ถ้าไม่มี) แล้ว `.set()`; ถ้า `categoryId === null` **ลบ document ทิ้ง** (ไม่ใช่ set เป็น null) |
| `/api/activities/tags` | GET | mapping ทั้งหมด `{ [normalizedActivityId]: string[] }` |
| `/api/activities/:activityId/tags` | PUT | แทนที่ tag ทั้งชุดของกิจกรรมนั้น — body `{ tags: string[] }`. ตรวจสอบผ่าน `sanitizeTags()`: แต่ละ tag ต้อง trim แล้วไม่ว่าง, ยาวไม่เกิน 40 ตัวอักษร, ทั้งชุดไม่เกิน 20 tag, กันซ้ำแบบ case-insensitive (เก็บรูปตัวพิมพ์ที่พิมพ์ครั้งแรกไว้) ผิดเงื่อนไขใดก็ตาม → `400` ทั้งก้อน ไม่ partial-save ถ้า `tags` ว่าง (`[]`) → **ลบ document ทิ้ง** แทนเก็บ array ว่างค้างไว้ |
| `/api/activities/locks` | GET | สถานะล็อกทั้งหมด `{ [normalizedActivityId]: true }` — มีเฉพาะกิจกรรมที่ล็อกอยู่เท่านั้นใน response (ไม่มี `false` ปนอยู่) |
| `/api/activities/:activityId/lock` | PUT | ตั้ง/ปลดล็อก — body `{ locked: boolean }`. `locked: true` → `.set({ locked: true })`, `locked: false` → **ลบ document ทิ้ง** (ไม่ใช่ set `locked: false`) — สอดคล้องกับที่ security rules ทดสอบไว้ (ดูหัวข้อ 6)

**หมายเหตุจากเอกสารฉบับก่อน**: เอกสารเดิมระบุ endpoint เป็น `/api/activities/:activityId/category` และ `/api/activities/tags`/`/api/activities/locks` แบบ `PUT` รวมๆ ไม่มี `:activityId` ในเส้นทาง ซึ่ง**ไม่ตรงกับโค้ดจริง** — endpoint แก้ tag/lock ทีละกิจกรรมจริงๆ คือ `PUT /api/activities/:activityId/tags` และ `PUT /api/activities/:activityId/lock` (มี `:activityId` เสมอ เพราะเป็นการแก้ของกิจกรรมเดียว ไม่ใช่ batch update ทั้งชุด)

### 5.4 สรุปผล (`/api/summary`) — `routes/summary.js`

| Endpoint | Method | รายละเอียด |
|---|---|---|
| `/api/summary/week` | POST | รับ body `{ activities: [{ id, summary, start: ISOString, end: ISOString }] }` (ที่ frontend ดึงมาจาก Google Calendar อยู่แล้ว) แล้วคำนวณสรุปกลับไป — ดูหัวข้อ 5.5 |

`activities` ไม่ใช่ array → `400`

### 5.5 กลไกการคำนวณ `/api/summary/week` (ไม่ได้อยู่ในเอกสารฉบับก่อนเลย)

1. โหลด `categories` ทั้งหมดของ user มาไว้ล่วงหน้าใน memory (จำนวนน้อย อ่านรวดเดียวคุ้มกว่า query ทีละ id)
2. **Batch-fetch เฉพาะ `activityCategories` ของกิจกรรมในสัปดาห์นี้เท่านั้น** ด้วย `db.getAll(...refs)` (ยิง request เดียวได้หลาย document พร้อมกัน ต่างจาก `Promise.all` ที่ยิงทีละ request แยก) — ไม่โหลดทั้ง collection เหมือนตอนยังใช้ `db.json` (ตอนนั้นทั้งไฟล์อยู่ใน memory อยู่แล้วเลยโหลดทั้งก้อนได้ฟรี แต่ Firestore ไม่ใช่แบบนั้น)
3. วนแต่ละกิจกรรม: คำนวณ duration เป็นนาที (`Math.max(0, (end-start)/60000) || 30` — **กิจกรรม all-day หรือ zero-length นับเป็น 30 นาทีเสมอ**), สะสมเข้า `minutesByCategory` (key คือ `categoryId` ที่ normalize แล้ว, `null` ถ้าไม่มีหมวดหมู่) และนับจำนวนกิจกรรมต่อวัน (`countByDay`, key เป็นตัวย่อวันภาษาไทย)
4. สร้าง `byCategory` array: percent ของแต่ละหมวด (ปัดเศษเป็นจำนวนเต็ม), เรียงจากมากไปน้อยตามนาที — กิจกรรมไม่มีหมวดหมู่ตกไปอยู่ใต้ `UNCATEGORIZED` (`{ id: null, name: "ไม่ระบุหมวดหมู่", color: "#9AA0A6" }` — **สีนี้ต้องตรงกับ `UNCATEGORIZED_COLOR` ฝั่ง frontend ใน `activity-colors.js` เป๊ะ** มิฉะนั้นกราฟวงกลมกับ agenda view จะแสดงสี "ไม่ระบุหมวดหมู่" ไม่ตรงกัน — ดู `frontend.md` หัวข้อ 4.2)
5. หา `busiestDay` จาก `countByDay` ที่มากที่สุด
6. `buildInsight()` — สร้างข้อความสรุปภาษาไทยอัตโนมัติ: ถ้าหมวดที่มากที่สุด ≥ 40% ของเวลารวม จะพูดถึง, ถ้ามี `busiestDay` จะพูดถึงด้วย, ต่อสองประโยคด้วย " — " ถ้าไม่มีเงื่อนไขไหนเข้าเลยจะบอกจำนวนกิจกรรมรวมเฉยๆ ("กระจายค่อนข้างสมดุล") ไม่มีกิจกรรมเลย → ข้อความคงที่ "สัปดาห์นี้ยังไม่มีกิจกรรม"

---

## 6. Firestore Security Rules (ไม่ได้อยู่ในเอกสารฉบับก่อนเลย)

ไฟล์กฎจริง (`firestore.rules`) ไม่ได้รวมมาตรวจสอบในรอบนี้ — หัวข้อนี้สรุปเฉพาะ**พฤติกรรมที่ยืนยันได้จาก test suite** (`scripts/firestore-rules.test.js`) เท่านั้น ไม่ใช่การอ่านไฟล์ rules ตรงๆ

**วิธีรันเทส** (ผ่าน Firebase Emulator, ไม่แตะ Firestore จริง):
```bash
npm install --save-dev @firebase/rules-unit-testing mocha
firebase emulators:exec --only firestore "mocha backend/scripts/firestore-rules.test.js"
```

**พฤติกรรมที่เทสยืนยันไว้**:
1. **Data isolation**: user อ่าน/เขียนข้อมูลใต้ `users/{ตัวเอง}/...` ได้ปกติ, อ่าน/เขียนข้อมูลใต้ `users/{คนอื่น}/...` **ไม่ได้เลย** แม้จะ login อยู่ก็ตาม
2. **Unauthenticated request** ทำอะไรไม่ได้เลยแม้แต่ read
3. **Lock enforcement (จุดสำคัญที่สุดของ security rules ชุดนี้)**: เขียน/ลบ `activityCategories` ของกิจกรรมที่ยังไม่ล็อก → ผ่านปกติ, แต่ถ้ามี document `lockedActivities/{activityId}` ที่ `locked: true` อยู่ → เขียน**และ**ลบ `activityCategories` ของกิจกรรมนั้น**ถูกปฏิเสธที่ระดับ Firestore เอง** ไม่ใช่แค่ที่ route handler — เท่ากับ lock บังคับจริงสองชั้น (ทั้ง backend logic และ security rules)
4. ปลดล็อก (`.delete()` document ใน `lockedActivities`) ไม่มีเงื่อนไขพิเศษ แค่เป็นเจ้าของข้อมูลก็พอ — ปลดแล้วเขียน `activityCategories` ได้ตามปกติทันที
5. เผื่อกรณี `lockedActivities` document มี `locked: false` (ปัจจุบัน backend ไม่เขียนแบบนี้ — ใช้การลบ document แทนเสมอตามหัวข้อ 5.3 — แต่ rules เผื่อไว้) → **ไม่ถือว่าล็อก**

**นัยสำคัญ**: การล็อกกิจกรรมไม่ได้พึ่งแค่วินัยของ route handler (`routes/activity-categories.js` เช็คแล้วไม่ยอมเขียนถ้าล็อก) — Security Rules เป็นแนวป้องกันชั้นที่สองในระดับฐานข้อมูลเอง ถึงแม้ request จะมาจากช่องทางอื่นที่ไม่ผ่าน backend เลย (เช่น Firestore client SDK ยิงตรงจาก frontend ในอนาคต) lock ก็ยังมีผลบังคับอยู่

---

## 7. โครงสร้างโฟลเดอร์ (ของจริง พร้อมสถานะแต่ละไฟล์)

```
backend/
├── config/
│   └── (ไม่มี firebase-admin.js แยกต่างหาก — init logic รวมอยู่ใน firestore-db.js เอง)
├── middleware/
│   └── require-auth.js         # ✅ ใช้งานจริง — ดูหัวข้อ 4
├── routes/
│   ├── activity-categories.js  # ✅ ใช้งานจริง — ดูหัวข้อ 5.3
│   ├── categories.js           # ✅ ใช้งานจริง — ดูหัวข้อ 5.2
│   └── summary.js              # ✅ ใช้งานจริง — ดูหัวข้อ 5.4-5.5
├── scripts/
│   ├── firestore-rules.test.js # ✅ ใช้งานจริง (เทส) — ดูหัวข้อ 6
├── firestore-db.js             # ✅ ใช้งานจริง — จุดเดียวที่ init + เชื่อมต่อ Firestore/Auth Admin SDK, export collection ref functions
├── firestore.rules             # ✅ ใช้งานจริง — ไม่ได้รวมมาตรวจสอบรอบนี้ (ดูหัวข้อ 6)
├── index.js                    # ✅ ใช้งานจริง — entry point (ชื่อไฟล์จริงคือ index.js ไม่ใช่ server.js ตามที่เอกสารฉบับก่อนระบุ)
└── package.json
```

**หมายเหตุจากเอกสารฉบับก่อน**:
- เอกสารเดิมระบุ entry point เป็น `server.js` และมี `config/firebase-admin.js` แยกไฟล์ — **โค้ดจริงไม่มีทั้งสองอย่างนี้**: entry point ชื่อ `index.js`, ส่วน Firebase Admin init logic ทั้งหมด (`initializeApp`, credential resolution, collection ref functions) รวมอยู่ใน `firestore-db.js` ไฟล์เดียว ไม่ได้แยก config ออกมาต่างหาก
- ระบบ JSON และ migration จาก Phase 0–1 ถูกนำออกจาก source แล้ว เพราะระบบปัจจุบันใช้ Firestore ใต้ `users/{userId}/...` เท่านั้น ข้อมูล `backend/data/db.json` ถูกเก็บไว้เป็น backup ในเครื่องและไม่ถูกอ่านหรือเขียนโดยแอป

---

## 8. Environment Variables

จาก `firestore-db.js` และ `index.js`:

| ตัวแปร | จำเป็นไหม | ใช้ทำอะไร |
|---|---|---|
| `FIREBASE_PROJECT_ID` | ต้องมี | project id ของ Firebase — ไม่มี → throw error ทันทีตอน backend เริ่มทำงาน |
| `GOOGLE_APPLICATION_CREDENTIALS` | อย่างใดอย่างหนึ่งกับตัวถัดไป | path ไปยังไฟล์ service account JSON บนดิสก์ — ใช้ตอน dev ในเครื่อง |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | อย่างใดอย่างหนึ่งกับตัวก่อนหน้า | เนื้อหาไฟล์ service account JSON ทั้งก้อนเป็น string เดียว — ใช้ตอน deploy จริงบน hosting ที่ไม่มี persistent disk (เช่น Render.com) ตรวจก่อน `GOOGLE_APPLICATION_CREDENTIALS` เสมอ (priority สูงกว่า เพราะเป็น production path) |
| `PORT` | ไม่บังคับ | พอร์ตที่ Express ฟัง — default `4000` |
| `FRONTEND_URL` | ไม่บังคับแต่ควรตั้งตอน deploy | โดเมน frontend ที่ deploy จริง สำหรับ whitelist ใน CORS (เพิ่มเข้าไปนอกเหนือจาก `http://localhost:5173` ที่ allow ไว้เป็นค่าคงที่เสมอสำหรับ dev) |

**ไม่มี env var ทั้งสองตัวเลย** (`GOOGLE_APPLICATION_CREDENTIALS` และ `_JSON`) → throw error ทันที ระบุชัดว่าต้องตั้งตัวใดตัวหนึ่ง

---

## 9. สรุปความต่างจากเอกสารฉบับก่อน (สำหรับคนที่เคยอ่านฉบับเก่ามาแล้ว)

| หัวข้อ | เอกสารฉบับก่อน | โค้ดจริง |
|---|---|---|
| Entry point | `server.js` | `index.js` |
| Config Firebase | `config/firebase-admin.js` แยกไฟล์ | รวมอยู่ใน `firestore-db.js` |
| สีหมวดหมู่เริ่มต้น | Work `#1557B0`, Personal `#137333`, Health `#C5221F`, Family `#B06000` | Work `#1557B0`, Personal `#B71C1C`, Health `#F29900`, Family `#0B6B33` |
| Field `createdAt`/`updatedAt`/`isAuto` | ระบุว่ามีในทุก collection | ไม่มีเขียนจริงเลยสักที่ |
| Seed หมวดหมู่เริ่มต้น | "เมื่อยืนยันตัวตนครั้งแรก" | เรียกทุก request ที่ token ผ่าน (เช็คว่างเองก่อนเขียน) |
| Endpoint tags/lock | `PUT /api/activities/tags`, `PUT /api/activities/locks` (ไม่มี `:activityId`) | `PUT /api/activities/:activityId/tags`, `PUT /api/activities/:activityId/lock` |
| `firestore-rules.test.js` | ไม่ได้กล่าวถึงเลย | มีอยู่จริงและใช้ทดสอบ Firestore Security Rules |
| Security Rules | ไม่ได้กล่าวถึงเลย | มี lock enforcement บังคับสองชั้น (backend + Firestore rules) |
