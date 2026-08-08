// Shared layout math for anything that renders activities as absolutely-
// positioned blocks on a 24-hour day grid (timeline-editor.jsx's drag-editor
// grid, and mini-timeline-panel.jsx's read-only mini timeline). Centralized
// here so both views compute overlap columns identically — copy-pasting this
// into each file risked the same drift problem normalizeActivityId had
// before it was centralized in id-utils.js.

export const SNAP_MINUTES = 15;

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
 * clusters of mutually-overlapping time ranges, then within each cluster
 * assigned to columns left-to-right ordered by duration ascending — so the
 * activity that takes the most time ends up in the rightmost column, per
 * the proposal's overlap rule. Returns a map of activityId -> { column,
 * columns } where `columns` is the total column count for that activity's
 * cluster.
 * @param {Array<{id: string, startMin: number, endMin: number}>} entries
 */
export function layoutOverlaps(entries) {
  const sorted = [...entries].sort((a, b) => a.startMin - b.startMin);
  const layout = {};
  let cluster = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    // Order columns left-to-right by ascending duration, so the longest
    // activity lands in the rightmost column.
    const ordered = [...cluster].sort((a, b) => (a.endMin - a.startMin) - (b.endMin - b.startMin));
    const columnEnds = []; // tracks the latest endMin occupied in each column
    const assigned = {};
    for (const entry of ordered) {
      let col = columnEnds.findIndex((end) => end <= entry.startMin);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(entry.endMin);
      } else {
        columnEnds[col] = entry.endMin;
      }
      assigned[entry.id] = col;
    }
    const totalColumns = columnEnds.length;
    for (const entry of cluster) {
      layout[entry.id] = { column: assigned[entry.id], columns: totalColumns };
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
