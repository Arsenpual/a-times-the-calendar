import type {
  AssistantMood,
  CameraTransform,
  CharacterId,
  CharacterStatusMap,
  CharacterStatusSnapshot,
  GreenCarState,
  InspectHoverRenderState,
  InteractableObject,
  MinaNpcState,
  PlayerState,
  RovingAssistantNpcState,
  TaskAssistantId,
  TimeOfDay,
} from '../types/game';
import {
  AGY_APPROACH_RADIUS,
  AGY_POS,
  AISTUDIO_APPROACH_RADIUS,
  AISTUDIO_DESK_RECT,
  AISTUDIO_POS,
  CAMERA_BASE_SCALE,
  CENTER_TABLE_RECT,
  CORE_OFFSET_X,
  DIVIDER_COL,
  DOOR_ROW_END,
  DOOR_ROW_START,
  getRoomZone,
  KITCHEN_DINING_RECT,
  MAILBOX_RECT,
  MID_WALL_ROW,
  MINA_APPROACH_RADIUS,
  MINA_POS,
  OFFICE_EAST_WALL_COL,
  TILE,
  VIEW_H,
  VIEW_W,
  WORK_SEAT_POS,
  WORLD_H,
  WORLD_W,
} from './houseMap';

export function pxRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Local column constants for the Living Room + Home Office core (drawn translated by +CORE_OFFSET_X)
const LOCAL_DIVIDER_COL = 10;
const LOCAL_OFFICE_EAST_COL = 23;
const LOCAL_UPPER_W = 24 * TILE;

export function drawWoodFloor(ctx: CanvasRenderingContext2D) {
  // Living lounge oak floorboards (local cols 1..9) & +50% expanded Home Office floorboards (local cols 11..22, rows 2..11)
  for (let row = 2; row <= 11; row++) {
    for (let col = 1; col < LOCAL_OFFICE_EAST_COL; col++) {
      if (col === LOCAL_DIVIDER_COL && (row < DOOR_ROW_START || row > DOOR_ROW_END)) {
        continue;
      }
      const x = col * TILE;
      const y = row * TILE;
      const isOffice = col > LOCAL_DIVIDER_COL;

      const baseA = isOffice ? '#B5895A' : '#C99E6B';
      const baseB = isOffice ? '#AD8152' : '#C29663';
      const plankLine = isOffice ? '#8E663D' : '#9F7446';
      const highlight = isOffice ? '#C29768' : '#D4AB7A';

      pxRect(ctx, x, y, TILE, TILE, (col + row) % 2 === 0 ? baseA : baseB);
      // Horizontal plank dividers
      pxRect(ctx, x, y + 15, TILE, 1, plankLine);
      pxRect(ctx, x, y + 31, TILE, 1, plankLine);
      // Subtle top plank highlight
      pxRect(ctx, x, y + 1, TILE, 1, highlight);
      // Staggered vertical plank joints
      const jointX = ((row * 13 + col * 7) % 22) + 4;
      pxRect(ctx, x + jointX, y, 1, 15, plankLine);
      const jointX2 = ((row * 5 + col * 19) % 22) + 4;
      pxRect(ctx, x + jointX2, y + 16, 1, 15, plankLine);
    }
  }

  // Doorway wooden threshold trim between Living Room & Home Office
  const doorX = LOCAL_DIVIDER_COL * TILE;
  pxRect(ctx, doorX, DOOR_ROW_START * TILE, TILE, (DOOR_ROW_END - DOOR_ROW_START + 1) * TILE, '#8B603A');
  pxRect(ctx, doorX + 3, DOOR_ROW_START * TILE + 2, TILE - 6, (DOOR_ROW_END - DOOR_ROW_START + 1) * TILE - 4, '#A47548');
  pxRect(ctx, doorX + 6, DOOR_ROW_START * TILE + 6, TILE - 12, (DOOR_ROW_END - DOOR_ROW_START + 1) * TILE - 12, '#B68657');
}

