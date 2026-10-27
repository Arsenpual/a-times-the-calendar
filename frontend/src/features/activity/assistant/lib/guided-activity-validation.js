export function validateGuidedActivity(values) {
  const title = String(values?.title || "").trim();
  if (!title || title.length > 120) return "กรุณาระบุชื่อกิจกรรมไม่เกิน 120 ตัวอักษร";

  const date = String(values?.date || "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return "กรุณาเลือกวันที่ให้ถูกต้อง";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day)
    return "กรุณาเลือกวันที่ให้ถูกต้อง";

  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(values?.time || ""));
  if (!time) return "กรุณาเลือกเวลาเริ่มให้ถูกต้อง";

  const duration = Number(values?.durationMinutes);
  if (!Number.isInteger(duration) || duration < 30 || duration > 720)
    return "ระยะเวลาต้องอยู่ระหว่าง 30 ถึง 720 นาที";
  return "";
}
