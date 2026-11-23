import {
  MAILBOX_RECT,
  MID_WALL_ROW,
  PORCH_PLANTER_RECT,
  SLEEP_STATION_RECT,
  TILE,
  WEST_DIVIDER_COL,
} from './houseMap';
import { pxRect } from './westBedroomRenderer';

/**
 * Draws the interactive Roadside Family Mailbox mounted at the concrete sidewalk curb
 * beside the front crosswalk & street. Raises the red mail flag and peeks a crisp
 * white envelope when unread Gmail messages arrive.
 */
export function drawRoadsideMailbox(
  ctx: CanvasRenderingContext2D,
  tick: number,
  unreadCount = 0,
  isOpen = false,
  hasFreshArrival = false
) {
  const mx = MAILBOX_RECT.x;
  const my = MAILBOX_RECT.y;
  const hasUnread = unreadCount > 0;
  const wobble = hasFreshArrival ? Math.round(Math.sin(tick * 0.35)) : 0;

  // Ground drop shadow on concrete sidewalk curb
  pxRect(ctx, mx + 4, my + 24, 22, 6, 'rgba(20, 16, 12, 0.3)');

  // Concrete anchor plinth & dark cedar timber support post
  pxRect(ctx, mx + 9, my + 22, 12, 6, '#7E786E');
  pxRect(ctx, mx + 10, my + 23, 10, 3, '#A8A196');
  pxRect(ctx, mx + 12, my + 8, 6, 16, '#4E311D');
  pxRect(ctx, mx + 13, my + 8, 2, 15, '#7A5032'); // Wood post highlight
  // Angled wooden brace supporting mailbox shelf
  pxRect(ctx, mx + 8, my + 12, 14, 3, '#5C3B24');
  pxRect(ctx, mx + 9, my + 11, 12, 1, '#8C5E3C');

  // Classic barrel-top steel mailbox body (slate-navy enameled finish)
  const bx = mx + 3 + wobble;
  const by = my - 4;
  // Curved arched roof ridge
  pxRect(ctx, bx + 2, by - 2, 20, 3, '#223D4E');
  pxRect(ctx, bx + 4, by - 3, 16, 2, '#365E76');
  // Main barrel housing
  pxRect(ctx, bx, by, 24, 15, '#223D4E');
  pxRect(ctx, bx + 2, by + 1, 20, 12, '#345B73');
  pxRect(ctx, bx + 3, by + 1, 18, 3, '#5B88A3'); // Upper specular shine
  pxRect(ctx, bx + 2, by + 11, 20, 2, '#1D3342'); // Lower bevel shadow

  // Front mail door panel (faces left/west toward walkway & street)
  pxRect(ctx, bx + 1, by + 2, 8, 11, '#1A2F3D');
  if (isOpen || hasUnread) {
    // Partially open door / crisp white envelope peeking out of the slot
    pxRect(ctx, bx + 2, by + 3, 6, 9, '#12212B');
    pxRect(ctx, bx + 1, by + 5, 6, 5, '#FAF6F0');
    pxRect(ctx, bx + 2, by + 6, 4, 1, '#D97736');
    pxRect(ctx, bx + 2, by + 8, 3, 1, '#B8ABA0');
  } else {
    pxRect(ctx, bx + 2, by + 3, 6, 9, '#2A4C61');
    pxRect(ctx, bx + 6, by + 6, 2, 3, '#CBD5E1'); // Chrome door latch
  }

  // Brass house number plate on side of mailbox
  pxRect(ctx, bx + 12, by + 5, 8, 5, '#E9C46A');
  pxRect(ctx, bx + 13, by + 6, 6, 3, '#5C3B24');
  pxRect(ctx, bx + 14, by + 7, 1, 1, '#FAF6F0');
  pxRect(ctx, bx + 17, by + 7, 1, 1, '#FAF6F0');

  // Dynamic Red Metal Mail Flag (right side of mailbox)
  // Raised upright when unread emails are waiting; resting horizontal when clear
  if (hasUnread) {
    pxRect(ctx, bx + 21, by - 9, 2, 13, '#DC2626'); // Upright flagpole
    pxRect(ctx, bx + 21, by - 9, 6, 5, '#EF4444'); // Raised red flag pennant
    pxRect(ctx, bx + 22, by - 8, 4, 2, '#FCA5A5'); // Highlight glint
    pxRect(ctx, bx + 20, by + 3, 3, 3, '#CBD5E1'); // Pivot bolt
  } else {
    pxRect(ctx, bx + 17, by + 3, 8, 2, '#B91C1C'); // Resting flag arm
    pxRect(ctx, bx + 22, by + 2, 4, 4, '#DC2626'); // Flag tip resting
    pxRect(ctx, bx + 16, by + 3, 2, 2, '#94A3B8'); // Pivot bolt
  }
}

