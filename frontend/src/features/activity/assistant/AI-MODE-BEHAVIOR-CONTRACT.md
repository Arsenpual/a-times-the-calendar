# AI Mode: ข้อตกลงระหว่าง mockup กับระบบจริง

เอกสารนี้ใช้ตรวจการย้าย `src/dev/mockups/activity-mode-ai-workspace-mockup.jsx` เข้า AI Mode บน PC ข้อมูลใน mockup เป็นตัวอย่างเท่านั้น หน้าใช้งานจริงต้องอ่าน state และเรียก action จาก `use-activity-assistant-conversation.js` และ `account-app.jsx`

| ส่วนใน mockup | แหล่งพฤติกรรมจริง | ข้อจำกัดในการย้าย |
| --- | --- | --- |
| คุยอิสระ | `POST /api/ai/free-conversation` ผ่าน `continueFreeConversation` | ใช้ Gemini quota และเปิดเฉพาะบัญชีนักพัฒนาที่ได้รับสิทธิ์; ไม่อ่านข่าว อากาศ หรือ Calendar สด |
| อากาศกับกิจกรรม | `POST /api/ai/weather-plan` ผ่าน Google Weather และตัวจัดอันดับเดียวกับ Telegram | แสดงสถานที่ เวลาอัปเดต แหล่งข้อมูล และช่วงที่ผ่านเกณฑ์; AI ให้คำอธิบายสั้นเฉพาะเมื่อมีสิทธิ์และโควต้า; เลือกช่วงแล้วเปิดร่างใน ActivityModal เพื่อให้ยืนยันเอง |
| วางแผนกิจกรรม | `POST /api/ai/activity-conversation` และ guided flow ใน conversation hook | คำขอบางชนิดตอบด้วยกฎหรือข้อมูลตารางโดยไม่ใช้ Gemini; ห้ามปิดทั้งโหมดเมื่อ AI quota หมด |
| คำถามสำเร็จรูป | `POST /api/ai/product-knowledge` หรือข้อความ template ใน hook | ไม่ใช้ Gemini quota; ใช้ได้แม้บัญชีไม่มีสิทธิ์ AI |
| ดูตาราง / หาเวลาว่าง | เครื่องมือ Calendar และการจัดช่วงเวลาจาก backend เดิม | แสดงช่วงข้อมูลที่อ่านได้จริง; ติดป้าย `ปฏิทิน` ถ้าไม่ได้เรียก AI |
| สรุปวันนี้ | `onOpenDailySummary` และ `buildDailySummaryChat` | เป็นการจัดรูปแบบข้อมูลจริงที่อ่านได้; ไม่ติดป้าย AI เมื่อไม่ได้เรียก AI |
| สร้างกิจกรรม | guided flow, `createActivityPopupHandoff`, `ActivityModal` | ร่างต้องครบและผ่าน validation; ผู้ใช้ตรวจในฟอร์มและกดบันทึกเองก่อนเขียน Calendar |
| แผนหลายกิจกรรม | `ActivityPlanPreview` และ `onConfirmActivityPlan` | เลือก/แก้ร่างและยืนยันชุดก่อนส่งบันทึก; ห้ามคัดลอก `findSlots` จำลองจาก mockup |
| ข้อความ Telegram | `useTelegramWebChat` ผ่าน props ของหน้า AI | สำเนาแยกจากบทสนทนา AI; ปุ่มเริ่มแชทใหม่ล้างเฉพาะ AI, การล้างสำเนา Telegram เป็นอีก action |
| โควต้า/สิทธิ์ | `GET /api/ai/activity-assistant-status` | แยก `ไม่มีสิทธิ์`, `ใช้ครบโควต้า`, `ปิดโดยระบบ` จากเครื่องมือที่ไม่ใช้ AI |

## สถานะที่หน้าใหม่ต้องรองรับ

- `pending`, `pendingSource`, `error`, `cooldownSeconds`, `aiStatus`, `canUseGemini`
- `messages` และ `source` ของแต่ละข้อความ; ข้อความที่เป็น `template`, `knowledge`, `calendar`, `ai` หรือ `free-ai` ต้องมีป้ายตรงการทำงานจริง
- `chatStyle`, `guidedActivity`, `quickReplies`, ตัวเลือกเวลา, ร่างแผน และการส่งร่างไปฟอร์มตรวจ
- ประวัติแชทที่ผูกกับบัญชีใน browser localStorage และการสลับ Activity/Reminder/AI

## สิ่งที่ mockup มี แต่ยังไม่ใช่ความสามารถ production

- ปุ่ม `หยุด` ใน mockup ยกเลิกเพียง timer จำลอง; API request จริงยังไม่มีการยกเลิก อย่าแสดงปุ่มนี้จนกว่าจะรองรับ AbortController และทดสอบการคืน quota/ผลลัพธ์ที่มาช้า
- `findSlots`, วัน/เวลา และข้อมูล Telegram ใน mockup เป็นข้อมูล hard-code ห้ามนำมาใช้คำนวณหรือแสดงในหน้า production
- ป้าย `AI · ปฏิทิน` ใน mockup ใช้กับคำตอบบางอย่างที่ในระบบจริงเป็นผลกำหนดกฎ จึงต้องเลือกป้ายจาก `source` ของผลลัพธ์จริง
- สวิตช์สิทธิ์ใน mockup ปิดทุกเครื่องมือพร้อมกัน ซึ่งไม่ตรงกับระบบจริง ต้องจำกัดเฉพาะ action ที่เรียก AI

Phase 1 ย้ายเฉพาะโครงหน้า chat + work rail และคง action เดิม Phase ถัดไปจึงปรับการ์ดและขั้นตอนต่าง ๆ ตามข้อตกลงนี้
