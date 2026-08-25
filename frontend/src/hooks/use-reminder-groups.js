import { useCallback, useEffect, useState } from "react";
import { fetchReminderGroups, createReminderGroup, deleteReminderGroup } from "../api.js";

/**
 * Owns reminder groups/projects (migration plan v2 เฟส 3) — โหลดจาก backend
 * ตอน login (เหมือน pattern fetchCategories ใน use-calendar-data.js) แล้ว
 * เปิด create/delete ให้ reminder-mode.jsx เรียกใช้ตรงๆ
 *
 * ต่างจาก useRemindersSync ตรงที่ groups **sync ทันที** ไม่มี local-first/
 * debounce/merge-on-load แบบ reminder เอง (ตามคำตอบเฟส 0 ข้อ 2 ที่ล็อกไว้
 * — "groups ต้อง sync ขึ้น backend") เพราะกลุ่มไม่มี runtime state ที่
 * เปลี่ยนถี่แบบ reminder (ไม่มี stopwatch/countdown ให้ tick) จึงไม่จำเป็น
 * ต้องมี local-first layer ซับซ้อนแบบนั้น — เขียนขึ้น backend ตรงๆ แล้ว
 * ค่อยอัปเดต state ในเครื่องจากผลลัพธ์จริงที่ backend ส่งกลับมา
 *
 * groupId ที่ reminder แต่ละตัวผูกอยู่ (field บนตัว reminder เอง) ยังคง
 * sync ผ่าน useRemindersSync/syncScheduleFields ตามปกติ — hook นี้เป็น
 * เจ้าของแค่ "รายการกลุ่มที่มีอยู่" เท่านั้น ไม่รู้จักว่า reminder ไหนผูก
 * กับกลุ่มไหน (นั่นเป็นข้อมูลใน reminders state ของ reminder-mode.jsx เอง)
 */
export function useReminderGroups({ firebaseUser }) {
  const [groups, setGroups] = useState([]);
  const [groupsError, setGroupsError] = useState(null);

  useEffect(() => {
    if (!firebaseUser) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    fetchReminderGroups()
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch((e) => {
        if (!cancelled) setGroupsError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  const addGroup = useCallback(async (name, color) => {
    setGroupsError(null);
    try {
      const created = await createReminderGroup(name, color);
      setGroups((prev) => [...prev, created]);
      return created;
    } catch (e) {
      setGroupsError(e.message);
      throw e;
    }
  }, []);

  /**
   * ลบกลุ่ม — backend เคลียร์ groupId ของ reminder ที่ผูกอยู่ให้เป็น null
   * เองแล้ว (ดู routes/reminder-groups.js) แต่ local `reminders` state ใน
   * reminder-mode.jsx ที่เรียก hook นี้ยังไม่รู้เรื่องนี้ — ผู้เรียกต้อง
   * อัปเดต local state ของตัวเอง (เคลียร์ groupId ของ reminder ที่ผูกกับ
   * id นี้) เองหลัง removeGroup resolve สำเร็จ hook นี้ไม่รู้จัก reminders
   * state เลยทำให้ไม่ได้
   */
  const removeGroup = useCallback(async (id) => {
    setGroupsError(null);
    try {
      await deleteReminderGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } catch (e) {
      setGroupsError(e.message);
      throw e;
    }
  }, []);

  return { groups, groupsError, addGroup, removeGroup };
}
