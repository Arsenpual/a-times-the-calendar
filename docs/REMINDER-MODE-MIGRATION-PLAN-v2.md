# Migration Plan v2: Reminder Mode → "ReminderOS" + Firebase Tier 1

**แทนที่:** `reminder-mode-migration-plan.md` (v1) — เอกสารนี้เพิ่มเติม 2 อย่างจากเดิม:
1. ล็อกคำตอบเฟส 0 ทั้ง 4 ข้อแล้ว (ไม่ใช่คำถามเปิดอีกต่อไป)
2. เพิ่มเฟสใหม่สำหรับ Firebase Tier 1 (FCM + Cloud Functions + Analytics/Remote Config) แก้จุดอ่อน "ไม่มี notification เมื่อปิดแท็บ"

**จาก:** `reminder-mode.jsx` (โค้ดจริงปัจจุบัน — 2 คอลัมน์, ไม่มี push notification)
**ไปสู่:** Layout ใหม่ "ReminderOS" (mockup) + backend ที่ push แจ้งเตือนได้จริงแม้ปิดแท็บ

---

## เฟส 0 — การตัดสินใจ (ล็อกแล้ว)

| ข้อ | คำถาม | คำตอบที่ล็อกแล้ว |
|---|---|---|
| 1 | Groups เป็น one-to-one หรือ many-to-many? | **One-to-one ต่อ reminder** ตาม pattern เดียวกับ `categories`/`activityCategoryMap` — ลบกลุ่มแล้ว reminder fallback เป็น "ไม่มีกลุ่ม" ไม่ใช่ลบ reminder ทิ้ง |
| 2 | Groups sync ขึ้น backend ไหม? | **ต้อง sync** — เป็น schedule-field-like data ที่ต้องข้ามเครื่องได้ |
| 3 | "ทำเสร็จแล้ว" คืออะไร? | เพิ่ม field ใหม่ `completedAt` (timestamp \| null) **แยกจาก** `enabled` — reminder ที่ `completedAt !== null` ไม่ปรากฏใน active/paused tab อีกต่อไป ไปอยู่ tab "ทำเสร็จแล้ว" แทน |
| 4 | Omnibar ใช้อะไร? | **Rule-based ก่อน** แล้วค่อย AI fallback ทีหลัง |

รายละเอียดการ implement ตามคำตอบเหล่านี้อยู่ในเฟส 3, 4, 5 ตามลำดับด้านล่าง — ไม่มีอะไรเปลี่ยนจาก v1 ในส่วนแนวทาง implementation เพราะ v1 เขียนไว้ล่วงหน้าตามคำแนะนำที่กลายมาเป็นคำตอบจริงพอดี

---

## เฟส 1 — Layout ใหม่ (UI-only, ไม่แตะ data model)

**ความเสี่ยง: ต่ำ**

### 1.1 โครง 3 คอลัมน์ + Top bar
- เพิ่ม `<header>` บนสุด: โลโก้ + placeholder ช่อง Omnibar (ยังไม่ผูก logic จนถึงเฟส 6) + ปุ่มสถิติ/ตั้งค่า
- ย้าย timeline panel จากซ้ายไปขวาสุด (`320px`)
- เพิ่มคอลัมน์ซ้ายใหม่ (`260px`): เริ่มจากแค่ "มุมมองหลัก" (ทั้งหมด/ของวันนี้) — filter จาก `nextDueAt`/`getReminderTimeSlots` เดิม ไม่ต้องพึ่ง schema ใหม่
- คอลัมน์กลาง = main workspace (list เดิมที่เคยอยู่ขวา)

### 1.2 Tabs แทน section headers
- เปลี่ยนจาก active/paused section คั่นหัวข้อ → tab component พร้อม `activeTab` state
- Tab "ทำเสร็จแล้ว" ใส่โครงไว้ก่อน แต่ยังว่าง (รอ field `completedAt` จริงจากเฟส 4)

### 1.3 ปุ่มบน due-alert banner
- เพิ่มปุ่ม "ทำเสร็จแล้ว" ข้าง "เตือนอีกครั้ง" — ผูก handler จริงในเฟส 4
- "เตือนอีกครั้ง" เพิ่ม dropdown เลือกเวลา snooze — `scheduleNext(id, snoozeMinutes)` fallback เป็น logic เดิมถ้าไม่ระบุ

