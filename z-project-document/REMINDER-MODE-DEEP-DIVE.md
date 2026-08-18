# `reminder-mode.jsx` — เจาะลึก

**Path:** `frontend/src/components/reminder-mode.jsx`
**ขนาด:** ~2,970 บรรทัด (เกือบทั้งหมดอยู่ในไฟล์เดียว รวม CSS แบบ inline `<style>`)
**Component export:** `ReminderDashboard` (default export — แต่ import เข้า `app.jsx` ในชื่อ `ReminderMode`)
**สถานะ:** ผ่าน migration plan v2 เฟส 1-4 ครบสมบูรณ์ (layout ใหม่ 3 คอลัมน์, filter, groups, completed status) + เฟส 5 (push notification) วางโครงไว้แล้ว ทดสอบ logic ผ่าน mock ครบ — **ยังไม่เคย deploy Cloud Function จริง** (ดูหัวข้อ 11)

> 📄 เอกสารนี้เป็นเวอร์ชันอัปเดตหลังเฟส 1-5 — ถ้าเจอ class name หรือโครงสร้างที่ไม่ตรงกับโค้ดจริง ให้ยึดโค้ดจริงเป็นหลัก เอกสารนี้อาจตามหลังได้ถ้ามีการแก้ไขเพิ่มเติมหลังจากเขียนฉบับนี้

---

## 1. ภาพรวม: คืออะไร

โหมดที่สองของแอป (สลับกับโหมด "activity"/ปฏิทินหลัก ผ่าน `mode` state ใน `use-week-navigation.js`) — เป็น**แดชบอร์ดแจ้งเตือนแบบ standalone** ("ReminderOS") ที่มี:

1. **Top bar** — โลโก้, ช่อง omnibar (placeholder รอเฟส 6), ปุ่มกระดิ่งเปิด/ปิด push notification (เฟส 5), ปุ่มสถิติ (placeholder รอเฟส 7)
2. **Left nav (คอลัมน์ซ้าย)** — มุมมองหลัก, กลุ่ม/โปรเจกต์ (เฟส 3), ตัวกรองตามประเภท (เฟส 2)
3. **Main panel (คอลัมน์กลาง)** — toolbar, composer, tabs 3 อัน (กำลังทำงาน/ปิดใช้งาน/ทำเสร็จแล้ว — เฟส 4), รายการการ์ด reminder
4. **Timeline panel (คอลัมน์ขวา)** — 24 ชั่วโมงแนวตั้ง เลื่อนไหลตามเวลาจริงแบบต่อเนื่อง
5. **Due Alert Banner** ด้านบนสุด — โผล่มาเมื่อมี reminder ถึงกำหนด พร้อม snooze dropdown + ปุ่มทำเสร็จแล้ว

ข้อมูล reminder ทั้งก้อน (รวม runtime state) เก็บใน **`localStorage`** เป็น source of truth หลัก — Firebase backend (ผ่าน `use-reminders-sync.js`) เป็นแค่ **mirror ของ schedule fields เท่านั้น** กลุ่ม/โปรเจกต์ (เฟส 3) เป็นข้อยกเว้น — sync ทันทีขึ้น backend เสมอ ไม่มี local-first layer

---

## 2. โมเดลข้อมูล: Reminder 7 ประเภท + Groups

ทุก reminder เป็น object แบนราบ เก็บใน array `reminders` (state หลักของ component) คีย์ `type` กำหนดว่าฟิลด์ไหนมีความหมาย:

| Type | ความหมาย | ฟิลด์เฉพาะ | มี "ครบกำหนด" ไหม |
|---|---|---|---|
| `interval` | วนซ้ำทุก N นาที/ชั่วโมง | `amount`, `unit`, `windowStart`/`windowEnd` (optional) | ✅ |
| `weekly` | เกิดซ้ำตามวันในสัปดาห์ที่เลือก | `days[]` (0-6), `time` ("HH:mm") | ✅ |
| `event-anchored` | นับถอยจาก "เหตุการณ์" ที่ผู้ใช้กดเริ่มเอง | `eventName`, `afterAmount`, `afterUnit`, `lastTriggeredAt` | ✅ (หลังกดเริ่มเหตุการณ์) |
| `routine` | ชุดขั้นตอนต่อเนื่อง (checklist) | `steps[]`, `currentIndex` | ❌ (ไม่มีเวลาตายตัว) |
| `once-at` | เตือนครั้งเดียวตามวันที่/เวลาที่ระบุ | `atMs` | ✅ ครั้งเดียว |
| `countdown` | นับถอยหลัง (Timer) | `startedAt`, `durationMs`, `lineColor` | ✅ |
| `stopwatch` | จับเวลานับขึ้น ไม่มีการแจ้งเตือน | `accumulatedMs`, `startedAt`, `lineColor` | ❌ |

