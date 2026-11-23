const { normalizeAnnouncementConfig } = require("./announcement-config.js");
const { answerTimesQuestion } = require("../skills/activity-creation/times-knowledge.js");

const GENERAL_QUESTION_BUTTONS = Object.freeze([
  ["times", "T.i.M.E.S. คืออะไร?"],
  ["features", "T.i.M.E.S. มีฟีเจอร์อะไรบ้าง?"],
  ["data-lab", "Data Lab คืออะไร?"]
]);

const PRODUCT_QUESTION_NODES = Object.freeze({
  times: {
    question: "times คืออะไร",
    buttons: [
      ["purpose", "T.i.M.E.S. ใช้ทำอะไร"],
      ["activity-reminder", "Activity กับ Reminder ต่างกันอย่างไร"],
      ["assistant", "MR.Zettascale คืออะไร"]
    ]
  },
  features: {
    question: "times มีฟีเจอร์",
    buttons: [
      ["activity", "🗓️ ฟีเจอร์ Activity Mode"],
      ["reminder", "🔔 ฟีเจอร์ Reminder Mode"],
      ["connection", "การเชื่อมต่อและการซิงก์"]
    ]
  },
  "data-lab": {
    question: "Data Lab คืออะไร?",
    buttons: [
      ["data-lab-export", "ส่งออกข้อมูล Data Lab อย่างไร?"],
      ["insight-review", "Insight Review ใช้อย่างไร?"],
      ["general-questions", "← คำถามทั่วไป"]
    ]
  },
  "data-lab-export": {
    question: "ส่งออกข้อมูล Data Lab อย่างไร?",
    buttons: [["insight-review", "Insight Review ใช้อย่างไร?"], ["data-lab", "← Data Lab"]]
  },
  "insight-review": {
    question: "Insight Review ใช้อย่างไร?",
    buttons: [["data-lab-export", "ส่งออกข้อมูล Data Lab อย่างไร?"], ["data-lab", "← Data Lab"]]
  },
  "general-questions": {
    question: "",
    buttons: GENERAL_QUESTION_BUTTONS
  },
  purpose: {
    question: "times คืออะไร",
    buttons: [
      ["activity-reminder", "Activity กับ Reminder ต่างกันอย่างไร"],
      ["features", "ดูฟีเจอร์ทั้งหมด"],
      ["assistant", "MR.Zettascale คืออะไร"]
    ]
  },
  "activity-reminder": {
    question: "activity กับ reminder",
    buttons: [
      ["activity", "ดู Activity Mode"],
      ["reminder", "ดู Reminder Mode"],
      ["times", "← กลับภาพรวม T.i.M.E.S."]
    ]
  },
  activity: {
    question: "activity mode",
    buttons: [
      ["week-spine", "Week Spine และ Cycle"],
      ["category-tag", "Category และ Tag"],
      ["features", "← ฟีเจอร์ทั้งหมด"]
    ]
  },
  reminder: {
    question: "reminder มีประเภท",
    buttons: [
      ["buffer", "Buffer ทำงานอย่างไร"],
      ["notifications", "การแจ้งเตือนและโควต้า"],
      ["features", "← ฟีเจอร์ทั้งหมด"]
    ]
  },
  connection: {
    question: "ฟีเจอร์การเชื่อมต่อและการตั้งค่า",
    buttons: [
      ["calendar", "Google Calendar"],
      ["telegram", "Telegram แจ้งเตือน"],
      ["sync", "ข้อมูลซิงก์อย่างไร"]
    ]
  },
  calendar: {
    question: "google calendar",
    buttons: [["sync", "ข้อมูลซิงก์อย่างไร"], ["connection", "← การเชื่อมต่อทั้งหมด"], ["features", "ฟีเจอร์ทั้งหมด"]]
  },
  telegram: {
    question: "telegram",
    buttons: [["notifications", "การแจ้งเตือนและโควต้า"], ["connection", "← การเชื่อมต่อทั้งหมด"], ["reminder", "ดู Reminder Mode"]]
  },
  sync: {
    question: "ข้อมูลซิงก์ข้ามอุปกรณ์",
    buttons: [["calendar", "Google Calendar"], ["telegram", "Telegram"], ["connection", "← การเชื่อมต่อทั้งหมด"]]
  },
  assistant: {
    question: "mr.zettascale",
    buttons: [["activity", "ดู Activity Mode"], ["purpose", "T.i.M.E.S. ใช้ทำอะไร"], ["times", "← กลับภาพรวม T.i.M.E.S."]]
  },
  "week-spine": {
    question: "week spine และ cycle คือ",
    buttons: [["activity", "← Activity Mode"], ["category-tag", "Category และ Tag"], ["features", "ฟีเจอร์ทั้งหมด"]]
  },
  "category-tag": {
    question: "category กับ tag",
    buttons: [["activity", "← Activity Mode"], ["week-spine", "Week Spine และ Cycle"], ["features", "ฟีเจอร์ทั้งหมด"]]
  },
  buffer: {
    question: "buffer ของ reminder",
    buttons: [["notifications", "การแจ้งเตือนและโควต้า"], ["reminder", "← Reminder Mode"], ["features", "ฟีเจอร์ทั้งหมด"]]
  },
  notifications: {
    question: "โควต้าการแจ้งเตือน",
    buttons: [["telegram", "Telegram แจ้งเตือน"], ["buffer", "Buffer ทำงานอย่างไร"], ["reminder", "← Reminder Mode"]]
  }
});

