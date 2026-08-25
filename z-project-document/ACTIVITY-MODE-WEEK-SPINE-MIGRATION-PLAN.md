# Activity Mode — Week Spine Migration Plan

## เป้าหมาย

ย้าย Activity Mode จากตาราง agenda เดิมไปสู่หน้าจอ **Week Spine** โดยใช้
`frontend/src/components/activity-mode-week-spine-mockup.jsx` เป็นแบบอ้างอิงของ
interaction และหน้าตา ไม่ใช่ source ที่นำไปใช้จริงโดยตรง

หน้าจอจริงต้องใช้ข้อมูล Google Calendar, การแก้ไขกิจกรรมที่มีอยู่, ระบบ lock,
category, tag และการแจ้งเตือนเวลาซ้อนของโปรเจกต์ปัจจุบันได้ครบ

## หลักการตัดสินใจ

- Mockup เป็น reference เท่านั้น: ห้ามผูก business logic เข้ากับข้อมูลตัวอย่างใน mockup
- แยก data / timeline geometry / drag interaction / UI ออกจากกัน เพื่อขยายภายหลังได้
- ให้การลากแสดงผลลื่นก่อน แล้วค่อย commit ไป Google Calendar เมื่อปล่อยเมาส์
- อนุญาตให้ลากผ่านกิจกรรมอื่นได้เพื่อใช้งานง่าย แต่ต้องตรวจและแจ้งเตือนเมื่อบันทึกแล้วเวลาเหลื่อมกัน
- กิจกรรมข้ามวันต้องเก็บเป็น activity เดียว ไม่แตกข้อมูลจริงออกเป็นหลายรายการ

## ขอบเขต MVP

1. แสดง 7 วันเป็นคอลัมน์ โดยมีแกนเวลาจาก 06:00–24:00
2. เลือกวันเพื่อแสดงรายละเอียดกิจกรรมด้านล่าง
3. สลับสัปดาห์ด้วยระบบ navigation เดิม
4. ลากบนพื้นที่ว่างเพื่อสร้างกิจกรรม
5. ลาก block เพื่อย้ายเวลา และลากขอบล่างเพื่อปรับระยะเวลา
6. Snap-to-grid ขณะลาก
7. บันทึกการสร้าง/ย้าย/ปรับเวลาไป Google Calendar ผ่าน handler เดิม

## งานนอก MVP แต่ต้องออกแบบเผื่อไว้

- Multi-day activity และการตัดแบ่งเพื่อ render ในแต่ละวัน
- Overlap layout: ซ้อน/วางข้างกันอย่างอ่านง่าย
- Reminder badge และสถานะ Reminder ที่เชื่อมกับ Activity
- Summary, filter และ tag search ในรูปแบบที่เหมาะกับ Week Spine
- Mobile / narrow-screen layout

---

## Phase 0 — สำรวจและตรึงสัญญาข้อมูล

**สถานะ: เริ่มแล้ว**

### งาน

- ตรวจรูปแบบ activity จาก Google Calendar ที่ใช้จริง: `id`, `summary`, `start`, `end`, `colorId`, all-day, recurring event
- ระบุจุดเชื่อมต่อ handler ปัจจุบันสำหรับ create, update time, edit, delete, lock และ category/tag
- สร้าง type/utility กลางสำหรับแปลง activity เป็น timeline segment โดยไม่แก้ข้อมูลต้นฉบับ
- กำหนด timezone เดียวกันตลอด flow และทดสอบกิจกรรมที่ใกล้เที่ยงคืน

### เกณฑ์ผ่าน

- มี adapter ที่รับ activity จริงและคืนข้อมูล render ของ Week Spine
- ไม่มี component UI ต้องอ่านรูปแบบ Google Calendar โดยตรง

### สิ่งที่ทำแล้ว

- เพิ่ม `frontend/src/week-spine-data.js` เป็น adapter กลาง
- Adapter คงทั้ง normalized id สำหรับ map ภายใน และ `calendarId` จริงสำหรับ update Google Calendar
- รองรับ timed / all-day activity, category color, lock state และการแบ่ง timed activity เป็น segment รายวันสำหรับช่วงสัปดาห์
- ยังไม่เชื่อมเข้าหน้าจอจริง เพื่อไม่ให้ Phase 0 เปลี่ยนพฤติกรรมของ Activity Mode ปัจจุบัน

## Phase 1 — Timeline geometry และ Week Spine แบบอ่านอย่างเดียว

**สถานะ: เสร็จส่วนแรก (read-only)**

### งาน