### 1.4 Redesign การ์ด reminder
- icon กล่องสี่เหลี่ยมมุมโค้ง, border สีซ้ายตามประเภท, ปุ่ม "⋮" รวม edit/delete

**Deliverable:** ทำงานเหมือนเดิมทุกอย่าง แค่หน้าตาเปลี่ยน — regression test ครบ 7 types

---

## เฟส 2 — Filter ตามประเภท (ยังไม่แตะ schema)

**ความเสี่ยง: ต่ำ**

- `activeTypeFilter` state, filter client-side ล้วนๆ จาก `reminders` ที่มีอยู่แล้ว
- ไม่กระทบ backend

**Deliverable:** filter ครบ 7 ประเภท พร้อม count จริง (ไม่ hardcode)

---

## เฟส 3 — Groups/Projects (ล็อกแล้ว: one-to-one + sync backend)

**ความเสี่ยง: กลาง-สูง**

### 3.1 Backend
- เพิ่ม collection ใหม่ `reminderGroupsCol(userId)` ใน `firestore-db.js` — โครงสร้างเดียวกับ `categoriesCol` (`{ name, color }`)
- Route ใหม่แยกไฟล์: `backend/routes/reminder-groups.js`
  - `GET /api/reminder-groups` — list ทั้งหมด
  - `POST /api/reminder-groups` — สร้างใหม่ `{ name, color }` (reuse `isValidName`/`isValidColor`/`HEX_COLOR_RE` จาก `categories.js` — พิจารณาย้ายไป shared util เพื่อไม่ copy-paste ซ้ำ)
  - `PUT /api/reminder-groups/:id` — แก้ไข
  - `DELETE /api/reminder-groups/:id` — ลบ + เคลียร์ `groupId` ของ reminder ที่ผูกอยู่ทั้งหมดผ่าน `batch` เดียว (**pattern เดียวกับ `categories.js`'s DELETE ทุกกระเบียดนิ้ว** — query `remindersCol(userId).where("groupId","==",id)` แล้ว batch update `groupId: null`)
- Mount ใน `index.js`: `app.use("/api/reminder-groups", requireAuth, reminderGroupsRouter)`
- เพิ่ม `groupId` เข้า `ALLOWED_FIELDS` ใน `routes/reminders.js` (validation: ต้องเป็น `null` หรือ string ที่มีอยู่จริงใน `reminderGroupsCol` — เช็คแบบเดียวกับที่ `activity-categories.js` เช็ค `categoryId` มีอยู่จริงก่อนบันทึก)

### 3.2 Frontend hooks
- เพิ่ม hook ใหม่ `use-reminder-groups.js` (แยกจาก `use-reminders-sync.js` เพื่อไม่ให้ไฟล์เดิมบวม) — โครงสร้างคล้าย `fetchCategories`/`createCategory`/`deleteCategory` ใน `api.js` (เพิ่มฟังก์ชันคู่ขนาน `fetchReminderGroups`/`createReminderGroup`/`deleteReminderGroup`)
- `reminder-mode.jsx`: เพิ่ม `groupId` เข้า `SCHEDULE_FIELD_KEYS` + `extractScheduleFields()`
- Merge logic เดิมใน `useEffect` (merge `remoteReminders` ครั้งเดียวตอนโหลด) รองรับ `groupId` โดยอัตโนมัติเพราะเป็นแค่อีก schedule field หนึ่ง — ไม่ต้องแก้ merge algorithm

### 3.3 UI
- Sidebar "กลุ่ม/โปรเจกต์" ผูกกับ `useReminderGroups()` จริง แทน hardcode
- ปุ่ม "+ เพิ่มกลุ่มใหม่" → inline form (ชื่อ + สี — reuse UI pattern จากการสร้าง category ฝั่ง calendar ถ้ามี)
- Composer เพิ่ม dropdown เลือกกลุ่ม (`groupId`)
- Filter ตามกลุ่มในคอลัมน์กลาง (เหมือนเฟส 2 แต่ filter ด้วย `groupId`)

**Deliverable:** สร้าง/แก้ไข/ลบกลุ่มได้ครบ, sync ถูกต้องข้ามเครื่อง, ลบกลุ่มแล้ว reminder เหลืออยู่แค่ไม่มีกลุ่ม

---

## เฟส 4 — สถานะ "ทำเสร็จแล้ว" (ล็อกแล้ว: `completedAt` field แยกจาก `enabled`)

**ความเสี่ยง: กลาง**

### 4.1 Field ใหม่
- `completedAt`: timestamp | null — เป็น **runtime field ไม่ sync ขึ้น backend** (ตามหลักการเดิมของไฟล์ที่แยก schedule/runtime อยู่แล้ว เพราะเป็นค่าที่เปลี่ยนบ่อยและไม่จำเป็นต้อง cross-device สำหรับ MVP — ถ้าอยากให้ประวัติคงอยู่ข้ามเครื่องในอนาคตค่อยย้ายเข้า schedule fields ทีหลัง)

### 4.2 Logic ที่ต้องแก้
- `checkDue()`: กรอง reminder ที่ `completedAt !== null` ออกจาก due-checking เสมอ (เพิ่มเข้า filter condition เดิมที่กรอง `routine`/`stopwatch` อยู่แล้ว)
- Tab filter ในคอลัมน์กลาง:
  ```js
  const activeReminders = reminders.filter(r => r.enabled && !r.completedAt);
  const pausedReminders = reminders.filter(r => !r.enabled && !r.completedAt);
  const completedReminders = reminders.filter(r => r.completedAt !== null);
  ```
- ปุ่ม "ทำเสร็จแล้ว" บน due-banner (placeholder จากเฟส 1) → `markCompleted(id)`: set `completedAt: Date.now(), enabled: false`

### 4.3 พฤติกรรมต่างกันตาม type
ต้องตัดสินใจเพิ่มตอน implement จริง (ไม่ใช่คำถามเฟส 0 แต่เป็นรายละเอียดย่อยที่โผล่มาจากคำตอบข้อ 3):
- **One-shot types** (`once-at`, `countdown`): "ทำเสร็จแล้ว" = จบเลย เข้า tab ทำเสร็จแล้วถาวร — ตรงไปตรงมา
- **Repeating types** (`interval`, `weekly`): "ทำเสร็จแล้ว" ควรหมายถึง mark **รอบนี้**เสร็จ แล้ว auto-schedule รอบถัดไปทันที (`completedAt` ควร reset กลับเป็น `null` พร้อมกับ `nextDueAt` รอบใหม่ ไม่ค้างอยู่ tab ทำเสร็จแล้วถาวร) — แนะนำ implement เป็นพฤติกรรมเดียวกับ "เตือนอีกครั้ง" แต่เปลี่ยนแค่ label ปุ่ม
- **`routine`**: "ทำเสร็จแล้ว" ของทั้งชุด (ไม่ใช่ step เดียว) ควรเทียบเท่ากับที่ `advanceRoutine` ทำอยู่แล้วตอนวนถึง step สุดท้าย (`enabled:false`) — เพิ่ม `completedAt` เข้าไปด้วยตอนนั้น
- **`event-anchored`**: คล้าย repeating — "ทำเสร็จแล้ว" mark ว่า trigger รอบนี้เสร็จ ไม่ใช่ปิดถาวร

**Deliverable:** 3 สถานะทำงานถูกต้องกับทุก type, ไม่ regression กับ due-checking loop เดิม

---

## เฟส 5 — Firebase Tier 1: Push Notification จริง (ใหม่ใน v2)

**ความเสี่ยง: กลาง-สูง** — เป็นการเปลี่ยนสถาปัตยกรรมจาก "client-side only" เป็น "มี server-side scheduler" ครั้งแรกของฟีเจอร์นี้

นี่คือเฟสที่แก้ปัญหาที่ระบุไว้ใน deep-dive ชัดเจนที่สุด: **ปิดแท็บแล้วพลาดการแจ้งเตือนทั้งหมด** — เพราะ `checkDue()` ปัจจุบันเป็น client-side `setInterval` ล้วนๆ

### 5.1 Prerequisite: Runtime fields บางส่วนต้อง sync ขึ้น Firestore
เหตุผล: server-side scheduler (Cloud Function) ต้องรู้ว่า reminder ไหน due โดยไม่พึ่ง client เปิดอยู่ — หมายความว่า **`nextDueAt` ต้องมีสำเนาบน Firestore เสมอ** ไม่ใช่แค่ localStorage

- เพิ่ม `nextDueAt` เข้า schedule fields ที่ sync (เดิมเป็น runtime field ไม่ sync — เปลี่ยนจุดนี้เป็นข้อยกเว้นเฉพาะ field นี้)
- Sync ทุกครั้งที่ `computeNextDueAt()` คำนวณค่าใหม่ (ไม่ใช่แค่ตอน submit ฟอร์มเหมือน schedule fields อื่น) — ต้อง debounce เพื่อไม่ยิง Firestore ถี่เกิน (`interval` type คำนวณใหม่บ่อยมาก)
- **ทางเลือกอื่นที่ overhead น้อยกว่า:** ไม่ sync `nextDueAt` ตรงๆ แต่ให้ Cloud Function เป็นคน**คำนวณเอง**จาก schedule fields ที่มีอยู่แล้ว (`type`, `amount`, `unit`, `days`, `time` ฯลฯ) โดย port ฟังก์ชัน `computeNextDueAt()` ไปเป็น Cloud Function เวอร์ชันเดียวกัน (duplicate logic ระหว่าง client/server แต่ไม่ต้องเพิ่ม sync traffic) — **แนะนำแนวทางนี้มากกว่า** เพราะลดความเสี่ยงเรื่อง client/server ข้อมูล out-of-sync กัน และ `computeNextDueAt()` เป็น pure function อยู่แล้ว ย้ายไปแชร์ code ระหว่าง frontend/Cloud Function ได้ง่าย (เช่นแยกเป็น npm package เล็กๆ หรือ copy ไฟล์เดียวกัน)

### 5.2 FCM Setup
- Frontend: ขอ permission + register Service Worker (`firebase-messaging-sw.js`) ใหม่ในโฟลเดอร์ `public/`
- เก็บ FCM token ต่อ user ใน Firestore: subcollection ใหม่ `users/{userId}/fcmTokens/{tokenId}` (รองรับหลายอุปกรณ์ต่อ user — คนละ token ต่อเบราว์เซอร์/มือถือ)
- UI: toggle "เปิดการแจ้งเตือน" ใน Settings Drawer หรือหน้า reminder mode เอง — ขอ permission ตอนกดเปิดเท่านั้น (ไม่ auto-prompt ตอนเปิดแอปครั้งแรก เพราะ browser permission prompt ที่ไม่มีบริบทมักโดนปฏิเสธ)

### 5.3 Cloud Function: Scheduler
- ใช้ **Cloud Scheduler + Cloud Functions (scheduled function)** รันทุก 1 นาที
- Query reminder ทุก user ที่ `enabled === true && completedAt === null && nextDueAt <= now` (ต้อง index `nextDueAt` ใน Firestore — collection group query ข้าม user ทั้งหมด ต้องใช้ **collection group index**)
- สำหรับแต่ละ reminder ที่ due: ดึง FCM tokens ของ user นั้น → ส่ง push ผ่าน `admin.messaging().sendEachForMulticast()`
- Reminder ประเภท auto-repeat (`interval`/`weekly`) หลังส่ง push แล้ว **คำนวณ `nextDueAt` รอบถัดไปทันที** เขียนกลับ Firestore (server เป็นคนอัปเดต ไม่ใช่ client) — ต้อง sync ค่านี้กลับไป client ตอนเปิดแอปครั้งถัดไปด้วย (client รับรู้ `nextDueAt` ใหม่จาก merge logic ที่มีอยู่แล้ว)
- One-shot types (`once-at`/`countdown`) หลังส่ง push → set `enabled: false` ที่ Firestore เลย

### 5.4 Client-side ปรับตัว
- `checkDue()` เดิมยังคงอยู่ (ใช้ตอนแอปเปิดอยู่ — เร็วกว่ารอ FCM round-trip) แต่ไม่ใช่กลไกเดียวอีกต่อไป
- ต้องจัดการ **duplicate notification**: ถ้าแอปเปิดอยู่ตอน FCM ส่งมาพอดี อาจเห็น banner ซ้ำกับ push notification ของเบราว์เซอร์ — แนะนำ: ถ้าแอป foreground อยู่ ให้ suppress FCM banner (Firebase SDK แยก `onMessage` handler สำหรับ foreground อยู่แล้ว) ใช้แค่ bannerในหน้าที่มีอยู่เดิม, FCM native notification ใช้เฉพาะตอน background/ปิดแท็บ

### 5.5 Firebase Analytics + Remote Config (ส่วนเสริมของเฟสนี้ ทำแยกได้)
- **Analytics**: log event `reminder_snoozed`, `reminder_completed`, `reminder_created` (ต่อ `type`) — ใช้เป็นฐานข้อมูลให้เฟส 7 (หน้าสถิติ) โดยไม่ต้องสร้างระบบ log เอง
- **Remote Config**: flag เปิด/ปิดฟีเจอร์ Omnibar (เฟส 6) แบบ rollout ค่อยเป็นค่อยไปโดยไม่ต้อง redeploy — ใช้ทดสอบกับ user กลุ่มเล็กก่อนเปิดทุกคน

**Deliverable:** ปิดแท็บแล้วยังได้รับแจ้งเตือนจริงผ่าน FCM, ไม่มี duplicate notification ตอนแอปเปิดอยู่, auto-repeat types คำนวณรอบถัดไปถูกต้องแม้ client ไม่ได้เปิด

**ความเสี่ยงเฉพาะเฟสนี้ที่ควรระวัง:**
- Collection group query ข้าม user ทุกคนทุก 1 นาที — ต้องมี index composite ที่ถูกต้อง ไม่งั้น query ช้า/แพงเกินคาด เมื่อ user เยอะขึ้น
- Logic `computeNextDueAt()` ต้อง**เหมือนกันเป๊ะ**ระหว่าง client กับ Cloud Function — ถ้า diverge (แก้ client แล้วลืมแก้ Cloud Function) จะเกิด race ระหว่างสองฝั่งคำนวณ `nextDueAt` ไม่ตรงกัน
- Cost: Cloud Functions + Cloud Scheduler มี free tier แต่ยิงทุก 1 นาที 24/7 ควรประเมิน invocation count ต่อเดือนไว้ก่อน

---

## เฟส 6 — Omnibar สร้างด่วน (ล็อกแล้ว: rule-based → AI fallback)

**ความเสี่ยง: สูง**

### 6.1 Rule-based parser (MVP)
- ไฟล์ใหม่ `reminder-quick-parse.js`
- Pattern เริ่มต้น:
  - `"เตือน{title}ทุก{N}{ชม./นาที}"` → `interval`
  - `"เตือน{title}ทุกวัน{days}เวลา{HH:mm}"` → `weekly`
  - `"เตือน{title}ใน{N}นาที"` → `countdown`
- Return `{ matched, reminder, confidence }` — ไม่ match/confidence ต่ำ → fallback เปิด composer พร้อม prefill `title`

### 6.2 UI feedback
- Preview real-time ใต้ omnibar ก่อนกด Enter (เช่น "→ Interval ทุก 1 ชั่วโมง") — สำคัญเพราะกันการตีความผิดของ parser

### 6.3 AI fallback
- ถ้า rule-based ไม่ match และผู้ใช้ยืนยันจะสร้างต่อ → เรียก backend endpoint ใหม่ (ไม่ expose API key ฝั่ง client)
- Rate limit แยกจาก `apiLimiter` ทั่วไป (ต้นทุนสูงกว่า CRUD ธรรมดา)
- **เลือก AI provider ได้อิสระ** (ไม่จำเป็นต้องเป็น Gemini แม้จะอยู่ใน ecosystem เดียวกับ Firebase — Tier 2 ตามที่เคยแยกไว้ ไม่ใช่ Tier 1 ที่ล็อกไว้ตอนนี้ เป็นการตัดสินใจแยกต่างหากในอนาคต)

**Deliverable:** พิมพ์ประโยคง่ายๆ ได้ reminder ถูกต้อง 80%+ ของ pattern ที่พบบ่อย

---

## เฟส 7 — หน้าสถิติ (ต่อยอดจาก Analytics ในเฟส 5)

**ความเสี่ยง: ต่ำ-กลาง** — เบากว่า v1 มาก เพราะ Firebase Analytics (เฟส 5.5) เก็บ event ให้แล้วล่วงหน้า

- Panel ใหม่เปิดจากปุ่ม "📊 สถิติ" — ดึงข้อมูลจาก Analytics dashboard (ผ่าน BigQuery export ถ้าต้องการ query ซับซ้อน) หรือสร้าง aggregation query ง่ายๆ จาก Firestore เอง (เช่น count `completedAt` ต่อสัปดาห์)
- นิยาม metric ที่ต้องการแสดงให้ชัดก่อนเริ่ม: snooze บ่อยสุด, % สำเร็จของ routine ต่อสัปดาห์, เวลาเฉลี่ยของ stopwatch

**Deliverable:** หน้าสถิติแสดงข้อมูลจริงจาก event ที่เก็บมาตั้งแต่เฟส 5

---

## สรุปลำดับความสำคัญและความเสี่ยง (v2)

| เฟส | เนื้อหา | ความเสี่ยง | แตะ backend? | พึ่งเฟสก่อนหน้า |
|---|---|---|---|---|
| 0 | ตัดสินใจ schema/scope | - | - | - | **✅ ล็อกแล้ว** |
| 1 | Layout 3 คอลัมน์ + tabs + redesign การ์ด | ต่ำ | ❌ | เฟส 0 |
| 2 | Filter ตามประเภท | ต่ำ | ❌ | เฟส 1 |
| 3 | Groups/Projects (one-to-one + sync) | กลาง-สูง | ✅ | เฟส 0, 1 |
| 4 | สถานะ "ทำเสร็จแล้ว" (`completedAt`) | กลาง | ❌ (runtime field) | เฟส 0, 1 |
| 5 | **Firebase Tier 1: FCM + Cloud Functions + Analytics/Remote Config** | กลาง-สูง | ✅ (Cloud Functions ใหม่) | เฟส 4 (แนะนำ ทำก่อนเพราะ due-checking ต้อง handle `completedAt` ให้ถูกก่อน) |
| 6 | Omnibar (rule-based → AI fallback) | สูง | ⚠️ (ถ้ามี AI fallback) | เฟส 1 |
| 7 | หน้าสถิติ (ใช้ Analytics จากเฟส 5) | ต่ำ-กลาง | ✅ (query อ่านอย่างเดียว) | เฟส 5 |

**แนะนำลำดับ:** 0(เสร็จแล้ว) → 1 → 2 → 4 → 3 → 5 → 6 → 7

**เหตุผลที่เฟส 5 อยู่หลังเฟส 4:** Cloud Function scheduler ต้อง query `enabled && !completedAt && nextDueAt <= now` — ถ้าเขียน query นี้ก่อนที่ `completedAt` field จะมีอยู่จริง (เฟส 4) ต้องกลับมาแก้ query ทีหลังอยู่ดี ทำเฟส 4 ให้เสร็จก่อนจะได้เขียน query ถูกตั้งแต่แรก

**หลักการทั่วไปที่ควรยึดตลอดทุกเฟส** (สืบทอดจาก v1 + เพิ่มจาก v2):
- ฟิลด์ใหม่ที่ sync ขึ้น backend ต้องแก้ allow-list สองจุดพร้อมกันเสมอ (`SCHEDULE_FIELD_KEYS` ฝั่ง frontend + `ALLOWED_FIELDS` ใน `routes/reminders.js`)
- runtime fields ที่ไม่ sync ต้องเว้นออกจาก allow-list ทั้งสองฝั่งอย่างตั้งใจ
- ทุก field ใหม่ที่กระทบ due-checking ต้องตรวจ `checkDue()`, `computeNextDueAt()`, `getReminderTimeSlots()` ครบทั้ง 7 types
- **(ใหม่ v2)** ตั้งแต่เฟส 5 เป็นต้นไป มี "สองที่" ที่ต้องคำนวณ due-logic ตรงกัน (client + Cloud Function) — ทุกครั้งที่แก้ `computeNextDueAt()` ฝั่งใดฝั่งหนึ่ง ต้องแก้อีกฝั่งพร้อมกันเสมอ ควรพิจารณา extract เป็น shared module ตั้งแต่เริ่มเฟส 5 แทนที่จะ copy-paste แล้วค่อยมาแก้ทีหลัง
