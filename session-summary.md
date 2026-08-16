# Session Summary — TIMES THE CALENDAR: Backend/Frontend Scan + Reminder Mode Redesign

**วันที่:** 15 สิงหาคม 2569 (อัปเดตล่าสุด — เฟส 1, 2, 3, 4 ของ migration plan v2 เสร็จแล้ว)
**จุดประสงค์:** สรุป session นี้เพื่อกลับมาทำต่อได้สะดวก — ครอบคลุมการสแกนโค้ดทั้ง stack, การเปลี่ยนแปลงที่พบ, เอกสารเจาะลึก reminder mode, แผนพัฒนา layout ใหม่ (v2), และความคืบหน้าการ implement จริง

## ⏭️ กลับมาทำต่อ เริ่มจากตรงนี้

**สถานะปัจจุบัน:** เฟส 0, 1, 2, 3, 4 เสร็จหมดแล้ว → **พร้อมเริ่มเฟส 5 (Firebase Tier 1: FCM + Cloud Functions)** ตามลำดับที่แผน v2 แนะนำ (0→1→2→4→3→5→6→7)

**⚠️ ไฟล์โค้ดที่แก้ไขจริงอยู่ที่ไหน — สำคัญมาก อ่านก่อนเริ่มงานถัดไป:**

ทุกไฟล์อยู่บน container ของ session นี้เท่านั้น (ไม่ใช่ `/mnt/user-data/uploads/` ที่ read-only) **จะหายไปถ้า container reset** ต้อง present/อัปโหลดกลับเข้ามาใหม่ทุกครั้งที่เริ่ม session ใหม่:

| ไฟล์ | Path บน container | สถานะ present |
|---|---|---|
| `reminder-mode.jsx` | `/home/claude/frontend/src/components/reminder-mode.jsx` | ⚠️ ต้องเช็คว่า present ล่าสุดหรือยัง |
| `use-reminder-groups.js` (ใหม่ เฟส 3) | `/home/claude/frontend/src/hooks/use-reminder-groups.js` | ⚠️ ยังไม่เคย present |
| `api.js` (แก้ไข เฟส 3) | `/home/claude/frontend/src/api.js` | ⚠️ ยังไม่เคย present |
| `firestore-db.js` (แก้ไข เฟส 3) | `/home/claude/backend/firestore-db.js` | ⚠️ ยังไม่เคย present |
| `index.js` (แก้ไข เฟส 3) | `/home/claude/backend/index.js` | ⚠️ ยังไม่เคย present |
| `routes/reminders.js` (แก้ไข เฟส 3) | `/home/claude/backend/routes/reminders.js` | ⚠️ ยังไม่เคย present |
| `routes/reminder-groups.js` (ใหม่ เฟส 3) | `/home/claude/backend/routes/reminder-groups.js` | ⚠️ ยังไม่เคย present |

**แผนที่ใช้งานจริง:** `reminder-mode-migration-plan-v2.md` (ไฟล์ `reminder-mode-migration-plan.md` เดิม/v1 **ถูกแทนที่แล้ว** — ใช้ v2 เท่านั้น)

**ไฟล์ที่สร้างไว้แล้วใน session นี้ (เรียงตามลำดับที่ควรอ่าน):**
1. `session-summary.md` — ไฟล์นี้ อ่านก่อนเป็นอันดับแรก
2. `reminder-mode-deep-dive.md` — เอกสารเจาะลึกโค้ด `reminder-mode.jsx` **ก่อนแก้ไขเฟส 1-4** — ใช้เป็น reference สถาปัตยกรรมเดิม (หลาย class name/comment ในนี้ไม่ตรงกับโค้ดล่าสุดแล้ว — ดูหัวข้อ 4.6/4.7 ด้านล่างสำหรับของที่เปลี่ยน)
3. `reminder-mode-migration-plan-v2.md` — แผนพัฒนาที่ใช้งานจริง (7 เฟส + เฟส 0 ที่ล็อกแล้ว)
4. ~~`reminder-mode-migration-plan.md`~~ — v1 เดิม ถูกแทนที่โดย v2 แล้ว ไม่ต้องอ้างอิงอีก

---

## 1. โครงสร้างโปรเจกต์ (ตาม `structure.md` ล่าสุด)

