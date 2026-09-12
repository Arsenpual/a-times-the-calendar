import { useEffect, useMemo, useState } from "react";
import { fetchActivities } from "../../calendar-connection/api/google-calendar.js";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";

const EMPTY_ACTIVITIES = [];
const EMPTY_ARCHIVED_IDS = new Set();

/** One Cycle dataset shared by overview and summary; old requests cannot replace a new scope. */
export function useCycleActivities({
  viewMode, calendarAccessToken, cycleStart, cycleEnd, userId,
  archivedActivityIds = EMPTY_ARCHIVED_IDS
}) {
  const startMs = cycleStart.getTime();
  const endMs = cycleEnd.getTime();
  const enabled = viewMode === "four-weeks" && Boolean(calendarAccessToken);
  const scope = JSON.stringify([userId || "", calendarAccessToken, startMs, endMs, enabled]);
  const [snapshot, setSnapshot] = useState({ scope: null, activities: EMPTY_ACTIVITIES, loading: false, error: "" });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const rangeStart = new Date(startMs);
    rangeStart.setDate(rangeStart.getDate() - 1);
    setSnapshot({ scope, activities: EMPTY_ACTIVITIES, loading: true, error: "" });
    fetchActivities(calendarAccessToken, rangeStart, new Date(endMs))
      .then((activities) => {
        if (!cancelled) setSnapshot({ scope, activities, loading: false, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setSnapshot({ scope, activities: EMPTY_ACTIVITIES, loading: false, error: error.message });
      });
    return () => { cancelled = true; };
  }, [enabled, scope, calendarAccessToken, startMs, endMs]);

  const source = enabled && snapshot.scope === scope ? snapshot.activities : EMPTY_ACTIVITIES;
  const activities = useMemo(() => source.filter((activity) =>
    !archivedActivityIds.has(activity.id) && !archivedActivityIds.has(normalizeActivityId(activity.id))
  ), [source, archivedActivityIds]);
  return {
    activities,
    loading: enabled && (snapshot.scope !== scope || snapshot.loading),
    error: enabled && snapshot.scope === scope ? snapshot.error : ""
  };
}
