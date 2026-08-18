# Frontend Documentation (`frontend.md`)

> เอกสารนี้อธิบายฝั่ง Frontend ของ TIMES THE CALENDAR ตามสภาพโค้ดจริง ณ ปัจจุบัน (ไม่ใช่แผนหรือ spec) — ปรับปรุงล่าสุดหลังเพิ่มระบบแนะนำการเข้าสู่ระบบ 3 ขั้นตอน (`LOGIN_GUIDE_STEPS`), แก้บั๊ก tag search ค้างข้อมูลเก่าและ duplicate-activity id ไม่ normalize, และกำหนดทิศทาง deploy ที่ชัดเจนแล้ว (ดูหัวข้อ 9)

---

## 1. ภาพรวมระบบ & Technology Stack

**ภาพรวมระบบ**: ปฏิทินกิจกรรม (Times / Calendar Application) ที่ sync สองทางกับ Google Calendar โดยตรง เสริมด้วยชั้นข้อมูลของแอปเอง (หมวดหมู่ชีวิต/life-area category, tag, การล็อกกิจกรรม, สรุปรายสัปดาห์) ที่เก็บแยกไว้ใน backend ของเราเอง (Firestore — ดู `structure.md`/`backend.md`)

**Technology Stack**:
- **React** (function components + hooks ล้วน — ไม่มี class component หรือ Context API ในโปรเจกต์นี้ ต่างจากที่เอกสารฉบับก่อนระบุไว้ผิด)
- **State management**: local `useState`/`useCallback`/`useMemo`/`useRef` ทั้งหมดอยู่ใน `App` (`app.jsx`) เป็น single source of truth แล้วส่งลงเป็น props — ไม่มี global state library หรือ Context
- **Auth**: Firebase Authentication (Google provider, popup flow) — ดูเหตุผลที่เลือก popup แทน redirect ในหัวข้อ 6
- **Build tool**: Vite (`vite.config.js`, `main.jsx` เป็น entry point)
- **Backend sync**: REST ไปยัง backend ของเราเอง (`api.js`) สำหรับหมวดหมู่/tag/lock/summary + เรียก Google Calendar API ตรงๆ (`google-calendar.js`) สำหรับตัวกิจกรรมเอง

---

## 2. Directory & Component Structure

โครงสร้างจริงของ `frontend/src/` (ดู `structure.md` สำหรับภาพรวมทั้งโปรเจกต์):

```text
frontend/src/
├── components/
│   ├── activity-modal.jsx          # ฟอร์มหลัก สร้าง/แก้ไขกิจกรรม (รวม repeat rule, tag, category, สี)
│   ├── activity-popup.jsx          # เมนูคลิกขวา/quick actions บนแท่งกิจกรรมใน TimelineEditor
│   ├── agenda-view.jsx             # รายการ 7 วันของสัปดาห์ที่กำลังดู — หน้าจอหลัก
│   ├── announcement-ticker.jsx     # แถบข้อความประกาศเลื่อนขวา→ซ้าย ใต้ header (โหมด dashboard เท่านั้น)
│   ├── auto-shrink-text.jsx        # ย่อ font-size อัตโนมัติให้ข้อความยาวพอดีกล่อง แทนการตัดด้วย "..."
│   ├── mini-timeline-panel.jsx     # timeline อ่านอย่างเดียวของ 1 วัน (ฝั่งซ้ายของ AgendaView)
│   ├── reminder-mode-mockup.jsx    # หน้าตาโหมด Reminder — เป็น mockup ล้วนๆ ยังไม่มี logic จริง
│   ├── settings-drawer.jsx         # แผงตั้งค่าเลื่อนจากขวา (ตอนนี้มีแค่สลับ Dark Mode)
│   ├── tag-search-results.jsx      # ผลค้นหากิจกรรมด้วย tag ข้ามสัปดาห์/เดือน
│   ├── timeline-editor.jsx         # กริดลาก/ขยายเวลากิจกรรมแบบ interactive (โหมดแก้ไขของ AgendaView แต่ละแถว)
│   └── weekly-summary-panel.jsx    # กราฟวงกลม + สรุปสถิติของสัปดาห์ (ฝั่งซ้ายของ AgendaView เมื่อไม่ได้เปิด mini timeline)
│
├── activity-colors.js              # แปลง Google colorId ↔ สี, ตัดสินสีที่จะแสดงจริง (category ชนะ colorId เสมอ)
├── api.js                          # เรียก backend ของเราเอง (category/tag/lock/summary) — แนบ Firebase ID token ให้อัตโนมัติ
├── App.jsx                         # Root component — ถือ state ทั้งหมด, ต่อกับ Google Calendar + backend, ประกอบหน้าจอ
├── date-utils.js                   # แปลง/จัดรูปแบบวันที่ทั้งหมด (ปฏิทินไทย พ.ศ., week range, month grid ฯลฯ)
├── export-day-image.js             # ดาวน์โหลดภาพ timeline ของวันนั้นเป็นไฟล์รูป (ปุ่ม 📷 ใน TimelineEditor)
├── firebase-config.js              # Firebase app initialization (ค่า config เชื่อม Firebase project)
├── google-calendar.js              # OAuth (Firebase Auth + Google Calendar scope) + Calendar API v3 CRUD
├── id-utils.js                     # normalizeActivityId — ตัด suffix ของ recurring instance id
├── index.css                       # สไตล์ชีตเดียวรวมทั้งแอป (ไม่มี CSS module/styled-components)
├── main.jsx                        # Entry point — mount <App /> ด้วย ReactDOM
├── rrule-utils.js                  # แปลง RepeatState (state ของฟอร์ม) ↔ RRULE string (Google Calendar)
└── timeline-layout.js              # คำนวณตำแหน่ง/overlap ของแท่งกิจกรรมบนกริด 24 ชม. — ใช้ร่วมกันทั้ง TimelineEditor และ MiniTimelinePanel
```

**หมายเหตุจากเอกสารฉบับก่อน**: รายชื่อไฟล์เดิมมีแค่ 5 component และไม่มี utility files เลย ทั้งที่ระบบมี component 10 ตัวและ utility module 8 ตัวที่ share logic กันข้าม component (ดูหัวข้อ 4)

