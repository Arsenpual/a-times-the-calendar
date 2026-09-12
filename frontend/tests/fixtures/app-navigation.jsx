import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useAppNavigation } from "../../src/app/hooks/use-app-navigation.js";
import { useDisplayPreferences } from "../../src/features/settings/hooks/use-display-preferences.js";
import { useWeekNavigation } from "../../src/features/activity/hooks/use-week-navigation.js";
function Fixture() {
  const app = useAppNavigation();
  const preferences = useDisplayPreferences();
  const nav = useWeekNavigation({ mode: app.mode });
  window.fixture = { app, preferences, nav, flushSync };
  return <><p>{app.mode}</p><input aria-label="typing" /></>;
}
const root = createRoot(document.getElementById("root"));
window.unmountFixture = () => flushSync(() => root.unmount());
root.render(<Fixture />);
