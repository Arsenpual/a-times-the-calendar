# `activity-mode.jsx` — เจาะลึก

**หน้าหลัก:** `frontend/src/components/activity-mode.jsx`  
**Component:** `ActivityMode`  
**หน้าที่:** มุมมองปฏิทินรายสัปดาห์สำหรับจัด “กิจกรรมหลัก” ที่มีช่วงเวลาแน่นอน โดยข้อมูลกิจกรรมจริงอยู่ใน Google Calendar

> เอกสารนี้อธิบายตามโค้ดปัจจุบัน ณ วันที่ 19 สิงหาคม 2026 หากเอกสารต่างจากโค้ด ให้ยึดโค้ดเป็นหลัก

---

## 1. ภาพรวมและขอบเขต

Activity Mode คือโหมดปฏิทินหลักของ T.i.M.E.S. ใช้สำหรับวางแผนกิจกรรมที่มีเวลาเริ่ม–สิ้นสุดชัดเจน เช่น ประชุม, อ่านหนังสือ, ออกกำลังกาย หรือช่วงทำงานลึก

แอปแยกหน้าที่กับ Reminder Mode ชัดเจน:

| เรื่อง | Activity Mode | Reminder Mode |
|---|---|---|
| หน่วยข้อมูลหลัก | Google Calendar event | reminder ใน localStorage/Firebase mirror |
| เหมาะกับ | งานหลักที่ครองช่วงเวลา | งานย่อย, รอบเตือน, routine, timer |
| เวลาเหลื่อมกัน | ลากผ่านได้ชั่วคราว แต่ **ห้ามบันทึก** หากทับกัน | รองรับ reminder หลายรายการเวลาเดียวกัน |
| การแสดงผล | Agenda รายสัปดาห์ + timeline editor | Dashboard + timeline 24 ชั่วโมง |

Activity Mode ไม่ทำสำเนา event ไปเก็บใน reminder store การเชื่อมที่มีอยู่คือ Reminder Mode รับ `activities` ชุดเดียวกันมาแสดงเป็น Activity overlay บน timeline เท่านั้น

---

## 2. แผนผังองค์ประกอบ

```text
app.jsx
├─ useWeekNavigation        → mode, cursorDate, expandedDate, keyboard navigation
├─ useCalendarData          → อ่าน Calendar + category/tag/lock/summary
├─ useActivityModal         → เปิด/ปิด ActivityModal
├─ useActivityMutations     → เขียน Google Calendar + backend metadata
└─ Activity Mode (เมื่อ mode === "activity")
   ├─ WeeklySummaryPanel
   ├─ MiniTimelinePanel (แทน summary เมื่อเลือกวัน)
   └─ ActivityMode
      ├─ agenda row × 7 วัน
      ├─ ปุ่มเปิด mini timeline
      ├─ ปุ่มเพิ่มกิจกรรม
      └─ TimelineEditor (เฉพาะแถวที่กด ⚙)

ActivityModal → สร้าง/แก้ไข/ลบ event
ActivityPopup → เมนูคลิกขวาใน TimelineEditor
```

`app.jsx` ใส่ class `app--activity` และ `activity-dashboard` เพื่อ scope งานตกแต่ง Material Design 3 ให้กระทบเฉพาะ Activity Mode ไม่ไปทับ Reminder Mode

---

## 3. ข้อมูลและแหล่งความจริง

### 3.1 Activity

Google Calendar เป็น source of truth ของ event เช่น:

```js
{
  id,
  summary,
  description,
  start: { dateTime }, // หรือ date สำหรับ all-day
  end: { dateTime },
  colorId,
  recurringEventId
}
```

`activityDate()` ใน `date-utils.js` ใช้แปลงรูปแบบ `start`/`end` ให้เป็น `Date` อย่างปลอดภัยก่อนคำนวณเวลาเสมอ

### 3.2 Metadata ของแอป

ข้อมูลต่อไปนี้ไม่ได้เป็น field ปกติของ Google Calendar จึงเก็บผ่าน backend ของแอป โดยใช้ `normalizeActivityId()` เป็น key:

| ข้อมูล | State | หน้าที่ |
|---|---|---|
| Categories | `categories[]` | หมวดชีวิตและสี |
| Category mapping | `activityCategoryMap` | `activityId → categoryId` |
| Tags | `activityTagMap` | `activityId → string[]` |
| Lock | `lockedActivities` | `activityId → boolean` |

สีที่เห็นบน UI เลือกผ่าน `getDisplayColor(activity, activityCategoryMap, categories)` ตามลำดับความสำคัญของสี activity/category/default

### 3.3 Weekly summary

