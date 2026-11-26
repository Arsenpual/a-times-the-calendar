import React, { Suspense, useEffect, useState } from "react";
import "./styles/cozy-desk.css";

const CozyDeskApp = React.lazy(() => import("./CozyDeskApp"));

export default function CozyDeskMode({
  isVisible,
  firebaseUser,
  activities = [],
  archivedActivityIds,
  navigationExpanded = false,
  onToggleNavigation,
}) {
  // Mount lazily on first visit to Cozy Desk mode, then stay mounted while hidden
  // (like Reminder Mode) so scheduled Mina tasks, character positions, and TV state persist.
  const [hasActivated, setHasActivated] = useState(Boolean(isVisible));

  useEffect(() => {
    if (isVisible && !hasActivated) {
      setHasActivated(true);
    }
  }, [isVisible, hasActivated]);

  if (!hasActivated) return null;

  return (
    <div
      className="cozy-desk-runtime"
      hidden={!isVisible}
      aria-hidden={!isVisible}
      style={{ flex: 1, minHeight: 0, display: isVisible ? "flex" : "none", flexDirection: "column", overflow: "hidden" }}
    >
      <Suspense
        fallback={
          <div className="cozy-desk-mode flex h-full w-full items-center justify-center bg-[#1C1917] text-sm text-[#FAF6F0]">
            กำลังเปิดบ้าน Cozy Desk...
          </div>
        }
      >
        <CozyDeskApp
          isVisible={isVisible}
          firebaseUser={firebaseUser}
          activities={activities}
          archivedActivityIds={archivedActivityIds}
          navigationExpanded={navigationExpanded}
          onToggleNavigation={onToggleNavigation}
        />
      </Suspense>
    </div>
  );
}
