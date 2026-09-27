import { useSessionTaskGuard } from "../../../shared/hooks/use-session-task-guard.js";
import {
  getActivity as rawGetActivity,
  createActivity as rawCreateActivity,
  updateActivity as rawUpdateActivity,
  deleteActivity as rawDeleteActivity,
  fetchRecurringInstances as rawFetchRecurringInstances,
  isCalendarAuthExpiredError
} from "../../calendar-connection/api/google-calendar.js";
import {
  createCategory as rawCreateCategory,
  deleteCategory as rawDeleteCategory,
  assignActivityCategory as rawAssignActivityCategory,
  fetchActivityCategoryMap as rawFetchActivityCategoryMap
} from "../api/categories.js";
import { setActivityTags as rawSetActivityTags } from "../api/tags.js";
import {
  fetchLockedActivities as rawFetchLockedActivities,
  setActivityLocked as rawSetActivityLocked
} from "../api/locks.js";
import {
  saveActivityNotification as rawSaveActivityNotification,
  deleteActivityNotification as rawDeleteActivityNotification
} from "../api/notifications.js";
import { activityDate } from "../../../shared/lib/date-utils.js";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import { createActivityMetadataActions } from "../services/activity-metadata-actions.js";
import { createActivityCalendarActions } from "../services/activity-calendar-actions.js";

/**
 * Activity mutation composition boundary.
 *
 * The hook owns account-lifecycle guards and the small pieces shared by every
 * mutation. Domain workflows live in services so this file no longer mixes
 * React lifecycle wiring with save/delete/category implementations.
 */
export function useActivityMutations({
  calendarAccessToken,
  setCalendarAccessToken: rawSetCalendarAccessToken,
  activities,
  setActivities: rawSetActivities,
  activityCategoryMap,
  setActivityCategoryMap: rawSetActivityCategoryMap,
  activityTagMap,
  setActivityTagMap: rawSetActivityTagMap,
  lockedActivities,
  setLockedActivities: rawSetLockedActivities,
  setCategories: rawSetCategories,
  loadActivities: rawLoadActivities,
  refreshTagSearchIfActive: rawRefreshTagSearchIfActive,
  setError: rawSetError
}) {
  const { guardTask, guardCallback } = useSessionTaskGuard();

  const getActivity = guardTask(rawGetActivity);
  const createActivity = guardTask(rawCreateActivity);
  const updateActivity = guardTask(rawUpdateActivity);
  const deleteActivity = guardTask(rawDeleteActivity);
  const fetchRecurringInstances = guardTask(rawFetchRecurringInstances);
  const createCategory = guardTask(rawCreateCategory);
  const deleteCategory = guardTask(rawDeleteCategory);
  const assignActivityCategory = guardTask(rawAssignActivityCategory);
  const fetchActivityCategoryMap = guardTask(rawFetchActivityCategoryMap);
  const setActivityTags = guardTask(rawSetActivityTags);
  const fetchLockedActivities = guardTask(rawFetchLockedActivities);
  const setActivityLocked = guardTask(rawSetActivityLocked);
  const saveActivityNotification = guardTask(rawSaveActivityNotification);
  const deleteActivityNotification = guardTask(rawDeleteActivityNotification);

  const setCalendarAccessToken = guardCallback(rawSetCalendarAccessToken);
  const setActivities = guardCallback(rawSetActivities);
  const setActivityCategoryMap = guardCallback(rawSetActivityCategoryMap);
  const setActivityTagMap = guardCallback(rawSetActivityTagMap);
  const setLockedActivities = guardCallback(rawSetLockedActivities);
  const setCategories = guardCallback(rawSetCategories);
  const loadActivities = guardTask(rawLoadActivities);
  const refreshTagSearchIfActive = guardCallback(rawRefreshTagSearchIfActive);
  const setError = guardCallback(rawSetError);

  const clearTokenIfExpired = (error) => {
    if (isCalendarAuthExpiredError(error)) setCalendarAccessToken(null);
  };

  // Google Calendar remains the activity source of truth. Firestore mirrors
  // timed activities only so server-side notification delivery can run.
  const syncActivityNotification = async (activity) => {
    if (!activity?.id) return;
    if (activity.start?.date && !activity.start?.dateTime) {
      await deleteActivityNotification(activity.id);
      return;
    }
    const startAt = activityDate(activity.start)?.getTime();
    if (!Number.isFinite(startAt)) return;
    const endAt = activityDate(activity.end)?.getTime();
    await saveActivityNotification({
      activityId: activity.id,
      title: activity.summary || "(ไม่มีชื่อ)",
      startAt,
      endAt: Number.isFinite(endAt) ? endAt : null
    });
  };

  const checkConflict = async (activityId) => {
    if (!calendarAccessToken) return false;
    const match = activities.find(
      (activity) => normalizeActivityId(activity.id) === normalizeActivityId(activityId)
    );
    if (!match?.updated) return false;
    try {
      const latest = await getActivity(calendarAccessToken, match.id);
      return Boolean(latest?.updated && latest.updated !== match.updated);
    } catch {
      return false;
    }
  };

  const metadataActions = createActivityMetadataActions({
    lockedActivities,
    setLockedActivities,
    setActivityLocked,
    fetchLockedActivities,
    setError,
    checkConflict,
    setActivityCategoryMap,
    assignActivityCategory,
    fetchActivityCategoryMap,
    createCategory,
    deleteCategory,
    setCategories
  });

  const calendarActions = createActivityCalendarActions({
    calendarAccessToken,
    activities,
    setActivities,
    activityCategoryMap,
    setActivityCategoryMap,
    activityTagMap,
    setActivityTagMap,
    lockedActivities,
    setLockedActivities,
    getActivity,
    createActivity,
    updateActivity,
    deleteActivity,
    fetchRecurringInstances,
    assignActivityCategory,
    setActivityTags,
    setActivityLocked,
    deleteActivityNotification,
    syncActivityNotification,
    clearTokenIfExpired,
    checkConflict,
    isCalendarAuthExpiredError,
    setCalendarAccessToken,
    setError,
    loadActivities,
    refreshTagSearchIfActive
  });

  return {
    checkConflict,
    ...metadataActions,
    ...calendarActions
  };
}