---

## 3. Deep Dive Component Analysis

### 3.1 `app.jsx` (Root — ไม่ได้อยู่ในเอกสารฉบับก่อน)

ถือ state ทั้งหมดของแอปเป็นก้อนเดียว ไม่มีการแตก Context หรือ reducer — ส่วนสำคัญ:

- **Auth state สองชั้นแยกกัน** (Phase 2 ของการย้ายไป Firebase Auth):
  - `firebaseUser` — session ของ Firebase เอง เป็น source of truth ว่า "login อยู่ไหม", คง persist ข้าม reload เอง (IndexedDB), `api.js` ดึง ID token สดจาก `auth.currentUser` เองทุกครั้งไม่ผ่าน state
  - `calendarAccessToken` — token ของ Google Calendar โดยเฉพาะ **ไม่ auto-refresh** (ต่างจาก Firebase ID token) ต้องขอใหม่ผ่าน popup ทุกครั้งที่หมดอายุ (~1 ชม.) ดูหัวข้อ 6
- **`mode`**: `"dashboard"` (ปฏิทินจริง) หรือ `"reminder"` (mockup ล้วนๆ) — สลับได้ไม่ว่าจะ login อยู่หรือไม่
- **`activities`**: กิจกรรมของสัปดาห์ที่กำลังดู (`cursorDate`) ดึงจาก Google Calendar โดยตรง — ช่วงที่ fetch จริงกว้างกว่าที่แสดงผล 1 วัน (เริ่มก่อนต้นสัปดาห์ 1 วัน) เพื่อให้กิจกรรมที่เริ่มคืนก่อนหน้าแต่ค้างมาถึงเช้าวันแรกของสัปดาห์ ใช้แสดง spillover indicator ได้ (ดูหัวข้อ 3.3)
- **`categories` / `activityCategoryMap` / `activityTagMap` / `lockedActivities`**: ข้อมูลชั้นของแอปเอง โหลดจาก backend (`api.js`) แยกจาก `activities` —ผูกกับกิจกรรมด้วย **normalized activity id** เสมอ (ดูหัวข้อ 4.3)
- **`summary`**: สรุปสถิติรายสัปดาห์ คำนวณที่ backend, ส่ง payload กิจกรรมของสัปดาห์ปัจจุบันไปให้คำนวณใหม่ทุกครั้งที่ `activities`/`activityCategoryMap` เปลี่ยน
- **Modal state**: `modalOpen` / `modalDefaultDate` / `modalEditingActivity` / `modalEditingAsSeries` — ควบคุม `ActivityModal` ทั้งโหมดสร้างใหม่และแก้ไข (รวมถึงแก้ทั้งชุด recurring)
- **`ANNOUNCEMENT_MESSAGE`**: ข้อความ hardcode สำหรับ `AnnouncementTicker` (ดูหัวข้อ 3.9) — แก้ข้อความต้อง redeploy เท่านั้น ไม่มี backend endpoint
- **`LOGIN_GUIDE_STEPS` + `showLoginGuide`**: overlay 3 ขั้นตอนที่แสดงทับหน้า login เพื่อสอนผู้ใช้ผ่านหน้าจอเตือน "แอปยังไม่ได้ยืนยัน" ของ Google (เพราะแอปยังไม่ผ่าน Google App Verification) — รูปประกอบแต่ละ step **ต้อง `import` เป็นโมดูลจากไฟล์ `.jpg` ใน `public/` เสมอ** (ไม่ใช่ hardcode string path แบบ `"/xxx.jpg"` ตรงๆ) เพราะ GitHub Pages เสิร์ฟจาก subpath ไม่ใช่ root domain — ดูหัวข้อ 9.1 สำหรับเหตุผลแบบเต็ม `showLoginGuide` เริ่มที่ `true` เสมอและปิดแล้วหายแค่ในเซสชันนั้น (ไม่บันทึกด้วย localStorage) เพราะสถานะ verification ของ Google อาจเปลี่ยนได้ทุกเมื่อ

**Handler ที่สำคัญ** (ทั้งหมดอยู่ใน `app.jsx`, ส่งลงเป็น props):
| Handler | หน้าที่ |
|---|---|
| `loadActivities` | ดึงกิจกรรมของสัปดาห์ปัจจุบันจาก Google Calendar |
| `handleSaveTimes` | บันทึกการลาก/ขยายเวลาแบบ batch จาก `TimelineEditor` (ดูหัวข้อ 3.3) |
| `handleDeleteActivity` / `handleDeleteSeries` | ลบกิจกรรมเดี่ยว / ลบทั้งชุด recurring |
| `handleEditSeries` / `handleFetchSeriesCount` | โหลด master event ของชุด recurring มาแก้ / นับจำนวน instance |
| `handleDuplicateActivity` | ทำสำเนากิจกรรม พร้อมเติม `(copy)` / `(copy 2)` ต่อท้ายชื่ออัตโนมัติ (ดูหัวข้อ 4.4) |
| `openAddActivity` / `openEditActivity` | เปิด `ActivityModal` พร้อม default date หรือกิจกรรมที่จะแก้ |

### 3.2 `agenda-view.jsx` (หน้าจอหลัก — ไม่ได้อยู่ในเอกสารฉบับก่อน)

แสดงกิจกรรมของสัปดาห์เป็น 7 แถว (1 แถว/วัน) — เป็นจุดที่คนใช้งานเห็นเป็นอันดับแรกเสมอ

