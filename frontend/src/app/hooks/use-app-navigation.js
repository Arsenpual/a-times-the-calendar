import { useState } from "react";

/** App-level navigation and transient overlays; resets on page reload. */
export function useAppNavigation() {
  const [mode, setMode] = useState("activity");
  const [settingsOpen, setSettingsOpen] = useState(false);
  return { mode, setMode, settingsOpen, setSettingsOpen };
}
