const MAX_OVERLAPPING_ACTIVITIES = 3;
const SNAP_MINUTES = 15;

function localStamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  return new Date(`${value}:00Z`).getTime();
}

function normalizeScheduleContext(raw) {
  const activities = Array.isArray(raw?.activities) ? raw.activities.slice(0, 80) : [];
  return activities.map((item) => ({
    id: String(item?.id || "").slice(0, 240),
    title: String(item?.title || "(ไม่มีชื่อกิจกรรม)").slice(0, 200),
    startLocal: typeof item?.startLocal === "string" ? item.startLocal.slice(0, 16) : "",
    endLocal: typeof item?.endLocal === "string" ? item.endLocal.slice(0, 16) : "",
    locked: Boolean(item?.locked)
  })).filter((item) => Number.isFinite(localStamp(item.startLocal)) && Number.isFinite(localStamp(item.endLocal)) && localStamp(item.endLocal) > localStamp(item.startLocal));
}

function concurrentCount(candidateStart, candidateEnd, activities) {
  const edges = [
    { time: candidateStart, delta: 1 },
    { time: candidateEnd, delta: -1 },
    ...activities.flatMap((activity) => [{ time: localStamp(activity.startLocal), delta: 1 }, { time: localStamp(activity.endLocal), delta: -1 }])
  ];
  // Ending at the same instant is not an overlap, matching Week Spine.
  edges.sort((left, right) => left.time - right.time || left.delta - right.delta);
  let active = 0;
  let max = 0;
  for (const edge of edges) { active += edge.delta; max = Math.max(max, active); }
  return max;
}

function localDateTime(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 16);
}

function findAlternatives(start, duration, activities) {
  const candidates = [];
  for (const delta of [-120, -90, -60, -30, 30, 60, 90, 120, 150, 180]) {
    const proposedStart = start + delta * 60_000;
    const proposedEnd = proposedStart + duration;
    if (concurrentCount(proposedStart, proposedEnd, activities) <= MAX_OVERLAPPING_ACTIVITIES) {
      candidates.push({ startLocal: localDateTime(proposedStart), endLocal: localDateTime(proposedEnd) });
      if (candidates.length === 3) break;
    }
  }
  return candidates;
}

function assessDraftSchedule(draft, scheduleContext) {
  const start = localStamp(draft?.startLocal);
  const end = localStamp(draft?.endLocal);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || draft?.allDay) return { status: "not-applicable", conflicts: [], alternatives: [] };
  const activities = normalizeScheduleContext(scheduleContext);
  const conflicts = activities.filter((activity) => localStamp(activity.startLocal) < end && localStamp(activity.endLocal) > start);
  const maximum = concurrentCount(start, end, activities);
  if (maximum <= MAX_OVERLAPPING_ACTIVITIES) return { status: "available", conflicts, alternatives: [] };
  return {
    status: "overlap-limit",
    conflicts: conflicts.map(({ id, title, startLocal, endLocal, locked }) => ({ id, title, startLocal, endLocal, locked })),
    alternatives: findAlternatives(start, end - start, activities)
  };
}

module.exports = { MAX_OVERLAPPING_ACTIVITIES, normalizeScheduleContext, assessDraftSchedule };
