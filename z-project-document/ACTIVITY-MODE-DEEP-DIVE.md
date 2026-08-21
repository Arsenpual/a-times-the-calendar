# Activity Mode — เจาะลึก

**หน้าจอหลัก:** `frontend/src/components/activity-mode-week-spine.jsx`  
**จุดประกอบระบบ:** `frontend/src/app.jsx`  
**แหล่งข้อมูลกิจกรรม:** Google Calendar  
**อัปเดตตามโค้ด:** 21 สิงหาคม 2026

> เอกสารนี้อธิบาย Activity Mode รุ่น Week Spine ปัจจุบัน ไม่ใช่ Agenda รุ่นเดิม หากเอกสารต่างจากโค้ด ให้ยึดโค้ดจริงเป็นหลัก

---

## 1. ภาพรวม

Activity Mode คือปฏิทินหลักของ T.i.M.E.S. สำหรับ **กิจกรรมหลักที่มีช่วงเวลาแน่นอน** เช่น ประชุม, เรียน, เดินทาง หรือ deep work ข้อมูลกิจกรรมจริงเป็น Google Calendar event จึงสร้าง แก้ ย้าย หรือลบได้จากแอปและ sync กลับ Calendar โดยตรง

| เรื่อง | Activity Mode | Reminder Mode |
|---|---|---|
| หน่วยข้อมูล | Google Calendar event | reminder ใน localStorage/Firebase mirror |
| เหมาะกับ | เวลาเป็นช่วงใหญ่บนปฏิทิน | งานย่อย, interval, routine, timer |
| UI หลัก | Week Spine 7 วัน, 00:00–24:00 | Dashboard + reminder timeline |
| เวลา overlap | แสดง/ลากทับชั่วคราวได้ แต่ save ปกติไม่ได้ | รองรับหลาย reminder เวลาเดียวกัน |

Reminder Mode รับ Activity ชุดเดียวกันไปแสดงบน timeline ของตนเอง แต่ Activity Mode ไม่เป็น owner ของ reminder runtime state

---

## 2. โครงสร้างระบบ

```text
app.jsx
├─ useAuth                  Firebase user + Google token
├─ useWeekNavigation        mode, cursorDate, keyboard navigation
├─ useCalendarData          activities + metadata + summary
├─ useActivityModal         lifecycle ของ modal
├─ useActivityMutations     ทุก mutation
└─ ActivityModeWeekSpine
   ├─ timeline 7 วัน
   ├─ ActivityPopup (คลิกขวา)
   ├─ detail section ใต้ timeline
   └─ activity archive

ActivityModal               ฟอร์มสร้าง/แก้ไข
```

`app.jsx` เป็น composition root ที่ส่ง state และ handler จาก hooks ลง component แทนการเก็บ business rule ไว้ในหน้าจอเดียว

---

## 3. ข้อมูลและ source of truth

### 3.1 Google Calendar event

```js
{
  id,
  summary,
  description,
  start: { dateTime }, // หรือ date สำหรับ all-day
  end: { dateTime },
  colorId,
  recurrence,
  recurringEventId
}
```

`activityDate()` ใน `date-utils.js` แปลง start/end ให้เป็น `Date` อย่างปลอดภัยก่อนคำนวณ Event แบบ all-day ถูกแยกจาก timed event และไม่วาดเป็น block บนเวลา 24 ชั่วโมง

### 3.2 Metadata ของแอป

Google Calendar ไม่มี category, tag และ lock ของโปรเจกต์ จึงเก็บผ่าน backend โดยใช้ `normalizeActivityId()` เป็น key

| ข้อมูล | โครงสร้าง | ความหมาย |
|---|---|---|
| Categories | `categories[]` | ชื่อและสีหมวดชีวิต |
| Category map | `activityCategoryMap[id]` | category เดียวของ event |
| Tag map | `activityTagMap[id]` | tags หลายค่า |
| Lock map | `lockedActivities[id]` | ห้ามแก้ ย้าย หรือลบ |

