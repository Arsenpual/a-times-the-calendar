Concept & Development Specification

**Status:** Concept / Development Reference
**Purpose:** เก็บแนวคิดหลักสำหรับพัฒนาระบบ Timeline Display และ Automatic Time Engine

---

## 1. Core Concept

T.i.M.E.S. ไม่ได้มีหน้าที่เพียงแสดงเวลา หรือแสดงรายการกิจกรรมจาก Calendar

แต่มีแนวคิดว่า:

> **“เราไม่ได้ทำให้เวลาทำงาน เราแค่ทำให้เห็นว่าเวลาทำงานอย่างไร”**

เวลาจริงทำงานอยู่แล้วตลอดเวลา
กิจกรรมใน Calendar มีเวลาเริ่มต้นและเวลาสิ้นสุดอยู่แล้ว

สิ่งที่ T.i.M.E.S. ทำคือการนำกระบวนการที่ปกติผู้ใช้มองไม่เห็น มาแสดงให้เห็นแบบ real-time ผ่าน Timeline Display

ดังนั้น Timeline Display จึงเป็น **visualization layer ของการทำงานของเวลา**

---

## 2. Calendar เป็น Source of Truth

กิจกรรมใน Calendar เป็นข้อมูลหลักของระบบ

ตัวอย่าง:

```text
Activity:
"ทำโปรเจกต์ T.i.M.E.S."

Start: 10:00
End:   12:00
```

ระบบ Timeline ไม่ควรต้องให้ผู้ใช้สร้าง Timer หรือ Stopwatch แยกอีกครั้ง

แต่ควรตรวจสอบกิจกรรมใน Calendar แล้วคำนวณสถานะจากเวลาปัจจุบันโดยอัตโนมัติ

```text
Calendar Activity
       ↓
   Time Engine
       ↓
 Current State
       ↓
 Timeline Visualization
```

---

## 3. Automatic Activity Detection

ให้ Time Engine ทำหน้าที่เหมือน “ผู้เฝ้าดูกิจกรรม” บน Timeline

ระบบจะตรวจสอบกิจกรรมที่เกี่ยวข้องกับเวลาปัจจุบันอยู่ตลอดเวลา

ตัวอย่าง:

```text
Current Time: 09:30

Next Activity:
10:00–12:00
ทำโปรเจกต์ T.i.M.E.S.
```

Time Engine ตรวจพบว่า:

```text
09:30 < 10:00
```

ดังนั้นกิจกรรมยังไม่เริ่ม

→ ใช้ **Stopwatch Visualization**

เมื่อเวลาเปลี่ยนเป็น:

```text
10:00
```

ระบบตรวจพบว่า:

```text
10:00 >= Start Time
10:00 < End Time
```

กิจกรรมเริ่มแล้ว

→ เปลี่ยนเป็น **Timer Visualization**

เมื่อถึง:

```text
12:00
```

กิจกรรมสิ้นสุด

→ Timer จบ
→ Activity เปลี่ยนเป็น Completed

---

## 4. Activity Lifecycle

กิจกรรมหนึ่งรายการสามารถมองเป็น lifecycle ได้ดังนี้:

```text
WAITING
   │
   │ Start Time reached
   ▼
RUNNING
   │
   │ End Time reached
   ▼
COMPLETED
```

### WAITING

กิจกรรมยังไม่เริ่ม

ระบบแสดงระยะเวลาที่เหลือจนกว่าจะถึงกิจกรรม

**Visualization: Stopwatch**

แนวคิด:

> “อีกนานแค่ไหนกว่าจะถึงกิจกรรมนี้?”

---

### RUNNING

กิจกรรมเริ่มแล้ว

ระบบแสดงระยะเวลาที่เหลือจนกว่ากิจกรรมจะสิ้นสุด

**Visualization: Timer**

แนวคิด:

> “กิจกรรมนี้กำลังใช้เวลาอยู่ และเหลือเวลาอีกเท่าไร?”

---

### COMPLETED

กิจกรรมสิ้นสุดแล้ว

ระบบหยุด Timer และเก็บกิจกรรมไว้เป็นข้อมูลย้อนหลัง

แนวคิด:

> “เวลาของกิจกรรมนี้ถูกใช้ไปแล้ว”

---

## 5. Stopwatch และ Timer เป็น Visualization ไม่ใช่ User Action

Timer และ Stopwatch ใน Timeline Display ไม่ควรถูกมองว่าเป็นเครื่องมือสองตัวที่ผู้ใช้ต้องกดเปิดเอง

แต่เป็น **representation ของสถานะเวลา**

### Stopwatch

ใช้เมื่อ:

```text
Current Time < Activity Start Time
```

หน้าที่คือแสดงเวลาที่กำลังเคลื่อนเข้าหากิจกรรม

Visualization:

```text
────────██████████→
```

บล็อกจะค่อย ๆ **ยืดออก**

ความหมาย:

> เวลาที่ผ่านไปกำลังเพิ่มขึ้น

---

### Timer

ใช้เมื่อ:

```text
Activity Start Time <= Current Time < Activity End Time
```

หน้าที่คือแสดงเวลาที่เหลือของกิจกรรม

Visualization:

```text
██████████░░░░░░
```

บล็อกจะค่อย ๆ **หดลง**

ความหมาย:

> เวลาที่เหลือกำลังลดลง

---

## 6. Transition Between Stopwatch and Timer

การเปลี่ยนจาก Stopwatch → Timer ต้องเกิดขึ้นโดยอัตโนมัติ

ไม่ควรมีการกดปุ่มเพื่อเปลี่ยนโหมด

ตัวอย่าง:

```text
09:59:59
    │
    │ Stopwatch
    ▼
10:00:00
    │
    │ Activity starts
    ▼
    Timer
    │
    │
    ▼
12:00:00
    │
    ▼
Completed
```

