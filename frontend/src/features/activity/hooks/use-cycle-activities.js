import { useEffect, useState } from "react";
import { fetchActivities } from "../../calendar-connection/api/google-calendar.js";

/** Loads the read-only four-week Cycle data independently of the active week. */
export function useCycleActivities({ viewMode, calendarAccessToken, cycleStart, cycleEnd }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (viewMode !== "four-weeks" || !calendarAccessToken) return undefined;
    let cancelled = false;
    const rangeStart = new Date(cycleStart);
    rangeStart.setDate(rangeStart.getDate() - 1);

    setLoading(true);
    setError("");
    fetchActivities(calendarAccessToken, rangeStart, cycleEnd)
      .then((items) => { if (!cancelled) setActivities(items); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [viewMode, calendarAccessToken, cycleStart.getTime(), cycleEnd.getTime()]);

  return { activities, loading, error };
}
