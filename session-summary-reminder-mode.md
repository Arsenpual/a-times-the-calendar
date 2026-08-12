# สรุป Session — Times The Calendar: Reminder Mode (ต่อจาก session ก่อนหน้า)

**ไฟล์ที่แก้ไข:** `reminder-mode-mockup.jsx`
**ไฟล์ส่งมอบล่าสุด:** `/mnt/user-data/outputs/reminder-mode-mockup.jsx`

---

## งานที่ทำเสร็จใน session นี้

### 1. เส้นแสดงสถานะ "กำลังทำงาน" บน Timeline สำหรับ Countdown (Timer) และ Stopwatch
โจทย์: reminder ทุกประเภทต้องแสดงบน timeline 24 ชม. ว่า "กำลังทำงาน" อยู่ — เริ่มจาก Timer/Stopwatch ก่อน

- **ฟังก์ชันหลัก:** `getRunningLineSpan(reminder, nowMs, startOfTodayMs)` — คำนวณช่วง [startMinute, endMinute] แบบทศนิยม (ไม่ปัดเศษ) ด้วย `minuteOfDayAtPrecise()` เพื่อให้เส้นขึ้นทันทีตั้งแต่วินาทีแรกที่กด Start
  - **Stopwatch:** เส้นเริ่มที่จุด Start แล้ว **ขยายยาวออกไปเรื่อย ๆ** ไปทาง "ตอนนี้" (`nowTick`)
  - **Countdown (Timer):** เส้นเต็มความยาวทันที (จาก start ถึง end ที่ตั้งไว้) แล้วฝั่ง "เริ่ม" **บีบเข้าหาจุดสิ้นสุด** เรื่อย ๆ จนกระทั่งหายไปพอดีตอนนับครบ
  - ถ้า `startedAt` เป็นเมื่อวาน (ข้ามวัน) จะ clamp เป็น 00:00 ของวันนี้ (timeline แสดงแค่วันเดียว)
- **ตำแหน่งการวาด:** ย้ายจาก render ใน `.tape-track-wrapper` (ถูก scroll ครอบตัด) ไปอยู่ใน `.timeline-viewport` แทน (จุดเดียวกับ `.now-indicator`) คำนวณตำแหน่งเทียบกับกึ่งกลาง viewport (`calc(50% + Npx)`) แทนตำแหน่ง scrollTop ของ track — ทำให้ไม่ถูก `overflow` ครอบตัด และแสดงเต็มความยาวเสมอ
- **สไตล์เส้น:** จากเส้นแคบ 3px กลายเป็น**แถบกว้างเต็มพื้นที่แถว** (`left: 84px; right: 8px` ตรงกับ `event-chip-group`) มีเส้นขอบซ้าย-ขวาสีเข้ม + พื้นหลังโปร่งแสงจาง (~30% opacity) ด้วย `linear-gradient` แนวตั้งจางเข้า-ออกหัวท้าย ให้เห็น grid/chip ทะลุผ่านได้ ไม่ทึบบัง

### 2. ระบบเลือกสีเส้นได้หลายสี (สำหรับ Timer/Stopwatch)
- เพิ่ม `LINE_COLOR_OPTIONS` — พาเลตสี 18 สี ครอบคลุมทุกโทน
- เพิ่ม `<input type="color">` ซ่อนอยู่ในปุ่มวงกลม conic-gradient (แบบ "เลือกสีเอง") ให้เลือกสีอิสระได้ไม่จำกัดนอกเหนือจากพาเลต
- เพิ่ม field `lineColor` ใน `draft` state (default = เหลือง `#fbbc04`) ครบทุกจุด reset (initial state, บันทึกเสร็จ, ยกเลิก, ดึงค่าคืนตอนกด "แก้ไข")
- แต่ละ reminder เก็บ `lineColor` เป็นของตัวเอง ส่งผ่าน CSS variable `--line-color` เข้าไปที่แถบบน timeline

### 3. แก้ปัญหา Performance/Jank ของ Auto-scroll (ใช้เวลานานสุดใน session นี้)
ปัญหาเดิม: auto-scroll ไปหา now-indicator กระตุก โดยเฉพาะตอนซูมระดับ 1 นาที/ช่อง (1,440 แถว DOM)