สีบน UI มาจาก `getDisplayColor()` โดยสี category มีความสำคัญเหนือสี event แบบ custom

### 3.3 Activity archive

คลังเป็น local-only เก็บใน:

```text
times-activity-archive:<firebaseUser.uid>
```

รายการเก็บ `archiveId`, `calendarId`, `title`, `start`, `end`, `categoryId`, `tags`, `color`, `archivedAt` และ `isDraft`

- เก็บเข้าคลังไม่ลบ Calendar event แต่ซ่อนจาก Week Spine ด้วย `archivedCalendarIds`
- category และ tag ถูกคัดลอกมาพร้อมรายการ
- ส่งกลับ Timeline จะ create/update Calendar event ตามข้อมูลในคลัง แล้วลบรายการออกจาก archive
- draft ที่ยังไม่มี `calendarId` สร้าง Calendar event ได้เมื่อชื่อและวัน/เวลาครบ

### 3.4 First-time Activity onboarding

บัญชีที่สร้างหลังเปิดใช้ onboarding และเข้าสู่ Activity Mode ครั้งแรก จะได้รับกิจกรรมตัวอย่าง 10 รายการในสัปดาห์ปัจจุบัน รายการไม่ทับกันและกระจายครบหมวด default: งาน, ส่วนตัว, สุขภาพ และครอบครัว

Hook `use-activity-onboarding.js` รอให้ categories เริ่มต้นโหลดครบก่อน แล้วบันทึก blueprint ลง localStorage key `times-activity-onboarding:<uid>:v1` และส่งรายการในรูป local preview ไปวาดบน Week Spine โดย **ไม่เขียน Google Calendar** จึงใช้ได้แม้ผู้ใช้ยังไม่มีสิทธิ์เขียนปฏิทิน คลิกตัวอย่างจะเปิดฟอร์มเพิ่มกิจกรรมจริงพร้อมชื่อและช่วงเวลาของตัวอย่างนั้น

---

## 4. Week Spine

Week Spine เป็น timeline แนวตั้ง 7 วัน แสดง 00:00–24:00

- `getWeekRange(anchorDate)` ระบุสัปดาห์ที่แสดง
- `buildWeekSpineData()` ใน `week-spine-data.js` แปลง event เป็น segments
- event ข้ามเที่ยงคืนถูกแบ่งตามวัน แต่ใช้ `calendarId` เดิม
- `layoutOverlaps()` วางรายการที่ซ้อนกันแบบหลาย lane
- grid มีเส้นทุก 1 ชั่วโมง และ drag snap ที่ 15 นาที
- วันนี้มีจุดเน้นสีน้ำเงินแบบไม่รก

### กิจกรรมข้ามคืน

segment ที่ต่อมาจากวันก่อนหรือไปวันถัดไปเป็น `is-continuation`: สีจาง, ขอบซ้าย dashed, opacity ต่ำ เพื่อไม่แย่งความเด่นจากงานที่เริ่มในวันนั้น

### ชื่อใน timeline

`AutoShrinkText` ใช้ขนาดพื้นฐาน 12px และย่อได้ต่ำสุด 75% เฉพาะเมื่อพื้นที่คอลัมน์ไม่พอ ชื่อเต็มยังอยู่ใน tooltip

### Navigation

- ArrowLeft/ArrowRight เปลี่ยนสัปดาห์
- ArrowUp/ArrowDown เลื่อนวัน โดยไม่ขึ้นกับ focus
- ปุ่มเปลี่ยนสัปดาห์ซ่อนที่ขอบซ้าย/ขวาและปรากฏเมื่อ pointer เข้าใกล้
- `focusDate()` ใช้พา user ไปยังวัน/สัปดาห์ของกิจกรรมที่เพิ่งส่งจากคลัง

---

## 5. การสร้าง แก้ไข และลาก

### ActivityModal

ไฟล์: `frontend/src/components/activity-modal.jsx`

