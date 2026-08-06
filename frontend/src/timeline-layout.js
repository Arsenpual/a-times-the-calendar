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
