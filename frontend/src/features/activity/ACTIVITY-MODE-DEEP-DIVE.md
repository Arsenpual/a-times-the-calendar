# Activity Mode — เจาะลึก

**สถานะเอกสาร:** อ้างอิงจากโค้ดปัจจุบัน ณ 10 กันยายน 2026
**Composition root:** `frontend/src/app/app.jsx`
**UI หลัก:** `frontend/src/features/activity/components/activity-mode-week-spine.jsx`
**แหล่งข้อมูลกิจกรรม:** Google Calendar ผ่าน backend ของโปรเจกต์

> เอกสารนี้อธิบาย Activity Mode ที่ใช้งานจริง ไม่ใช่ไฟล์ mockup หรือ Agenda/Timeline Editor รุ่นเก่าที่เก็บไว้รองรับ UI บางส่วน หากไม่ตรงกับโค้ด ให้ยึดโค้ดจริงเป็นหลัก

---

## 1. ภาพรวม

Activity Mode คือพื้นที่วางแผน **กิจกรรมหลักที่มีวันและช่วงเวลาชัดเจน** เช่น ประชุม, เรียน, เดินทาง และ deep work

- กิจกรรมจริงเป็น Google Calendar event
- มุมมองหลักคือ Week Spine 7 วัน เวลา `00:00–24:00`
- ผู้ใช้สร้าง แก้ไข ลากย้าย และย่อ/ขยายเวลาจบได้
- รองรับกิจกรรมทับช่วงเวลาเดียวกันได้สูงสุด 3 รายการ
- กิจกรรมถูกส่งต่อให้ Reminder Mode แสดงบน timeline และใช้เป็นข้อมูลแจ้งเตือน Telegram ได้

| เรื่อง | Activity Mode | Reminder Mode |
|---|---|---|
| หน่วยข้อมูลหลัก | Google Calendar event | reminder document/runtime state |
| เหมาะกับ | แผนงานเป็นช่วงเวลา | การเตือน งานย่อย routine และ checklist |
| มุมมองหลัก | Week Spine / Cycle 4 สัปดาห์ | Dashboard / reminder timeline |
| เจ้าของข้อมูลเวลา | Google Calendar | Firestore/backend ตามชนิด reminder |

---

## 2. โครงสร้าง frontend

```text
src/app/app.jsx
├─ use-week-navigation
├─ use-calendar-data
├─ use-activity-modal
├─ use-activity-mutations
├─ use-activity-onboarding
├─ use-archived-activity-ids
├─ ActivityModeWeekSpine
│  ├─ Week view (แก้ไขได้)
│  ├─ Cycle view 4 สัปดาห์ (ภาพรวม)
│  ├─ ActivityPopup
│  ├─ ActivityDayGantt (แผนกิจกรรมของวันที่เลือก)
│  └─ activity archive
├─ WeeklySummaryPanel / CycleSummaryPanel
└─ ActivityModal

features/activity/
├─ api/          backend calls ของ category, tag, lock, archive, AI, notification
├─ components/   UI และ interaction
├─ hooks/        data loading, state และ mutation
├─ lib/          color, recurrence, overlap, export ภาพ
└─ styles/       activity-mode.css
```

`app.jsx` เป็น composition root: ประกอบ hook และส่ง props ลง component แทนการเก็บ business logic ทุกอย่างไว้ในหน้าจอเดียว

---

## 3. ข้อมูลและ source of truth

### Google Calendar event

Google Calendar เป็น source of truth ของกิจกรรมตามเวลา:

```js
{
  id, summary, description,
  start: { dateTime }, // หรือ { date } สำหรับ all-day
  end: { dateTime },
  recurrence, recurringEventId, updated
}
```

หลังเขียน Calendar สำเร็จ ต้องเรียก `loadActivities()` เพื่อ reconcile state กับข้อมูลจริงเสมอ `activityDate()` ใน `src/shared/lib/date-utils.js` ใช้แปลง `{ dateTime }` หรือ `{ date }` เป็น `Date` ก่อนคำนวณ

All-day activity ถูกแยกออกจาก timed block และไม่วาดบน grid 24 ชั่วโมง

### Metadata ของแอป

Google Calendar ไม่มี category, tag และ lock ของแอป จึงเก็บผ่าน backend/Firebase โดยใช้ `normalizeActivityId()` เป็น key:

| Metadata | State | หน้าที่ |
|---|---|---|
| Category | `activityCategoryMap[id]` | หมวดและสีหลัก |
| Tags | `activityTagMap[id]` | ป้ายกำกับหลายค่า |
| Lock | `lockedActivities[id]` | กันการแก้/ย้าย/ย่อขยาย/ลบกิจกรรมตัวนั้น |
| Notification | activity notification record | ข้อมูลให้ระบบแจ้งเตือน/Telegram |

สีจาก category มีลำดับเหนือสี event เฉพาะตัวผ่าน `getDisplayColor()`

### Lock ไม่ใช่ช่วงเวลาห้ามใช้

Lock ปกป้องเฉพาะกิจกรรมที่ถูกล็อก:

- แก้ไข ลาก ย่อ/ขยาย หรือลบกิจกรรมล็อกไม่ได้
- กิจกรรมอื่นยังวางทับช่วงเวลาเดียวกันได้
- lock ไม่ใช่เหตุผลให้กิจกรรมอื่นบันทึกไม่ได้

---

## 4. Week Spine

Week Spine เป็น timeline แนวตั้ง 7 คอลัมน์:

- ครอบคลุม `00:00–24:00`
- ค่าเริ่มต้น 1 box = 2 ชั่วโมง; ผู้ใช้เลือก 1h/2h/4h ได้
- fullscreen บังคับ 1 box = 1 ชั่วโมง
- drag snap ทุก 15 นาที (`SNAP_MINUTES`)
- มีเส้น grid รายชั่วโมงและแกนเวลาซ้าย
- วันปัจจุบันถูกเน้นแบบเบา ๆ

`buildWeekSpineData()` แปลง event เป็น daily segment และ `layoutOverlaps()` จัด lane/ลำดับ z-index ของ block ที่ทับกัน

### ข้ามเที่ยงคืนและชื่อกิจกรรม

กิจกรรมที่ต่อจากวันก่อนหรือยาวไปวันถัดไปเป็น continuation segment: สีจาง, ขอบซ้าย dashed และไม่เด่นกว่ากิจกรรมที่เริ่มในวันนั้น

`AutoShrinkText` ย่อ font ตามพื้นที่จริงเพื่อให้ชื่ออ่านได้ครบที่สุด พร้อม tooltip ชื่อเต็ม กิจกรรมที่สั้นกว่าอยู่ layer สูงกว่า; ชื่อของกิจกรรมยาวจะย้ายหลบส่วนที่ถูกบังเมื่อทำได้

---

## 5. กฎ overlap: สูงสุด 3 กิจกรรม

กิจกรรมทับช่วงเวลาเดียวกันได้สูงสุด 3 รายการ:

```text
1–3 รายการทับกัน → แสดงเป็น lane/stack และบันทึกได้
รายการที่ 4 ทับ ณ เวลาเดียวกัน → ปฏิเสธการบันทึก
```

`exceedsOverlapLimit()` ใน `lib/timeline-layout.js` เป็นกฎตรวจตอนบันทึกจาก Activity Modal และ batch save ของการลาก:

- ใช้ sweep-line นับกิจกรรมที่ active ในทุกช่วงเวลา
- `09:00–10:00` ต่อ `10:00–11:00` ไม่ถือว่าทับกัน
- lock ของกิจกรรมอื่นยังถูกนับเป็นกิจกรรมหนึ่งในเพดาน 3 รายการ แต่ไม่ทำให้ overlap ที่ยังไม่เกินเพดานถูกปฏิเสธ

`layoutOverlaps()` มีหน้าที่ **วาดภาพ**; `exceedsOverlapLimit()` มีหน้าที่ **บังคับกฎบันทึก** ต้องปรับทั้งสองอย่างอย่างมีเหตุผลหากเปลี่ยนเพดานในอนาคต

### เส้นวัดระหว่าง resize

ขณะลาก handle ล่างเพื่อปรับเวลาจบ จะมี `week-spine-resize-alignment-guide`:

- เส้นประแนวนอนวางตรงเวลาจบใหม่
- พาดจากแกน `00:00–24:00` ทางซ้ายผ่านทั้ง 7 วัน
- ใช้เทียบระดับกับกิจกรรมคอลัมน์อื่น
- แสดงเฉพาะระหว่างลาก และใช้ได้ใน fullscreen ด้วย

---

