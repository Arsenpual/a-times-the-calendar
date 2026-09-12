import { useEffect, useState } from "react";

/**
 * Folder-like multi-selection for Week Spine.
 * Selection deliberately does not own drag state: it only supplies the set
 * used by the drag hook/component when a batch move or resize is requested.
 */
export function useWeekSpineSelection({ onDeleteActivity, onError }) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedActivityIds, setSelectedActivityIds] = useState(() => new Set());

  const toggleActivitySelection = (activityId) => {
    setSelectedActivityIds((current) => {
      const next = new Set(current);
      next.has(activityId) ? next.delete(activityId) : next.add(activityId);
      return next;
    });
  };

  const addActivitySelection = (activityId) => {
    setIsSelectionMode(true);
    setSelectedActivityIds((current) => new Set(current).add(activityId));
  };

  const clearSelection = () => {
    setSelectedActivityIds(new Set());
    setIsSelectionMode(false);
  };

  useEffect(() => {
    const handleSelectionKeys = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable)) return;
      if (event.key === "Escape" && selectedActivityIds.size) {
        clearSelection();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedActivityIds.size) {
        event.preventDefault();
        if (!window.confirm(`ลบกิจกรรมที่เลือก ${selectedActivityIds.size} รายการใช่ไหม?`)) return;
        const ids = [...selectedActivityIds];
        clearSelection();
        Promise.all(ids.map((id) => onDeleteActivity?.(id)))
          .catch((error) => onError?.(error?.message || "ลบบางกิจกรรมไม่สำเร็จ"));
      }
    };
    window.addEventListener("keydown", handleSelectionKeys);
    return () => window.removeEventListener("keydown", handleSelectionKeys);
  }, [selectedActivityIds, onDeleteActivity, onError]);

  return {
    isSelectionMode,
    selectedActivityIds,
    setIsSelectionMode,
    toggleActivitySelection,
    addActivitySelection,
    clearSelection
  };
}
