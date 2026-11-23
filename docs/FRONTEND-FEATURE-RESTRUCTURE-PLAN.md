# Frontend Feature Restructure Plan

แผนนี้จัดระเบียบเฉพาะ `frontend/` ก่อน เพื่อให้ Activity Mode และ Reminder
Mode เพิ่มความสามารถต่อได้โดยไม่รวมทุกอย่างไว้ใน `components/`, `hooks/`
และ root ของ `src/`

## เป้าหมายและขอบเขต

- ย้ายไฟล์ตามเจ้าของ feature โดยคงพฤติกรรมเดิมทั้งหมด
- แก้เฉพาะ import path, test/build และเอกสารประกอบการย้าย
- ห้ามเปลี่ยน API, Firestore schema, state model, UI หรือ logic ในรอบนี้
- ไม่ย้าย `backend/`, `functions/` หรือ `cloud-run-reminder-worker/`
- Mockup ต้องเป็น dev-only และ production route ห้าม import mockup โดยตรง

## หลักตัดสินใจ

1. ไฟล์เป็นของ feature ถ้าใช้เพื่อหน้าจอหรือ domain เดียวเป็นหลัก
2. ไฟล์ใช้ตั้งแต่สอง feature ขึ้นไปจึงอยู่ `shared/`
3. `app/` ประกอบ feature และถือ state ระดับแอปเท่านั้น ไม่เก็บ logic ของ
   Activity หรือ Reminder
4. `services/` ติดต่อ external system เท่านั้น เช่น backend, Firebase และ
   Google Calendar
5. runtime scheduling ของ Reminder ต้องไม่ปะปนกับ UI component
6. ไฟล์ที่ยาวมากให้ย้ายตำแหน่งก่อน แล้วค่อยแยกย่อยใน refactor รอบถัดไป

## โครงสร้างเป้าหมาย

```text
frontend/src/
├── app/
│   └── app.jsx
├── features/
│   ├── activity/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── logic/
│   │   └── styles/
│   ├── reminder/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── logic/
│   │   └── styles/
│   ├── search/
│   │   ├── components/
│   │   └── hooks/
│   └── settings/
│       └── components/
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   └── styles/
├── dev/
│   └── mockups/
├── main.jsx
└── index.css
```

## แผนที่ย้ายไฟล์

| ปัจจุบัน | ปลายทาง | เจ้าของ |
|---|---|---|
| `components/activity-mode.jsx` | `features/activity/components/` | Activity |
| `components/activity-mode-week-spine.jsx` | `features/activity/components/` | Activity |
| `components/activity-modal.jsx` | `features/activity/components/` | Activity |
| `components/activity-popup.jsx` | `features/activity/components/` | Activity |
| `components/mini-timeline-panel.jsx` | `features/activity/components/` | Activity |
| `components/weekly-summary-panel.jsx` | `features/activity/components/` | Activity |
| `components/timeline-editor.jsx` | `features/activity/components/` | Activity |
| `hooks/use-activity-*.js` | `features/activity/hooks/` | Activity |
| `activity-colors.js` | `features/activity/logic/` | Activity |
| `week-spine-data.js` | `features/activity/logic/` | Activity |
| `components/reminder-mode.jsx` | `features/reminder/components/` | Reminder |
| `components/reminder-stats-panel.jsx` | `features/reminder/components/` | Reminder |
| `hooks/use-reminder-*.js` | `features/reminder/hooks/` | Reminder |
| `hooks/use-push-notifications.js` | `features/reminder/hooks/` | Reminder |
| `reminder-*.js` | `features/reminder/logic/` | Reminder |
| `styles/reminder-material.css` | `features/reminder/styles/` | Reminder |
| `components/tag-search-results.jsx` | `features/search/components/` | Search |
| `hooks/use-tag-search.js` | `features/search/hooks/` | Search |
| `components/settings-drawer.jsx` | `features/settings/components/` | Settings |
| `components/announcement-ticker.jsx` | `shared/components/` | Shared UI |
| `components/auto-shrink-text.jsx` | `shared/components/` | Shared UI |
| `hooks/use-auth.js` | `shared/hooks/` | Shared app state |
| `hooks/use-calendar-data.js` | `shared/hooks/` | Calendar integration |
| `hooks/use-week-navigation.js` | `shared/hooks/` | Shared navigation |
| `api.js` | `shared/services/` | Backend API |
| `firebase-config.js` | `shared/services/` | Firebase |
| `google-calendar.js` | `shared/services/` | Google Calendar |
| `date-utils.js`, `id-utils.js`, `rrule-utils.js` | `shared/utils/` | Shared utility |
| `export-day-image.js` | `shared/utils/` | Shared utility |
| `timeline-layout.js` | `features/activity/logic/` | Activity |
| `i18n.jsx` | `shared/i18n.jsx` | Shared UI |
| `app.jsx` | `app/app.jsx` | App composition |
| `components/*mockup*.jsx` | `dev/mockups/` | Dev-only |
| `styles/activity-mode-mockup-support.css` | `dev/mockups/` | Dev-only |

