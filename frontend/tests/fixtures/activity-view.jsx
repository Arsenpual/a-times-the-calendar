import React, { useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useActivityView } from "../../src/features/activity/hooks/use-activity-view.js";
import { getYearCycle } from "../../src/shared/lib/date-utils.js";
import { useWeekNavigation } from "../../src/features/activity/hooks/use-week-navigation.js";
function Fixture() {
  const [userId, setUserId] = useState("account-a");
  const navigation = useWeekNavigation({ userId });
  const [cursorDate, setCursorDate] = useState(new Date(2026, 8, 12));
  const [dayOpen, setDayOpen] = useState(true);
  const selectWeek = useCallback(date => setCursorDate(new Date(date)), []);
  const closeDay = useCallback(() => setDayOpen(false), []);
  const view = useActivityView({ cursorDate, selectWeek, closeDay, userId });
  window.viewFixture = { view, cursorDate, dayOpen, getYearCycle, flushSync, userId, setUserId, navigation };
  return <p>{view.activityHeaderTitle}</p>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