- แต่ละแถวมี **แถบสัดส่วนสี** (`agenda-day-bar`) แสดงว่าเวลาทั้งวันแบ่งไปตามหมวดหมู่ไหนบ้าง (ไม่ใช่รายชื่อกิจกรรม) คำนวณจาก `buildDayBreakdown` ในไฟล์นี้เอง
- กดปุ่ม ⚙ ของแถวไหน จะสลับเป็นโหมดแก้ไข (render `TimelineEditor` inline แทนแถบสัดส่วน) — มี `editingDay` state แยกจาก `expandedDate` (ซึ่งควบคุม mini-timeline ฝั่งซ้ายแทน) จึงเปิดพร้อมกันได้ทั้งสองอย่างคนละกลไก
- ปุ่ม `+ เพิ่มกิจกรรม` ส่ง `day` ของแถวนั้นตรงๆ ไปยัง `onAddActivity` — **สำคัญ**: `app.jsx`'s `ActivityModal` ต้องมี `key` ที่ผูกกับวันที่ (ไม่ใช่แค่ `"new"` คงที่) มิฉะนั้น React จะไม่ remount modal เมื่อกดปุ่มของวันอื่น ทำให้ `useState` ค้างวันที่เดิมจากการเปิดครั้งก่อน (แก้ไปแล้ว — ดูหัวข้อ 7)

### 3.3 `timeline-editor.jsx` (Interactive Drag Grid)

กริด 24 ชั่วโมงแบบลาก/ขยายกิจกรรมได้ตรงๆ ด้วยเมาส์/นิ้ว — เปิดจากปุ่ม ⚙ ในแต่ละแถวของ `AgendaView`

- **Drag/resize**: ลากทั้งแท่ง (`move`), ลากขอบบน/ล่างเพื่อขยาย (`resize-start`/`resize-end`) — คำนวณ delta จากตำแหน่งเมาส์เทียบกับ grid, snap เข้าทุก 15 นาที (`SNAP_MINUTES`) การลาก **ไม่ยิง network ทันที** — เก็บเป็น `draftTimes` ไว้ก่อน แล้วส่ง batch เดียวตอนกด "บันทึก" (`onSaveTimes` → `handleSaveTimes` ใน `app.jsx`)
- **Duration cap ระหว่างลาก**: จำกัดไม่เกิน 12 ชม./ครั้ง (`MAX_DURATION_MINUTES`) กันการลากพลาดจนกลายเป็นกิจกรรมข้ามหลายวัน
- **กิจกรรมข้ามเที่ยงคืน** (เช่น 20:00–02:00): แท่งหลักตัดภาพที่ 24:00 พอดี แล้วมี "หาง" จางๆ (opacity ต่ำ) ยื่นออกไปด้านล่างแสดงว่ายังไม่จบ ส่วนวันถัดไปจะมีแท่งจางๆ ที่ต้นกริดแสดงว่ามีกิจกรรมค้างจากเมื่อคืน (`getOutgoingSpillover`/`getIncomingSpillover` ใน `timeline-layout.js`) — คลิกเปิดแก้ไขได้ แต่ลาก/ขยายไม่ได้ และ **ไม่นับ** เป็นกิจกรรมของวันนั้นในสัดส่วนสี/จำนวน
- **Overlap layout**: กิจกรรมที่เวลาทับซ้อนกันจัดเรียงซ้าย→ขวา โดย**กิจกรรมที่ใช้เวลานานกว่าอยู่ขวา** (`layoutOverlaps` ใน `timeline-layout.js`) รวม spillover block เข้าไปในระบบ column เดียวกันด้วย
- **ป้ายชื่อกิจกรรมยาว**: ใช้ `AutoShrinkText` ย่อ font-size อัตโนมัติแทนการตัดด้วย `...`
- Context menu (คลิกขวา) เปิด `ActivityPopup` สำหรับ quick actions
- ปุ่ม 📷 export ภาพ timeline ของวันนั้น (`export-day-image.js`)

### 3.4 `mini-timeline-panel.jsx`

Timeline อ่านอย่างเดียวของ 1 วัน แสดงเป็น "หน้าหลัง" ของการ์ด flip ร่วมกับ `WeeklySummaryPanel` (สลับกันตาม `expandedDate` ใน `app.jsx`) — เลือกวันได้จาก `AgendaView` เท่านั้น ตัวมันเองไม่มี day picker

- มีแถวจางๆ ที่หัวลิสต์เช่นกันสำหรับกิจกรรมที่ค้างมาจากเมื่อคืน (คลิกเปิดแก้ไขได้) แบบเดียวกับ `TimelineEditor`
- ใช้ `AutoShrinkText` เช่นกันสำหรับชื่อกิจกรรมยาว

### 3.5 `weekly-summary-panel.jsx`

กราฟวงกลม (SVG stroke-based, ไม่ใช้ chart library) แสดงสัดส่วนเวลาต่อหมวดหมู่ของสัปดาห์ที่กำลังดู, insight ข้อความจาก backend, และปุ่มลัดไปยัง "วันที่ยุ่งที่สุด"

- **สีของกราฟใช้ `categories` (state สดของแอป) เสมอ ไม่ใช่สีที่ backend ส่งมาใน `summary` payload** — เพราะถ้าผู้ใช้เปลี่ยนสีหมวดหมู่หลังจากโหลด summary ไปแล้ว โดยไม่ trigger refetch summary ทันที กราฟกับ legend ทั่วทั้งแอปจะยังต้องตรงกัน (`resolveCategoryColor` ในไฟล์นี้)

### 3.6 `tag-search-results.jsx`

ผลค้นหากิจกรรมด้วย tag ข้ามสัปดาห์/เดือน (ไม่ผูกกับ `anchorDate` เดียวแบบ `AgendaView`) — จัดกลุ่มตามวันที่ แสดงเป็น list พร้อมหัวข้อวันคั่น คลิกกิจกรรมเปิด `ActivityModal` แก้ไขได้ผ่าน `onEditActivity` เดียวกับที่ `AgendaView` ใช้

### 3.7 `activity-modal.jsx` (ฟอร์มหลัก)

Modal สร้าง/แก้ไขกิจกรรม ครอบคลุมมากกว่าที่เอกสารฉบับก่อนระบุไว้มาก:

- **ฟิลด์พื้นฐาน**: ชื่อ, วันที่, เวลาเริ่ม/จบ (`<input type="date/time">` ธรรมดา ไม่ใช่ custom picker)
- **กิจกรรมข้ามเที่ยงคืน**: ถ้า end time "ดูน้อยกว่า" start time เมื่อเทียบแค่ช่วงเวลาในวันเดียวกัน ระบบตีความเป็นกิจกรรมข้ามคืนแล้วเลื่อน end ไปวันถัดไปให้อัตโนมัติ แทนที่จะ block การบันทึก
- **หมวดหมู่ (category)**: custom dropdown (ไม่ใช่ native `<select>` เพราะต้องมีปุ่มลบต่อท้ายแต่ละแถว) สร้างหมวดหมู่ใหม่ได้ inline พร้อมเลือกสีจาก 15 เฉดที่กำหนดไว้
- **Tag**: free-text แบบ chip input พิมพ์แล้ว Enter/comma เพื่อเพิ่ม, กันซ้ำ (case-insensitive), จำกัดสูงสุด 20 tag ต่อกิจกรรม ยาวไม่เกิน 40 ตัวอักษร/tag
- **สีกิจกรรมแบบเลือกเอง** (Google event `colorId`): เลือกได้เมื่อไม่มี category ผูกอยู่เท่านั้น เพราะสีของ category ชนะเสมอในการแสดงผล (ดูหัวข้อ 4.2)
- **Repeat rule (RRULE)**: สร้าง/แก้ได้เฉพาะกิจกรรมใหม่ หรือกิจกรรมเดิมที่ recurrence เป็นรูปแบบง่ายที่ round-trip ได้เต็ม (`isRuleEditable`) — ถ้า recurrence ซับซ้อนเกินกว่า UI นี้จะรองรับ (เช่น มี EXDATE) จะซ่อนส่วนนี้ไปเลยแทนที่จะเสี่ยงบันทึกทับผิด ปิดฟีเจอร์ "ไม่มีวันสิ้นสุด" ไว้ก่อน (บังคับ fallback เป็น "หลังจาก N ครั้ง" สูงสุด 20 ครั้ง)
- **โน้ต**: textarea แบบ collapsible ผูกกับ Google event `description`

### 3.8 `activity-popup.jsx` (Quick Actions)

เมนูคลิกขวาบนแท่งกิจกรรมใน `TimelineEditor` — ไม่ใช่แค่ "ดูรายละเอียดย่อ" อย่างที่เอกสารฉบับก่อนระบุ แต่เป็นเมนู action เต็มรูปแบบ:

- **Quick actions แถวบน**: ทำสำเนา, ย้ายวัน (เลือกเอง หรือปุ่มลัด "วันถัดไป"), เปิดใน Google Calendar, ล็อก/ปลดล็อก, ลบ
- **Recurring event flow**: กด "แก้ไข" หรือ "ลบ" บนกิจกรรมที่เป็นส่วนหนึ่งของชุด recurring จะถามก่อนเสมอว่า "แค่ครั้งนี้" หรือ "ทั้งชุด" พร้อมดึงจำนวน instance มาเตือนถ้าเกิน 20 ครั้ง (ยังกดยืนยันต่อได้)
- **เปลี่ยนหมวดหมู่/สีกิจกรรม**: ทำได้ตรงในนี้เลยไม่ต้องเปิด modal เต็ม

### 3.9 `announcement-ticker.jsx` (ใหม่ — ไม่ได้อยู่ในเอกสารฉบับก่อน)

แถบข้อความประกาศ เลื่อนขวา→ซ้าย ใต้ header ในโหมด dashboard เท่านั้น สำหรับสื่อสารกับผู้ใช้ตรงๆ (เช่น ประกาศอัปเดตเวอร์ชัน)

- ข้อความ **hardcode** ใน `app.jsx` (`ANNOUNCEMENT_MESSAGE`) ไม่ได้ดึงจาก backend — เปลี่ยนข้อความต้อง redeploy
- แสดง**ครบ 1 รอบแล้วหายไป 5 นาที** ก่อนขึ้นใหม่ (ไม่ใช่วิ่งวนตลอด) เริ่มโชว์ทันทีตอนโหลดหน้า/รีเฟรช
- ความเร็วเลื่อนคงที่ (`SCROLL_SPEED_PX_PER_SEC`) โดยวัดความกว้างข้อความ+container จริงจาก DOM (`useLayoutEffect`) มาคำนวณ duration ของ animation แทนการตั้งเวลาคงที่ ทำให้ข้อความสั้น/ยาวเลื่อนด้วยความเร็วที่รู้สึกเท่ากันเสมอ
- ไม่มีปุ่มปิด รองรับ `prefers-reduced-motion`

### 3.10 `auto-shrink-text.jsx` (ใหม่ — ไม่ได้อยู่ในเอกสารฉบับก่อน)

Component ใช้ร่วมกันสำหรับป้ายชื่อกิจกรรมที่อาจยาวเกินพื้นที่ (`mini-timeline-panel.jsx`, `timeline-editor.jsx`) — วัดความกว้างจริงแล้วลด font-size ทีละขั้น (ผ่าน CSS custom property) จนพอดี แทนการตัดด้วย `text-overflow: ellipsis` เพียงอย่างเดียว เพื่อให้อ่านชื่อกิจกรรมได้ครบเสมอ

### 3.11 `reminder-mode-mockup.jsx`

หน้าตาโหมด "Reminder" (นาฬิกาจับเวลา/Pomodoro) — **เป็น mockup ล้วนๆ ไม่มี state หรือ logic เบื้องหลังจริงเลย** ปุ่มและสวิตช์ทุกอันไม่มีผล มี banner เตือนผู้ใช้ไว้ในตัว component เอง รอ Cloud Messaging/Pomodoro ตัวจริงตามแผนระยะ 4 ใน `firebase-migration-plan.md`

### 3.12 `settings-drawer.jsx` (ใหม่ — ไม่ได้อยู่ในเอกสารฉบับก่อน)

Drawer เลื่อนจากขวา เปิดจากไอคอน ⚙️ ใน header — ใช้ overlay pattern เดียวกับ `ActivityModal` (`.modal-overlay`) ไม่ได้สร้าง routing/หน้าตั้งค่าแยกต่างหาก

