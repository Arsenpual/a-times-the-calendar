# แผนขอ Google OAuth App Verification — T.i.M.E.S.

อัปเดต: 24 กันยายน 2026  
เป้าหมาย: ให้ผู้ใช้ทั่วไปเชื่อม Google Calendar กับ T.i.M.E.S. ได้ผ่านหน้าขอสิทธิ์ที่ Google ตรวจรับรอง โดยไม่ต้องผ่านคำเตือน “แอปนี้ยังไม่ได้รับการยืนยัน”

> เอกสารนี้เป็นแผน ไม่ใช่การยืนยันว่า Google จะอนุมัติแน่นอน สถานะ OAuth, scope classification และรายการโดเมนจริงต้องตรวจใน Google Cloud Console ก่อนยื่น

## ภาพปัจจุบันที่ตรวจจากโค้ด

| เรื่อง | สถานะที่พบ | ผลต่อการยื่น |
| --- | --- | --- |
| Backend Calendar OAuth | ขอ `calendar.events` และ `calendar.calendarlist.readonly` ใน `backend/calendar-oauth.js` | ต้องอธิบายเหตุผลของ **ทั้งสอง** scope และแสดงการใช้งานจริงในวิดีโอ |
| การใช้ Calendar | `backend/routes/calendar.js` จัดการ event ในปฏิทินหลัก; `backend/calendar-question.js` อ่านรายชื่อปฏิทินที่มองเห็นได้และ event ตามช่วงเวลาสำหรับคำถามของผู้ใช้ | คำชี้แจงว่าแอปอ่านเฉพาะ `primary` ไม่ตรงกับฟีเจอร์คำถาม |
| AI | `backend/routes/ai-activity-draft.js` ส่งบริบท Calendar บางส่วนไป Vertex AI เมื่อผู้ใช้ถามคำถามที่ต้องให้ AI วิเคราะห์ | ต้องอธิบายการส่งข้อมูลนี้ให้ผู้ใช้และ Google อย่างตรงไปตรงมา |
| Refresh token | Backend เข้ารหัสและเก็บ token ในเอกสาร `users/{uid}/private/calendarAuth` | Privacy Policy ควรบอกว่ามีการเก็บ token เพื่อเชื่อมต่ออัตโนมัติ พร้อมวิธียกเลิก/ลบ |
| Privacy Policy | `frontend/public/privacy.html` ยังระบุ scope `calendar` แบบกว้าง, ระบุว่าอ่านเฉพาะ `primary` และว่าเรียก API จากเบราว์เซอร์เท่านั้น | **ต้องแก้ก่อนยื่น** เพราะไม่ตรงกับโค้ดปัจจุบัน |
| หน้าแรกสาธารณะ | `frontend/src/app/app.jsx` แสดงหน้าล็อกอินเป็นหลัก; ยังไม่เห็นลิงก์ Privacy Policy บนหน้านั้น | ต้องมีหน้าอธิบายแอปและลิงก์ Privacy Policy ที่ Google reviewer เปิดได้โดยไม่ล็อกอิน |
| Firebase Google sign-in | `frontend/src/features/auth/api/google-auth.js` มีทางขอ `calendar.events` เพิ่มผ่าน Firebase reauthentication แยกจาก Backend OAuth | ต้องตรวจว่า flow นี้ยังใช้จริงหรือไม่ และ consent/client ใดปรากฏแก่ผู้ใช้ |

URL ที่ใช้ในปัจจุบันตามการใช้งานโครงการ: หน้าเว็บ `https://arsenpual.github.io/a-times-the-calendar/` และ backend `https://times-the-calendar-backend.onrender.com/` — **ตรวจ URL จริงใน Console อีกครั้ง** ก่อนบันทึกแบบยื่น

## Phase 1 — ทำให้ผลิตภัณฑ์และเอกสารตรงกัน (ควรทำก่อน)

- [ ] ตรวจ flow ตั้งแต่ `เข้าสู่ระบบด้วย Google` → `เชื่อม Google Calendar` → อ่าน/แก้ไขกิจกรรม → ถามข้อมูล Calendar ว่าใช้ OAuth client และ scope ใดจริงบ้าง รวมถึงทาง Firebase reauthentication ที่ยังคงอยู่
- [ ] ทำรายการ OAuth client ทั้งหมดใน Google Cloud Console: client ID (เปิดเผยได้), ประเภท, redirect URI, JavaScript origin, scope ที่ขอ และฟีเจอร์ที่เรียกใช้ โดย **ไม่ใส่ client secret หรือ token ในเอกสาร**
- [x] แก้ Privacy Policy ให้ตรงกับการใช้งานจริง: Calendar scopes ปัจจุบัน, การอ่านปฏิทินที่มองเห็นได้, การสร้าง/แก้ไข/ลบ event, การเก็บ refresh token แบบเข้ารหัส, กรณีส่งบริบท Calendar ไป Vertex AI, ระยะเวลาเก็บและวิธีลบ/ถอนสิทธิ์ ตรวจคำกล่าวอ้างอื่นในนโยบายด้วย
- [x] ทำหน้า landing/home ที่เปิดได้โดยไม่ล็อกอิน อธิบายว่า T.i.M.E.S. ทำอะไร ใครใช้ และเหตุใดต้องเชื่อม Calendar; วางลิงก์ Privacy Policy ที่เห็นชัดบนหน้าแรกและหน้าล็อกอิน
- [x] ตรวจว่ามีทาง “ยกเลิกการเชื่อมต่อ Google Calendar” ที่ถอนสิทธิ์และลบ refresh token ของผู้ใช้จริงหรือไม่ หากยังไม่มี ให้เพิ่มและทดสอบก่อนยื่น
- [x] ปรับข้อความแนะนำให้กดผ่านคำเตือน unverified app ให้ตรงกับสถานะปัจจุบัน และเลิกแสดงเมื่อได้รับอนุมัติ

