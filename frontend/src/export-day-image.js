// Export a single day's timeline as a downloadable PNG image — a static
// snapshot someone can keep open/print for a quick at-a-glance plan of the
// day, without needing the app open. Draws the same 24-hour grid + overlap
// layout as timeline-editor.jsx (via the shared timeline-layout.js), just
// onto an offscreen <canvas> instead of DOM elements, since there's no
// image-export library available in this project's dependency set.
import { activityDate, formatTime, formatMonthYear } from "./date-utils.js";
import { getDisplayColor } from "./activity-colors.js";
import { SNAP_MINUTES, minutesOfDay, minutesFromDayStart, layoutOverlaps, getIncomingSpillover } from "./timeline-layout.js";

const HOUR_HEIGHT = 44; // px per hour row in the exported image
const LABEL_COLUMN_WIDTH = 56;
const EVENT_AREA_RIGHT_MARGIN = 16;
const IMAGE_WIDTH = 720;
const HEADER_HEIGHT = 56;
const PADDING = 16;
const OVERLAP_GUTTER = 4;

const WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const WEEKDAY_FULL = {
  "อา": "อาทิตย์", "จ": "จันทร์", "อ": "อังคาร", "พ": "พุธ",
  "พฤ": "พฤหัสบดี", "ศ": "ศุกร์", "ส": "เสาร์"
};

/** Draws a rounded rectangle path — canvas has no built-in roundRect in every target browser, so do it manually. */
function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Renders `activities` (already filtered to the target day) onto a canvas
 * and returns it. Kept separate from the download step so callers (e.g. a
 * future "copy to clipboard" button) can reuse the same rendering.
 */