`useCalendarData` ส่งรายการในสัปดาห์ปัจจุบันไป `fetchWeeklySummary()` เพื่อคำนวณสรุป แยกกิจกรรมที่เริ่มก่อนสัปดาห์ออกก่อน เพราะรายการจากวันก่อนหน้าใช้เพียงวาด overnight spillover ใน timeline

---

## 4. การอ่านข้อมูล: `useCalendarData`

Hook นี้เป็นเจ้าของข้อมูลอ่านทั้งหมด แต่ไม่ทำ mutation:

- `loadActivities()` ดึง Google Calendar ตามช่วงสัปดาห์ที่เลือก โดยเริ่ม fetch ก่อนวันแรก 1 วัน เพื่อรองรับกิจกรรมข้ามเที่ยงคืน
- โหลด categories, category map, tag map และ lock map หลัง Firebase login
- รีเฟรช weekly summary เมื่อ activities, category map หรือสัปดาห์เปลี่ยน
- หาก Google Calendar ส่ง error สิทธิ์หมดอายุ จะเคลียร์ calendar token เพื่อให้ UI เปิดทางยืนยันตัวตนใหม่
- `resetOnLogout()` ล้าง state ที่ hook นี้เป็นเจ้าของทั้งหมด

ช่วงข้อมูลที่แสดงใน Agenda ใช้ `getWeekRange(cursorDate)` และ ActivityMode จัด event ลงวันตาม **วันเริ่มต้น** ของ event

---

## 5. การนำทางสัปดาห์และคีย์บอร์ด

`useWeekNavigation` เป็นเจ้าของ state เหล่านี้:

| State | ความหมาย |
|---|---|
| `mode` | `activity` หรือ `reminder` |
| `cursorDate` | จุดอ้างอิงของสัปดาห์ที่กำลังแสดง |
| `expandedDate` | วันที่กำลังเปิด Mini Timeline หรือ `null` |
| `theme` | light/dark ที่ persist ใน localStorage |

- ◀/▶ และ ArrowLeft/ArrowRight เปลี่ยนสัปดาห์
- ▲/▼ และ ArrowUp/ArrowDown เลื่อนวัน โดยไม่พึ่ง focus ของแถว
- shortcut ถูกปิดเมื่ออยู่ Reminder Mode หรือกำลังพิมพ์ใน `input`, `textarea`, `contenteditable`
- เปลี่ยนสัปดาห์แล้ว `ActivityMode` ปิด TimelineEditor ที่เปิดอยู่ เพื่อลดความเสี่ยงบันทึก draft ไปยังสัปดาห์ผิด
- `expandedDate` จะถูกล้างหากไม่อยู่ในสัปดาห์ใหม่

---

## 6. Agenda รายสัปดาห์: `ActivityMode`

Component นี้สร้าง 7 `agenda-row` จากวันเริ่มสัปดาห์

แต่ละแถวมี:

1. **Day badge** — ชื่อวัน/เลขวันที่; วันนี้ใช้ primary color
2. **Day bar** — สัดส่วนเวลา activity แยกตามสี category (`buildDayBreakdown`) และจำนวนกิจกรรม
3. **ปุ่ม ⚙** — เปิด TimelineEditor แบบ inline สำหรับวันนั้น
4. **ปุ่มเพิ่มกิจกรรม** — เปิด ActivityModal พร้อมวันที่แถวนั้น และเวลา ณ ตอนกด

คลิกแถวหรือกด Enter/Space เลือกวันให้ MiniTimelinePanel แสดง ในขณะที่ editor state (`editingDay`) แยกจาก `expandedDate` โดยตั้งใจ: เปิด editor ได้โดยไม่จำเป็นต้องเปิด mini timeline

---

## 7. TimelineEditor: แก้เวลาบน 24 ชั่วโมง

ไฟล์: `frontend/src/components/timeline-editor.jsx`

### พฤติกรรมหลัก

- แสดง 00:00–24:00 เต็มวัน, `EDIT_HOUR_HEIGHT = 52px`
- snap ทุก `SNAP_MINUTES` (มาจาก `timeline-layout.js`)
- ลากทั้ง block เพื่อย้ายเวลา และลากขอบเพื่อปรับ start/end
- จำกัดการลากให้ duration ใหม่ไม่เกิน 12 ชั่วโมง (`MAX_DURATION_MINUTES`) แต่ event ที่ยาวกว่านั้นอยู่แล้วจะไม่ถูกตัด
- รองรับลากจบข้ามเที่ยงคืนและแสดง spillover จากคืนก่อนหน้า
- กิจกรรมที่ lock อยู่ลาก/ย่อขยาย/ลบไม่ได้