รองรับชื่อ, วัน/เวลาเริ่มและจบ, category, tags, สี event, recurrence และ notes โดยวัน+เวลาใช้ `datetime-local` หนึ่งช่องต่อหนึ่งค่า

Logic เวลาแบ่งเป็นสามกรณี:

1. **เปิดจากคลังที่ข้อมูลเวลาไม่ครบ** — ช่องที่ขาดเป็นกรอบแดง; เลือกวัน/เวลาเริ่มแล้วตั้งเวลาจบ +1 ชั่วโมง
2. **เพิ่มกิจกรรมใหม่** — เปลี่ยนวัน/เวลาเริ่มแล้วตั้งเวลาจบ +1 ชั่วโมง
3. **แก้ไขกิจกรรมเดิม** — ไม่เปลี่ยนเวลาจบอัตโนมัติ ยกเว้นผู้ใช้ล้างทั้งวัน/เวลาเริ่มและจบ แล้วเริ่มกำหนดใหม่

Escape หรือคลิก backdrop ปิด modal ได้ Event ที่ lock อยู่เปิดแก้ไขไม่ได้

### Interaction บน Week Spine

- คลิกซ้าย block: แก้ activity เดียว
- คลิกขวา: เปิด `ActivityPopup`
- drag block: ย้ายเวลา
- drag handle ล่าง: ปรับเวลาจบ
- ลากพื้นที่ว่าง: สร้างช่วงเวลาใหม่และเปิด modal

block ที่กำลังลากอยู่ด้านหน้า และลด animation ตอนชนกันเพื่อลดอาการกระตุก

---

## 6. Overlap policy

กิจกรรมปกติไม่ควรถูกบันทึกด้วยเวลาทับกัน แต่ UI ให้ลากผ่านรายการอื่นได้ชั่วคราว

```text
ลาก/resize → แสดงตำแหน่งใหม่และสถานะชน
         → ปล่อย pointer
            ├─ ไม่ชน: handleSaveTimes() เขียน Calendar
            └─ ชน: ไม่บันทึก และแสดง floating warning
```

นิยาม overlap คือ `start < otherEnd && end > otherStart` ดังนั้นงานหนึ่งจบ 10:00 และอีกงานเริ่ม 10:00 ไม่ถือว่าชน

ตรวจสองชั้น:

1. `findOverlap()` ใน Week Spine เพื่อ feedback ระหว่าง interaction
2. `findOverlappingActivity()` ใน `use-activity-mutations.js` ก่อน `handleSaveTimes()` ส่ง API

### ข้อยกเว้น: ส่งจากคลัง

การส่งจากคลังสามารถ create/update และแสดงบน Timeline ได้แม้เวลาชนกัน เพื่อให้ผู้ใช้ลากปรับทีหลัง:

- ต้องมีชื่อ, วัน/เวลาเริ่ม และวัน/เวลาจบ
- ข้อมูลไม่ครบ → เปิด modal พร้อมกรอบแดงที่ช่องจำเป็น
- ข้อมูลครบ → เขียน Calendar, พาไปวัน/สัปดาห์นั้น, เอาออกจากคลัง
- ถ้าชน → เตือนหลังส่ง ไม่บล็อกการส่ง
- การ drag save หลังจากนั้นกลับไปใช้กฎ overlap ปกติ

---

## 7. Detail, popup และ archive UI

`week-spine-detail` อยู่เต็มความกว้างใต้ timeline เพื่อไม่ให้ข้อมูลถูกบีบใน card

- คลิกซ้าย detail: เปิด modal แก้ไข
- คลิกขวา detail/timeline: เปิด `ActivityPopup`
- warning เช่น lock หรือ overlap ใช้ `.error-banner` แบบ floating จึงไม่ดัน layout

แถวใน archive มีชื่อ, tags, วัน/เวลาเริ่ม, วัน/เวลาจบ, category และ action:

