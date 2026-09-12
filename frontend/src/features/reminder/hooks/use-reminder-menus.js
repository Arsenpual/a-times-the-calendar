import { useState } from "react";

/** Card menu and due-banner snooze menu UI only; reminder mutations stay outside. */
export function useReminderMenus() {
  const [cardMenu, setCardMenu] = useState(null);
  const [snoozeMenuForId, setSnoozeMenuForId] = useState(null);

  const closeCardMenu = () => setCardMenu(null);
  const closeSnoozeMenu = () => setSnoozeMenuForId(null);
  const closeAllMenus = () => {
    closeCardMenu();
    closeSnoozeMenu();
  };

  const toggleCardMenu = (event, reminderId) => {
    event.stopPropagation();
    if (cardMenu?.id === reminderId) {
      closeCardMenu();
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    setCardMenu({
      id: reminderId,
      position: {
        x: Math.max(8, Math.min(bounds.right - 118, window.innerWidth - 126)),
        y: Math.max(8, Math.min(bounds.bottom + 4, window.innerHeight - 142))
      }
    });
  };

  const toggleSnoozeMenu = (reminderId) => {
    setSnoozeMenuForId(snoozeMenuForId === reminderId ? null : reminderId);
  };

  return {
    cardMenu, snoozeMenuForId,
    toggleCardMenu, toggleSnoozeMenu,
    closeCardMenu, closeSnoozeMenu, closeAllMenus
  };
}
