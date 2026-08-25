import { useEffect, useRef, useState } from "react";
import { useRemindersSync } from "./use-reminders-sync.js";

/**
 * เจ้าของ state หลักของ reminder: localStorage, merge จาก cloud และ mirror
 * schedule fields กลับ Firestore. แยกจาก UI เพื่อให้ ReminderDashboard
 * เพิ่ม panel/feature ใหม่ได้โดยไม่ต้องรวม lifecycle ข้อมูลไว้ไฟล์เดียว.
 */
export function useReminderStore({ firebaseUser, storageKey, defaultReminders, extractScheduleFields }) {
  const [reminders, setReminders] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return defaultReminders;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : defaultReminders;
    } catch {
      return defaultReminders;
    }
  });
  const { remoteReminders, syncScheduleFields, deleteRemoteReminder } = useRemindersSync({ firebaseUser });
  const hasMergedRemoteRef = useRef(false);
  const [hasMergedRemote, setHasMergedRemote] = useState(false);
  const lastSyncedScheduleRef = useRef(new Map());
  const syncedUserIdRef = useRef(null);

  // localStorage อาจมี nextDueAt ของรอบก่อนหน้า ขณะที่ Cloud Run เลื่อนไป
  // รอบใหม่แล้ว ห้ามให้ effect sync ด้านล่างเขียนค่าท้องถิ่นเก่าทับ remote
  // ก่อนการ merge เสร็จ มิฉะนั้น interval จะถูก lastNotifiedAt guard ข้าม
  // และแจ้งได้เพียงรอบแรก.
  useEffect(() => {
    hasMergedRemoteRef.current = false;
    setHasMergedRemote(false);
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!remoteReminders || hasMergedRemoteRef.current) return;
    hasMergedRemoteRef.current = true;
    const remoteIds = Object.keys(remoteReminders);
    if (remoteIds.length === 0) {
      setHasMergedRemote(true);
      return;
    }

    setReminders((previous) => {
      const byId = new Map(previous.map((reminder) => [reminder.id, reminder]));
      for (const id of remoteIds) {
        const remoteFields = remoteReminders[id];
        const local = byId.get(id);
        byId.set(id, local ? { ...local, ...remoteFields } : { id, ...remoteFields });
      }
      return Array.from(byId.values());
    });
    setHasMergedRemote(true);
  }, [remoteReminders]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(reminders));
  }, [reminders, storageKey]);

  useEffect(() => {
    if (!firebaseUser || remoteReminders === null || !hasMergedRemote) return;
    if (syncedUserIdRef.current !== firebaseUser.uid) {
      lastSyncedScheduleRef.current.clear();
      syncedUserIdRef.current = firebaseUser.uid;
    }
    const presentIds = new Set();
    reminders.forEach((reminder) => {
      const fields = extractScheduleFields(reminder);
      const snapshot = JSON.stringify(fields);
      presentIds.add(reminder.id);
      if (lastSyncedScheduleRef.current.get(reminder.id) !== snapshot) {
        lastSyncedScheduleRef.current.set(reminder.id, snapshot);
        syncScheduleFields(reminder.id, fields);
      }
    });
    for (const id of lastSyncedScheduleRef.current.keys()) {
      if (!presentIds.has(id)) lastSyncedScheduleRef.current.delete(id);
    }
  }, [firebaseUser, remoteReminders, hasMergedRemote, reminders, extractScheduleFields, syncScheduleFields]);

  return { reminders, setReminders, syncScheduleFields, deleteRemoteReminder };
}