```
a-times-the-calendar/
├── backend/
│   ├── middleware/require-auth.js
│   ├── routes/{activity-categories,categories,reminders,summary}.js
│   ├── firestore-db.js, index.js
├── frontend/
│   ├── src/
│   │   ├── components/ (10 ไฟล์ — ดูหัวข้อ 3)
│   │   ├── hooks/ (7 ไฟล์ — ดูหัวข้อ 3)
│   │   ├── activity-colors.js, api.js, app.jsx, date-utils.js,
│   │   │   export-day-image.js, firebase-config.js, google-calendar.js,
│   │   │   i18n.jsx, id-utils.js, index.css, main.jsx, rrule-utils.js,
│   │   │   timeline-layout.js
├── z-database-document/data-model.md (ยังไม่ได้อ่าน)
├── z-project-document/ (overview.md, T.i.M.E.S. concept doc, DEPLOY.md — ยังไม่ได้อ่าน)
```

**สถานะแอป:** Public Production — React+Vite บน GitHub Pages, Node/Express บน Render.com, Firestore/Firebase Auth (Google login)

**หลักการสำคัญของแอป:** Google Calendar เป็น source of truth ของกิจกรรมจริง แอปนี้แค่เพิ่ม "ชั้นข้อมูลเสริม" (หมวดหมู่, tag, การล็อก) ทับผ่าน backend ของตัวเอง

**ไฟล์ที่ยังไม่ได้รับ/อ่าน:** `package.json`, `.env.example` ทั้งสองฝั่ง, `data-model.md`, `DEPLOY.md`, `project-planer01.md`, `firestore.rules`, `scripts/firestore-rules.test.js`

---

## 2. ความเปลี่ยนแปลงฝั่ง Backend (รอบอัปเกรดล่าสุด)

เทียบกับ `Backend.md` เดิม พบการทำ **hardening pass** ครอบคลุมทั้ง auth reliability + rate limiting + validation:

### ปิดงานค้างจาก `overview.md`
- **Rate limiting**: เพิ่ม `express-rate-limit` — 600 req/15 นาที ต่อ IP (~40 req/นาที) ครอบทุก endpoint ใต้ `/api`

### CORS เข้มงวดขึ้น
- จำกัด origin เหลือแค่ `localhost:5173` (dev) + `FRONTEND_URL` (env var สำหรับ prod) — เดิมน่าจะเปิดกว้างกว่านี้

### Reminder Mode Backend Sync (ใหม่ทั้งระบบ)
- Route ใหม่: `routes/reminders.js` → `/api/reminders` (GET/PUT/DELETE)
- Collection Firestore: `remindersCol` — ชื่อจริงคือ `"reminder-mode"` (ตั้งใจ ไม่ใช่ `"reminders"`) แต่ยัง nested ใต้ `users/{userId}/` เหมือน collection อื่น
- Sync เฉพาะ **schedule fields** เท่านั้น: `type, title, enabled, amount, unit, windowStart, windowEnd, days, time, atMs, afterAmount, afterUnit, durationMs, lineColor, eventName, steps`
- Validation: `MAX_DAYS=7`, `MAX_STEPS=50`, `MAX_STEP_JSON_LENGTH=20000`, `MAX_STRING_FIELD_LENGTH=200`

### Race-condition fix ใน `ensureDefaultCategoriesForUser` (`firestore-db.js`)
- เดิม check-then-write ธรรมดา ไม่ atomic — user ใหม่ยิงหลาย request พร้อมกันตอน mount ทำให้เขียนซ้ำ
- แก้ด้วย `runTransaction` คร่อม marker document (`users/{userId}.defaultCategoriesSeeded`)
- เพิ่ม in-memory cache ระดับ process (`seededUserIds` Set) ลด Firestore read ที่ไม่จำเป็น

### Validation เข้มงวดขึ้น
- `categories.js`: เช็ค type เข้มงวด, `NAME_MAX_LENGTH=60`, บังคับ hex color format
- `activity-categories.js`: validation `categoryId`, เพิ่มระบบ **tags** ใหม่ทั้งหมด (`TAG_MAX_LENGTH=40`, `TAGS_MAX_COUNT=20`, กันซ้ำ case-insensitive)
- `summary.js`: `MAX_ACTIVITIES_PER_REQUEST=2000` กัน client ส่ง array มหาศาล

### งานค้างที่ยังไม่แก้ (จาก `overview.md`)
- ยืนยันแอปกับ Google (ยังเห็นคำเตือน "แอปยังไม่ได้ยืนยัน")
- เฝ้าระวัง Cold Start ของ Render free tier (10-30 วิ)

---

## 3. ความเปลี่ยนแปลงฝั่ง Frontend (รอบอัปเกรดล่าสุด)

### 🔑 ระบบจัดการ Google Calendar token หมดอายุ — แก้บั๊กความไม่สอดคล้อง
เดิม error 401 บางจุดไม่เคลียร์ `calendarAccessToken` ทำให้ปุ่ม "ยืนยันตัวตนใหม่" ไม่โผล่

