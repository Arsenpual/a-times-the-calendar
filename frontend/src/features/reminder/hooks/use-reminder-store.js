import { useCallback, useEffect, useRef, useState } from "react";
import { useRemindersSync } from "./use-reminders-sync.js";

function readCache(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch { return fallback; }
}

// Local state updates (hydration/timers) never write to the API.
// Only updateReminders, called by user handlers, generates mutations.
export function useReminderStore({ firebaseUser, storageKey, defaultReminders, extractScheduleFields }) {
  const [reminders, setState] = useState(() => readCache(storageKey, defaultReminders));
  const stateRef = useRef(reminders);
  const owner = useRef(storageKey);
  const ready = useRef(false);
  const [syncError, setSyncError] = useState(null);
  const { remoteReminders, loadError, syncScheduleFields, deleteRemoteReminder } = useRemindersSync({ firebaseUser });
  const setReminders = useCallback(update => {
    const next = typeof update === "function" ? update(stateRef.current) : update;
    stateRef.current = next;
    setState(next);
  }, []);
  useEffect(() => {
    owner.current = storageKey;
    ready.current = false;
    setSyncError(null);
    setReminders(readCache(storageKey, defaultReminders));
  }, [storageKey, setReminders]);

  useEffect(() => {
    if (remoteReminders === null || ready.current) return;
    // Keep a recoverable snapshot of legacy local-only records; never upload
    // them automatically, as they may be records deleted by another device.
    try {
      const backupKey = storageKey + ":before-cloud-first";
      if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, JSON.stringify(stateRef.current));
    } catch { /* Storage quota must not block loading cloud data. */ }
    const cached = new Map(stateRef.current.map(item => [item.id, item]));
    setReminders(Object.entries(remoteReminders).map(([id, fields]) => ({
      ...cached.get(id), ...fields, id
    })));
    ready.current = true;
  }, [remoteReminders, storageKey, setReminders]);

  useEffect(() => {
    if (owner.current !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(stateRef.current)); } catch {}
  }, [reminders, storageKey]);

  const updateReminders = useCallback(update => {
    if (owner.current !== storageKey || (firebaseUser && !ready.current)) {
      setSyncError("ยังโหลดข้อมูล Reminder ไม่สำเร็จ กรุณารีเฟรชแล้วลองอีกครั้ง");
      return;
    }
    const before = stateRef.current;
    const next = typeof update === "function" ? update(before) : update;
    setReminders(next);
    if (!firebaseUser) return;
    const ownerKey = storageKey;
    const previous = new Map(before.map(item => [item.id, item]));
    const nextIds = new Set(next.map(item => item.id));
    const requests = [];
    for (const item of next) {
      const fields = extractScheduleFields(item);
      const old = previous.get(item.id);
      if (!old || JSON.stringify(extractScheduleFields(old)) !== JSON.stringify(fields)) {
        requests.push(syncScheduleFields(item.id, fields));
      }
    }
    for (const item of before) if (!nextIds.has(item.id)) requests.push(deleteRemoteReminder(item.id));
    if (requests.length) Promise.allSettled(requests).then(results => {
      if (owner.current !== ownerKey) return;
      const failure = results.find(result => result.status === "rejected");
      if (failure) setSyncError("บันทึก Reminder บน cloud ไม่สำเร็จ: " + failure.reason.message);
    });
  }, [firebaseUser, storageKey, setReminders, extractScheduleFields, syncScheduleFields, deleteRemoteReminder]);
  return { reminders, setReminders, updateReminders, syncError: syncError || loadError };
}
