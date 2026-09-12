import { useEffect, useRef, useState } from "react";

/**
 * Private state shared by archive sync, editor and Calendar commands.
 * The owning Week Spine remounts when the account changes.
 */
export function useActivityArchiveState() {
  const [activityArchive, setActivityArchive] = useState([]);
  const [restoringCalendarIds, setRestoringCalendarIds] = useState(() => new Set());
  const [archiveHydrated, setArchiveHydrated] = useState(false);
  const [archiveRemoteReady, setArchiveRemoteReady] = useState(false);
  const [archiveTagDrafts, setArchiveTagDrafts] = useState({});
  const [archiveTitleToFocus, setArchiveTitleToFocus] = useState(null);
  const archiveSnapshotRef = useRef(new Map());
  const pendingArchiveWritesRef = useRef(new Set());
  const pendingArchiveDeletesRef = useRef(new Set());
  const archiveSessionRef = useRef(null);
  useEffect(() => {
    const session = { active: true };
    archiveSessionRef.current = session;
    return () => { session.active = false; };
  }, []);

  return {
    activityArchive,
    setActivityArchive,
    restoringCalendarIds,
    setRestoringCalendarIds,
    archiveHydrated,
    setArchiveHydrated,
    archiveRemoteReady,
    setArchiveRemoteReady,
    archiveTagDrafts,
    setArchiveTagDrafts,
    archiveTitleToFocus,
    setArchiveTitleToFocus,
    archiveSnapshotRef,
    pendingArchiveWritesRef,
    pendingArchiveDeletesRef,
    archiveSessionRef
  };
}
