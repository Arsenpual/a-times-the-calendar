export const ACTIVITY_POPUP_ACTION_GROUPS = Object.freeze({
  frequent: { id: "frequent", label: "ใช้บ่อย" },
  manage: { id: "manage", label: "จัดการ" },
  danger: { id: "danger", label: "การดำเนินการที่ย้อนกลับไม่ได้" }
});

/**
 * Single action registry for ActivityPopup. Keeping availability, disabled
 * state and busy labels here prevents the JSX from drifting as new commands
 * are added to the popup on different surfaces.
 */
export function createActivityPopupActions({
  activity,
  locked,
  isRecurring,
  restrictedToLock,
  busyAction,
  lockFeedback,
  handlers
}) {
  const isBusy = busyAction !== null;
  const canMutate = !locked && !restrictedToLock && !isBusy;
  const canUseFullMenu = !restrictedToLock;

  return [
    {
      id: "edit",
      group: "frequent",
      label: isRecurring ? "แก้ไขกิจกรรม" : "แก้ไขทั้งหมด",
      icon: "✏",
      visible: canUseFullMenu,
      disabled: locked || isBusy,
      title: locked ? "ปลดล็อกก่อนแก้ไข" : "แก้ไขชื่อ เวลา และรายละเอียด",
      execute: handlers.edit
    },
    {
      id: "move-day",
      group: "frequent",
      label: "ย้ายวัน",
      icon: "📅",
      visible: canUseFullMenu,
      disabled: !canMutate,
      title: locked ? "ปลดล็อกก่อนย้ายวัน" : "เลือกวันที่ใหม่",
      execute: handlers.moveDay
    },
    {
      id: "duplicate",
      group: "frequent",
      label: busyAction === "duplicate" ? "กำลังทำ..." : "ทำสำเนา",
      icon: "⧉",
      visible: canUseFullMenu,
      disabled: locked || isBusy,
      title: "ทำสำเนากิจกรรมนี้ในวันเดียวกัน",
      execute: handlers.duplicate
    },
    {
      id: "unlock",
      group: "frequent",
      label: "ปลดล็อก",
      icon: lockFeedback || "🔓",
      visible: locked,
      disabled: isBusy,
      title: "ปลดล็อกกิจกรรมเพื่อใช้คำสั่งอื่น",
      execute: handlers.toggleLock
    },
    {
      id: "select-series",
      group: "frequent",
      label: "เลือกรายการ",
      icon: "✓",
      visible: canUseFullMenu && isRecurring,
      disabled: isBusy,
      title: "เปิดโหมดเลือกหลายรายการ",
      execute: handlers.selectSeries
    },
    {
      id: "move-next-day",
      group: "manage",
      label: busyAction === "move-next-day" ? "กำลังย้าย..." : "วันถัดไป",
      icon: "⏭",
      visible: canUseFullMenu,
      disabled: !canMutate,
      title: locked ? "ปลดล็อกก่อนย้ายวัน" : "ย้ายกิจกรรมไปวันถัดไป",
      execute: handlers.moveNextDay
    },
    {
      id: "open-google",
      group: "manage",
      label: "เปิดใน GCal",
      icon: "↗",
      visible: canUseFullMenu,
      disabled: !activity.htmlLink || isBusy,
      title: activity.htmlLink ? "เปิดกิจกรรมนี้ใน Google Calendar" : "กิจกรรมนี้ไม่มีลิงก์ Google Calendar",
      execute: handlers.openGoogle
    },
    {
      id: "toggle-lock",
      group: restrictedToLock ? "frequent" : "manage",
      label: "ล็อก",
      icon: lockFeedback || "🔒",
      visible: !locked,
      disabled: isBusy,
      title: "ล็อกกิจกรรมเพื่อป้องกันการแก้ไขโดยไม่ตั้งใจ",
      execute: handlers.toggleLock
    },
    {
      id: "archive",
      group: "manage",
      label: busyAction === "archive" ? "กำลังเก็บ..." : "เก็บเข้าคลัง",
      icon: "▣",
      visible: canUseFullMenu,
      disabled: locked || isBusy,
      title: locked ? "ปลดล็อกก่อนเก็บเข้าคลัง" : "เก็บสำเนากิจกรรมนี้ไว้ในคลัง",
      execute: handlers.archive
    },
    {
      id: "delete",
      group: "danger",
      label: "ลบกิจกรรม",
      icon: "🗑",
      visible: canUseFullMenu,
      disabled: !canMutate,
      title: locked ? "ปลดล็อกก่อนลบ" : "ลบกิจกรรมจาก Google Calendar",
      execute: handlers.delete
    }
  ].filter((action) => action.visible);
}

export function groupActivityPopupActions(actions) {
  return Object.keys(ACTIVITY_POPUP_ACTION_GROUPS).reduce((groups, groupId) => ({
    ...groups,
    [groupId]: actions.filter((action) => action.group === groupId)
  }), {});
}
