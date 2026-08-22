# Feature-Based Structure Plan

เอกสารนี้เป็นแผนจัดโครงสร้าง T.i.M.E.S. ตาม feature แทนการรวมทุกอย่างตามชนิดไฟล์

## ขอบเขตรอบนี้

- ย้ายไฟล์และแก้ import เท่านั้น
- ห้าม refactor logic, เปลี่ยนชื่อ export, เปลี่ยน API หรือเปลี่ยนพฤติกรรม UI
- หลังย้ายแต่ละกลุ่ม ให้รัน `npm --prefix frontend run build`

## หลักการ

1. ไฟล์ที่ใช้เฉพาะ feature ให้อยู่ใต้ feature นั้น
2. ไฟล์ที่ใช้ร่วมกันตั้งแต่ 2 feature ขึ้นไปให้อยู่ใน `shared/`
3. `app/` มีหน้าที่ประกอบ feature และถือ state ระดับแอปเท่านั้น
4. Mockup เป็น dev-only และห้าม production feature ผูกกับ mockup ใด mockup หนึ่ง
5. CSS อยู่ใกล้ feature ของตน ส่วน token และ style ร่วมอยู่ใน `shared/styles/`

## โครงสร้างเป้าหมาย — Frontend

```text
frontend/src/
├── app/
│   ├── app.jsx
│   ├── app-shell.jsx
│   └── mockup-preview-route.jsx
├── features/
│   ├── activity/
│   │   ├── components/
│   │   │   ├── activity-mode-week-spine.jsx
│   │   │   ├── activity-modal.jsx
│   │   │   ├── activity-popup.jsx
│   │   │   ├── mini-timeline-panel.jsx
│   │   │   └── weekly-summary-panel.jsx
│   │   ├── hooks/
│   │   │   ├── use-activity-modal.js
│   │   │   ├── use-activity-mutations.js
│   │   │   └── use-activity-onboarding.js
│   │   ├── activity-colors.js
│   │   └── activity.css
│   ├── reminders/
│   │   ├── components/
│   │   │   ├── reminder-mode.jsx
│   │   │   └── reminder-stats-panel.jsx
│   │   ├── hooks/
│   │   │   ├── use-reminder-store.js
│   │   │   ├── use-reminders-sync.js
│   │   │   ├── use-reminder-groups.js
│   │   │   └── use-push-notifications.js
│   │   ├── reminder-due-logic.js
│   │   ├── reminder-quick-parse.js
│   │   ├── reminder-stats.js
│   │   ├── reminder-telemetry.js
│   │   └── reminder.css
│   ├── search/
│   │   ├── components/tag-search-results.jsx
│   │   └── hooks/use-tag-search.js
│   └── settings/
│       └── components/settings-drawer.jsx
├── shared/
│   ├── components/
│   │   ├── announcement-ticker.jsx
│   │   └── auto-shrink-text.jsx
│   ├── hooks/
│   │   ├── use-auth.js
│   │   ├── use-calendar-data.js
│   │   └── use-week-navigation.js
│   ├── services/
│   │   ├── api.js
│   │   ├── firebase-config.js
│   │   └── google-calendar.js
│   ├── utils/
│   │   ├── date-utils.js
│   │   ├── export-day-image.js
│   │   ├── id-utils.js
│   │   ├── rrule-utils.js
│   │   ├── timeline-layout.js
│   │   └── week-spine-data.js
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── base.css
│   │   └── shared-components.css
│   └── i18n.jsx
├── dev/
│   ├── legacy/
│   └── mockups/
├── main.jsx
└── index.css
```

## ตารางย้ายไฟล์รอบแรก

| ตำแหน่งปัจจุบัน | ตำแหน่งใหม่ |
|---|---|
| `components/activity-mode-week-spine.jsx` | `features/activity/components/` |
| `components/activity-modal.jsx` | `features/activity/components/` |
| `components/activity-popup.jsx` | `features/activity/components/` |
| `components/mini-timeline-panel.jsx` | `features/activity/components/` |
| `components/weekly-summary-panel.jsx` | `features/activity/components/` |
| `hooks/use-activity-*.js` | `features/activity/hooks/` |
| `activity-colors.js` | `features/activity/` |
| `components/reminder-mode.jsx` | `features/reminders/components/` |
| `components/reminder-stats-panel.jsx` | `features/reminders/components/` |
| `hooks/use-reminder-*.js` | `features/reminders/hooks/` |
| `hooks/use-push-notifications.js` | `features/reminders/hooks/` |
| `reminder-*.js` | `features/reminders/` |
| `components/tag-search-results.jsx` | `features/search/components/` |
| `hooks/use-tag-search.js` | `features/search/hooks/` |
| `components/settings-drawer.jsx` | `features/settings/components/` |
| `components/announcement-ticker.jsx` | `shared/components/` |
| `components/auto-shrink-text.jsx` | `shared/components/` |
| `hooks/use-auth.js`, `use-calendar-data.js`, `use-week-navigation.js` | `shared/hooks/` |
| `api.js`, `firebase-config.js`, `google-calendar.js` | `shared/services/` |
| utility ที่เหลือใน root `src/` | `shared/utils/` |
| `*-mockup*.jsx`, `reminder-dashboard-mockup.jsx` | `dev/mockups/` |