## 6. การสร้าง แก้ไข และ interaction

### ActivityModal

`components/activity-modal.jsx` รองรับชื่อ, notes, start/end, category, tag, recurrence, กิจกรรมข้ามเที่ยงคืน และ AI draft

กฎเวลา:

1. เพิ่มกิจกรรมใหม่หรือ draft จากคลังที่เวลาไม่ครบ: เลือก start แล้วตั้ง end เป็น +1 ชั่วโมง
2. แก้กิจกรรมเดิม: ไม่ขยับ end อัตโนมัติ
3. end ที่ดูน้อยกว่า start ในวันเดียวกันตีความเป็นกิจกรรมข้ามเที่ยงคืน
4. recurrence จำกัดไม่เกิน 28 occurrences เพื่อเทียบกับ 1 Cycle

### Interaction บน Week Spine

| การกระทำ | ผลลัพธ์ |
|---|---|
| คลิกซ้าย block | เปิด modal แก้กิจกรรมเดียว |
| คลิกขวา block | เปิด `ActivityPopup` |
| ลาก block | เปลี่ยนเวลา/วันเป็น draft |
| ลาก handle ล่าง | เปลี่ยนเวลาจบ พร้อมเส้นวัด |
| ลากพื้นที่ว่าง | เปิด modal เพิ่มกิจกรรมตามช่วงที่ลาก |
| Ctrl/Cmd-click หรือ Selection mode | เลือกหลายกิจกรรมสำหรับลบเป็นชุด |
| Escape ระหว่างวางสำเนา | ยกเลิกการวางสำเนา |

การลากไม่เขียน Calendar ทันที แต่สะสมใน `pendingTimeChanges` และบันทึกเป็น batch ผ่าน `week-spine-save-bar` การย้ายวันจาก menu จะบันทึก draft เวลาก่อน แล้วจึงย้ายวัน

---

## 7. Cycle: ภาพรวม 4 สัปดาห์

Cycle คือ 4 สัปดาห์ต่อเนื่อง (28 วัน) เพื่อดูรูปแบบการวางแผน:

- แสดง 4 week card แบบ 2 × 2 และใช้ tab สีเพื่อประหยัดพื้นที่
- ปุ่มซ้าย/ขวาเลื่อนทีละ 1 Cycle
- คลิกชื่อสัปดาห์: แสดง Weekly Summary ของสัปดาห์นั้น โดย Cycle ไม่เลื่อน
- คลิกวัน: เปิด Mini Timeline ของวันนั้น
- ปุ่ม fullscreen ของสัปดาห์: กลับ Week view และเปิด editor fullscreen ของสัปดาห์ที่เลือก
- ปิด fullscreen แล้วกลับ Cycle เดิม

### Cycle Summary

`components/cycle-summary-panel.jsx` คำนวณจากกิจกรรมชุดเดียวกับ Cycle view จึงตรงกับ tab สีที่เห็นจริง:

- จำนวนกิจกรรม, เวลาวางแผนรวม, วันที่มีกิจกรรม
- กิจกรรมและเวลารวมรายสัปดาห์
- สัดส่วนเวลาตาม category
- วันที่มีกิจกรรมมากที่สุด

เปอร์เซ็นต์ category ตั้งแต่ 1% ขึ้นไปแสดงจำนวนเต็ม; ค่ามากกว่า 0% แต่ต่ำกว่า 1% แสดงทศนิยม 2 ตำแหน่ง โดยต่ำสุดเป็น `0.01%` เพื่อไม่ปัดหมวดหมู่เล็กหายเป็น `0%`

ตัวเลข statistic ที่ยาวจน overflow จะเลื่อนช้า ๆ เฉพาะเมื่อ overflow จริง

---

## 8. Weekly Summary และ Daily Gantt

พื้นที่ summary สลับตาม context:

| Trigger | Panel |
|---|---|
| คลิกพื้นหลัง Week Spine ใน Week view | `WeeklySummaryPanel` |
| คลิกพื้นหลัง Week Spine ใน Cycle view | `CycleSummaryPanel` |
| คลิกวัน | เลือกวันให้ `ActivityDayGantt` ด้านล่าง Week Spine |
| คลิกชื่อสัปดาห์ใน Cycle | `WeeklySummaryPanel` ของสัปดาห์นั้น |

