# สรุป Session — Times The Calendar: Reminder Mode Mockup

**ไฟล์ที่แก้ไข:** `reminder-mode-mockup.jsx`
**Stack:** React + Vite (frontend), Node.js + Express (backend), Firebase Auth, Firestore, GitHub Pages + Render.com

---

## งานที่ทำเสร็จใน session นี้

### 1. Timeline scroll — ยืดขอบไม่ให้ now-indicator ชนขอบ 00:00/24:00
- ลองแนวทาง "duplicate track 5 copies + wrap scroll" ก่อน แต่เปลี่ยนใจเป็นแนวทางที่ง่ายกว่า
- **แนวทางสุดท้ายที่ใช้:** เพิ่ม spacer ว่างที่หัว-ท้าย track (`SPACER_HEIGHT_PX = 240px`) แทนการ duplicate ข้อมูล
  - Track ยังเป็นวันเดียวจริง ๆ (00:00–24:00) ไม่มีปัญหาสับสนวัน/เวลา
  - `calculateTargetScrollTop()` ปรับสูตรให้บวก offset ของ spacer บนเข้าไปด้วย
- **เผื่ออนาคต:** spacer มี comment `TODO` วางจุดไว้ใส่ content เพิ่มได้ เช่น `<AdSlot position="timeline-top" />` (ผู้ใช้บอกว่าจะใช้เป็นที่ใส่โฆษณาในอนาคต)

### 2. Layout ใหม่ใน main-panel — ประหยัดพื้นที่
- **Composer เป็น inline expand/collapse** (เลือกแบบนี้จากตัวเลือก inline/modal/side-panel)
  - Default พับเก็บ (`isComposerOpen = false`) มีแค่ปุ่ม "+ เพิ่ม Reminder" ใน toolbar
  - กดแล้วฟอร์มดันลงมาแทนที่ในตำแหน่งเดิม พร้อม fade+slide animation
  - กด "แก้ไข" การ์ดใดก็เปิด composer อัตโนมัติ, ปุ่มเปลี่ยนข้อความ/หมุนไอคอนตามสถานะ
- **Reminder card กระชับขึ้น:** ลด padding/gap, ไอคอนวงกลม 36→26px, toggle switch 44→36px, ปุ่มแก้ไข/ลบซ่อนไว้โผล่เฉพาะ hover/focus
- **Section header เป็น sticky** ("กำลังทำงาน"/"ปิดใช้งาน" ติดด้านบนตอน scroll)

### 3. Timeline แสดง reminder ทุกประเภทเสมอ (ไม่ใช่แค่ตอนถึงเวลา)
- เพิ่มฟังก์ชัน `getReminderTimeSlots(reminder, startOfTodayMs)` คืนค่า "นาทีของวัน" ที่แต่ละ reminder ควรปักหมุด โดยไม่สนใจ `enabled`/`nextDueAt`:
  - **Interval** → ปักซ้ำทุก N นาที (จำกัดใน window ถ้ามี)
  - **Weekly** → ปักที่เวลาเดียวกันทุกวัน
  - **Once-at** → ปักตามเวลา เฉพาะวันเดียวกับวันนี้
  - **Countdown** → ปักที่เวลาสิ้นสุด ถ้าจบภายในวันนี้
  - **Event-anchored / Routine / Stopwatch** → ไม่มีเวลาตายตัวรายวัน จึงไม่ปักหมุด
- เปลี่ยนจาก `flag` (ตัวเดียว) เป็น `flags` (array) รองรับหลาย reminder ชนกันในช่องเวลาเดียวกัน
- CSS: `.event-chip-group` scroll แนวนอนได้, มี state `.disabled` (สีจาง) สำหรับ reminder ที่ปิดใช้งาน

### 4. แก้บัก Once-at และ Countdown (ที่ใช้งานไม่ได้จริง)
1. **Timezone bug (Once-at):** `startEdit` เดิมใช้ `toISOString().split("T")[0]` แปลงเป็น UTC ทำให้วันที่เพี้ยนเวลาใกล้เที่ยงคืน (ไทย +7) → แก้ด้วยฟังก์ชันใหม่ `toLocalDateInputValue()` ที่อ่าน local time ตรง ๆ
2. **Countdown ไม่ tick แบบ live:** เดิมโชว์ duration ตั้งต้นค้างไว้ตลอด → เพิ่ม state `nowTick` (อัปเดตทุกวินาที รวมกับ interval เดิมของ `checkDue`) และแก้ `describeReminder` ให้คำนวณเวลาที่เหลือจริงแบบ `mm:ss`
3. **Toggle เปิดซ้ำแล้วยิงทันที (ทั้งสองประเภท):** แก้ `toggle()` ให้:
   - Countdown: เปิดใหม่ = รีสตาร์ตนับใหม่ทั้งหมด (`startedAt: Date.now()`)
   - Once-at: ถ้าเวลาที่ตั้งไว้ผ่านไปแล้ว จะไม่เปิดให้ แต่เตือนให้ไปแก้ไขวันที่/เวลาใหม่ก่อน

