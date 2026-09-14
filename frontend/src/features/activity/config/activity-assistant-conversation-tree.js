// This is deliberately data, not JSX. New template-chat branches can be added
// without turning ActivityAiAssistant into a long chain of conditions.
// `available: false` keeps a planned branch out of the UI until it is built.
export const ACTIVITY_ASSISTANT_CONVERSATION_TREE = {
  home: {
    options: [
      { id: "create-activity", label: "สร้างกิจกรรม", kind: "start", next: "activity.title" },
      { id: "about-times", label: "T.i.M.E.S. คืออะไร", kind: "branch", next: "about-times", available: false },
      { id: "about-assistant", label: "MR.Zettascale ทำอะไรได้บ้าง", kind: "branch", next: "about-assistant", available: false }
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
      { id: "180m", label: "3 ชั่วโมง", value: 180, complete: true }
    ]
  }
};

export function getActivityAssistantConversationNode(nodeId) {
  return ACTIVITY_ASSISTANT_CONVERSATION_TREE[nodeId] || ACTIVITY_ASSISTANT_CONVERSATION_TREE.home;
}
