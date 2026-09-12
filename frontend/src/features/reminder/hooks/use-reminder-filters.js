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
  // Controls the visual order only. It does not change any schedule field.
  const [reminderTimeSort, setReminderTimeSort] = useState("nearest");
  const [reminderListFilter, setReminderListFilter] = useState("all");

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
  const filterByListMode = (list) => list.filter((reminder) => {
    if (reminderListFilter === "scheduled") return Number.isFinite(reminder.nextDueAt);
    if (reminderListFilter === "event-session") return Number.isInteger(reminder.eventAnchorCountdownMinutes) || Number.isInteger(reminder.eventAnchorStopwatchMinutes);
    if (reminderListFilter === "unscheduled") return !Number.isFinite(reminder.nextDueAt);
    return true;
  });
  const isReminderOnSelectedDate = (reminder) => reminderSlotsOnDate(reminder, selectedDate).length > 0;
  const applyFilters = (list) => filterByListMode(filterByGroup(filterByType(list))).filter((r) => reminderDateFilter === "all" || isReminderOnSelectedDate(r));
  const sortByDueTime = (list) => [...list].sort((left, right) => {
    const leftAt = Number.isFinite(left.nextDueAt) ? left.nextDueAt : Number.POSITIVE_INFINITY;
    const rightAt = Number.isFinite(right.nextDueAt) ? right.nextDueAt : Number.POSITIVE_INFINITY;
    return reminderTimeSort === "farthest" ? rightAt - leftAt : leftAt - rightAt;
  });
  const visibleEnabledReminders = sortByDueTime(applyFilters(enabledReminders));
  const visiblePausedReminders = sortByDueTime(applyFilters(pausedReminders));
  const visibleCompletedReminders = sortByDueTime(applyFilters(completedReminders));
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
    reminderTimeSort,
    setReminderTimeSort,
    reminderListFilter,
    setReminderListFilter,
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