- ตอนนี้มีแค่ setting เดียว: **Dark Mode** toggle — `theme` state อยู่ใน `app.jsx` (persist ผ่าน `localStorage`, key `"theme"`) ค่าเริ่มต้นอ่านจาก `prefers-color-scheme` ถ้ายังไม่เคยตั้งค่าเอง แล้ว apply เป็น `data-theme` attribute บน `<html>` เพื่อให้ `index.css` คุมสีทั้งแอปผ่าน CSS custom properties (`--bg`, `--text-primary` ฯลฯ — ดูหัวข้อ 4.2 สำหรับตัวอย่างการใช้ตัวแปรเหล่านี้)
- โครงสร้างเป็น section ๆ (ไม่ใช่ flat list ของ toggle) เพื่อรองรับ setting เพิ่มในอนาคตโดยไม่ต้อง restructure
- ปิดได้ด้วย Escape หรือคลิกนอกกรอบ เหมือน `ActivityModal`

---

## 4. Cross-Component Utilities (ไม่ได้อยู่ในเอกสารฉบับก่อนเลย — สำคัญมากเพราะ share logic ข้าม component)

เอกสารฉบับก่อนกล่าวถึงแค่ component แต่ระบบพึ่งพา utility module 8 ตัวที่ share behavior ข้าม component เป็นจำนวนมาก การแก้ logic เหล่านี้ในที่เดียวกระทบหลาย component พร้อมกันเสมอ:

### 4.1 `timeline-layout.js`
คำนวณตำแหน่ง/overlap ของแท่งกิจกรรมบนกริด 24 ชม. — ใช้ร่วมกันทั้ง `timeline-editor.jsx` และ `mini-timeline-panel.jsx` (รวมเข้าไว้ที่เดียวเพื่อกันปัญหา logic เพี้ยนถ้าแยก copy-paste กันคนละไฟล์)
- `minutesOfDay(date)` — นาทีนับจากเที่ยงคืน **wrap ที่ 1440 เสมอ** (ใช้กับเวลา start)
- `minutesFromDayStart(date, day)` — นาทีนับจากเที่ยงคืนของวันอ้างอิง **ไม่ wrap** (จำเป็นสำหรับกิจกรรมที่ end ข้ามวัน — ถ้าใช้ `minutesOfDay` แทนจะได้ค่าที่น้อยกว่า start ทำให้คำนวณ overlap/ความสูงผิดพลาด)
- `layoutOverlaps(entries)` — จัดกลุ่มกิจกรรมที่เวลาทับกันเป็น cluster แล้วเรียง column: **สั้นสุดซ้าย, ยาวสุดขวา**
- `getOutgoingSpillover` / `getIncomingSpillover` — ตรวจกิจกรรมที่ข้ามเที่ยงคืน สำหรับ spillover indicator (ดูหัวข้อ 3.3)

### 4.2 `activity-colors.js`
ตัดสินสีที่จะแสดงจริงของกิจกรรม (`getDisplayColor`) — **หมวดหมู่ (category) ชนะสี Google Calendar (colorId) เสมอ** ถ้าไม่มี category ผูกอยู่ ใช้สีเทากลาง (`UNCATEGORIZED_COLOR`) ซึ่งต้องตรงกับสีที่ backend ใช้ในกราฟวงกลม (`summary.js`) ด้วย ไม่ fallback ไปใช้ colorId ของ Google เพราะกราฟสรุปไม่มีแนวคิดเรื่อง colorId เลย จะทำให้สีไม่ตรงกันระหว่างหน้าจอ

### 4.3 `id-utils.js`
`normalizeActivityId(id)` — ตัด suffix ของ recurring instance id (`<baseId>_<YYYYMMDDTHHmmssZ>` ที่ Google Calendar เติมให้เมื่อขยาย series ด้วย `singleEvents=true`) ทุกที่ที่ผูกข้อมูลกับกิจกรรม (`activityCategoryMap`, `activityTagMap`, `lockedActivities` ทั้งฝั่ง frontend/backend) ต้อง normalize ก่อน lookup/write เสมอ มิฉะนั้นกิจกรรมที่ทำซ้ำจะหาหมวดหมู่/tag/lock ไม่เจอ

### 4.4 `date-utils.js`
รวมการแปลง/จัดรูปแบบวันที่ทั้งหมด — ปฏิทินไทย (พ.ศ.) เป็นค่าเริ่มต้นของทุกฟังก์ชันแสดงผล, week range (Sunday-start), month grid (6 สัปดาห์แบบ Google Calendar), และการแปลง `<input>` value ↔ Date

### 4.5 `rrule-utils.js`
แปลง `RepeatState` (state ภายในของฟอร์ม) ↔ RRULE string ที่ Google Calendar ต้องการ — รองรับแค่ subset (`FREQ`, `INTERVAL`, `BYDAY`, `COUNT`, `UNTIL`) Google เป็น source of truth เรื่องการขยาย occurrence จริง แอปไม่เก็บ/คำนวณเองเลย

### 4.6 `google-calendar.js`
Auth (Firebase Auth + Google Calendar OAuth scope) + Calendar API v3 CRUD ตรงๆ — ดูหัวข้อ 6 สำหรับรายละเอียด auth flow

### 4.7 `api.js`
เรียก backend ของเราเอง (Firestore-backed) สำหรับข้อมูลที่ไม่ใช่ตัวกิจกรรมเอง: category CRUD, activity↔category mapping, activity↔tag mapping, lock state, weekly summary — แนบ Firebase ID token ให้อัตโนมัติทุก request (ดึงสดจาก `auth.currentUser`)

### 4.8 `export-day-image.js`
สร้างและดาวน์โหลดภาพ timeline ของวันหนึ่งๆ เป็นไฟล์รูป — ใช้จากปุ่ม 📷 ใน `TimelineEditor`

---

