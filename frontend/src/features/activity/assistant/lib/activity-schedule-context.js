import { activityDate } from "../../../../shared/lib/date-utils.js";
import { normalizeActivityId } from "../../../../shared/lib/id-utils.js";

function localDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Send only the short planning window around the current request, never the
// person's entire Calendar. The backend repeats validation before using it.
export function buildAssistantScheduleContext(activities, lockedActivities, referenceDate) {
  const start = new Date(`${referenceDate}T00:00:00`);
  start.setDate(start.getDate() - 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 9);
  return {
    activities: activities.filter((activity) => {
      if (!activity.start?.dateTime || !activity.end?.dateTime) return false;
      const activityStart = activityDate(activity.start);
      return activityStart && activityStart >= start && activityStart < end;
    }).slice(0, 80).map((activity) => ({
      id: activity.id,
      title: activity.summary || "(ไม่มีชื่อกิจกรรม)",
      startLocal: localDateTime(activityDate(activity.start)),
      endLocal: localDateTime(activityDate(activity.end)),
      locked: Boolean(lockedActivities[normalizeActivityId(activity.id)])
    }))
  };
}

export function collectUserTags(activityTagMap = {}) {
  return [...new Set(Object.values(activityTagMap).flat().filter((tag) => typeof tag === "string" && tag.trim()))].slice(0, 100);
}