**ฟิลด์ร่วมทุกประเภท:** `id`, `title`, `type`, `enabled`, `groupId` (เฟส 3), `completedAt` (เฟส 4), `nextDueAt`

### ฟิลด์ Schedule vs Runtime

- **Schedule fields** (17 ตัว, กำหนดใน `SCHEDULE_FIELD_KEYS`): `type, title, enabled, amount, unit, windowStart, windowEnd, days, time, atMs, afterAmount, afterUnit, durationMs, lineColor, eventName, steps, groupId` — sync ขึ้น Firebase ผ่าน `syncScheduleFields()`, ต้องตรงกับ `ALLOWED_FIELDS` ใน backend `routes/reminders.js` เป๊ะๆ (`groupId` เพิ่มเข้ามาเฟส 3 — ต้อง default เป็น `null` อย่างชัดเจนเสมอ ไม่ใช่ `undefined` มิฉะนั้นการ "เอา reminder ออกจากกลุ่ม" จะไม่ sync)
- **Runtime fields** (ไม่ sync เลย): `startedAt`, `accumulatedMs`, `currentIndex`, `lastTriggeredAt`, `nextDueAt`, `completedAt` (เฟส 4) — อยู่ localStorage อย่างเดียว

### Groups/Projects (เฟส 3) — one-to-one

- `groupId` บน reminder ผูกกับกลุ่มแบบ **one-to-one** ตาม pattern เดียวกับ `categories` ฝั่งปฏิทิน
- ลบกลุ่ม → backend เคลียร์ `groupId` เป็น `null` บน reminder ที่ผูกอยู่ทั้งหมด **ไม่ลบ reminder ทิ้ง**
- Hook แยก `use-reminder-groups.js` — เขียนขึ้น backend ทันที ไม่มี local-first
- สีกลุ่มสุ่ม/วนจาก `GROUP_COLOR_PALETTE` อัตโนมัติตอนสร้าง (ผู้ใช้พิมพ์แค่ชื่อ)

---

## 3. Time Engine: การคำนวณ "ครบกำหนดเมื่อไหร่"

⚠️ **เปลี่ยนสำคัญ (เฟส 5):** ฟังก์ชัน pure ทั้งหมด (`REMINDER_TYPE`, `isOneShotType`, `intervalMs`, `hasWindow`, `minuteOfDayAt`, `minutesFromHHMM`, `isMinuteWithinWindow`, `snapToNextWindowStart`, `computeNextDueAt`) **ถูกย้ายออกไปอยู่ที่ `frontend/src/reminder-due-logic.js`** แล้ว — `reminder-mode.jsx` แค่ `import` เข้ามาใช้

**เหตุผล:** เฟส 5 ต้องมี Cloud Function ตรวจ due reminder ฝั่ง server — ต้องคำนวณ "ถึงกำหนดเมื่อไหร่" ตรงกับ client เป๊ะๆ จึงแยกออกมาเป็น shared module

⚠️ **ข้อจำกัด:** `functions/` เป็นคนละ npm package (CommonJS) จาก `frontend/` (ESM) จึง import ข้ามกันตรงๆ ไม่ได้ — มี **`functions/reminder-due-logic.js` เป็นสำเนา CommonJS แยกต่างหาก** ที่ต้อง sync มือทุกครั้ง (ดูหัวข้อ 11 ข้อ 6)

### `computeNextDueAt(reminder, from)` (import จาก `../reminder-due-logic.js`)
- **`interval`**: `from + intervalMs` → snap เข้า window ถ้ามี
- **`weekly`**: loop 8 วัน หาวันแรกที่ตรงกับ `days[]`
- **`event-anchored`**: `Infinity` ถ้ายังไม่เคย trigger, `lastTriggeredAt + afterAmount` ถ้าเคยแล้ว
- **`routine`**: คืน `from` ตรงๆ
- **`once-at`**: คืน `atMs`
- **`countdown`**: `startedAt + durationMs`
- **`stopwatch`**: `Infinity` เสมอ

