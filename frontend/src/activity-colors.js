// Activity colors are owned exclusively by the app's life-area categories.
// Uncategorized activities intentionally share one neutral color.
import { normalizeActivityId } from "./id-utils.js";

// Gray shown for activities with no assigned life-area category — must stay
// in sync with UNCATEGORIZED.color in backend/routes/summary.js so the
// agenda view and the weekly summary donut chart agree on what
// "uncategorized" looks like.
export const UNCATEGORIZED_COLOR = { name: "ไม่ระบุหมวดหมู่", border: "#9AA0A6", bg: "#E8EAED" };

/**
 * Resolves the color to actually display for an activity: the assigned
 * life-area category's color; Google Calendar's own colorId is ignored.
 * @param {object} activity Google Calendar activity
 * @param {Record<string,string>} activityCategoryMap activityId -> categoryId
 * @param {Array<{id:string,color:string}>} categories
 */

export function getDisplayColor(activity, activityCategoryMap, categories) {
  const categoryId = activityCategoryMap[normalizeActivityId(activity.id)];
  if (categoryId) {
    const category = categories.find((c) => c.id === categoryId);
    if (category) {
      return { border: category.color, bg: `${category.color}33` }; // ~20% alpha tint
    }
  }
  // No category assigned — show the same gray as the "ไม่ระบุหมวดหมู่"
  // slice in the weekly summary donut chart.
  return UNCATEGORIZED_COLOR;
}
