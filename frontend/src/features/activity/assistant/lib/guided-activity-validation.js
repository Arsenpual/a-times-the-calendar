export function isGuidedActivityFieldComplete(field, value) {
  if (field === "title") {
    const title = String(value || "").trim();
    return title.length > 0 && title.length <= 120;
  }
  if (field === "time") return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
  if (field === "durationMinutes") {
    const duration = Number(value);
    return value !== "" && value != null && Number.isInteger(duration) && duration >= 30 && duration <= 720;
  }
  if (field !== "date") return false;
  const date = String(value || "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function validateGuidedActivity(values) {
  if (!isGuidedActivityFieldComplete("date", values?.date)) return "กรุณาเลือกวันที่ให้ถูกต้อง";
  if (!isGuidedActivityFieldComplete("title", values?.title)) return "กรุณาระบุชื่อกิจกรรมไม่เกิน 120 ตัวอักษร";
  if (!isGuidedActivityFieldComplete("time", values?.time)) return "กรุณาเลือกเวลาเริ่มให้ถูกต้อง";
  if (!isGuidedActivityFieldComplete("durationMinutes", values?.durationMinutes)) return "ระยะเวลาต้องอยู่ระหว่าง 30 ถึง 720 นาที";
  return "";
}
