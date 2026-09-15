import { useCallback, useEffect, useRef, useState } from "react";
import { fetchReminders, saveReminder, deleteReminderRemote } from "../api/reminders.js";

// A full reminder collection read is deliberately not a high-frequency clock.
// The due clock uses the already-loaded local schedule every second; this
// background sync only imports edits made by another device.
const REMINDER_SYNC_INTERVAL_MS = 60_000;

// Explicit mutations only. Serialize each ID so an earlier PUT cannot finish
// after DELETE and recreate a document. A failed request is exposed to the UI.
export function useRemindersSync({ firebaseUser }) {
  const uid = firebaseUser?.uid || null;
  const currentUid = useRef(uid);
  currentUid.current = uid;
  const [loaded, setLoaded] = useState({ uid: null, data: null });
  const [loadError, setLoadError] = useState(null);
  const queues = useRef(new Map());
  useEffect(() => {
    let cancelled = false;
    let lastPayload = null;
    setLoaded({ uid, data: null });
    setLoadError(null);
    if (!uid) return () => { cancelled = true; };

    // The API remains the only data boundary. Polling lets a dedicated
    // notification screen (for example the Raspberry Pi) see mutations made
    // from another browser without giving every browser a Firestore client.
    const refresh = async () => {
      try {
        const data = await fetchReminders();
        const payload = JSON.stringify(data);
        if (!cancelled && payload !== lastPayload) {
          lastPayload = payload;
          setLoaded({ uid, data });
        }
        if (!cancelled) setLoadError(null);
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      }
    };
    refresh();
    const pollId = window.setInterval(refresh, REMINDER_SYNC_INTERVAL_MS);
    return () => { cancelled = true; window.clearInterval(pollId); };
  }, [uid]);

  const enqueue = useCallback((id, action) => {
    if (!uid) return Promise.resolve();
    const key = uid + ":" + id;
    const previous = queues.current.get(key) || Promise.resolve();
    const pending = previous.catch(() => {}).then(() => {
      if (currentUid.current !== uid) throw new Error("บัญชีผู้ใช้เปลี่ยนแล้ว กรุณาลองใหม่");
      return action();
    });
    queues.current.set(key, pending);
    const cleanup = () => {
      if (queues.current.get(key) === pending) queues.current.delete(key);
    };
    pending.then(cleanup, cleanup);
    return pending;
  }, [uid]);
  const syncScheduleFields = useCallback((id, fields) =>
    enqueue(id, () => saveReminder(id, fields)), [enqueue]);
  const deleteRemoteReminder = useCallback(id =>
    enqueue(id, () => deleteReminderRemote(id)), [enqueue]);
  const fetchLatestReminders = useCallback(async () => {
    while ([...queues.current.keys()].some(key => key.startsWith(uid + ":"))) {
      await Promise.all([...queues.current.entries()].filter(([key]) => key.startsWith(uid + ":")).map(([, pending]) => pending));
    }
    if (currentUid.current !== uid) throw new Error("บัญชีผู้ใช้เปลี่ยนแล้ว กรุณาลองใหม่");
    const data = await fetchReminders();
    if (currentUid.current !== uid) throw new Error("บัญชีผู้ใช้เปลี่ยนแล้ว กรุณาลองใหม่");
    return data;
  }, [uid]);
  return { remoteReminders: loaded.uid === uid ? loaded.data : null,
    loadError, syncScheduleFields, deleteRemoteReminder, fetchLatestReminders };
}
