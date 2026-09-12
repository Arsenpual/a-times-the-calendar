import { useEffect, useRef, useState } from "react";
import { deleteActivityArchiveItem, fetchActivityArchive, saveActivityArchiveItem } from "../api/archive.js";

/** Account-scoped hydration; serialized writes acknowledge only successful requests. */
export function useActivityArchiveSync({ archiveState, archiveStorageKey, userId }) {
  const { activityArchive, setActivityArchive, archiveSnapshotRef, pendingArchiveWritesRef, pendingArchiveDeletesRef,
    setArchiveHydrated, setArchiveRemoteReady } = archiveState;
  const [readyKey, setReadyKey] = useState(null);
  const [remoteKey, setRemoteKey] = useState(null);
  const [retry, setRetry] = useState(0);
  const writeChain = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    let retryTimer;
    setReadyKey(null);
    setRemoteKey(null);
    setArchiveHydrated(false);
    setArchiveRemoteReady(false);
    archiveSnapshotRef.current = new Map();
    pendingArchiveWritesRef.current = new Set();
    pendingArchiveDeletesRef.current = new Set();
    try {
      const saved = JSON.parse(window.localStorage.getItem(archiveStorageKey) || "[]");
      setActivityArchive(Array.isArray(saved) ? saved : []);
    } catch { setActivityArchive([]); }
    setReadyKey(archiveStorageKey);
    setArchiveHydrated(true);
    const hydrate = async () => {
      try {
        const items = await fetchActivityArchive();
        if (cancelled) return;
        const remote = Array.isArray(items) ? items : [];
        archiveSnapshotRef.current = new Map(remote.map(item => [item.archiveId, JSON.stringify(item)]));
        setActivityArchive(current => {
          const merged = new Map(remote.map(item => [item.archiveId, item]));
          for (const item of current) {
            if (pendingArchiveWritesRef.current.has(item.archiveId)) merged.set(item.archiveId, item);
          }
          for (const id of pendingArchiveDeletesRef.current) merged.delete(id);
          return [...merged.values()].sort((a, b) => String(b.archivedAt || "").localeCompare(String(a.archivedAt || "")));
        });
        setRemoteKey(archiveStorageKey);
        setArchiveRemoteReady(true);
      } catch (error) {
        if (cancelled) return;
        console.error("โหลดคลังกิจกรรมจาก Firebase ไม่สำเร็จ:", error.message);
        retryTimer = window.setTimeout(hydrate, 15000);
      }
    };
    if (userId) hydrate();
    return () => { cancelled = true; window.clearTimeout(retryTimer); };
  }, [archiveStorageKey, userId]);

  useEffect(() => {
    if (readyKey !== archiveStorageKey) return;
    try {
      window.localStorage.setItem(archiveStorageKey, JSON.stringify(activityArchive));
      window.dispatchEvent(new CustomEvent("times-activity-archive-changed", { detail: { userId } }));
    } catch { /* In-memory edits remain available. */ }
    if (remoteKey !== archiveStorageKey || !userId) return;
    let cancelled = false;
    let timer;
    writeChain.current = writeChain.current.catch(() => {}).then(async () => {
      if (cancelled) return;
      const desired = new Map(activityArchive.map(item => [item.archiveId, JSON.stringify(item)]));
      let failed = false;
      for (const [id, json] of desired) {
        if (cancelled) return;
        if (archiveSnapshotRef.current.get(id) === json) continue;
        try {
          await saveActivityArchiveItem(JSON.parse(json));
          archiveSnapshotRef.current.set(id, json);
          if (!cancelled) pendingArchiveWritesRef.current.delete(id);
        } catch (error) {
          failed = true;
          console.error("บันทึกคลังกิจกรรมลง Firebase ไม่สำเร็จ:", error.message);
        }
      }
      for (const id of new Set([...archiveSnapshotRef.current.keys(), ...pendingArchiveDeletesRef.current])) {
        if (cancelled) return;
        if (desired.has(id)) continue;
        try {
          await deleteActivityArchiveItem(id);
          archiveSnapshotRef.current.delete(id);
          pendingArchiveDeletesRef.current.delete(id);
        } catch (error) {
          failed = true;
          console.error("ลบคลังกิจกรรมจาก Firebase ไม่สำเร็จ:", error.message);
        }
      }
      if (failed && !cancelled) timer = window.setTimeout(() => setRetry(value => value + 1), 15000);
    });
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activityArchive, archiveStorageKey, readyKey, remoteKey, userId, retry]);
}
