import { useEffect, useState } from "react";

/**
 * Ephemeral Week Spine UI only: selected day, warning toast, right-click
 * popup, and summary-target hover. Calendar/activity state lives elsewhere.
 */
export function useWeekSpineUiState({ anchorDate, onSelectDay }) {
  const [selectedDay, setSelectedDay] = useState(anchorDate);
  const [interactionWarning, setInteractionWarning] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [isSummaryTargetHovered, setIsSummaryTargetHovered] = useState(false);

  useEffect(() => {
    if (!interactionWarning) return undefined;
    const timeout = window.setTimeout(() => setInteractionWarning(""), 5500);
    return () => window.clearTimeout(timeout);
  }, [interactionWarning]);

  useEffect(() => {
    if (!interactionWarning && !contextMenu) return undefined;
    const dismissTransientUi = (event) => {
      if (event.target instanceof Element && event.target.closest(".error-banner, .activity-popup")) return;
      setInteractionWarning("");
      setContextMenu(null);
    };
    document.addEventListener("pointerdown", dismissTransientUi, true);
    document.addEventListener("focusin", dismissTransientUi, true);
    return () => {
      document.removeEventListener("pointerdown", dismissTransientUi, true);
      document.removeEventListener("focusin", dismissTransientUi, true);
    };
  }, [interactionWarning, contextMenu]);

  const selectDay = (day) => {
    setSelectedDay(day);
    onSelectDay?.(day);
  };

  return {
    selectedDay,
    selectDay,
    setSelectedDay,
    interactionWarning,
    showInteractionWarning: setInteractionWarning,
    contextMenu,
    setContextMenu,
    isSummaryTargetHovered,
    setIsSummaryTargetHovered
  };
}