/**
 * Draws a crisp, animated world-space incoming Gmail notification pin directly
 * above the roadside mailbox whenever unread emails are present.
 * Automatically suppressed when the player is adjacent so it never overlaps the [E] prompt.
 */
export function drawRoadsideMailboxNotification(
  ctx: CanvasRenderingContext2D,
  tick: number,
  unreadCount: number,
  hasFreshArrival = false,
  suppressBadge = false
) {
  if (unreadCount <= 0 || suppressBadge) return;

  const cx = Math.round(MAILBOX_RECT.x + MAILBOX_RECT.w / 2);
  const bob = Math.round(Math.sin(tick * 0.1) * 2.2);
  const baseY = MAILBOX_RECT.y - 16 + bob;

  ctx.save();

  // Soft pulsing alert ring around the notification when unread mail is waiting
  const pulsePhase = (tick % 60) / 60;
  const ringRadius = 11 + pulsePhase * (hasFreshArrival ? 14 : 9);
  const ringAlpha = (1 - pulsePhase) * (hasFreshArrival ? 0.55 : 0.3);
  ctx.strokeStyle = `rgba(239, 68, 68, ${ringAlpha.toFixed(2)})`;
  ctx.lineWidth = hasFreshArrival ? 2 : 1.5;
  ctx.beginPath();
  ctx.arc(cx, baseY - 9, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  const countLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  ctx.font = '700 10px "IBM Plex Sans Thai", sans-serif';
  const countW = Math.ceil(ctx.measureText(countLabel).width);
  const iconW = 13;
  const padX = 6;
  const gap = 4;
  const w = padX * 2 + iconW + gap + countW;
  const h = 19;
  const bx = Math.round(cx - w / 2);
  const by = Math.round(baseY - h);

  // Drop shadow & crisp crimson-framed dark-warm notification bubble
  pxRect(ctx, bx + 1, by + 2, w, h, 'rgba(15, 10, 8, 0.42)');
  pxRect(ctx, bx - 1, by - 1, w + 2, h + 2, '#DC2626');
  pxRect(ctx, bx, by, w, h, '#241B18');
  pxRect(ctx, bx + 1, by + 1, w - 2, 2, 'rgba(254, 202, 202, 0.2)');

  // Downward pointer arrow directly anchoring the alert to the mailbox
  pxRect(ctx, cx - 3, by + h, 6, 2, '#DC2626');
  pxRect(ctx, cx - 2, by + h, 4, 2, '#241B18');
  pxRect(ctx, cx - 1, by + h + 2, 2, 2, '#DC2626');

  // Crisp pixel Gmail-inspired cream & red envelope icon
  const ex = bx + padX;
  const ey = by + 5;
  pxRect(ctx, ex, ey, 12, 9, '#FAF6F0');
  pxRect(ctx, ex, ey, 12, 1, '#DC2626');
  pxRect(ctx, ex, ey, 2, 9, '#DC2626');
  pxRect(ctx, ex + 10, ey, 2, 9, '#DC2626');
  // V-flap stroke
  pxRect(ctx, ex + 2, ey + 2, 2, 2, '#EF4444');
  pxRect(ctx, ex + 4, ey + 4, 4, 2, '#EF4444');
  pxRect(ctx, ex + 8, ey + 2, 2, 2, '#EF4444');

  // Crisp unread count label
  ctx.fillStyle = '#FAF6F0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(countLabel, ex + iconW + gap, by + h / 2 + 0.5);

  ctx.restore();
}

/**
 * Draws a world-space Daily Sleep Quest marker right above the Master Bedroom's
 * right nightstand. Shows an inviting moon quest indicator when today's sleep
 * hasn't been logged yet, or a serene score badge once completed.
 * Automatically suppressed when the player stands adjacent so it never overlaps [E].
 */
export function drawBedroomSleepQuestBadge(
  ctx: CanvasRenderingContext2D,
  tick: number,
  hasLoggedTodaySleep: boolean,
  todaySleepLabel: string | null,
  suppressBadge = false
) {
  if (suppressBadge) return;

  const cx = Math.round(SLEEP_STATION_RECT.x + SLEEP_STATION_RECT.w / 2);
  const bob = Math.round(Math.sin(tick * 0.08) * 1.8);
  const baseY = SLEEP_STATION_RECT.y - 6 + bob;

  ctx.save();

  const accentBorder = hasLoggedTodaySleep ? '#34D399' : '#F59E0B';
  const bgFill = hasLoggedTodaySleep ? '#162420' : '#291D16';
  const accentGlyph = hasLoggedTodaySleep ? '#6EE7B7' : '#FDE68A';
  const label = hasLoggedTodaySleep
    ? todaySleepLabel || 'บันทึกการนอนแล้ว'
    : 'ยังไม่ได้บันทึกการนอน';

  if (!hasLoggedTodaySleep) {
    const pulsePhase = (tick % 64) / 64;
    const ringRadius = 9 + pulsePhase * 11;
    const ringAlpha = (1 - pulsePhase) * 0.42;
    ctx.strokeStyle = `rgba(245, 158, 11, ${ringAlpha.toFixed(2)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, baseY - 9, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.font = '600 9.5px "IBM Plex Sans Thai", sans-serif';
  const textW = Math.ceil(ctx.measureText(label).width);
  const iconW = 10;
  const padX = 6;
  const gap = 4;
  const w = padX * 2 + iconW + gap + textW;
  const h = 18;
  const minX = TILE + 6;
  const maxX = Math.max(minX, 9 * TILE - w - 6);
  const bx = Math.max(minX, Math.min(maxX, Math.round(cx - w / 2)));
  const by = Math.round(baseY - h);

  // Soft shadow + framed status badge
  pxRect(ctx, bx + 1, by + 2, w, h, 'rgba(15, 12, 18, 0.45)');
  pxRect(ctx, bx - 1, by - 1, w + 2, h + 2, accentBorder);
  pxRect(ctx, bx, by, w, h, bgFill);
  pxRect(ctx, bx + 1, by + 1, w - 2, 1, 'rgba(255, 255, 255, 0.14)');

  // Downward pointer arrow anchored to right nightstand
  const pointerX = Math.max(bx + 6, Math.min(bx + w - 6, cx));
  pxRect(ctx, pointerX - 3, by + h, 6, 2, accentBorder);
  pxRect(ctx, pointerX - 2, by + h, 4, 2, bgFill);
  pxRect(ctx, pointerX - 1, by + h + 2, 2, 2, accentBorder);

  // Pixel checkmark when completed today, or alert exclamation when pending
  const ix = bx + padX;
  const iy = by + 4;
  if (hasLoggedTodaySleep) {
    pxRect(ctx, ix + 1, iy + 5, 2, 2, accentGlyph);
    pxRect(ctx, ix + 3, iy + 7, 2, 2, accentGlyph);
    pxRect(ctx, ix + 5, iy + 5, 2, 2, accentGlyph);
    pxRect(ctx, ix + 7, iy + 3, 2, 2, accentGlyph);
  } else {
    // Exclamation mark alert glyph inside subtle amber accent
    pxRect(ctx, ix + 4, iy + 1, 2, 5, accentGlyph);
    pxRect(ctx, ix + 4, iy + 7, 2, 2, accentGlyph);
    pxRect(ctx, ix + 1, iy + 2, 1, 1, '#FBBF24');
    pxRect(ctx, ix + 8, iy + 2, 1, 1, '#FBBF24');
  }

  ctx.fillStyle = hasLoggedTodaySleep ? '#ECFDF5' : '#FEF3C7';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, ix + iconW + gap, by + h / 2 + 0.5);

  ctx.restore();
}

/**
 * Floating world-space daily plant-watering quest badge above the 5 front-porch potted plants.
 * Shows an amber reminder until watered at least once today (resets at local midnight 00:00),
 * then turns into a serene emerald watered badge. Automatically suppressed when player is adjacent.
 */
export function drawPorchPlantQuestBadge(
  ctx: CanvasRenderingContext2D,
  tick: number,
  hasWateredToday: boolean,
  todayWaterLabel: string | null,
  suppressBadge = false
) {
  if (suppressBadge) return;

  const cx = Math.round(PORCH_PLANTER_RECT.x + PORCH_PLANTER_RECT.w / 2);
  const bob = Math.round(Math.sin(tick * 0.08 + 1.2) * 1.6);
  const baseY = PORCH_PLANTER_RECT.y - 6 + bob;

  ctx.save();

  const accentBorder = hasWateredToday ? '#34D399' : '#38BDF8';
  const bgFill = hasWateredToday ? '#162420' : '#13232E';
  const accentGlyph = hasWateredToday ? '#6EE7B7' : '#7DD3FC';
  const label = hasWateredToday
    ? todayWaterLabel
      ? `รดน้ำแล้ว · ${todayWaterLabel}`
      : 'รดน้ำต้นไม้แล้ว'
    : 'ยังไม่ได้รดน้ำต้นไม้';

  if (!hasWateredToday) {
    const pulsePhase = (tick % 64) / 64;
    const ringRadius = 9 + pulsePhase * 11;
    const ringAlpha = (1 - pulsePhase) * 0.42;
    ctx.strokeStyle = `rgba(56, 189, 248, ${ringAlpha.toFixed(2)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, baseY - 9, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.font = '600 9.5px "IBM Plex Sans Thai", sans-serif';
  const textW = Math.ceil(ctx.measureText(label).width);
  const iconW = 10;
  const padX = 6;
  const gap = 4;
  const w = padX * 2 + iconW + gap + textW;
  const h = 18;
  const bx = Math.round(cx - w / 2);
  const by = Math.round(baseY - h);

  // Soft shadow + framed status badge
  pxRect(ctx, bx + 1, by + 2, w, h, 'rgba(15, 12, 18, 0.45)');
  pxRect(ctx, bx - 1, by - 1, w + 2, h + 2, accentBorder);
  pxRect(ctx, bx, by, w, h, bgFill);
  pxRect(ctx, bx + 1, by + 1, w - 2, 1, 'rgba(255, 255, 255, 0.14)');

  // Downward pointer arrow anchored to the 5 potted plants
  const pointerX = Math.max(bx + 6, Math.min(bx + w - 6, cx));
  pxRect(ctx, pointerX - 3, by + h, 6, 2, accentBorder);
  pxRect(ctx, pointerX - 2, by + h, 4, 2, bgFill);
  pxRect(ctx, pointerX - 1, by + h + 2, 2, 2, accentBorder);

  // Pixel checkmark when watered today, or crisp pixel water droplet when pending
  const ix = bx + padX;
  const iy = by + 4;
  if (hasWateredToday) {
    pxRect(ctx, ix + 1, iy + 5, 2, 2, accentGlyph);
    pxRect(ctx, ix + 3, iy + 7, 2, 2, accentGlyph);
    pxRect(ctx, ix + 5, iy + 5, 2, 2, accentGlyph);
    pxRect(ctx, ix + 7, iy + 3, 2, 2, accentGlyph);
  } else {
    // Pixel water droplet icon
    pxRect(ctx, ix + 4, iy + 1, 2, 2, accentGlyph);
    pxRect(ctx, ix + 3, iy + 3, 4, 2, accentGlyph);
    pxRect(ctx, ix + 2, iy + 5, 6, 3, accentGlyph);
    pxRect(ctx, ix + 3, iy + 8, 4, 1, accentGlyph);
    pxRect(ctx, ix + 3, iy + 5, 1, 2, '#E0F2FE');
  }

  ctx.fillStyle = hasWateredToday ? '#ECFDF5' : '#E0F2FE';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, ix + iconW + gap, by + h / 2 + 0.5);

  ctx.restore();
}

/**
 * Bedroom-only lights-off overlay when the player is sleeping in the Master Bedroom King Bed.
 * Leaves both snowy nighttime picture windows crisp and un-darkened, adds soft silver moonlight beams,
 * and floats peaceful animated Zzz pixels above the sleeping player.
 */
export function drawBedroomSleepDarkness(
  ctx: CanvasRenderingContext2D,
  tick: number
) {
  const roomX = TILE;
  const roomY = 10;
  const roomW = (WEST_DIVIDER_COL - 1) * TILE;
  const roomH = MID_WALL_ROW * TILE - 10;

  const win1X = Math.round(1.3 * TILE);
  const win2X = Math.round(6.75 * TILE);
  const winY = 16;
  const winW = Math.round(1.55 * TILE);
  const winH = 31;

  ctx.save();

  // Darken ONLY the Master Bedroom interior, punching crisp cutouts for the 2 nighttime snowy windows
  ctx.beginPath();
  ctx.rect(roomX, roomY, roomW, roomH);
  ctx.rect(win1X, winY, winW, winH);
  ctx.rect(win2X, winY, winW, winH);
  ctx.fillStyle = 'rgba(10, 14, 30, 0.62)';
  ctx.fill('evenodd');

  // Soft silver-indigo moonlight beams spilling through the 2 bedroom windows onto the dark room
  ctx.fillStyle = 'rgba(165, 198, 255, 0.11)';
  ctx.beginPath();
  ctx.moveTo(win1X + 4, winY + winH + 3);
  ctx.lineTo(win1X + winW - 4, winY + winH + 3);
  ctx.lineTo(win1X + winW + 14, winY + winH + 88);
  ctx.lineTo(win1X + 10, winY + winH + 88);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(win2X + 4, winY + winH + 3);
  ctx.lineTo(win2X + winW - 4, winY + winH + 3);
  ctx.lineTo(win2X + winW + 14, winY + winH + 88);
  ctx.lineTo(win2X + 10, winY + winH + 88);
  ctx.closePath();
  ctx.fill();

  // Gentle floating animated "Zzz" above the sleeping player on the King Bed
  const baseZ_X = Math.round(3.0 * TILE) + 42;
  const baseZ_Y = Math.round(1.65 * TILE) + 24;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) {
    const phase = ((tick * 0.018 + i * 0.33) % 1);
    const zx = baseZ_X + i * 5 + Math.sin(phase * Math.PI * 2) * 3;
    const zy = baseZ_Y - phase * 24;
    const alpha = Math.sin(phase * Math.PI) * 0.92;
    const size = i === 0 ? 8 : i === 1 ? 10 : 12;
    ctx.font = `700 ${size}px "IBM Plex Sans Thai", sans-serif`;
    ctx.fillStyle = `rgba(224, 231, 255, ${alpha.toFixed(2)})`;
    ctx.fillText('Z', zx, zy);
  }

  ctx.restore();
}

