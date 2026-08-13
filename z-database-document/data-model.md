# Data Model — times-the-calendar (Firestore)

เอกสารนี้อธิบายโครงสร้างข้อมูลจริงบน Firestore หลัง migration ระยะ 1 (`firebase-migration-plan.md`) อ้างอิงจากโค้ดที่ implement จริงใน `backend/firestore-db.js` และ `backend/routes/*.js`

**ขอบเขต:** ครอบคลุมเฉพาะข้อมูลที่ backend เป็นเจ้าของ (หมวดหมู่ชีวิต, การผูกหมวดหมู่, สถานะ lock) — ไม่รวมข้อมูลกิจกรรม/ปฏิทิน ซึ่งอยู่บน Google Calendar โดยตรงและไม่เคยถูกเก็บซ้ำในฝั่งนี้เลย

---

## ภาพรวม 3 Collections

| Collection | หน้าที่ | จำนวนข้อมูลปัจจุบัน (หลัง migration) |
|---|---|---|
| `categories` | เก็บหมวดหมู่ชีวิต (Life Areas) ที่ผู้ใช้กำหนดเอง | 6 documents |
| `activityCategories` | ผูกกิจกรรม (จาก Google Calendar) เข้ากับหมวดหมู่ | 31 documents |
| `lockedActivities` | เก็บสถานะ lock ของกิจกรรม | 2 documents |

ทั้ง 3 collection เป็น **collection ระดับบนสุด (top-level)** ไม่ซ้อนกันเป็น subcollection — เพราะระบบยังเป็น single-user (ยังไม่ทำระยะ 2 Authentication) จึงไม่มีความจำเป็นต้องแยก scope ด้วย `userId` ตอนนี้

---

## Collection: `categories`

**หน้าที่:** เก็บ "หมวดหมู่ชีวิต" (Life Areas) ที่ผู้ใช้สร้าง/แก้ไข/ลบเองผ่าน UI — เช่น งาน, ส่วนตัว, สุขภาพ, ครอบครัว หมวดหมู่เหล่านี้ถูกนำไปผูกกับกิจกรรมใน Google Calendar เพื่อจัดกลุ่มและคำนวณสรุปรายสัปดาห์

**Document ID:** `categoryId` — เป็น UUID สุ่มที่สร้างด้วย `crypto.randomUUID()` ตอน `POST /api/categories` (ยกเว้น 4 หมวดเริ่มต้นที่ hardcode id เป็น `work`, `personal`, `health`, `family` เพื่อให้อ่านง่ายและ debug สะดวก)

### โครงสร้าง field

| Field | ชนิดข้อมูล | บังคับ | คำอธิบาย |
|---|---|---|---|
| `name` | `string` | ใช่ | ชื่อหมวดหมู่ที่ผู้ใช้ตั้ง เช่น "งาน", "งานอดิเรก" |
| `color` | `string` | ใช่ | สี hex 6 หลัก พร้อม `#` นำหน้า เช่น `"#1557B0"` — validate ด้วย regex `^#[0-9A-Fa-f]{6}$` ก่อนเขียนทุกครั้ง |

**ตัวอย่างเอกสาร** (`categories/work`):
```json
{
  "name": "งาน",
  "color": "#1557B0"
}
```

### เหตุผลการออกแบบ

- **`color` เป็น string hex ไม่ใช่ nested object `{r, g, b}`:** frontend เอาค่านี้ไปต่อ string ตรงๆ ทำ alpha-tint (`${color}33` ใน `activity-colors.js`) และใช้เป็น CSS `background`/`border` โดยตรง — เก็บเป็น hex string เดียวจบ ไม่ต้อง parse/format เพิ่มทั้งสองทาง (write และ read)
- **validate hex format ที่ backend ก่อนเขียน ไม่ใช่แค่ฝั่ง frontend:** ถ้าปล่อยให้ format ผิดหลุดเข้า Firestore ได้ ผลคือ CSS color invalid ซึ่ง browser จะ "เงียบๆ ไม่แสดงสีเลย" โดยไม่มี error ให้เห็นที่ไหนเลย — debug ยากมากถ้าไม่กันไว้ตั้งแต่ต้นทาง
- **document id เป็น UUID สุ่ม (ไม่ใช่ auto-increment number หรือชื่อ slug):** กัน id ชนกันเวลามีการสร้าง/ลบ/สร้างใหม่สลับกันแบบไม่เรียงลำดับ และไม่ต้อง query "id ล่าสุด" ก่อนสร้างใหม่ (ซึ่งจะเสี่ยง race condition ถ้ามีการเขียนพร้อมกัน)
- **4 หมวดเริ่มต้นใช้ id ที่อ่านออก (`work`, `personal`, …) แทน UUID:** เพราะเป็นข้อมูล seed ที่ backend สร้างเองตอน collection ว่างเปล่า (`ensureDefaultCategories()` ใน `firestore-db.js`) — ไม่ได้มาจาก input ผู้ใช้ จึงตั้งชื่อให้อ่านง่ายเพื่อ debug ผ่าน Firebase Console ได้สะดวกกว่า

