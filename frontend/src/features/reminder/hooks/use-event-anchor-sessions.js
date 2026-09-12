import { useMemo } from "react";
import { deriveEventAnchorSessions } from "../lib/event-anchor-session.js";

/** View-only sessions refresh with the Reminder clock; source reminders stay canonical. */
export function useEventAnchorSessions(reminders, nowTick) {
  return useMemo(() => deriveEventAnchorSessions(reminders, nowTick), [reminders, nowTick]);
}
