// The only product knowledge MR.Zettascale may use in a free-text answer.
// Keep this aligned with the template-chat branch “T.i.M.E.S. คืออะไร”.
const TEXT = `
PRODUCT IDENTITY
T.i.M.E.S. is a personal time-planning app. It separates scheduled activities from reminders while showing both in connected time views. Its purpose is to help a person see what is planned, what needs attention, and what is due next without treating every scheduled block as a reminder.
T.i.M.E.S. stands for "Task Interactive & Management Efficiency Intelligent System". Its timeline concept is also described as "Time-in-Action Visualization": making the progress of time and scheduled activities visible on a real-time timeline.

CORE TERMS
- Activity: a scheduled block with a start and end time. It belongs to Activity Mode and can be placed on the calendar-like Week Spine.
- Reminder: something to track or be notified about. It belongs to Reminder Mode. A reminder is not automatically the same thing as an activity.
- Week Spine: the visual weekly schedule for activities, laid out by day and time.
- Cycle: a read-only overview that groups four calendar weeks. A user can enter a chosen week from this view to edit it normally.
- Category: a named, coloured grouping for activities. Tags are separate, free-form labels used to add context.

ACTIVITY MODE
Activity Mode is the planning surface for real scheduled activities. A user can add an activity, edit its title/time/category/tags, drag it to another time or day, resize its duration, copy it, lock or unlock it, and archive it. Activities can overlap; the display supports up to three visible overlapping activities in the Week Spine. A locked activity is protected from accidental editing, but an unrelated activity may still be scheduled at the same time.

An all-day activity is still an ordinary activity: it spans from 00:00 on its start date to 00:00 on the next date. It appears on the Week Spine and can be opened or moved like another activity. All-day activities do not appear on the Reminder Mode timeline and do not trigger Telegram notifications.

Activity Mode has a one-week editing view and a four-week Cycle overview. Weekly and Cycle summaries help read the selected period. The mini timeline/single-day summary helps inspect activities on one chosen day. Google Calendar activities can be brought into Activity Mode after connection.

REMINDER MODE
Reminder Mode manages reminders independently from activities. Supported reminder types include one-time (once-at), weekly, routine/checklist routine, interval, countdown, and stopwatch. Only active reminders are shown on the Reminder Mode timeline; completed or paused reminders are kept out of that timeline. Reminder cards can show their state and relevant timing details.

Weekly and one-time reminders can have an optional buffer. A buffer creates a temporary countdown before the main reminder and/or a temporary stopwatch after it. The temporary buffer does not need to be completed manually; it follows normal notification rules and counts toward the notification quota. A buffer is not a separate permanent reminder document.

Interval reminders are intentionally kept simple. They use a start time, end time, and an interval frequency. Frequent interval reminders may be excluded from exported reminder images when they would make the image unreadable.

GOOGLE CALENDAR
Google Calendar connection uses the signed-in user's Google OAuth permission. The backend stores a refresh token encrypted and uses it to request fresh access tokens automatically, so normal access-token expiry should not require a manual reconnection every hour. If the user revokes permission, Google rejects the refresh token, or the OAuth configuration changes, the user must reconnect Google Calendar.

Calendar connection is optional: T.i.M.E.S. remains usable without it. Do not say that it syncs every Google Calendar feature or that it works without the user's explicit Google permission.

NOTIFICATIONS AND TELEGRAM
Telegram notifications are sent through the MR.Zettascale bot after the user connects Telegram. Notification controls can be set per device. This supports a setup where a main computer edits data while another device, such as a Raspberry Pi with the public web app open, is used to watch for notifications.

The app tracks notification counts and has a daily safety quota shared by reminders, activity notifications, and eligible buffers. Do not promise a notification beyond that quota. If the device responsible for checking notifications is offline, asleep, muted, or has not received the latest data, it may not send a notification at that time.

MR.ZETTASCALE
MR.Zettascale can draft one activity, propose up to three free slots, plan two to five tasks, and split work into focus blocks of up to 90 minutes with 15-minute breaks. A single draft is reviewed in Activity Popup. Multi-item plans are editable and require explicit batch confirmation; partial save failures are reported.

General-question buttons call a dedicated backend knowledge endpoint without AI or AI quota, including unknown-answer fallback. Free-text chat first tries deterministic product answers, complete explicit activity requests and supported planning commands. Other requests may use Gemini subject to account permissions and quota. Guided final summaries may use a separate system AI budget or deterministic fallback.

DATA LAB AND PREFERENCES
Python Data Lab runs offline on local exports. Settings exports Primary Calendar data for an explicit 1-31 day window, capped at 500 fetched events with a truncation flag. Python generates quality, priority-confidence, weekly-pattern, and synthetic scheduling reports. Insight Review accepts generated JSON reports up to 2 MB, not raw activity exports. Optional explicit consent lets activity-draft requests include a report type and up to four allowed aggregate metrics for this browser session. The raw report is not uploaded. Priority confidence measures data readiness, not urgency, importance, or an Eisenhower quadrant.
Settings supports explicit homework start/duration, exercise duration and evening start defaults. Supported saved corrections repeated at least twice can produce approval candidates. Candidates require consent before activation; explicit request timing takes precedence.

DATA, SYNC, AND PRIVACY
Main user data is separated by Firebase UID and stored in Firestore. Added, edited, and deleted data can synchronize between signed-in devices using the same account when those devices are online and able to refresh their data. This is not a promise of instant delivery in every offline or sleeping-device situation.

MR.Zettascale chat history (including AI replies), the selected branch, and unfinished guided activity state are saved in browser Local Storage scoped to the signed-in account. This chat history is not stored in Firestore or synced across devices. Pressing “เคลียร์แชท” resets the local conversation. Approved insight context is held separately in memory, but replies mentioning insights can remain in saved chat history.

ANSWERING RULES
Use only the facts above for product questions. Do not invent pricing, guarantees, integrations, background services, notification schedules, or features not explicitly described here. If information is absent, say: "ผมยังไม่มีข้อมูลยืนยันเกี่ยวกับส่วนนั้นใน T.i.M.E.S. ครับ".
`;