**เกณฑ์ผ่าน:** คนที่ไม่เคยใช้แอปเปิดหน้าแรกและ Privacy Policy ได้โดยไม่ล็อกอิน; ทุกคำอธิบายเรื่อง scope/การไหลของข้อมูลตรงกับโค้ดและพฤติกรรมจริง

### สิ่งที่ทำในโค้ดแล้ว (ยังไม่ได้ deploy)

- หน้าเข้าสู่ระบบอธิบาย T.i.M.E.S. และมีลิงก์ไป `privacy.html`; เอาคู่มือที่สอนกดผ่านหน้า “unsafe/unverified” ออกแล้ว
- Firebase sign-in ไม่ร้องขอ Calendar scope อีกต่อไป; การขอสิทธิ์ Calendar เกิดจาก backend OAuth flow ที่ผู้ใช้เลือกเชื่อมต่อเท่านั้น
- Settings มีปุ่มยกเลิกการเชื่อมต่อ: backend พยายาม revoke refresh token กับ Google แล้วลบเอกสาร credential ใน Firestore เสมอ แม้การ revoke ทางเครือข่ายไม่สำเร็จ
- Privacy Policy ระบุ scopes จริง, การอ่านปฏิทินหลายชุดสำหรับคำถาม Calendar, refresh token ที่เข้ารหัส และการส่งบริบทไป Vertex AI เมื่อผู้ใช้เลือกใช้ AI

## Phase 2 — ตรวจโดเมน, หน้าขอสิทธิ์ และขอบเขตข้อมูล

- [ ] ใน Google Cloud Console ตรวจ OAuth consent screen/Google Auth Platform ว่าอยู่สถานะ Production, เป็น External หากเปิดให้บุคคลทั่วไปใช้, และข้อมูล app name, logo, support email, developer contact ครบและตรงกับหน้าเว็บ
- [ ] ตรวจ `Authorized domains` รวมทั้งโดเมนของ homepage, Privacy Policy และ redirect URI ทั้งหมด; ยืนยันความเป็นเจ้าของผ่าน Google Search Console ตามที่ Google กำหนด หากโดเมนที่ใช้อยู่ยืนยันความเป็นเจ้าของไม่ได้ ให้ประเมินใช้ **custom domain ที่ควบคุมได้** ก่อนยื่น ไม่เปลี่ยน URL จริงจนกว่าจะวางแผน migration/test ครบ
- [ ] ตรวจ URL ที่ยื่นให้ตรงกันทุกจุด: homepage, Privacy Policy, Terms (ถ้ามี), Firebase authorized domains, OAuth origins/redirects และค่า environment ของ frontend/backend; แยก local development URLs ออกจาก production ให้ชัด
- [ ] ตรวจ Data Access ใน Console ว่า scope ไหนถูกจัดเป็น sensitive/restricted ณ วันที่ยื่น และ scope ที่แสดงตรงกับที่แอปขอจริง; หากมี restricted scope ให้ประเมินขั้นตอน security assessment เพิ่มเติมตามที่ Console แจ้ง
- [ ] ทบทวน minimum scope: `calendar.events` จำเป็นสำหรับอ่าน/สร้าง/แก้ไข/ลบ event; `calendar.calendarlist.readonly` จำเป็นเฉพาะฟีเจอร์เลือก/อ่านรายชื่อปฏิทินที่ผู้ใช้มองเห็นได้ ถ้าตัดฟีเจอร์นั้นออกได้ ให้ลด scope ก่อนยื่น

**เกณฑ์ผ่าน:** ไม่มีโดเมน/redirect ที่ Google ตรวจแล้วเป็นเจ้าของไม่ได้; scope ที่ขอแต่ละตัวมีฟีเจอร์ใช้งานจริงและคำอธิบายชัด

## Phase 3 — ทดสอบความปลอดภัยและเตรียมหลักฐาน

