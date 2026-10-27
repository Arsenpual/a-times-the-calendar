import React, { lazy, useEffect } from "react";
import ActivityModeMockupPreview from "./activity-mode-mockup-preview.jsx";
import "./activity-mode-mockup-support.css";

const ACTIVITY_MODE_MOCKUPS = Object.entries(import.meta.glob("./activity-mode-*-mockup.jsx"))
  .map(([path, loadModule]) => {
    const id = (path.split("/").pop() || "mockup.jsx").replace(/\.jsx$/, "");
    return {
      id,
      label: id.replace(/^activity-mode-/, "").replace(/-mockup$/, "").replace(/-/g, " "),
      Component: lazy(loadModule),
    };
  });

export function isDevMockupRequest() {
  return new URLSearchParams(window.location.search).has("activity-mode-mockup");
}

export function DevMockupRoute() {
  return <ActivityModeMockupPreview mockups={ACTIVITY_MODE_MOCKUPS} />;
}

export function useDevMockupShortcut() {
  useEffect(() => {
    const openMockupMode = (event) => {
      const target = event.target;
      if (
        target?.tagName === "INPUT"
        || target?.tagName === "TEXTAREA"
        || target?.isContentEditable
        || !event.ctrlKey
        || !event.altKey
        || !["KeyW", "KeyA"].includes(event.code)
      ) return;

      event.preventDefault();
      const url = new URL(window.location.href);
      url.searchParams.set("activity-mode-mockup", "1");
      if (event.code === "KeyA") url.searchParams.set("mockup", "activity-mode-ai-workspace-mockup");
      window.open(
        url.toString(),
        "times-activity-mode-mockups",
        `popup=yes,width=${window.screen.availWidth},height=${window.screen.availHeight}`,
      )?.focus();
    };

    window.addEventListener("keydown", openMockupMode);
    return () => window.removeEventListener("keydown", openMockupMode);
  }, []);
}