## 5. Data Flow & Backend Integration

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   ผู้ใช้      │────▶│  Component ต่างๆ   │────▶│   app.jsx (state)   │
│ (คลิก/ลาก/พิมพ์) │     │ (Modal/Timeline/  │     │                     │
└─────────────┘     │  Popup/Agenda)    │     └──────────┬──────────┘
                     └──────────────────┘                │
                                          ┌───────────────┴───────────────┐
                                          ▼                               ▼
                              ┌─────────────────────┐        ┌─────────────────────┐
                              │  google-calendar.js  │        │       api.js         │
                              │  (Google Calendar    │        │  (backend ของเราเอง,   │
                              │   API v3 ตรงๆ)        │        │   Firestore-backed)   │
                              └──────────┬───────────┘        └──────────┬───────────┘
                                         ▼                               ▼
                              ตัวกิจกรรมจริง                 category / tag / lock /
                              (summary, start, end,          summary (ผูกกับ activity id
                              recurrence, colorId ฯลฯ)        ที่ normalize แล้วเสมอ)
```

**สองเส้นทางข้อมูลแยกกันชัดเจน**:
1. **ตัวกิจกรรมเอง** (ชื่อ, เวลา, การทำซ้ำ, สี Google) → เขียน/อ่านตรงกับ Google Calendar API เสมอ ผ่าน `google-calendar.js` — แอปไม่เก็บสำเนาถาวรของตัวเองเลย `activities` state เป็นแค่ cache ของสิ่งที่ fetch มาแสดงผล
2. **ชั้นข้อมูลเสริมของแอป** (category, tag, lock, สรุปสถิติ) → เก็บที่ backend ของเราเอง (`api.js`) ผูกกับกิจกรรมด้วย **normalized activity id** เท่านั้น (ดูหัวข้อ 4.3) — เพราะ Google Calendar เองไม่มีที่เก็บ metadata แบบนี้ให้

**ผลของการแยกสองเส้นทาง**: การกระทำหลายอย่าง (เช่น ลบกิจกรรม, ลบทั้งชุด recurring) ต้องยิง 2 ฝั่งเสมอ — ลบที่ Google Calendar ก่อน แล้วเคลียร์ entry ที่เกี่ยวข้องใน `activityCategoryMap`/`activityTagMap` ที่ backend ตามหลัง (ดู `handleDeleteActivity`/`handleDeleteSeries` ใน `app.jsx`) ความล้มเหลวของฝั่ง backend cleanup ถือเป็น non-fatal (กิจกรรมที่ Google Calendar หายไปแล้วเป็นเรื่องจริงที่สุด)

**State hydration**: เปลี่ยน `activities`/`activityCategoryMap` → trigger effect คำนวณ `summary` ใหม่อัตโนมัติ (`useEffect` ใน `app.jsx`) ทำให้ `WeeklySummaryPanel` อัปเดตทันทีโดยไม่ต้อง manual refetch

---

## 6. Authentication Flow

**Phase 2**: ใช้ Firebase Authentication SDK (`signInWithPopup` + `GoogleAuthProvider`) แทนของเดิม (Google Identity Services `initTokenClient`) — popup เดียวได้ทั้ง:
- Firebase user + ID token (ส่งให้ backend เราเองผ่าน `api.js` เพื่อยืนยันตัวตน)
- Google OAuth access token ที่มี Calendar scope (`https://www.googleapis.com/auth/calendar` — full read/write ไม่ใช่แค่ readonly) ใช้ยิง Google Calendar API ตรงๆ

**ทำไมใช้ popup ไม่ใช่ redirect**: ลองแล้วทั้งสองแบบ — `signInWithRedirect` ตัด console warning เรื่อง COOP ออกได้ แต่พังสนิทบน `localhost` เพราะผลลัพธ์ redirect ต้อง round-trip ผ่าน `*.firebaseapp.com` (คนละ origin จาก `localhost:5173`) ซึ่งโดน third-party storage partitioning ของ Chrome บล็อกการส่งต่อผ่าน IndexedDB — ไม่ใช่ปัญหาที่แก้จาก config ฝั่งแอปได้ จึงกลับมาใช้ popup (มี warning เรื่อง COOP ที่ไม่กระทบการทำงานจริง แต่ login สำเร็จเสมอ)

**Token สองตัวมีวงจรชีวิตต่างกัน**:
| | Firebase ID token | Google Calendar access token |
|---|---|---|
| Auto-refresh | ✅ (Firebase SDK จัดการเอง) | ❌ |
| อายุ | ยาว, ต่ออายุเงียบๆ | ~1 ชม. |
| หมดอายุแล้วทำยังไง | ไม่มีผลกับผู้ใช้ | ต้องเปิด popup ใหม่ (`reauthenticateWithGooglePopup`) — `app.jsx` ดัก 401 จาก Google Calendar API แล้วเสนอปุ่ม reauth แทนการบังคับ sign-out เต็มรูปแบบ |

---

## 7. UI States & Handling

- **Loading**: แต่ละส่วนมี loading state แยกกัน ไม่ block ทั้งหน้าจอ — `loading` (กิจกรรมของสัปดาห์), `summaryLoading`, `tagSearchLoading`, `categorySaving` (ในฟอร์ม), `busyAction` (ใน `ActivityPopup`, per-action ไม่ block ปุ่มอื่น)
- **Empty states**: "ไม่มีกิจกรรม" ในแต่ละแถวของ `AgendaView`, "ไม่พบกิจกรรมที่มี tag ตรงกับ..." ใน `TagSearchResults`
- **Error handling**: ไม่มี toast library — error แสดงเป็นข้อความ inline ใกล้จุดที่เกิด (`formError` ใน modal, `actionError` ใน popup, `error`/`summaryError`/`tagSearchError` ระดับหน้าจอใน `app.jsx`) ข้อความ error ส่วนใหญ่เป็นภาษาไทยตรงจากจุดที่โยน โดยเฉพาะเคส "token หมดอายุ" ที่ต้องแยกแยะว่าเป็น Firebase session หรือ Google Calendar token คนละแบบ (ดูหัวข้อ 6) เพื่อไม่บังคับ sign-out ทั้งระบบเวลาที่จริงแค่ Calendar token หมดอายุ
- **Conflict detection**: การบันทึกที่กระทบกิจกรรมเดิม (`handleSaveTimes`) เช็คว่ากิจกรรมถูกแก้ที่อื่นหลังโหลดมาหรือไม่ (`checkConflict`) — ถ้าใช่ **ยังบันทึกทับตามปกติ** แล้วค่อยแจ้งเตือนรวมทีเดียวหลังบันทึกเสร็จ ไม่ block การบันทึกด้วย confirm dialog

