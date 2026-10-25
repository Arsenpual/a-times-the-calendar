import { useCallback, useState } from "react";

/** App-level navigation and transient overlays; resets on page reload. */
export function useAppNavigation() {
  const [navigation, setNavigation] = useState({ mode: "activity", returnMode: "activity" });
  const setMode = useCallback((value) => setNavigation((current) => {
    const mode = typeof value === "function" ? value(current.mode) : value;
    if (!["activity", "reminder", "ai"].includes(mode)) return current;
    return { mode, returnMode: mode === "ai" ? (current.mode === "ai" ? current.returnMode : current.mode) : mode };
  }), []);
  const closeAiMode = useCallback(() => setNavigation(current => current.mode === "ai" ? { ...current, mode: current.returnMode } : current), []);
  const toggleAiMode = useCallback(() => setNavigation(current => current.mode === "ai"
    ? { ...current, mode: current.returnMode }
    : { mode: "ai", returnMode: current.mode }), []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  return { mode: navigation.mode, setMode, closeAiMode, toggleAiMode, settingsOpen, setSettingsOpen };
}
