import { useCallback, useMemo } from "react";
import { getMonthCycle, getYearCycle, getYearWeekRange } from "../../../shared/lib/date-utils.js";
import { useActivityCollections } from "./use-activity-collections.js";
import { useActivityError } from "./use-activity-error.js";
import { useActivityModal } from "./use-activity-modal.js";
import { useActivityMutations } from "./use-activity-mutations.js";
import { useActivityOnboarding } from "./use-activity-onboarding.js";
import { useActivityView } from "./use-activity-view.js";
import { useArchivedActivityIds } from "./use-archived-activity-ids.js";
import { useCalendarData } from "./use-calendar-data.js";
import { useCycleActivities } from "./use-cycle-activities.js";
import { useTagSearch } from "./use-tag-search.js";
import { useWeekNames } from "./use-week-names.js";
import { useWeekNavigation } from "./use-week-navigation.js";

/**
 * Facade hook composing Activity Mode's account-scoped navigation, calendar
 * reads, cycle overview, tag search, modal, mutations, archive, and onboarding.
 */
export function useActivityWorkspace({
  mode,
  firebaseUser,
  calendarAccessToken,
  setCalendarAccessToken
}) {
  const userId = firebaseUser?.uid ?? null;
  const { error: activityError, setError } = useActivityError(userId);
  const archivedActivityIds = useArchivedActivityIds(firebaseUser);

  const nav = useWeekNavigation({ mode, userId });
  const {
    cursorDate,
    expandedDate,
    weekRangeOverride,
    navigateWeek,
    navigateDay,
    goToday,
    selectWeek,
    focusDate,
    openDay,
    closeDay
  } = nav;

  const view = useActivityView({ cursorDate, selectWeek, closeDay, userId });
  const {
    weekSpineViewMode,
    cycleAnchorDate,
    monthAnchorDate
  } = view;

  const cycleRange = getYearCycle(cycleAnchorDate);
  const monthRange = getMonthCycle(monthAnchorDate);
  const cycleData = useCycleActivities({
    viewMode: mode === "activity" && firebaseUser ? weekSpineViewMode : "week",
    calendarAccessToken,
    cycleStart: weekSpineViewMode === "month" ? monthRange.gridStart : cycleRange.start,
    cycleEnd: weekSpineViewMode === "month" ? monthRange.gridEnd : cycleRange.end,
    userId: firebaseUser?.uid,
    archivedActivityIds,
    includeWhenWeek: false
  });

  const calendarData = useCalendarData({
    calendarAccessToken,
    setCalendarAccessToken,
    firebaseUser,
    cursorDate,
    setError,
    archivedActivityIds
  });
  const {
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
    loadActivities
  } = calendarData;

  const handleManualCalendarSync = useCallback(async () => {
    if (!calendarAccessToken) {
      setError("สิทธิ์ Google Calendar หมดอายุแล้ว — ยืนยันตัวตนเมื่อต้องการดึงกิจกรรม");
      return;
    }
    try {
      await loadActivities();
    } catch {
      // loadActivities already exposes a recoverable error and clears an
      // expired token. Keep navigation usable after a failed manual sync.
    }
  }, [calendarAccessToken, loadActivities, setError]);

  const tagSearch = useTagSearch({ calendarAccessToken, setCalendarAccessToken });
  const {
    tagSearchTerms,
    tagSearchResults,
    refreshTagSearchIfActive
  } = tagSearch;

  const activityModal = useActivityModal({ calendarAccessToken, lockedActivities, setError });

  const mutations = useActivityMutations({
    calendarAccessToken,
    setCalendarAccessToken,
    activities,
    setActivities,
    activityCategoryMap,
    setActivityCategoryMap,
    activityTagMap,
    setActivityTagMap,
    lockedActivities,
    setLockedActivities,
    setCategories,
    loadActivities,
    refreshTagSearchIfActive,
    setError
  });

  const { onboardingActivities, onboardingCategoryMap } = useActivityOnboarding({
    mode,
    firebaseUser,
    categories,
    cursorDate,
    activities
  });

  const { calendarActivities, visibleActivities } = useActivityCollections({
    activities,
    onboardingActivities,
    archivedActivityIds,
    tagSearchTerms,
    tagSearchResults,
    activityTagMap
  });

  const displayedActivityCategoryMap = useMemo(
    () => ({ ...activityCategoryMap, ...onboardingCategoryMap }),
    [activityCategoryMap, onboardingCategoryMap]
  );

  const weekNamesState = useWeekNames(firebaseUser?.uid);
  const [defaultHeaderWeekStart] = getYearWeekRange(cursorDate);
  const headerWeekStart = weekRangeOverride?.start instanceof Date ? weekRangeOverride.start : defaultHeaderWeekStart;
  const headerYearStart = new Date(cursorDate.getFullYear(), 0, 1);
  const visibleHeaderWeekStart = headerWeekStart < headerYearStart ? headerYearStart : headerWeekStart;

  return {
    activityError,
    setError,
    archivedActivityIds,
    ...nav,
    ...view,
    cycleData,
    ...calendarData,
    handleManualCalendarSync,
    ...tagSearch,
    ...activityModal,
    ...mutations,
    calendarActivities,
    visibleActivities,
    displayedActivityCategoryMap,
    weekNamesState,
    visibleHeaderWeekStart
  };
}
