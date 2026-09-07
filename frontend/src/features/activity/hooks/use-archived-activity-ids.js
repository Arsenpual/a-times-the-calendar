import { useEffect, useState } from "react";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";

export function useArchivedActivityIds(firebaseUser) {
  const [archivedActivityIds, setArchivedActivityIds] = useState(() => new Set());

  useEffect(() => {
    const archiveStorageKey = `times-activity-archive:${firebaseUser?.uid || "guest"}`;
    const refreshArchivedActivityIds = () => {
      try {
        const archive = JSON.parse(window.localStorage.getItem(archiveStorageKey) || "[]");
        setArchivedActivityIds(new Set(
          (Array.isArray(archive) ? archive : [])
            .flatMap((item) => item.calendarId ? [item.calendarId, normalizeActivityId(item.calendarId)] : [])
        ));
      } catch {
        setArchivedActivityIds(new Set());
      }
    };
    refreshArchivedActivityIds();
    const onArchiveChanged = (event) => {
      if (event.detail?.userId === firebaseUser?.uid) refreshArchivedActivityIds();
    };
    window.addEventListener("times-activity-archive-changed", onArchiveChanged);
    return () => window.removeEventListener("times-activity-archive-changed", onArchiveChanged);
  }, [firebaseUser?.uid]);

  return archivedActivityIds;
}
