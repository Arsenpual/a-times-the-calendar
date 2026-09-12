import { useMemo } from "react";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";

/** Derived views of Calendar data; does not fetch or own a second copy of state. */
export function useActivityCollections({
  activities, onboardingActivities, archivedActivityIds,
  tagSearchTerms, tagSearchResults, activityTagMap
}) {
  const calendarActivities = useMemo(
    () => activities.filter((activity) => !isArchived(activity, archivedActivityIds)),
    [activities, archivedActivityIds]
  );

  const visibleActivities = useMemo(() => {
    if (tagSearchTerms.length === 0) {
      return [...calendarActivities, ...onboardingActivities.filter((activity) => !isArchived(activity, archivedActivityIds))];
    }
    const queries = tagSearchTerms.map((term) => term.toLowerCase());
    return tagSearchResults.filter((activity) => {
      if (isArchived(activity, archivedActivityIds)) return false;
      const tags = activityTagMap[normalizeActivityId(activity.id)] || [];
      return queries.some((query) => tags.some((tag) => tag.toLowerCase().includes(query)));
    });
  }, [calendarActivities, onboardingActivities, archivedActivityIds, tagSearchTerms, tagSearchResults, activityTagMap]);

  return { calendarActivities, visibleActivities };
}

function isArchived(activity, archivedActivityIds) {
  return archivedActivityIds.has(activity.id) || archivedActivityIds.has(normalizeActivityId(activity.id));
}