### Overlap policy

ระหว่างลาก UI อนุญาตให้ block ผ่านหรือทับ activity อื่นได้ เพื่อให้จัดตำแหน่งง่ายและไม่กระตุก แต่จะแสดงข้อความเตือนทันที

เมื่อกดบันทึก `validateDraftTimes()` จะตรวจ event ที่แก้ทุกตัวกับ event อื่นและ incoming spillover อีกครั้ง ถ้าทับกันจะไม่เรียก API บันทึก เวลา event หลักจึงไม่ทับกันในข้อมูลจริง งานย่อยที่ทำคู่กันควรไปอยู่ Reminder Mode

`layoutOverlaps()` ใช้วาง block ที่ทับกันชั่วคราวเป็นหลายคอลัมน์ และระหว่าง gesture จะตรึง layout เดิม + coalesce pointer update ด้วย `requestAnimationFrame` เพื่อลดอาการกระตุก

### Context menu

คลิกขวาบน activity เปิด `ActivityPopup` ณ ตำแหน่งเมาส์ ใช้ทำงานเช่น:

- เปิด ActivityModal เพื่อแก้ไขรายละเอียด
- ตั้ง/ล้าง category และ custom color
- lock/unlock
- ทำสำเนา
- ย้ายไปวันอื่น
- ลบครั้งเดียว หรือแก้ไข/ลบทั้ง recurring series
- export ภาพ timeline ของวัน

คลิกขวาบนพื้นที่ว่างไม่เดา activity ที่ใกล้ที่สุด เพื่อไม่ให้เกิดการแก้ผิดรายการ

### การบันทึกเวลา

TimelineEditor เก็บ `draftTimes` ไว้ใน memory เท่านั้น จนกด “บันทึก” จึงเรียก `onSaveTimes(changes)` แบบ batch; กด cancel จะทิ้ง draft ทั้งหมด

---

## 8. ActivityModal: สร้างและแก้ไข

ไฟล์: `activity-modal.jsx`, state การเปิดอยู่ใน `use-activity-modal.js`

ฟอร์มรองรับ:

- ชื่อ, วันที่, เวลาเริ่ม/จบ
- category (สร้าง/ลบ category จากฟอร์มได้)
- tags หลายค่า
- สี event ของ Google Calendar
- recurrence แบบไม่ซ้ำ/ตามกติกาที่กำหนด
- notes/description แบบพับได้
- ลบ event เมื่ออยู่ edit mode

Validation สำคัญ:

- ชื่อต้องไม่ว่าง และเวลา end ต้องมากกว่า start
- หาก duration เกิน 18 ชั่วโมง ต้องกดบันทึกซ้ำเพื่อยืนยันการข้ามเที่ยงคืนที่ยาวผิดปกติ
- Escape และคลิก backdrop ปิด modal ได้
- event ที่ lock อยู่เปิด edit modal ไม่ได้

`useActivityModal` รองรับการเปิด 3 แบบ: create, edit occurrence, และ edit recurring series โดยแบบ series ต้องโหลด master event จาก Google Calendar เพิ่มก่อน

---

## 9. การเขียนข้อมูล: `useActivityMutations`

Hook นี้รวม mutation ไป Google Calendar และ backend metadata พร้อม optimistic state ที่จำเป็น

| Handler | หน้าที่ |
|---|---|
| `handleSaveActivity` | สร้างหรือแก้ event, recurrence, category, tags, color |
| `handleSaveTimes` | batch update เวลา หลังตรวจ lock/overlap/conflict |
| `handleDeleteActivity` | ลบ occurrence แล้ว cleanup metadata/lock ที่เกี่ยวข้อง |
| `handleDeleteSeries` | ลบ recurring series และ cleanup ทุก occurrence ที่โหลดอยู่ |
| `handleDuplicateActivity` | สร้างสำเนาเวลาเดิม พร้อม category/tag แต่ไม่ copy lock |
| `handleMoveActivityToDay` | ย้ายวันโดยรักษาเวลาในวันและ duration |
| `handleSetActivityColor` | ตั้งหรือเคลียร์ `colorId` ของ Google Calendar |
| `handleAssignCategory` | บันทึก mapping category |
| `handleToggleLock` | บันทึก lock state |

ก่อน update/delete ระบบตรวจ lock เสมอ และหลายจุดเรียก `checkConflict()` เพื่อแจ้งว่าข้อมูลถูกแก้จากที่อื่นหลังโหลดแล้ว แม้ปัจจุบันจะเลือกบันทึกทับข้อมูลล่าสุดตามนโยบายของแอป

