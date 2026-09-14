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
    prompt: "T.i.M.E.S. เป็นแอปวางแผนเวลา ที่รวมกิจกรรม ตารางรายสัปดาห์ Reminder และการแจ้งเตือนไว้ในที่เดียว อยากดูส่วนไหนต่อครับ?",
    options: [
      { id: "about-activity", label: "Activity Mode", kind: "branch", next: "about-times.activity" },
      { id: "about-reminder", label: "Reminder Mode", kind: "branch", next: "about-times.reminder" },
      { id: "about-notifications", label: "การแจ้งเตือน", kind: "branch", next: "about-times.notifications" },
      { id: "about-home", label: "กลับหน้าหลัก", kind: "home" }
    ]
  },
  "about-times.activity": {
    prompt: "Activity Mode ใช้วางกิจกรรมบน Week Spine เพื่อเห็นภาพวัน สัปดาห์ และ Cycle ได้ชัดเจน คุณเพิ่ม แก้ไข ลากย้าย ปรับเวลา จัดหมวดหมู่ และเชื่อม Google Calendar ได้ครับ",
    options: [
      { id: "activity-create", label: "เริ่มสร้างกิจกรรม", kind: "start", next: "activity.title" },
      { id: "activity-about", label: "T.i.M.E.S. คืออะไร", kind: "branch", next: "about-times" },
      { id: "activity-home", label: "กลับหน้าหลัก", kind: "home" }
    ]
  },
  "about-times.reminder": {
    prompt: "Reminder Mode ใช้ติดตาม Reminder ที่กำลังทำงาน แยกตามสถานะ และแสดงบน Timeline เพื่อดูสิ่งที่กำลังจะถึงเวลาได้รวดเร็วครับ",
    options: [
      { id: "reminder-activity", label: "ดู Activity Mode", kind: "branch", next: "about-times.activity" },
      { id: "reminder-notifications", label: "ดูการแจ้งเตือน", kind: "branch", next: "about-times.notifications" },
      { id: "reminder-home", label: "กลับหน้าหลัก", kind: "home" }
    ]
  },
  "about-times.notifications": {
    prompt: "การแจ้งเตือนสามารถส่งผ่าน Telegram ได้ เมื่อเปิดระบบแจ้งเตือนของอุปกรณ์นั้นไว้ เพื่อให้แยกอุปกรณ์ที่ใช้จัดการข้อมูลออกจากอุปกรณ์ที่ใช้เฝ้าการแจ้งเตือนได้ครับ",
    options: [
      { id: "notifications-reminder", label: "ดู Reminder Mode", kind: "branch", next: "about-times.reminder" },
      { id: "notifications-activity", label: "ดู Activity Mode", kind: "branch", next: "about-times.activity" },
      { id: "notifications-home", label: "กลับหน้าหลัก", kind: "home" }
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

export function getActivityAssistantConversationNode(nodeId) {
  return ACTIVITY_ASSISTANT_CONVERSATION_TREE[nodeId] || ACTIVITY_ASSISTANT_CONVERSATION_TREE.home;
}