พื้นหลัง Week Spine มี hover effect เพื่อบอกว่าคลิกกลับไป summary ได้ แต่ปุ่ม, track และ block ไม่ trigger โดยไม่ตั้งใจ

### Daily Gantt

- อยู่ใต้ Week Spine และแสดงกิจกรรมของวันที่เลือกในแกนนอน 00:00–24:00
- ใช้สีของหมวดหมู่จริง และนำแถบที่ทับเวลาไปวางในได้สูงสุด 3 track
- กิจกรรมที่ซ้อนเกิน 3 รายการแสดงเป็น `+1` เพื่อไม่ให้ panel สูงเกินไป
- ปุ่ม ย่อ/ปกติ/ขยาย เปลี่ยน scale ของเวลาเฉพาะการอ่านข้อมูล
- คลิกแถบกิจกรรมเปิด `ActivityModal` เดิม จึงไม่มี editor หรือข้อมูลซ้ำชุดใหม่
- แสดง lane พร้อมกันสูงสุด 3 รายการ; ที่เกินใช้ `+N`
- คลิกกิจกรรมเพื่อ focus และหรี่กิจกรรมอื่น
- ปุ่มกล้อง export แผนวันเป็น PNG ผ่าน `lib/export-day-image.js`
- กิจกรรมใน archive ไม่ต้องแสดงบน Mini Timeline หรือ summary

---

## 9. Popup, Archive และ Notification

### ActivityPopup

`components/activity-popup.jsx` เปิดด้วยคลิกขวาเพื่อจัดการ category, tag, ทำสำเนา, ย้ายวัน, recurrence, archive และ lock/unlock

เมื่อเปิดจาก Reminder Mode ฟีเจอร์ส่วนใหญ่ถูกระงับไว้ เหลือ lock/unlock เพื่อป้องกัน state ข้าม surface ที่ไม่ปลอดภัย

### Activity Archive

Archive คือพื้นที่พักกิจกรรมที่ยังไม่ต้องแสดงใน Calendar/Week Spine:

- API อยู่ที่ `api/archive.js` และเก็บข้อมูลหลักบน Firestore ผ่าน backend
- localStorage key `times-activity-archive:<uid>` เป็น cache/สัญญาณให้ทุก surface กรองรายการได้ทันที
- `use-archived-activity-ids.js` ส่ง ID ชุดเดียวกันให้ Week Spine, Mini Timeline และ summary
- รายการเก็บข้อมูลเช่น `archiveId`, `calendarId`, `title`, start/end, categoryId, tags, color, `archivedAt`, `isDraft`

| Action | ผลลัพธ์ |
|---|---|
| เพิ่มในคลัง | สร้าง draft ที่มีเพียงชื่อได้ |
| แก้ไข | เปิด modal เต็มรูปแบบ |
| ล้างวัน/เวลา/category | เอาค่านั้นออกโดยไม่ลบชื่อ |
| ส่งไป Timeline | สร้าง/อัปเดต Calendar event และนำออกจากคลัง |
| ลบ | ลบ archive item |

ข้อมูลสำคัญไม่ครบจะเปิด modal พร้อมกรอบแดงที่ field ที่ต้องใส่

### Mutation และ Telegram

`hooks/use-activity-mutations.js` เป็นจุด write หลัก:

| Handler | หน้าที่ |
|---|---|
| `handleSaveActivity` | create/update event, category, tag และ notification record |
| `handleSaveTimes` | batch time save พร้อมกฎ overlap และข้ามเฉพาะรายการที่ล็อกเอง |
| `handleDeleteActivity` / `handleDeleteSeries` | ลบ occurrence หรือทั้ง series |
| `handleDuplicateActivity` | ทำสำเนา category/tag แต่ไม่ copy lock |
| `handleMoveActivityToDay` | ย้ายวันโดยรักษา duration |
| `handleAssignCategory` / `handleToggleLock` | sync metadata |

หลัง mutation สำเร็จต้อง reload กิจกรรม หาก token Calendar หมดอายุ ระบบเคลียร์ access token เพื่อเริ่ม re-auth flow ใหม่ Activity notification record เป็นข้อมูลให้ระบบแจ้งเตือนและ Telegram ใช้ต่อ

---

## 10. Fullscreen, onboarding, AI และ mockup

### Fullscreen

Fullscreen เป็น overlay ของแอป (`timelineFullscreen`) ไม่ใช่ Browser Fullscreen API:

