import { useCallback, useEffect, useState } from "react";
import { fetchActivities, isCalendarAuthExpiredError } from "../google-calendar.js";
import {
  fetchCategories,
  fetchActivityCategoryMap,
  fetchActivityTagMap,
  fetchLockedActivities,
  fetchWeeklySummary
} from "../api.js";
import { getWeekRange, activityDate, toDateInputValue } from "../date-utils.js";

/**
 * Owns everything read (not written — see useActivityMutations for
 * writes) from Google Calendar + our own backend for the currently
 * visible week: activities, life-area categories, activity↔category and
 * activity↔tag maps, lock states, and the computed weekly summary.
 *
 * Takes calendarAccessToken/firebaseUser/cursorDate as inputs rather than
 * owning them itself — those are identity/navigation concerns that live
 * in useAuth and useWeekNavigation respectively, and this hook's fetches
 * are simply gated on them. setError is also passed in rather than owned
 * here, since error display is a single shared banner in app.jsx fed by
 * every hook (auth errors, mutation errors, and these fetch errors all
 * land in the same place).
 *
 * Also takes setCalendarAccessToken (from useAuth) so loadActivities can
 * clear the token when Google Calendar itself reports it's expired (401)
 * — previously this hook only called setError(e.message) on failure,
 * which showed the "หมดอายุ...กรุณายืนยันตัวตนอีกครั้ง" banner text but
 * left calendarAccessToken untouched, so app.jsx's renew-token banner
 * (gated on `!calendarAccessToken`) never appeared even though the error
 * text told the person to re-authenticate. loadActivities runs
 * automatically on every mount/week change, so it's the most common way
 * an expired token was first discovered — this was the main place that
 * inconsistency showed up in practice.
 *
 * Exposes the raw setters (setActivityCategoryMap, etc.) alongside the
 * fetchers — useActivityMutations needs both: it does optimistic local
 * updates via the setters, then calls loadActivities() to reconcile with
 * the server after a write.
 */
export function useCalendarData({ calendarAccessToken, setCalendarAccessToken, firebaseUser, cursorDate, setError, archivedActivityIds = new Set() }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState([]);
  const [activityCategoryMap, setActivityCategoryMap] = useState({});
  const [activityTagMap, setActivityTagMap] = useState({}); // activityId (normalized) -> string[]
  const [lockedActivities, setLockedActivities] = useState({});

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Load life-area categories + activity->category mapping + lock states
  // from our own backend once the user is logged in. Gated on firebaseUser
  // (not calendarAccessToken) since api.js only needs the Firebase ID
  // token, which it pulls fresh from auth.currentUser itself.
  useEffect(() => {
    if (!firebaseUser) return;
    fetchCategories().then(setCategories).catch((e) => setError(e.message));
    fetchActivityCategoryMap().then(setActivityCategoryMap).catch((e) => setError(e.message));
    fetchActivityTagMap().then(setActivityTagMap).catch((e) => setError(e.message));
    fetchLockedActivities().then(setLockedActivities).catch((e) => setError(e.message));
  }, [firebaseUser, setError]);

  const loadActivities = useCallback(async () => {
    if (!calendarAccessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [weekStart, rangeEnd] = getWeekRange(cursorDate);
      // Fetch from one day before the visible week starts — not because
      // that extra day is shown anywhere, but so an activity that began
      // the night before the week is available to render as a dimmed
      // "spillover from last night" indicator on the week's first day.
      const rangeStart = new Date(weekStart);
      rangeStart.setDate(rangeStart.getDate() - 1);
      const items = await fetchActivities(calendarAccessToken, rangeStart, rangeEnd);
      setActivities(items);
    } catch (e) {
      setError(e.message);
      // Clear the token so app.jsx's renew banner (gated on
      // `!calendarAccessToken`) actually shows up alongside this error —
      // see this hook's module comment for why this was missing before.
      if (isCalendarAuthExpiredError(e)) {
        setCalendarAccessToken(null);
      }
      throw e;
    } finally {
      setLoading(false);
    }
  }, [calendarAccessToken, cursorDate, setError, setCalendarAccessToken]);

  // Keep the visible week synchronized with Google Calendar. When the
  // access token has expired, loadActivities clears it and app.jsx presents
  // the blocking re-authentication overlay before the user can continue.
  useEffect(() => {
    if (!firebaseUser || !calendarAccessToken) return;
    loadActivities().catch(() => {
      // The hook has already published the error and cleared an expired
      // token when appropriate. Avoid an unhandled rejection from the effect.
    });
  }, [firebaseUser, calendarAccessToken, cursorDate, loadActivities]);

  // Recompute the weekly summary from our backend whenever the activities
  // for the visible week (or their category assignments) change. activities
  // deliberately includes the day before the week for the timeline's
  // overnight-spillover indicator, so filter it back to the visible Sunday–
  // Saturday range before sending it to the summary API.
  useEffect(() => {
    const [weekStart, weekEnd] = getWeekRange(cursorDate);
    const weeklyActivities = activities.filter((activity) => {
      if (archivedActivityIds.has(activity.id)) return false;
      const start = activityDate(activity.start);
      return start && start >= weekStart && start <= weekEnd;
    });

    if (!firebaseUser || weeklyActivities.length === 0) {
      setSummary(null);
      setSummaryLoading(false);
      return;
    }

    // A duplicate/move can trigger a fresh load and summary request while
    // the previous request is still in flight. Ignore the older response
    // if its effect has already been superseded, so stale totals cannot
    // flash back over the latest calendar state.
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    const payload = weeklyActivities
      .map((activity) => {
        const start = activityDate(activity.start);
        const end = activityDate(activity.end);
        if (!start || !end) return null;
        return {
          id: activity.id,
          summary: activity.summary,
          start: start.toISOString(),
          end: end.toISOString(),
          // Keep the browser-local day that ActivityMode and MiniTimelinePanel
          // use, rather than relying on the server's timezone for grouping.
          startDate: toDateInputValue(start)
        };
      })
      .filter(Boolean);

    fetchWeeklySummary(payload)
      .then((nextSummary) => {
        if (!cancelled) setSummary(nextSummary);
      })
      .catch((e) => {
        if (!cancelled) setSummaryError(e.message);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [firebaseUser, activities, activityCategoryMap, cursorDate, archivedActivityIds]);

  /** Clears everything this hook owns — called from app.jsx's handleLogout. */
  const resetOnLogout = useCallback(() => {
    setActivities([]);
    setSummary(null);
    setCategories([]);
    setActivityCategoryMap({});
    setActivityTagMap({});
    setLockedActivities({});
  }, []);

  return {
    activities,
    setActivities,
    loading,
    categories,
    setCategories,
    activityCategoryMap,
    setActivityCategoryMap,
    activityTagMap,
    setActivityTagMap,
    lockedActivities,
    setLockedActivities,
    summary,
    summaryLoading,
    summaryError,
    loadActivities,
    resetOnLogout
  };
}