| ปุ่ม | หน้าที่ |
|---|---|
| `✎` สีฟ้า | แก้ไขเต็มรูปแบบ |
| `↗` สีเขียว | ส่งไป Timeline |
| `🗑` สีแดง | ลบออกจากคลัง |

ปุ่ม `✕` ข้างวัน/เวลาล้างค่าและแสดง `-- --`; category มีจุดสีและล้างค่าได้

---

## 8. Mutation และการ sync

ไฟล์: `frontend/src/hooks/use-activity-mutations.js`

| Handler | หน้าที่ |
|---|---|
| `handleSaveActivity` | create/update event, recurrence, category, tags, color |
| `handleSaveTimes` | update เวลาแบบ batch หลังตรวจ lock/overlap |
| `handleDeleteActivity` | ลบ occurrence และ cleanup metadata |
| `handleDeleteSeries` | ลบ recurring series |
| `handleDuplicateActivity` | สร้างสำเนาพร้อม category/tag แต่ไม่ copy lock |
| `handleMoveActivityToDay` | ย้ายวันโดยรักษา duration |
| `handleAssignCategory` | sync category mapping |
| `handleToggleLock` | sync lock state |

หลัง mutation สำเร็จต้องเรียก `loadActivities()` เพื่อ reconcile จาก Google Calendar หาก token หมดอายุ ระบบเคลียร์ token เพื่อเปิด flow ยืนยันสิทธิ์ใหม่

---

## 9. Layout และ fullscreen

Activity dashboard scroll ได้เอง เมื่อ scroll ลงเล็กน้อยจะเข้าสู่ reading mode และซ่อน `app-header` เพื่อเพิ่มพื้นที่อ่าน detail/archive

Account menu อยู่มุมขวาบน เปิดเป็น floating layer สำหรับ Settings และ Sign out

Timeline fullscreen ใช้ component state (`timelineFullscreen`) ไม่ใช่ native browser Fullscreen API จึงยังใช้ warning, popup และ re-auth UI เดิมได้

---

## 10. จุดที่ควรระวังเมื่อต่อยอด

1. หลังเขียน Calendar ต้อง reconcile ด้วย `loadActivities()`
2. Metadata ใช้ normalized ID เสมอ
3. อย่าขยายข้อยกเว้น archive restore ไปยัง drag save ปกติโดยไม่ทบทวน rule
4. event ข้ามคืนต้องคำนวณจาก `Date` จริง ไม่ใช่แค่ชั่วโมง/นาที
5. archive เป็น local-only; ล้าง localStorage แล้วคลังหาย
6. lock ต้องเช็กทั้ง UI และ mutation handler
7. recurring occurrence กับ master series เป็นคนละระดับ ต้องใช้ `recurringEventId` ให้ถูกบริบท
8. warning ใหม่ควรเป็น floating layer เพื่อไม่กระทบ layout
9. CSS เฉพาะ Activity ควร scope ใต้ `.app--activity` / `.activity-dashboard`

---

## 11. ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| `frontend/src/app.jsx` | ประกอบ state/hook และส่ง props |
| `frontend/src/components/activity-mode-week-spine.jsx` | Week Spine, drag, detail, archive |
| `frontend/src/components/activity-modal.jsx` | ฟอร์ม create/edit และ validation |
| `frontend/src/components/activity-popup.jsx` | เมนูคลิกขวา |
| `frontend/src/components/auto-shrink-text.jsx` | ลดขนาดชื่ออย่างมีขอบเขต |
| `frontend/src/week-spine-data.js` | แปลง event เป็น daily segments |
| `frontend/src/timeline-layout.js` | snap, overlap lanes, spillover |
| `frontend/src/hooks/use-week-navigation.js` | mode, navigation, focusDate |
| `frontend/src/hooks/use-calendar-data.js` | โหลด Calendar และ metadata |
| `frontend/src/hooks/use-activity-modal.js` | modal lifecycle |
| `frontend/src/hooks/use-activity-mutations.js` | ทุก mutation |
| `frontend/src/index.css` | Week Spine, modal, archive และ styling |