---

## Collection: `activityCategories`

**หน้าที่:** เก็บการผูกกิจกรรม (Google Calendar event) เข้ากับหมวดหมู่ชีวิตหนึ่งหมวด — เป็น mapping table แบบ 1 กิจกรรม ต่อ 1 หมวดหมู่

**Document ID:** `activityId` ที่ **normalize แล้ว** — คือ Google Calendar event id หลัง strip suffix ของ recurring event instance ออก (ดูหัวข้อ "การจัดการ recurring events" ด้านล่าง) **ไม่ใช่** auto-generated id

### โครงสร้าง field

| Field | ชนิดข้อมูล | บังคับ | คำอธิบาย |
|---|---|---|---|
| `categoryId` | `string` | ใช่ | อ้างอิงไปยัง document id ใน collection `categories` (ดูหัวข้อความสัมพันธ์) |

**ตัวอย่างเอกสาร** (`activityCategories/abc123xyz`):
```json
{
  "categoryId": "work"
}
```

### เหตุผลการออกแบบ

- **มี field เดียว (`categoryId`) ไม่ใช่ document ที่ซับซ้อน:** เพราะข้อมูลกิจกรรมจริงทั้งหมด (ชื่อ, เวลา, สถานที่ ฯลฯ) อยู่บน Google Calendar อยู่แล้ว — collection นี้ทำหน้าที่แค่เป็น "ป้ายกำกับ" ผูก id เข้ากับหมวดหมู่เท่านั้น ไม่จำเป็นต้อง denormalize ข้อมูลกิจกรรมมาเก็บซ้ำ (ซึ่งจะทำให้ข้อมูลไม่ sync กับ Google Calendar ที่เป็น source of truth จริง)
- **ใช้ `activityId` เป็น document id ตรงๆ (ไม่ใช่ auto-generated id + field แยก):** เพราะ pattern การเข้าถึงข้อมูลหลักของระบบคือ "กิจกรรมนี้ผูกหมวดหมู่ไหน" ซึ่งเป็น lookup โดยตรงด้วย id — การใช้ id เป็น document key ทำให้ query เป็น `doc(activityId).get()` แทนที่จะต้อง `where("activityId", "==", ...)` ซึ่งช้ากว่าและกิน read quota มากกว่า (query ต้อง scan index ส่วน direct doc lookup ไม่ต้อง)
- **การลบทำโดยลบ document ทิ้งทั้งอัน ไม่ใช่ set `categoryId: null`:** สื่อความหมาย "ไม่มีการผูกหมวดหมู่" ได้ตรงกว่า และประหยัดพื้นที่ — endpoint `PUT /api/activities/:id/category` ที่ส่ง `categoryId: null` มา backend จะ `.delete()` document นั้นทิ้งแทนที่จะเขียนค่า `null` ลงไป

---

## Collection: `lockedActivities`

**หน้าที่:** เก็บสถานะ lock ของกิจกรรม — กิจกรรมที่ถูก lock จะแก้ไข/ลาก/ลบใน timeline-editor และ context menu ฝั่ง frontend ไม่ได้ จนกว่าจะปลดล็อก

**Document ID:** `activityId` ที่ normalize แล้ว (หลักการเดียวกับ `activityCategories`)

### โครงสร้าง field

| Field | ชนิดข้อมูล | บังคับ | คำอธิบาย |
|---|---|---|---|
| `locked` | `boolean` | ใช่ | เป็น `true` เสมอเมื่อ document นี้มีอยู่ (ดูเหตุผลด้านล่างว่าทำไมไม่เก็บ `false`) |

**ตัวอย่างเอกสาร** (`lockedActivities/def456uvw`):
```json
{
  "locked": true
}
```

### เหตุผลการออกแบบ

