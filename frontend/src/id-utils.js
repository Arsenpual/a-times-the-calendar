// Google Calendar ส่ง instance id ของ recurring event มาในรูป
// "<baseId>_<YYYYMMDDTHHmmssZ>" เมื่อใช้ singleEvents=true — แต่ทุกที่ที่เก็บ
// ข้อมูลผูกกับกิจกรรม (activityCategoryMap, lockedActivities ทั้งฝั่ง local
// state และ backend) ใช้ base id เท่านั้น ต้อง normalize ก่อน lookup/write
// เสมอ มิฉะนั้นกิจกรรมที่ทำซ้ำจะหาหมวดหมู่/lock ไม่เจอ
//
// เดิม logic นี้ถูก copy-paste ซ้ำใน activity-categories.js, summary.js,
// activity-colors.js, timeline-editor.jsx — รวมเป็นไฟล์เดียวเพื่อไม่ให้จุดใหม่
// ที่เพิ่มเข้ามาทีหลังลืม normalize (เกิดขึ้นแล้วใน activity-modal.jsx และ
// app.jsx)
export function normalizeActivityId(id) {
  if (!id) return id;
  return id.replace(/_\d{8}T\d{6}Z$/, "");
}
