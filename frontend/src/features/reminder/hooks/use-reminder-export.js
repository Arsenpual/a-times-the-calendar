import { useState } from "react";
import { downloadReminderTimelineImage } from "../lib/export-reminder-image.js";

/** Export uses a fresh store snapshot and the same date/type/group filters as the view. */
export function useReminderExport({
  getExportReminders, selectedDate, activities, categories,
  activityCategoryMap, groups, activeTypeFilter, activeGroupFilter
}) {
  const [isExporting, setIsExporting] = useState(false);
  const exportTimelineImage = async () => {
    setIsExporting(true);
    try {
      const latestReminders = await getExportReminders();
      await downloadReminderTimelineImage({
        date: selectedDate, reminders: latestReminders, activities, categories,
        activityCategoryMap, groups, activeTypeFilter, activeGroupFilter
      });
    } catch (error) {
      window.alert(`สร้างภาพไม่สำเร็จ: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };
  return { isExporting, exportTimelineImage };
}
