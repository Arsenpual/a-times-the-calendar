import { useCallback, useEffect, useRef, useState } from "react";
import { fetchReminders, saveReminder, deleteReminderRemote } from "../api/reminders.js";

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
    setLoaded({ uid, data: null });
    setLoadError(null);
    if (uid) fetchReminders().then(data => {
      if (!cancelled) setLoaded({ uid, data });
    }).catch(error => { if (!cancelled) setLoadError(error.message); });
    return () => { cancelled = true; };
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
