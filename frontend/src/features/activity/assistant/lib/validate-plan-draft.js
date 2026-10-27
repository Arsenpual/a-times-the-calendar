export function validatePlanDraft(draft) {
  const title = typeof draft?.title === "string" ? draft.title.trim() : "";
  if (!title || title.length > 200) return "ระบุชื่อกิจกรรมไม่เกิน 200 ตัวอักษร";
  const start = draft?.startLocal;
  const end = draft?.endLocal;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start || "") || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(end || "")) {
    return "ระบุวันและเวลาเริ่มกับสิ้นสุดให้ครบ";
  }
  const exactLocalTime = (value) => {
    const parsed = new Date(value);
    const actual = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}T${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
    return Number.isFinite(parsed.getTime()) && actual === value ? parsed.getTime() : NaN;
  };
  const startTime = exactLocalTime(start);
  const endTime = exactLocalTime(end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
  }
  return "";
}
