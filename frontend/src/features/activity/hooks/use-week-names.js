import { useEffect, useState } from "react";
import { toDateInputValue, weekOfYear } from "../../../shared/lib/date-utils.js";

export function defaultWeekName(weekStart) {
  return `สัปดาห์ที่ ${weekOfYear(weekStart)} ของปี ${weekStart.getFullYear()}`;
}

export function weekNameKey(weekStart) {
  return toDateInputValue(weekStart);
}

/**
 * Owns personal week labels. They are a display preference, so they stay in
 * browser storage for now and are deliberately separate from Calendar data.
 */
export function useWeekNames(userId) {
  const storageKey = `times-activity-week-names:${userId || "guest"}`;
  const [weekNames, setWeekNames] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  });
  const [editingWeekKey, setEditingWeekKey] = useState(null);
  const [weekNameDraft, setWeekNameDraft] = useState("");
  const [loadedStorageKey, setLoadedStorageKey] = useState(storageKey);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
      setWeekNames(saved && typeof saved === "object" ? saved : {});
    } catch {
      setWeekNames({});
    }
    setEditingWeekKey(null);
    setWeekNameDraft("");
    setLoadedStorageKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(weekNames));
    } catch {
      // Storage can be unavailable in privacy-restricted browsing sessions.
    }
  }, [storageKey, weekNames, loadedStorageKey]);

  const startEditingWeekName = (date) => {
    const key = weekNameKey(date);
    setWeekNameDraft(weekNames[key] || defaultWeekName(date));
    setEditingWeekKey(key);
  };

  const commitWeekName = () => {
    if (!editingWeekKey) return;
    const date = new Date(`${editingWeekKey}T00:00:00`);
    const fallback = defaultWeekName(date);
    const trimmed = weekNameDraft.trim();
    setWeekNames((current) => {
      const next = { ...current };
      if (!trimmed || trimmed === fallback) delete next[editingWeekKey];
      else next[editingWeekKey] = trimmed;
      return next;
    });
    setEditingWeekKey(null);
  };

  const cancelWeekNameEdit = () => {
    setEditingWeekKey(null);
    setWeekNameDraft("");
  };

  return {
    weekNames,
    editingWeekKey,
    weekNameDraft,
    setWeekNameDraft,
    startEditingWeekName,
    commitWeekName,
    cancelWeekNameEdit
  };
}