- สร้าง component จริงแยกจาก mockup เช่น `activity-mode-week-spine.jsx`
- กำหนด constants: day start/end, นาทีต่อ grid, ความสูงต่อชั่วโมง และความกว้างคอลัมน์
- Render แกนเวลา, คอลัมน์ 7 วัน, block กิจกรรม, สี category/calendar และวันปัจจุบัน
- เลือกวันและแสดง detail panel จาก activity จริง
- ใช้ week navigation/cursor date ของแอปเดิม

### เกณฑ์ผ่าน

- หน้าจออ่านข้อมูลสัปดาห์จริงได้ถูกต้อง
- การเลือกวันและสลับสัปดาห์ไม่กระทบ Activity Mode เดิม

### สิ่งที่ทำแล้ว

- เพิ่ม `frontend/src/components/activity-mode-week-spine.jsx` และนำมาแสดงแทน agenda เดิมใน Activity Mode
- แสดงข้อมูลจริงจาก Google Calendar ผ่าน `week-spine-data.js` พร้อมสี category, lock state, กิจกรรมข้ามวันในระดับ render และ all-day count
- เลือกวันเพื่อดูรายการด้านล่าง, คลิกรายการเพื่อเปิด Activity Modal เดิม, และปุ่มเพิ่มกิจกรรมใช้ modal เดิม
- ใช้ `cursorDate` และปุ่มสลับสัปดาห์เดิมของแอป

### ยังไม่ทำใน Phase 1

- Snap-to-grid, drag create, drag move และ resize (Phase 2–3)
- การวาง block ซ้อนกันเป็นหลาย lane (Phase 6)

## Phase 2 — Snap-to-grid และการสร้างกิจกรรม

**สถานะ: เสร็จส่วนแรก**

### งาน

- กำหนด grid มาตรฐานเริ่มต้นเป็น 15 นาที และวาง abstraction เพื่อปรับเป็น 5/30 นาทีภายหลัง
- แปลงตำแหน่ง pointer เป็นเวลาในคอลัมน์ด้วย utility เดียว
- ลากบนพื้นที่ว่างเพื่อสร้าง draft block พร้อม preview
- Snap เวลาเริ่ม/สิ้นสุด และกำหนด duration ต่ำสุด
- ปล่อยเมาส์แล้วเปิด Activity Modal เดิม พร้อมส่ง default start/end ที่ snapped แล้ว

### เกณฑ์ผ่าน

- เวลาใน preview และเวลาใน modal ตรงกัน
- สร้างกิจกรรมที่ขอบวัน/ขอบช่วงเวลาได้โดยไม่เกินกรอบ

### สิ่งที่ทำแล้ว

- ลากบนพื้นที่ว่างของคอลัมน์วันเพื่อสร้าง draft block ได้
- Snap เวลาเริ่มและสิ้นสุดทุก 15 นาที โดยจำกัดช่วง 06:00–24:00 และ duration ขั้นต่ำ 15 นาที
- เมื่อปล่อย pointer จะเปิด Activity Modal เดิม พร้อม start/end ที่ snapped แล้ว
- เพิ่ม `defaultEnd` ให้ Activity Modal โดยไม่เปลี่ยนพฤติกรรมของปุ่มเพิ่มกิจกรรมเดิม

### ยังไม่ทำ

- Drag move / resize ของกิจกรรมเดิม (Phase 3)
- Conflict validation ระหว่างสร้างจาก Week Spine (Phase 4; Modal เดิมยังตรวจซ้อนตามกฎปัจจุบัน)

## Phase 3 — Drag move และ resize

**สถานะ: เสร็จส่วนแรก**

### งาน

- แยก drag state จาก activity data จริง: active id, operation, origin, draft range
- ลาก block เพื่อย้ายทั้งวันและเวลา พร้อม snap-to-grid
- ลากขอบล่างเพื่อ resize โดยรักษาเวลาเริ่ม
- แสดง block ที่กำลังลากใน layer บนสุด และยกเลิกได้ด้วย Escape
- เมื่อปล่อยเมาส์เรียก handler บันทึกเวลาเดิมเพียงครั้งเดียว

### เกณฑ์ผ่าน

- ไม่มี animation overlap ระหว่างลากที่ทำให้ block ดีดหรือกระตุก
- ไม่เกิด write ซ้ำระหว่าง pointer move
- Activity ที่ lock ถูกป้องกันก่อนเริ่ม drag

### สิ่งที่ทำแล้ว

