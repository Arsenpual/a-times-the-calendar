import { useState } from "react";
import { localDateKey, reminderSlotsOnDate } from "../lib/reminder-date-view.js";

// One filter state feeds both the list and timeline.
export function useReminderFilters(reminders) {
  // Explicit names keep the two primary date filters distinguishable from
  // the status/type/group filters used by the rest of Reminder Mode.
  const [reminderDateFilter, setReminderDateFilter] = useState("all");
  const [pickedDate, setPickedDate] = useState(localDateKey);
  const selectedDateKey = reminderDateFilter === "date" ? pickedDate : localDateKey();
  const selectedDate = new Date(selectedDateKey + "T00:00:00");
  const todayDate = new Date(localDateKey() + "T00:00:00");
  const selectDate = (value) => { if (value) { setPickedDate(value); setReminderDateFilter("date"); } };
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
  const isReminderOnSelectedDate = (reminder) => reminderSlotsOnDate(reminder, selectedDate).length > 0;
  const applyFilters = (list) => filterByGroup(filterByType(list)).filter((r) => reminderDateFilter === "all" || isReminderOnSelectedDate(r));
  const visibleEnabledReminders = applyFilters(enabledReminders);
  const visiblePausedReminders = applyFilters(pausedReminders);
  const visibleCompletedReminders = applyFilters(completedReminders);
  const todayReminderCount = reminders.filter((reminder) => reminderSlotsOnDate(reminder, todayDate).length > 0).length;

  return {
    reminderDateFilter,
    setReminderDateFilter,
    selectedDateKey,
    selectedDate,
    selectDate,
    todayReminderCount,
    reminderStatusTab,
    setReminderStatusTab,
    activeTypeFilter,
    setActiveTypeFilter,
    activeGroupFilter,
    setActiveGroupFilter,
    toggleTypeFilter,
    toggleGroupFilter,
    enabledReminders,
    pausedReminders,
    completedReminders,
    visibleEnabledReminders,
    visiblePausedReminders,
    visibleCompletedReminders
  };
}