**กลไกใหม่:**
- `google-calendar.js`: เพิ่ม `isCalendarAuthExpiredError(error)` เช็คจาก `error.code === "CALENDAR_TOKEN_EXPIRED"` (แทนเทียบข้อความไทย)
- `use-calendar-data.js`, `use-tag-search.js`: เคลียร์ token เมื่อเจอ auth error
- `use-activity-mutations.js`: helper กลาง `clearTokenIfExpired(e)` ครบทั้ง 6 จุดเขียนข้อมูล
- **เพิ่มเติม**: ลด OAuth scope จาก `calendar` (เต็ม) เหลือ `calendar.events` (แคบลง) — ลดความเสียหายถ้า token รั่วจาก localStorage

### 🏷️ Rename ใหญ่: `AgendaView` → `ActivityMode`
- ไฟล์ `agenda-view.jsx` → `activity-mode.jsx`, component `AgendaView` → `ActivityMode`
- `mode` state: `"dashboard"` → `"activity"` (คู่กับ `"reminder"`)
- ⚠️ **ระวังสับสน**: `activity-modal.jsx` (ฟอร์มกิจกรรม) vs `activity-mode.jsx` (agenda view) — ชื่อใกล้กันมาก

### 🔄 Reminder Mode เชื่อม Backend จริงแล้ว
`reminder-mode.jsx` (เดิมชื่อ `reminder-mode-mockup.jsx`) ไม่ใช่ mockup อีกต่อไป — sync schedule fields ผ่าน `useRemindersSync` (ดูหัวข้อ 4 สำหรับรายละเอียดเต็ม)

### ไฟล์ที่ไม่เปลี่ยนแปลง (นอกจากคอมเมนต์)
`settings-drawer.jsx`, `weekly-summary-panel.jsx`, `mini-timeline-panel.jsx`, `use-activity-modal.js`, `use-auth.js`, `use-week-navigation.js` (นอกจาก mode rename), `tag-search-results.jsx`

---

## 4. Reminder Mode — สรุปสถาปัตยกรรมปัจจุบัน

*(รายละเอียดเต็มอยู่ใน `reminder-mode-deep-dive.md` — นี่คือสรุปย่อสำหรับอ้างอิงเร็ว)*

**Component:** `ReminderDashboard` (default export, import เป็น `ReminderMode` ใน `app.jsx`) — ~2,030 บรรทัด, self-contained รวม inline `<style>`

**7 ประเภท reminder:** `interval`, `weekly`, `event-anchored`, `routine`, `once-at`, `countdown`, `stopwatch` — แต่ละแบบมี logic คำนวณ "ครบกำหนด" ต่างกันใน `computeNextDueAt()`

**แยก field 2 กลุ่มชัดเจน:**
- **Schedule fields** (16 ตัว, sync ขึ้น Firebase): `type, title, enabled, amount, unit, windowStart, windowEnd, days, time, atMs, afterAmount, afterUnit, durationMs, lineColor, eventName, steps`
- **Runtime fields** (localStorage อย่างเดียว): `startedAt, accumulatedMs, currentIndex, lastTriggeredAt, nextDueAt`

**Time Engine หลัก:** `computeNextDueAt`, `getReminderTimeSlots` (ปักหมุดบน timeline), `getRunningLineSpan` (เส้นสีเหลือง shrink/grow ของ countdown/stopwatch)

**Due-checking:** loop ทุก 1 วินาที, banner สีแดงในหน้าเท่านั้น (**ไม่มี** Web Notification API/เสียง)

**Auto-scroll engine:** `requestAnimationFrame` + drift correction (แก้เมื่อคลาดเคลื่อน >5px, ดึงกลับทีละ 10%) + spacer 240px กันขอบ + `React.memo` บน `TimelineRows` (performance guard สำหรับ 1,440 แถวตอนซูมสูงสุด)

**Sync merge strategy:** ครั้งเดียวตอนโหลด (`hasMergedRemoteRef`) — schedule fields จาก remote ชนะ, runtime fields จาก local คงเดิม

**จุดเสี่ยงสำคัญที่ต้องจำ:**
1. ชื่อไฟล์ใกล้กัน: `activity-modal.jsx` / `activity-mode.jsx` / `reminder-mode.jsx`
2. `SCHEDULE_FIELD_KEYS` (frontend) ต้องตรงกับ `ALLOWED_FIELDS` (`backend/routes/reminders.js`) เป๊ะๆ — ไม่มี single source of truth ร่วมกัน
3. ไม่มี Notification API — ปิดแท็บแล้วพลาดแจ้งเตือนหมด (ยังไม่แก้จนกว่าจะถึงเฟส 5)
4. localStorage เป็น single point of failure ของ runtime state ทั้งหมด (stopwatch ที่กำลังเดิน, routine ค้างครึ่งทาง หายถ้าล้าง cache)
5. `routine` ไม่ auto-repeat — ทำครบ step แล้ว `enabled:false` ต้องเปิดเองใหม่