- ลาก block ที่ไม่ lock เพื่อย้ายเวลาและย้ายไปคอลัมน์วันอื่นในสัปดาห์เดียวกันได้
- ลากขอบล่างของ block เพื่อ resize โดยคงเวลาเริ่มเดิม
- ทุกการเปลี่ยนแปลง snap ทุก 15 นาที, จำกัดภายใน 06:00–24:00 และมี duration ต่ำสุด 15 นาที
- ระหว่างลากจะแสดง ghost block แทน block ต้นทาง และบันทึกเวลาเพียงครั้งเดียวเมื่อปล่อย pointer ผ่าน `handleSaveTimes`
- กิจกรรมที่ lock หรือข้ามวันยังไม่เปิดให้ drag ใน Phase นี้ เพื่อรอ policy ของ Phase 5

## Phase 4 — Overlap validation และ feedback

**สถานะ: เสร็จส่วนแรก**

### งาน

- ตรวจช่วงเวลาซ้อนกับกิจกรรมในวันปลายทางก่อน commit
- ยอมให้ preview ลากผ่าน block อื่นได้ แต่ใช้ warning state ที่อ่านง่าย
- ปล่อยแล้ว: ถ้าซ้อน ให้ใช้ policy เดิมของแอป (ไม่บันทึก + แจ้งเตือน) หรือเสนอให้ผู้ใช้ยืนยันเมื่อมี policy ใหม่
- แยก conflict detection ออกจากการคำนวณตำแหน่ง render

### เกณฑ์ผ่าน

- การลากชนแบบพอดีขอบไม่ถูกนับเป็น overlap
- ข้อความเตือนระบุ activity ที่ชนและไม่ทำให้ layout กระตุก

### สิ่งที่ทำแล้ว

- Week Spine ใช้กฎ half-open interval เดียวกับ `use-activity-mutations`: เวลาชนกันจริงจึงถือว่า conflict; การแตะขอบพอดีไม่ถือว่าซ้อน
- Draft ที่กำลังสร้างหรือ ghost ที่กำลังลากจะเปลี่ยนเป็นสีแดงเมื่อชนกิจกรรมอื่น
- เมื่อปล่อย pointer ที่ conflict จะไม่เปิด modal/ไม่บันทึก และแสดงชื่อกิจกรรมที่ชน
- `handleSaveTimes` ยังคงตรวจซ้ำก่อนเขียน Google Calendar เป็น safety net

## Phase 5 — Multi-day activity

**สถานะ: เสร็จส่วนแรก**

### งาน

- สร้าง `splitActivityIntoDaySegments(activity, weekRange)` สำหรับ render เท่านั้น
- กิจกรรมที่ข้ามวันต้องมี segment ในทุกวันที่เกี่ยวข้อง พร้อม id ที่อ้างอิง activity ต้นทาง
- Drag/resize จาก segment ใดก็ต้องคำนวณกลับเป็น start/end ของ activity ต้นทางอย่างถูกต้อง
- กำหนดหน้าตา segment ต่อเนื่อง (เริ่ม / กลาง / จบ) และรองรับขอบสัปดาห์
- ทดสอบ timezone และ DST แม้ผู้ใช้หลักอยู่ Thailand เพื่อให้ข้อมูล Google Calendar ไม่เพี้ยน

### เกณฑ์ผ่าน

- ไม่เกิดกิจกรรมซ้ำใน data store
- ย้ายหรือ resize segment แล้วอัปเดตกิจกรรมเดิมเพียงรายการเดียว

### สิ่งที่ทำแล้ว

- `week-spine-data.js` แบ่ง timed activity เป็น render segment รายวัน โดยยังอ้าง `calendarId` ของ Google Calendar activity เดิมเพียงรายการเดียว
- Segment ที่ต่อเนื่องจาก/ไปยังวันอื่นมีลายและสัญลักษณ์ ←/→ เพื่อไม่ให้ดูเป็นกิจกรรมซ้ำ
- All-day activity แสดงเป็นรายการแยกเหนือ grid โดยไม่ถูกแปลงเป็น timed activity
- Activity Modal เพิ่มวันที่สิ้นสุด จึงเปิดและบันทึกกิจกรรมหลายวันได้โดยไม่ย่อระยะเวลาเหลือวันเดียว

### ข้อจำกัดที่ยังตั้งใจคงไว้

- Drag/resize ของ block ข้ามวันยังปิดไว้ เพื่อทำให้ policy การย้ายทั้งช่วงและ layout หลาย lane ชัดเจนร่วมกับ Phase 6
- การแก้ไข all-day activity ต้องมี flow แยกก่อนเปิดให้แก้จาก Week Spine เพื่อไม่ให้ Activity Modal แบบเวลาปกติแปลงชนิดข้อมูลโดยไม่ตั้งใจ