### 5. เพิ่ม reminder ประเภทใหม่: Stopwatch (จับเวลา)
- **Spec ที่ยืนยันแล้ว:** จับเวลานับขึ้นอย่างเดียว ไม่มีแจ้งเตือน, ปุ่ม Start/Stop เท่านั้น (ไม่มี pause/resume แยก เพราะ stop คือ pause ในตัว)
- **Data model:** `accumulatedMs` + `startedAt`
  - หยุด: `enabled: false`, `startedAt: null`, เวลาสะสมอยู่ใน `accumulatedMs`
  - ทำงาน: `enabled: true`, `startedAt` = เวลาที่กด Start ล่าสุด, เวลาที่แสดง = `accumulatedMs + (now - startedAt)`
  - กด Start/Stop สลับได้หลายรอบ เวลานับต่อกันไม่รีเซ็ต
- `computeNextDueAt` คืน `Infinity` เสมอ (ไม่มีวันถึงกำหนด), ไม่เข้า `checkDue`/`dueReminders`
- ไม่ปักหมุดบน timeline (เหมือน Event-anchored/Routine — ไม่มีเวลาตายตัวรายวัน)
- UI: ปุ่ม Start (ฟ้า) / Stop (แดง) แทน toggle switch ทั่วไป + ปุ่ม ↺ รีเซ็ตเป็น 0
- แก้ไขชื่อ stopwatch ที่มีอยู่แล้วจะไม่รีเซ็ตเวลาที่จับไว้ (คง `accumulatedMs`/`startedAt` เดิม)

---

## สถานะปัจจุบันของ REMINDER_TYPE (7 ประเภท)

| ประเภท | มีแจ้งเตือน | ปักหมุดบน timeline | หมายเหตุ |
|---|---|---|---|
| Interval | ✅ | ✅ (ซ้ำหลายจุด) | |
| Weekly | ✅ | ✅ (จุดเดียว/วัน) | |
| Event-anchored | ✅ | ❌ | ขึ้นกับ event ภายนอก |
| Routine | ✅ (แบบ step) | ❌ | ไม่มีเวลาตายตัว |
| Once-at | ✅ | ✅ (ถ้าเป็นวันนี้) | แก้ timezone bug แล้ว |
| Countdown (Timer) | ✅ | ✅ (ถ้าจบวันนี้) | แก้ live-tick + toggle bug แล้ว |
| Stopwatch | ❌ | ❌ | ใหม่ล่าสุด session นี้ |

---

## สิ่งที่ยังไม่ได้ทำ / ควรพิจารณาต่อ

- [ ] **Sync กับ Firestore** — reminders ทั้งหมดยังเก็บใน `localStorage` (`times-reminders-v1`) เท่านั้น ยังไม่เชื่อมกับ backend/Firestore ของแอปหลัก (ถามไว้ในบทสนทนาแต่ยังไม่ได้ทำ)
- [ ] **Ad slot ใน spacer** — วาง TODO ไว้แล้วในโค้ด (`tape-spacer-top`/`tape-spacer-bottom`) แต่ยังไม่มี component จริงมาใส่
- [ ] **Filter chip/tab ใน toolbar** — เผื่อพื้นที่ไว้แล้วใน comment แต่ยังไม่มี UI จริง
- [ ] **ตรวจสอบ event-chip-group เวลามี reminder ชนกันเยอะมาก** — ปัจจุบัน scroll แนวนอนได้ แต่ยังไม่ได้ทดสอบ UX จริงเวลามีจำนวนมาก ๆ ในแถวเดียว
- [ ] Stopwatch ยังไม่มีการทดสอบ UI จริง (เป็น mockup) — ควรลองสร้าง/Start/Stop/Reset ดูจริงเพื่อเช็ค edge case เช่น รีเฟรชหน้าเว็บระหว่างที่ stopwatch กำลังทำงานอยู่ (ค่า `startedAt` ยังอยู่ใน localStorage ก็ควรคำนวณเวลาที่ผ่านไปถูกต้องหลัง reload — ควรตรวจสอบ)

---

## ไฟล์ส่งมอบ
`reminder-mode-mockup.jsx` — ไฟล์ล่าสุดพร้อมการแก้ไขทั้งหมดข้างต้น อยู่ที่ `/mnt/user-data/outputs/`
