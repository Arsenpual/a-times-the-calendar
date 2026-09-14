function fail(message) { const error = new Error(message); error.status = 400; throw error; }
function localDateTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) fail('วันเวลาต้องเป็น YYYY-MM-DDTHH:mm');
  const stamp = new Date(`${value}:00Z`);
  if (!Number.isFinite(stamp.getTime()) || stamp.toISOString().slice(0, 16) !== value) fail('วันที่หรือเวลาไม่มีอยู่จริง');
  return value;
}
function bounded(value, max, name) {
  if (typeof value !== 'string' || value.length > max) fail(`${name} ไม่ถูกต้องหรือยาวเกินกำหนด`);
  return value.trim();
}
function validateDraft(raw, categories = []) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('ไม่พบร่างกิจกรรม');
  const title = bounded(raw.title, 200, 'ชื่อกิจกรรม');
  if (!title) fail('ต้องระบุชื่อกิจกรรม');
  const startLocal = localDateTime(raw.startLocal), endLocal = localDateTime(raw.endLocal);
  if (endLocal <= startLocal) fail('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม');
  if (typeof raw.allDay !== 'boolean') fail('สถานะทั้งวันไม่ถูกต้อง');
  if (raw.allDay && (!startLocal.endsWith('T00:00') || !endLocal.endsWith('T00:00'))) fail('กิจกรรมทั้งวันต้องใช้เวลา 00:00 และวันสิ้นสุดแบบไม่รวมวันนั้น');
  const categoryName = bounded(raw.categoryName ?? '', 200, 'หมวดหมู่');
  const tags = raw.tags ?? [];
  if (!Array.isArray(tags) || tags.length > 20) fail('tag มากเกินกำหนด');
  if (raw.recurrence != null) fail('Phase 1 รองรับกิจกรรมเดี่ยวเท่านั้น');
  const assumptions = raw.assumptions ?? [];
  if (!Array.isArray(assumptions) || assumptions.length > 10) fail('ข้อมูลสันนิษฐานไม่ถูกต้อง');
  return { title, startLocal, endLocal, allDay: raw.allDay, categoryName: categories.includes(categoryName) ? categoryName : '',
    tags: [...new Set(tags.map(tag => bounded(tag, 40, 'tag')).filter(Boolean))], recurrence: null,
    notes: bounded(raw.notes ?? '', 4000, 'โน้ต'), assumptions: assumptions.map(item => bounded(item, 300, 'ข้อสันนิษฐาน')) };
}
module.exports = { validateDraft, localDateTime, bounded, fail };