## Legacy ที่ไม่ควรปนกับ production

| ไฟล์ | การจัดการ |
|---|---|
| `components/activity-mode.jsx` | ย้ายไป `dev/legacy/` หรือรอลบหลังยืนยันว่าไม่มี workflow เก่าใช้ |
| `components/timeline-editor.jsx` | ย้ายไป `dev/legacy/` คู่กับ Activity Mode รุ่นเก่า |

ไฟล์สองรายการนี้ไม่ได้ถูก import จาก `app.jsx` ใน production ปัจจุบัน

## CSS

แยกจาก `index.css` โดยย้าย selector เดิมแบบไม่แก้ logic ก่อน:

```text
shared/styles/tokens.css             # color, spacing, typography, dark-mode token
shared/styles/base.css               # reset และ element พื้นฐาน
shared/styles/shared-components.css  # modal, toast, common button, scrollbar
features/activity/activity.css       # week spine, modal, popup, mini timeline, archive
features/reminders/reminder.css      # reminder mode, group, stats, timeline
features/settings/settings.css       # เพิ่มเมื่อ settings ใหญ่ขึ้น
```

หลังย้าย `index.css` ควรเหลือเพียง import:

```css
@import "./shared/styles/tokens.css";
@import "./shared/styles/base.css";
@import "./shared/styles/shared-components.css";
@import "./features/activity/activity.css";
@import "./features/reminders/reminder.css";
```

## Backend — เป้าหมายภายหลัง

รอบนี้ยังไม่ต้องย้าย backend เพราะ `backend/routes/` ยังชัดเจนและขนาดพอดี
เมื่อ endpoint เพิ่มมากขึ้นค่อยเปลี่ยนเป็น:

```text
backend/
├── app.js
├── infrastructure/firestore-db.js
├── middleware/require-auth.js
├── modules/
│   ├── activity/
│   ├── reminders/
│   └── summary/
└── scripts/
```

## จุดที่ต้องระวัง

### Reminder due logic มีสองสำเนา

- `frontend/src/reminder-due-logic.js` เป็น ESM
- `functions/reminder-due-logic.js` เป็น CommonJS

แก้ logic ฝั่งหนึ่งต้องแก้อีกฝั่งเสมอ ในรอบ refactor ถัดไปควรเพิ่ม shared source
หรือ test ที่เปรียบเทียบผลของทั้งสองชุด

### ห้ามย้ายพร้อม refactor

ลำดับต่อกลุ่ม:

1. ย้ายไฟล์
2. แก้ import ทุกจุด
3. รัน build
4. เปิดทดสอบ Activity Mode, Reminder Mode และ mockup preview
5. ค่อยเริ่มกลุ่มถัดไป

## ลำดับแนะนำ

1. สร้างโฟลเดอร์ปลายทาง
2. ย้าย `shared/` ก่อน
3. ย้าย `features/activity/`
4. ย้าย `features/reminders/`
5. ย้าย search, settings และ mockup
6. แยก CSS
7. ย้าย legacy ไป `dev/legacy/` หรือยืนยันลบ
8. อัปเดต `z-project-document/STUCTURE.md`
9. หลังโครงสร้างนิ่ง ค่อย refactor `reminder-mode.jsx`, `app.jsx` และ Week Spine

## Definition of Done

- ทุก import resolve ได้
- `npm --prefix frontend run build` ผ่าน
- Activity Mode, Reminder Mode, Settings, Tag Search และ mockup preview เปิดได้
- ไม่มี behavior เปลี่ยนโดยตั้งใจ
- CSS ใหม่ของแต่ละ feature ไม่ถูกเพิ่มกลับไปใน `index.css`
- `STUCTURE.md` อธิบายตำแหน่งไฟล์จริงได้