- เปิดด้วย Anime.js animation 500ms
- ซ่อน `app-header`
- popup, warning และ re-auth prompt ยังทำงาน
- ปิดด้วยปุ่มหรือ Escape
- ถ้ามาจาก Cycle view จะ restore กลับ Cycle เดิม

`ActivityDayGantt` อยู่ใต้ Week Spine เฉพาะคอลัมน์ timeline ส่วน `activity-archive` อยู่ล่างสุดเต็มความกว้างสำหรับอ่าน/scroll

### Onboarding และ AI draft

`use-activity-onboarding.js` สร้างกิจกรรมตัวอย่างสำหรับผู้ใช้ใหม่ในสัปดาห์ปัจจุบัน โดยเก็บสถานะต่อผู้ใช้ใน localStorage และไม่ควรกลายเป็น Calendar event โดยไม่ตั้งใจ

`api/activity-draft.js` ส่งข้อความธรรมชาติไป backend เพื่อสร้าง draft ให้ผู้ใช้ตรวจใน ActivityModal ก่อนบันทึกจริง AI ต้องไม่เขียน Calendar โดยตรง

### Mockup preview สำหรับพัฒนา

Mockup แยกจาก runtime อยู่ที่ `src/dev/mockups/`:

- เพิ่มไฟล์ `activity-mode-<name>-mockup.jsx` พร้อม `export default`
- `import.meta.glob` ใน `src/app/app.jsx` ค้นหาไฟล์ให้อัตโนมัติ
- เปิดด้วย `Ctrl + Alt + W`
- ปุ่ม `Mockup` ลากไปที่ใดก็ได้ในหน้าจอ และอยู่เหนือ layout mockup ทุกตัวด้วย z-index สูงสุด

---

## 11. ข้อควรระวังเมื่อต่อยอด

1. ใช้ `Date` และ `activityDate()` สำหรับเวลา โดยเฉพาะกิจกรรมข้ามเที่ยงคืน
2. Metadata ใช้ normalized ID แต่การลบ occurrence ต้องใช้ raw occurrence id
3. อย่าสับสน `layoutOverlaps()` (ภาพ) กับ `exceedsOverlapLimit()` (กฎบันทึก)
4. lock ของกิจกรรมหนึ่งไม่ใช่ lock ของช่วงเวลา
5. หลัง Calendar mutation ต้อง `loadActivities()`
6. Archive ต้องถูกกรองออกจากทุก surface ไม่ใช่เฉพาะ Week Spine
7. recurrence ต้องแยก instance จาก `recurringEventId` ให้ถูกบริบท
8. Notification/Telegram ต้องป้องกัน duplicate delivery หากเปิดหลายอุปกรณ์
9. warning ใหม่ควรเป็น floating overlay เพื่อไม่ให้ layout กระโดด
10. CSS เฉพาะ feature อยู่ใน `styles/activity-mode.css`; shared UI อยู่ `src/shared/`

---

## 12. ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| `src/app/app.jsx` | ประกอบ state/hook และเลือก Week/Cycle/Summary view |
| `components/activity-mode-week-spine.jsx` | Week Spine, Cycle, drag, fullscreen และ archive |
| `components/activity-day-gantt.jsx` | Gantt รายวันใต้ Week Spine, track overlap และเปิด ActivityModal |
| `components/activity-modal.jsx` | ฟอร์ม create/edit และ validation |
| `components/activity-popup.jsx` | popup คลิกขวา |
| `components/weekly-summary-panel.jsx` | สรุปรายสัปดาห์ |
| `components/cycle-summary-panel.jsx` | สรุป 4 สัปดาห์ |
| `hooks/use-activity-mutations.js` | Calendar writes, metadata, notification sync |
| `hooks/use-calendar-data.js` | โหลดกิจกรรม/categories/tags/locks |
| `hooks/use-archived-activity-ids.js` | กรอง archived IDs ข้าม surface |
| `lib/week-spine-data.js` | แปลง event เป็น daily segments |
| `lib/timeline-layout.js` | snap, overlap layout/max-3, spillover |
| `lib/rrule-utils.js` | recurrence และ limit 28 occurrences |
| `lib/export-day-image.js` | export กำหนดการรายวันเป็น PNG |
| `api/archive.js` | Firestore-backed archive API |
| `styles/activity-mode.css` | CSS ของ Activity Mode |
