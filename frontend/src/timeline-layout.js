// Shared layout math for anything that renders activities as absolutely-
// positioned blocks on a 24-hour day grid (timeline-editor.jsx's drag-editor
// grid, and mini-timeline-panel.jsx's read-only mini timeline). Centralized
// here so both views compute overlap columns identically — copy-pasting this
// into each file risked the same drift problem normalizeActivityId had
// before it was centralized in id-utils.js.

export const SNAP_MINUTES = 15;
export const MAX_OVERLAP_STACKS = 3;
const TITLE_CLEARANCE_MINUTES = 30;

/** Minutes since local midnight, clamped to the 0–1440 day range. */
export function minutesOfDay(date) {
  return Math.min(1440, Math.max(0, date.getHours() * 60 + date.getMinutes()));
}

/**
 * Minutes from `day`'s own midnight to `date`, WITHOUT wrapping back to
 * 0-1440 the way minutesOfDay does — so a `date` that's actually on the
 * next calendar day (e.g. 02:00 the day after `day`) correctly returns
 * something like 1560, not 120. Used specifically for an activity's *end*
 * time when it may run past midnight (drag/resize in the editor, and
 * rendering the resulting block) — using plain minutesOfDay there would
 * make the block appear to wrap back to the top of the grid instead of
 * extending past the bottom. Not used for *start* times: an activity's
 * start always belongs to the day it's rendered on by definition.
 * Negative values (date before day's midnight) are clamped to 0.
 * @param {Date} date
 * @param {Date} day the reference day (its own time-of-day is ignored, only Y/M/D matter)
 */
export function minutesFromDayStart(date, day) {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((date - dayStart) / 60000));
}

/**
 * Lays out overlapping activities side by side: activities are grouped into
 * clusters of mutually-overlapping time ranges, then assigns lanes. Visual
 * consumers render them as at most three offset, stacked building cards;
 * further lanes are represented by a +N badge on the third card.
 * @param {Array<{id: string, startMin: number, endMin: number}>} entries
 */
export function layoutOverlaps(entries) {
  const sorted = [...entries].sort((a, b) => a.startMin - b.startMin);
  const layout = {};
  let cluster = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const ordered = [...cluster].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
    const columns = [];
    const assigned = new Map();
    for (const entry of ordered) {
      let col = columns.findIndex((lane) => lane.every((other) => other.endMin <= entry.startMin || other.startMin >= entry.endMin));
      if (col === -1) {
        col = columns.length;
        columns.push([]);
      }
      columns[col].push(entry);
      assigned.set(entry.id, col);
    }
    const totalColumns = columns.length;
    const longestDuration = Math.max(...cluster.map((entry) => entry.endMin - entry.startMin));
    for (const entry of cluster) {
      const column = assigned.get(entry.id);
      const duration = entry.endMin - entry.startMin;
      // Find the first 30-minute vertical slot that isn't covered by a
      // shorter (therefore visually higher) activity. The title keeps its
      // top position when clear, moves inside the long block when possible,
      // and only goes below the block when every usable position is covered.
      const blockers = cluster
        .filter((candidate) => {
          if (candidate.id === entry.id) return false;
          const candidateDuration = candidate.endMin - candidate.startMin;
          return candidateDuration < duration && candidate.endMin > entry.startMin && candidate.startMin < entry.endMin;
        })
        .map((candidate) => ({
          start: Math.max(entry.startMin, candidate.startMin),
          end: Math.min(entry.endMin, candidate.endMin)
        }))
        .sort((a, b) => a.start - b.start);
      let titleStart = entry.startMin;
      for (const blocker of blockers) {
        if (titleStart + TITLE_CLEARANCE_MINUTES <= blocker.start) break;
        titleStart = Math.max(titleStart, blocker.end);
      }
      const titleBelow = titleStart + TITLE_CLEARANCE_MINUTES > entry.endMin;
      const titleOffsetMinutes = titleBelow ? null : titleStart - entry.startMin;
      const hiddenCount = column === MAX_OVERLAP_STACKS - 1
        ? cluster.filter((candidate) => assigned.get(candidate.id) >= MAX_OVERLAP_STACKS).length
        : 0;
      layout[entry.id] = {
        column,
        columns: totalColumns,
        stackIndex: Math.min(column, MAX_OVERLAP_STACKS - 1),
        hidden: column >= MAX_OVERLAP_STACKS,
        hiddenCount,
        // Shorter blocks sit visually on top. `titleOffsetMinutes` lets the
        // rendered label move out of a covered part of the long card.
        stackZ: Math.round(longestDuration - duration) + 1,
        titleBelow,
        titleOffsetMinutes
      };
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const entry of sorted) {
    if (cluster.length > 0 && entry.startMin >= clusterEnd) {
      flushCluster();
    }
    cluster.push(entry);
    clusterEnd = Math.max(clusterEnd, entry.endMin);
  }
  flushCluster();

  return layout;
}

/**
 * True if `activity` starts on `day` but its end time falls on a later
 * calendar day (e.g. 20:00 → 02:00 the next day) — used to render the
 * overflowing tail as a dimmed "spillover" indicator instead of silently
 * clamping/clipping the block at midnight.
 *
 * Only the *start* day is checked against `day` here; multi-day spillover
 * (an activity lasting more than 24h) still only ever shows a spillover
 * indicator on the single day right after the start day — see
 * getIncomingSpillover for the reverse direction.
 * @param {Date} start
 * @param {Date} end
 * @param {Date} day the day this activity is being rendered on
 */
export function getOutgoingSpillover(start, end, day) {
  if (!start || !end || end <= start) return null;
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  if (end <= dayEnd) return null; // ends same day, nothing spills over
  // Minutes of the *next* day's portion, capped at 24h so a multi-day
  // activity doesn't render an absurdly tall/long spillover block — it's
  // just an indicator, the real times are still fully preserved on the
  // underlying Google Calendar event regardless of how it's drawn.
  const spilloverMinutes = Math.min(1440, Math.round((end - dayEnd) / 60000));
  return { spilloverMinutes };
}

/**
 * True if `activity` (given its real start/end) started on the *previous*
 * calendar day and spills into `day` — the reverse of getOutgoingSpillover,
 * used to render the dimmed "leftover from last night" block at the top of
 * `day`'s grid. Returns the portion of `day` (in minutes from midnight)
 * that the activity actually occupies, capped at 24h.
 * @param {Date} start
 * @param {Date} end
 * @param {Date} day
 */
export function getIncomingSpillover(start, end, day) {
  if (!start || !end || end <= start) return null;
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  if (start >= dayStart) return null; // starts on or after `day`, not a spillover
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  if (end <= dayStart) return null; // already fully over before `day` even starts
  const occupiedEnd = end < dayEnd ? end : dayEnd;
  const spilloverEndMin = Math.max(0, Math.round((occupiedEnd - dayStart) / 60000));
  return { spilloverEndMin: Math.min(1440, spilloverEndMin) };
}