## ลำดับการทำงาน

### Phase F0 — เตรียมความปลอดภัย

1. รัน `npm --prefix frontend run build` บันทึกผลก่อนเริ่ม
2. ตรวจ import ที่ใช้ alias หรือ path ข้าม feature
3. กำหนด commit เล็ก: หนึ่ง feature หรือหนึ่งกลุ่ม shared ต่อหนึ่ง commit
4. ห้ามย้ายและแยกไฟล์ใหญ่ใน commit เดียวกัน

เกณฑ์จบ: build เดิมผ่านและมีจุดย้อนกลับชัดเจน

### Phase F1 — สร้างโฟลเดอร์และย้าย Shared Services

สร้าง `app/`, `features/`, `shared/`, `dev/` ก่อนโดยยังไม่เปลี่ยน logic

ย้าย `api.js`, `firebase-config.js`, `google-calendar.js`, utility และ shared
components จากนั้นแก้ import ทั้งโปรเจกต์และ build

เกณฑ์จบ: login, โหลด Calendar และ API backend ยังใช้งานได้

### Phase F2 — ย้าย Activity Feature

ย้าย component, hooks, logic และ CSS ของ Activity เป็นชุดเดียว

ลำดับย่อย:

1. `activity-colors.js`, `week-spine-data.js`, `timeline-layout.js`
2. `use-activity-*.js`
3. `activity-mode.jsx`, week spine, modal, popup, timeline editor
4. mini timeline และ weekly summary

เกณฑ์จบ: เปิด Activity Mode, ลาก/ย่อ/ขยาย, edit, archive และ week navigation
ได้เหมือนเดิม

### Phase F3 — ย้าย Reminder Feature

ย้าย reminder UI, hooks, due logic, telemetry, stats และ stylesheet เป็นชุดเดียว

เกณฑ์จบ: สร้าง/แก้/ลบ reminder, sync, กลุ่ม, Push toggle และ due UI ทำงานเหมือนเดิม

### Phase F4 — ย้าย Search, Settings และ App Shell

ย้าย feature เล็ก และย้าย `app.jsx` ไป `app/app.jsx`; `main.jsx` เป็น entry
point ที่ import app shell เพียงจุดเดียว

เกณฑ์จบ: สลับ mode, account menu, settings และ tag search ใช้งานได้

### Phase F5 — กัก Mockup

ย้าย mockup ทุกตัวไป `dev/mockups/`; ทำ registry กลางสำหรับ keyboard preview
โดยให้ production code ไม่ import mockup

เกณฑ์จบ: เปิด preview ได้เหมือนเดิม แต่ production bundle ไม่ผูกกับ mockup

### Phase F6 — เก็บกวาดหลังย้าย

- ลบ empty folders และ import path ที่หมดอายุ
- ทำ import boundary: Activity ห้าม import internal ของ Reminder โดยตรง
- ทบทวนชื่อไฟล์ให้สื่อ domain ไม่ใช้ชื่อกว้างเกิน เช่น `data.js`
- ค่อยแยก `reminder-mode.jsx` และ `activity-mode-week-spine.jsx` ในแผนถัดไป

## กฎตรวจรับทุก Phase

```bash
npm --prefix frontend run build
```

ตรวจด้วยมืออย่างน้อย:

- Login/logout และเปลี่ยนบัญชี
- Activity Mode และ Reminder Mode เปิดได้
- สลับสัปดาห์, edit/delete และ save data
- กรณีเปิด mockup ด้วยคีย์ลัด
- Console ไม่มี import error หรือ circular dependency ใหม่

## สิ่งที่ยังไม่ทำในแผนนี้

- เปลี่ยน data model ของ reminder interval
- เปลี่ยน backend routes หรือ Firestore rules
- ย้าย Cloud Run worker
- แยก component ใหญ่เป็นหลาย component
- เปลี่ยน visual design

สิ่งเหล่านี้ทำหลังการย้ายไฟล์เสร็จ เพื่อให้สาเหตุของ bug และ diff ในแต่ละรอบชัดเจน