---

## 8. Known Limitations / จุดที่ควรระวังเมื่อแก้โค้ดต่อ

- **`activities` เป็น cache ของสัปดาห์ที่กำลังดูเท่านั้น** (บวก 1 วันก่อนหน้าเพื่อ spillover) — ฟีเจอร์ใดที่ต้องการเห็นกิจกรรมข้ามสัปดาห์ (เช่น การนับเลข `(copy 2)` ตอน duplicate, หรือ tag search) ต้อง fetch ช่วงกว้างแยกต่างหาก (ดู `tagSearchResults` ใน `app.jsx`) มิฉะนั้นจะเห็นข้อมูลไม่ครบ
- **กิจกรรมที่ยาวเกิน 24 ชม.** (ข้าม 2+ เที่ยงคืน) ระบบ spillover แสดง indicator ได้แค่วันถัดไปวันเดียว ไม่ไล่แสดงทุกวันที่คาบเกี่ยว
- **`normalizeActivityId` ต้องเรียกทุกจุดที่ lookup ด้วย activity id** — เคยเกิด bug จากลืม normalize มาแล้วหลายจุด (`activity-modal.jsx`, `app.jsx`, และเคย duplicate ฟังก์ชันนี้แยกในบางไฟล์แทนที่จะ import จาก `id-utils.js`) ควร import จากที่เดียวเสมอ
- **`ActivityModal` ต้องมี `key` ที่เปลี่ยนตาม context การเปิดจริง** (กิจกรรมที่แก้ หรือวันที่กำลังจะสร้างใหม่) ไม่ใช่ค่าคงที่ — เพราะ field ในฟอร์มใช้ `useState(initialValue)` ซึ่งอ่านค่าเริ่มต้นแค่ตอน mount ครั้งแรกเท่านั้น ถ้า key ไม่เปลี่ยน React จะไม่ remount และฟอร์มจะค้างค่าจากการเปิดครั้งก่อนหน้า
- **(แก้แล้ว) `handleDuplicateActivity` เคยเขียน state/backend ด้วย `created.id` แบบไม่ normalize** — ทุก handler เขียนข้อมูลอื่นๆ ใน `app.jsx` (save/delete/move/set-color) normalize ทั้งขาอ่านและขาเขียนเสมอ จุดนี้เคยพลาดไม่ normalize ตอนเขียน แก้แล้วโดยเปลี่ยนเป็น `normalizeActivityId(created.id)` — เตือนไว้เผื่อเขียน handler ใหม่ที่ทำสำเนา/สร้างกิจกรรมแล้วต้องผูก category/tag ต่อ
- **(แก้แล้ว) Tag search results เคยไม่ refresh หลังแก้ไข/ลบ/ย้าย/ทำสำเนากิจกรรม** — เดิม effect ที่ดึง `tagSearchResults` มีเงื่อนไข `if (tagSearchResults.length > 0) return;` ทำให้ดึงแค่ครั้งเดียวต่อรอบค้นหา ผลคือแก้ไขกิจกรรมจากภายใน `TagSearchResults` แล้วผลลัพธ์ไม่อัปเดตจนกว่าจะล้างคำค้นหาแล้วพิมพ์ใหม่ แก้แล้วด้วยตัวนับ `tagSearchRefreshKey` ที่ทุก write handler เรียก `refreshTagSearchIfActive()` บั๊มให้หลัง `loadActivities()` เสมอ (เฉพาะตอนกำลังค้นหาอยู่) — ถ้าเพิ่ม handler ใหม่ที่แก้ไขกิจกรรม ต้องเรียกคู่นี้ทั้งสองบรรทัดเสมอ (`await loadActivities(); refreshTagSearchIfActive();`) ไม่ใช่แค่ `loadActivities()` เพียวๆ

---

## 9. Deployment — ทิศทางที่กำหนดไว้ชัดเจน

> **Frontend → GitHub Pages** ผ่าน GitHub Actions, **Backend → Render.com** — เป็นทิศทางหลักของโปรเจกต์ตั้งแต่บัดนี้เป็นต้นไป ห้ามสลับไปใช้ Vercel/Netlify/Firebase Hosting โดยไม่ปรับปรุงเอกสารนี้และ config ที่เกี่ยวข้องให้ตรงกันทั้งหมดก่อน เพื่อป้องกันปัญหาที่เคยเกิด (path ผิดตอน deploy จริงทั้งที่ localhost ปกติดี — ดูหัวข้อ 9.1)

### 9.1 ทำไมต้องระวังเรื่อง path เป็นพิเศษบน GitHub Pages

GitHub Pages เสิร์ฟ repo ที่ไม่ใช่ `<username>.github.io` จาก **subpath `/<repo-name>/` เสมอ** ไม่ใช่ root domain (เช่น `https://username.github.io/a-times-the-calendar/`) — ต่างจาก Vercel/Netlify ที่เสิร์ฟจาก root ตรงๆ และต่างจาก `npm run dev` ที่ serve จาก root เสมอไม่ว่าจะ deploy จริงที่ไหน

**ผลที่ตามมา**: โค้ดใดก็ตามที่อ้างอิงไฟล์ใน `public/` ด้วย string path ตรงๆ ขึ้นต้นด้วย `/` (เช่น `"/logo.svg"`, `"/login-guide-step1.jpg"`) จะไปหาไฟล์ที่ root domain เสมอ ไม่สนใจ subpath — บน `localhost` ใช้ได้ปกติเพราะไม่มี subpath ให้ผิด แต่พอ deploy ขึ้น GitHub Pages จริงจะ 404 ทันที **บั๊กประเภทนี้ตรวจไม่เจอตอน dev เลย เจอเฉพาะหลัง deploy เท่านั้น** (เคยเกิดขึ้นจริงกับ `LOGIN_GUIDE_STEPS` — ดูหัวข้อ 3.1)