### `isReminderDue(reminder, now)` — ใหม่ในเฟส 5
รวมเงื่อนไข "ควรอยู่ใน due-checking ไหม" ไว้จุดเดียว (`enabled && !completedAt && nextDueAt <= now && ไม่ใช่ routine/stopwatch`) — `checkDue()` เรียกใช้ฟังก์ชันนี้แทนการเขียนเงื่อนไขซ้ำ เพื่อให้ Cloud Function ใช้เงื่อนไขเดียวกันได้ผ่านสำเนา CommonJS

### `getReminderTimeSlots` / `getRunningLineSpan`
ยังอยู่ใน `reminder-mode.jsx` เอง (เป็นเรื่อง visualization ไม่ใช่ due-logic ที่ Cloud Function ต้องใช้) — ไม่เปลี่ยนแปลง logic เดิมเลย

---

## 4. Due-Checking Loop + Snooze + Completed (เฟส 1-4)

```js
const checkDue = () => {
  const now = Date.now();
  setNowTick(now);
  const due = reminders.filter((r) => isReminderDue(r, now)); // ← shared helper (เฟส 5)
  setDueReminders(due);
};
// setInterval(checkDue, 1000)
```

- รันทุก **1 วินาที** — banner ในหน้าเท่านั้น (ยังไม่มี Web Notification API ในตัว component นี้เอง จนกว่า Cloud Function เฟส 5 จะ deploy จริง)
- กรอง `routine`/`stopwatch` ออกเสมอ, เพิ่ม `!completedAt` (เฟส 4)

### Snooze dropdown (เฟส 1.3)
`scheduleNext(reminderId, snoozeMinutes?)`:
- ระบุ `snoozeMinutes` → เขียนทับ `nextDueAt = now + snoozeMinutes * 60000` ตรงๆ (ใช้ได้แม้กับ one-shot type — คง `enabled: true`)
- ไม่ระบุ → one-shot ปิด `enabled`, อื่นๆ → `computeNextDueAt` ปกติ

### "ทำเสร็จแล้ว" — `markCompleted(reminderId)` (เฟส 4)
- **One-shot (`once-at`/`countdown`)**: เซ็ต `completedAt`, ปิด `enabled`, ค้าง tab "ทำเสร็จแล้ว" ถาวร
- **วนซ้ำ (`interval`/`weekly`/`event-anchored`)**: reschedule รอบถัดไปเฉยๆ — **ไม่เคยตั้ง `completedAt`** ไม่ค้าง tab ทำเสร็จแล้ว

เรียกได้จากทั้ง due-banner และเมนู "⋮" ของการ์ด (เฉพาะ one-shot type ที่ยังไม่เคย complete)

`advanceRoutine` ก็ตั้ง `completedAt` ด้วยเมื่อทำครบทุก step

### `toggle(reminderId)` — เปิดสวิตช์กลับ
เคลียร์ `completedAt` เป็น `null` เสมอ — countdown รีสตาร์ทตัวจับเวลาใหม่ (`startedAt: Date.now()`)

---

## 5. Auto-Scroll Engine: Timeline ที่ "ไหล" ตามเวลาจริง

Logic ไม่เปลี่ยนแปลงจากเดิมเลย — แค่ `<aside className="timeline-panel">` **ย้ายจากคอลัมน์ซ้ายไปขวาสุด** (layout 3 คอลัมน์ เฟส 1.1)

**หลักการ:** `requestAnimationFrame` loop + drift correction (ดึงกลับ 10% ถ้าคลาดเกิน 5px) + user interaction override (หยุด 3 วินาที) + spacer 240px กันขอบ + `React.memo` บน `TimelineRows` — **Zoom**: `ZOOM_LEVELS_MINUTES = [60, 15, 5, 1]` เริ่มที่ 15

---

## 6. Sync กับ Backend: 3 Hooks ทำงานร่วมกัน

### `useRemindersSync({ firebaseUser })` — reminder เอง
- Merge ครั้งเดียวตอนโหลด (`hasMergedRemoteRef`): schedule fields จาก remote ชนะ, runtime fields จาก local คงเดิม
- `submitReminderForm` → `syncScheduleFields(id, extractScheduleFields(reminder), { immediate: true })`
- `deleteReminder` → `deleteRemoteReminder(id)` fire-and-forget