---

## 4.6. สิ่งที่แก้ไปแล้วจริงในโค้ด — เฟส 1 + เฟส 2 (session นี้)

โค้ดใน `reminder-mode.jsx` **ถูกแก้ไขจริงแล้ว** ไม่ใช่แค่วางแผน — ทุกจุดทดสอบผ่าน Playwright (render จริงด้วย React, ไม่ใช่แค่ syntax check) ทั้ง light/dark mode และ responsive แล้ว

### เฟส 1.1 — โครง 3 คอลัมน์ + Top bar
- เพิ่ม `<header className="app-topbar">`: โลโก้ "ReminderOS" + omnibar input (`disabled`, รอเฟส 6) + ปุ่มสถิติ (`disabled`, รอเฟส 7) — **ตั้งใจไม่ใส่ปุ่ม settings ซ้ำ** เพราะ `app.jsx` render ปุ่มของตัวเองอยู่แล้ว
- `.dashboard-body` grid เปลี่ยนจาก `380px 1fr` (2 คอลัมน์) → `260px 1fr 320px` (3 คอลัมน์)
- Timeline `<aside>` ย้ายจากซ้ายไปขวาสุดใน DOM order — **โค้ดข้างในไม่แตะเลย** (scroll engine, zoom, running-lines ทำงานเหมือนเดิมทุกอย่าง)
- เพิ่ม `<nav className="nav-sidebar">` ใหม่ (มุมมองหลัก / กลุ่ม-โปรเจกต์ / ตัวกรองประเภท)

### เฟส 1.2 — Tabs แทน section headers
- State ใหม่: `activeTab` (`"active"` | `"paused"` | `"completed"`)
- Tab "ทำเสร็จแล้ว" ยัง `disabled` (placeholder รอ `completedAt` field จากเฟส 4)
- Empty-state แยกข้อความตาม tab

### เฟส 1.3 — Due-banner: ปุ่มใหม่ + snooze dropdown
- `scheduleNext(reminderId, snoozeMinutes)` — เพิ่ม parameter ใหม่ (optional) ถ้าระบุจะ**เขียนทับ `nextDueAt` ตรงๆ** แทนคำนวณตาม type ปกติ ใช้ได้แม้กับ one-shot type (ปกติจะปิด `enabled` ถ้าไม่ระบุ snooze)
- Dropdown เลือกเวลา snooze (5/10/15/30 นาที หรือ "ตามรอบปกติ") — `SNOOZE_OPTIONS_MINUTES` constant
- ปุ่ม "✓ ทำเสร็จแล้ว" บน banner — `disabled` placeholder รอเฟส 4
- **ทดสอบจริงแบบ end-to-end**: สร้าง countdown 1 นาที รอ 60+ วิให้ due-checking loop จริงตรวจพบ ไม่ใช่ mock

### เฟส 1.4 — Redesign การ์ด
- `TYPE_ACCENT_COLOR` map — สีประจำแต่ละประเภท (border-left 4px + พื้นหลัง icon) แยก concern จาก enabled/disabled (สี = ประเภทเสมอ, ความจาง = สถานะ)
- เพิ่ม CSS vars ใหม่ `--g-purple`/`--g-teal` (hex เดียวกับ `LINE_COLOR_OPTIONS` เดิม ไม่ได้คิดโทนใหม่)
- Icon จากวงกลม → สี่เหลี่ยมมุมโค้ง (border-radius 8px)
- **เมนู "⋮" รวม edit/delete** แทนปุ่มแยก — state ใหม่ `cardMenuOpenId`, `snoozeMenuForId` + backdrop เดียวใช้ปิดทั้งสองเมนู (`closeAllMenus()`) ไม่ต้องเพิ่ม `document.addEventListener`

### เฟส 2 — Filter ตามประเภท (client-side ล้วนๆ ไม่กระทบ backend)
- State ใหม่: `activeTypeFilter` (`null` = ไม่กรอง) + `toggleTypeFilter()`
- `TYPE_FILTER_OPTIONS` extract เป็น module-level constant (ใช้ร่วมกันทั้ง nav list และ filter chip)
- ปุ่ม "ทั้งหมด" ใน nav = ทางลัดล้าง filter
- Filter chip บนหัวข้อ toolbar พร้อมปุ่ม ✕ ล้างอีกทาง
- `visibleActiveReminders`/`visiblePausedReminders` — รายการที่กรองแล้ว ใช้ render จริง ส่วน `activeReminders`/`pausedReminders` (ไม่กรอง) ยังคงไว้สำหรับ toolbar-subtitle ที่ต้องโชว์ยอดรวมเสมอ