**กฎที่ต้องทำตามเสมอ**: ไฟล์ static ใน `public/` ที่ถูกอ้างอิงจากโค้ด JS/JSX (ไม่ใช่จาก `index.html` โดยตรง) ต้อง **`import` เป็นโมดูล** เสมอ ห้าม hardcode string path ที่ขึ้นต้นด้วย `/` เด็ดขาด:

```javascript
// ❌ ผิด — พังตอน deploy จริงบน GitHub Pages (ใช้ได้แค่ localhost)
const step1 = "/login-guide-step1.jpg";

// ✅ ถูก — Vite คำนวณ URL ให้ตรงกับ base path เองอัตโนมัติ ทั้ง dev และ build
import step1 from "../public/login-guide-step1.jpg";
```

`vite.config.js` จัดการเรื่องนี้อีกชั้นผ่าน `base: process.env.VITE_BASE_PATH || "/"` — ตั้งค่าจริง (`/a-times-the-calendar/`) เฉพาะตอน build ใน GitHub Actions เท่านั้น (`npm run dev`/`build` ในเครื่องไม่ต้องตั้ง env นี้เลย ใช้ `"/"` เป็น fallback ปกติ)

### 9.2 Frontend: GitHub Pages ผ่าน GitHub Actions

- Build ด้วย Vite (`npm run build` → output ที่ `frontend/dist/`) แล้ว publish ไปที่ branch `gh-pages` (หรือ GitHub Pages source ที่ตั้งไว้ใน repo settings) ผ่าน workflow ที่ `.github/workflows/deploy-frontend.yml`
- **ต้องมี** `VITE_BASE_PATH=/<repo-name>/` เป็น env var ตอน build step ใน workflow — ไม่ตั้งค่านี้ = หน้าเว็บขึ้นขาว 404 ทุกไฟล์ทันทีที่เปิดจริง (ดูหัวข้อ 9.1)
- Trigger: push เข้า branch หลัก (เช่น `main`) ที่แตะไฟล์ใน `frontend/` — ควรจำกัด path filter ของ workflow ไว้ที่ `frontend/**` เพื่อไม่ build ใหม่ทุกครั้งที่แก้แค่ backend/เอกสาร
- Custom headers (เช่น `Cross-Origin-Opener-Policy: same-origin-allow-popups` ที่จำเป็นสำหรับ Firebase Auth popup — ดูหัวข้อ 6) **GitHub Pages ไม่รองรับการตั้งค่า custom response header ผ่านไฟล์ config แบบ Vercel/Netlify ได้เลย** เพราะเป็น static host ล้วนๆ ไม่มี edge function/middleware — คง COOP warning เดิมไว้ (ไม่กระทบการ sign-in จริง ดูหัวข้อ 6) แทนที่จะพยายามแก้ที่ layer นี้
- **`frontend/vercel.json` และ `frontend/netilfy.toml` ถูกลบออกจากโปรเจกต์แล้ว** (เดิมมีไว้ตั้ง COOP header ตอนยังพิจารณา deploy ผ่าน Vercel/Netlify) — ไม่มีผลกับ GitHub Pages เลยและไม่ได้ใช้งานจริงแล้ว เก็บไว้จะสร้างความสับสนว่าโปรเจกต์ deploy ผ่านแพลตฟอร์มไหนกันแน่ ถ้าในอนาคตพิจารณาย้าย deploy target กลับไปใช้แพลตฟอร์มใดแพลตฟอร์มหนึ่งอีกครั้ง ค่อยสร้างไฟล์เหล่านี้ใหม่ตอนนั้น (เนื้อหาเดิม: ตั้ง header `Cross-Origin-Opener-Policy: same-origin-allow-popups` ให้ทุก path)

### 9.3 Backend: Render.com

- Backend (`backend/`, Express + Firestore — ดู `backend.md`) deploy แยกเป็น service ต่างหากบน Render.com ไม่ผูกกับ GitHub Actions workflow ของ frontend
- Render.com auto-deploy จาก push เข้า branch หลักที่แตะ `backend/**` ได้เองผ่านการตั้งค่า "Root Directory" ของ service ใน Render dashboard (ไม่ต้องเขียน GitHub Actions workflow แยกสำหรับฝั่งนี้)
- `VITE_API_BASE_URL` (ใช้ใน `api.js`) ฝั่ง frontend ต้องชี้ไปที่ URL จริงของ Render service (เช่น `https://xxx.onrender.com`) ผ่าน `.env`/`.env.production` — คนละค่ากับตอน dev local ที่ชี้ `http://localhost:4000`
- Render free tier มี cold start (service sleep เมื่อไม่มี request) — เป็นเรื่องปกติของแผนนี้ ไม่ใช่บั๊ก แค่ request แรกหลัง idle จะช้ากว่าปกติ

### 9.4 Checklist ก่อน deploy ทุกครั้ง

1. ไฟล์ static ใหม่ที่เพิ่มใน `public/` และถูกอ้างอิงจากโค้ด JS/JSX — ใช้ `import` เสมอ ไม่ hardcode path (ดูหัวข้อ 9.1)
2. ทดสอบ `npm run build && npm run preview` ในเครื่องก่อน push อย่างน้อยหนึ่งครั้ง (ไม่ใช่แค่ `npm run dev`) — `preview` ยัง serve จาก root เหมือน `dev` แต่อย่างน้อยจับ syntax/import error ที่ build-only ได้เร็วกว่ารอ GitHub Actions
3. เช็คว่า `VITE_BASE_PATH` ใน workflow ตรงกับชื่อ repo จริง (ตรงตัวพิมพ์เล็ก-ใหญ่ด้วย)
4. เช็คว่า `.env`/`.env.production` ฝั่ง frontend มี `VITE_API_BASE_URL` ชี้ไปที่ Render service ที่ถูกต้อง ไม่ใช่ `localhost`
5. ถ้าแก้ auth flow (`google-calendar.js`, `firebase-config.js`) — ทดสอบ sign-in บน URL จริงของ GitHub Pages หลัง deploy เสมอ อย่าเชื่อผลจาก localhost อย่างเดียว เพราะ Firebase Auth domain allowlist ต้องรวม GitHub Pages domain ไว้ด้วย (ตั้งค่าที่ Firebase Console > Authentication > Settings > Authorized domains)