## Phase 6 — Overlap layout

**สถานะ: เสร็จส่วนแรก**

### งาน

- เพิ่ม layout algorithm แยกต่างหากสำหรับจัด lane ของ segment ที่ซ้อนกัน
- กำหนด max visible lanes และ fallback เมื่อคอลัมน์แคบ
- รักษา hit target สำหรับ drag/resize แม้ block แคบ
- แยก visual overlap จาก validation: การแสดงผลซ้อนได้ แต่ policy การบันทึกยังควบคุมโดย Phase 4

### เกณฑ์ผ่าน

- ทุก block ที่ซ้อนกันยังอ่านและเลือกได้
- การเพิ่ม layout algorithm ไม่เปลี่ยนผล conflict detection

### สิ่งที่ทำแล้ว

- Week Spine เรียก `layoutOverlaps()` จาก `timeline-layout.js` ซึ่งเป็น algorithm กลางที่ใช้กับ timeline เดิมอยู่แล้ว
- Segment ที่ซ้อนกันในวันเดียวกันจะถูกแบ่งเป็น lane ข้างกันตามจำนวนกิจกรรมในกลุ่มที่ทับกัน
- lane layout ใช้เพื่อการมองเห็นเท่านั้น ไม่ทำให้ policy การห้ามบันทึกเวลาซ้อนใน Phase 4 เปลี่ยนไป

## Phase 7 — เชื่อมฟีเจอร์ที่มีอยู่และแทนที่หน้าจอเดิม

**สถานะ: เสร็จส่วนแรก**

### งาน

- นำ lock, category, tag, context menu, right-click move day และ Activity Modal มาเชื่อมกับ Week Spine
- แสดง reminder ที่เกี่ยวข้องกับ activity ตามขอบเขตที่ตกลงไว้
- ปรับ summary/mini timeline ให้ใช้แหล่งข้อมูลเดียวกัน
- เปิด Week Spine เป็น Activity Mode หลักหลังผ่าน regression test
- เก็บ agenda เดิมไว้ชั่วคราวหลัง feature flag จนกว่าจะมั่นใจ

### เกณฑ์ผ่าน

- ฟีเจอร์สำคัญของ Activity Mode เดิมใช้งานได้จาก Week Spine
- ไม่มีข้อมูลหายหรือถูกแก้ผิดเมื่อสลับสัปดาห์/แก้กิจกรรม

### สิ่งที่ทำแล้ว

- Week Spine เป็น Activity Mode หลักแล้ว โดยยังเก็บ `activity-mode.jsx` เดิมไว้เป็น fallback source ระหว่าง migration
- คลิกขวาที่ block เพื่อเปิด `ActivityPopup` เดิม: category, lock, color, tag, duplicate, move day, delete และ recurring actions ใช้ handler เดิมทั้งหมด
- Activity Modal, weekly summary และ mini timeline ยังคงใช้ข้อมูล/handler ชุดเดิมร่วมกับ Week Spine

---

## ชุดทดสอบขั้นต่ำ

- กิจกรรมปกติ, กิจกรรมสั้นกว่า grid, และกิจกรรมยาวหลายชั่วโมง
- ลากย้ายในวันเดิม, ข้ามวัน, ชนขอบเวลา และชน activity อื่นพอดี
- Resize ให้สั้นลง/ยาวขึ้นจนถึงขอบวัน
- Activity lock
- กิจกรรมข้ามเที่ยงคืนและข้ามหลายวัน
- Recurring event
- สัปดาห์ที่มี/ไม่มี activity
- การเปิด Activity Modal และการ reload หลังบันทึก Google Calendar

## การปรับเพิ่มหลัง Phase 7

- Timeline ของ Week Spine ใช้แกนเวลาเต็มวัน 00:00–24:00
- ชื่อบน activity block ใช้ `AutoShrinkText` และย่อขนาดอักษรตามความกว้างของ lane อัตโนมัติ โดยลดได้ถึง scale `0.1` เมื่อจำเป็น

## ลำดับเริ่มต้นที่แนะนำ

เริ่มจาก Phase 0 → 1 → 2 ก่อน แล้วให้ทดสอบกับข้อมูลปฏิทินจริงหนึ่งรอบ
จึงทำ Phase 3–4 ต่อ เพราะ drag/resize โดยไม่มี timeline geometry และ conflict policy ที่ชัดเจนจะทำให้แก้บัคยากมาก
