import { useEffect, useState } from "react";

export function useActivityContextMenu() {
  const [activityContextMenu, setActivityContextMenu] = useState(null);

  useEffect(() => {
    if (!activityContextMenu) return undefined;

    const closeActivityContextMenu = (event) => {
      if (event.target instanceof Element && event.target.closest(".activity-popup")) return;
      setActivityContextMenu(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setActivityContextMenu(null);
    };
    document.addEventListener("pointerdown", closeActivityContextMenu, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeActivityContextMenu, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [activityContextMenu]);

  const openActivityContextMenu = (event, block) => {
    event.preventDefault();
    event.stopPropagation();
    setActivityContextMenu({
      block,
      position: {
        // ActivityPopup owns its final collision handling after it knows its
        // actual rendered size. Keep the true pointer location here.
        x: event.clientX,
        y: event.clientY
      }
    });
  };

  return { activityContextMenu, openActivityContextMenu };
}