- **document "มีอยู่" = locked, "ไม่มีอยู่" = ไม่ locked (ไม่เก็บ `locked: false`):** กิจกรรมส่วนใหญ่ในระบบไม่ถูก lock — ถ้าต้องสร้าง document ทุกกิจกรรมพร้อม `locked: false` จะทำให้ collection นี้ขนาดใหญ่โตตามจำนวนกิจกรรมทั้งหมดในปฏิทินโดยไม่จำเป็น (ปัจจุบันมีแค่ 2 documents จากกิจกรรมทั้งหมดหลายสิบ) การปลดล็อกจึงเป็นการ `.delete()` document ทิ้ง ไม่ใช่ update ค่าเป็น `false`
- **field `locked` ดูเหมือนซ้ำซ้อน (เพราะการมี document ก็บอกอยู่แล้วว่า locked) แต่จงใจเก็บไว้:** เพื่อให้ response ของ `GET /api/activities/locks` คืนค่าเป็น `{ [activityId]: true }` ตรงตาม API contract เดิมที่ frontend คาดหวัง (มาจากตอนที่ backend endpoint ยังใช้ `db.json` — คง contract นี้ไว้เพื่อไม่กระทบ `api.js` ฝั่ง frontend เลยตามหลักการของ migration)

---

## ความสัมพันธ์ระหว่าง Collections

```
categories                    activityCategories              (Google Calendar API — ภายนอก)
+------------------+          +----------------------+        +----------------------+
| {categoryId}      | <------ | {activityId}          | ------>| กิจกรรมจริง            |
|  - name           |  1    M |  - categoryId          |  1  1  |  (ชื่อ, เวลา, ฯลฯ)      |
|  - color          |         +----------------------+        +----------------------+
+------------------+                                                    ^
                                                                          |  1  1
                              lockedActivities                          |
                              +----------------------+                  |
                              | {activityId}          | -----------------+
                              |  - locked: true        |
                              +----------------------+
```

### ความสัมพันธ์ที่มีอยู่จริง

1. **`categories` ↔ `activityCategories` — แบบ 1 ต่อกลาย (1:M) ผ่าน field `categoryId`**
   หนึ่งหมวดหมู่ผูกกับได้หลายกิจกรรม แต่หนึ่งกิจกรรมผูกได้แค่หมวดหมู่เดียว (เพราะ `activityCategories/{activityId}` มี field `categoryId` เดี่ยว ไม่ใช่ array)
   **ไม่มี foreign key constraint ระดับ database** — Firestore ไม่รองรับ referential integrity แบบ SQL เอง การตรวจสอบว่า `categoryId` มีอยู่จริงทำที่ระดับ application code (`routes/activity-categories.js` เช็ค `categoriesCol.doc(categoryId).get()` ก่อนเขียนทุกครั้งตอน `PUT /category`)

2. **`activityCategories` และ `lockedActivities` ↔ Google Calendar event — แบบ 1 ต่อ 1 ผ่าน document id เอง**
   ไม่มี field อ้างอิงแยกต่างหาก เพราะ document id **คือ** activity id ตรงๆ อยู่แล้ว — ความสัมพันธ์นี้เป็นแบบ "อ่อน" (soft reference) เพราะ Firestore ไม่รู้จัก Google Calendar และไม่มีการ validate ว่า activityId ที่ส่งมามีกิจกรรมจริงอยู่บน Google Calendar หรือไม่ (backend เชื่อ input จาก frontend ตรงๆ)

3. **`activityCategories` และ `lockedActivities` — ไม่มีความสัมพันธ์กันโดยตรง**
   ทั้งสอง collection ต่างก็ผูกกับ activity id เดียวกันได้พร้อมกัน (กิจกรรมหนึ่งอาจมีทั้งหมวดหมู่และถูก lock พร้อมกัน) แต่เป็นสอง concept ที่เป็นอิสระต่อกันโดยสิ้นเชิงในระดับ data model — ไม่มี field ใดอ้างอิงถึงอีก collection หนึ่ง

### เหตุผลที่ไม่ทำ denormalization เพิ่ม

พิจารณาแล้วไม่เก็บชื่อ/สีหมวดหมู่ซ้ำไว้ใน `activityCategories` (เช่น `{ categoryId, categoryName, categoryColor }`) แม้จะช่วยลด read ตอนคำนวณสรุปได้ (`routes/summary.js` ต้อง join สอง collection ในโค้ดทุกครั้ง) เพราะ:
- ข้อมูลจำนวนหมวดหมู่มีน้อยมาก (หลักสิบ) — `summary.js` โหลด `categories` ทั้งหมดมาเก็บใน memory ครั้งเดียวต่อ request (`categoryById`) อยู่แล้ว ไม่ต้อง query ซ้ำต่อกิจกรรม
- ถ้า denormalize แล้วผู้ใช้แก้ชื่อ/สีหมวดหมู่ทีหลัง จะต้อง update ทุก `activityCategories` document ที่ผูกกับหมวดหมู่นั้นตามไปด้วย (อาจหลายสิบ document) เพิ่มความซับซ้อนของโค้ดและความเสี่ยง data ไม่ sync กัน โดยแลกกับ performance gain ที่ไม่จำเป็นในขนาดข้อมูลระดับนี้