export function renderDayTimelineToCanvas({ day, activities, allActivities, categories, activityCategoryMap }) {
  const timedActivities = activities
    .filter((activity) => activityDate(activity.start))
    .sort((a, b) => activityDate(a.start) - activityDate(b.start));

  // Activity that started the day before `day` and whose end time bleeds
  // into `day` — drawn as a dimmed block at the top of the grid (see
  // drawing loop below), mirroring the same indicator TimelineEditor and
  // MiniTimelinePanel already show in the live UI. Looked up from
  // `allActivities` (the caller's full fetched range) rather than
  // `activities` (already filtered to just `day`), since by definition
  // this activity's own start date is yesterday, not `day` — `activities`
  // alone has no way to see it at all. Falls back to an empty list if the
  // caller doesn't pass allActivities, so existing callers that haven't
  // been updated yet don't break — they just won't show spillover.
  const incomingSpillover = (allActivities || [])
    .filter((activity) => activityDate(activity.start))
    .map((activity) => {
      const start = activityDate(activity.start);
      const end = activityDate(activity.end) || start;
      const spill = getIncomingSpillover(start, end, day);
      return spill ? { activity, spilloverEndMin: spill.spilloverEndMin } : null;
    })
    .filter(Boolean);

  const overlapLayout = layoutOverlaps([
    ...timedActivities.map((activity) => {
      const start = activityDate(activity.start);
      const end = activityDate(activity.end) || start;
      const startMin = minutesOfDay(start);
      const endMin = Math.max(startMin + SNAP_MINUTES, minutesFromDayStart(end, day));
      return { id: activity.id, startMin, endMin };
    }),
    // Spillover blocks get their own overlap-layout entries too (prefixed
    // id so they can't collide with a real activity id), so an early
    // morning activity that happens to overlap with yesterday's carryover
    // gets placed side-by-side instead of the two blocks drawing on top
    // of each other.
    ...incomingSpillover.map(({ activity, spilloverEndMin }) => ({
      id: `spillover-in-${activity.id}`,
      startMin: 0,
      endMin: Math.max(SNAP_MINUTES, spilloverEndMin)
    }))
  ]);

  const gridHeight = 25 * HOUR_HEIGHT; 
  const canvasHeight = HEADER_HEIGHT + gridHeight + PADDING * 2;

  // devicePixelRatio scaling so the exported PNG isn't blurry on high-DPI
  // screens — draw at native canvas size, then scale up the backing store.
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH * dpr;
  canvas.height = canvasHeight * dpr;
  canvas.style.width = `${IMAGE_WIDTH}px`;
  canvas.style.height = `${canvasHeight}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, IMAGE_WIDTH, canvasHeight);

  // Header: weekday + date
  ctx.fillStyle = "#3c4043";
  ctx.font = "600 16px 'Noto Sans Thai', 'Segoe UI', sans-serif";
  ctx.textBaseline = "alphabetic";
  const weekdayLabel = WEEKDAY_FULL[WEEKDAY_SHORT[day.getDay()]];
  ctx.fillText(`${weekdayLabel} ที่ ${day.getDate()} ${formatMonthYear(day)}`, PADDING, PADDING + 20);
  ctx.strokeStyle = "#dadce0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, HEADER_HEIGHT);
  ctx.lineTo(IMAGE_WIDTH - PADDING, HEADER_HEIGHT);
  ctx.stroke();

  const gridTop = HEADER_HEIGHT + PADDING;
  const gridLeft = PADDING + LABEL_COLUMN_WIDTH;
  const gridRight = IMAGE_WIDTH - PADDING - EVENT_AREA_RIGHT_MARGIN;
  const gridWidth = gridRight - gridLeft;

// Hour rows: label + horizontal line
  ctx.font = "10px 'Noto Sans Thai', 'Segoe UI', sans-serif";
  for (let h = 0; h <= 24; h++) {
    const y = gridTop + h * HOUR_HEIGHT;
    const timeLabel = h === 24 ? "24:00" : `${String(h).padStart(2, "0")}:00`;

    ctx.fillStyle = "#5f6368";
    ctx.textAlign = "right";
    ctx.fillText(timeLabel, gridLeft - 8, y + 4);
    ctx.strokeStyle = "#e8eaed";
    ctx.beginPath();
    ctx.moveTo(gridLeft, y);
    ctx.lineTo(gridRight, y);
    ctx.stroke();
  }
  ctx.textAlign = "left";

  // Incoming spillover blocks (activities carried over from the day
  // before) — drawn first, dimmed via globalAlpha and with a dashed
  // border, matching the same "carryover from last night" visual
  // convention TimelineEditor and MiniTimelinePanel use in the live UI.
  // Always anchored at the top of the grid (top === gridTop) since by
  // definition they start at minute 0 of `day`.
  for (const { activity, spilloverEndMin } of incomingSpillover) {
    const height = Math.max(14, (spilloverEndMin / 60) * HOUR_HEIGHT);
    const { column, columns } = overlapLayout[`spillover-in-${activity.id}`] || { column: 0, columns: 1 };
    const colWidth = (gridWidth - OVERLAP_GUTTER * (columns - 1)) / columns;
    const left = gridLeft + column * (colWidth + OVERLAP_GUTTER);
    const color = getDisplayColor(activity, activityCategoryMap, categories);

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = color.bg;
    roundRectPath(ctx, left, gridTop, colWidth, height, 4);
    ctx.fill();
    ctx.strokeStyle = color.border;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.fillStyle = color.border;
    ctx.fillRect(left, gridTop, 3, height); // left accent border, same as regular blocks

    ctx.beginPath();
    ctx.rect(left + 6, gridTop, colWidth - 8, height);
    ctx.clip();
    ctx.fillStyle = "#3c4043";
    ctx.font = "600 11px 'Noto Sans Thai', 'Segoe UI', sans-serif";
    ctx.fillText(`⤴ ${activity.summary || "(ไม่มีชื่อ)"}`, left + 8, gridTop + 13);
    if (height >= 26) {
      ctx.fillStyle = "#5f6368";
      ctx.font = "10px 'Noto Sans Thai', 'Segoe UI', sans-serif";
      ctx.fillText("ต่อจากเมื่อคืน", left + 8, gridTop + 25);
    }
    ctx.restore();
  }

  // Activity blocks
  for (const activity of timedActivities) {
    const start = activityDate(activity.start);
    const end = activityDate(activity.end) || start;
    const startMin = minutesOfDay(start);
    // Overnight activities (end falls on a later calendar day than start,
    // e.g. 20:00 → 02:00 the next day) must have their drawn block clamped
    // to midnight (1440), not computed via plain minutesOfDay(end) — that
    // wraps "02:00 next day" back down to 120, which is LESS than
    // startMin (1200), collapsing the block to a sliver instead of
    // extending it to the bottom of the grid. The displayed time label
    // below still shows the real end time ("20:00 – 02:00") since it
    // reads directly from the `end` Date object, not from endMin.
    const isOvernight = end.getFullYear() !== start.getFullYear() ||
      end.getMonth() !== start.getMonth() ||
      end.getDate() !== start.getDate();
    const endMin = isOvernight
      ? 1440
      : Math.max(startMin + SNAP_MINUTES, minutesOfDay(end));
    const top = gridTop + (startMin / 60) * HOUR_HEIGHT;
    const height = Math.max(14, ((endMin - startMin) / 60) * HOUR_HEIGHT);

    const { column, columns } = overlapLayout[activity.id] || { column: 0, columns: 1 };
    const colWidth = (gridWidth - OVERLAP_GUTTER * (columns - 1)) / columns;
    const left = gridLeft + column * (colWidth + OVERLAP_GUTTER);

    const color = getDisplayColor(activity, activityCategoryMap, categories);

    ctx.fillStyle = color.bg;
    roundRectPath(ctx, left, top, colWidth, height, 4);
    ctx.fill();
    ctx.fillStyle = color.border;
    ctx.fillRect(left, top, 3, height); // left accent border

    // Text (clip to the block so long titles don't spill into neighbors)
    ctx.save();
    ctx.beginPath();
    ctx.rect(left + 6, top, colWidth - 8, height);
    ctx.clip();
    ctx.fillStyle = "#3c4043";
    ctx.font = "600 11px 'Noto Sans Thai', 'Segoe UI', sans-serif";
    ctx.fillText(activity.summary || "(ไม่มีชื่อ)", left + 8, top + 13);
    if (height >= 26) {
      ctx.fillStyle = "#5f6368";
      ctx.font = "10px 'Noto Sans Thai', 'Segoe UI', sans-serif";
      ctx.fillText(`${formatTime(start)} – ${formatTime(end)}`, left + 8, top + 25);
    }
    ctx.restore();
  }

  if (timedActivities.length === 0 && incomingSpillover.length === 0) {
    ctx.fillStyle = "#5f6368";
    ctx.font = "13px 'Noto Sans Thai', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ไม่มีกิจกรรมตามเวลาในวันนี้", IMAGE_WIDTH / 2, gridTop + gridHeight / 2);
    ctx.textAlign = "left";
  }

  return canvas;
}

/**
 * Renders the day's timeline and immediately triggers a PNG download —
 * the one-call entry point the export button uses.
 */
export function downloadDayTimelineImage({ day, activities, allActivities, categories, activityCategoryMap }) {
  const canvas = renderDayTimelineToCanvas({ day, activities, allActivities, categories, activityCategoryMap });
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
      day.getDate()
    ).padStart(2, "0")}`;
    a.href = url;
    a.download = `แผนวัน-${dateStr}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}