- [ ] ทดสอบด้วยบัญชี Google ที่ **ไม่เคยอนุญาตแอปนี้มาก่อน**: ลงชื่อเข้าใช้, เชื่อม Calendar, ดู event, สร้าง/แก้ไข/ลบ event, ถามคำถาม Calendar, ยกเลิกเชื่อมต่อ และเชื่อมใหม่
- [ ] ตรวจหน้าขอสิทธิ์ว่าแสดงชื่อแอป, scope และ redirect URL ที่คาดไว้; ตรวจทั้ง flow ของ Firebase sign-in และ backend Calendar OAuth ถ้ามีสอง client
- [ ] ตรวจสิทธิ์ Firestore ของเอกสาร token, การเข้ารหัส, การลบข้อมูล และการป้องกัน client secret / refresh token / access token ไม่ให้ปรากฏใน repo, browser console, Render log หรือวิดีโอ
- [ ] ตรวจว่า AI รับ Calendar context เฉพาะเมื่อผู้ใช้กดถามที่เกี่ยวข้อง; จำกัดข้อมูลที่ส่งตามความจำเป็น และบอกผู้ใช้ชัดว่าคำถามประเภทนี้ใช้ข้อมูล Calendar/โควต้า AI อย่างไร
- [ ] เตรียมวิดีโอสาธิตแบบ unlisted ที่เปิดได้โดย Google reviewer: เริ่มจากหน้าเว็บสาธารณะ → หน้า Privacy Policy → login → consent จริง → สาธิตฟีเจอร์ที่รองรับ scope **ทีละตัว** → การยกเลิกสิทธิ์; เปิด UI/consent เป็นภาษาอังกฤษหาก Google ร้องขอ และเบลอข้อมูลส่วนตัว/ความลับ
- [ ] เตรียมข้อความ scope justification สั้น ชัด และตรงการใช้งาน เช่น `calendar.events`: ให้ผู้ใช้ดูและจัดการ event จาก Activity Mode; `calendar.calendarlist.readonly`: ให้คำถาม Calendar อ้างอิงปฏิทินหลายชุดที่ผู้ใช้มองเห็นได้ โดยแอปไม่ได้แก้ไขรายการปฏิทิน

**เกณฑ์ผ่าน:** reviewer ดูวิดีโอและทดลองแอปได้โดยไม่ต้องเดาขั้นตอน; ทุก scope มีภาพการใช้งานจริง; ไม่มีข้อมูลลับหลุดในหลักฐาน

## Phase 4 — ยื่นและตอบ Google

- [ ] เปิด Google Cloud Console → Google Auth Platform / OAuth consent screen → Verification Center (ชื่อเมนูอาจเปลี่ยน) แล้วตรวจรายการ “Prepare for verification” ตามสถานะจริง
- [ ] กรอก URL, scope justification, test instructions, demo video และข้อมูลติดต่อ reviewer; ส่งคำขอตรวจ
- [ ] ติดตามอีเมล developer contact และ Verification Center; ตอบคำขอแก้ไขของ Google โดยอ้างอิงรุ่นโค้ด/URL ที่ deploy แล้ว ไม่เปลี่ยน scope หรือ flow ระหว่างตรวจโดยไม่จำเป็น
- [ ] เมื่อได้รับอนุมัติ ทดสอบด้วยบัญชีใหม่อีกครั้ง และอัปเดตข้อความในแอป/เอกสารให้สะท้อนสถานะ verified จริง

**เกณฑ์ผ่าน:** Google แจ้งอนุมัติสำหรับ OAuth app และ scopes ที่ใช้งานจริง; ผู้ใช้ใหม่ไม่เจอคำเตือน unverified ใน flow ที่อนุมัติแล้ว

## ลำดับทำงานที่แนะนำ

1. **เริ่มทันที:** แก้ Privacy Policy และหน้าแรก (Phase 1) เพราะตอนนี้ข้อมูลบางจุดขัดกับโค้ด
2. **ก่อนอัดวิดีโอ:** สรุปว่าจะคง OAuth สอง flow หรือทำให้เหลือ flow ที่จำเป็น แล้วล็อก scope/URL/โดเมน (Phase 2)
3. **หลัง deploy เวอร์ชันที่จะยื่น:** ทดสอบบัญชีใหม่และอัดวิดีโอจาก production จริง (Phase 3)
4. **สุดท้าย:** ยื่นและแก้ตาม feedback โดยไม่คาดเดาวันอนุมัติ (Phase 4)

## อ้างอิงข้อกำหนดของ Google

- [OAuth app verification requirements](https://support.google.com/cloud/answer/13464321?hl=en) — homepage, privacy policy, domain ownership, demo และการใช้ scope ที่จำเป็น
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) — หลักฐานและการตรวจ sensitive scopes
- [Google Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth) — ความหมายและขอบเขตของ Calendar scopes
- [Submit your app for verification](https://support.google.com/cloud/answer/13461325?hl=en-GB) — ขั้นตอนส่งคำขอใน Console
- [Google OAuth 2.0 policies](https://developers.google.com/identity/protocols/oauth2/policies) — หลัก least privilege, security และนโยบาย OAuth