---

## การจัดการ Recurring Events (normalizeId)

Google Calendar ส่ง instance id ของกิจกรรมที่เกิดซ้ำ (recurring event) มาในรูป `<baseId>_<YYYYMMDDTHHmmssZ>` เมื่อเรียก API ด้วย `singleEvents=true` — เช่น `abc123_20260801T040000Z`

**ก่อนเขียนหรืออ่านทุกครั้งใน `activityCategories` และ `lockedActivities`** ทั้ง backend (`routes/activity-categories.js`, `routes/summary.js`) และ frontend (`id-utils.js`, `activity-colors.js`, `timeline-editor.jsx`) จะ strip suffix `_<timestamp>` ออกก่อนเสมอ ด้วย regex เดียวกัน:
```js
activityId.replace(/_\d{8}T\d{6}Z$/, "")
```

**ทำไมต้องทำแบบนี้:** ถ้าเก็บ instance id ดิบๆ ทุก occurrence ของ recurring event เดียวกัน (เช่น "ประชุมทีมทุกวันจันทร์") จะกลายเป็น document แยกกันคนละอัน — ตั้งหมวดหมู่ในสัปดาห์นี้แล้ว สัปดาห์หน้า lookup ไม่เจอ (เพราะ timestamp ต่างกัน) หมวดหมู่หายไปทุกครั้งที่ดูสัปดาห์ใหม่ การ normalize id ให้ทุก occurrence แชร์ document เดียวกันแก้ปัญหานี้โดยตรง

**ผลกระทบต่อ data model:** กิจกรรมที่เกิดซ้ำ (recurring) ทุก occurrence จะ**แชร์หมวดหมู่และสถานะ lock เดียวกันเสมอ** ไม่สามารถตั้งหมวดหมู่ต่างกันในแต่ละครั้งที่เกิดซ้ำได้ — เป็นข้อจำกัดที่ตั้งใจยอมรับ (trade-off) เพื่อแลกกับการไม่ต้องเก็บ document แยกทุก occurrence ซึ่งจะโตไม่มีสิ้นสุดตามระยะเวลาที่ recurring event ดำเนินไป

---

## สิ่งที่ตั้งใจไม่ทำในสคีมานี้ (และเหตุผล)

| สิ่งที่ไม่ทำ | เหตุผล |
|---|---|
| ไม่มี field `createdAt`/`updatedAt` (timestamp) ในทุก collection | ปัจจุบันไม่มี use case ใดที่ต้องใช้ — ไม่มีฟีเจอร์ audit log, ไม่มีการ sort ตามเวลาสร้าง/แก้ไข การเพิ่ม field ที่ไม่ได้ใช้งานจริงเพิ่มภาระ maintain โดยไม่ได้ประโยชน์ (ถ้าต้องการในอนาคต เพิ่มทีหลังได้ง่าย เพราะ Firestore เป็น schema-less) |
| ไม่มี field `userId` ในทุก collection | ระบบยังเป็น single-user (ระยะ 2 Authentication ยังไม่เริ่ม) — ตามแผนเดิม field นี้จะถูกแทนที่ด้วยการย้ายทั้ง 3 collection ไปอยู่ใต้ path `users/{userId}/...` แทน ไม่ใช่การเพิ่ม field ในโครงสร้างปัจจุบัน |
| ไม่มี subcollection ซ้อนกัน (เช่น `categories/{id}/activities`) | ยังไม่มีความจำเป็นต้อง query "กิจกรรมทั้งหมดในหมวดหมู่นี้" โดยตรง — ปัจจุบัน frontend โหลด `activityCategories` ทั้ง collection มา filter ใน memory แทน (ปริมาณข้อมูลยังน้อยพอที่จะทำแบบนี้ได้โดยไม่มีปัญหา performance) |
| ไม่ enforce lock ที่ database level (Security Rules) | เป็นระยะ 3 ในแผน Firebase migration ที่ยังไม่เริ่ม — ปัจจุบัน lock enforcement ทำที่ frontend เท่านั้น (UI เช็คก่อนอนุญาตแก้ไข) backend ยัง accept การเขียนตรงผ่าน API แม้กิจกรรมจะถูก lock ไว้ก็ตาม เป็นข้อจำกัดที่ทราบและบันทึกไว้แล้ว |