สิ่งสำคัญคือ Transition ควรรู้สึกเป็น **continuous flow ของเวลา**

ไม่ใช่เหมือนระบบหยุดตัวหนึ่งแล้วเปิดอีกตัวหนึ่งแบบแยกขาดจากกัน

---

## 7. Timeline Display Philosophy

Timeline Display ไม่ควรเป็นเพียงรายการ:

```text
10:00  Study
11:00  Meeting
12:00  Lunch
```

แต่ควรทำให้ผู้ใช้เห็นว่า:

```text
เวลา → กำลังเคลื่อนที่
กิจกรรม → กำลังรอ / กำลังดำเนินอยู่ / เสร็จแล้ว
```

ดังนั้น Timeline จึงเป็นการแสดง:

> **Time + Activity + State + Progress**

พร้อมกันในพื้นที่เดียว

---

## 8. Visual Language

ระบบควรใช้ “การเคลื่อนไหว” เป็นส่วนหนึ่งของความหมาย

ไม่ใช่ใช้สีอย่างเดียว

### Stopwatch

**Motion:** Expand / Grow

```text
████
████████
████████████
████████████████
```

หมายถึงเวลาที่ผ่านไปเพิ่มขึ้น

### Timer

**Motion:** Shrink / Decrease

```text
████████████████
████████████
████████
████
```

หมายถึงเวลาที่เหลือลดลง

### Future Event

สามารถใช้ Point / Marker:

```text
──────────●──────────
          10:00
```

### Active State

สามารถใช้ Pulse / Subtle Animation เพื่อแสดงว่า:

> “กิจกรรมนี้กำลังทำงานอยู่”

---

## 9. Design Principle

T.i.M.E.S. ควรยึดหลัก:

> **Color tells what it is.
> Motion tells what it is doing.**

สีสามารถบอกประเภทของระบบได้

แต่การยืด การหด การเคลื่อนที่ หรือ Pulse ควรเป็นตัวบอก **สถานะของเวลา**

ดังนั้นผู้ใช้ควรสามารถมอง Timeline แล้วเข้าใจได้ว่า:

* กิจกรรมยังไม่เริ่ม
* กิจกรรมกำลังจะเริ่ม
* กิจกรรมกำลังทำงาน
* กิจกรรมเหลือเวลาเท่าไร
* กิจกรรมสิ้นสุดแล้ว

โดยไม่จำเป็นต้องอ่านตัวเลขทั้งหมด

---

## 10. Future Architecture

แนวคิดนี้สามารถพัฒนาเป็น Time Engine กลางของ T.i.M.E.S.

```text
                Calendar
                   │
                   ▼
            Activity Manager
                   │
                   ▼
              Time Engine
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
     WAITING     RUNNING   COMPLETED
        │          │
        ▼          ▼
   Stopwatch      Timer
        │          │
        └────┬─────┘
             ▼
      Timeline Display
```

Time Engine ควรเป็นผู้ตัดสินสถานะ

ไม่ใช่ Timeline Display เป็นผู้คำนวณเอง

Timeline มีหน้าที่หลักคือ:

> **แสดงสิ่งที่ Time Engine บอกว่ากำลังเกิดขึ้น**

---

## 11. Important Development Rule

อย่าออกแบบ Timer และ Stopwatch เป็น feature ที่แยกจาก Calendar

ให้คิดว่า:

**Calendar = สิ่งที่ควรเกิดขึ้น**
**Time Engine = สิ่งที่กำลังเกิดขึ้นจริง**
**Timeline = สิ่งที่ทำให้มองเห็นมัน**

นี่คือ separation ที่สำคัญของระบบ

---

## 12. Long-Term Vision

เป้าหมายของแนวคิดนี้ไม่ใช่การสร้าง Timer ที่สวยขึ้น

แต่คือการทำให้:

> **“เวลาเป็นสิ่งที่มองเห็นได้”**

ในชีวิตจริง เวลาเดินอยู่ตลอดเวลา แต่เราไม่สามารถมองเห็น “การเดินของมัน” ได้โดยตรง

T.i.M.E.S. จึงพยายามสร้าง visual representation ของกระบวนการนั้น

กิจกรรมใน Calendar ไม่ได้เป็นเพียงข้อมูลในอดีตหรืออนาคต

แต่เมื่อเวลาปัจจุบันเคลื่อนผ่านมัน กิจกรรมนั้นจะค่อย ๆ เปลี่ยนสถานะต่อหน้าผู้ใช้

```text
Future
  │
  │  Stopwatch
  ▼
Activity Starts
  │
  │  Timer
  ▼
Activity Ends
  │
  │  Completed
  ▼
Past
```

### Core Statement

> **T.i.M.E.S. doesn't just display time.
> It visualizes time in action.**

หรือในภาษาไทย:

> **“เราไม่ได้ทำให้เวลาทำงาน เราแค่ทำให้เห็นว่าเวลาทำงานอย่างไร”**

---

## 13. Development Goal

ในการพัฒนาต่อ ให้รักษาแนวคิดหลักนี้ไว้เป็น constraint:

**อย่าเพิ่ม animation เพียงเพราะมันดูสวย**

ทุกการเคลื่อนไหวบน Timeline ควรตอบคำถามได้ว่า:

> **“การเคลื่อนไหวนี้กำลังบอกอะไรเกี่ยวกับเวลา?”**

หากตอบไม่ได้ ควรพิจารณาว่าการแสดงผลนั้นจำเป็นหรือไม่

เป้าหมายสูงสุดคือทำให้ Timeline Display เป็นพื้นที่ที่ผู้ใช้สามารถ “มองเห็นเวลาในขณะที่มันกำลังทำงาน” ได้จริง
