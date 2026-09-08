import { reminderSlotsOnDate, localDateKey } from "./reminder-date-view.js";
import { activityDate } from "../../../shared/lib/date-utils.js";
import { getDisplayColor } from "../../activity/lib/activity-colors.js";

const WIDTH = 1080;
const HEIGHT = 1528;
const TOP = 160;
const FONT = "'Noto Sans Thai', 'Segoe UI', sans-serif";
const timeLabel = (minute) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(Math.floor(minute % 60)).padStart(2, "0")}`;

function text(ctx, value, x, y, width, size = 14, color = "#1c1c1a") {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px ${FONT}`;
  let label = String(value || "(ไม่มีชื่อ)");
  while (label.length > 1 && ctx.measureText(label).width > width) label = label.slice(0, -2) + "…";
  ctx.fillText(label, x, y);
}

// Keep every reminder on the page. Labels may move to avoid collisions;
// connector endpoints always retain their exact position on the time axis.
export function renderReminderTimelineToCanvas({
  reminders = [], activities = [], categories = [], activityCategoryMap = {},
  groups = [], date = new Date(), activeTypeFilter = null, activeGroupFilter = null
}) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const minute = (ms) => (ms - dayStart.getTime()) / 60000;
  const entries = reminders.filter(r => r.enabled && !r.completedAt && r.type !== "interval" &&
    (!activeTypeFilter || r.type === activeTypeFilter) &&
    (!activeGroupFilter || r.groupId === activeGroupFilter))
    .flatMap(reminder => reminderSlotsOnDate(reminder, date).map(at => ({ reminder, at })))
    .sort((a, b) => a.at - b.at);
  const blocks = activities.flatMap(activity => {
    if (activity.archived || activity.isArchived || activity.status === "cancelled") return [];
    const start = activityDate(activity.start);
    const end = activityDate(activity.end);
    if (!start || !end || !Number.isFinite(+start) || !Number.isFinite(+end) ||
        +end <= +dayStart || +start >= +dayEnd || +end <= +start) return [];
    return [{ activity, start: Math.max(0, minute(+start)), end: Math.min(1440, minute(+end)) }];
  }).sort((a, b) => a.start - b.start || a.end - b.end);

  // Reserve a two-column legend inside the same portrait page.
  const legendRows = Math.ceil(blocks.length / 2);
  const legendRowHeight = Math.min(25, 280 / Math.max(1, legendRows));
  const bottom = HEIGHT - 100 - legendRows * legendRowHeight;
  const yAt = m => TOP + Math.max(0, Math.min(1440, m)) / 1440 * (bottom - TOP);

  // Separate intersecting activities within the central column.
  const laneEnds = [];
  blocks.forEach(block => {
    let lane = laneEnds.findIndex(end => end <= block.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = block.end;
    block.lane = lane;
  });
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * 2;
  canvas.height = HEIGHT * 2;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  text(ctx, "T.i.M.E.S. / DAILY TIMELINE", 40, 49, 1000, 25);
  text(ctx, new Intl.DateTimeFormat("th-TH", { dateStyle: "full" }).format(date), 40, 82, 1000, 18);
  const group = groups.find(g => g.id === activeGroupFilter);
  text(ctx, [activeTypeFilter, group?.name, `${blocks.length} Activity · ${entries.length} Reminder`].filter(Boolean).join(" · "), 40, 110, 1000, 13, "#8a8a85");
  text(ctx, "REMINDER", 40, 140, 300, 11, "#8a8a85");
  text(ctx, "ACTIVITY", 487, 140, 180, 11, "#8a8a85");
  text(ctx, "REMINDER", 737, 140, 300, 11, "#8a8a85");

  for (let hour = 0; hour <= 24; hour++) {
    const y = yAt(hour * 60);
    ctx.strokeStyle = "#e4e2dc";
    ctx.beginPath(); ctx.moveTo(529, y); ctx.lineTo(551, y); ctx.stroke();
    text(ctx, timeLabel(hour * 60), 479, y + 4, 46, 11, "#8a8a85");
  }
  // White gaps are intentional: only scheduled activity paints the spine.
  // Concurrent activities have adjacent thin stripes, retaining every color.
  const spineWidth = 18;
  const laneWidth = spineWidth / Math.max(1, laneEnds.length);
  blocks.forEach(({ activity, start, end, lane }) => {
    const color = getDisplayColor(activity, activityCategoryMap, categories);
    const x = 540 - spineWidth / 2 + lane * laneWidth;
    const y = yAt(start);
    const h = yAt(end) - y;
    ctx.fillStyle = color.border || "#d85a30";
    ctx.fillRect(x, y, laneWidth, h);
  });

  // Each section is one chronological pair: RIGHT first, LEFT second.
  // Move the pair together so dense reminders cannot reverse reading order.
  const pairs = [];
  for (let index = 0; index < entries.length; index += 2) {
    pairs.push(entries.slice(index, index + 2));
  }
  const slotHeight = Math.min(72, (bottom - TOP) / Math.max(1, pairs.length));
  const labelHeight = Math.max(1, slotHeight - 6);
  const positions = pairs.map(pair => yAt(pair[0].at) - labelHeight / 2);
  for (let i = 0; i < pairs.length; i++) {
    positions[i] = Math.max(TOP, positions[i], i ? positions[i - 1] + slotHeight : TOP);
  }
  for (let i = pairs.length - 1; i >= 0; i--) {
    positions[i] = Math.min(positions[i], i === pairs.length - 1
      ? bottom - labelHeight : positions[i + 1] - slotHeight);
  }
  const placedLabels = [];
  const placedRoutes = [];
  // Score routes against padded label bounds, including earlier connectors
  // against the new label. Sampling covers both segments of each connector.
  const hitsLabel = (route, bounds) => {
    for (let segment = 1; segment < route.length; segment++) {
      const [x0, y0] = route[segment - 1];
      const [x1, y1] = route[segment];
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3));
      for (let step = 0; step <= steps; step++) {
        const x = x0 + (x1 - x0) * step / steps;
        const y = y0 + (y1 - y0) * step / steps;
        if (x > bounds.left && x < bounds.right && y > bounds.top && y < bounds.bottom) return true;
      }
    }
    return false;
  };
  pairs.forEach((pair, pairIndex) => {
    pair.forEach(({ reminder, at }, index) => {
      const right = index === 0;
      const axisEdge = right ? 551 : 529;
      const top = positions[pairIndex];
      const labelBottom = top + labelHeight;
      const fontSize = Math.min(18, Math.max(1, (labelHeight - 12) / 2.5));
      ctx.font = `500 ${fontSize}px ${FONT}`;
      const titleWidth = ctx.measureText(reminder.title || "(ไม่มีชื่อ)").width;
      // Try shorter and longer X spans; preserve room for the title and
      // keep both the text and its endpoint within the page margin.
      const candidates = [0, -48, 48, -96, 96].flatMap(offset => {
        const edge = right ? 745 + offset : 335 - offset;
        const width = Math.min(340, right ? WIDTH - 40 - edge : edge - 40);
        const bounds = {
          left: right ? edge - 5 : edge - Math.min(width, titleWidth) - 5,
          right: right ? edge + Math.min(width, titleWidth) + 5 : edge + 5,
          top: labelBottom - fontSize * 2 - 18,
          bottom: labelBottom - 4
        };
        // Independently move the start/end of the diagonal. This changes its
        // length and slope without moving the timestamp or chronological pair.
        return [0.35, 0.15, 0.6, 0.8].flatMap(fraction => [0, 24, 48].map(tail => {
        const bend = axisEdge + (edge - axisEdge) * fraction;
        const landing = right ? Math.max(bend + 12, edge - tail) : Math.min(bend - 12, edge + tail);
        const route = [[axisEdge, yAt(at)], [bend, yAt(at)], [landing, labelBottom], [edge, labelBottom]];
        const collisions = placedLabels.filter(b => hitsLabel(route, b)).length +
          placedRoutes.filter(r => hitsLabel(r, bounds)).length +
          placedLabels.filter(b => bounds.left < b.right && bounds.right > b.left && bounds.top < b.bottom && bounds.bottom > b.top).length;
        return { edge, width, bounds, route, score: collisions * 10000 + Math.max(0, titleWidth - width) * 2 + Math.abs(offset) + Math.abs(fraction - 0.35) * 10 + tail * 0.1 };
        }));
      });
      candidates.sort((a, b) => a.score - b.score);
      const { edge, width, bounds, route } = candidates[0];
      placedLabels.push(bounds);
      placedRoutes.push(route);
      const color = reminder.lineColor || "#d85a30";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(...route[0]);
      route.slice(1).forEach(point => ctx.lineTo(...point));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#d85a30";
      ctx.fillRect(edge - 4, labelBottom - 4, 8, 8);
      ctx.save();
      // Mirror alignment around the endpoints, rather than the text boxes.
      ctx.textAlign = right ? "left" : "right";
      text(ctx, timeLabel(at), edge, labelBottom - fontSize - 14, width, Math.min(12, fontSize), color);
      text(ctx, reminder.title, edge, labelBottom - 8, width, fontSize);
      ctx.restore();
    });
  });
  if (!entries.length && !blocks.length) text(ctx, "ไม่มีรายการตามวันที่และตัวกรองที่เลือก", 350, 760, 600, 18);

  const legendTop = bottom + 38;
  text(ctx, "สีแกนกลาง / Activity · อ่าน Reminder ขวา → ซ้าย แล้วลงคู่ถัดไป", 40, legendTop, 1000, 12, "#8a8a85");
  blocks.forEach(({ activity, start, end }, index) => {
    const x = 40 + (index % 2) * 505;
    const y = legendTop + 24 + Math.floor(index / 2) * legendRowHeight;
    const color = getDisplayColor(activity, activityCategoryMap, categories);
    ctx.fillStyle = color.border || "#d85a30";
    ctx.fillRect(x, y - Math.min(10, legendRowHeight / 2), 10, Math.min(10, legendRowHeight / 2));
    text(ctx, `${timeLabel(start)}–${timeLabel(end)} · ${activity.summary || "(ไม่มีชื่อ)"}`,
      x + 18, y, 475, Math.min(12, legendRowHeight * 0.65));
  });
  text(ctx, localDateKey(date), 40, HEIGHT - 18, 1000, 11, "#8a8a85");
  return canvas;
}

export async function downloadReminderTimelineImage(options) {
  await document.fonts?.ready;
  const canvas = renderReminderTimelineToCanvas(options);
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reminder-timeline-${localDateKey(options.date || new Date())}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}
