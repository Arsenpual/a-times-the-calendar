import { useCallback, useEffect, useState } from "react";
import { fetchActivities } from "../google-calendar.js";
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
 * Exposes the raw setters (setActivityCategoryMap, etc.) alongside the
 * fetchers — useActivityMutations needs both: it does optimistic local
 * updates via the setters, then calls loadActivities() to reconcile with
 * the server after a write.
 */
export function useCalendarData({ calendarAccessToken, firebaseUser, cursorDate, setError }) {
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
      // Note: this hook does NOT clear calendarAccessToken itself on a
      // "หมดอายุ" (expired) error — that's useAuth's state, and app.jsx
      // wires the clear explicitly where this hook is composed, keeping
      // the two hooks from needing to know about each other directly.
      throw e;
    } finally {
      setLoading(false);
    }
  }, [calendarAccessToken, cursorDate, setError]);

  useEffect(() => {
    loadActivities().catch(() => {
      // loadActivities already recorded the error via setError above;
      // this catch only exists so the effect itself doesn't produce an
      // unhandled promise rejection when the fetch fails.
    });
  }, [loadActivities]);

  // Recompute the weekly summary from our backend whenever the activities
  // for the visible week (or their category assignments) change. activities
  // deliberately includes the day before the week for the timeline's
  // overnight-spillover indicator, so filter it back to the visible Sunday–
  // Saturday range before sending it to the summary API.
  useEffect(() => {
    const [weekStart, weekEnd] = getWeekRange(cursorDate);
    const weeklyActivities = activities.filter((activity) => {
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
          // Keep the browser-local day that AgendaView and MiniTimelinePanel
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
  }, [firebaseUser, activities, activityCategoryMap, cursorDate]);

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
