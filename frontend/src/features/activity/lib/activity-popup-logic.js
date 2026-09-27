export const ACTIVITY_SERIES_WARN_LIMIT = 20;

export function formatActivityDuration(start, end) {
  const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} นาที`;
  if (minutes === 0) return `${hours} ชม.`;
  return `${hours} ชม. ${minutes} นาที`;
}

export function formatActivityTimeLabel(date) {
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export function previousActivityPopupMode(mode, isRecurring) {
  switch (mode) {
    case "confirm-delete":
      return isRecurring ? "recurring-action" : "menu";
    case "series-limit-warning":
    case "confirm-delete-series":
      return "recurring-action";
    default:
      return "menu";
  }
}

export function shouldWarnBeforeSeriesAction(seriesCount, limit = ACTIVITY_SERIES_WARN_LIMIT) {
  return seriesCount === null || seriesCount > limit;
}
