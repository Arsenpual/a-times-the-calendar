// Maps Google Calendar's built-in event colorId (1-11) to a border/background
// pair, used for the manual color-picker swatches in ActivityModal /
// ActivityPopup (letting the user pick a Google Calendar color by hand).
// NOT used as an automatic fallback for uncategorized activities in the
// agenda/timeline views — see getDisplayColor below, which uses a flat gray
// instead so it matches the weekly summary donut chart's "uncategorized"
// slice.
//
// These use Google's darker "foreground-safe" shades (the ones Google uses
// for text/icons, not the bright shades meant for large surfaces) for
// better contrast — deliberately deeper/more saturated than a first pass,
// per user feedback (colorblind, wanted less washed-out colors).
// Reference: https://developers.google.com/calendar/api/v3/reference/colors
//
// normalizeActivityId is imported (not redefined here) so every lookup in
// this file always uses the single shared implementation in id-utils.js —
// this file used to keep its own local copy, which is exactly the kind of
// drift id-utils.js's own module comment warns against.
import { normalizeActivityId } from "./id-utils.js";

export const EVENT_COLORS = {
  1: { name: "Lavender", border: "#5C6BC0", bg: "#D1D9F5" },
  2: { name: "Sage", border: "#237B4B", bg: "#CFEAD9" },
  3: { name: "Grape", border: "#6A1B9A", bg: "#E6D1F0" },
  4: { name: "Flamingo", border: "#C0392B", bg: "#F8D6D2" },
  5: { name: "Banana", border: "#F29900", bg: "#FDEAC2" },
  6: { name: "Tangerine", border: "#D84315", bg: "#F7D3C5" },
  7: { name: "Peacock", border: "#0277BD", bg: "#C8E6F5" },
  8: { name: "Graphite", border: "#424242", bg: "#E0E0E0" },
  9: { name: "Blueberry", border: "#303F9F", bg: "#D1D9F5" },
  10: { name: "Basil", border: "#0B6B33", bg: "#C2E6CE" },
  11: { name: "Tomato", border: "#B71C1C", bg: "#F8D2D0" }
};

// Gray shown for activities with no assigned life-area category — must stay
// in sync with UNCATEGORIZED.color in backend/routes/summary.js so the
// agenda view and the weekly summary donut chart agree on what
// "uncategorized" looks like. Deliberately no longer falls back to
// Google Calendar's own colorId here (see getDisplayColor below) — the
// donut chart has no concept of colorId at all, so any activity shown
// with a Google color in the agenda but no category assigned would look
// like two different colors for the same "uncategorized" bucket.
export const UNCATEGORIZED_COLOR = { name: "ไม่ระบุหมวดหมู่", border: "#9AA0A6", bg: "#E8EAED" };

export const DEFAULT_COLOR = { name: "Default", border: "#1557B0", bg: "#D2E3FC" };

export function getEventColor(colorId) {
  return EVENT_COLORS[colorId] || DEFAULT_COLOR;
}

/**
 * Resolves the color to actually display for an activity: the assigned
 * life-area category's color takes priority over Google's own colorId,
 * since categories are the app's own organizing scheme.
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
  // slice in the weekly summary donut chart, instead of falling back to
  // Google Calendar's own colorId (which the donut chart has no way to
  // represent, and was the cause of the color mismatch between the two
  // views). The event's own colorId is still shown elsewhere — e.g. the
  // color-picker swatches in ActivityModal/ActivityPopup — this only
  // affects which color the agenda/timeline chips display.
  return UNCATEGORIZED_COLOR;
}
