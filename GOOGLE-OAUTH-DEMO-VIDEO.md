# Demo video สำหรับ Google OAuth verification — T.i.M.E.S.

เตรียมเมื่อ 28 กันยายน 2026 — ยังไม่ได้อัดหรืออัปโหลดวิดีโอ

คู่มือนี้ใช้กับเว็บ https://timesapp.online/ หลัง deploy Privacy Policy ฉบับ 28 กันยายน 2569 ความยาวแนะนำประมาณ 5–7 นาทีเป็นแนวทางจัดเวลา ไม่ใช่ข้อกำหนดระยะเวลาจาก Google

## ก่อนอัด

- ใช้บัญชีทดสอบและกิจกรรมตัวอย่าง ไม่มีข้อมูลส่วนตัวของบุคคลอื่น
- เตรียมปฏิทินหลักและปฏิทินรองที่บัญชีทดสอบมองเห็นได้ ใส่กิจกรรมวันนี้ที่ชื่อต่างกัน เช่น `Demo — Primary meeting` และ `Demo — Study calendar`
- ใช้ browser profile ใหม่ เริ่มจากหน้าเว็บที่ยังไม่ล็อกอิน ตั้งภาษา Google consent เป็น English และเปลี่ยนภาษาแอปเป็น English หากทำได้
- ตรวจว่า backend พร้อมและคำถาม Calendar/AI ใช้งานได้ก่อนเริ่มอัด
- แสดง address bar และชื่อแอปบนหน้าขอสิทธิ์ให้ชัด รวมถึง OAuth client ID ซึ่งเป็นรหัสสาธารณะ อย่าแสดง client secret, bearer token, refresh token หรือ authorization code
- หากยังไม่เห็น consent ใหม่ ให้ใช้บัญชีที่ไม่เคยเชื่อมแอป หรือถอนสิทธิ์เฉพาะบัญชีทดสอบก่อนเริ่ม อย่าถอนสิทธิ์บัญชีที่ใช้แจ้งเตือนจริงเพื่ออัดวิดีโอ

## ลำดับภาพและบทพูด

### 0:00–0:40 — หน้าเว็บสาธารณะ

เปิดหน้าแรกให้เห็น URL และคำอธิบาย T.i.M.E.S. จากนั้นเปิดลิงก์ Privacy Policy ให้เห็นวันที่ฉบับใหม่ สิทธิ์ Calendar และหัวข้อการจัดเก็บ/ส่งข้อมูล

บทพูด: “T.i.M.E.S. helps users plan activities and review their schedules. This is our public homepage and privacy policy.”

### 0:40–1:40 — ลงชื่อเข้าใช้และเชื่อม Calendar

สาธิต Google sign-in แล้วกดเชื่อม Google Calendar ให้เห็นหน้าขอสิทธิ์จริงเป็นภาษาอังกฤษ ชื่อแอป และสิทธิ์ทั้งสองรายการก่อนอนุญาต จากนั้นให้เห็นว่ากลับมาที่ timesapp.online และโหลดกิจกรรมได้ หลีกเลี่ยงการตัดข้าม consent

บทพูด: “Google sign-in identifies the user. Calendar access is requested separately when the user connects their calendar.”

### 1:40–3:20 — calendar.events

ใน Activity Mode แสดงกิจกรรมที่อ่านมา สร้าง `Demo — Verification activity` ความยาว 1 ชั่วโมง เปิด Google Calendar ให้เห็นรายการเดียวกัน แก้ชื่อหรือเวลาใน T.i.M.E.S. แล้วตรวจผลใน Calendar สุดท้ายลบเฉพาะกิจกรรมทดสอบและแสดงผลหลัง refresh

บทพูด: “The calendar.events scope lets users view, create, update, and delete events. Read-only access would not support these editing features.”

### 3:20–4:20 — calendar.calendarlist.readonly

เปิด MR.Zettascale และถาม `วันนี้มีอะไรบ้าง?` ให้คำตอบแสดงกิจกรรมทดสอบจากปฏิทินหลักและรอง ใช้คำถามนี้ตรวจซ้อมก่อนอัด เพราะผลขึ้นกับวันที่ ช่วงเวลา และปฏิทินที่บัญชีมองเห็นได้ หากไม่เห็นข้อมูลรอง ให้ตรวจการแชร์/สิทธิ์/การเลือกปฏิทินและแก้ก่อนอัด ไม่อ้างว่าครอบคลุมทุกปฏิทินถ้าผลจริงไม่แสดง

