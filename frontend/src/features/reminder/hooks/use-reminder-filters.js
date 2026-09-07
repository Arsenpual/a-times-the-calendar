import { useState } from "react";

// One filter state feeds both the list and timeline.
export function useReminderFilters(reminders) {
  const [reminderStatusTab, setReminderStatusTab] = useState("enabled");

  // ตัวกรองประเภทใน left nav (migration plan v2 เฟส 2) — null = ไม่กรอง
  // (แสดงทุกประเภท) client-side ล้วนๆ ไม่กระทบ backend หรือ query ใด ๆ
  const [activeTypeFilter, setActiveTypeFilter] = useState(null);
  const toggleTypeFilter = (type) => {
    setActiveTypeFilter((prev) => (prev === type ? null : type));
  };

  // ตัวกรองกลุ่ม/โปรเจกต์ (migration plan v2 เฟส 3) — ทำงานคู่ขนานกับ
  // activeTypeFilter (AND กัน ถ้าเปิดทั้งคู่พร้อมกัน) client-side เช่นกัน
  const [activeGroupFilter, setActiveGroupFilter] = useState(null);
  const toggleGroupFilter = (groupId) => {
    setActiveGroupFilter((prev) => (prev === groupId ? null : groupId));
  };


  const enabledReminders = reminders.filter((r) => r.enabled && !r.completedAt);
  const pausedReminders = reminders.filter((r) => !r.enabled && !r.completedAt);
  const completedReminders = reminders.filter((r) => !!r.completedAt);
  const filterByType = (list) => (activeTypeFilter ? list.filter((r) => r.type === activeTypeFilter) : list);
  const filterByGroup = (list) => (activeGroupFilter ? list.filter((r) => r.groupId === activeGroupFilter) : list);
  const applyFilters = (list) => filterByGroup(filterByType(list));
  const visibleEnabledReminders = applyFilters(enabledReminders);
  const visiblePausedReminders = applyFilters(pausedReminders);
  const visibleCompletedReminders = applyFilters(completedReminders);


return { reminderStatusTab, setReminderStatusTab, activeTypeFilter, setActiveTypeFilter, activeGroupFilter, setActiveGroupFilter, toggleTypeFilter, toggleGroupFilter, enabledReminders, pausedReminders, completedReminders, visibleEnabledReminders, visiblePausedReminders, visibleCompletedReminders };
}

