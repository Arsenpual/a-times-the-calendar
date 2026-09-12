import { useEffect, useMemo, useState } from "react";
import { fetchActivities, isCalendarAuthExpiredError } from "../../calendar-connection/api/google-calendar.js";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";

const EMPTY = [];
const EMPTY_IDS = new Set();

/** Calendar window for Reminder's selected date; independent of Activity navigation. */
export function useReminderCalendar({
  userId, calendarAccessToken, selectedDateKey, enabled,
  activityRevision, archivedActivityIds = EMPTY_IDS, onReauthRequired
}) {
  const active = Boolean(enabled && userId && calendarAccessToken);
  const scope = JSON.stringify([userId, calendarAccessToken, selectedDateKey, active]);
  const [result, setResult] = useState({ scope: null, activities: EMPTY, loading: false, error: "" });
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const start = new Date(selectedDateKey + "T00:00:00");
    const end = new Date(start);
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() + 1);
    setResult({ scope, activities: EMPTY, loading: true, error: "" });
    fetchActivities(calendarAccessToken, start, end).then(activities => {
      if (!cancelled) setResult({ scope, activities, loading: false, error: "" });
    }).catch(error => {
      if (cancelled) return;
      setResult({ scope, activities: EMPTY, loading: false, error: error.message });
      if (isCalendarAuthExpiredError(error)) onReauthRequired?.(null);
    });
    return () => { cancelled = true; };
  }, [active, scope, selectedDateKey, calendarAccessToken, activityRevision, onReauthRequired]);
  const source = active && result.scope === scope ? result.activities : EMPTY;
  const activities = useMemo(() => source.filter(activity =>
    !archivedActivityIds.has(activity.id) && !archivedActivityIds.has(normalizeActivityId(activity.id))
  ), [source, archivedActivityIds]);
  return {
    activities,
    loading: active && (result.scope !== scope || result.loading),
    error: active && result.scope === scope ? result.error : ""
  };
}