หลัง mutation สำเร็จ จะเรียก `loadActivities()` และ refresh tag search เพื่อ reconcile จากข้อมูลจริง

---

## 10. Search, Summary และ Mini Timeline

- **Tag search:** `TagSearchResults` แทน Agenda ชั่วคราวเมื่อมี tag query; รองรับหลาย tag และค้นหาข้ามช่วงสัปดาห์
- **WeeklySummaryPanel:** สรุปจำนวนกิจกรรม, สัดส่วน category และวันที่หนาแน่นที่สุด; คลิกผลลัพธ์เพื่อเปิดวัน
- **MiniTimelinePanel:** แสดงเมื่อ `expandedDate` มีค่า และใช้ข้อมูลเดียวกับ Agenda; activity ข้ามวันแสดง spillover ตามเวลาจริง

---

## 11. Design System: Material Design 3

Activity Mode ถูก scope ด้วย `.app--activity` และ `.activity-dashboard` ใน `index.css`

- ใช้ tonal surfaces (`surface`, `surface-low`, `surface-container`, `surface-high`) แทนเงาหนัก
- primary `#0b57d0`, primary container `#d3e3fd`
- ปุ่ม action มุม pill, card/timeline radius 16px, modal radius 28px
- ใช้ typography น้ำหนัก 400 สำหรับ title และ 500 สำหรับป้าย/ปุ่ม
- dark mode มี M3 surface token ชุดแยก
- focus ring ของ input ใช้ primary color เพื่อให้ใช้คีย์บอร์ดได้ชัดเจน

สไตล์ Reminder Mode ไม่ถูกแก้โดย selector ชุดนี้

---

## 12. ข้อควรระวังเมื่อต่อยอด

1. **ห้ามแก้ Google Calendar event โดยไม่ reload/reconcile:** `loadActivities()` หลัง mutation สำคัญต่อความสอดคล้องของ UI
2. **อย่าสับสน event time กับ date-only event:** TimelineEditor ใช้เฉพาะ `start.dateTime`; all-day event ต้องรองรับต่างหาก
3. **overlap ต้องตรวจสองชั้น:** UI ระหว่างลากและ `handleSaveTimes` ก่อนส่ง API
4. **normalize id ทุกครั้งก่อน metadata:** category/tag/lock map ใช้ normalized ID ไม่ใช่ raw Google id เสมอ
5. **กิจกรรมข้ามเที่ยงคืน:** อย่าตัดช่วง fetch วันก่อนหน้า และอย่าใช้แค่ minute-of-day โดยไม่เทียบ `Date` จริง
6. **lock เป็น business rule:** ต้องตรวจทั้ง UI และ mutation เพราะผู้ใช้สามารถเรียก handler จากทางอื่นได้
7. **recurring series:** การแก้ occurrence กับ master มีผลต่างกัน; ใช้ `recurringEventId` และ fetch master ก่อนแก้ทั้งชุด
8. **Token หมดอายุ:** Google Calendar error ที่เข้าเกณฑ์ต้องเคลียร์ token เพื่อเปิด flow login ใหม่
9. **Material scope:** UI ใหม่ของ Activity Mode ควรใช้ `.app--activity` / `.activity-dashboard` ต่อไป เพื่อไม่ทำให้ Reminder Mode เปลี่ยนโดยไม่ตั้งใจ

---

## 13. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `frontend/src/app.jsx` | ประกอบ state/hook และส่ง props ให้ทุก component |
| `frontend/src/components/activity-mode.jsx` | Agenda รายสัปดาห์ 7 วัน |
| `frontend/src/components/timeline-editor.jsx` | ลาก/ปรับเวลา/ตรวจ overlap/context menu |
| `frontend/src/components/activity-modal.jsx` | ฟอร์มสร้าง/แก้ไข activity |
| `frontend/src/components/activity-popup.jsx` | เมนูคลิกขวาบน timeline |
| `frontend/src/components/weekly-summary-panel.jsx` | สรุปสัปดาห์ |
| `frontend/src/components/mini-timeline-panel.jsx` | Timeline แบบย่อของวันที่เลือก |
| `frontend/src/hooks/use-week-navigation.js` | mode, week/day navigation, theme |
| `frontend/src/hooks/use-calendar-data.js` | โหลด Calendar และ metadata |
| `frontend/src/hooks/use-activity-modal.js` | modal lifecycle |
| `frontend/src/hooks/use-activity-mutations.js` | mutation ทั้งหมด |
| `frontend/src/timeline-layout.js` | snap, overlap layout, spillover calculation |
| `frontend/src/index.css` | CSS หลักและ Material 3 scope ของ Activity Mode |