**สรุป state ใหม่ที่เพิ่มเข้ามาทั้งหมดในเฟส 1+2:** `activeTab`, `cardMenuOpenId`, `snoozeMenuForId`, `activeTypeFilter` — ทั้งหมดเป็น local UI state ล้วนๆ ไม่กระทบ `reminders` state เดิมหรือ sync logic ใดๆ

---

## 4.7. สิ่งที่แก้ไปแล้วจริงในโค้ด — เฟส 3 + เฟส 4 (session นี้)

### เฟส 3 — Groups/Projects (แตะ backend จริง)

**Backend (4 ไฟล์):**
- `firestore-db.js`: เพิ่ม `reminderGroupsCol(userId)` — โครงเดียวกับ `categoriesCol` เป๊ะๆ (one-to-one ตามคำตอบเฟส 0 ข้อ 1)
- Route ใหม่ `routes/reminder-groups.js`: CRUD ครบ (`GET`/`POST`/`PUT`/`DELETE`) validation แบบเดียวกับ `categories.js` (hex color, name length ≤60)
- `routes/reminders.js`: เพิ่ม `groupId` เข้า `ALLOWED_FIELDS` พร้อม async existence-check ก่อนรับบันทึก (เหมือน `categoryId` ฝั่ง `activity-categories.js`)
- `index.js`: mount `/api/reminder-groups`
- **DELETE group behavior (สำคัญ ตรงตามเฟส 0):** ลบกลุ่ม → batch update เคลียร์ `groupId: null` บน reminder ที่ผูกอยู่ทั้งหมด **ไม่ลบ reminder ทิ้ง**

**Frontend (3 ไฟล์):**
- `api.js`: เพิ่ม `fetchReminderGroups`/`createReminderGroup`/`deleteReminderGroup`
- Hook ใหม่ `use-reminder-groups.js`: โหลดตอน login, เขียนขึ้น backend ทันที (ไม่มี local-first/debounce เหมือน reminder เอง เพราะกลุ่มไม่มี runtime state ที่เปลี่ยนถี่)
- `reminder-mode.jsx`: `groupId` เพิ่มเข้า `SCHEDULE_FIELD_KEYS` (default `null` ชัดเจนเสมอ ไม่ใช่ `undefined` — ไม่งั้นการ "เอาออกจากกลุ่ม" จะไม่ sync), nav sidebar "กลุ่ม/โปรเจกต์" wired จริงครบ (สร้าง/ลบ/กรอง), `activeGroupFilter` รวมกับ `activeTypeFilter` แบบ AND ได้, composer มี dropdown เลือกกลุ่ม, การ์ดแสดง group chip

**การทดสอบ:** ต่างจากเฟส 1-2 ที่ stub `useRemindersSync` — เฟสนี้ **รันจริงทั้ง stack** เพราะสร้าง in-memory Firestore mock + Express-compatible shim เอง (sandbox ไม่มี network ให้ `npm install express`) แล้วรัน mock backend จริงบน port 4000 คู่กับ preview → ยืนยันด้วย Playwright ทั้งสร้าง/ลบ/กรองกลุ่ม รวมถึงกฎสำคัญ "ลบกลุ่มแล้ว reminder ต้องยังอยู่" — **backend logic ยังผ่าน functional test 16/16 เคสแยกต่างหากด้วย** (ไม่ใช่แค่ syntax check)

### เฟส 4 — สถานะ "ทำเสร็จแล้ว" (ไม่แตะ backend — runtime field)

- `completedAt` (timestamp \| null) — default `null` ตอนสร้างใหม่, **คงค่าเดิมไว้ตอนแก้ไข** (edit แค่ชื่อไม่ทำให้หลุดจาก tab ทำเสร็จแล้ว)
- `checkDue()` กรอง `!r.completedAt` ออกจาก due-banner เพิ่มเติม
- **`markCompleted(reminderId)` — พฤติกรรมต่าง type กันตามที่ระบุไว้ในแผน:**
  - One-shot (`once-at`/`countdown`): เซ็ต `completedAt`, ปิด `enabled`, ค้าง tab "ทำเสร็จแล้ว" ถาวร
  - วนซ้ำ (`interval`/`weekly`/`event-anchored`): reschedule รอบถัดไปเฉยๆ (เหมือน "เตือนอีกครั้ง") **ไม่เคยเข้า tab ทำเสร็จแล้ว** — ยืนยันด้วย test จริงแล้ว
