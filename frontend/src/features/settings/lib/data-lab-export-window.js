const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_DATA_LAB_EXPORT_DAYS = 31;

function parseDate(value) {
  if (!DATE_RE.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function defaultDataLabExportWindow(reference = new Date()) {
  const start = new Date(Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate()));
  const end = new Date(start.getTime() + 7 * DAY_MS);
  return { windowStart: start.toISOString().slice(0, 10), windowEnd: end.toISOString().slice(0, 10) };
}

export function validateDataLabExportWindow(windowStart, windowEnd) {
  const start = parseDate(windowStart);
  const end = parseDate(windowEnd);
  if (!start || !end) return "เลือกวันเริ่มและวันสิ้นสุดให้ถูกต้อง";
  if (end <= start) return "วันสิ้นสุดต้องอยู่หลังวันเริ่ม";
  if ((end - start) / DAY_MS > MAX_DATA_LAB_EXPORT_DAYS) return `ส่งออกได้สูงสุด ${MAX_DATA_LAB_EXPORT_DAYS} วันต่อครั้ง`;
  return "";
}

export function dataLabExportPath(windowStart, windowEnd) {
  return `/api/data-lab/activity-export?${new URLSearchParams({ windowStart, windowEnd })}`;
}
