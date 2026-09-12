# Activity Mode — Phase 1 state extraction

ตรวจและทดสอบล่าสุด: 12 กันยายน 2026

## ขอบเขต

Navigation lifecycle: `useActivityView` และ `useWeekNavigation` รับ userId
เมื่อ userId เปลี่ยน (รวม logout เป็น null) จะ reset ก่อน render ลูก:
week view, weekly summary, Cycle anchor ใหม่, fullscreen request เป็น 0,
ล้าง Cycle restore ref, cursor เป็นวันนี้ และ expandedDate เป็น null
การ render ปกติหรือสลับโหมดด้วย userId เดิมไม่ใช้ reset นี้
ทดสอบบัญชี A → B และ logout ใน `activity-view-browser.mjs`

`use-activity-collections.js` แยก derived data สองชุดจากข้อมูลเดิม:
- `calendarActivities`: กิจกรรม Calendar ที่โหลดแล้วและไม่ได้เก็บเข้าคลัง ส่งให้ Reminder โดยไม่ผ่าน tag search หรือกิจกรรมตัวอย่าง
- `visibleActivities`: มุมมอง Activity รวม onboarding เมื่อไม่ได้ค้นหา หรือใช้ผลค้นหา tag แบบ OR เมื่อค้นหา

ไม่มีการ fetch เพิ่มหรือสร้าง state สำเนา การเลือกช่วงวันที่เพื่อโหลด Calendar และระบบแจ้งเตือนคงเดิม
ทดสอบ: `node frontend/tests/activity-collections.test.mjs`

Phase 3: `use-activity-view.js` เป็นเจ้าของมุมมอง Week/Cycle,
Cycle anchor, summary panel mode และ fullscreen request/return
ส่วน cursorDate/expandedDate ยังอยู่ใน useWeekNavigation

`use-cycle-activities.js` ถูกเรียกที่ App เพียงจุดเดียว แล้วส่ง `cycleData`
ให้ Week Spine และ Cycle Summary โดยตรง ไม่มี state สำเนาหรือ onCycleDataChange
กรองคลังด้วย archivedActivityIds ชุดเดียว และแยกผลโหลดตามบัญชี/token/ช่วงเวลา
ผลจาก request เก่าถูกละทิ้งเมื่อเลื่อน Cycle, เปลี่ยนบัญชี หรือออกจากมุมมอง
ทดสอบ: `node frontend/tests/cycle-data.test.mjs`

ทดสอบขั้นนี้: `node frontend/tests/activity-view-browser.mjs`
ครอบคลุมเลือกสัปดาห์โดยไม่เลื่อน Cycle, เลื่อน Cycle โดยไม่เปลี่ยน focus,
สลับ summary, เปิด editor ซ้ำ และคืนมุมมองหลังปิด fullscreen

`ActivityModeWeekSpine` ประกอบ UI และส่งคำสั่งให้ hooks ตามหน้าที่ โดยมี `WeekSpineContent` ที่ผูก `key` กับ userId เพื่อเริ่ม state ใหม่เมื่อเปลี่ยนบัญชี รวมถึงยกเลิก effect ของบัญชีเก่า

| ส่วน | เจ้าของ |
| --- | --- |
| ชื่อสัปดาห์และ inline editor | `use-week-names.js` |
| ข้อมูล Cycle / loading / error | `use-cycle-activities.js` |
| วันที่เลือก, popup, warning, hover | `use-week-spine-ui-state.js` |
| Fullscreen / animation / cleanup | `use-week-spine-fullscreen.js` |
| รายการที่เลือกและปุ่มลัดลบ | `use-week-spine-selection.js` |
| Pointer state และเส้นวัด/แสงตอบสนอง | `use-week-spine-drag-state.js` |
| Drag / resize / copy placement | `use-week-spine-drag-controller.js` |
| Pending edits, Undo/Redo, Save, บันทึกก่อนย้ายวัน | `use-week-spine-time-changes.js` |
| Pure history transitions | `../lib/week-spine-time-changes.js` |
| ประกอบระบบคลังและเปิดเผยคำสั่งแก่ UI | `use-activity-archive.js` |
| State/ref ภายในคลัง | `use-activity-archive-state.js` |
| Hydration, serialized writes, retry | `use-activity-archive-sync.js` |
| แก้ข้อมูลในแถวคลัง | `use-activity-archive-editor.js` |
| เก็บจาก Calendar / ส่งกลับ Calendar | `use-activity-archive-calendar-actions.js` |

UI ชื่อสัปดาห์และมุมมอง Cycle แยกเป็น `week-name-field.jsx` และ `four-week-overview.jsx` แล้ว

## พฤติกรรมสำคัญ

- ประวัติ Undo/Redo เปลี่ยนเป็นหนึ่ง transition โดยไม่มี nested state setters
- Save เก็บ snapshot ตอนเริ่ม และล้างเฉพาะรายการเวอร์ชันที่บันทึกสำเร็จ จึงไม่ล้างการแก้เพิ่มระหว่างรอ API
- ปิด Undo/Redo/Discard ระหว่าง Save และป้องกัน Save ซ้ำระหว่างคำขอเดิม
- การย้ายวันผ่านคำสั่งย้ายวัน รวมทั้งลากกิจกรรมทั้งวัน ต้องบันทึก pending edits ก่อน หากบันทึกไม่สำเร็จจะไม่ย้าย
- Archive เขียนตามลำดับ และอัปเดต snapshot หลัง API สำเร็จเท่านั้น คำขอล้มเหลวลองใหม่หลัง 15 วินาทีขณะ component ยังเปิดอยู่
- การแก้และลบระหว่าง hydration ถูกเก็บไว้ ไม่ให้ response เก่านำรายการกลับมา
- งาน Calendar ที่รออยู่ตรวจ session ก่อนทำขั้นถัดไปเมื่อเปลี่ยนบัญชีหรือออกจาก component
- ชื่อสัปดาห์ยังเก็บใน localStorage ตามบัญชี ไม่มีการเพิ่ม cloud sync ใน Phase 1
- โค้ด Archive รุ่นเก่าที่ซ้ำใน component ถูกนำออกแล้ว

## การทดสอบ

จากโฟลเดอร์หลัก:

```powershell
node frontend/tests/activity-phase1.test.mjs
node frontend/tests/activity-phase1-browser.mjs
npm run build --prefix frontend
```

Test runtime ใช้โฟลเดอร์ชั่วคราวเช่นเดียวกับ `reminder-sync.test.mjs` หากเครื่องยังไม่มี:

```powershell
npm install --prefix "$env:TEMP/times-reminder-sync-tests" --no-audit --no-fund react@18.3.1 react-test-renderer@18.3.1 playwright
```

Browser test ใช้ Chrome ที่ติดตั้งใน Windows, Vite บน loopback port ชั่วคราว และ fixture ใน `frontend/tests/fixtures/` ซึ่งไม่ถูก import เข้า production app

ทดสอบผ่าน: batch Undo/Redo, Save failure, concurrent edits, save-before-move, archive hydration/edit/delete/retry, PUT/DELETE ordering, stale account responses, week-name account switching และ cleanup

Chrome ทดสอบ component จริง: Drag/Resize, เลือกหลายกิจกรรม, Copy/วาง/Esc, Fullscreen, Cycle return/double-click และลากกิจกรรมทั้งวันหลังมี pending edits

API ในการทดสอบถูกแทนด้วยข้อมูลจำลองและปิดการเชื่อมต่อออกจาก loopback จึงไม่ได้ทดสอบสิทธิ์ Google Calendar หรือเขียน Firestore จริง