function productQuestionKeyboard(node) {
  return {
    inline_keyboard: node.buttons.map(([id, label]) => [{ text: label, callback_data: `product:${id}` }])
  };
}

function productQuestionResponse(nodeId) {
  const node = PRODUCT_QUESTION_NODES[nodeId] || PRODUCT_QUESTION_NODES.times;
  return {
    node,
    text: nodeId === "general-questions"
      ? "เลือกคำถามทั่วไปที่ต้องการได้เลยครับ"
      : answerTimesQuestion(node.question) || "ผมยังไม่มีข้อมูลยืนยันเกี่ยวกับส่วนนั้นใน T.i.M.E.S. ครับ"
  };
}

function productNodeForText(text) {
  const normalized = String(text || "").toLowerCase();
  if (/ฟีเจอร์|ทำอะไรได้บ้าง|ความสามารถ/.test(normalized)) return "features";
  if (/activity|กิจกรรม|week spine|cycle/.test(normalized)) return "activity";
  if (/reminder|buffer|countdown|stopwatch/.test(normalized)) return "reminder";
  if (/google|calendar|ปฏิทิน/.test(normalized)) return "calendar";
  if (/telegram|แจ้งเตือน|notification|noti/.test(normalized)) return "telegram";
  if (/sync|ซิงก์|firestore|firebase/.test(normalized)) return "sync";
  if (/zettascale|ผู้ช่วย|\bai\b/.test(normalized)) return "assistant";
  return "times";
}

function announcementAdminChatIds() {
  return new Set(
    String(process.env.TELEGRAM_ANNOUNCEMENT_ADMIN_CHAT_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function isAnnouncementAdmin(chatId) {
  // Fail closed: until an admin chat ID is configured, no Telegram account
  // can mutate the announcement (including the first account that links).
  return announcementAdminChatIds().has(String(chatId));
}

function announcementConfigSummary(config) {
  return "⚙️ การตั้งค่า announcement-ticker\n" +
    `สถานะ: ${config.enabled ? "เปิด" : "ปิด"}\n` +
    `แสดงซ้ำทุก: ${config.repeatIntervalMinutes} นาที\n` +
    `ค้างข้อความ: ${config.holdDurationSeconds} วินาที\n` +
    `ความเร็วเลื่อน: ${config.scrollSpeedPxPerSecond} px/s\n` +
    `เอฟเฟกต์ scramble: ${config.scrambleEnabled ? "เปิด" : "ปิด"}`;
}

function formatAnnouncementPanel(data = {}) {
  const config = normalizeAnnouncementConfig(data);
  const message = typeof data.message === "string" && data.message.trim()
    ? data.message.trim()
    : "ยังไม่มีข้อความประกาศ";
  return "📣 ตั้งค่า announcement-ticker\n\n" +
    `ข้อความ: ${message.slice(0, 180)}${message.length > 180 ? "…" : ""}\n\n` +
    announcementConfigSummary(config) + "\n\nเลือกปุ่มด้านล่างเพื่อปรับค่า";
}

function announcementInlineKeyboard(config) {
  const active = config.enabled ? "🟢 เปิดอยู่" : "⚫ ปิดอยู่";
  const scramble = config.scrambleEnabled ? "✨ เปิด" : "○ ปิด";
  return {
    inline_keyboard: [
      [{ text: `Ticker: ${active}`, callback_data: "announce:toggle" }],
      [
        { text: "− รอบ", callback_data: "announce:interval:-" },
        { text: `${config.repeatIntervalMinutes} นาที`, callback_data: "announce:status" },
        { text: "+ รอบ", callback_data: "announce:interval:+" }
      ],
      [
        { text: "− ค้าง", callback_data: "announce:hold:-" },
        { text: `${config.holdDurationSeconds} วิ`, callback_data: "announce:status" },
        { text: "+ ค้าง", callback_data: "announce:hold:+" }
      ],
      [
        { text: "ช้าลง", callback_data: "announce:speed:-" },
        { text: `ความเร็ว ${config.scrollSpeedPxPerSecond}`, callback_data: "announce:status" },
        { text: "เร็วขึ้น", callback_data: "announce:speed:+" }
      ],
      [{ text: `Scramble: ${scramble}`, callback_data: "announce:scramble" }],
      [{ text: "✏️ เปลี่ยนข้อความ", callback_data: "announce:message" }],
      [{ text: "↻ อัปเดต", callback_data: "announce:refresh" }, { text: "✕ ปิดแผง", callback_data: "announce:close" }]
    ]
  };
}

module.exports = {
  GENERAL_QUESTION_BUTTONS,
  PRODUCT_QUESTION_NODES,
  productQuestionKeyboard,
  productQuestionResponse,
  productNodeForText,
  announcementAdminChatIds,
  isAnnouncementAdmin,
  announcementConfigSummary,
  formatAnnouncementPanel,
  announcementInlineKeyboard,
};
