// This is deliberately data, not JSX. New template-chat branches can be added
// without turning ActivityAiAssistant into a long chain of conditions.
// `available: false` keeps a planned branch out of the UI until it is built.
export const ACTIVITY_ASSISTANT_CONVERSATION_TREE = {
  home: {
    prompt: "อยากให้ผมช่วยเรื่องไหนครับ?",
    options: [
      { id: "create-activity", label: "สร้างกิจกรรม", kind: "start", next: "activity.title" },
      { id: "about-times", label: "T.i.M.E.S. คืออะไร", kind: "branch", next: "about-times" },
      { id: "about-assistant", label: "MR.Zettascale ทำอะไรได้บ้าง", kind: "branch", next: "about-assistant" }
    ]
  },
  "about-times": {
    prompt: "T.i.M.E.S. เป็นแอปวางแผนเวลาส่วนตัว ที่แยกการจัดตารางกิจกรรมออกจาก Reminder แล้วเชื่อมทั้งสองส่วนเข้ากับมุมมองเวลาเดียวกัน คุณวางกิจกรรมเป็นสัปดาห์หรือ Cycle ติดตามสิ่งที่ต้องทำ ตั้งการแจ้งเตือน และเลือกเชื่อม Google Calendar หรือ Telegram ได้ตามต้องการครับ อยากดูส่วนไหนต่อ?",
    options: [
      { id: "about-activity", label: "Activity Mode", kind: "branch", next: "about-times.activity" },
      { id: "about-reminder", label: "Reminder Mode", kind: "branch", next: "about-times.reminder" },
      { id: "about-calendar", label: "Google Calendar", kind: "branch", next: "about-times.calendar" },
      { id: "about-notifications", label: "การแจ้งเตือนและ Telegram", kind: "branch", next: "about-times.notifications" },
      { id: "about-data", label: "ข้อมูลและการซิงก์", kind: "branch", next: "about-times.data" },
      { id: "about-home", label: "กลับหน้าหลัก", kind: "home" }
    ]
  },
  "about-times.activity": {
    prompt: "Activity Mode คือพื้นที่วางตารางจริงบน Week Spine: คุณเห็นกิจกรรมตามวันและเวลา เพิ่ม แก้ไข ลากย้าย ปรับช่วงเวลา ทำสำเนา ล็อกกิจกรรม และใช้หมวดหมู่กับ Tag เพื่ออ่านตารางได้ง่ายขึ้น มุมมองมีทั้งรายสัปดาห์และ Cycle 4 สัปดาห์ พร้อมสรุปกิจกรรมตามช่วงที่เลือกครับ",
    options: [
      { id: "activity-create", label: "เริ่มสร้างกิจกรรม", kind: "start", next: "activity.title" },
      { id: "activity-calendar", label: "ดู Google Calendar", kind: "branch", next: "about-times.calendar" },
      { id: "activity-data", label: "ดูข้อมูลและการซิงก์", kind: "branch", next: "about-times.data" },
      { id: "activity-home", label: "กลับหน้าหลัก", kind: "home" }
    ]
  },
  "about-times.reminder": {
    prompt: "Reminder Mode ใช้จัดการสิ่งที่ต้องติดตามแยกจากกิจกรรมในตาราง เช่น แบบครั้งเดียว รายสัปดาห์ Routine, Countdown และ Stopwatch ระบบแสดงเฉพาะ Reminder ที่เปิดใช้งานบน Timeline จัดกลุ่มหรือกรองตามประเภท สถานะ และเวลาที่กำลังจะถึงได้ เพื่อให้เห็นสิ่งสำคัญก่อนครับ",
    options: [
      { id: "reminder-activity", label: "ดู Activity Mode", kind: "branch", next: "about-times.activity" },
      { id: "reminder-notifications", label: "ดูการแจ้งเตือน", kind: "branch", next: "about-times.notifications" },
      { id: "reminder-data", label: "ดูข้อมูลและการซิงก์", kind: "branch", next: "about-times.data" },
      { id: "reminder-home", label: "กลับหน้าหลัก", kind: "home" }
    ]
  },
  "about-times.calendar": {
    prompt: "คุณเลือกเชื่อม Google Calendar เพื่อดึงและจัดการกิจกรรมผ่าน T.i.M.E.S. ได้ การเชื่อมต่อใช้สิทธิ์ Google OAuth ของบัญชีผู้ใช้ และ backend เก็บ Refresh Token แบบเข้ารหัสเพื่อขอ Access Token ใหม่อัตโนมัติ เมื่อสิทธิ์ถูกถอนหรือใช้ไม่ได้ ระบบจะแจ้งให้เชื่อมต่อใหม่ครับ",
    options: [
      { id: "calendar-activity", label: "ดู Activity Mode", kind: "branch", next: "about-times.activity" },
      { id: "calendar-data", label: "ดูข้อมูลและการซิงก์", kind: "branch", next: "about-times.data" },
      { id: "calendar-home", label: "กลับหน้าหลัก", kind: "home" }
    ]
  },
  "about-times.notifications": {
    prompt: "T.i.M.E.S. ส่งการแจ้งเตือนไปยัง Telegram ผ่าน MR.Zettascale ได้ คุณเลือกเปิดหรือปิดการแจ้งเตือนแยกตามอุปกรณ์ได้ จึงใช้คอมพิวเตอร์หลักเพื่อแก้ข้อมูล และเปิดอุปกรณ์อีกเครื่องไว้เฝ้าการแจ้งเตือนได้โดยลดข้อความซ้ำ ระบบนับจำนวนแจ้งเตือนเพื่อช่วยควบคุมโควต้ารายวันด้วยครับ",
    options: [
      { id: "notifications-reminder", label: "ดู Reminder Mode", kind: "branch", next: "about-times.reminder" },
      { id: "notifications-activity", label: "ดู Activity Mode", kind: "branch", next: "about-times.activity" },
      { id: "notifications-data", label: "ดูข้อมูลและการซิงก์", kind: "branch", next: "about-times.data" },
      { id: "notifications-home", label: "กลับหน้าหลัก", kind: "home" }
    ]
  },
  "about-times.data": {
    prompt: "ข้อมูลการใช้งานหลักของแต่ละคนถูกแยกตาม Firebase UID และเก็บใน Firestore เพื่อให้การเพิ่ม แก้ไข หรือลบจากเว็บหนึ่งสะท้อนไปยังเว็บหรืออุปกรณ์อื่นที่ลงชื่อเข้าใช้บัญชีเดียวกันได้ ประวัติแชตข้อความสำเร็จรูปของ MR.Zettascale เก็บใน Local Storage ของเบราว์เซอร์เท่านั้น จึงไม่เพิ่มค่า cloud และไม่ถูกส่งไป Firestore ครับ",
    options: [
      { id: "data-calendar", label: "ดู Google Calendar", kind: "branch", next: "about-times.calendar" },
      { id: "data-notifications", label: "ดูการแจ้งเตือน", kind: "branch", next: "about-times.notifications" },
      { id: "data-home", label: "กลับหน้าหลัก", kind: "home" }
    ]
  },
  "about-assistant": {
    prompt: "MR.Zettascale ช่วยสร้างกิจกรรมจากข้อความหรือข้อความสำเร็จรูป จัดร่างชื่อ วัน เวลา ระยะเวลา Tag และหมวดหมู่ให้ตรวจสอบก่อนบันทึกครับ",
    options: [
      { id: "assistant-create", label: "เริ่มสร้างกิจกรรม", kind: "start", next: "activity.title" },
      { id: "assistant-times", label: "T.i.M.E.S. คืออะไร", kind: "branch", next: "about-times" },
      { id: "assistant-home", label: "กลับหน้าหลัก", kind: "home" }
    ]
  },
  "activity.title": {
    field: "title",
    prompt: "กิจกรรมนี้ชื่ออะไรครับ? เลือกจากตัวอย่าง หรือพิมพ์รายละเอียดเองให้ AI ช่วยต่อได้เลย",
    options: [
      { id: "exercise", label: "ออกกำลังกาย", value: "ออกกำลังกาย", next: "activity.date" },
      { id: "dinner", label: "นัดทานมื้อเย็น", value: "นัดทานมื้อเย็น", next: "activity.date" },
      { id: "reading", label: "อ่านหนังสือ", value: "อ่านหนังสือ", next: "activity.date" },
      { id: "homework", label: "ทำการบ้าน", value: "ทำการบ้าน", next: "activity.date" },
      { id: "meeting", label: "ประชุม", value: "ประชุม", next: "activity.date" },
      { id: "sleep", label: "เข้านอน", value: "เข้านอน", next: "activity.date" }
    ]
  },
  "activity.date": {
    field: "date",
    prompt: "ต้องการทำกิจกรรมวันไหนครับ?",
    options: [
      { id: "today", label: "วันนี้", dateOffset: 0, next: "activity.time" },
      { id: "tomorrow", label: "พรุ่งนี้", dateOffset: 1, next: "activity.time" },
      { id: "day-after-tomorrow", label: "มะรืนนี้", dateOffset: 2, next: "activity.time" },
      { id: "three-days", label: "อีก 3 วัน", dateOffset: 3, next: "activity.time" },
      { id: "next-week", label: "สัปดาห์หน้า", dateOffset: 7, next: "activity.time" }
    ]
  },
  "activity.time": {
    field: "time",
    prompt: "ต้องการเริ่มช่วงไหนครับ?",
    options: [
      { id: "morning", label: "ช่วงเช้า · 09:00", value: "09:00", next: "activity.duration" },
      { id: "noon", label: "ช่วงเที่ยง · 12:00", value: "12:00", next: "activity.duration" },
      { id: "afternoon", label: "ช่วงบ่าย · 15:00", value: "15:00", next: "activity.duration" },
      { id: "evening", label: "ช่วงเย็น · 18:00", value: "18:00", next: "activity.duration" },
      { id: "night", label: "คืนนี้ · 20:00", value: "20:00", next: "activity.duration" },
      { id: "late-night", label: "ก่อนนอน · 22:00", value: "22:00", next: "activity.duration" }
    ]
  },
  "activity.duration": {
    field: "durationMinutes",
    prompt: "ต้องการใช้เวลานานเท่าไรครับ?",
    options: [
      { id: "30m", label: "30 นาที", value: 30, complete: true },
      { id: "60m", label: "1 ชั่วโมง", value: 60, complete: true },
      { id: "90m", label: "1 ชั่วโมง 30 นาที", value: 90, complete: true },
      { id: "120m", label: "2 ชั่วโมง", value: 120, complete: true },
      { id: "180m", label: "3 ชั่วโมง", value: 180, complete: true },
      { id: "480m", label: "8 ชั่วโมง", value: 480, complete: true }
    ]
  }
};

// These are safe, no-quota prompts. The backend answers them from its
// deterministic T.i.M.E.S. knowledge lookup before it considers Gemini.
export const ACTIVITY_ASSISTANT_SUGGESTED_QUESTIONS = [
  "T.i.M.E.S. คืออะไร?",
  "Activity Mode กับ Reminder Mode ต่างกันอย่างไร?",
  "เชื่อม Google Calendar ทำงานอย่างไร?",
  "การแจ้งเตือน Telegram ทำงานอย่างไร?",
  "ข้อมูลซิงก์ข้ามอุปกรณ์อย่างไร?"
];

export function getActivityAssistantConversationNode(nodeId) {
  return ACTIVITY_ASSISTANT_CONVERSATION_TREE[nodeId] || ACTIVITY_ASSISTANT_CONVERSATION_TREE.home;
}
