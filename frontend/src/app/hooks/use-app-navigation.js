import { useState } from "react";

/** App-level navigation and transient overlays; resets on page reload. */
export function useAppNavigation() {
  const [mode, setMode] = useState("activity");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLoginGuide, setShowLoginGuide] = useState(true);
  return { mode, setMode, settingsOpen, setSettingsOpen, showLoginGuide, setShowLoginGuide };
}