- `advanceRoutine`: ทำครบทุก step → เซ็ต `completedAt` ด้วย (นอกจาก `enabled:false` เดิม)
- `toggle()`: เปิดสวิตช์กลับ → เคลียร์ `completedAt` เป็น `null` เสมอ (คืนสถานะจาก tab ทำเสร็จแล้วกลับ active ได้ทันที) — countdown ยังรีสตาร์ทตัวจับเวลาใหม่ให้ถูกต้องด้วย (ไม่ใช่โผล่มาเป็นค่าติดลบ/หมดอายุทันที)
- Tab "ทำเสร็จแล้ว" ผูก `completedReminders` จริงแล้ว (เดิม disabled placeholder จากเฟส 1)
- ปุ่ม "✓ ทำเสร็จแล้ว" บน due-banner ผูก `markCompleted` จริง (เดิม disabled placeholder)
- เพิ่มตัวเลือก "✓ ทำเสร็จแล้ว" ในเมนู "⋮" ของการ์ด — **เฉพาะ one-shot type ที่ยังไม่เคย complete** (ไม่ต้องรอถึงเวลา due จริง) — ส่วนขยายเล็กๆ ที่ไม่ได้ระบุตรงๆ ในแผน แต่จำเป็นเพื่อให้ฟีเจอร์ใช้งานได้จริงโดยไม่ต้องรอ
- Badge "✓ ทำเสร็จแล้ว" สีเขียวบนการ์ด แยกให้เห็นชัดจาก "ปิดใช้งาน" เฉยๆ (ทั้งคู่ `enabled:false` เหมือนกันแต่ความหมายคนละเรื่อง)

**การทดสอบ:** end-to-end จริงผ่าน Playwright — สร้าง countdown+interval รอ 65 วินาทีจริงให้ due-checking loop ตรวจพบจริง (ไม่ mock), กด "ทำเสร็จแล้ว" ทั้งคู่พร้อมกัน, ยืนยันว่า countdown ค้างอยู่ completed tab ถาวรแต่ interval กลับไป active tab ปกติ (พฤติกรรมต่าง type ตามที่ออกแบบ), ทดสอบ manual-complete ผ่านเมนู "⋮" กับ once-at, ทดสอบ restore ผ่าน toggle-switch กลับจาก completed tab — ผ่านครบทุกจุด ไม่มี regression

---

## 4.5. Firebase Services ที่จะนำมาใช้ (ตัดสินใจแล้ว)

**Tier ที่เลือก: Tier 1** (ผูกกับ Firebase project เดิมโดยตรง ไม่ต้องตั้ง billing/credential แยก)

| บริการ | ใช้ทำอะไร |
|---|---|
| **Firebase Cloud Messaging (FCM)** | Push notification เมื่อ reminder due แม้ปิดแท็บ — แก้จุดอ่อนใหญ่สุดของฟีเจอร์ปัจจุบัน (ตอนนี้ due-checking เป็น client-side `setInterval` ล้วนๆ) |
| **Cloud Functions + Cloud Scheduler** | รัน scheduler เช็ค due reminder ทุก 1 นาที (server-side) แล้วยิง FCM — ต้อง duplicate `computeNextDueAt()` logic เป็น Cloud Function แยก (ดูเหตุผลใน v2 เฟส 5) |
| **Firebase Analytics** | เก็บ event (`reminder_snoozed`, `reminder_completed`, `reminder_created`) เป็นฐานให้หน้าสถิติ (เฟส 7) โดยไม่ต้องสร้างระบบ log เอง |
| **Firebase Remote Config** | เปิด/ปิดฟีเจอร์ Omnibar (เฟส 6) แบบ rollout ค่อยเป็นค่อยไปไม่ต้อง redeploy |

**Tier 2 (ยังไม่เลือกใช้ตอนนี้ — Gemini API, Speech-to-Text)**: อยู่ใน ecosystem เดียวกันแต่ setup ยุ่งกว่า (ต้องผูก billing/API key แยกจาก Firebase free tier) — เก็บไว้พิจารณาทีหลังสำหรับ Omnibar AI fallback (เฟส 6.3) แต่ไม่ผูกมัดว่าต้องเป็น Gemini เท่านั้น

---

## 5. Mockup ใหม่ "ReminderOS" — สิ่งที่เสนอ

ไฟล์: `reminder-dashboard-mockup.jsx` (211 บรรทัด, static mockup ยังไม่มี logic จริง)

**เปลี่ยน layout จาก 2 คอลัมน์ → top bar + 3 คอลัมน์:**