### `useReminderGroups({ firebaseUser })` — กลุ่ม (เฟส 3)
- โหลดตอน login, เขียนขึ้น backend ทันทีทุกครั้ง ไม่มี local-first
- `handleDeleteGroup` ใน `reminder-mode.jsx` ต้อง patch local `reminders` state เองหลัง `removeGroup` สำเร็จ (เคลียร์ `groupId` ของ reminder ที่ผูก) เพราะ hook นี้ไม่รู้จัก `reminders` state

### `usePushNotifications({ firebaseUser })` — FCM token (เฟส 5)
- จัดการ browser permission + ลงทะเบียน/ยกเลิก FCM token กับ backend
- ไม่ sync กับ `reminders` เลย เป็นคนละ concern

**สิ่งที่ไม่ sync เลย**: toggle เปิด/ปิด, stopwatch controls, routine advance, event-anchored trigger, `completedAt` (runtime field)

---

## 7. Composer (ฟอร์มสร้าง/แก้ไข)

- **Inline expand/collapse** — พับเก็บเป็นค่าเริ่มต้น
- Field เปลี่ยนไปตาม `draft.type`
- **Dropdown เลือกกลุ่ม** (เฟส 3) — แสดงเฉพาะเมื่อมีกลุ่มอย่างน้อย 1 กลุ่มแล้ว
- Validation เฉพาะตอนสร้างใหม่: `once-at` ต้องเป็นอนาคต — ไม่ตรวจตอนแก้ไข
- `stopwatch`/`completedAt`: คงค่าเดิมไว้ตอนแก้ไข ไม่รีเซ็ต

---

## 8. UI Layout สรุป — 3 คอลัมน์ (เปลี่ยนจาก 2 คอลัมน์เดิม เฟส 1.1)

```
┌──────────────────────────────────────────────────────────────────┐
│ Top bar: โลโก้ / omnibar (placeholder) / 🔔 push / 📊 (placeholder) │
├──────────────┬──────────────────────────────┬────────────────────┤
│ 🔔 Due Alert Banner (snooze dropdown + ทำเสร็จแล้ว)                  │
├──────────────┼──────────────────────────────┼────────────────────┤
│ Left Nav     │  Toolbar + filter chip        │  Timeline 24 ชม.   │
│ 260px        │  Tabs: กำลังทำงาน/ปิดใช้งาน/   │  320px             │
│              │        ทำเสร็จแล้ว             │  (ย้ายมาขวา เฟส 1) │
│ มุมมองหลัก    │                                │                    │
│ กลุ่ม/โปรเจกต์ │  [Composer — ถ้าเปิดอยู่]        │  now-indicator +   │
│ (เฟส 3)       │                                │  running-timer     │
│              │  [reminder card] × N           │                    │
│ ตัวกรองประเภท  │  (icon สี่เหลี่ยม + border-left │                    │
│ (เฟส 2)       │   สีตามประเภท + group chip     │                    │
│              │   + completed badge)            │                    │
└──────────────┴──────────────────────────────┴────────────────────┘
```

**Card design** (เฟส 1.4): icon สี่เหลี่ยมมุมโค้ง (เดิมวงกลม) พื้นหลังสีตาม `TYPE_ACCENT_COLOR` (สี = ประเภทเสมอ, ความจาง = สถานะ), border-left 4px, เมนู "⋮" รวม edit/delete (เดิมเป็นปุ่มแยก 2 ปุ่ม), group chip (ถ้ามีกลุ่ม), completed badge สีเขียว (ถ้าทำเสร็จแล้ว)

**Filter** (เฟส 2+3): `activeTypeFilter` + `activeGroupFilter` รวมกันแบบ AND — filter chip โชว์บน toolbar พร้อมปุ่ม ✕ ล้างแยกแต่ละตัว, tab count ปรับตาม filter ที่เปิดอยู่, toolbar-subtitle ยังคงยอดรวมทั้งหมดเสมอ

**CSS namespace**: ยังใช้ `--g-*` custom properties แยกจาก `--bg`/`--text-primary` ของแอปหลัก — dark mode ทำงานถูกต้องโดยไม่ต้องเพิ่ม override

---

