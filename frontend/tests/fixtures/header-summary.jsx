import "../../src/app/styles/app-header.css";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import HeaderSummary from "../../src/features/activity/components/header-summary.jsx";
function Fixture() {
  const [period, setPeriod] = useState("day");
  const date = new Date(2026, 8, 7);
  return <HeaderSummary period={period} onPeriodChange={setPeriod} date={date} activities={[
    { id: "night", start: { dateTime: new Date(2026, 8, 6, 23).toISOString() }, end: { dateTime: new Date(2026, 8, 7, 1).toISOString() } },
    { id: "all", start: { date: "2026-09-07" }, end: { date: "2026-09-08" } },
    { id: "archived", start: { dateTime: new Date(2026, 8, 7, 9).toISOString() }, end: { dateTime: new Date(2026, 8, 7, 10).toISOString() } }
  ]} archivedActivityIds={new Set(["archived"])} connected loading={false} categories={[]} activityCategoryMap={{}} weeklySummary={{ totalActivities: 4, byCategory: [] }} weeklyLoading={false} weeklyError="" cycleAnchor={date} cycleData={{ activities: [], loading: false, error: "" }} />;
}
createRoot(document.getElementById("root")).render(<Fixture />);