| ส่วน | เดิม | ใหม่ |
|---|---|---|
| Header | ไม่มี | Top bar: โลโก้ "ReminderOS" + Omnibar (สร้างด่วนด้วยข้อความธรรมชาติ) + ปุ่มสถิติ/ตั้งค่า |
| Navigation | ไม่มี | คอลัมน์ซ้ายใหม่: มุมมองหลัก, **Groups/Projects** (ใหม่), ตัวกรองตามประเภท (7 types + count) |
| รายการ | active/paused section คั่นหัวข้อ | **Tabs**: กำลังทำงาน/ปิดใช้งาน/**ทำเสร็จแล้ว** (สถานะใหม่) |
| Timeline | คอลัมน์ซ้าย | ย้ายไปคอลัมน์ขวาสุด (แนวคิดเดิมทั้งหมด) |
| Due banner | ปุ่ม "เตือนอีกครั้ง" อย่างเดียว | เพิ่มปุ่ม "ทำเสร็จแล้ว" + snooze ระบุเวลาได้ |

**ฟีเจอร์ใหม่ที่ยังไม่มี data model รองรับ:** Groups/Projects, สถานะ "ทำเสร็จแล้ว" (ที่ 3), Omnibar NLP parser, หน้าสถิติ, ปุ่ม "⋮" per-card

---

## 6. แผนพัฒนา v2 — สรุปย่อ (เต็มอยู่ใน `reminder-mode-migration-plan-v2.md`)

| เฟส | เนื้อหา | ความเสี่ยง | แตะ backend? | สถานะ |
|---|---|---|---|---|
| 0 | ตัดสินใจ 4 คำถาม schema/scope | - | - | ✅ **ล็อกแล้ว** |
| 1 | Layout 3 คอลัมน์ + tabs + redesign การ์ด | ต่ำ | ❌ | ✅ **เสร็จแล้ว** (ดูหัวข้อ 4.6) |
| 2 | Filter ตามประเภท | ต่ำ | ❌ | ✅ **เสร็จแล้ว** (ดูหัวข้อ 4.6) |
| 3 | Groups/Projects (one-to-one + sync) | กลาง-สูง | ✅ | ✅ **เสร็จแล้ว** (ดูหัวข้อ 4.7) |
| 4 | สถานะ "ทำเสร็จแล้ว" (`completedAt`) | กลาง | ❌ (runtime field) | ✅ **เสร็จแล้ว** (ดูหัวข้อ 4.7) |
| 5 | **Firebase Tier 1: FCM + Cloud Functions + Analytics/Remote Config** | กลาง-สูง | ✅ (Cloud Functions ใหม่) | ⏭️ **พร้อมเริ่มถัดไป** |
| 6 | Omnibar (rule-based → AI fallback) | สูง | ⚠️ ถ้ามี AI fallback | ยังไม่เริ่ม |
| 7 | หน้าสถิติ (ใช้ Analytics จากเฟส 5) | ต่ำ-กลาง | ✅ query อ่านอย่างเดียว | ยังไม่เริ่ม |

**ลำดับแนะนำ:** 0(เสร็จ) → 1(เสร็จ) → 2(เสร็จ) → 4(เสร็จ) → 3(เสร็จ) → **5** → 6 → 7

### คำตอบเฟส 0 (ล็อกแล้ว — ใช้เป็น reference ตอนเขียนโค้ดจริง)
1. **Groups**: one-to-one ต่อ reminder ตาม pattern `categories`/`activityCategoryMap` ฝั่ง calendar — ลบกลุ่มแล้ว fallback เป็น "ไม่มีกลุ่ม" ไม่ลบ reminder ทิ้ง
2. **Groups sync**: ต้อง sync ขึ้น backend (ข้ามเครื่องได้)
3. **"ทำเสร็จแล้ว"**: field ใหม่ `completedAt` (timestamp \| null) แยกจาก `enabled` — runtime field ไม่ sync backend (MVP)
4. **Omnibar**: rule-based ก่อน แล้วค่อย AI fallback ทีหลัง (ไม่ผูกมัด provider — Gemini เป็นแค่ตัวเลือกหนึ่ง)

### จุดสำคัญที่เพิ่มใน v2 (ไม่มีใน v1)
- **เฟส 4 ต้องทำก่อนเฟส 5**: Cloud Function scheduler (เฟส 5) ต้อง query ด้วย field `completedAt` — ถ้าทำสลับกันต้องกลับมาแก้ query ทีหลัง
- **เฟส 5 มีความเสี่ยงเฉพาะ**: ต้อง duplicate `computeNextDueAt()` เป็น Cloud Function แยก (แนะนำมากกว่าการ sync `nextDueAt` ขึ้น Firestore ถี่ๆ) — ต้องรักษาให้ client/server คำนวณตรงกันเสมอ ควร extract เป็น shared module ตั้งแต่เริ่มเฟส 5
- Collection group query ข้าม user ทุกคนทุก 1 นาที (เฟส 5) ต้องมี composite index ที่ถูกต้อง ไม่งั้น query ช้า/แพงเมื่อ user เยอะขึ้น
- ต้องจัดการ duplicate notification เมื่อแอปเปิดอยู่พร้อมกับ FCM ส่งมาพอดี (ใช้ `onMessage` foreground handler แยกจาก background push)

**หลักการยึดทุกเฟส:** field ใหม่ที่ sync ต้องแก้ allow-list 2 จุดพร้อมกันเสมอ (`SCHEDULE_FIELD_KEYS` + `ALLOWED_FIELDS`), field ใหม่ที่กระทบ due-checking ต้องตรวจ `checkDue()`/`computeNextDueAt()`/`getReminderTimeSlots()` ครบทั้ง 7 types, ตั้งแต่เฟส 5 เป็นต้นไปต้องรักษา due-logic client/server ให้ตรงกันเสมอ

---

## 7. งานที่ยังไม่ได้ทำ (ต่อยอดได้)

**ลำดับความสำคัญสูงสุดตอนนี้:** เริ่มเฟส 5 (Firebase Tier 1) — จุดเริ่มต้นที่ดีที่สุดคือทำ prerequisite ก่อน: ตัดสินใจว่าจะ duplicate `computeNextDueAt()` เป็น Cloud Function แยก (แนะนำในแผน) หรือ sync `nextDueAt` ขึ้น Firestore ถี่ๆ แทน แล้วค่อย setup FCM + Service Worker ฝั่ง frontend

**⚠️ ก่อนเริ่มงานถัดไป ต้อง present ไฟล์โค้ดทั้ง 7 ไฟล์ที่ระบุไว้ในตารางหัวข้อ "⏭️ กลับมาทำต่อ" ด้านบนให้ผู้ใช้ก่อน** — ยังไม่เคย present ออกไปเลยสักไฟล์ตลอด session นี้ ถ้า container reset งานเฟส 1-4 ทั้งหมดจะหายไปด้วย

**งานค้างอื่นๆ:**
- ยังไม่ได้อ่าน: `data-model.md`, `DEPLOY.md`, `project-planer01.md`, `firestore.rules`, `scripts/firestore-rules.test.js`, `package.json` ทั้งสองฝั่ง
- ยังไม่ได้อัปเดต `Frontend.md`/`Backend.md` ให้ตรงกับโค้ดจริงปัจจุบัน (ทั้งสองไฟล์เก่ากว่าโค้ดที่สแกนไปแล้ว — ตอนนี้ยิ่งห่างจากของจริงมากขึ้นไปอีกหลังเฟส 1-4)
- ยังไม่ได้ดู `data-model.md` เพื่อยืนยันว่า schema ที่เพิ่มเข้าไปจริงแล้ว (`reminderGroups` collection, `groupId`/`completedAt` fields) สอดคล้องกับ data model ที่มีอยู่แล้วของทั้งระบบหรือไม่
- เฟส 6.3 (AI fallback ของ Omnibar) ยังไม่เลือก provider จริง (Gemini เป็นแค่ตัวเลือกหนึ่งใน Tier 2 ที่ยังไม่ได้ตัดสินใจ)
- `reminder-mode-deep-dive.md` เขียนขึ้นก่อนเฟส 1-4 ทั้งหมด — ไม่ตรงกับโค้ดปัจจุบันในหลายจุดแล้ว (layout 2→3 คอลัมน์, class name เปลี่ยนความหมาย, ไม่มี groups/completedAt เลยในเอกสารเดิม) — ใช้หัวข้อ 4.6/4.7 ในไฟล์นี้เป็นตัวอัปเดตแทน ยังไม่ได้แก้ตัวเอกสารเจาะลึกเอง
- Backend test harness (in-memory Firestore mock + Express shim) ที่สร้างขึ้นเพื่อทดสอบเฟส 3 อยู่ที่ `/home/claude/backend-test/` — เป็นเครื่องมือทดสอบเท่านั้น ไม่ใช่ส่วนหนึ่งของโปรเจกต์จริง ไม่ต้อง present แต่มีประโยชน์ถ้าต้องทดสอบ backend เพิ่มเติมในเฟสถัดไป (โดยเฉพาะเฟส 5 ที่จะมี Cloud Function ใหม่)