บทพูด: “The calendar list scope lets the backend discover accessible calendars for schedule questions. The app does not modify the calendar list.”

### 4:20–5:10 — ข้อมูลที่จัดเก็บ (AI เฉพาะนักพัฒนา)

สาธิตเก็บกิจกรรมทดสอบเข้าคลังเพื่อให้เห็นว่ามีข้อมูลที่แอปเก็บเอง ตอนนี้ Gemini เปิดเฉพาะ developer UID ที่อนุญาต ผู้ใช้ทั่วไปจะไม่เห็นคำถามสีม่วง หากแสดง AI ให้ใช้บัญชีนักพัฒนากับกิจกรรมจำลอง ระบุว่าเป็น developer preview ผ่าน Gemini Developer API ซึ่ง Free Tier มีข้อกำหนดการใช้ข้อมูลเพื่อพัฒนาบริการ ส่วนผู้ใช้ทั่วไปให้สาธิตคำถาม Calendar ที่ระบบตอบเองตามขั้นตอนก่อนหน้า

บทพูด: “AI is a developer-only preview using the Gemini Developer API. This demonstration uses fictional schedule data. Archived activities are stored separately in the app.”

หากสาธิต Telegram เพิ่ม ให้เชื่อมบัญชีทดสอบก่อนและแสดงข้อความตัวอย่างหนึ่งข้อความ ขั้นตอนนี้เสริมคำอธิบายการส่งข้อมูล ไม่ใช้แทนการสาธิต Calendar scopes

### 5:10–6:00 — ยกเลิกการเชื่อมต่อ

ไป Settings กดยกเลิกการเชื่อม Google Calendar ให้เห็นสถานะ disconnected และจุดที่เชื่อมใหม่ได้ อธิบายว่าลบ credential แต่คลังกิจกรรมและข้อความไม่ได้ถูกลบตามโดยอัตโนมัติ

บทพูด: “Users can disconnect Calendar in Settings. The backend deletes its stored refresh token and attempts revocation with Google. Users manage archived items and chat history separately.”

## ก่อนส่ง

- [ ] อ่านชื่อแอป, URL และ consent ได้ชัด
- [ ] มีภาพใช้งานจริงของทั้งสอง scope ไม่ใช่สไลด์หรือคำพูดอย่างเดียว
- [ ] ไม่มีข้อผิดพลาดระหว่าง flow ที่สาธิต
- [ ] ไม่เห็นข้อมูลลับหรือกิจกรรมจริงของบุคคลอื่น
- [ ] อัปโหลด YouTube เป็น Unlisted แล้วทดลองเปิดลิงก์จากหน้าต่างที่ไม่ได้ล็อกอิน
- [ ] ใส่ลิงก์วิดีโอใน Verification Center และตรวจ Branding ว่า Published

Video URL: ยังไม่ได้อัปโหลด

## ข้อความอธิบาย scope สำหรับตรวจทานก่อนกรอก

**calendar.events:** T.i.M.E.S. lets users view, create, edit, and delete events in their primary Google Calendar from Activity Mode. Calendar questions also read relevant events from accessible calendars. Read-only access is insufficient because users can save changes to Calendar.

**calendar.calendarlist.readonly:** T.i.M.E.S. reads the user's calendar list to discover accessible calendars and retrieve relevant events when answering schedule questions. It does not create, edit, or delete calendar list entries.

## อ้างอิง

[Google — Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) กำหนดให้วิดีโอแสดง sign-in/consent เป็นภาษาอังกฤษ ชื่อแอป client ID และการใช้งานสิทธิ์ที่ขอ พร้อมเผยแพร่เป็น YouTube Unlisted

งานที่ผู้ใช้ต้องทำต่อคืออัด flow ด้วยบัญชีทดสอบ อัปโหลดวิดีโอ และนำลิงก์ไปยื่น เอกสารนี้เป็นบทเตรียมอัด ไม่ใช่วิดีโอที่อัดสำเร็จแล้ว