export function drawWalls(
  ctx: CanvasRenderingContext2D,
  timeOfDay: TimeOfDay,
  tick: number,
  extraPinCount: number,
  isPinboardActive: boolean,
  isClockChiming = false
) {
  const officeEastX = LOCAL_OFFICE_EAST_COL * TILE;
  const dividerX = LOCAL_DIVIDER_COL * TILE;
  const midY = MID_WALL_ROW * TILE;

  // Outer dark timber border shell for Living Room & Expanded Home Office (local cols 0..23)
  pxRect(ctx, 0, 0, LOCAL_UPPER_W, 10, '#3B281E'); // North outer border (Living + Office)
  pxRect(ctx, officeEastX, 0, TILE, (MID_WALL_ROW + 1) * TILE, '#3B281E'); // Expanded Office East wall (local col 23)

  // Inner wood trim on Office East wall
  pxRect(ctx, officeEastX, 10, 5, midY - 10, '#5B3E2B');

  // North interior walls (Living: warm cream 9 cols, Expanded Office: soft warm sand 12 cols)
  pxRect(ctx, TILE, 10, 9 * TILE, 2 * TILE - 10, '#E9DFCE');
  pxRect(ctx, 11 * TILE, 10, 12 * TILE, 2 * TILE - 10, '#E3D7C4');

  // Subtle wallpaper vertical stripes
  for (let x = TILE + 8; x < officeEastX; x += 16) {
    if (x >= dividerX && x < dividerX + TILE) continue;
    pxRect(ctx, x, 10, 2, 2 * TILE - 22, 'rgba(130, 102, 74, 0.08)');
  }

  // Wooden wainscoting / baseboard along north wall
  const northInteriorW = (LOCAL_OFFICE_EAST_COL - 1) * TILE;
  pxRect(ctx, TILE, 2 * TILE - 14, northInteriorW, 14, '#7A5438');
  pxRect(ctx, TILE, 2 * TILE - 14, northInteriorW, 2, '#9A6E4D');
  pxRect(ctx, TILE, 2 * TILE - 2, northInteriorW, 2, '#4A3121');

  // Upper dividing partition wall (local col 10 -> world col 19)
  const dx = dividerX;
  // Upper divider segment (rows 0..5)
  pxRect(ctx, dx, 0, TILE, DOOR_ROW_START * TILE, '#4B3224');
  pxRect(ctx, dx + 3, 10, TILE - 6, DOOR_ROW_START * TILE - 14, '#6E4A33');
  pxRect(ctx, dx + 4, DOOR_ROW_START * TILE - 10, TILE - 8, 10, '#8D6042');
  // Lower segment of upper divider (rows 9..11, meeting horizontal dividing wall at row 12)
  const lowerY = (DOOR_ROW_END + 1) * TILE;
  const upperLowerH = MID_WALL_ROW * TILE - lowerY;
  pxRect(ctx, dx, lowerY, TILE, upperLowerH, '#4B3224');
  pxRect(ctx, dx + 3, lowerY + 4, TILE - 6, upperLowerH - 4, '#6E4A33');

  // Windows across the North Wall: Living room window + two balanced Home Office windows
  drawWindow(ctx, 2.2 * TILE, 14, 2.8 * TILE, 36, timeOfDay, tick);
  drawWindow(ctx, 16.45 * TILE, 14, 2.5 * TILE, 34, timeOfDay, tick); // Executive desk picture window
  drawWindow(ctx, 20.1 * TILE, 14, 1.85 * TILE, 34, timeOfDay, tick); // East wing library window

  // Framed architectural chart plaque on office north wall between pinboard & executive window
  const apx = Math.round(15.42 * TILE);
  pxRect(ctx, apx, 17, 24, 22, '#593A25');
  pxRect(ctx, apx + 2, 19, 20, 18, '#FAF6F0');
  pxRect(ctx, apx + 4, 21, 16, 4, '#3B5B7C');
  pxRect(ctx, apx + 4, 27, 9, 7, '#6F9486');
  pxRect(ctx, apx + 15, 27, 5, 3, '#E2A84B');
  pxRect(ctx, apx + 15, 31, 5, 3, '#C85A3F');

  // Festive Christmas fairy light garland along the living room top wall
  drawChristmasWallGarland(ctx, TILE + 4, 11, 8.8 * TILE, tick);

  // Framed pixel winter landscape painting in living room with miniature holiday wreath
  pxRect(ctx, 5.14 * TILE, 17, 26, 24, '#593A25');
  pxRect(ctx, 5.14 * TILE + 3, 20, 20, 18, '#B8D4E3');
  pxRect(ctx, 5.14 * TILE + 3, 29, 20, 9, '#F1F5F9'); // Snowy hill
  pxRect(ctx, 5.14 * TILE + 7, 23, 7, 7, '#2D6A4F'); // Pine tree
  pxRect(ctx, 5.14 * TILE + 9, 21, 3, 3, '#40916C');
  pxRect(ctx, 5.14 * TILE + 17, 22, 3, 3, '#FDE047');
  // Mini festive wreath & red bow above painting
  pxRect(ctx, 5.14 * TILE + 9, 13, 8, 6, '#2D6A4F');
  pxRect(ctx, 5.14 * TILE + 11, 15, 4, 2, '#E9DFCE');
  pxRect(ctx, 5.14 * TILE + 12, 12, 2, 2, '#DC2626');

  // Classic mahogany grandfather pendulum clock beside the fireplace
  drawPendulumClock(ctx, 6.12 * TILE, 14, tick, isClockChiming);

  // Cozy fireplace in living room (cols 7..8.8)
  drawFireplace(ctx, 7.0 * TILE, 16, tick);

  // Unobstructed Cork Pinboard in North-West Planning Zone of expanded Home Office (cols 12.15..15.15)
  drawPinboard(ctx, 12.15 * TILE, 15, 3.0 * TILE, 29, extraPinCount, isPinboardActive, tick);
}