## 9. Push Notifications (เฟส 5)

⚠️ **สถานะ: วางโครงไว้แล้ว โค้ด+backend ทดสอบผ่าน mock ครบ — Cloud Function ยัง deploy จริงไม่ได้**

- ปุ่มกระดิ่ง 🔔/🔕 ใน topbar — ไม่ auto-request permission ตอน mount
- `permission` state: `"unsupported"` | `"default"` | `"granted"` | `"denied"`
- กด "เปิด" → `Notification.requestPermission()` → ถ้า granted → `getToken()` จาก Firebase Messaging SDK (ต้องมี `VITE_FIREBASE_VAPID_KEY`) → ส่ง token ไป backend (`registerFcmToken`)
- Service worker scaffold: `frontend/public/firebase-messaging-sw.js` — ยังมี `"TODO_ใส่ค่าจริงตอน_deploy"` ทุกฟิลด์
- Backend: `routes/fcm-tokens.js` + `fcmTokensCol` — ใช้ token เองเป็น doc id (upsert อัตโนมัติ) — ทดสอบผ่าน functional test 12/12 เคส
- Cloud Function: `functions/index.js`'s `checkDueReminders` — scheduled ทุก 1 นาที, ส่ง FCM push, อัปเดต `nextDueAt`/`lastNotifiedAt` — ทดสอบ business logic ผ่าน mock 14/14 เคส

---

## 10. Groups UI รายละเอียด (เฟส 3)

- Nav sidebar "กลุ่ม/โปรเจกต์": list กลุ่มจริง (จุดสีตามกลุ่ม + ชื่อ + count), คลิกกลุ่มเพื่อกรอง, ปุ่มลบ (`✕`) โผล่ตอน hover
- "+ เพิ่มกลุ่มใหม่": inline form แค่พิมพ์ชื่อ + Enter — สีสุ่มอัตโนมัติ
- ลบกลุ่มที่กำลังกรองอยู่ → เคลียร์ `activeGroupFilter` กลับเป็น `null` อัตโนมัติ

---

## 11. จุดที่ควรระวังเวลาแก้ไขต่อ

1. **ชื่อไฟล์ใกล้เคียงกันมาก**: `activity-modal.jsx` vs `activity-mode.jsx` vs `reminder-mode.jsx`
2. **SCHEDULE_FIELD_KEYS ต้องตรงกับ backend เป๊ะๆ**: ตอนนี้มี 17 ฟิลด์ (เพิ่ม `groupId` เฟส 3) — ต้องแก้ `ALLOWED_FIELDS` ใน `backend/routes/reminders.js` คู่กันเสมอ
3. **ไม่มี push notification ตอนปิดแท็บ**: จนกว่าจะ deploy Cloud Function จริง — due-banner ในหน้ายังทำงานปกติตอนเปิดแท็บอยู่
4. **localStorage เป็น single point of failure ของ runtime state**: ล้าง cache → หาย stopwatch/routine progress/event trigger/`completedAt` ทั้งหมด
5. **`routine` type ไม่มี auto-repeat**: ทำครบ step แล้ว `enabled: false` + `completedAt` (เฟส 4) ต้องเปิดสวิตช์เองใหม่
6. **⚠️ ใหม่ (เฟส 5): มีสองที่ที่ต้องคำนวณ due-logic ตรงกัน** — `frontend/src/reminder-due-logic.js` (ESM, ต้นฉบับ) กับ `functions/reminder-due-logic.js` (CommonJS, สำเนา) — แก้ไฟล์หนึ่ง **ต้องแก้อีกไฟล์ตามทันที** มิฉะนั้น client กับ server จะเห็นเวลา "ถึงกำหนด" ไม่ตรงกัน
7. **Renotify guard policy ยังไม่ได้ทบทวนกับทีม**: `lastNotifiedAt` field ใหม่ในเฟส 5 เลือกนโยบาย "แจ้งครั้งเดียวต่อรอบ" เอง — ควรคุยก่อน deploy จริง (ทางเลือกอื่น: renotify ซ้ำทุก N นาที, escalate หลัง M ครั้ง) — รายละเอียดใน `functions/README.md`
8. **Groups เป็น one-to-one เท่านั้น**: reminder ผูกได้ทีละ 1 กลุ่ม ไม่รองรับหลายกลุ่มพร้อมกัน