const TOPICS = [
  // Reviewed against the referenced implementations; update these with feature changes.
  {"question":"MR.Zettascale ทำอะไรได้บ้าง?","keywords":["mr.zettascale ทำอะไรได้บ้าง"],"answer":"ผู้ช่วยช่วยร่างกิจกรรม หาเวลาว่าง วางแผนงานหลายรายการ และแบ่งงานเป็นช่วงโฟกัสได้ครับ ร่างกิจกรรมเดี่ยวเปิดให้ตรวจใน Activity Popup ส่วนแผนหลายรายการแก้ไขหรือตัดรายการก่อนยืนยันสร้างทั้งชุดได้ คำถามทั่วไปตอบจาก backend โดยตรง ส่วนการวิเคราะห์ด้วย AI เปิดตามสิทธิ์บัญชี","sources":["backend/routes/ai-activity-draft.js"],"reviewedAt":"2026-10-02"},
  {"question":"หาเวลาว่างทำงานอย่างไร?","keywords":["หาเวลาว่างทำงานอย่างไร"],"answer":"ระบุงาน ระยะเวลา และวัน เช่น “ช่วยหาเวลาว่างออกกำลังกาย 1 ชั่วโมงพรุ่งนี้” ระบบหาช่วงว่างจากตารางที่ส่งมาและเสนอได้สูงสุด 3 ตัวเลือกครับ เลือกแล้วจะเปิดร่างให้ตรวจสอบก่อนบันทึก หากไม่มีช่วงเหมาะสมระบบจะแจ้งให้ปรับวันหรือระยะเวลา","sources":["backend/skills/activity-creation/schedule-context.js"],"reviewedAt":"2026-10-02"},
  {"question":"วางแผนหลายกิจกรรมอย่างไร?","keywords":["วางแผนหลายกิจกรรมอย่างไร"],"answer":"ระบุงาน 2–5 รายการพร้อมระยะเวลา เช่น “ช่วยวางแผนพรุ่งนี้: อ่านหนังสือ 1 ชั่วโมง, ออกกำลังกาย 30 นาที” ครับ ระบบจัดร่างต่อกันในช่วงว่าง คุณแก้ชื่อ เวลา หรือตัดรายการก่อนยืนยันได้ งานที่หาเวลาไม่ได้จะแจ้งแยก และหากบันทึกสำเร็จเพียงบางรายการจะแสดงผลแยกให้ทราบ","sources":["backend/routes/ai-activity-draft.js"],"reviewedAt":"2026-10-02"},
  {"question":"แบ่งงานและเวลาพักอย่างไร?","keywords":["แบ่งงานและเวลาพักอย่างไร"],"answer":"ใช้คำสั่ง เช่น “ช่วยแบ่งงานทำรายงาน 3 ชั่วโมงพรุ่งนี้” ครับ ระบบแบ่งเป็นช่วงโฟกัสสูงสุด 90 นาที คั่นด้วยพัก 15 นาที โดยช่วงสุดท้ายอาจสั้นกว่า คุณตรวจ แก้ไข และเลือกเฉพาะรายการที่ต้องการก่อนยืนยันสร้างได้","sources":["backend/routes/ai-activity-draft.js"],"reviewedAt":"2026-10-02"},
  {"question":"คำถามทั่วไปใช้ AI ไหม?","keywords":["คำถามทั่วไปใช้ ai ไหม"],"answer":"ปุ่มคำถามทั่วไปและคำถามต่อยอดรับคำตอบจากฐานความรู้ของ backend โดยตรง ไม่ใช้ AI quota ครับ หากไม่พบคำตอบจะบอกว่ายังไม่มีข้อมูลยืนยัน ส่วนข้อความที่พิมพ์อิสระใช้เส้นทางแชตซึ่งอาจเรียก AI ตามประเภทคำขอและสิทธิ์บัญชี","sources":["backend/routes/ai-activity-draft.js"],"reviewedAt":"2026-10-02"},
  {"question":"คำสั่งไหนใช้ AI quota?","keywords":["คำสั่งไหนใช้ ai quota"],"answer":"คำถามทั่วไป คำขอสร้างกิจกรรมที่ระบุครบและระบบอ่านได้ คำสั่งหาเวลา วางแผนรายการ และแบ่งงานที่ตรงรูปแบบ ใช้กฎของระบบโดยไม่เรียก Gemini ครับ คำขอที่ต้องใช้ AI และการวิเคราะห์ Calendar ใช้โควต้าตามสิทธิ์บัญชี การสรุปร่างจาก flow ตัวเลือกอาจใช้ AI budget ของระบบหรือสรุปด้วยกฎเมื่อใช้ AI ไม่ได้","sources":["backend/routes/ai-activity-draft.js"],"reviewedAt":"2026-10-02"},
  {"question":"ตั้งค่าความชอบของผู้ช่วยอย่างไร?","keywords":["ตั้งค่าความชอบของผู้ช่วยอย่างไร"],"answer":"ใน Settings คุณกำหนดเวลาเริ่มและระยะเวลาทำการบ้าน ระยะเวลาออกกำลังกาย และเวลาเริ่มช่วงเย็นได้ครับ เปิด ปิด แก้ไข หรือลบได้ ค่าที่คุณระบุในคำขอกิจกรรมมีความสำคัญกว่าค่าเริ่มต้นเหล่านี้","sources":["backend/skills/activity-creation/preferences.js"],"reviewedAt":"2026-10-02"},
  {"question":"ผู้ช่วยเรียนรู้ความชอบเองไหม?","keywords":["ผู้ช่วยเรียนรู้ความชอบเองไหม"],"answer":"ระบบสังเกตการแก้เวลาและระยะเวลาที่รองรับหลังคุณบันทึกกิจกรรมที่มาจากผู้ช่วยครับ เมื่อแก้ค่าเดิมอย่างน้อยสองครั้งจึงเสนอเป็นตัวเลือกใน Settings และต้องได้รับการอนุมัติก่อนเปิดใช้ ไม่ได้จดจำทุกอย่างจากบทสนทนาเป็นความชอบอัตโนมัติ","sources":["backend/skills/activity-creation/preferences.js"],"reviewedAt":"2026-10-02"},
  {"question":"Data Lab คืออะไร?","keywords":["data lab คืออะไร"],"answer":"Data Lab เป็นเครื่องมือ Python ที่วิเคราะห์ไฟล์กิจกรรมในเครื่องครับ รองรับรายงานคุณภาพข้อมูล ความพร้อมของข้อมูลสำหรับพิจารณาลำดับความสำคัญ รูปแบบการใช้เวลารายสัปดาห์ และการประเมินตัวอย่างแผนจัดตาราง โดย Node.js ยังเป็น backend ของเว็บ","sources":["mr-zettascale/lab/src/mr_zettascale_data/__main__.py"],"reviewedAt":"2026-10-02"},
  {"question":"ส่งออกข้อมูล Data Lab อย่างไร?","keywords":["ส่งออกข้อมูล data lab อย่างไร"],"answer":"เปิด Settings ส่วน Data Lab เลือกช่วง 1–31 วันแล้วดาวน์โหลด Activity Export ครับ วันสิ้นสุดไม่นับรวม ใช้กิจกรรมจาก Primary Calendar พร้อมหมวดหมู่ Tag และสถานะล็อก ต้องเชื่อม Calendar และลงชื่อเข้าใช้ ข้อมูลจำกัดสูงสุด 500 events ที่ดึงมา หากยังมีหน้าถัดไปจะระบุ truncated ในไฟล์","sources":["backend/routes/data-lab-export.js"],"reviewedAt":"2026-10-02"},
  {"question":"Activity Export ต่างจาก report อย่างไร?","keywords":["activity export ต่างจาก report อย่างไร"],"answer":"Activity Export เป็นข้อมูลนำเข้า Python ครับ ต้องวิเคราะห์ก่อนจึงได้ไฟล์ผลลัพธ์ เช่น activity-quality-report.json หรือ weekly-time-pattern-report.json ที่มี summary จากนั้นเลือกไฟล์ผลลัพธ์ใน Insight Review การเปลี่ยนชื่อไฟล์ export อย่างเดียวไม่ทำให้เป็น report","sources":["mr-zettascale/lab/src/mr_zettascale_data/__main__.py"],"reviewedAt":"2026-10-02"},
  {"question":"Insight Review ใช้อย่างไร?","keywords":["insight review ใช้อย่างไร"],"answer":"เปิด Settings ส่วน Insight Review แล้วเลือก JSON report ที่สร้างจาก Python Data Lab ขนาดไม่เกิน 2 MB ครับ รองรับ quality, priority confidence, weekly pattern และ scheduling evaluation แล้วแสดงตัวเลขสรุป หากขึ้นว่าไม่พบ summary ให้ตรวจว่าเลือก report แทน Activity Export","sources":["frontend/src/features/settings/components/data-lab-insights.jsx"],"reviewedAt":"2026-10-02"},
  {"question":"ใช้ Insight เป็นบริบทผู้ช่วยอย่างไร?","keywords":["ใช้ insight เป็นบริบทผู้ช่วยอย่างไร"],"answer":"เลือก report ใน Insight Review แล้วติ๊กใช้ summary เป็นบริบทผู้ช่วยใน session นี้ครับ คำขอร่างกิจกรรมจะส่งเฉพาะชนิดรายงานและตัวเลขที่อนุญาตสูงสุด 4 ค่า ไม่ส่งไฟล์ดิบ การอนุญาตอยู่ในหน่วยความจำและหายเมื่อโหลดหน้าใหม่ ไม่ใช่การบันทึกความชอบถาวร แต่ข้อความแชตที่ตอบอาจยังอยู่ในประวัติแชต","sources":["frontend/src/features/activity/assistant/hooks/use-activity-assistant-conversation.js"],"reviewedAt":"2026-10-02"},
  {"question":"Priority Confidence คืออะไร?","keywords":["priority confidence คืออะไร"],"answer":"เป็นการประเมินความพร้อมของข้อมูลจากชื่อที่ชัดเจน หมวดหมู่ Tag และโน้ตครับ ระดับสูง ปานกลาง หรือต่ำบอกว่ามีบริบทเพียงพอให้คนพิจารณาหรือไม่ ไม่ใช่คะแนนความสำคัญหรือความเร่งด่วนของงาน","sources":["mr-zettascale/lab/src/mr_zettascale_data/priority.py"],"reviewedAt":"2026-10-02"},
  {"question":"Weekly Time Pattern คืออะไร?","keywords":["weekly time pattern คืออะไร"],"answer":"รายงานสรุปเวลาที่จัดไว้ตามวัน หมวดหมู่ และช่วงเวลาเริ่มครับ งานข้ามคืนแยกเวลาตามวัน กิจกรรมทั้งวันนับแยก และข้อมูลเวลาเสียถูกแยกออกพร้อมจำนวน วันที่มีเวลาซ้อนเป็นข้อมูลความหนาแน่นของตาราง ไม่ใช่การตัดสินว่าคุณทำงานหนักเกินไป","sources":["mr-zettascale/lab/src/mr_zettascale_data/weekly.py"],"reviewedAt":"2026-10-02"},
  {"question":"ระบบใช้ Eisenhower Matrix แล้วหรือยัง?","keywords":["ระบบใช้ eisenhower matrix แล้วหรือยัง"],"answer":"ตอนนี้ Data Lab ประเมินเพียงความพร้อมของข้อมูลสำหรับให้คนพิจารณาครับ ยังไม่จัดกิจกรรมลง Eisenhower Matrix อัตโนมัติ และไม่อนุมานความเร่งด่วนหรือความสำคัญจากชื่อ หมวดหมู่ หรือ Tag เพียงอย่างเดียว","sources":["mr-zettascale/lab/src/mr_zettascale_data/priority.py"],"reviewedAt":"2026-10-02"},
  // ── 1. Identity / ภาพรวมของ T.i.M.E.S. ────────────────────────────────
  { keywords: ["t.i.m.e.s ย่อมาจากอะไร", "t.i.m.e.s. ย่อมาจากอะไร", "times ย่อมาจากอะไร", "times ย่อมาจาก", "ชื่อเต็ม t.i.m.e.s", "ชื่อเต็ม times"], answer: "T.i.M.E.S. ย่อมาจาก “Task Interactive & Management Efficiency Intelligent System” ครับ เป็นระบบที่มุ่งช่วยให้ผู้ใช้จัดการงานและเวลาได้อย่างมีประสิทธิภาพ โดยมี Timeline เป็นภาพรวมให้เห็นกิจกรรมและสิ่งที่ต้องติดตามอย่างชัดเจน" },

  // ── 2. สร้างกิจกรรม: เหตุผลของข้อมูลที่จำเป็น ──────────────────────────
  { keywords: ["ทำไมชื่อกิจกรรม", "ชื่อกิจกรรมสำคัญ", "ตั้งชื่อกิจกรรม", "ไม่แน่ใจชื่อกิจกรรม"], answer: "ชื่อกิจกรรมคือข้อมูลขั้นต่ำที่ทำให้ระบบและผู้ใช้รู้ว่าบล็อกเวลานี้มีไว้ทำอะไรครับ ถ้าไม่มีชื่อ MR.Zettascale ไม่ควรเดาว่าต้องสร้างกิจกรรมอะไร จึงยังสร้างร่างที่ตรวจสอบได้ไม่ได้ เลือกชื่อสั้น ๆ ที่บอกการกระทำได้ เช่น “ทำการบ้าน”, “ประชุมทีม” หรือ “ออกกำลังกาย” ก็เพียงพอครับ" },
  { keywords: ["ทำไมต้องระบุวัน", "ไม่แน่ใจวัน", "แก้วันของกิจกรรม"], answer: "วันช่วยระบุตำแหน่งของกิจกรรมบน Week Spine ครับ ถ้ายังไม่แน่ใจ สามารถเลือกวันที่ใกล้ที่สุดไว้ก่อนแล้วแก้ภายหลังได้ การเลือกวันตอนสร้างช่วยให้ร่างกิจกรรมมีจุดเริ่มต้นที่ชัดเจนและลดความสับสนกับกิจกรรมวันอื่น" },
  { keywords: ["ทำไมต้องระบุเวลาเริ่ม", "ไม่แน่ใจเวลาเริ่ม", "แก้เวลาเริ่ม"], answer: "เวลาเริ่มทำให้กิจกรรมวางลงบนตารางรายวันได้ตรงตำแหน่งครับ ถ้ายังไม่แน่ใจ ให้เลือกช่วงเวลาคร่าว ๆ ก่อน แล้วลากหรือแก้ไขเวลาใน Activity Mode ภายหลังได้ การระบุเวลาเริ่มช่วยให้เห็นกิจกรรมที่อาจชนกันได้ง่ายขึ้น" },
  { keywords: ["ทำไมต้องระบุระยะเวลา", "ไม่แน่ใจว่าจะใช้เวลา", "ปรับระยะเวลาภายหลัง"], answer: "ระยะเวลาบอกเวลาสิ้นสุดของกิจกรรม เพื่อให้เห็นว่าบล็อกเวลายาวแค่ไหนและมีโอกาสทับกับกิจกรรมอื่นหรือไม่ครับ ถ้ายังไม่แน่ใจ ให้เลือกระยะเวลาประมาณการก่อน แล้วปรับด้วยการแก้ไขหรือลากขอบล่างของกิจกรรมภายหลังได้" },

  // ── 3. แผนที่ฟีเจอร์: คำตอบภาพรวมและคำถามต่อยอด ───────────────────────
  { keywords: ["t.i.m.e.s. มีฟีเจอร์", "times มีฟีเจอร์"], answer: "T.i.M.E.S. มีฟีเจอร์หลักเพื่อจัดการเวลาเป็นระบบครับ แบ่งเป็น 3 กลุ่ม: ฟีเจอร์วางแผนกิจกรรมบนตาราง, ฟีเจอร์ Reminder และการแจ้งเตือน, และฟีเจอร์การเชื่อมต่อกับ Google Calendar, Telegram รวมถึงการตั้งค่าส่วนตัว แต่ละกลุ่มมีเครื่องมือย่อยให้เลือกดูต่อได้" },
  { keywords: ["ฟีเจอร์วางแผนกิจกรรม"], answer: "ฟีเจอร์วางแผนกิจกรรมอยู่ใน Activity Mode ครับ ใช้ Week Spine และ Cycle เพื่อดูตาราง, เพิ่มหรือแก้ไขกิจกรรมผ่าน Activity Popup, ลากย้าย ปรับเวลา ทำสำเนา และล็อกกิจกรรมได้ รวมถึงใช้กิจกรรมทั้งวัน หมวดหมู่ และ Tag เพื่อจัดระเบียบแผน" },
  { keywords: ["ฟีเจอร์ reminder และการแจ้งเตือน"], answer: "กลุ่ม Reminder และการแจ้งเตือนช่วยติดตามสิ่งที่ต้องทำแยกจากตารางกิจกรรมครับ เลือก Reminder ได้หลายประเภท ตั้ง Buffer ก่อนหรือหลัง Reminder บางชนิด และเชื่อม Telegram เพื่อรับการแจ้งเตือนโดยควบคุมการเปิด/ปิดแยกตามอุปกรณ์" },
  { keywords: ["ฟีเจอร์การเชื่อมต่อและการตั้งค่า"], answer: "กลุ่มการเชื่อมต่อและการตั้งค่าช่วยให้ใช้ T.i.M.E.S. กับหลายอุปกรณ์ได้ครับ เชื่อม Google Calendar ผ่าน OAuth, ซิงก์ข้อมูลหลักผ่าน Firestore สำหรับบัญชีเดียวกัน, เชื่อม Telegram สำหรับการแจ้งเตือน และปรับธีมกับภาษาของหน้าจอได้" },
  { keywords: ["week spine และ cycle ใช้", "week spine และ cycle คือ"], answer: "Week Spine ใช้ดูและแก้ไขตารางกิจกรรมรายสัปดาห์ตามวันและเวลา ส่วน Cycle ใช้ดูภาพรวมแบบ 4 สัปดาห์เพื่อวางแผนระยะยาวครับ เลือกสัปดาห์จาก Cycle แล้วเปิดกลับไปแก้ไขในมุมมองรายสัปดาห์ได้" },
  { keywords: ["ย้าย ปรับเวลา และทำสำเนา", "ทำสำเนากิจกรรมอย่างไร"], answer: "ใน Activity Mode คุณลากกิจกรรมเพื่อย้ายวันหรือเวลา ลากขอบล่างเพื่อปรับเวลาสิ้นสุด และใช้คำสั่งทำสำเนาเพื่อสร้างบล็อกใหม่ก่อนวางตำแหน่งที่ต้องการได้ครับ กิจกรรมที่ล็อกไว้จะป้องกันการแก้ไขโดยไม่ตั้งใจ" },
  { keywords: ["กิจกรรมทั้งวัน หมวดหมู่ และ tag"], answer: "กิจกรรมทั้งวันครอบคลุมเวลา 00:00 ถึง 00:00 ของวันถัดไปและยังจัดการบน Week Spine ได้ตามปกติครับ Category คือกลุ่มสีหลักของกิจกรรม ส่วน Tag คือป้ายกำกับหลายอันที่ช่วยบอกบริบทเพิ่มเติม" },
  { keywords: ["telegram แจ้งเตือนแยกตามอุปกรณ์"], answer: "หลังเชื่อม Telegram แล้ว คุณเปิดหรือปิดการแจ้งเตือนแยกตามอุปกรณ์ได้ครับ จึงใช้คอมพิวเตอร์หลักแก้ข้อมูล และให้อีกอุปกรณ์ที่เปิดเว็บค้างไว้ทำหน้าที่เฝ้าการแจ้งเตือนได้ โดยลดโอกาสเกิดข้อความซ้ำ" },
  { keywords: ["google calendar เชื่อมต่ออย่างไร"], answer: "เชื่อม Google Calendar จากหน้าจอเชื่อมต่อปฏิทินของ T.i.M.E.S. แล้วอนุญาตสิทธิ์ผ่าน Google OAuth ครับ backend เก็บ Refresh Token แบบเข้ารหัสเพื่อขอ Access Token ใหม่อัตโนมัติ หากถอนสิทธิ์หรือ token ใช้ไม่ได้ ระบบจะให้เชื่อมต่อใหม่" },
  { keywords: ["ตั้งค่าธีมและภาษา"], answer: "T.i.M.E.S. มีการตั้งค่าสำหรับเปลี่ยนธีมสว่างหรือมืด และเลือกภาษาของ UI ได้ครับ การตั้งค่าเหล่านี้ช่วยให้การอ่านตารางและการใช้งานเหมาะกับความต้องการของแต่ละคน" },

  // ── 4. Activity Mode / Week Spine / Activity Popup ────────────────────
  { keywords: ["activity mode คืออะไร"], answer: "Activity Mode คือพื้นที่วางแผนกิจกรรมจริงบนตารางเวลา คุณสร้างและแก้ไขบล็อกกิจกรรมที่มีวัน เวลาเริ่ม และเวลาสิ้นสุดได้ จากนั้นดูภาพรวมผ่าน Week Spine หรือ Cycle ครับ กิจกรรมสามารถใช้หมวดหมู่และ Tag, วางทับกันได้ตามข้อจำกัดของมุมมอง, และเปิด Activity Popup เพื่อแก้ไขรายละเอียดทั้งหมด" },

  // ── 5. Reminder Mode / Buffer / notification quota ────────────────────
  { keywords: ["reminder mode คืออะไร"], answer: "Reminder Mode คือพื้นที่ติดตามสิ่งที่ต้องแจ้งเตือนหรือเช็กสถานะ ซึ่งแยกจากกิจกรรมที่วางบนตารางครับ เลือกประเภท Reminder ได้ตามลักษณะงาน เช่น ครั้งเดียว รายสัปดาห์ Routine, Interval, Countdown และ Stopwatch รวมถึงตั้ง Buffer และควบคุมโควต้าการแจ้งเตือนรายวัน" },

  // ── 6. ข้อมูล การซิงก์ Google Calendar และหลายอุปกรณ์ ────────────────
  { keywords: ["การซิงก์ข้อมูลและ google calendar"], answer: "T.i.M.E.S. เก็บข้อมูลหลักของบัญชีไว้ใน Firestore เพื่อให้การเพิ่ม แก้ไข และลบสะท้อนไปยังอุปกรณ์ที่ออนไลน์บัญชีเดียวกันได้ ส่วน Google Calendar เป็นการเชื่อมต่อเพิ่มเติมผ่าน OAuth โดยใช้ Refresh Token ที่เข้ารหัสเพื่อขอสิทธิ์ใช้งานใหม่อัตโนมัติ" },

  // ── 7. Activity: รายละเอียดการใช้งานและกรณีพิเศษ ─────────────────────
  { keywords: ["กิจกรรมที่เวลาเหลื่อมกัน", "กิจกรรมเวลาเดียวกัน", "กิจกรรมชนกัน"], answer: "กิจกรรมสามารถใช้ช่วงเวลาเดียวกันได้ครับ Week Spine แสดงกิจกรรมที่เหลื่อมกันได้สูงสุด 3 รายการพร้อมกัน เพื่อให้ยังอ่านตารางได้ หากกำลังปรับเวลาและขอบไปตรงกับกิจกรรมในแถวสัปดาห์ ระบบจะแสดงเอฟเฟกต์เรืองแสงช่วยสังเกต" },

  // ── 8. Reminder: ประเภท Buffer และขีดจำกัด ────────────────────────────
  { keywords: ["reminder มีประเภท", "ประเภท reminder"], answer: "Reminder ที่ใช้หลัก ๆ มีแบบครั้งเดียว (one-time), รายสัปดาห์, Routine/checklist routine, Interval, Countdown และ Stopwatch ครับ เลือกประเภทตามรูปแบบเวลาที่ต้องติดตาม และ Reminder ที่พักหรือทำเสร็จแล้วจะไม่แสดงบน Timeline" },
  { keywords: ["buffer ของ reminder", "buffer ทำงาน"], answer: "Buffer เป็นช่วงชั่วคราวที่ต่อจาก Reminder หลักสำหรับ Reminder แบบครั้งเดียวหรือรายสัปดาห์ได้ครับ ตั้ง Countdown ก่อนเวลา Reminder และ/หรือ Stopwatch หลังเวลา Reminder ได้ Buffer ไม่ใช่เอกสารถาวรแยกอีกใบ และแจ้งเตือนตามกติกาปกติโดยนับรวมในโควต้ารายวัน" },
  { keywords: ["โควต้าการแจ้งเตือน", "quota การแจ้งเตือน"], answer: "ระบบนับจำนวนการแจ้งเตือนรวมของ Reminder, Activity ที่แจ้งเตือนได้ และ Buffer ที่ทำงานอยู่ เพื่อคุมขีดจำกัดรายวันครับ หากถึงโควต้า ระบบไม่ควรสัญญาว่าจะแจ้งเตือนเพิ่ม และอุปกรณ์ที่ทำหน้าที่เฝ้าการแจ้งเตือนต้องออนไลน์และได้รับข้อมูลล่าสุด" },

  // ── 9. Data, Firestore และ Google OAuth ───────────────────────────────
  { keywords: ["firestore เก็บข้อมูล"], answer: "Firestore เก็บข้อมูลหลักของผู้ใช้โดยแยกตาม Firebase UID เช่น Reminder, ข้อมูล Activity Mode ที่เกี่ยวข้อง, หมวดหมู่, Tag และสถานะส่วนตัวที่จำเป็นครับ ส่วนประวัติแชต MR.Zettascale เก็บใน Local Storage ของเบราว์เซอร์ ไม่ถูกส่งขึ้น Firestore" },
  { keywords: ["ข้อมูลซิงก์ข้ามอุปกรณ์"], answer: "เมื่ออุปกรณ์ลงชื่อเข้าใช้บัญชีเดียวกันและออนไลน์ การเพิ่ม แก้ไข หรือลบข้อมูลหลักจะซิงก์ผ่าน Firestore ได้ครับ แต่ไม่รับประกันทันทีหากอีกอุปกรณ์ออฟไลน์ หลับ หรือยังไม่ได้รีเฟรชข้อมูล และประวัติแชตของ MR.Zettascale ไม่ซิงก์ข้ามเครื่อง" },
  { keywords: ["refresh token ช่วยอะไร"], answer: "Refresh Token ช่วยให้ backend ขอ Access Token ใหม่จาก Google ได้อัตโนมัติหลัง Access Token หมดอายุ จึงไม่ควรต้องให้ผู้ใช้เชื่อม Google Calendar ใหม่ทุกชั่วโมงครับ Token นี้ถูกเก็บแบบเข้ารหัส และหากถอนสิทธิ์หรือ Google ปฏิเสธ token ต้องเชื่อมต่อใหม่" },

  // ── 10. Activity editor, categories, tags และ AI quota ────────────────
  { keywords: ["activity popup", "ฟอร์มกิจกรรม", "แก้ไขอะไรได้บ้าง"], answer: "Activity Popup คือฟอร์มเต็มสำหรับตรวจและแก้ไขกิจกรรมครับ ปรับชื่อ วันและเวลาเริ่ม–สิ้นสุด กิจกรรมทั้งวัน หมวดหมู่ Tag โน้ต และการทำซ้ำได้ ก่อนกดบันทึกลงปฏิทิน" },
  { keywords: ["category กับ tag", "category และ tag", "หมวดหมู่กับ tag", "tag ช่วยอะไร"], answer: "Category คือกลุ่มหลักที่มีสีเพื่ออ่านตาราง เช่น งานหรือสุขภาพ และเลือกได้หนึ่งกลุ่มต่อกิจกรรมครับ ส่วน Tag เป็นป้ายกำกับอิสระที่ใส่ได้หลายอันเพื่อเพิ่มบริบท เช่น #morning หรือ #สำคัญ" },
  { keywords: ["week spine", "cycle คืออะไร", "week spine และ cycle"], answer: "Week Spine คือมุมมองตารางกิจกรรมรายสัปดาห์ตามวันและเวลา ส่วน Cycle คือภาพรวมแบบอ่านอย่างเดียวที่รวม 4 สัปดาห์ เพื่อให้เห็นแผนระยะยาวก่อนเลือกสัปดาห์หนึ่งกลับไปแก้ไขครับ" },
  { keywords: ["ai quota", "โควต้า ai", "quota ใช้เมื่อไร", "ข้อความสำเร็จรูปต่าง", "คุย ai ต่าง"], answer: "ปุ่มคำถามทั่วไปตอบจาก backend โดยไม่ใช้ AI quota ครับ ข้อความพิมพ์เองที่ระบบอ่านได้ครบและคำสั่งจัดตารางที่ตรงรูปแบบก็ใช้กฎของระบบ ส่วนคำขอที่ต้องใช้ Gemini ใช้โควต้าตามสิทธิ์บัญชี การสรุปร่างจาก flow ตัวเลือกอาจใช้ budget AI ของระบบหรือสรุปด้วยกฎแทน" },

  // ── 11. Fallback แบบกว้าง (ต้องอยู่ท้ายสุดเสมอ) ──────────────────────
  // คำตอบในหมวดนี้มี keyword กว้าง เช่น “ข้อมูล”, “กิจกรรม”, “reminder”
  // จึงต้องวางหลังคำตอบแบบเจาะจงทั้งหมดเพื่อไม่ให้กลบคำตอบที่แม่นกว่า.
  { keywords: ["กิจกรรมข้ามวัน", "ข้ามเที่ยงคืน", "กิจกรรมเวลาเดียวกัน", "กิจกรรมชนกัน", "ย้ายเวลาบน week spine", "ปรับเวลาสิ้นสุดด้วยการลาก"], answer: "กิจกรรมสามารถข้ามเที่ยงคืนได้ และกิจกรรมหลายรายการสามารถวางทับช่วงเวลาเดียวกันได้สูงสุด 3 รายการที่แสดงพร้อมกันบน Week Spine ครับ หลังบันทึกแล้ว คุณลากกิจกรรมเพื่อย้ายวันหรือเวลา และลากขอบล่างเพื่อปรับเวลาสิ้นสุดได้" },
  { keywords: ["กิจกรรมทั้งวันต่าง", "กิจกรรมทั้งวันทำงาน"], answer: "กิจกรรมทั้งวันยังเป็นกิจกรรมปกติ แต่ระบบกำหนดช่วงเวลาเป็น 00:00 ของวันเริ่มถึง 00:00 ของวันถัดไป จึงอยู่บน Week Spine และแก้ไขหรือย้ายวันได้เหมือนกิจกรรมทั่วไป เพียงแต่ไม่แสดงบน Reminder Timeline และไม่ส่ง Telegram notification" },
  { keywords: ["activity mode กับ reminder mode", "activity กับ reminder", "กิจกรรมกับ reminder", "ต่างกันอย่างไร", "ต่างกันยังไง"], answer: "Activity คือบล็อกเวลาที่วางลงตารางใน Activity Mode มีเวลาเริ่มและสิ้นสุดชัดเจนครับ ส่วน Reminder คือสิ่งที่ต้องติดตามหรือแจ้งเตือนใน Reminder Mode ทั้งสองส่วนแยกกันเพื่อไม่ให้ทุกกิจกรรมกลายเป็นการแจ้งเตือน แต่สามารถมองร่วมกันผ่านมุมมองเวลาได้" },
  { keywords: ["google calendar", "ปฏิทิน google", "oauth", "refresh token", "access token", "เชื่อม google"], answer: "T.i.M.E.S. เชื่อม Google Calendar ผ่านสิทธิ์ Google OAuth ของผู้ใช้ครับ backend เก็บ Refresh Token แบบเข้ารหัสเพื่อขอ Access Token ใหม่อัตโนมัติ จึงไม่ควรต้องเชื่อมใหม่ทุกชั่วโมง แต่ถ้าถอนสิทธิ์หรือ token ใช้ไม่ได้ ต้องเชื่อมต่อใหม่ การเชื่อมต่อนี้เป็นทางเลือก แอปยังใช้งานได้โดยไม่เชื่อมครับ" },
  { keywords: ["telegram", "การแจ้งเตือน", "แจ้งเตือน", "notification", "noti", "mr.zettascale bot"], answer: "T.i.M.E.S. ส่งการแจ้งเตือนผ่านบอท MR.Zettascale ใน Telegram ได้หลังเชื่อมต่อแล้ว และเปิด/ปิดการแจ้งเตือนแยกตามอุปกรณ์ได้ครับ ระบบนับจำนวนแจ้งเตือนรวมเพื่อควบคุมโควต้ารายวัน อุปกรณ์ที่เฝ้าการแจ้งเตือนต้องออนไลน์ ไม่หลับ และได้รับข้อมูลล่าสุดจึงจะทำงานได้ตามเวลา" },
  { keywords: ["reminder", "buffer", "countdown", "stopwatch", "routine", "interval", "weekly", "one-time", "ครั้งเดียว"], answer: "Reminder Mode แยก Reminder ออกจากกิจกรรมในตาราง รองรับแบบครั้งเดียว รายสัปดาห์ Routine, Interval, Countdown และ Stopwatch ครับ Reminder ที่ active จะแสดงบน Timeline ส่วนที่พักหรือทำเสร็จแล้วจะไม่แสดง Buffer ของ Reminder แบบรายสัปดาห์หรือครั้งเดียวสามารถสร้าง Countdown ชั่วคราวก่อน และ Stopwatch ชั่วคราวหลัง Reminder หลักได้" },
  { keywords: ["sync", "ซิงก์", "firestore", "firebase", "ข้อมูล", "local storage", "privacy", "ส่วนตัว", "เก็บข้อมูล"], answer: "ข้อมูลหลักของผู้ใช้ถูกแยกตาม Firebase UID และเก็บใน Firestore จึงซิงก์การเพิ่ม แก้ไข และลบระหว่างอุปกรณ์ที่ลงชื่อเข้าใช้บัญชีเดียวกันเมื่อออนไลน์ได้ครับ แต่ประวัติแชต MR.Zettascale, สาขาที่เลือก และร่างที่ค้างอยู่ เก็บเฉพาะ Local Storage ของเบราว์เซอร์เครื่องนั้น ไม่ใช้ cloud และไม่ไปโผล่อีกอุปกรณ์" },
  { keywords: ["activity mode", "week spine", "cycle", "กิจกรรม", "กิจกรรมทั้งวัน", "all-day", "ตาราง"], answer: "Activity Mode ใช้วางกิจกรรมตามวันและเวลาบน Week Spine ครับ เพิ่ม แก้ไข ลากย้าย ปรับเวลา ทำสำเนา ล็อก และจัดหมวดหมู่หรือ Tag ได้ มีทั้งมุมมองรายสัปดาห์และ Cycle 4 สัปดาห์ กิจกรรมทั้งวันยังเป็นกิจกรรมปกติที่ยาว 00:00 ถึง 00:00 วันถัดไป แต่จะไม่แสดงบน Reminder Timeline และไม่แจ้ง Telegram" },
  { keywords: ["mr.zettascale", "ผู้ช่วย", "ai ทำอะไร", "ai ช่วยอะไร"], answer: "ผู้ช่วยร่างกิจกรรม หาเวลาว่าง วางแผนหลายงาน และแบ่งช่วงโฟกัส 90 นาทีพร้อมพัก 15 นาทีได้ครับ คุณตรวจแก้ก่อนบันทึกกิจกรรมเดี่ยวหรือยืนยันแผนหลายรายการ คำถามทั่วไปตอบจาก backend และมี Settings สำหรับค่าเริ่มต้นที่คุณเลือกอนุมัติเอง" },
  { keywords: ["times คืออะไร", "t.i.m.e.s คืออะไร", "t.i.m.e.s. คืออะไร", "แอปนี้", "โปรแกรมนี้"], answer: "T.i.M.E.S. ย่อมาจาก “Task Interactive & Management Efficiency Intelligent System” เป็นระบบจัดการและวางแผนเวลาที่ช่วยให้คุณจัดการ Task, Activity และเวลาในชีวิตประจำวันครับ ไม่ได้ทำหน้าที่เป็นเพียงปฏิทิน แต่เชื่อมโยงการวางแผนกิจกรรม การแจ้งเตือน และการจัดการเวลาเข้าด้วยกัน\n\nภายในมี Activity Mode สำหรับวางแผนกิจกรรมตามช่วงเวลา และ Reminder Mode สำหรับติดตามหรือแจ้งเตือนสิ่งที่ต้องทำ เชื่อมต่อ Google Calendar เพื่อจัดการกิจกรรม และเชื่อม Telegram เพื่อรับการแจ้งเตือนได้\n\nข้อมูลหลักแยกตามบัญชีผู้ใช้ใน Firestore จึงซิงก์การเพิ่ม แก้ไข และลบไปยังอุปกรณ์ที่ลงชื่อเข้าใช้บัญชีเดียวกันเมื่อออนไลน์ ส่วนประวัติแชต MR.Zettascale และร่างที่ยังไม่ยืนยันจะเก็บในเบราว์เซอร์ของเครื่องนั้นเพื่อไม่ใช้ cloud โดยไม่จำเป็น\n\nMR.Zettascale ช่วยทำความเข้าใจคำขอและเปลี่ยนให้เป็นแผนที่คุณตรวจสอบ แก้ไข และยืนยันก่อนนำไปใช้จริง เป้าหมายของ T.i.M.E.S. คือช่วยให้คุณไม่ได้เพียง “บันทึกว่าเวลาจะทำอะไร” แต่สามารถมองเห็น เข้าใจ และจัดการเวลาของตัวเองได้อย่างเป็นระบบ\n\nหากต้องการดูรายละเอียดต่อ เลือกหัวข้อ Activity Mode, Reminder Mode หรือการซิงก์ข้อมูลและ Google Calendar ได้เลยครับ" }
];

function answerTimesQuestion(input) {
  const text = String(input || "").toLowerCase().trim();
  const exact = TOPICS.find((topic) => topic.question?.toLowerCase().replace(/\?$/, "") === text.replace(/\?$/, ""));
  if (exact) return exact.answer;
  if (!text || /สร้าง|เพิ่ม|นัดหมาย|วางกิจกรรม|กำหนดเวลา/.test(text)) return null;
  const topic = TOPICS.find(({ keywords }) => keywords.some((keyword) => text.includes(keyword)));
  return topic?.answer || null;
}

module.exports = { TEXT, answerTimesQuestion, TOPICS };