export function drawPendulumClock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tick: number,
  isChiming = false
) {
  const cx = Math.round(x + 11);
  // Floor drop shadow at base
  pxRect(ctx, x + 1, y + 64, 21, 5, 'rgba(28,20,15,0.28)');

  // Warm golden chime halo & sound-wave arcs while announcing an Activity Mode event
  if (isChiming) {
    const pulse = 0.5 + Math.sin(tick * 0.22) * 0.35;
    ctx.save();
    const glow = ctx.createRadialGradient(cx + 0.5, y + 16, 4, cx + 0.5, y + 16, 26);
    glow.addColorStop(0, `rgba(255, 224, 130, ${(0.34 * pulse).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(255, 210, 96, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx + 0.5, y + 16, 26, 0, Math.PI * 2);
    ctx.fill();

    // Animated antique chime sound waves radiating left & right of clock hood
    for (let ring = 0; ring < 2; ring += 1) {
      const phase = ((tick * 0.045 + ring * 0.5) % 1);
      const radius = 12 + phase * 11;
      const alpha = (1 - phase) * 0.72;
      ctx.strokeStyle = `rgba(248, 215, 118, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.4;
      // Left arc
      ctx.beginPath();
      ctx.arc(cx + 0.5, y + 16, radius, Math.PI * 0.78, Math.PI * 1.22);
      ctx.stroke();
      // Right arc
      ctx.beginPath();
      ctx.arc(cx + 0.5, y + 16, radius, -Math.PI * 0.22, Math.PI * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Ornate carved swan-neck crown & golden brass finial
  pxRect(ctx, x + 3, y + 2, 17, 5, '#4A2818');
  pxRect(ctx, x + 5, y + 1, 5, 3, '#6B3D24');
  pxRect(ctx, x + 13, y + 1, 5, 3, '#6B3D24');
  pxRect(ctx, x + 10, y - 2, 3, 4, isChiming ? '#FFE082' : '#E9C46A'); // Brass top finial
  pxRect(ctx, x + 11, y - 3, 1, 2, '#FFF3BE');

  // Upper clock hood housing
  pxRect(ctx, x + 1, y + 6, 21, 20, '#4E2B19');
  pxRect(ctx, x + 3, y + 8, 17, 16, '#6E4027');

  // Ornate gold bezel & ivory clock face
  pxRect(ctx, x + 4, y + 9, 15, 14, isChiming ? '#F5CB69' : '#C99A49');
  pxRect(ctx, x + 5, y + 10, 13, 12, isChiming ? '#FFFDF5' : '#FAF6F0');
  // Cardinal Roman-style hour ticks (12, 3, 6, 9)
  pxRect(ctx, cx, y + 11, 1, 2, '#4A3121');
  pxRect(ctx, cx, y + 19, 1, 2, '#4A3121');
  pxRect(ctx, x + 6, y + 16, 2, 1, '#4A3121');
  pxRect(ctx, x + 15, y + 16, 2, 1, '#4A3121');

  // Live local time hour & minute hands
  const now = new Date();
  const minuteAngle = ((now.getMinutes() + now.getSeconds() / 60) / 60) * Math.PI * 2 - Math.PI / 2;
  const hourAngle = (((now.getHours() % 12) + now.getMinutes() / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  const dialCy = y + 16;

  ctx.save();
  ctx.strokeStyle = '#231D19';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + 0.5, dialCy + 0.5);
  ctx.lineTo(cx + 0.5 + Math.cos(hourAngle) * 3.2, dialCy + 0.5 + Math.sin(hourAngle) * 3.2);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 0.5, dialCy + 0.5);
  ctx.lineTo(cx + 0.5 + Math.cos(minuteAngle) * 4.8, dialCy + 0.5 + Math.sin(minuteAngle) * 4.8);
  ctx.stroke();
  ctx.restore();
  pxRect(ctx, cx, dialCy, 1, 1, '#B07D32'); // Center brass pin

  // Tall mahogany waist trunk with recessed glass pendulum window
  pxRect(ctx, x + 2, y + 26, 19, 30, '#4E2B19');
  pxRect(ctx, x + 3, y + 26, 2, 30, '#78482D'); // Left wood highlight
  pxRect(ctx, x + 18, y + 26, 2, 30, '#3D2113'); // Right bevel
  pxRect(ctx, x + 5, y + 28, 13, 26, '#23160F'); // Dark cabinet interior
  pxRect(ctx, x + 6, y + 29, 11, 24, '#2E1E16');

  // Smoothly swinging brass pendulum rod & gleaming gold bob
  const swingAngle = Math.sin(tick * (isChiming ? 0.085 : 0.065)) * (isChiming ? 0.34 : 0.28);
  const pivotX = cx + 0.5;
  const pivotY = y + 30;
  const rodLen = 17;
  const bobX = pivotX + Math.sin(swingAngle) * rodLen;
  const bobY = pivotY + Math.cos(swingAngle) * rodLen;

  ctx.save();
  ctx.strokeStyle = isChiming ? '#F5CB69' : '#C99A49';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(bobX, bobY);
  ctx.stroke();
  ctx.restore();

  const bx = Math.round(bobX) - 2;
  const by = Math.round(bobY) - 2;
  pxRect(ctx, bx, by, 5, 5, isChiming ? '#F5CB69' : '#D4A03E'); // Brass bob disc
  pxRect(ctx, bx + 1, by + 1, 3, 3, isChiming ? '#FFF3BE' : '#F5CB69');
  pxRect(ctx, bx + 1, by + 1, 1, 1, '#FFF8DC'); // Specular glint

  // Subtle diagonal glass pane reflection
  pxRect(ctx, x + 6, y + 31, 2, 1, 'rgba(255,250,240,0.22)');
  pxRect(ctx, x + 8, y + 33, 2, 1, 'rgba(255,250,240,0.18)');
  pxRect(ctx, x + 10, y + 35, 2, 1, 'rgba(255,250,240,0.14)');

  // Stepped carved plinth base
  pxRect(ctx, x + 1, y + 56, 21, 9, '#4A2818');
  pxRect(ctx, x + 3, y + 58, 17, 5, '#6B3D24');
  pxRect(ctx, x + 5, y + 59, 13, 3, '#57311D');
  pxRect(ctx, x, y + 63, 23, 3, '#3B1F12');
}

/**
 * Draws a single unified antique mahogany & gold-trimmed nameplate mounted above the
 * Living Room grandfather clock, expanding upward so it never overlaps the clock face
 * or the [E] interaction prompt.
 */
export function drawPendulumClockAnnouncement(
  ctx: CanvasRenderingContext2D,
  clockWorldX: number,
  clockWorldY: number,
  title: string,
  badgeLabel: string,
  tick: number,
  elapsedMs: number,
  isCountdown = false,
  isNearClock = false
) {
  const clockCenterX = Math.round(clockWorldX + 11.5);
  const boxW = isNearClock ? 168 : isCountdown ? 156 : 148;
  const headerH = isNearClock ? 15 : 0;
  const mainH = 22;
  const boxH = headerH + mainH;
  const bx = Math.round(clockCenterX - boxW / 2);
  // Always expand upward above the grandfather clock finial (clockWorldY - 3)
  const by = Math.round(clockWorldY - 6 - boxH);

  ctx.save();
  // Soft drop shadow behind antique nameplate
  ctx.fillStyle = 'rgba(12, 7, 4, 0.48)';
  ctx.fillRect(bx - 1, by + 2, boxW + 2, boxH + 1);

  // Outer brass trim + dark mahogany body
  pxRect(ctx, bx - 1, by - 1, boxW + 2, boxH + 2, isCountdown ? '#9E7432' : '#C99A49');
  pxRect(ctx, bx, by, boxW, boxH, '#2B170E');
  pxRect(ctx, bx + 1, by + 1, boxW - 2, 1, '#5D3721');

  // Integrated top [E] prompt strip when player is near the clock (expands upward, no 2-layer overlap)
  if (isNearClock) {
    pxRect(ctx, bx + 2, by + 2, boxW - 4, headerH - 2, '#3D2214');
    pxRect(ctx, bx + 2, by + headerH, boxW - 4, 1, '#6E492A');
    ctx.font = '600 8.5px "IBM Plex Sans Thai", sans-serif';
    ctx.fillStyle = '#F5CB69';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('[E] ดูกิจกรรมทั้งวัน (Activity Mode)', bx + boxW / 2, by + 8.5);
  }

  const rowY = by + headerH;

  // Left chime-time or live countdown pill
  ctx.font = '700 8px "IBM Plex Sans Thai", monospace';
  const timeText = badgeLabel.replace(/\s*น\.$/, '');
  const timeW = Math.ceil(ctx.measureText(timeText).width) + 8;
  pxRect(ctx, bx + 3, rowY + 3, timeW, mainH - 6, '#432515');
  pxRect(ctx, bx + 3 + timeW, rowY + 3, 1, mainH - 6, '#8F6830');
  ctx.fillStyle = '#FFE082';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(timeText, bx + 3 + timeW / 2, rowY + mainH / 2 + 0.5);

  // Clipped marquee window for the activity title
  const innerX = bx + 6 + timeW;
  const innerW = boxW - (innerX - bx) - 5;
  const innerY = rowY + 2;
  const innerH = mainH - 4;

  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerW, innerH);
  ctx.clip();

  ctx.font = '600 9.5px "IBM Plex Sans Thai", sans-serif';
  ctx.fillStyle = '#FAF3E3';
  ctx.textBaseline = 'middle';
  const textW = ctx.measureText(title).width;
  const textY = rowY + mainH / 2 + 0.5;

  if (textW <= innerW) {
    ctx.textAlign = 'center';
    ctx.fillText(title, innerX + innerW / 2, textY);
  } else {
    // Scroll right-to-left until the last character completely exits (3 rounds on chime)
    const speedPxPerSec = 38;
    const travel = innerW + textW;
    const distance = Math.max(0, (elapsedMs / 1000) * speedPxPerSec);
    const roundIdx = Math.floor(distance / travel);
    if (isCountdown || roundIdx < 3) {
      const progressInRound = distance - roundIdx * travel;
      const drawX = innerX + innerW - progressInRound;
      ctx.textAlign = 'left';
      ctx.fillText(title, drawX, textY);
    }
  }
  ctx.restore();

  // Tiny brass pointer triangle connecting nameplate to grandfather clock crown
  const pulseGlow = 0.7 + Math.sin(tick * 0.2) * 0.25;
  ctx.fillStyle = `rgba(233, 196, 106, ${pulseGlow.toFixed(2)})`;
  pxRect(ctx, clockCenterX - 2, by + boxH + 1, 5, 2, '#C99A49');
  pxRect(ctx, clockCenterX - 1, by + boxH + 3, 3, 1, '#E9C46A');

  ctx.restore();
}

export function drawChristmasWallGarland(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  tick: number
) {
  const bulbColors = ['#EF4444', '#FACC15', '#4ADE80', '#60A5FA', '#FB923C'];
  const step = 18;
  let idx = 0;
  for (let gx = x; gx < x + w - 10; gx += step) {
    const sag = idx % 2 === 0 ? 0 : 2;
    // Pine swag segments
    pxRect(ctx, gx, y + sag, step, 2, '#2D5A3C');
    pxRect(ctx, gx + 3, y + sag + 1, step - 6, 2, '#3D7A52');
    // Red ribbon bows at intervals
    if (idx % 3 === 0) {
      pxRect(ctx, gx + 1, y + sag, 3, 3, '#DC2626');
      pxRect(ctx, gx + 2, y + sag + 3, 1, 2, '#B91C1C');
    }
    // Twinkling fairy light bulb
    const bulbColor = bulbColors[(idx + Math.floor(tick / 12)) % bulbColors.length];
    const isBright = (idx + Math.floor(tick / 8)) % 2 === 0;
    pxRect(ctx, gx + 9, y + sag + 2, 2, 2, bulbColor);
    if (isBright) {
      pxRect(ctx, gx + 8, y + sag + 1, 4, 4, 'rgba(255, 248, 200, 0.28)');
    }
    idx++;
  }
}

export function drawWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  timeOfDay: TimeOfDay,
  tick: number
) {
  const skyTop =
    timeOfDay === 'morning' ? '#90C2DB' : timeOfDay === 'afternoon' ? '#D98E6C' : '#1E293B';
  const skyBot =
    timeOfDay === 'morning' ? '#D6ECF3' : timeOfDay === 'afternoon' ? '#F3D1B0' : '#334155';

  // Outer wood frame
  pxRect(ctx, x, y, w, h, '#5A3A26');
  pxRect(ctx, x + 3, y + 3, w - 6, h - 6, skyTop);
  pxRect(ctx, x + 3, y + h / 2, w - 6, h / 2 - 3, skyBot);

  if (timeOfDay === 'evening') {
    // Twinkling pixel stars & moon
    pxRect(ctx, x + 10, y + 7, 2, 2, '#FDE68A');
    pxRect(ctx, x + w - 16, y + 8, 5, 5, '#FEF3C7');
    pxRect(ctx, x + 24, y + 12, 2, 2, '#E2E8F0');
  } else {
    // Soft winter clouds
    pxRect(ctx, x + 8, y + 7, 14, 4, 'rgba(255,255,255,0.78)');
    pxRect(ctx, x + w - 24, y + 10, 12, 4, 'rgba(255,255,255,0.68)');
  }

  // Winter snowy landscape & snow-covered pine treetops visible outside
  const pineShade = timeOfDay === 'evening' ? '#27403B' : '#4E7365';
  pxRect(ctx, x + 4, y + h - 11, w - 8, 8, pineShade);
  pxRect(ctx, x + 4, y + h - 7, w - 8, 4, timeOfDay === 'evening' ? '#CBD5E1' : '#F8FAFC');
  pxRect(ctx, x + 9, y + h - 10, 10, 2, '#F1F5F9');
  pxRect(ctx, x + w - 22, y + h - 10, 12, 2, '#F1F5F9');

  // Animated gentle snowfall inside window glass (always snowing in morning, afternoon, and evening)
  const paneW = Math.max(12, w - 16);
  const paneH = Math.max(10, h - 9);
  const flakeCount = Math.max(10, Math.floor(w / 5));
  for (let i = 0; i < flakeCount; i++) {
    const speed = 0.22 + (i % 3) * 0.08;
    const fallY = ((i * 11 + tick * speed) % paneH);
    const sway = Math.sin(tick * 0.05 + i * 1.7) * 2.2;
    const fx = x + 8 + ((i * 19 + sway + paneW) % paneW);
    const fy = y + 4 + fallY;
    const size = i % 4 === 0 ? 2 : 1;
    const alpha = i % 3 === 0 ? 'rgba(255, 255, 255, 0.92)' : 'rgba(241, 245, 249, 0.75)';
    pxRect(ctx, fx, fy, size, size, alpha);
  }

  // Mullion grid bars
  pxRect(ctx, x + w / 2 - 1, y + 3, 3, h - 6, '#5A3A26');
  pxRect(ctx, x + 3, y + h / 2 - 1, w - 6, 3, '#5A3A26');
  // Frost / snow accumulated on middle crossbar
  pxRect(ctx, x + 9, y + h / 2 - 2, w / 2 - 11, 1, 'rgba(248, 250, 252, 0.85)');
  pxRect(ctx, x + w / 2 + 2, y + h / 2 - 2, w / 2 - 11, 1, 'rgba(248, 250, 252, 0.85)');
  // Curtains on edges
  pxRect(ctx, x + 2, y + 2, 6, h - 4, '#EFE7DA');
  pxRect(ctx, x + w - 8, y + 2, 6, h - 4, '#EFE7DA');
  // Sill with fresh snow drift accumulation
  pxRect(ctx, x - 3, y + h, w + 6, 4, '#7E5438');
  pxRect(ctx, x + 3, y + h - 4, w - 6, 2, '#F8FAFC');
  pxRect(ctx, x + 7, y + h - 5, 12, 1, '#FFFFFF');
  pxRect(ctx, x + w - 21, y + h - 5, 11, 1, '#FFFFFF');
}

export function drawFireplace(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number) {
  // Mantle & chimney
  pxRect(ctx, x, y, 56, 48, '#D5C7B6');
  pxRect(ctx, x + 2, y + 2, 52, 44, '#E2D6C5');
  pxRect(ctx, x - 3, y + 14, 62, 6, '#7A5438');
  pxRect(ctx, x - 3, y + 14, 62, 2, '#9A6E4D');
  // Small clock on mantle
  pxRect(ctx, x + 23, y + 4, 10, 10, '#593A25');
  pxRect(ctx, x + 25, y + 6, 6, 6, '#FAF6F0');
  pxRect(ctx, x + 28, y + 7, 1, 3, '#29221D');
  // Red & white holiday candles flanking the mantle clock
  pxRect(ctx, x + 8, y + 8, 3, 6, '#DC2626');
  pxRect(ctx, x + 9, y + 6, 1, 2, '#FDE047');
  pxRect(ctx, x + 45, y + 8, 3, 6, '#DC2626');
  pxRect(ctx, x + 46, y + 6, 1, 2, '#FDE047');
  // Pine garland & holly berries draped across fireplace mantle
  pxRect(ctx, x - 1, y + 15, 58, 3, '#2D6A4F');
  pxRect(ctx, x + 3, y + 17, 14, 2, '#1B4332');
  pxRect(ctx, x + 21, y + 17, 14, 2, '#1B4332');
  pxRect(ctx, x + 39, y + 17, 14, 2, '#1B4332');
  pxRect(ctx, x + 10, y + 16, 2, 2, '#EF4444');
  pxRect(ctx, x + 27, y + 16, 2, 2, '#EF4444');
  pxRect(ctx, x + 45, y + 16, 2, 2, '#EF4444');
  // Hanging red Christmas stockings with fluffy white cuffs
  const stockings = [x + 5, x + 15, x + 42];
  for (const sx of stockings) {
    pxRect(ctx, sx, y + 18, 5, 2, '#FAF6F0'); // White cuff
    pxRect(ctx, sx, y + 20, 5, 6, '#DC2626'); // Red leg
    pxRect(ctx, sx - 1, y + 24, 6, 3, '#B91C1C'); // Toe
  }
  // Hearth firebox
  pxRect(ctx, x + 10, y + 24, 36, 24, '#2A1D17');
  // Logs
  pxRect(ctx, x + 15, y + 40, 26, 5, '#6B4226');
  // Animated pixel flame
  const flicker = Math.floor(tick / 10) % 3;
  pxRect(ctx, x + 19, y + 32 - flicker, 18, 9 + flicker, '#E86A2C');
  pxRect(ctx, x + 23, y + 34 - (flicker === 1 ? 2 : 0), 10, 7, '#F7B538');
  pxRect(ctx, x + 26, y + 37, 4, 4, '#FFF3B0');
  // Hearth stone floor pad
  pxRect(ctx, x - 2, y + 48, 60, 8, '#9B8F83');
}

export function drawPinboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  extraPinCount: number,
  isActive: boolean,
  tick: number
) {
  if (isActive) {
    const pulse = 0.45 + Math.sin(tick * 0.22) * 0.35;
    ctx.save();
    ctx.strokeStyle = `rgba(245, 184, 65, ${pulse.toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(x) - 2, Math.round(y) - 2, Math.round(w) + 4, Math.round(h) + 4);
    ctx.restore();
  }

  pxRect(ctx, x, y, w, h, '#69462D');
  pxRect(ctx, x + 3, y + 3, w - 6, h - 6, '#B88758');
  // Tiny colorful pinned notes
  pxRect(ctx, x + 8, y + 6, 12, 10, '#FEF08A');
  pxRect(ctx, x + 13, y + 6, 2, 2, '#DC2626');
  pxRect(ctx, x + 24, y + 8, 16, 12, '#FAF6F0');
  pxRect(ctx, x + 26, y + 11, 11, 1, '#94A3B8');
  pxRect(ctx, x + 26, y + 14, 9, 1, '#94A3B8');
  pxRect(ctx, x + 46, y + 6, 14, 12, '#BFDBFE');
  pxRect(ctx, x + 65, y + 9, 12, 11, '#FDE68A');
  pxRect(ctx, x + 11, y + 18, 10, 5, '#D1FAE5');

  // Newly pinned notes added by Mina during this session
  const extraSlots = [
    { dx: 43, dy: 16, w: 12, h: 7, bg: '#FDBA74', pin: '#B91C1C' },
    { dx: 58, dy: 16, w: 11, h: 7, bg: '#86EFAC', pin: '#0F766E' },
    { dx: 74, dy: 16, w: 10, h: 7, bg: '#FDE047', pin: '#D97706' },
    { dx: 29, dy: 18, w: 11, h: 6, bg: '#F9A8D4', pin: '#9D174D' },
  ];
  const visibleExtra = Math.min(extraSlots.length, Math.max(0, extraPinCount));
  for (let i = 0; i < visibleExtra; i++) {
    const slot = extraSlots[i];
    pxRect(ctx, x + slot.dx, y + slot.dy, slot.w, slot.h, slot.bg);
    pxRect(ctx, x + slot.dx + Math.floor(slot.w / 2) - 1, y + slot.dy, 2, 2, slot.pin);
  }

  // Celebratory sparkle pixels on pinboard while Mina pins a task
  if (isActive && Math.floor(tick / 6) % 2 === 0) {
    pxRect(ctx, x + w - 8, y - 3, 2, 2, '#FEF08A');
    pxRect(ctx, x + 6, y - 4, 2, 2, '#FDE68A');
    pxRect(ctx, x + w / 2, y - 4, 2, 2, '#FAF6F0');
  }
}

export function drawRugs(ctx: CanvasRenderingContext2D) {
  // Living room festive Christmas woven rug (crimson, forest pine & warm gold trim)
  const lx = 1.8 * TILE;
  const ly = 4.2 * TILE;
  const lw = 4.5 * TILE;
  const lh = 4.8 * TILE;
  pxRect(ctx, lx, ly, lw, lh, '#E8C57B');
  pxRect(ctx, lx + 3, ly + 3, lw - 6, lh - 6, '#9B2C2C');
  pxRect(ctx, lx + 8, ly + 8, lw - 16, lh - 16, '#2D5A3C');
  pxRect(ctx, lx + 13, ly + 13, lw - 26, lh - 26, '#FAF0CA');
  pxRect(ctx, lx + 17, ly + 17, lw - 34, lh - 34, '#B91C1C');
  pxRect(ctx, lx + 23, ly + 23, lw - 46, lh - 46, '#EDE2D0');

  // North-West Office Planning Bay woven runner mat in front of Cork Pinboard
  const px = 12.25 * TILE;
  const py = 2.15 * TILE;
  const pw = 2.8 * TILE;
  const ph = 1.15 * TILE;
  pxRect(ctx, px, py, pw, ph, '#8B684A');
  pxRect(ctx, px + 3, py + 3, pw - 6, ph - 6, '#B89472');
  pxRect(ctx, px + 6, py + 6, pw - 12, ph - 12, '#D8C2A8');

  // Expanded Home Office Executive Calm Sage Rug (under Player's Desk & Central Drive Island)
  const ox = 14.75 * TILE;
  const oy = 4.35 * TILE;
  const ow = 5.15 * TILE;
  const oh = 5.25 * TILE;
  pxRect(ctx, ox, oy, ow, oh, '#5A7D70');
  pxRect(ctx, ox + 4, oy + 4, ow - 8, oh - 8, '#6F9486');
  pxRect(ctx, ox + 10, oy + 10, ow - 20, oh - 20, '#5E8275');

  // Mina's warm workstation floor mat in the dedicated East AI Suite
  const mx = 19.8 * TILE;
  const my = 6.4 * TILE;
  const mw = 1.5 * TILE;
  const mh = 2.8 * TILE;
  pxRect(ctx, mx, my, mw, mh, '#8C6B4E');
  pxRect(ctx, mx + 3, my + 3, mw - 6, mh - 6, '#A98562');
  pxRect(ctx, mx + 6, my + 6, mw - 12, mh - 12, '#9A7756');

  // Antigravity's sleek slate-indigo developer floor mat in the South-West Tech Zone
  const ax = 11.15 * TILE;
  const ay = 9.65 * TILE;
  const aw = 2.45 * TILE;
  const ah = 1.9 * TILE;
  pxRect(ctx, ax, ay, aw, ah, '#2D3548');
  pxRect(ctx, ax + 3, ay + 3, aw - 6, ah - 6, '#3B465E');
  pxRect(ctx, ax + 6, ay + 6, aw - 12, ah - 12, '#323C52');
}

export function drawMinaProximityZone(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  isWorking: boolean,
  tick: number
) {
  const dist = Math.hypot(player.x - MINA_POS.x, player.y - MINA_POS.y);
  const inOffice = getRoomZone(player.x, player.y) === 'office';
  if (!inOffice) return;

  const isInside = dist <= MINA_APPROACH_RADIUS || isWorking;
  const pulse = 0.04 * Math.sin(tick * 0.08);
  const strokeAlpha = isInside ? 0.42 + pulse : 0.18;
  const fillAlpha = isInside ? 0.08 : 0.03;

  ctx.save();
  // Clip to the expanded 12-column interior office floor so the ring stays cleanly inside walls & furniture edges
  ctx.beginPath();
  ctx.rect(
    (DIVIDER_COL + 1.05) * TILE,
    2.1 * TILE,
    (OFFICE_EAST_WALL_COL - DIVIDER_COL - 1.15) * TILE,
    9.75 * TILE
  );
  ctx.clip();

  ctx.beginPath();
  ctx.arc(MINA_POS.x, MINA_POS.y, MINA_APPROACH_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(245, 184, 65, ${fillAlpha.toFixed(3)})`;
  ctx.fill();

  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(245, 184, 65, ${strokeAlpha.toFixed(3)})`;
  ctx.stroke();
  ctx.restore();
}

export function drawAntigravityProximityZone(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  isAntigravityOpen: boolean,
  tick: number
) {
  const dist = Math.hypot(player.x - AGY_POS.x, player.y - AGY_POS.y);
  const inOffice = getRoomZone(player.x, player.y) === 'office';
  if (!inOffice) return;

  const isInside = dist <= AGY_APPROACH_RADIUS || isAntigravityOpen;
  const pulse = 0.04 * Math.sin(tick * 0.08);
  const strokeAlpha = isInside ? 0.45 + pulse : 0.18;
  const fillAlpha = isInside ? 0.08 : 0.03;

  ctx.save();
  // Clip to the expanded 12-column interior office floor so the ring stays cleanly inside walls
  ctx.beginPath();
  ctx.rect(
    (DIVIDER_COL + 1.05) * TILE,
    2.1 * TILE,
    (OFFICE_EAST_WALL_COL - DIVIDER_COL - 1.15) * TILE,
    9.75 * TILE
  );
  ctx.clip();

  ctx.beginPath();
  ctx.arc(AGY_POS.x, AGY_POS.y, AGY_APPROACH_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(56, 189, 248, ${fillAlpha.toFixed(3)})`;
  ctx.fill();

  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(56, 189, 248, ${strokeAlpha.toFixed(3)})`;
  ctx.stroke();
  ctx.restore();
}

export function drawAiStudioProximityZone(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  isAiStudioOpen: boolean,
  tick: number
) {
  const dist = Math.hypot(player.x - AISTUDIO_POS.x, player.y - AISTUDIO_POS.y);
  const inOffice = getRoomZone(player.x, player.y) === 'office';
  if (!inOffice) return;

  const isInside = dist <= AISTUDIO_APPROACH_RADIUS || isAiStudioOpen;
  const pulse = 0.04 * Math.sin(tick * 0.08);
  const strokeAlpha = isInside ? 0.48 + pulse : 0.18;
  const fillAlpha = isInside ? 0.09 : 0.03;

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    (DIVIDER_COL + 1.05) * TILE,
    2.1 * TILE,
    (OFFICE_EAST_WALL_COL - DIVIDER_COL - 1.15) * TILE,
    9.75 * TILE
  );
  ctx.clip();

  ctx.beginPath();
  ctx.arc(AISTUDIO_POS.x, AISTUDIO_POS.y, AISTUDIO_APPROACH_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(66, 133, 244, ${fillAlpha.toFixed(3)})`;
  ctx.fill();

  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(96, 165, 250, ${strokeAlpha.toFixed(3)})`;
  ctx.stroke();
  ctx.restore();
}