**สาเหตุที่พบและแก้ตามลำดับ:**
1. **`setInterval` + `scrollTo(behavior:"smooth")` ทุก 10 วินาที** — แต่ละครั้งบราวเซอร์เริ่ม animation ใหม่ทับของเก่า แย่งกันควบคุม scrollTop → **แก้:** เปลี่ยนเป็น `requestAnimationFrame` loop
2. **การ "สแนป" แทนการ "ไหล"** — เดิมทุกเฟรมคำนวณตำแหน่งเป้าหมายใหม่แล้วกระโดดไปทันทีถ้าใกล้พอ (เหมือนเข็มวินาทีสะบัด ไม่ใช่การไหลต่อเนื่อง) → **แก้:** เปลี่ยนเป็น **velocity-based scrolling** — คำนวณอัตราเร็ว px/ms คงที่จากสัดส่วนเวลาจริง (1440 นาที : `singleDayHeight`) แล้วบวก `scrollTop += deltaMs * pxPerMs` ทุกเฟรมโดยใช้ `deltaMs` จาก `requestAnimationFrame` timestamp จริง — ไม่มีการคำนวณเป้าหมายแล้วกระโดดอีกต่อไป
3. **Drift Correction:** sync กับตำแหน่งจริงเบา ๆ ทุกเฟรม เพื่อกันความคลาดเคลื่อนสะสมจาก floating point — ทำงานเฉพาะตอนคลาดเคลื่อนเกิน **5px** ขึ้นไป ดึงกลับทีละ **10% ของระยะ (`drift * 0.1`)** ไม่กระโดดพรวดพราด (ปรับตามเอกสารที่ผู้ใช้แนบมาให้ในช่วงท้าย session)
4. **Initial snap:** ใช้ `hasSnappedInitiallyRef` (เก็บเป็น ref ไม่ใช่ closure variable เพื่อให้ reset ข้ามรอบ effect ได้) — เฟรมแรกหลัง mount/เปลี่ยน zoom หรือเพิ่งปล่อยมือจากการลาก จะ sync ตำแหน่งให้ตรงเวลาจริง**ทันทีหนึ่งครั้ง** ก่อน แล้วค่อยเปลี่ยนไปโหมดไหลต่อเนื่องแบบ velocity-based
5. **CSS:** เพิ่ม `scroll-behavior: auto` ชัดเจนที่ `.tape-scroll-container` (กัน CSS smooth-scroll ของบราวเซอร์ตีกับ JS loop) — `will-change: scroll-position` และ `transform: translateZ(0)` มีอยู่แล้ว
6. **Idle timeout:** ลดจาก 5 วินาทีเหลือ **3 วินาที** (ตามเอกสารที่แนบมา) — หลังผู้ใช้เลิกลาก/ไถจอ 3 วิ จะ reset `hasSnappedInitiallyRef` เพื่อ sync ตำแหน่งครั้งเดียวก่อนกลับไปไหลต่อเนื่อง
7. **Event handlers:** `onScroll`/`onWheel`/`onTouchMove` ผูกกับ `handleUserInteraction` ที่ container ครบแล้ว (ป้องกัน auto-scroll ตีกับการโต้ตอบของผู้ใช้)

### 4. Performance ของแถว Timeline (1,440 แถวตอนซูม 1 นาที/ช่อง)
- แยก component `TimelineRows` ออกมาครอบด้วย `React.memo` พร้อม custom comparator ที่เทียบเฉพาะ reference ของ `tapeRows` (เปลี่ยนเมื่อ reminders/zoom เปลี่ยนจริงเท่านั้น) ไม่สนใจ `nowTick` ที่เปลี่ยนทุกวินาที — ลดการ re-render โดยไม่จำเป็น
- เพิ่ม CSS `content-visibility: auto` + `contain-intrinsic-size` บน `.time-row` ให้ browser ข้าม layout/paint ของแถวนอกจอ

---

## คำถามที่ค้างอยู่ตอนจบ session (ยังไม่ได้ตอบ)

ผู้ใช้ถามว่า **"ทำ Zero-Jank Fix ได้ไหม"** — ตอบไปแล้วว่าทำได้ในระดับ "แทบจะ zero-jank" (practically zero) แต่ไม่มี zero แบบสัมบูรณ์ 100% เพราะ main thread ของบราวเซอร์ยังถูกแย่งใช้ร่วมกับงานอื่นได้เสมอ (GC, tab อื่น, React re-render หนัก ๆ)

เสนอตัวเลือกไว้ 4 ทาง ผู้ใช้ยังไม่ได้เลือก:
1. **เปลี่ยนไปใช้ CSS `transform: translateY()` แทน `scrollTop` โดยตรง** — เพราะ `transform` เป็น compositor-only property (ไม่ trigger layout/paint) ในขณะที่ `scrollTop` ยังต้องผ่าน main thread เสมอ — ทางนี้คือทางที่ลด jank ได้สูงสุดในบรรดาที่เสนอ
2. **เพิ่ม virtualization จริง** (render เฉพาะแถวที่เห็นในจอ) ลดจำนวน DOM จาก 1,440 เหลือเพียงหลักสิบ
3. **ทำทั้งสองอย่าง**
4. **ขอดูของที่ทำไปแล้วก่อน ยังไม่เพิ่มตอนนี้**

ก่อนหยุด session ผู้ใช้แนบเอกสาร `ขั้นตอนวิธีแก้ไขปัญหา.md` มาให้ทำตามเพิ่ม (ทำเสร็จแล้วตามข้อ 3 ด้านบน) แต่ยังไม่ได้เลือกตอบคำถาม Zero-Jank ข้างต้น — **ควรถามผู้ใช้ต่อจากตรงนี้เมื่อกลับมาทำใหม่**

---

## สถานะปัจจุบันของ REMINDER_TYPE (7 ประเภท) — อัปเดตจาก session ก่อน

| ประเภท | มีแจ้งเตือน | ปักหมุดบน timeline | แสดงสถานะ "กำลังทำงาน" บน timeline | หมายเหตุ |
|---|---|---|---|---|
| Interval | ✅ | ✅ (ซ้ำหลายจุด) | ❌ ยังไม่ทำ | |
| Weekly | ✅ | ✅ (จุดเดียว/วัน) | ❌ ยังไม่ทำ | |
| Event-anchored | ✅ | ❌ | ❌ ยังไม่ทำ | ขึ้นกับ event ภายนอก |
| Routine | ✅ (แบบ step) | ❌ | ❌ ยังไม่ทำ | ไม่มีเวลาตายตัว |
| Once-at | ✅ | ✅ (ถ้าเป็นวันนี้) | ❌ ยังไม่ทำ | |
| Countdown (Timer) | ✅ | ✅ (ถ้าจบวันนี้) | ✅ **ทำแล้ว session นี้** (เส้นบีบเข้า + เลือกสีได้) | |
| Stopwatch | ❌ | ❌ | ✅ **ทำแล้ว session นี้** (เส้นขยายออก + เลือกสีได้) | |

---

## สิ่งที่ยังไม่ได้ทำ / ควรพิจารณาต่อ

- [ ] **ตอบคำถาม Zero-Jank ค้างไว้** — เลือกว่าจะทำ `transform: translateY()`, virtualization, ทั้งคู่, หรือหยุดแค่นี้ (ดูรายละเอียดด้านบน)
- [ ] **แสดงสถานะ "กำลังทำงาน" ให้ครบทุกประเภท** — ยังเหลือ Interval, Weekly, Event-anchored, Routine, Once-at (ต้องคิดภาษาภาพต่างจาก Timer/Stopwatch เพราะไม่ใช่ทุกประเภทที่มีจุดเริ่ม-จบชัดเจนแบบนับเวลา)
- [ ] **Sync กับ Firestore** — reminders ทั้งหมดยังเก็บใน `localStorage` (`times-reminders-v1`) เท่านั้น ยังไม่เชื่อมกับ backend/Firestore ของแอปหลัก
- [ ] **Ad slot ใน spacer** — วาง TODO ไว้แล้วในโค้ด (`tape-spacer-top`/`tape-spacer-bottom`) แต่ยังไม่มี component จริงมาใส่
- [ ] **Filter chip/tab ใน toolbar** — เผื่อพื้นที่ไว้แล้วใน comment แต่ยังไม่มี UI จริง
- [ ] **ตรวจสอบ event-chip-group เวลามี reminder ชนกันเยอะมาก** — ยังไม่ได้ทดสอบ UX จริงเวลามีจำนวนมาก ๆ ในแถวเดียว
- [ ] **Stopwatch page-reload edge case** — ยังไม่ได้ทดสอบว่ารีเฟรชหน้าเว็บระหว่าง stopwatch กำลังทำงานแล้วค่า `startedAt` ใน localStorage คำนวณเวลาที่ผ่านไปถูกต้องหลัง reload หรือไม่

---

## ไฟล์ส่งมอบ
`reminder-mode-mockup.jsx` — ไฟล์ล่าสุดพร้อมการแก้ไขทั้งหมดข้างต้น อยู่ที่ `/a-times-the-calendar\session-summary-reminder-mode.md`
