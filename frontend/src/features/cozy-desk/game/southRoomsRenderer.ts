import type { GreenCarState, TimeOfDay } from '../types/game';
import {
  BEDROOM_DOOR_ROW_END,
  BEDROOM_DOOR_ROW_START,
  BEDROOM_FLOOR_COL_END,
  BEDROOM_FLOOR_COL_START,
  BEDROOM_FLOOR_ROW_END,
  BEDROOM_FLOOR_ROW_START,
  CORE_OFFSET_X,
  DIVIDER_COL,
  DRIVEWAY_COL_END,
  DRIVEWAY_COL_START,
  FOYER_FLOOR_ROW_END,
  FOYER_FLOOR_ROW_START,
  FOYER_KITCHEN_DOOR_COL_END,
  FOYER_KITCHEN_DOOR_COL_START,
  FOYER_SOUTH_WALL_ROW,
  FRONT_DOOR_COL_END,
  FRONT_DOOR_COL_START,
  GARAGE_BAY_OPENING_ROW,
  GARAGE_DOOR_ROW_END,
  GARAGE_DOOR_ROW_START,
  GARAGE_FLOOR_COL_END,
  GARAGE_FLOOR_COL_START,
  GARAGE_FLOOR_ROW_END,
  GARAGE_FLOOR_ROW_START,
  GARAGE_NORTH_WALL_ROW,
  GREEN_CAR_L,
  GREEN_CAR_W,
  GYM_DOOR_COL_END,
  GYM_DOOR_COL_START,
  GYM_FLOOR_COL_END,
  GYM_FLOOR_COL_START,
  GYM_FLOOR_ROW_END,
  GYM_FLOOR_ROW_START,
  LOWER_EAST_WALL_COL,
  LOWER_MID_WALL_ROW,
  MAILBOX_RECT,
  MAP_COLS,
  MID_WALL_ROW,
  OFFICE_EAST_WALL_COL,
  PORCH_PLANTER_RECT,
  PORCH_ROW_START,
  ROAD_ROW_END,
  ROAD_ROW_START,
  SIDEWALK_ROW_END,
  SIDEWALK_ROW_START,
  SLEEP_STATION_RECT,
  TILE,
  WALKWAY_ROW_END,
  WALKWAY_ROW_START,
  WEST_DIVIDER_COL,
  WORLD_H,
  WORLD_W,
} from './houseMap';

function pxRect(
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

function drawWallSegmentTopBeam(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  pxRect(ctx, x, y, w, h, '#3B281E');
  pxRect(ctx, x + 2, y + 3, w - 4, h - 6, '#5B3E2B');
  pxRect(ctx, x + 3, y + 3, w - 6, 2, '#735039');
}

function drawBedroomPictureWindow(
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

  // Outer warm oak casing
  pxRect(ctx, x - 3, y - 3, w + 6, h + 6, '#4D3220');
  pxRect(ctx, x - 1, y - 1, w + 2, h + 2, '#80573A');

  // Sky gradient
  pxRect(ctx, x, y, w, Math.floor(h * 0.55), skyTop);
  pxRect(ctx, x, y + Math.floor(h * 0.55), w, h - Math.floor(h * 0.55), skyBot);

  if (timeOfDay === 'evening') {
    // Twinkling pixel stars & warm moon
    const twinkle = Math.floor(tick / 28) % 2 === 0;
    pxRect(ctx, x + 8, y + 5, 2, 2, '#FDE68A');
    pxRect(ctx, x + 21, y + 9, 2, 2, twinkle ? '#FEF3C7' : '#CBD5E1');
    pxRect(ctx, x + w - 14, y + 5, 5, 5, '#FEF3C7');
  } else {
    // Soft winter clouds
    const drift = Math.floor(tick / 48) % 6;
    pxRect(ctx, x + 7 + drift, y + 5, 12, 4, 'rgba(255,255,255,0.78)');
    pxRect(ctx, x + w - 21 - Math.floor(drift / 2), y + 8, 10, 3, 'rgba(255,255,255,0.68)');
  }

  // Winter snowy landscape & snow-covered pine treetops visible outside
  const pineShade = timeOfDay === 'evening' ? '#27403B' : '#4E7365';
  pxRect(ctx, x + 1, y + h - 10, w - 2, 7, pineShade);
  pxRect(ctx, x + 1, y + h - 6, w - 2, 4, timeOfDay === 'evening' ? '#CBD5E1' : '#F8FAFC');
  pxRect(ctx, x + 6, y + h - 9, 10, 2, '#F1F5F9');
  pxRect(ctx, x + w - 18, y + h - 9, 11, 2, '#F1F5F9');

  // Animated gentle snowfall inside window glass (always snowing in morning, afternoon, and evening)
  const paneW = Math.max(12, w - 12);
  const paneH = Math.max(10, h - 6);
  const flakeCount = Math.max(9, Math.floor(w / 5));
  for (let i = 0; i < flakeCount; i++) {
    const speed = 0.22 + (i % 3) * 0.08;
    const fallY = (i * 11 + tick * speed) % paneH;
    const sway = Math.sin(tick * 0.05 + i * 1.7) * 2.0;
    const fx = x + 6 + ((i * 19 + sway + paneW) % paneW);
    const fy = y + 2 + fallY;
    const size = i % 4 === 0 ? 2 : 1;
    const alpha = i % 3 === 0 ? 'rgba(255, 255, 255, 0.92)' : 'rgba(241, 245, 249, 0.75)';
    pxRect(ctx, fx, fy, size, size, alpha);
  }

  // Mullions & frost on middle crossbar
  const midY = y + Math.floor(h * 0.52);
  pxRect(ctx, x + Math.floor(w / 2) - 1, y, 2, h, '#69442B');
  pxRect(ctx, x, midY, w, 2, '#69442B');
  pxRect(ctx, x + 6, midY - 1, Math.floor(w / 2) - 8, 1, 'rgba(248, 250, 252, 0.85)');
  pxRect(ctx, x + Math.floor(w / 2) + 2, midY - 1, Math.floor(w / 2) - 8, 1, 'rgba(248, 250, 252, 0.85)');

  // Soft linen sheer curtains tucked neatly to both sides
  pxRect(ctx, x - 3, y - 3, w + 6, 3, '#5C3B24');
  pxRect(ctx, x - 2, y, 7, h + 4, '#E8DFD1');
  pxRect(ctx, x + 1, y + 2, 2, h + 1, '#D3C5B2');
  pxRect(ctx, x + w - 5, y, 7, h + 4, '#E8DFD1');
  pxRect(ctx, x + w - 3, y + 2, 2, h + 1, '#D3C5B2');

  // Window sill with fresh snow drift accumulation
  pxRect(ctx, x - 4, y + h + 2, w + 8, 4, '#6B462D');
  pxRect(ctx, x - 3, y + h + 2, w + 6, 1, '#9A6C4B');
  pxRect(ctx, x + 5, y + h - 2, w - 10, 2, '#F8FAFC');
  pxRect(ctx, x + 8, y + h - 3, 9, 1, '#FFFFFF');
  pxRect(ctx, x + w - 17, y + h - 3, 8, 1, '#FFFFFF');
}

function drawGardenTree(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  timeOfDay: TimeOfDay,
  tick: number,
  variant: 'oak' | 'pine'
) {
  const sway = Math.floor(tick / 42) % 2;
  // Soft ground canopy shadow
  pxRect(ctx, cx - 22, cy + 16, 44, 12, 'rgba(18, 30, 20, 0.25)');
  // Sturdy wood trunk
  pxRect(ctx, cx - 5, cy + 4, 10, 18, '#5C3B24');
  pxRect(ctx, cx - 2, cy + 4, 4, 16, '#7C5133');

  const dark = timeOfDay === 'evening' ? '#1B3A2C' : variant === 'pine' ? '#24523A' : '#2D6A4F';
  const mid = timeOfDay === 'evening' ? '#254C3B' : variant === 'pine' ? '#336E4E' : '#40916C';
  const hi = timeOfDay === 'evening' ? '#33644E' : variant === 'pine' ? '#498F68' : '#52B788';

  if (variant === 'oak') {
    pxRect(ctx, cx - 22 + sway, cy - 16, 44, 24, dark);
    pxRect(ctx, cx - 18 + sway, cy - 22, 36, 26, mid);
    pxRect(ctx, cx - 12 + sway, cy - 26, 24, 16, hi);
    pxRect(ctx, cx - 6 + sway, cy - 22, 10, 6, timeOfDay === 'evening' ? '#437A60' : '#74C69D');
  } else {
    pxRect(ctx, cx - 19, cy - 4, 38, 12, dark);
    pxRect(ctx, cx - 15, cy - 14, 30, 13, mid);
    pxRect(ctx, cx - 10 + sway, cy - 23, 20, 12, hi);
    pxRect(ctx, cx - 5 + sway, cy - 29, 10, 8, hi);
  }
}

function drawGardenShrub(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  timeOfDay: TimeOfDay,
  blossomColor?: string
) {
  const dark = timeOfDay === 'evening' ? '#1E3C2D' : '#2F6547';
  const mid = timeOfDay === 'evening' ? '#294E3B' : '#44845E';
  const hi = timeOfDay === 'evening' ? '#39684F' : '#61A67B';
  pxRect(ctx, x + 2, y + 11, w - 2, 4, 'rgba(18, 28, 20, 0.22)');
  pxRect(ctx, x, y + 3, w, 10, dark);
  pxRect(ctx, x + 2, y + 1, w - 4, 9, mid);
  pxRect(ctx, x + 5, y, w - 10, 4, hi);
  if (blossomColor) {
    for (let bx = x + 5; bx < x + w - 5; bx += 9) {
      pxRect(ctx, bx, y + 3 + ((bx / 9) % 2) * 2, 3, 3, blossomColor);
    }
  }
}

// =============================================================================
// 1. MASTER BEDROOM (Upper-West Wing: cols 1..8, rows 2..11 — left of Living Room, above Bathroom)
// =============================================================================

export function drawWestBedroomFloor(ctx: CanvasRenderingContext2D) {
  // Warm honey-oak parquet bedroom planks (cols 1..8, rows 2..11)
  for (let row = BEDROOM_FLOOR_ROW_START; row <= BEDROOM_FLOOR_ROW_END; row++) {
    for (let col = BEDROOM_FLOOR_COL_START; col <= BEDROOM_FLOOR_COL_END; col++) {
      const x = col * TILE;
      const y = row * TILE;
      const isAlt = (col + row) % 2 === 0;
      const base = isAlt ? '#C89B6B' : '#BF9161';
      const line = '#966B41';
      const sheen = '#D7AD7E';

      pxRect(ctx, x, y, TILE, TILE, base);
      pxRect(ctx, x, y + 10, TILE, 1, line);
      pxRect(ctx, x, y + 21, TILE, 1, line);
      pxRect(ctx, x, y + 31, TILE, 1, line);
      pxRect(ctx, x, y + 1, TILE, 1, sheen);
      pxRect(ctx, x, y + 11, TILE, 1, sheen);
      const j1 = ((col * 11 + row * 7) % 20) + 5;
      const j2 = ((col * 5 + row * 17) % 20) + 5;
      pxRect(ctx, x + j1, y, 1, 10, line);
      pxRect(ctx, x + j2, y + 11, 1, 10, line);
      pxRect(ctx, x + ((j1 + 11) % 24) + 3, y + 22, 1, 9, line);
    }
  }

  // Master Bedroom <-> Living Room doorway threshold (col 9, rows 6..8)
  const doorX = WEST_DIVIDER_COL * TILE;
  const doorY = BEDROOM_DOOR_ROW_START * TILE;
  const doorH = (BEDROOM_DOOR_ROW_END - BEDROOM_DOOR_ROW_START + 1) * TILE;
  pxRect(ctx, doorX, doorY, TILE, doorH, '#8B603A');
  pxRect(ctx, doorX + 3, doorY + 2, TILE - 6, doorH - 4, '#A47548');
  pxRect(ctx, doorX + 6, doorY + 6, TILE - 12, doorH - 12, '#B68657');

  // Large Plush Woven Wool Rug beneath the King Bed & Bench (cols 2.2..7.2, rows 3.1..6.65)
  const rugX = Math.round(2.2 * TILE);
  const rugY = Math.round(3.1 * TILE);
  const rugW = Math.round(5.0 * TILE);
  const rugH = Math.round(3.55 * TILE);
  pxRect(ctx, rugX + 2, rugY + 2, rugW, rugH, 'rgba(35, 22, 14, 0.14)');
  pxRect(ctx, rugX - 2, rugY + 3, 2, rugH - 6, '#E8DFD1');
  pxRect(ctx, rugX + rugW, rugY + 3, 2, rugH - 6, '#E8DFD1');
  pxRect(ctx, rugX, rugY, rugW, rugH, '#8D584B');
  pxRect(ctx, rugX + 4, rugY + 4, rugW - 8, rugH - 8, '#D9CBB9');
  pxRect(ctx, rugX + 8, rugY + 8, rugW - 16, rugH - 16, '#E8DEC8');
  pxRect(ctx, rugX + 12, rugY + 12, rugW - 24, 2, '#B67863');
  pxRect(ctx, rugX + 12, rugY + rugH - 14, rugW - 24, 2, '#B67863');
  pxRect(ctx, rugX + 12, rugY + 12, 2, rugH - 24, '#B67863');
  pxRect(ctx, rugX + rugW - 14, rugY + 12, 2, rugH - 24, '#B67863');

  // Round braided jute rug under the SE reading armchair (cols 6.35..8.55, rows 9.35..11.5)
  const nrX = Math.round(6.35 * TILE);
  const nrY = Math.round(9.45 * TILE);
  pxRect(ctx, nrX + 4, nrY, 58, 56, '#A57E53');
  pxRect(ctx, nrX, nrY + 4, 66, 48, '#A57E53');
  pxRect(ctx, nrX + 6, nrY + 3, 54, 50, '#C8A377');
  pxRect(ctx, nrX + 3, nrY + 6, 60, 44, '#C8A377');
  pxRect(ctx, nrX + 10, nrY + 9, 46, 38, '#D9BA91');
}

export function drawWestBedroomWalls(
  ctx: CanvasRenderingContext2D,
  timeOfDay: TimeOfDay,
  tick: number,
  bedroomLightsOff = false
) {
  // 1. North outer timber shell & West outer wall covering Master Bedroom & Bathroom (col 0, rows 0..22)
  pxRect(ctx, 0, 0, (WEST_DIVIDER_COL + 1) * TILE, 10, '#3B281E');
  pxRect(ctx, 0, 0, TILE, (LOWER_MID_WALL_ROW + 1) * TILE, '#3B281E');
  pxRect(ctx, TILE - 5, 10, 5, LOWER_MID_WALL_ROW * TILE - 10, '#5B3E2B');

  // Bathroom south outer wall (cols 0..9, row 22) with cozy exterior siding trim
  const bathSouthY = LOWER_MID_WALL_ROW * TILE;
  pxRect(ctx, 0, bathSouthY, (WEST_DIVIDER_COL + 1) * TILE, TILE, '#3B281E');
  pxRect(ctx, TILE, bathSouthY + 14, WEST_DIVIDER_COL * TILE, 16, '#7C573B');
  pxRect(ctx, TILE, bathSouthY + 18, WEST_DIVIDER_COL * TILE, 2, '#62432C');
  pxRect(ctx, TILE, bathSouthY + 24, WEST_DIVIDER_COL * TILE, 2, '#62432C');

  // 2. Master Bedroom North Interior Wall (cols 1..8, rows 0..1)
  const bedWallX = TILE;
  const bedWallW = (WEST_DIVIDER_COL - 1) * TILE; // 8 tiles
  pxRect(ctx, bedWallX, 10, bedWallW, 2 * TILE - 10, '#EAE0D2');
  for (let wx = bedWallX + 8; wx < bedWallX + bedWallW; wx += 14) {
    pxRect(ctx, wx, 10, 2, 2 * TILE - 24, 'rgba(138, 108, 82, 0.08)');
  }
  // Honey-oak wainscoting
  pxRect(ctx, bedWallX, 2 * TILE - 14, bedWallW, 14, '#7A5438');
  pxRect(ctx, bedWallX, 2 * TILE - 14, bedWallW, 2, '#9A6E4D');
  pxRect(ctx, bedWallX, 2 * TILE - 2, bedWallW, 2, '#4A3121');

  // (a) Twin Snowy Bedroom Picture Windows flanking the King Bed (auto-switches to night when sleeping)
  const windowSkyTime: TimeOfDay = bedroomLightsOff ? 'evening' : timeOfDay;
  drawBedroomPictureWindow(ctx, Math.round(1.3 * TILE), 16, Math.round(1.55 * TILE), 31, windowSkyTime, tick);
  drawBedroomPictureWindow(ctx, Math.round(6.75 * TILE), 16, Math.round(1.55 * TILE), 31, windowSkyTime, tick);

  // (b) Framed Serene Golden-Hour Landscape Artwork Centered Above the King Bed (cols 3.9..5.7)
  const artX = Math.round(3.9 * TILE);
  const artY = 17;
  const artW = Math.round(1.8 * TILE);
  const artH = 22;
  pxRect(ctx, artX, artY, artW, artH, '#5C3B24');
  pxRect(ctx, artX + 2, artY + 2, artW - 4, artH - 4, '#FAF6F0');
  pxRect(ctx, artX + 4, artY + 4, artW - 8, 7, '#F3B67A');
  pxRect(ctx, artX + 4, artY + 11, artW - 8, 7, '#6F8F7D');
  pxRect(ctx, artX + 12, artY + 9, 14, 4, '#8A9E8F');
  pxRect(ctx, artX + 34, artY + 6, 5, 5, '#FDE68A');

  // (c) Warm Brass Bedside Wall Sconces flanking the artwork (unlit when sleeping)
  for (const sconceCol of [3.22, 6.18]) {
    const sx = Math.round(sconceCol * TILE);
    const sy = 25;
    pxRect(ctx, sx, sy + 6, 6, 4, bedroomLightsOff ? '#6E5A3E' : '#B58947');
    pxRect(ctx, sx - 1, sy, 8, 7, bedroomLightsOff ? '#6B635B' : '#FAF2DE');
    pxRect(ctx, sx + 1, sy + 1, 4, 5, bedroomLightsOff ? '#524B45' : '#FFF5C2');
  }

  // 3. West Vertical Dividing Wall (col 9, rows 0..11) separating Master Bedroom <-> Living Room (open doorway rows 6..8)
  const dx = WEST_DIVIDER_COL * TILE;
  pxRect(ctx, dx, 0, TILE, BEDROOM_DOOR_ROW_START * TILE, '#4B3224');
  pxRect(ctx, dx + 3, 10, TILE - 6, BEDROOM_DOOR_ROW_START * TILE - 14, '#6E4A33');
  pxRect(ctx, dx + 4, BEDROOM_DOOR_ROW_START * TILE - 10, TILE - 8, 10, '#8D6042');
  const lowerY = (BEDROOM_DOOR_ROW_END + 1) * TILE;
  const upperLowerH = MID_WALL_ROW * TILE - lowerY;
  pxRect(ctx, dx, lowerY, TILE, upperLowerH, '#4B3224');
  pxRect(ctx, dx + 3, lowerY + 4, TILE - 6, upperLowerH - 4, '#6E4A33');
  pxRect(ctx, dx + 4, lowerY, TILE - 8, 4, '#8D6042');
}

export function drawWestBedroomFurniture(
  ctx: CanvasRenderingContext2D,
  tick: number,
  hasLoggedTodaySleep = false,
  isSleepLogOpen = false,
  isSleepingInBed = false
) {
  // 1. Left & Right Oak Nightstands with Warm Table Lamps (cols 1.85..2.85 & 6.75..7.75, rows 2.0..3.0)
  // Right nightstand hosts the Daily Sleep Quest Station (Smart Sleep Dock + Sleep Journal)
  const drawNightstand = (colStart: number, side: 'left' | 'right') => {
    const nx = Math.round(colStart * TILE);
    const ny = Math.round(2.0 * TILE);
    const nw = TILE;
    const nh = TILE;
    pxRect(ctx, nx + 2, ny + nh - 1, nw - 4, 5, 'rgba(28, 20, 15, 0.24)');
    pxRect(ctx, nx, ny, nw, nh, '#563621');
    pxRect(ctx, nx + 2, ny + 2, nw - 4, nh - 10, '#8E613E');
    pxRect(ctx, nx + 3, ny + 3, nw - 6, 2, '#AD7B54');
    pxRect(ctx, nx + 3, ny + nh - 8, nw - 6, 6, '#754D30');
    pxRect(ctx, nx + 14, ny + nh - 6, 4, 2, '#E8C57B');
    const lx = side === 'left' ? nx + 5 : nx + 16;
    pxRect(ctx, lx + 3, ny + 9, 6, 8, isSleepingInBed ? '#7A6345' : '#C89E68');
    pxRect(ctx, lx, ny + 2, 12, 8, isSleepingInBed ? '#6E665E' : '#FAF0DA');
    pxRect(ctx, lx + 2, ny + 3, 8, 5, isSleepingInBed ? '#56504A' : '#FFF5C2');
    if (side === 'left') {
      pxRect(ctx, nx + 20, ny + 11, 7, 7, '#5E8A78');
      pxRect(ctx, nx + 21, ny + 13, 5, 3, '#FAF6F0');
    } else {
      // Smart Sleep Tracker Dock + Sleep Diary on the right nightstand
      const pulse = Math.floor(tick / 18) % 2 === 0;
      const screenGlow = isSleepLogOpen
        ? '#A5B4FC'
        : hasLoggedTodaySleep
          ? '#6EE7B7'
          : pulse
            ? '#818CF8'
            : '#6366F1';
      // Compact indigo-bound sleep diary
      pxRect(ctx, nx + 3, ny + 12, 11, 9, '#312E81');
      pxRect(ctx, nx + 4, ny + 13, 9, 7, '#4338CA');
      pxRect(ctx, nx + 6, ny + 15, 5, 1, '#E0E7FF');
      pxRect(ctx, nx + 6, ny + 17, 4, 1, '#C7D2FE');
      // Upright bedside phone/smartwatch sleep-sync dock next to lamp
      pxRect(ctx, nx + 4, ny + 5, 9, 7, '#1E1B2E');
      pxRect(ctx, nx + 5, ny + 6, 7, 5, screenGlow);
      // Tiny crescent moon pixel glint on dock screen
      pxRect(ctx, nx + 7, ny + 7, 2, 3, '#FAF6F0');
      pxRect(ctx, nx + 9, ny + 8, 2, 1, hasLoggedTodaySleep ? '#065F46' : '#312E81');
    }
  };
  drawNightstand(1.85, 'left');
  drawNightstand(6.75, 'right');

  // 2. Grand Master King Bed (cols 3.0..6.6, rows 2.0..5.1)
  const bx = Math.round(3.0 * TILE);
  const by = Math.round(1.65 * TILE);
  const bw = Math.round(3.6 * TILE);
  const bh = Math.round(3.45 * TILE);
  pxRect(ctx, bx + 3, by + bh - 2, bw - 6, 7, 'rgba(28, 20, 15, 0.26)');

  pxRect(ctx, bx, by, bw, 24, '#4B2E1C');
  pxRect(ctx, bx + 3, by + 3, bw - 6, 18, '#7A4E30');
  pxRect(ctx, bx + 6, by + 5, bw - 12, 12, '#8F5E3B');
  pxRect(ctx, bx + 6, by + 5, bw - 12, 2, '#AA744E');
  pxRect(ctx, bx - 1, by - 2, 7, 26, '#5D3A24');
  pxRect(ctx, bx + bw - 6, by - 2, 7, 26, '#5D3A24');

  pxRect(ctx, bx, by + 22, bw, bh - 22, '#563621');
  pxRect(ctx, bx + 3, by + 23, bw - 6, bh - 29, '#F5EFE6');

  pxRect(ctx, bx + 7, by + 24, 46, 17, '#DFD5C6');
  pxRect(ctx, bx + 9, by + 25, 42, 14, '#FAF6F0');
  pxRect(ctx, bx + bw - 53, by + 24, 46, 17, '#DFD5C6');
  pxRect(ctx, bx + bw - 51, by + 25, 42, 14, '#FAF6F0');

  // Decorative throw pillows (left pillow pushed neatly aside when player sleeps)
  if (!isSleepingInBed) {
    pxRect(ctx, bx + 16, by + 33, 27, 13, '#6F9486');
    pxRect(ctx, bx + 18, by + 35, 23, 9, '#88ADA0');
  }
  pxRect(ctx, bx + bw - 43, by + 33, 27, 13, '#C77A60');
  pxRect(ctx, bx + bw - 41, by + 35, 23, 9, '#DC9277');
  pxRect(ctx, bx + Math.floor(bw / 2) - 11, by + 35, 22, 11, '#E6C27A');
  pxRect(ctx, bx + Math.floor(bw / 2) - 9, by + 37, 18, 7, '#F2D699');

  // Player peacefully tucked under the duvet on the left side of the King Bed
  if (isSleepingInBed) {
    const breathShift = Math.sin(tick * 0.045) > 0.35 ? 1 : 0;
    const px = bx + 30;
    const py = by + 34;
    // Head resting comfortably on the left white pillow
    pxRect(ctx, px - 8, py - 8, 16, 14, '#5A3724');
    pxRect(ctx, px - 6, py - 5, 12, 10, '#F6CCB0');
    pxRect(ctx, px - 7, py - 8, 14, 5, '#6A422B');
    // Peaceful closed sleeping eyes & cozy blush
    pxRect(ctx, px - 4, py, 3, 1, '#3A261B');
    pxRect(ctx, px + 1, py, 3, 1, '#3A261B');
    pxRect(ctx, px - 5, py + 2, 2, 1, 'rgba(225, 125, 110, 0.55)');
    pxRect(ctx, px + 3, py + 2, 2, 1, 'rgba(225, 125, 110, 0.55)');
    // Relaxed sweater collar & shoulders peeking above the folded cream sheet
    pxRect(ctx, px - 8, py + 6 + breathShift, 16, 10, '#6A7B53');
    pxRect(ctx, px - 6, py + 6 + breathShift, 12, 3, '#7C8F62');
    // Hand resting softly near the edge of the pillow
    pxRect(ctx, px + 8, py + 5 + breathShift, 4, 3, '#F6CCB0');
  }

  pxRect(ctx, bx + 3, by + 48, bw - 6, 9, '#EAE2D6');
  pxRect(ctx, bx + 3, by + 56, bw - 6, bh - 62, '#5E8075');
  pxRect(ctx, bx + 5, by + 58, bw - 10, bh - 66, '#71968A');
  if (isSleepingInBed) {
    // Cozy tucked duvet contour mound over the sleeping player
    const breathLift = Math.sin(tick * 0.045) > 0.35 ? 1 : 0;
    pxRect(ctx, bx + 16, by + 54 - breathLift, 28, 30, '#7CA497');
    pxRect(ctx, bx + 19, by + 56 - breathLift, 22, 24, '#88B2A4');
  }
  for (let qy = by + 63; qy < by + bh - 24; qy += 10) {
    for (let qx = bx + 12; qx < bx + bw - 12; qx += 16) {
      pxRect(ctx, qx, qy, 6, 2, 'rgba(250, 246, 240, 0.16)');
    }
  }
  pxRect(ctx, bx + 3, by + bh - 25, bw - 6, 17, '#A95D47');
  pxRect(ctx, bx + 5, by + bh - 23, bw - 10, 13, '#C5745B');
  pxRect(ctx, bx + 5, by + bh - 18, bw - 10, 3, '#E8C57B');
  pxRect(ctx, bx, by + bh - 8, bw, 8, '#4B2E1C');
  pxRect(ctx, bx + 2, by + bh - 6, bw - 4, 4, '#7A4E30');

  // 3. Upholstered End-of-Bed Bench (cols 3.35..6.1, rows 5.35..6.12)
  const ebX = Math.round(3.35 * TILE);
  const ebY = Math.round(5.35 * TILE);
  const ebW = Math.round(2.75 * TILE);
  const ebH = Math.round(0.78 * TILE);
  pxRect(ctx, ebX + 2, ebY + ebH - 1, ebW - 4, 5, 'rgba(28, 20, 15, 0.22)');
  pxRect(ctx, ebX + 3, ebY + ebH - 4, 5, 6, '#4D2F1C');
  pxRect(ctx, ebX + ebW - 8, ebY + ebH - 4, 5, 6, '#4D2F1C');
  pxRect(ctx, ebX, ebY, ebW, ebH - 2, '#6A462B');
  pxRect(ctx, ebX + 2, ebY + 2, ebW - 4, ebH - 7, '#DFD2BF');
  pxRect(ctx, ebX + 4, ebY + 4, ebW - 8, ebH - 11, '#EDE3D4');
  for (let bxDot = ebX + 16; bxDot < ebX + ebW - 12; bxDot += 22) {
    pxRect(ctx, bxDot, ebY + 10, 3, 3, '#BFA98E');
  }

  // 4. Large Oak Double-Door Bedroom Wardrobe (west wall: cols 1.1..2.4, rows 6.2..9.15)
  const wdX = Math.round(1.1 * TILE);
  const wdY = Math.round(6.2 * TILE);
  const wdW = Math.round(1.3 * TILE);
  const wdH = Math.round(2.95 * TILE);
  pxRect(ctx, wdX + 2, wdY + wdH - 1, wdW - 2, 5, 'rgba(28, 20, 15, 0.26)');
  pxRect(ctx, wdX, wdY, wdW, wdH, '#4D2F1C');
  pxRect(ctx, wdX + 3, wdY + 3, wdW - 6, wdH - 6, '#7E5334');
  pxRect(ctx, wdX + 2, wdY + 2, wdW - 4, 7, '#996844');
  pxRect(ctx, wdX + 5, wdY + 12, wdW - 12, 36, '#6B4429');
  pxRect(ctx, wdX + 7, wdY + 14, wdW - 16, 32, '#875938');
  pxRect(ctx, wdX + 5, wdY + 52, wdW - 12, 36, '#6B4429');
  pxRect(ctx, wdX + 7, wdY + 54, wdW - 16, 32, '#875938');
  pxRect(ctx, wdX + wdW - 5, wdY + 14, 3, 32, '#CBE2E8');
  pxRect(ctx, wdX + wdW - 5, wdY + 54, 3, 32, '#CBE2E8');
  pxRect(ctx, wdX + wdW - 9, wdY + 42, 2, 6, '#E8C57B');
  pxRect(ctx, wdX + wdW - 9, wdY + 56, 2, 6, '#E8C57B');

  // 5. Tall Potted Fiddle-Leaf Fig Tree (SW corner: cols 1.15..2.05, rows 10.15..11.15)
  const figX = Math.round(1.15 * TILE);
  const figY = Math.round(10.15 * TILE);
  const leafSway = Math.floor(tick / 34) % 2;
  pxRect(ctx, figX + 4, figY + 27, 20, 6, 'rgba(28, 20, 15, 0.24)');
  pxRect(ctx, figX + 5, figY + 14, 18, 16, '#8F6A43');
  pxRect(ctx, figX + 7, figY + 16, 14, 12, '#B88E60');
  pxRect(ctx, figX + 7, figY + 20, 14, 2, '#9A7249');
  pxRect(ctx, figX + 7, figY + 24, 14, 2, '#9A7249');
  pxRect(ctx, figX + 2, figY + 2 + leafSway, 11, 11, '#2D6A4F');
  pxRect(ctx, figX + 14, figY + 1, 12, 11, '#3B7D5E');
  pxRect(ctx, figX + 7, figY - 4, 13, 12, '#40916C');
  pxRect(ctx, figX + 9, figY - 2, 7, 5, '#52B788');

  // 6. Dressing Vanity Table & Cushioned Stool (south wall: cols 2.55..5.15, rows 10.55..11.65)
  const vnX = Math.round(2.55 * TILE);
  const vnY = Math.round(10.55 * TILE);
  const vnW = Math.round(2.6 * TILE);
  const vnH = Math.round(1.1 * TILE);
  pxRect(ctx, vnX + 31, vnY - 12, 20, 15, '#6B462D');
  pxRect(ctx, vnX + 33, vnY - 10, 16, 11, '#E8DAC4');
  pxRect(ctx, vnX + 35, vnY - 8, 12, 7, '#F5EDE0');
  pxRect(ctx, vnX + 2, vnY + vnH - 1, vnW - 4, 5, 'rgba(28, 20, 15, 0.24)');
  pxRect(ctx, vnX, vnY, vnW, vnH, '#5A3A24');
  pxRect(ctx, vnX + 2, vnY + 2, vnW - 4, vnH - 8, '#F2EAE0');
  pxRect(ctx, vnX + 3, vnY + 3, vnW - 6, 2, '#FFFFFF');
  pxRect(ctx, vnX + 17, vnY + vnH - 12, 49, 10, '#8D6242');
  pxRect(ctx, vnX + 20, vnY + vnH - 10, 43, 6, '#D0E7EE');
  pxRect(ctx, vnX + 23, vnY + vnH - 9, 4, 3, '#FFF8D6');
  pxRect(ctx, vnX + 56, vnY + vnH - 9, 4, 3, '#FFF8D6');
  pxRect(ctx, vnX + 6, vnY + 7, 10, 10, '#C88D74');
  pxRect(ctx, vnX + 9, vnY + 10, 4, 3, '#E8C57B');
  pxRect(ctx, vnX + 67, vnY + 7, 5, 8, '#F9A8D4');
  pxRect(ctx, vnX + 74, vnY + 9, 4, 6, '#93C5FD');

  // 7. Cozy SE Reading Nook: Armchair, Round Side Table & Brass Floor Lamp (cols 6.45..8.65, rows 9.45..11.6)
  const rnX = Math.round(6.45 * TILE);
  const rnY = Math.round(9.45 * TILE);
  pxRect(ctx, rnX + 52, rnY + 2, 14, 14, isSleepingInBed ? '#524433' : '#7A562C');
  pxRect(ctx, rnX + 54, rnY + 4, 10, 10, isSleepingInBed ? '#6A625A' : '#FAF0DA');
  pxRect(ctx, rnX + 56, rnY + 6, 6, 6, isSleepingInBed ? '#4E4842' : '#FFF7CC');

  pxRect(ctx, rnX + 16, rnY + 52, 36, 6, 'rgba(28, 20, 15, 0.24)');
  pxRect(ctx, rnX + 14, rnY + 16, 38, 38, '#7A4938');
  pxRect(ctx, rnX + 17, rnY + 42, 32, 10, '#9E614B'); // Curved backrest facing north-west into bedroom
  pxRect(ctx, rnX + 14, rnY + 20, 7, 24, '#8F5642');
  pxRect(ctx, rnX + 45, rnY + 20, 7, 24, '#8F5642');
  pxRect(ctx, rnX + 21, rnY + 19, 24, 22, '#B5735B');
  pxRect(ctx, rnX + 23, rnY + 21, 20, 16, '#C8856D');
  pxRect(ctx, rnX + 25, rnY + 33, 14, 8, '#EFE5D5');

  pxRect(ctx, rnX + 2, rnY + 34, 20, 20, '#593A24');
  pxRect(ctx, rnX + 4, rnY + 36, 16, 16, '#966844');
  pxRect(ctx, rnX + 6, rnY + 39, 9, 8, '#FAF6F0');
  pxRect(ctx, rnX + 10, rnY + 39, 1, 8, '#C8BDB0');
  pxRect(ctx, rnX + 15, rnY + 45, 4, 4, '#5E8A78');
}

// =============================================================================
// 2. ENTRYWAY / FOYER, FRONT PORCH, LONG FRONT WALKWAY, 2-CAR GARAGE & STREET
// =============================================================================

export function drawSouthRoomsFloors(
  ctx: CanvasRenderingContext2D,
  timeOfDay: TimeOfDay,
  tick: number
) {
  const grassA = timeOfDay === 'evening' ? '#334F3A' : '#5A8954';
  const grassB = timeOfDay === 'evening' ? '#2B4431' : '#4E7D4A';
  const grassHi = timeOfDay === 'evening' ? '#406348' : '#73A66A';

  // 0a. Front & Side Yard Grass Base (West Front Yard cols 0..18 rows 23..38 + East Front Strips flanking Driveway cols 19..32 rows 30..38)
  const westLawnY = (LOWER_MID_WALL_ROW + 1) * TILE;
  const westLawnW = LOWER_EAST_WALL_COL * TILE;
  const westLawnH = (SIDEWALK_ROW_START - LOWER_MID_WALL_ROW - 1) * TILE;
  pxRect(ctx, 0, westLawnY, westLawnW, westLawnH, grassA);

  const eastLawnX = LOWER_EAST_WALL_COL * TILE;
  const eastLawnY = GARAGE_BAY_OPENING_ROW * TILE;
  const eastLawnW = (MAP_COLS - LOWER_EAST_WALL_COL) * TILE;
  const eastLawnH = (SIDEWALK_ROW_START - GARAGE_BAY_OPENING_ROW) * TILE;
  pxRect(ctx, eastLawnX, eastLawnY, eastLawnW, eastLawnH, grassA);

  // Subtle mowed grass texture across west & front lawns
  for (let gy = westLawnY; gy < SIDEWALK_ROW_START * TILE; gy += 24) {
    for (let gx = 4; gx < WORLD_W - 12; gx += 28) {
      if (gx >= eastLawnX && gy < eastLawnY) continue;
      const shift = ((gy / 24) % 2) * 12;
      pxRect(ctx, gx + shift, gy + 6, 12, 10, grassB);
      pxRect(ctx, gx + shift + 3, gy + 8, 5, 2, grassHi);
    }
  }

  // Decorative stone stepping path curving across West Front Lawn toward walkway
  for (const [sx, sy] of [
    [2.6, 28.5],
    [4.4, 29.8],
    [6.3, 31.0],
    [8.2, 32.1],
    [10.2, 33.1],
  ]) {
    pxRect(ctx, sx * TILE, sy * TILE, 24, 13, '#A89F92');
    pxRect(ctx, sx * TILE + 2, sy * TILE + 2, 20, 9, '#CFC7BA');
  }

  // Cheerful scattered lawn wildflowers across West Lawn & Pocket Lawn
  const flowerBob = Math.floor(tick / 30) % 2;
  const lawnFlowers: Array<[number, number, string]> = [
    [1.6, 24.5, '#FDE68A'],
    [3.1, 25.4, '#FCA5A5'],
    [6.4, 24.8, '#FAF6F0'],
    [2.2, 33.8, '#FDE68A'],
    [7.8, 35.2, '#FCA5A5'],
    [10.6, 36.4, '#FAF6F0'],
    [17.4, 36.2, '#FDE68A'],
    [19.2, 35.5, '#FCA5A5'],
  ];
  for (const [fx, fy, col] of lawnFlowers) {
    pxRect(ctx, fx * TILE, fy * TILE + flowerBob, 3, 3, col);
  }

  // =========================================================================
  // 0b. HOME GYM / FITNESS STUDIO FLOOR (cols 20..31, rows 14..19)
  //     + OPEN DOORWAY THRESHOLD FROM HOME OFFICE (cols 28..29, rows 12..13)
  // =========================================================================
  const gymX = GYM_FLOOR_COL_START * TILE;
  const gymY = GYM_FLOOR_ROW_START * TILE;
  const gymW = (GYM_FLOOR_COL_END - GYM_FLOOR_COL_START + 1) * TILE; // 12 tiles
  const gymH = (GYM_FLOOR_ROW_END - GYM_FLOOR_ROW_START + 1) * TILE; // 6 tiles

  // West Strength Zone (cols 20..26): Shock-absorbing speckled charcoal rubber interlocking gym tiles
  for (let row = GYM_FLOOR_ROW_START; row <= GYM_FLOOR_ROW_END; row++) {
    for (let col = GYM_FLOOR_COL_START; col <= 26; col++) {
      const tx = col * TILE;
      const ty = row * TILE;
      const base = (col + row) % 2 === 0 ? '#3C424B' : '#373D45';
      pxRect(ctx, tx, ty, TILE, TILE, '#2C3138'); // Interlocking seam grout
      pxRect(ctx, tx + 1, ty + 1, TILE - 2, TILE - 2, base);
      // Subtle rubber EPDM speckle flecks (warm cream & muted sage)
      const f1x = ((col * 7 + row * 11) % 22) + 4;
      const f1y = ((col * 13 + row * 5) % 22) + 4;
      const f2x = ((col * 17 + row * 3) % 20) + 6;
      const f2y = ((col * 5 + row * 19) % 20) + 6;
      pxRect(ctx, tx + f1x, ty + f1y, 2, 2, 'rgba(220, 224, 228, 0.22)');
      pxRect(ctx, tx + f2x, ty + f2y, 2, 1, 'rgba(138, 178, 164, 0.24)');
      pxRect(ctx, tx + ((f1x + 11) % 24) + 3, ty + ((f2y + 9) % 24) + 3, 1, 2, 'rgba(226, 176, 114, 0.2)');
    }
  }

  // East Cardio & Mobility Studio Zone (cols 27..31): Warm athletic natural maple wood planks
  for (let row = GYM_FLOOR_ROW_START; row <= GYM_FLOOR_ROW_END; row++) {
    for (let col = 27; col <= GYM_FLOOR_COL_END; col++) {
      const tx = col * TILE;
      const ty = row * TILE;
      const base = (col + row) % 2 === 0 ? '#D4B48A' : '#CCA97E';
      pxRect(ctx, tx, ty, TILE, TILE, base);
      pxRect(ctx, tx, ty + 10, TILE, 1, '#AE8B61');
      pxRect(ctx, tx, ty + 21, TILE, 1, '#AE8B61');
      pxRect(ctx, tx, ty + 31, TILE, 1, '#AE8B61');
      pxRect(ctx, tx, ty + 1, TILE, 1, '#E2C69F');
      pxRect(ctx, tx, ty + 11, TILE, 1, '#E2C69F');
      const j1 = ((col * 9 + row * 13) % 20) + 5;
      const j2 = ((col * 15 + row * 7) % 20) + 5;
      pxRect(ctx, tx + j1, ty, 1, 10, '#AE8B61');
      pxRect(ctx, tx + j2, ty + 11, 1, 10, '#AE8B61');
    }
  }

  // Brushed aluminum floor transition strip dividing rubber weight zone & maple stretch studio
  pxRect(ctx, 27 * TILE - 2, gymY, 4, gymH, '#7B848E');
  pxRect(ctx, 27 * TILE - 1, gymY, 2, gymH, '#CBD5E1');

  // Subtle architectural contact shadows along gym walls
  pxRect(ctx, gymX, gymY, gymW, 5, 'rgba(18, 22, 28, 0.18)');
  pxRect(ctx, gymX, gymY, 4, gymH, 'rgba(18, 22, 28, 0.14)');
  pxRect(ctx, gymX + gymW - 4, gymY, 4, gymH, 'rgba(18, 22, 28, 0.14)');

  // Olympic Lifting Platform Wood Inlay Pad right in front of Squat Rack (cols 20.4..22.55, rows 15.55..17.25)
  const lpX = Math.round(20.4 * TILE);
  const lpY = Math.round(15.55 * TILE);
  const lpW = Math.round(2.15 * TILE);
  const lpH = Math.round(1.65 * TILE);
  pxRect(ctx, lpX, lpY, lpW, lpH, '#252A30');
  pxRect(ctx, lpX + 2, lpY + 2, lpW - 4, lpH - 4, '#2E343D');
  pxRect(ctx, lpX + 14, lpY + 4, lpW - 28, lpH - 8, '#C8A373');
  pxRect(ctx, lpX + 16, lpY + 6, lpW - 32, lpH - 12, '#D7B588');
  pxRect(ctx, lpX + 14, lpY + Math.floor(lpH / 2), lpW - 28, 1, '#9E7B50');

  // Two Rolled-Out Walkable Yoga & Mobility Mats in the East Studio Zone (cols 28.15..30.65, rows 16.3..18.7)
  const drawYogaMat = (mx: number, my: number, outer: string, inner: string, stripe: string) => {
    pxRect(ctx, mx + 1, my + 2, 30, 68, 'rgba(24, 20, 16, 0.16)');
    pxRect(ctx, mx, my, 30, 68, outer);
    pxRect(ctx, mx + 2, my + 2, 26, 64, inner);
    pxRect(ctx, mx + 5, my + 10, 20, 2, stripe);
    pxRect(ctx, mx + 5, my + 56, 20, 2, stripe);
    pxRect(ctx, mx + 13, my + 32, 4, 4, stripe); // Center alignment mark
  };
  drawYogaMat(Math.round(28.25 * TILE), Math.round(16.45 * TILE), '#3F6E63', '#5A9486', '#8FC4B6'); // Sage-Teal Mat
  drawYogaMat(Math.round(29.55 * TILE), Math.round(16.45 * TILE), '#9E4F3D', '#C46D57', '#E6A08C'); // Warm Terracotta Mat
  // Compact cylindrical foam roller resting neatly above the yoga mats (walkable)
  pxRect(ctx, Math.round(28.65 * TILE), Math.round(16.0 * TILE), 26, 8, '#3B424E');
  pxRect(ctx, Math.round(28.65 * TILE) + 2, Math.round(16.0 * TILE) + 1, 22, 3, '#64748B');

  // Home Office <-> Home Gym Open Archway Threshold (cols 28..29, rows 12..13)
  const gymDoorX = GYM_DOOR_COL_START * TILE;
  const gymDoorW = (GYM_DOOR_COL_END - GYM_DOOR_COL_START + 1) * TILE;
  const gymNorthWallY = MID_WALL_ROW * TILE;
  // Upper tile (row 12) matches Home Office oak floorboards
  pxRect(ctx, gymDoorX, gymNorthWallY, gymDoorW, TILE, '#B5895A');
  pxRect(ctx, gymDoorX, gymNorthWallY + 15, gymDoorW, 1, '#8E663D');
  pxRect(ctx, gymDoorX, gymNorthWallY + 1, gymDoorW, 1, '#C29768');
  // Lower tile (row 13) transitions into Home Gym maple studio planks
  pxRect(ctx, gymDoorX, gymNorthWallY + TILE, gymDoorW, TILE, '#D4B48A');
  pxRect(ctx, gymDoorX, gymNorthWallY + TILE + 15, gymDoorW, 1, '#AE8B61');
  pxRect(ctx, gymDoorX, gymNorthWallY + TILE + 1, gymDoorW, 1, '#E2C69F');
  // Crisp warm oak doorway threshold sill bar across passage
  pxRect(ctx, gymDoorX, gymNorthWallY + 26, gymDoorW, 12, '#6E492C');
  pxRect(ctx, gymDoorX + 2, gymNorthWallY + 28, gymDoorW - 4, 8, '#936540');
  pxRect(ctx, gymDoorX + 4, gymNorthWallY + 29, gymDoorW - 8, 2, '#B5845B');

  // 1. Entryway / Foyer warm stone-and-terracotta checkerboard tiles (cols 10..18, rows 24..27)
  for (let row = FOYER_FLOOR_ROW_START; row <= FOYER_FLOOR_ROW_END; row++) {
    for (let col = WEST_DIVIDER_COL + 1; col < DIVIDER_COL; col++) {
      const x = col * TILE;
      const y = row * TILE;
      const isWarm = (col + row) % 2 === 0;
      const grout = '#9E8C7A';
      const base = isWarm ? '#DECDB9' : '#CEB8A0';
      const inner = isWarm ? '#E5D6C4' : '#D6C2AB';

      pxRect(ctx, x, y, TILE, TILE, grout);
      pxRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, base);
      pxRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, inner);
      pxRect(ctx, x + 14, y + 14, 4, 4, isWarm ? '#C58A67' : '#B77B58');
      pxRect(ctx, x + 2, y + 2, TILE - 5, 1, 'rgba(255, 250, 242, 0.35)');
    }
  }

  pxRect(ctx, 1.12 * TILE + CORE_OFFSET_X, 24.1 * TILE, 8.76 * TILE, 2, 'rgba(130, 82, 52, 0.22)');
  pxRect(ctx, 1.12 * TILE + CORE_OFFSET_X, 27.85 * TILE, 8.76 * TILE, 2, 'rgba(130, 82, 52, 0.22)');

  // 2. Kitchen <-> Entryway open doorway threshold (cols 12..13, rows 22..23)
  const fkX = FOYER_KITCHEN_DOOR_COL_START * TILE;
  const fkW = (FOYER_KITCHEN_DOOR_COL_END - FOYER_KITCHEN_DOOR_COL_START + 1) * TILE;
  const wall2Y = LOWER_MID_WALL_ROW * TILE;
  pxRect(ctx, fkX, wall2Y, fkW, TILE, '#D8CBB4');
  pxRect(ctx, fkX, wall2Y + 15, fkW, 2, '#B4A48B');
  pxRect(ctx, fkX + 31, wall2Y, 2, TILE, '#B4A48B');
  pxRect(ctx, fkX, wall2Y + TILE, fkW, TILE, '#DECDB9');
  pxRect(ctx, fkX + 31, wall2Y + TILE, 1, TILE, '#9E8C7A');
  pxRect(ctx, fkX, wall2Y + 26, fkW, 12, '#7D5432');
  pxRect(ctx, fkX + 2, wall2Y + 28, fkW - 4, 8, '#9A6B44');
  pxRect(ctx, fkX + 4, wall2Y + 29, fkW - 8, 2, '#B38258');

  // 2b. Entryway <-> 2-Car Garage Interior Side Doorway Threshold (col 19, rows 25..26)
  const gdX = LOWER_EAST_WALL_COL * TILE;
  const gdY = GARAGE_DOOR_ROW_START * TILE;
  const gdH = (GARAGE_DOOR_ROW_END - GARAGE_DOOR_ROW_START + 1) * TILE;
  pxRect(ctx, gdX, gdY, TILE, gdH, '#7B7E82');
  pxRect(ctx, gdX + 2, gdY + 2, 10, gdH - 4, '#B59B7E'); // Entryway step edge
  pxRect(ctx, gdX + 12, gdY + 2, 6, gdH - 4, '#5B5E63'); // Steel fire-door sill
  pxRect(ctx, gdX + 18, gdY + 2, TILE - 20, gdH - 4, '#9BA0A6'); // Garage concrete lip

  // 3. Foyer Woven Coir Welcome Mat just inside the Front Double Door (cols 13.35..15.65, rows 27.08..27.84)
  const wmX = Math.round(4.35 * TILE + CORE_OFFSET_X);
  const wmY = Math.round(27.08 * TILE);
  const wmW = Math.round(2.3 * TILE);
  const wmH = Math.round(0.76 * TILE);
  pxRect(ctx, wmX + 1, wmY + 2, wmW, wmH, 'rgba(32, 22, 14, 0.16)');
  pxRect(ctx, wmX, wmY, wmW, wmH, '#6F4E30');
  pxRect(ctx, wmX + 2, wmY + 2, wmW - 4, wmH - 4, '#B5895A');
  pxRect(ctx, wmX + 4, wmY + 4, wmW - 8, wmH - 8, '#C89E6F');
  pxRect(ctx, wmX + 6, wmY + 6, wmW - 12, 1, '#7D5836');
  pxRect(ctx, wmX + 6, wmY + wmH - 7, wmW - 12, 1, '#7D5836');
  pxRect(ctx, wmX + 12, wmY + 10, wmW - 24, 3, '#7D5836');
  pxRect(ctx, wmX + 18, wmY + 11, wmW - 36, 1, '#E6C79A');

  // 4. Front Double Doorway Threshold (cols 13..15, row 28)
  const fdX = FRONT_DOOR_COL_START * TILE;
  const fdY = FOYER_SOUTH_WALL_ROW * TILE;
  const fdW = (FRONT_DOOR_COL_END - FRONT_DOOR_COL_START + 1) * TILE;
  pxRect(ctx, fdX, fdY, fdW, TILE, '#8B623D');
  pxRect(ctx, fdX + 2, fdY + 4, fdW - 4, 22, '#B68A5E');
  pxRect(ctx, fdX + 4, fdY + 6, fdW - 8, 3, '#D2A87A');
  pxRect(ctx, fdX + 2, fdY + 14, fdW - 4, 4, '#C89F5B');
  pxRect(ctx, fdX + 4, fdY + 15, fdW - 8, 1, '#F2D898');

  // 5. Front Porch Cedar Decking (cols 10..18, rows 29..30)
  const porchY = PORCH_ROW_START * TILE;
  for (let row = PORCH_ROW_START; row <= PORCH_ROW_START + 1; row++) {
    for (let col = WEST_DIVIDER_COL + 1; col < DIVIDER_COL; col++) {
      const x = col * TILE;
      const y = row * TILE;
      const toneA = (col + row) % 2 === 0 ? '#A9784E' : '#A17147';
      pxRect(ctx, x, y, TILE, TILE, toneA);
      for (let py = 0; py < TILE; py += 8) {
        pxRect(ctx, x, y + py + 7, TILE, 1, '#6E4A2D');
        pxRect(ctx, x, y + py, TILE, 1, '#BE8C60');
      }
      const seamX = ((col * 11 + row * 7) % 20) + 6;
      pxRect(ctx, x + seamX, y + 3, 1, 2, '#5E3D23');
      pxRect(ctx, x + seamX, y + 19, 1, 2, '#5E3D23');
    }
  }
  pxRect(ctx, (WEST_DIVIDER_COL + 1) * TILE, porchY, 9 * TILE, 5, 'rgba(30, 18, 10, 0.22)');

  // Porch concrete/wood foundation apron under left & right railings (row 31)
  const stepRowY = (PORCH_ROW_START + 2) * TILE; // row 31
  pxRect(ctx, (WEST_DIVIDER_COL + 1) * TILE, stepRowY, 3 * TILE, 10, '#6B5849');
  pxRect(ctx, (WEST_DIVIDER_COL + 1) * TILE, stepRowY + 7, 3 * TILE, 3, '#4E3F34');
  pxRect(ctx, (FRONT_DOOR_COL_END + 1) * TILE, stepRowY, 3 * TILE, 10, '#6B5849');
  pxRect(ctx, (FRONT_DOOR_COL_END + 1) * TILE, stepRowY + 7, 3 * TILE, 3, '#4E3F34');

  // Grand Stone Front Porch Steps (cols 13..15, row 31)
  const stepX = FRONT_DOOR_COL_START * TILE;
  const stepW = (FRONT_DOOR_COL_END - FRONT_DOOR_COL_START + 1) * TILE;
  pxRect(ctx, stepX - 2, stepRowY, stepW + 4, 16, '#9A9288');
  pxRect(ctx, stepX, stepRowY + 1, stepW, 12, '#CCC4B8');
  pxRect(ctx, stepX + 2, stepRowY + 2, stepW - 4, 2, '#E6E0D6');
  pxRect(ctx, stepX + Math.floor(stepW / 3), stepRowY + 1, 1, 12, '#A69E93');
  pxRect(ctx, stepX + Math.floor((stepW * 2) / 3), stepRowY + 1, 1, 12, '#A69E93');
  pxRect(ctx, stepX - 4, stepRowY + 15, stepW + 8, 17, '#7E776E');
  pxRect(ctx, stepX - 2, stepRowY + 16, stepW + 4, 14, '#BDB5A8');
  pxRect(ctx, stepX, stepRowY + 17, stepW, 2, '#DCD5C9');
  pxRect(ctx, stepX + Math.floor(stepW / 2), stepRowY + 16, 1, 14, '#9A9288');

  // Outdoor welcome mat right outside the front doorway on cedar porch
  const pmX = Math.round(4.45 * TILE + CORE_OFFSET_X);
  const pmY = porchY + 6;
  const pmW = Math.round(2.1 * TILE);
  pxRect(ctx, pmX, pmY, pmW, 18, '#5C3C22');
  pxRect(ctx, pmX + 2, pmY + 2, pmW - 4, 14, '#A9784A');
  pxRect(ctx, pmX + 5, pmY + 5, pmW - 10, 8, '#C79665');

  // =========================================================================
  // 5b. EXTENDED LONG FLAGSTONE FRONT GARDEN WALKWAY (cols 13..15, rows 32..38)
  //     + HORIZONTAL GARDEN CONNECTOR PATH TO 2-CAR DRIVEWAY (cols 16..20, rows 32.9..34.4)
  // =========================================================================
  const walkY = WALKWAY_ROW_START * TILE;
  const walkH = (WALKWAY_ROW_END - WALKWAY_ROW_START + 1) * TILE;

  // Stone edging kerbs & warm sandy gravel bed
  pxRect(ctx, stepX - 6, walkY, stepW + 12, walkH, '#918779');
  pxRect(ctx, stepX - 2, walkY, stepW + 4, walkH, '#B9AEA0');
  // Alternating handcrafted flagstone pavers down the full 7-tile garden walkway
  for (let row = WALKWAY_ROW_START; row <= WALKWAY_ROW_END; row++) {
    const py = row * TILE;
    const stagger = row % 2 === 0 ? 0 : 12;
    // Left, center, and right stone slabs per row
    pxRect(ctx, stepX + 1, py + 2, 29 + stagger, 13, '#D5CBBF');
    pxRect(ctx, stepX + 2, py + 3, 27 + stagger, 2, '#E8E0D4');
    pxRect(ctx, stepX + 32 + stagger, py + 2, stepW - 33 - stagger, 13, '#CEC3B5');
    pxRect(ctx, stepX + 33 + stagger, py + 3, stepW - 35 - stagger, 2, '#E2D9CC');

    const stagger2 = row % 2 === 0 ? 14 : 0;
    pxRect(ctx, stepX + 1, py + 17, 40 - stagger2, 13, '#CFC5B8');
    pxRect(ctx, stepX + 2, py + 18, 38 - stagger2, 2, '#E4DCD0');
    pxRect(ctx, stepX + 43 - stagger2, py + 17, stepW - 44 + stagger2, 13, '#D7CEC2');
    pxRect(ctx, stepX + 44 - stagger2, py + 18, stepW - 46 + stagger2, 2, '#EAE2D7');
  }
  // Decorative low stone border curbing along both sides of walkway
  pxRect(ctx, stepX - 6, walkY, 5, walkH, '#AAA092');
  pxRect(ctx, stepX - 5, walkY, 2, walkH, '#CCC3B6');
  pxRect(ctx, stepX + stepW + 1, walkY, 5, walkH, '#AAA092');
  pxRect(ctx, stepX + stepW + 2, walkY, 2, walkH, '#CCC3B6');

  // Horizontal Garden Connector Flagstone Path linking Long Walkway (col 16) <-> 2-Car Driveway (col 21)
  const connX = (FRONT_DOOR_COL_END + 1) * TILE - 2;
  const connY = Math.round(32.95 * TILE);
  const connW = (DRIVEWAY_COL_START - FRONT_DOOR_COL_END - 1) * TILE + 6;
  const connH = Math.round(1.42 * TILE);
  pxRect(ctx, connX, connY - 3, connW, connH + 6, '#918779');
  pxRect(ctx, connX, connY, connW, connH, '#B9AEA0');
  for (let cx = connX + 3; cx < connX + connW - 14; cx += 24) {
    pxRect(ctx, cx, connY + 3, 21, 18, '#D5CBBF');
    pxRect(ctx, cx + 1, connY + 4, 19, 2, '#E8E0D4');
    pxRect(ctx, cx + 4, connY + 23, 20, 18, '#CFC5B8');
    pxRect(ctx, cx + 5, connY + 24, 18, 2, '#E4DCD0');
  }

  // =========================================================================
  // 6. ATTACHED 2-CAR FAMILY GARAGE FLOOR (cols 20..31, rows 22..30)
  //    + LONG 2-CAR CONCRETE DRIVEWAY (cols 21..30, rows 31..38)
  // =========================================================================
  const garX = GARAGE_FLOOR_COL_START * TILE;
  const garY = GARAGE_FLOOR_ROW_START * TILE;
  const garW = (GARAGE_FLOOR_COL_END - GARAGE_FLOOR_COL_START + 1) * TILE; // 12 tiles
  const garH = (GARAGE_BAY_OPENING_ROW - GARAGE_FLOOR_ROW_START + 1) * TILE; // 9 tiles (incl. threshold row 30)

  // Sealed smooth concrete garage floor slab
  pxRect(ctx, garX, garY, garW, garH, '#A5AAB0');
  for (let row = GARAGE_FLOOR_ROW_START; row <= GARAGE_BAY_OPENING_ROW; row++) {
    for (let col = GARAGE_FLOOR_COL_START; col <= GARAGE_FLOOR_COL_END; col++) {
      const tx = col * TILE;
      const ty = row * TILE;
      const slabTone = (col + row) % 2 === 0 ? '#AEB3B9' : '#A7ACB2';
      pxRect(ctx, tx + 1, ty + 1, TILE - 1, TILE - 1, slabTone);
    }
  }
  // Major concrete expansion joint lines across garage bay
  pxRect(ctx, garX, garY + 4 * TILE, garW, 2, '#868C94');
  pxRect(ctx, garX + 6 * TILE, garY, 2, garH, '#868C94');
  // Subtle interior wall contact shadow along north & sides
  pxRect(ctx, garX, garY, garW, 6, 'rgba(32, 36, 42, 0.16)');
  pxRect(ctx, garX, garY, 5, garH, 'rgba(32, 36, 42, 0.12)');
  pxRect(ctx, garX + garW - 5, garY, 5, garH, 'rgba(32, 36, 42, 0.12)');

  // Painted Golden-Amber Parking Stall Guide Lines for 2 Full Car Bays (Bay 1 & Bay 2)
  const drawParkingBayMarkings = (bayStartCol: number, bayEndCol: number) => {
    const bx = Math.round(bayStartCol * TILE);
    const bw = Math.round((bayEndCol - bayStartCol) * TILE);
    const byTop = Math.round(23.65 * TILE);
    const byBot = Math.round(29.05 * TILE);
    // Subtle dark rubber anti-slip garage mat in center of bay
    pxRect(ctx, bx + 10, byTop + 18, bw - 20, byBot - byTop - 32, 'rgba(42, 48, 56, 0.16)');
    // Crisp painted parking stall perimeter lines
    pxRect(ctx, bx, byTop, 3, byBot - byTop, '#EAB308');
    pxRect(ctx, bx + bw - 3, byTop, 3, byBot - byTop, '#EAB308');
    pxRect(ctx, bx, byTop, bw, 3, '#EAB308');
    // Concrete wheel-stop bumper bar at front of bay
    pxRect(ctx, bx + 12, byTop + 6, bw - 24, 6, '#646B73');
    pxRect(ctx, bx + 13, byTop + 7, bw - 26, 2, '#CBD2D9');
    // Subtle yellow safety stripes on wheel stop
    for (let sx = bx + 18; sx < bx + bw - 20; sx += 14) {
      pxRect(ctx, sx, byTop + 7, 6, 4, '#EAB308');
    }
  };
  drawParkingBayMarkings(21.95, 25.25); // Bay 1 (Left Car Bay)
  drawParkingBayMarkings(26.85, 30.15); // Bay 2 (Right Car Bay)

  // Garage Bay Drainage Grate Strip along threshold (row 30.45)
  const drvX = DRIVEWAY_COL_START * TILE;
  const drvW = (DRIVEWAY_COL_END - DRIVEWAY_COL_START + 1) * TILE; // 10 tiles wide
  pxRect(ctx, drvX + 4, Math.round(30.42 * TILE), drvW - 8, 7, '#4B525C');
  for (let gx = drvX + 8; gx < drvX + drvW - 10; gx += 8) {
    pxRect(ctx, gx, Math.round(30.42 * TILE) + 1, 3, 5, '#2A2F36');
  }

  // Long 2-Car Brushed Concrete Driveway (cols 21..30, rows 31..38)
  const drvY = (GARAGE_BAY_OPENING_ROW + 1) * TILE; // row 31
  const drvH = (SIDEWALK_ROW_START - GARAGE_BAY_OPENING_ROW - 1) * TILE; // 8 full tiles!
  pxRect(ctx, drvX - 5, drvY, drvW + 10, drvH, '#8F8A82'); // Concrete side curb edges
  pxRect(ctx, drvX, drvY, drvW, drvH, '#C5C0B8');
  for (let row = GARAGE_BAY_OPENING_ROW + 1; row < SIDEWALK_ROW_START; row++) {
    const ry = row * TILE;
    for (let col = DRIVEWAY_COL_START; col <= DRIVEWAY_COL_END; col++) {
      const cx = col * TILE;
      const slab = (Math.floor((col - DRIVEWAY_COL_START) / 2) + Math.floor(row / 2)) % 2 === 0
        ? '#CCC7BF'
        : '#C3BEB6';
      pxRect(ctx, cx, ry, TILE, TILE, slab);
    }
    // Horizontal brushed concrete expansion joints every 2 rows
    if (row % 2 === 0) {
      pxRect(ctx, drvX, ry, drvW, 1, '#9E988E');
      pxRect(ctx, drvX, ry + 1, drvW, 1, '#DDD9D1');
    }
  }
  // Vertical expansion joints dividing the 2-car driveway into twin lanes
  pxRect(ctx, drvX + Math.floor(drvW / 2), drvY, 2, drvH, '#9E988E');
  // Subtle left & right raised curb highlights
  pxRect(ctx, drvX - 5, drvY, 5, drvH, '#B4AEA4');
  pxRect(ctx, drvX - 4, drvY, 2, drvH, '#DCD7CE');
  pxRect(ctx, drvX + drvW, drvY, 5, drvH, '#B4AEA4');
  pxRect(ctx, drvX + drvW + 1, drvY, 2, drvH, '#DCD7CE');
  // Subtle faint tire track wear marks leading out of Bay 1 & Bay 2 down the driveway
  for (const trackCol of [22.8, 24.3, 27.6, 29.3]) {
    pxRect(ctx, Math.round(trackCol * TILE), drvY + 6, 8, drvH - 10, 'rgba(85, 82, 78, 0.08)');
  }

  // =========================================================================
  // 7. PUSHED-BACK FRONT SIDEWALK (rows 39..40) & 2-LANE ASPHALT ROAD (rows 41..44)
  // =========================================================================
  const swY = SIDEWALK_ROW_START * TILE;
  const swH = (SIDEWALK_ROW_END - SIDEWALK_ROW_START + 1) * TILE;

  // Concrete neighborhood sidewalk running full width (cols 0..32, rows 39..40)
  pxRect(ctx, 0, swY, WORLD_W, swH, '#C4BCB0');
  for (let col = 0; col < MAP_COLS; col++) {
    const sx = col * TILE;
    const tone = col % 2 === 0 ? '#CCC5B9' : '#C6BEB2';
    pxRect(ctx, sx + 1, swY + 2, TILE - 2, swH - 10, tone);
    pxRect(ctx, sx + 2, swY + 3, TILE - 4, 2, '#DED8CD');
    pxRect(ctx, sx + 1, swY + TILE - 1, TILE - 2, 1, '#9E968A');
    pxRect(ctx, sx, swY, 1, swH - 6, '#9E968A');
  }

  // Flagstone house entrance apron on sidewalk connecting Long Walkway (cols 13..15) to Crosswalk
  pxRect(ctx, stepX - 4, swY + 1, stepW + 8, swH - 7, '#B5A897');
  for (let fy = swY + 3; fy < swY + swH - 10; fy += 18) {
    for (let fx = stepX - 2; fx < stepX + stepW + 2; fx += 24) {
      pxRect(ctx, fx + 1, fy + 1, 21, 15, '#D4C8B8');
      pxRect(ctx, fx + 2, fy + 2, 19, 2, '#E6DDD0');
    }
  }

  // Reinforced concrete 2-car driveway apron across the sidewalk (cols 21..30)
  pxRect(ctx, drvX - 2, swY + 1, drvW + 4, swH - 6, '#C8C3BB');
  pxRect(ctx, drvX, swY + 2, drvW, 2, '#DFDBD4');
  pxRect(ctx, drvX + Math.floor(drvW / 2), swY + 1, 2, swH - 7, '#9E988E');

  // Raised Concrete Roadside Curb & Gutter separating sidewalk and asphalt street
  const curbY = (SIDEWALK_ROW_END + 1) * TILE - 7;
  pxRect(ctx, 0, curbY, WORLD_W, 5, '#DFD9CE');
  pxRect(ctx, 0, curbY + 5, WORLD_W, 3, '#8D867B');
  for (let cx = 0; cx < WORLD_W; cx += 48) {
    pxRect(ctx, cx, curbY, 1, 7, '#7A746A');
  }
  // Smooth dipped curb ramp at Front Crosswalk (cols 13..15)
  pxRect(ctx, stepX - 2, curbY + 1, stepW + 4, 6, '#C4BCB0');
  // Wide flared dipped curb apron for 2-Car Driveway exit onto street (cols 21..30)
  pxRect(ctx, drvX - 4, curbY + 1, drvW + 8, 7, '#B8B3AB');
  pxRect(ctx, drvX - 2, curbY + 2, drvW + 4, 2, '#D3CFC7');

  // 2-Lane Neighborhood Asphalt Street (cols 0..32, rows 41..44)
  const roadY = ROAD_ROW_START * TILE;
  const roadH = (ROAD_ROW_END - ROAD_ROW_START + 1) * TILE;
  pxRect(ctx, 0, roadY, WORLD_W, roadH, '#363C44');
  pxRect(ctx, 0, roadY, WORLD_W, 4, 'rgba(15, 18, 24, 0.35)');
  for (let ry = roadY + 6; ry < WORLD_H - 6; ry += 12) {
    for (let rx = 8; rx < WORLD_W - 8; rx += 22) {
      const hash = (rx * 7 + ry * 13) % 5;
      if (hash === 0) {
        pxRect(ctx, rx, ry, 4, 2, '#3E454E');
      } else if (hash === 2) {
        pxRect(ctx, rx + 5, ry + 3, 3, 2, '#2E343B');
      }
    }
  }

  // Crisp White Outer Shoulder Edge Lines
  pxRect(ctx, 0, roadY + 7, WORLD_W, 2, 'rgba(235, 240, 244, 0.72)');
  pxRect(ctx, 0, WORLD_H - 12, WORLD_W, 2, 'rgba(235, 240, 244, 0.72)');

  // Golden-Yellow Dashed Center Lane Divider (separating westbound & eastbound lanes)
  const centerLineY = roadY + Math.floor(roadH / 2) - 2;
  for (let lx = 14; lx < WORLD_W - 14; lx += 44) {
    if (lx + 26 > stepX - 10 && lx < stepX + stepW + 10) continue;
    pxRect(ctx, lx, centerLineY, 26, 4, '#EAB308');
    pxRect(ctx, lx + 2, centerLineY + 1, 22, 1, '#FDE047');
  }

  // Crisp White Pedestrian Crosswalk aligned with Long Front Walkway (cols 13..15)
  const cwX = stepX + 2;
  const cwW = stepW - 4;
  for (let sy = roadY + 14; sy < WORLD_H - 18; sy += 18) {
    pxRect(ctx, cwX, sy, cwW, 10, 'rgba(241, 245, 249, 0.85)');
    pxRect(ctx, cwX + 2, sy + 1, cwW - 4, 2, 'rgba(255, 255, 255, 0.92)');
  }

  // Subtle south asphalt shoulder verge at very bottom edge
  pxRect(ctx, 0, WORLD_H - 6, WORLD_W, 6, '#2A3038');
}

export function drawSouthRoomsWalls(
  ctx: CanvasRenderingContext2D,
  timeOfDay: TimeOfDay,
  tick: number
) {
  const wall2Y = LOWER_MID_WALL_ROW * TILE;
  const wallFaceY = wall2Y + 18;
  const wallFaceH = 2 * TILE - 18;

  // 1. Horizontal dividing wall #2 top timber structural beam (cols 10..19, rows 22..23)
  drawWallSegmentTopBeam(
    ctx,
    WEST_DIVIDER_COL * TILE + TILE - 5,
    wall2Y,
    (FOYER_KITCHEN_DOOR_COL_START - WEST_DIVIDER_COL - 1) * TILE + 5,
    18
  );
  drawWallSegmentTopBeam(
    ctx,
    (FOYER_KITCHEN_DOOR_COL_END + 1) * TILE,
    wall2Y,
    (DIVIDER_COL - FOYER_KITCHEN_DOOR_COL_END - 1) * TILE + 5,
    18
  );

  // Door jamb trim posts flanking Kitchen <-> Entryway archway (cols 12..13)
  pxRect(ctx, FOYER_KITCHEN_DOOR_COL_START * TILE - 4, wall2Y, 4, 2 * TILE, '#5B3E2B');
  pxRect(ctx, (FOYER_KITCHEN_DOOR_COL_END + 1) * TILE, wall2Y, 4, 2 * TILE, '#5B3E2B');

  // 2. Entryway / Foyer North Interior Wall segments (cols 10..11 left, cols 14..18 right)
  const leftSegX = (WEST_DIVIDER_COL + 1) * TILE;
  const leftSegW = (FOYER_KITCHEN_DOOR_COL_START - WEST_DIVIDER_COL - 1) * TILE;
  const rightSegX = (FOYER_KITCHEN_DOOR_COL_END + 1) * TILE;
  const rightSegW = (DIVIDER_COL - FOYER_KITCHEN_DOOR_COL_END - 1) * TILE;

  for (const seg of [
    { x: leftSegX, w: leftSegW },
    { x: rightSegX, w: rightSegW },
  ]) {
    pxRect(ctx, seg.x, wallFaceY, seg.w, 25, '#EBE3D5');
    pxRect(ctx, seg.x, wallFaceY + 25, seg.w, wallFaceH - 25, '#D7CBB8');
    for (let wx = seg.x + 6; wx < seg.x + seg.w; wx += 8) {
      pxRect(ctx, wx, wallFaceY + 26, 1, wallFaceH - 28, 'rgba(110, 82, 56, 0.22)');
    }
    pxRect(ctx, seg.x, wallFaceY + 24, seg.w, 2, '#8F6849');
    pxRect(ctx, seg.x, wall2Y + 2 * TILE - 2, seg.w, 2, '#5E3E28');
  }

  // (a) Trio of Warm Framed Family Photos on Left Foyer North Wall
  const frames = [
    { x: Math.round(1.15 * TILE + CORE_OFFSET_X), y: wallFaceY + 6, w: 15, h: 15, bg: '#C6DCE4', acc: '#D97736' },
    { x: Math.round(1.7 * TILE + CORE_OFFSET_X), y: wallFaceY + 4, w: 17, h: 18, bg: '#E6D8C5', acc: '#5E8A78' },
    { x: Math.round(2.3 * TILE + CORE_OFFSET_X), y: wallFaceY + 7, w: 15, h: 14, bg: '#D4E2D4', acc: '#C86D51' },
  ];
  for (const f of frames) {
    pxRect(ctx, f.x, f.y, f.w, f.h, '#593A25');
    pxRect(ctx, f.x + 2, f.y + 2, f.w - 4, f.h - 4, '#FAF6F0');
    pxRect(ctx, f.x + 3, f.y + 3, f.w - 6, f.h - 6, f.bg);
    pxRect(ctx, f.x + 5, f.y + f.h - 7, f.w - 10, 4, f.acc);
  }

  // (b) Ornate Brass Oval Entryway Mirror above the NE Console Table
  const emX = Math.round(6.1 * TILE + CORE_OFFSET_X);
  const emY = wallFaceY + 3;
  pxRect(ctx, emX + 4, emY, 26, 28, '#9A743B');
  pxRect(ctx, emX + 2, emY + 3, 30, 22, '#9A743B');
  pxRect(ctx, emX + 5, emY + 2, 24, 24, '#D9B66D');
  pxRect(ctx, emX + 4, emY + 4, 26, 20, '#CBE2E8');
  pxRect(ctx, emX + 6, emY + 4, 22, 20, '#DFF0F5');
  pxRect(ctx, emX + 9, emY + 6, 4, 15, 'rgba(255,255,255,0.68)');
  pxRect(ctx, emX + 15, emY + 8, 2, 11, 'rgba(255,255,255,0.45)');

  // (c) Wooden Peg Rail Coat Hooks with Hanging Hat, Scarf, Tote & Keys
  const pegX = Math.round(8.0 * TILE + CORE_OFFSET_X);
  const pegY = wallFaceY + 12;
  pxRect(ctx, pegX, pegY, 54, 5, '#6F492D');
  pxRect(ctx, pegX + 1, pegY + 1, 52, 1, '#9A6C48');
  for (let p = 0; p < 4; p++) {
    pxRect(ctx, pegX + 6 + p * 13, pegY + 2, 3, 3, '#E8C57B');
  }
  pxRect(ctx, pegX + 2, pegY + 4, 11, 5, '#DFC085');
  pxRect(ctx, pegX + 4, pegY + 2, 7, 4, '#C9A361');
  pxRect(ctx, pegX + 4, pegY + 5, 7, 1, '#B4533C');
  pxRect(ctx, pegX + 18, pegY + 5, 5, 16, '#C86D51');
  pxRect(ctx, pegX + 19, pegY + 9, 3, 2, '#E9C46A');
  pxRect(ctx, pegX + 19, pegY + 15, 3, 2, '#E9C46A');
  pxRect(ctx, pegX + 30, pegY + 5, 9, 5, '#8F6A48');
  pxRect(ctx, pegX + 29, pegY + 10, 11, 12, '#EDE5D7');
  pxRect(ctx, pegX + 31, pegY + 13, 7, 4, '#5E8A78');
  pxRect(ctx, pegX + 45, pegY + 5, 3, 7, '#E8C57B');
  pxRect(ctx, pegX + 44, pegY + 10, 5, 3, '#C99A49');

  // 3. Entryway West Exterior Wall (col 9, rows 22..28) & Shared Kitchen/Entryway <-> Garage Wall (col 19, rows 12..30)
  const foyerWestX = WEST_DIVIDER_COL * TILE;
  const foyerEastX = LOWER_EAST_WALL_COL * TILE;
  const fsY = FOYER_SOUTH_WALL_ROW * TILE;

  pxRect(ctx, foyerWestX, wall2Y, TILE, fsY + TILE - wall2Y, '#3B281E');
  pxRect(ctx, foyerWestX + TILE - 5, wall2Y + 16, 5, fsY - (wall2Y + 16), '#5B3E2B');

  // Shared wall col 19 splits around Entryway <-> 2-Car Garage interior doorway (rows 25..26)
  const garDoorTopY = GARAGE_DOOR_ROW_START * TILE;
  const garDoorBotY = (GARAGE_DOOR_ROW_END + 1) * TILE;
  const garBayY = GARAGE_BAY_OPENING_ROW * TILE;

  // Upper segment of col 19 (rows 12..24)
  pxRect(ctx, foyerEastX, MID_WALL_ROW * TILE, TILE, garDoorTopY - MID_WALL_ROW * TILE, '#3B281E');
  pxRect(ctx, foyerEastX, MID_WALL_ROW * TILE + 16, 5, garDoorTopY - (MID_WALL_ROW * TILE + 16), '#5B3E2B');
  // Lower segment of col 19 (rows 27..30)
  pxRect(ctx, foyerEastX, garDoorBotY, TILE, garBayY + TILE - garDoorBotY, '#3B281E');
  pxRect(ctx, foyerEastX, garDoorBotY, 5, fsY - garDoorBotY, '#5B3E2B');
  // Clean steel/wood interior fire-door jambs at rows 25..26
  pxRect(ctx, foyerEastX + 2, garDoorTopY - 4, TILE - 4, 4, '#5B3E2B');
  pxRect(ctx, foyerEastX + 2, garDoorBotY, TILE - 4, 4, '#5B3E2B');

  // 3a. HOME GYM NORTH & EAST ARCHITECTURAL WALLS (cols 19..32, rows 12..19)
  //     Divides Home Office (above) from Home Gym (below), with open archway at cols 28..29
  const gymWallY = MID_WALL_ROW * TILE;
  const gymFaceY = gymWallY + 18;
  const gymFaceH = 2 * TILE - 18; // 46px tall 3/4 north interior wall face
  const gymEastX = OFFICE_EAST_WALL_COL * TILE;

  // North structural top beams split around Home Office <-> Home Gym archway (cols 28..29)
  drawWallSegmentTopBeam(
    ctx,
    foyerEastX + TILE - 5,
    gymWallY,
    (GYM_DOOR_COL_START - LOWER_EAST_WALL_COL - 1) * TILE + 5,
    18
  );
  drawWallSegmentTopBeam(
    ctx,
    (GYM_DOOR_COL_END + 1) * TILE,
    gymWallY,
    (OFFICE_EAST_WALL_COL - GYM_DOOR_COL_END - 1) * TILE + 5,
    18
  );
  // Door jamb trim posts flanking Home Office <-> Home Gym archway
  pxRect(ctx, GYM_DOOR_COL_START * TILE - 4, gymWallY, 4, 2 * TILE, '#5B3E2B');
  pxRect(ctx, (GYM_DOOR_COL_END + 1) * TILE, gymWallY, 4, 2 * TILE, '#5B3E2B');

  // Home Gym East outer structural wall (col 32, rows 12..19 — links Office & Garage seamlessly)
  pxRect(ctx, gymEastX, gymWallY, TILE, GARAGE_NORTH_WALL_ROW * TILE - gymWallY, '#3B281E');
  pxRect(ctx, gymEastX, gymWallY + 18, 5, GARAGE_NORTH_WALL_ROW * TILE - (gymWallY + 18), '#5B3E2B');
  // Subtle inner wood trim along shared West Kitchen/Gym wall (col 19 east edge, rows 13..19)
  pxRect(
    ctx,
    foyerEastX + TILE - 5,
    gymWallY + 18,
    5,
    GARAGE_NORTH_WALL_ROW * TILE - (gymWallY + 18),
    '#5B3E2B'
  );

  // Home Gym 3/4 North Interior Wall segments (cols 20..27 left of doorway, cols 30..31 right of doorway)
  const gymLeftX = GYM_FLOOR_COL_START * TILE;
  const gymLeftW = (GYM_DOOR_COL_START - GYM_FLOOR_COL_START) * TILE; // 8 tiles
  const gymRightX = (GYM_DOOR_COL_END + 1) * TILE;
  const gymRightW = (GYM_FLOOR_COL_END - GYM_DOOR_COL_END) * TILE; // 2 tiles
  for (const seg of [
    { x: gymLeftX, w: gymLeftW },
    { x: gymRightX, w: gymRightW },
  ]) {
    pxRect(ctx, seg.x, gymFaceY, seg.w, gymFaceH, '#E4E0D8'); // Warm stone studio plaster
    // Acoustic vertical wooden slat accent stripe along top
    pxRect(ctx, seg.x, gymFaceY, seg.w, 4, '#CFC8BC');
    // Sleek dark-slate impact baseboard / rubber wainscoting along lower wall
    pxRect(ctx, seg.x, gymFaceY + gymFaceH - 12, seg.w, 12, '#434A54');
    pxRect(ctx, seg.x, gymFaceY + gymFaceH - 13, seg.w, 2, '#8F6849'); // Natural oak trim rail
    pxRect(ctx, seg.x, gymFaceY + gymFaceH - 2, seg.w, 2, '#2B3038');
  }

  // (i) Twin Wide Oak-Framed Full-Length Gym Wall Mirrors (cols 20.5..25.4)
  for (const mirCol of [20.55, 23.15]) {
    const mx = Math.round(mirCol * TILE);
    const my = gymFaceY + 4;
    const mw = Math.round(2.3 * TILE);
    const mh = 34;
    pxRect(ctx, mx, my, mw, mh, '#593A25'); // Oak outer frame
    pxRect(ctx, mx + 2, my + 2, mw - 4, mh - 4, '#B9CFD6');
    pxRect(ctx, mx + 3, my + 3, mw - 6, mh - 6, '#CFE2E8');
    // Crisp diagonal studio mirror reflections
    pxRect(ctx, mx + 9, my + 4, 8, mh - 8, 'rgba(255, 255, 255, 0.42)');
    pxRect(ctx, mx + 21, my + 4, 3, mh - 8, 'rgba(255, 255, 255, 0.28)');
    pxRect(ctx, mx + mw - 18, my + 4, 5, mh - 8, 'rgba(255, 255, 255, 0.22)');
  }

  // (ii) Wall-Mounted Digital Gym Interval Timer LED Clock (cols 25.85..27.45)
  const tmX = Math.round(25.85 * TILE);
  const tmY = gymFaceY + 6;
  pxRect(ctx, tmX, tmY, 50, 17, '#1D222A');
  pxRect(ctx, tmX + 2, tmY + 2, 46, 13, '#10141A');
  // Clean amber & mint LED pixel digits (blinking colon)
  const colonOn = Math.floor(tick / 20) % 2 === 0;
  pxRect(ctx, tmX + 6, tmY + 5, 6, 7, '#F59E0B');
  pxRect(ctx, tmX + 8, tmY + 7, 2, 3, '#10141A');
  pxRect(ctx, tmX + 14, tmY + 5, 6, 7, '#F59E0B');
  pxRect(ctx, tmX + 16, tmY + 7, 2, 3, '#10141A');
  if (colonOn) {
    pxRect(ctx, tmX + 23, tmY + 6, 2, 2, '#94A3B8');
    pxRect(ctx, tmX + 23, tmY + 10, 2, 2, '#94A3B8');
  }
  pxRect(ctx, tmX + 28, tmY + 5, 6, 7, '#34D399');
  pxRect(ctx, tmX + 30, tmY + 6, 2, 3, '#10141A');
  pxRect(ctx, tmX + 36, tmY + 5, 6, 7, '#34D399');
  pxRect(ctx, tmX + 38, tmY + 7, 4, 1, '#10141A');
  // Resistance bands hanging neatly below timer
  pxRect(ctx, tmX + 8, tmY + 21, 34, 3, '#5C3B24');
  pxRect(ctx, tmX + 13, tmY + 23, 3, 12, '#34D399');
  pxRect(ctx, tmX + 22, tmY + 23, 3, 13, '#F59E0B');
  pxRect(ctx, tmX + 31, tmY + 23, 3, 11, '#EF4444');

  // (iii) Right North Wall Segment (cols 30..31): Framed Minimal Studio Art & Towel Hooks
  const postX = Math.round(30.18 * TILE);
  const postY = gymFaceY + 5;
  pxRect(ctx, postX, postY, 22, 24, '#3B281E');
  pxRect(ctx, postX + 2, postY + 2, 18, 20, '#FAF6F0');
  pxRect(ctx, postX + 5, postY + 5, 12, 8, '#5E8A78'); // Minimal sage mountain/wave graphic
  pxRect(ctx, postX + 5, postY + 15, 12, 2, '#C86D51');
  pxRect(ctx, postX + 7, postY + 18, 8, 1, '#94A3B8');
  // Wall towel hooks + hanging gym towels + compact Bluetooth speaker
  const hkX = Math.round(31.05 * TILE);
  pxRect(ctx, hkX, gymFaceY + 7, 14, 9, '#2B303A'); // Compact studio speaker
  pxRect(ctx, hkX + 3, gymFaceY + 9, 8, 5, '#475569');
  pxRect(ctx, hkX - 2, gymFaceY + 20, 22, 3, '#5C3B24');
  pxRect(ctx, hkX + 1, gymFaceY + 22, 6, 13, '#5E8A78'); // Sage workout towel
  pxRect(ctx, hkX + 10, gymFaceY + 22, 6, 12, '#EFE6D8'); // Cream workout towel

  // (iv) Overhead Recessed Studio Track Lights along Gym North Wall Top
  const gymLightCol = timeOfDay === 'evening' ? '#FFFBEB' : '#F8FAFC';
  for (const tlCol of [21.6, 25.0, 30.25]) {
    const tlx = Math.round(tlCol * TILE);
    pxRect(ctx, tlx, gymWallY + 17, 36, 4, '#2B303A');
    pxRect(ctx, tlx + 4, gymWallY + 18, 6, 2, gymLightCol);
    pxRect(ctx, tlx + 15, gymWallY + 18, 6, 2, gymLightCol);
    pxRect(ctx, tlx + 26, gymWallY + 18, 6, 2, gymLightCol);
  }

  // 3b. ATTACHED 2-CAR GARAGE NORTH & EAST ARCHITECTURAL WALLS (cols 19..32, rows 20..30)
  const garNorthY = GARAGE_NORTH_WALL_ROW * TILE;
  const garFaceY = garNorthY + 18;
  const garFaceH = 2 * TILE - 18;
  const garInX = GARAGE_FLOOR_COL_START * TILE;
  const garInW = (GARAGE_FLOOR_COL_END - GARAGE_FLOOR_COL_START + 1) * TILE;
  const garEastX = OFFICE_EAST_WALL_COL * TILE;

  // North structural roof beam & garage east outer timber wall
  drawWallSegmentTopBeam(ctx, foyerEastX, garNorthY, (MAP_COLS - LOWER_EAST_WALL_COL) * TILE, 18);
  pxRect(ctx, garEastX, garNorthY, TILE, garBayY + TILE - garNorthY, '#3B281E');
  pxRect(ctx, garEastX, garNorthY + 18, 5, garBayY - (garNorthY + 18), '#5B3E2B');

  // Painted warm-grey/off-white garage interior north wall (cols 20..31, rows 20.5..21.99)
  pxRect(ctx, garInX, garFaceY, garInW, garFaceH, '#D5D8DC');
  pxRect(ctx, garInX, garFaceY + garFaceH - 12, garInW, 12, '#8F969E'); // Concrete wainscoting base
  pxRect(ctx, garInX, garFaceY + garFaceH - 13, garInW, 2, '#6E757D');
  pxRect(ctx, garInX, garFaceY + garFaceH - 2, garInW, 2, '#4E545C');

  // Garage North Wall Details:
  // (i) Coiled Green Garden Hose Reel on left garage wall (col 20.5..21.6)
  const hX = Math.round(20.6 * TILE);
  const hY = garFaceY + 12;
  pxRect(ctx, hX, hY, 22, 18, '#2C3E50');
  pxRect(ctx, hX + 3, hY + 3, 16, 12, '#22C55E');
  pxRect(ctx, hX + 6, hY + 6, 10, 6, '#15803D');
  pxRect(ctx, hX + 9, hY + 8, 4, 2, '#CBD5E1');
  // (ii) Perforated Workshop Tool Pegboard above workbench (cols 22.4..25.3)
  const pbX = Math.round(22.45 * TILE);
  const pbY = garFaceY + 6;
  const pbW = Math.round(2.8 * TILE);
  pxRect(ctx, pbX, pbY, pbW, 24, '#593A25');
  pxRect(ctx, pbX + 2, pbY + 2, pbW - 4, 20, '#B5895A');
  // Hanging pixel tools (wrench, hammer, screwdriver, saw, pliers)
  pxRect(ctx, pbX + 8, pbY + 5, 3, 13, '#94A3B8'); // Wrench
  pxRect(ctx, pbX + 6, pbY + 5, 7, 3, '#64748B');
  pxRect(ctx, pbX + 20, pbY + 5, 3, 13, '#7C4A2D'); // Hammer handle
  pxRect(ctx, pbX + 17, pbY + 4, 9, 4, '#475569'); // Hammer head
  pxRect(ctx, pbX + 34, pbY + 6, 2, 12, '#CBD5E1'); // Screwdriver
  pxRect(ctx, pbX + 33, pbY + 5, 4, 5, '#DC2626');
  pxRect(ctx, pbX + 46, pbY + 6, 14, 9, '#94A3B8'); // Hand saw blade
  pxRect(ctx, pbX + 44, pbY + 6, 5, 7, '#D97706'); // Saw handle
  pxRect(ctx, pbX + 68, pbY + 6, 6, 11, '#3B82F6'); // Cordless tool silhouette
  // (iii) Overhead Steel Garage Wall Cabinets (cols 26.0..29.8)
  for (const cabCol of [26.0, 27.9]) {
    const cx = Math.round(cabCol * TILE);
    pxRect(ctx, cx, garFaceY + 4, 54, 24, '#3B424C');
    pxRect(ctx, cx + 2, garFaceY + 6, 24, 20, '#525B68');
    pxRect(ctx, cx + 28, garFaceY + 6, 24, 20, '#525B68');
    pxRect(ctx, cx + 23, garFaceY + 13, 2, 6, '#CBD5E1');
    pxRect(ctx, cx + 29, garFaceY + 13, 2, 6, '#CBD5E1');
  }
  // (iv) Overhead Twin Cool-White LED Shop Light Tubes along Garage Wall Top
  const shopGlow = timeOfDay === 'evening' ? '#F8FAFC' : '#E2E8F0';
  pxRect(ctx, Math.round(22.6 * TILE), garNorthY + 18, 72, 4, '#334155');
  pxRect(ctx, Math.round(22.6 * TILE) + 4, garNorthY + 19, 64, 2, shopGlow);
  pxRect(ctx, Math.round(27.4 * TILE), garNorthY + 18, 72, 4, '#334155');
  pxRect(ctx, Math.round(27.4 * TILE) + 4, garNorthY + 19, 64, 2, shopGlow);

  // Garage South Double-Bay Corner Piers (row 30: cols 19..20.85 left, cols 31.15..32.99 right)
  const leftPierW = Math.round(1.85 * TILE);
  const rightPierX = Math.round((DRIVEWAY_COL_END + 1.15) * TILE);
  const rightPierW = WORLD_W - rightPierX;
  pxRect(ctx, foyerEastX, garBayY, leftPierW, TILE, '#3B281E');
  pxRect(ctx, foyerEastX + 4, garBayY + 12, leftPierW - 8, 16, '#D9CDBB');
  pxRect(ctx, foyerEastX + 4, garBayY + 18, leftPierW - 8, 1, '#BFAEA0');
  pxRect(ctx, rightPierX, garBayY, rightPierW, TILE, '#3B281E');
  pxRect(ctx, rightPierX + 4, garBayY + 12, rightPierW - 8, 16, '#D9CDBB');
  pxRect(ctx, rightPierX + 4, garBayY + 18, rightPierW - 8, 1, '#BFAEA0');

  // 4. Entryway South Exterior Wall (row 28, cols 9..12 & cols 16..19) with Grand Front Double Doorway (cols 13..15)
  const leftFacadeX = foyerWestX;
  const leftFacadeW = (FRONT_DOOR_COL_START - WEST_DIVIDER_COL) * TILE;
  pxRect(ctx, leftFacadeX, fsY, leftFacadeW, TILE, '#3B281E');
  pxRect(ctx, leftFacadeX + TILE - 5, fsY, leftFacadeW - TILE + 5, 6, '#5B3E2B');
  pxRect(ctx, leftFacadeX + TILE, fsY + 14, leftFacadeW - TILE - 4, 16, '#7C573B');
  pxRect(ctx, leftFacadeX + TILE, fsY + 18, leftFacadeW - TILE - 4, 2, '#62432C');
  pxRect(ctx, leftFacadeX + TILE, fsY + 24, leftFacadeW - TILE - 4, 2, '#62432C');

  const rightFacadeX = (FRONT_DOOR_COL_END + 1) * TILE;
  const rightFacadeW = (LOWER_EAST_WALL_COL - FRONT_DOOR_COL_END) * TILE;
  pxRect(ctx, rightFacadeX, fsY, rightFacadeW, TILE, '#3B281E');
  pxRect(ctx, rightFacadeX, fsY, rightFacadeW, 6, '#5B3E2B');
  pxRect(ctx, rightFacadeX + 4, fsY + 14, rightFacadeW - 4, 16, '#7C573B');
  pxRect(ctx, rightFacadeX + 4, fsY + 18, rightFacadeW - 4, 2, '#62432C');
  pxRect(ctx, rightFacadeX + 4, fsY + 24, rightFacadeW - 4, 2, '#62432C');

  // Grand Front Double Door Jambs & Welcoming Open Wooden Door Leaves
  const fdLeftX = FRONT_DOOR_COL_START * TILE;
  const fdRightX = (FRONT_DOOR_COL_END + 1) * TILE;
  pxRect(ctx, fdLeftX - 5, fsY, 6, TILE, '#5B3A23');
  pxRect(ctx, fdRightX - 1, fsY, 6, TILE, '#5B3A23');
  pxRect(ctx, fdLeftX + 1, fsY - 12, 6, 18, '#6B4226');
  pxRect(ctx, fdLeftX + 2, fsY - 10, 3, 14, '#8C5936');
  pxRect(ctx, fdRightX - 7, fsY - 12, 6, 18, '#6B4226');
  pxRect(ctx, fdRightX - 5, fsY - 10, 3, 14, '#8C5936');

  // Twin Warm Brass Porch Wall Lanterns & Twin Garage Exterior Coach Lanterns
  const lanternPulse = Math.floor(tick / 16) % 2 === 0 ? '#FFF3BE' : '#FDE68A';
  for (const [lx, ly] of [
    [fdLeftX - 15, fsY + 15],
    [fdRightX + 6, fsY + 15],
    [foyerEastX + leftPierW - 14, garBayY + 15],
    [rightPierX + 5, garBayY + 15],
  ]) {
    pxRect(ctx, lx, ly, 9, 12, '#342A24');
    pxRect(ctx, lx + 2, ly + 2, 5, 8, lanternPulse);
    pxRect(ctx, lx + 3, ly + 3, 3, 5, '#FFFBEB');
    pxRect(ctx, lx - 1, ly, 11, 2, '#2A211C');
  }

  // Porch west & east cedar side trim rails (rows 29..30)
  pxRect(ctx, foyerWestX + TILE - 5, fsY + TILE, 5, 2 * TILE, '#6A472D');
  pxRect(ctx, foyerEastX, fsY + TILE, 5, 2 * TILE, '#6A472D');

  // 5. White Wooden Front Picket Fence along Sidewalk Border (row 38.52) with Open Garden Gate & Open 2-Car Driveway Entrance
  const fenceY = Math.round((SIDEWALK_ROW_START - 0.48) * TILE);
  const drawPicketFence = (xStart: number, xEnd: number) => {
    const fw = xEnd - xStart;
    if (fw < 14) return;
    pxRect(ctx, xStart, fenceY + 11, fw, 3, 'rgba(20, 28, 18, 0.22)');
    pxRect(ctx, xStart, fenceY + 3, fw, 2, '#D8D1C5');
    pxRect(ctx, xStart, fenceY + 8, fw, 2, '#D8D1C5');
    for (let px = xStart + 2; px < xEnd - 3; px += 8) {
      pxRect(ctx, px, fenceY, 4, 12, '#FAF6F0');
      pxRect(ctx, px + 1, fenceY - 1, 2, 2, '#FFFFFF');
      pxRect(ctx, px + 3, fenceY + 1, 1, 11, '#D3CABD');
    }
    pxRect(ctx, xStart, fenceY - 3, 6, 16, '#E8E0D4');
    pxRect(ctx, xEnd - 6, fenceY - 3, 6, 16, '#E8E0D4');
  };
  // Left front yard picket fence (cols 0.25..12.6)
  drawPicketFence(8, Math.round((FRONT_DOOR_COL_START - 0.35) * TILE));
  // Middle pocket lawn picket fence (cols 16.35..20.6)
  drawPicketFence(
    Math.round((FRONT_DOOR_COL_END + 1.35) * TILE),
    Math.round((DRIVEWAY_COL_START - 0.35) * TILE)
  );
  // Right east-edge picket fence cap (cols 31.35..32.75)
  drawPicketFence(Math.round((DRIVEWAY_COL_END + 1.35) * TILE), WORLD_W - 8);

  // Twin Stone Entrance Gate Pillars flanking Long Front Walkway (cols 12.65 & 16.05) + Driveway Stone Piers (cols 20.65 & 31.05)
  const drawStonePillar = (px: number, py: number, withLantern: boolean) => {
    pxRect(ctx, px - 1, py + 15, 16, 4, 'rgba(20, 24, 18, 0.28)');
    pxRect(ctx, px, py, 14, 17, '#8E8579');
    pxRect(ctx, px + 2, py + 2, 10, 13, '#C4BBB0');
    pxRect(ctx, px - 1, py - 2, 16, 4, '#DDD5C9');
    if (withLantern) {
      pxRect(ctx, px + 3, py - 9, 8, 7, '#2E2823');
      pxRect(ctx, px + 5, py - 7, 4, 4, lanternPulse);
    }
  };
  drawStonePillar(Math.round((FRONT_DOOR_COL_START - 0.45) * TILE), fenceY - 4, true);
  drawStonePillar(Math.round((FRONT_DOOR_COL_END + 1.02) * TILE), fenceY - 4, true);
  drawStonePillar(Math.round((DRIVEWAY_COL_START - 0.48) * TILE), fenceY - 4, true);
  drawStonePillar(Math.round((DRIVEWAY_COL_END + 1.04) * TILE), fenceY - 4, true);

  // 5b. Low Warm Solar Garden Path Lanterns lining BOTH sides of the Long Front Walkway (rows 33.0, 35.4, 37.3)
  for (const lampRow of [33.0, 35.4, 37.3]) {
    const ly = Math.round(lampRow * TILE);
    for (const lampCol of [12.68, 16.22]) {
      // Skip right lamp at row 33.0 where the horizontal garden connector path branches off to the driveway!
      if (lampRow === 33.0 && lampCol > 15) continue;
      const lx = Math.round(lampCol * TILE);
      pxRect(ctx, lx - 2, ly + 4, 6, 3, 'rgba(20, 26, 18, 0.28)');
      pxRect(ctx, lx, ly - 5, 2, 10, '#2B2F36');
      pxRect(ctx, lx - 2, ly - 9, 6, 5, '#262930');
      pxRect(ctx, lx - 1, ly - 7, 4, 3, lanternPulse);
    }
  }

  // 6. Lush Front Yard & Backyard Trees, Flowering Hedges & East Patio Bench
  // West Front Garden (cols 0..12, rows 24..38)
  drawGardenTree(ctx, Math.round(2.4 * TILE), Math.round(25.2 * TILE), timeOfDay, tick, 'oak');
  drawGardenTree(ctx, Math.round(6.8 * TILE), Math.round(26.6 * TILE), timeOfDay, tick, 'pine');
  drawGardenTree(ctx, Math.round(3.6 * TILE), Math.round(33.4 * TILE), timeOfDay, tick, 'oak');
  drawGardenTree(ctx, Math.round(8.8 * TILE), Math.round(35.0 * TILE), timeOfDay, tick, 'pine');
  drawGardenShrub(ctx, Math.round(1.1 * TILE), Math.round(36.7 * TILE), 52, timeOfDay, '#F472B6');
  drawGardenShrub(ctx, Math.round(6.2 * TILE), Math.round(36.8 * TILE), 48, timeOfDay, '#FDE047');
  drawGardenShrub(ctx, Math.round(10.3 * TILE), Math.round(31.5 * TILE), 52, timeOfDay, '#FB923C');
  drawGardenShrub(ctx, Math.round(10.5 * TILE), Math.round(36.6 * TILE), 50, timeOfDay, '#F472B6');

  // Middle Pocket Front Lawn shrubs framing the walkway & connector path (cols 16.5..20.2)
  drawGardenShrub(ctx, Math.round(16.7 * TILE), Math.round(31.5 * TILE), 56, timeOfDay, '#FDE047');
  drawGardenShrub(ctx, Math.round(16.8 * TILE), Math.round(35.6 * TILE), 58, timeOfDay, '#F472B6');
  drawGardenShrub(ctx, Math.round(18.6 * TILE), Math.round(36.8 * TILE), 48, timeOfDay, '#FB923C');
}

function drawGreenCarSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  car: GreenCarState,
  timeOfDay: TimeOfDay,
  tick: number
) {
  const w = GREEN_CAR_W; // 56
  const h = GREEN_CAR_L; // 104
  const hw = w / 2; // 28
  const hl = h / 2; // 52

  const bodyDark = '#2E5955';
  const bodyMain = '#447E78';
  const bodySheen = '#63A39C';
  const roofMain = '#589690';
  const roofInner = '#6FB0A9';

  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));
  // Local +Y is rear (down), -Y is front nose (up), matching angle = -Math.PI/2 facing north
  ctx.rotate(car.angle + Math.PI / 2);

  // 1. Warm headlight beams projecting ahead when driving or in evening
  if (car.isDriving || timeOfDay === 'evening') {
    const beamAlpha = timeOfDay === 'evening' ? 0.3 : 0.16;
    const beamLen = timeOfDay === 'evening' ? 92 : 68;
    const grad = ctx.createLinearGradient(0, -hl, 0, -hl - beamLen);
    grad.addColorStop(0, `rgba(254, 243, 199, ${beamAlpha})`);
    grad.addColorStop(1, 'rgba(254, 243, 199, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-hw + 9, -hl + 2);
    ctx.lineTo(hw - 9, -hl + 2);
    ctx.lineTo(hw + 22, -hl - beamLen);
    ctx.lineTo(-hw - 22, -hl - beamLen);
    ctx.closePath();
    ctx.fill();
  }

  // 2. Subtle exhaust puffs behind rear tailpipe while moving
  if (car.isDriving && Math.abs(car.speed) > 18) {
    const puffPhase = (tick * 0.18) % 1;
    const puffY = hl + 4 + puffPhase * 12;
    const puffAlpha = (1 - puffPhase) * 0.34;
    ctx.fillStyle = `rgba(226, 232, 240, ${puffAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(-12 + Math.sin(tick * 0.25) * 2, puffY, 3 + puffPhase * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Soft undercarriage shadow
  pxRect(ctx, -hw + 2, -hl + 4, w - 2, h - 2, 'rgba(18, 22, 28, 0.34)');

  // 4. Four rubber tires (front two turn visibly with steerAngle!)
  const drawWheel = (wx: number, wy: number, steer: number) => {
    ctx.save();
    ctx.translate(wx, wy);
    if (steer !== 0) {
      ctx.rotate(steer);
    }
    pxRect(ctx, -3, -9, 6, 18, '#171A21');
    pxRect(ctx, -2, -7, 4, 14, '#272C36');
    ctx.restore();
  };
  drawWheel(-hw + 2, -hl + 22, car.steerAngle); // Front-left
  drawWheel(hw - 2, -hl + 22, car.steerAngle); // Front-right
  drawWheel(-hw + 2, hl - 22, 0); // Rear-left
  drawWheel(hw - 2, hl - 22, 0); // Rear-right

  // 5. Side wing mirrors
  pxRect(ctx, -hw - 2, -hl + 30, 5, 6, bodyDark);
  pxRect(ctx, hw - 3, -hl + 30, 5, 6, bodyDark);

  // 6. Main painted sage-teal compact hatchback body
  pxRect(ctx, -hw + 3, -hl + 2, w - 6, h - 4, bodyDark);
  pxRect(ctx, -hw + 6, -hl + 5, w - 12, h - 10, bodyMain);

  // Sleek sculpted hood & highlight creases
  pxRect(ctx, -hw + 9, -hl + 7, w - 18, 20, bodySheen);
  pxRect(ctx, -hw + 13, -hl + 9, 2, 15, bodyMain);
  pxRect(ctx, hw - 15, -hl + 9, 2, 15, bodyMain);

  // Front & rear bumpers
  pxRect(ctx, -hw + 8, -hl, w - 16, 4, '#242A32');
  pxRect(ctx, -hw + 8, hl - 4, w - 16, 4, '#242A32');

  // Front headlights
  const headColor = car.isDriving || timeOfDay === 'evening' ? '#FFFBEB' : '#FEF08A';
  pxRect(ctx, -hw + 7, -hl + 2, 10, 5, headColor);
  pxRect(ctx, hw - 17, -hl + 2, 10, 5, headColor);

  // Rear taillights + active brake light glow + white reverse lamps
  const tailColor = car.braking ? '#FF3B3B' : '#EF4444';
  pxRect(ctx, -hw + 7, hl - 7, 10, 5, tailColor);
  pxRect(ctx, hw - 17, hl - 7, 10, 5, tailColor);
  if (car.braking) {
    pxRect(ctx, -hw + 5, hl - 3, 14, 5, 'rgba(248, 113, 113, 0.45)');
    pxRect(ctx, hw - 19, hl - 3, 14, 5, 'rgba(248, 113, 113, 0.45)');
  }
  if (car.reversing) {
    pxRect(ctx, -hw + 16, hl - 6, 5, 3, '#F8FAFC');
    pxRect(ctx, hw - 21, hl - 6, 5, 3, '#F8FAFC');
    pxRect(ctx, -hw + 14, hl - 2, 9, 5, 'rgba(248, 250, 252, 0.38)');
    pxRect(ctx, hw - 23, hl - 2, 9, 5, 'rgba(248, 250, 252, 0.38)');
  }

  // Rear license plate
  pxRect(ctx, -6, hl - 5, 12, 3, '#F1F5F9');

  // 7. Front windshield (with cozy driver silhouette visible when driving!)
  pxRect(ctx, -hw + 8, -hl + 26, w - 16, 16, '#223445');
  pxRect(ctx, -hw + 10, -hl + 28, w - 20, 4, 'rgba(186, 230, 253, 0.42)');
  if (car.isDriving) {
    // Cozy driver visible through windshield (right-hand drive / driver seat silhouette)
    pxRect(ctx, 2, -hl + 31, 9, 8, '#6A7B53'); // Olive sweater shoulders
    pxRect(ctx, 3, -hl + 29, 7, 7, '#5A3724'); // Driver head/hair
    pxRect(ctx, 4, -hl + 29, 5, 3, '#6A422B'); // Hair highlight
  }

  // 8. Cabin roof panel
  const roofH = h - 72; // 32px
  pxRect(ctx, -hw + 9, -hl + 42, w - 18, roofH, roofMain);
  pxRect(ctx, -hw + 13, -hl + 46, w - 26, roofH - 8, roofInner);

  // 9. Rear hatchback glass
  const rearWinY = -hl + 42 + roofH;
  pxRect(ctx, -hw + 10, rearWinY, w - 20, 12, '#223445');
  pxRect(ctx, -hw + 13, rearWinY + 2, w - 26, 3, 'rgba(186, 230, 253, 0.32)');

  // 10. Friendly visual horn ripple arcs in front of hood when honking (H)
  if (car.hornTick > 0) {
    const progress = 1 - car.hornTick / 18;
    const r = 10 + progress * 16;
    const alpha = (1 - progress) * 0.85;
    ctx.strokeStyle = `rgba(253, 224, 71, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -hl - 4, r, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Renders the drivable left sage-teal family hatchback clipped cleanly to the
 * neighborhood lot boundaries. When driving along the road edges, also draws
 * the seamless wrap-around twin emerging from the opposite side of the street!
 */
export function drawGreenCar(
  ctx: CanvasRenderingContext2D,
  car: GreenCarState,
  timeOfDay: TimeOfDay,
  tick: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WORLD_W, WORLD_H);
  ctx.clip();

  drawGreenCarSprite(ctx, car.x, car.y, car, timeOfDay, tick);

  // Seamless wrap-around dual rendering along the 2-lane street edges
  const onRoad = car.y >= (ROAD_ROW_START - 0.65) * TILE;
  if (onRoad) {
    if (car.x > WORLD_W - GREEN_CAR_L) {
      drawGreenCarSprite(ctx, car.x - WORLD_W, car.y, car, timeOfDay, tick);
    } else if (car.x < GREEN_CAR_L) {
      drawGreenCarSprite(ctx, car.x + WORLD_W, car.y, car, timeOfDay, tick);
    }
  }

  ctx.restore();
}

export function drawSouthRoomsFurniture(
  ctx: CanvasRenderingContext2D,
  tick: number,
  hasWateredPlantsToday = false,
  plantWateringProgress = 0
) {
  // =========================================================================
  // ENTRYWAY / FOYER FURNITURE (cols 10..18, rows 24..27)
  // =========================================================================

  // 1. North-East Walnut Entryway Console Table (cols 14.55..16.8, rows 23.95..24.9)
  const ctxX = Math.round(5.55 * TILE + CORE_OFFSET_X);
  const ctxY = Math.round(23.95 * TILE);
  const ctxW = Math.round(2.25 * TILE);
  const ctxH = Math.round(0.95 * TILE);
  pxRect(ctx, ctxX + 2, ctxY + ctxH - 1, ctxW - 4, 5, 'rgba(28, 20, 15, 0.24)');
  pxRect(ctx, ctxX, ctxY, ctxW, ctxH, '#513320');
  pxRect(ctx, ctxX + 2, ctxY + 2, ctxW - 4, ctxH - 9, '#8E5F3D');
  pxRect(ctx, ctxX + 3, ctxY + 3, ctxW - 6, 2, '#AA7752');
  pxRect(ctx, ctxX + 4, ctxY + ctxH - 7, 30, 5, '#734B2E');
  pxRect(ctx, ctxX + 38, ctxY + ctxH - 7, 30, 5, '#734B2E');
  pxRect(ctx, ctxX + 17, ctxY + ctxH - 5, 4, 2, '#E8C57B');
  pxRect(ctx, ctxX + 51, ctxY + ctxH - 5, 4, 2, '#E8C57B');
  pxRect(ctx, ctxX + 7, ctxY + 8, 9, 10, '#C98A63');
  pxRect(ctx, ctxX + 5, ctxY + 1, 13, 8, '#FAF2DF');
  pxRect(ctx, ctxX + 7, ctxY + 2, 9, 5, '#FFF5C4');
  pxRect(ctx, ctxX + 27, ctxY + 8, 13, 9, '#D8CFC2');
  pxRect(ctx, ctxX + 29, ctxY + 10, 9, 5, '#EDE6DA');
  pxRect(ctx, ctxX + 32, ctxY + 11, 4, 2, '#E8C57B');
  pxRect(ctx, ctxX + 52, ctxY + 6, 10, 11, '#5F8476');
  pxRect(ctx, ctxX + 54, ctxY - 2, 2, 9, '#E4CFA9');
  pxRect(ctx, ctxX + 58, ctxY - 1, 2, 8, '#D7BA8B');

  // 2. West Cushioned Wooden Shoe Bench & Shoe Rack (cols 10.1..11.25, rows 25.35..27.65)
  const sbX = Math.round(1.1 * TILE + CORE_OFFSET_X);
  const sbY = Math.round(25.35 * TILE);
  const sbW = Math.round(1.15 * TILE);
  const sbH = Math.round(2.3 * TILE);
  pxRect(ctx, sbX + 2, sbY + sbH - 1, sbW - 2, 5, 'rgba(28, 20, 15, 0.24)');
  pxRect(ctx, sbX, sbY, sbW, sbH, '#5A3A24');
  pxRect(ctx, sbX + 2, sbY + 2, sbW - 4, sbH - 4, '#8A5E3E');
  pxRect(ctx, sbX + 4, sbY + 5, sbW - 10, sbH - 10, '#E3D7C4');
  pxRect(ctx, sbX + 6, sbY + 7, sbW - 14, sbH - 14, '#EFE6D8');
  for (let ty = sbY + 16; ty < sbY + sbH - 12; ty += 16) {
    pxRect(ctx, sbX + 14, ty, 3, 3, '#C7B79F');
  }
  pxRect(ctx, sbX + sbW - 7, sbY + 10, 6, 9, '#C96F53');
  pxRect(ctx, sbX + sbW - 7, sbY + 24, 6, 9, '#5E8A78');
  pxRect(ctx, sbX + sbW - 7, sbY + 42, 6, 9, '#4B6584');
  pxRect(ctx, sbX + sbW - 7, sbY + 56, 6, 9, '#D4A359');

  // 3. South-East Standing Wooden Coat Rack & Ceramic Umbrella Stand (cols 16.45..18.3, rows 26.85..27.75)
  const crX = Math.round(7.45 * TILE + CORE_OFFSET_X);
  const crY = Math.round(26.85 * TILE);
  pxRect(ctx, crX + 2, crY + 22, 20, 5, 'rgba(28, 20, 15, 0.22)');
  pxRect(ctx, crX + 2, crY + 4, 20, 20, '#3C5B6E');
  pxRect(ctx, crX + 4, crY + 6, 16, 16, '#50778F');
  pxRect(ctx, crX + 5, crY + 8, 14, 3, '#D8CFC2');
  pxRect(ctx, crX + 6, crY - 6, 3, 13, '#C85A3F');
  pxRect(ctx, crX + 6, crY - 8, 5, 2, '#6E4528');
  pxRect(ctx, crX + 12, crY - 4, 3, 11, '#E9C46A');
  pxRect(ctx, crX + 16, crY - 5, 3, 12, '#5E9C74');

  const csX = crX + 34;
  pxRect(ctx, csX + 2, crY + 21, 18, 5, 'rgba(28, 20, 15, 0.24)');
  pxRect(ctx, csX + 4, crY + 17, 14, 5, '#593A24');
  pxRect(ctx, csX + 9, crY - 12, 4, 32, '#7C5133');
  pxRect(ctx, csX + 4, crY - 9, 14, 3, '#593A24');
  pxRect(ctx, csX + 3, crY - 6, 8, 14, '#D9B68C');
  pxRect(ctx, csX + 12, crY - 7, 7, 11, '#68829E');

  // =========================================================================
  // FRONT PORCH FURNITURE (cols 10..18, rows 29..30 — non-interactable)
  // =========================================================================

  // 4. West Porch Woven Wicker Armchair & Side Table
  const pcX = Math.round(1.25 * TILE + CORE_OFFSET_X);
  const pcY = Math.round(29.18 * TILE);
  pxRect(ctx, pcX + 2, pcY + 34, 42, 6, 'rgba(24, 16, 10, 0.24)');
  pxRect(ctx, pcX, pcY + 2, 28, 34, '#6E4B2E');
  pxRect(ctx, pcX + 2, pcY + 4, 24, 30, '#A6794F');
  pxRect(ctx, pcX + 4, pcY + 4, 20, 7, '#8A603B');
  pxRect(ctx, pcX + 5, pcY + 12, 18, 18, '#FAF2E4');
  pxRect(ctx, pcX + 7, pcY + 14, 14, 14, '#E8DAC4');
  pxRect(ctx, pcX + 7, pcY + 11, 10, 7, '#C86D51');
  pxRect(ctx, pcX + 9, pcY + 13, 6, 3, '#E9C46A');
  pxRect(ctx, pcX + 32, pcY + 14, 16, 16, '#5D3C24');
  pxRect(ctx, pcX + 34, pcY + 16, 12, 12, '#9A6C48');
  pxRect(ctx, pcX + 38, pcY + 18, 5, 6, '#D97736');
  pxRect(ctx, pcX + 39, pcY + 16, 2, 3, '#FAF6F0');

  // 5. East Porch 5 Blooming Terracotta Potted Plants (interactive daily watering quest)
  const plX = PORCH_PLANTER_RECT.x;
  const plY = PORCH_PLANTER_RECT.y;
  const flowerSway = hasWateredPlantsToday ? Math.floor(tick / 18) % 2 : Math.floor(tick / 42) % 2;
  pxRect(ctx, plX + 2, plY + 23, 64, 5, 'rgba(24, 16, 10, 0.24)');
  // Terracotta planter box
  pxRect(ctx, plX, plY + 6, 66, 20, '#8A462B');
  pxRect(ctx, plX + 2, plY + 8, 62, 16, '#C26A46');
  // Soil color reflects hydration: rich dark moist earth when watered, dry dusty tan when thirsty
  pxRect(
    ctx,
    plX + 4,
    plY + 10,
    58,
    10,
    hasWateredPlantsToday || plantWateringProgress > 0 ? '#3A2315' : '#735139'
  );
  if (hasWateredPlantsToday) {
    // Subtle dark moisture sheen on hydrated potting soil
    pxRect(ctx, plX + 7, plY + 12, 18, 2, '#2B190E');
    pxRect(ctx, plX + 36, plY + 14, 20, 2, '#2B190E');
  }

  for (let i = 0; i < 5; i++) {
    const fx = plX + 6 + i * 11;
    const isFreshlyHit =
      plantWateringProgress > 0 && plantWateringProgress >= i * 0.16;
    const isHydrated = hasWateredPlantsToday || isFreshlyHit;
    const droopY = isHydrated ? 0 : 1;

    const leafDark = isHydrated
      ? i % 2 === 0
        ? '#2E7D4E'
        : '#3E945F'
      : i % 2 === 0
        ? '#5F7A52'
        : '#6F8B60';
    const leafLight = isHydrated ? '#6CC989' : '#8BA67B';

    pxRect(ctx, fx, plY + 3 + droopY, 10, 12 - droopY, leafDark);
    pxRect(ctx, fx + 2, plY + 1 + droopY, 6, 6, leafLight);

    const blossomColor = isHydrated
      ? i === 0 || i === 3
        ? '#F472B6'
        : i === 1 || i === 4
          ? '#FDE047'
          : '#FB923C'
      : i === 0 || i === 3
        ? '#D989AE'
        : i === 1 || i === 4
          ? '#DFCA74'
          : '#DC9A6B';
    pxRect(
      ctx,
      fx + 3 + (i % 2 === 0 ? flowerSway : 0),
      plY + 2 + droopY,
      4,
      4,
      blossomColor
    );

    // Occasional shimmering dewdrop glint on freshly watered leaves
    if (isHydrated && (Math.floor(tick / 16) + i * 3) % 7 === 0) {
      pxRect(ctx, fx + 1, plY + 5, 2, 2, '#BAE6FD');
      pxRect(ctx, fx + 2, plY + 5, 1, 1, '#FFFFFF');
    }
  }

  // Active watering can + sparkling water droplets sweeping across all 5 plants
  if (plantWateringProgress > 0 && plantWateringProgress < 1) {
    const sweepX = plX + 6 + plantWateringProgress * 46;
    const canBob = Math.round(Math.sin(tick * 0.45) * 1.5);
    const canX = Math.round(sweepX + 8);
    const canY = Math.round(plY - 19 + canBob);

    // Cute tilted pixel watering can (sage-sky enamel + brass rose spout)
    pxRect(ctx, canX + 4, canY + 4, 11, 8, '#0E7490');
    pxRect(ctx, canX + 5, canY + 5, 9, 6, '#22D3EE');
    pxRect(ctx, canX + 6, canY + 5, 7, 2, '#A5F3FC');
    // Curved rear handle
    pxRect(ctx, canX + 14, canY + 3, 3, 2, '#0E7490');
    pxRect(ctx, canX + 16, canY + 5, 2, 5, '#0E7490');
    pxRect(ctx, canX + 14, canY + 9, 3, 2, '#0E7490');
    // Angled pouring spout pointing down-left toward the blossoms
    pxRect(ctx, canX + 1, canY + 7, 4, 2, '#0E7490');
    pxRect(ctx, canX - 2, canY + 9, 4, 2, '#155E75');
    pxRect(ctx, canX - 4, canY + 10, 3, 3, '#EAB308'); // Brass sprinkler rose

    // Animated falling water droplets & blossom splash sparkles
    for (let d = 0; d < 6; d++) {
      const dropPhase = ((tick * 0.28 + d * 0.31) % 1);
      const dx = Math.round(canX - 4 - d * 1.4 + Math.sin(tick * 0.4 + d) * 1.2);
      const dy = Math.round(canY + 12 + dropPhase * 16);
      pxRect(ctx, dx, dy, 2, 3, d % 2 === 0 ? '#7DD3FC' : '#BAE6FD');
      if (dropPhase > 0.78) {
        pxRect(ctx, dx - 2, dy + 1, 1, 1, '#FFFFFF');
        pxRect(ctx, dx + 3, dy + 1, 1, 1, '#E0F2FE');
      }
    }
  }

  // =========================================================================
  // 6. ATTACHED 2-CAR GARAGE WORKSHOP & TWO PARKED FAMILY CARS (cols 20..31, rows 22..29)
  // =========================================================================

  // 6a. Garage Heavy Timber Workbench (cols 22.3..25.4, rows 22.0..22.85)
  const wbX = Math.round(22.3 * TILE);
  const wbY = Math.round(22.0 * TILE);
  const wbW = Math.round(3.1 * TILE);
  const wbH = Math.round(0.85 * TILE);
  pxRect(ctx, wbX + 2, wbY + wbH - 1, wbW - 4, 5, 'rgba(24, 28, 34, 0.24)');
  pxRect(ctx, wbX, wbY, wbW, wbH, '#4E311D');
  pxRect(ctx, wbX + 3, wbY + 2, wbW - 6, wbH - 8, '#A6784E'); // Butcher-block wood benchtop
  pxRect(ctx, wbX + 4, wbY + 3, wbW - 8, 2, '#C2956A');
  pxRect(ctx, wbX + 4, wbY + wbH - 6, wbW - 8, 4, '#3B424C'); // Steel frame shelf
  // Bench vise, red toolbox & cordless drill on benchtop
  pxRect(ctx, wbX + 8, wbY + 7, 10, 9, '#334155');
  pxRect(ctx, wbX + 10, wbY + 9, 6, 4, '#94A3B8');
  pxRect(ctx, wbX + 28, wbY + 6, 22, 12, '#B91C1C');
  pxRect(ctx, wbX + 30, wbY + 8, 18, 8, '#DC2626');
  pxRect(ctx, wbX + 35, wbY + 5, 8, 3, '#E2E8F0'); // Toolbox handle
  pxRect(ctx, wbX + 64, wbY + 8, 12, 8, '#EAB308'); // Cordless drill
  pxRect(ctx, wbX + 76, wbY + 10, 6, 3, '#475569');

  // 6b. Rolling Red Mechanic Tool Chest (cols 25.8..27.2, rows 22.0..22.85)
  const tcX = Math.round(25.8 * TILE);
  const tcY = Math.round(22.0 * TILE);
  const tcW = Math.round(1.4 * TILE);
  const tcH = Math.round(0.85 * TILE);
  pxRect(ctx, tcX + 2, tcY + tcH - 1, tcW - 4, 5, 'rgba(24, 28, 34, 0.26)');
  pxRect(ctx, tcX, tcY, tcW, tcH, '#7F1D1D');
  pxRect(ctx, tcX + 2, tcY + 2, tcW - 4, tcH - 6, '#DC2626');
  pxRect(ctx, tcX + 4, tcY + 4, tcW - 8, 8, '#262930'); // Rubber top mat
  pxRect(ctx, tcX + 4, tcY + 15, tcW - 8, 3, '#991B1B');
  pxRect(ctx, tcX + 12, tcY + 16, tcW - 24, 1, '#E2E8F0'); // Chrome drawer pull
  pxRect(ctx, tcX + 4, tcY + 20, tcW - 8, 3, '#991B1B');
  pxRect(ctx, tcX + 12, tcY + 21, tcW - 24, 1, '#E2E8F0');

  // 6c. Heavy-Duty Metal Storage Shelving Rack (cols 27.6..30.2, rows 22.0..22.85)
  const shX = Math.round(27.6 * TILE);
  const shY = Math.round(22.0 * TILE);
  const shW = Math.round(2.6 * TILE);
  const shH = Math.round(0.85 * TILE);
  pxRect(ctx, shX + 2, shY + shH - 1, shW - 4, 5, 'rgba(24, 28, 34, 0.24)');
  pxRect(ctx, shX, shY, shW, shH, '#334155');
  pxRect(ctx, shX + 2, shY + 2, shW - 4, shH - 4, '#475569');
  // Neatly organized plastic storage totes & paint cans
  pxRect(ctx, shX + 5, shY + 4, 20, 15, '#1D4ED8');
  pxRect(ctx, shX + 7, shY + 6, 16, 11, '#3B82F6');
  pxRect(ctx, shX + 29, shY + 4, 20, 15, '#B45309');
  pxRect(ctx, shX + 31, shY + 6, 16, 11, '#F59E0B');
  pxRect(ctx, shX + 54, shY + 5, 11, 13, '#CBD5E1');
  pxRect(ctx, shX + 67, shY + 6, 11, 12, '#5E9C74');

  // 6d. North-East Upright Family Bicycle & Spare Tire Rack (cols 30.7..31.85, rows 22.1..24.3)
  const bkX = Math.round(30.75 * TILE);
  const bkY = Math.round(22.15 * TILE);
  // Stacked rubber spare tires
  pxRect(ctx, bkX + 4, bkY + 2, 24, 24, '#1E2228');
  pxRect(ctx, bkX + 7, bkY + 5, 18, 18, '#333A45');
  pxRect(ctx, bkX + 11, bkY + 9, 10, 10, '#94A3B8');
  // Parked teal commuter bicycle along east wall
  pxRect(ctx, bkX + 10, bkY + 32, 6, 16, '#1E2228'); // Front wheel
  pxRect(ctx, bkX + 10, bkY + 52, 6, 16, '#1E2228'); // Rear wheel
  pxRect(ctx, bkX + 12, bkY + 38, 3, 22, '#0EA5E9'); // Frame bar
  pxRect(ctx, bkX + 6, bkY + 36, 15, 3, '#475569'); // Handlebars
  pxRect(ctx, bkX + 10, bkY + 51, 6, 4, '#5C3A22'); // Leather saddle

  // 6e. Garage bays:
  // - Bay 1 (Left Bay): Drivable Sage-Teal Compact Hatchback (rendered dynamically via drawGreenCar)
  // - Bay 2 (Right Bay): Intentionally empty with yellow stall lines (the red car is currently out!)

  // =========================================================================
  // 7. HOME GYM / FITNESS STUDIO EQUIPMENT (cols 20..31, rows 14..19 — non-interactable)
  // =========================================================================

  // 7a. Heavy-Duty Power Squat Rack & Loaded Olympic Barbell (NW corner: cols 20.25..22.25, rows 14.05..15.5)
  const srX = Math.round(20.25 * TILE);
  const srY = Math.round(14.05 * TILE);
  const srW = Math.round(2.0 * TILE);
  const srH = Math.round(1.45 * TILE);
  pxRect(ctx, srX + 2, srY + srH - 2, srW - 4, 5, 'rgba(14, 18, 22, 0.3)');
  // Base steel rails & 4 corner matte-charcoal upright posts
  pxRect(ctx, srX + 4, srY + 4, 5, srH - 6, '#1E232A');
  pxRect(ctx, srX + srW - 9, srY + 4, 5, srH - 6, '#1E232A');
  pxRect(ctx, srX + 4, srY + 2, srW - 8, 5, '#2A313C'); // Top pull-up crossbeam
  pxRect(ctx, srX + 6, srY + 3, srW - 12, 2, '#475569');
  // Safety spotter arms extending forward
  pxRect(ctx, srX + 5, srY + 14, 4, srH - 18, '#3B4452');
  pxRect(ctx, srX + srW - 9, srY + 14, 4, srH - 18, '#3B4452');
  // Chrome Olympic Barbell racked across J-hooks
  pxRect(ctx, srX - 3, srY + 22, srW + 6, 3, '#CBD5E1');
  pxRect(ctx, srX + 12, srY + 22, srW - 24, 3, '#94A3B8'); // Knurled center shaft
  // Loaded colorful Olympic bumper weight plates (left & right sleeves)
  pxRect(ctx, srX - 2, srY + 15, 4, 17, '#B91C1C'); // 25kg red bumper
  pxRect(ctx, srX + 3, srY + 17, 3, 13, '#2563EB'); // 20kg blue bumper
  pxRect(ctx, srX + srW - 2, srY + 15, 4, 17, '#B91C1C');
  pxRect(ctx, srX + srW - 6, srY + 17, 3, 13, '#2563EB');

  // 7b. Adjustable Leather Weight Bench + Floor Hex Dumbbells (cols 23.25..24.8, rows 14.55..15.45)
  const wbGymX = Math.round(23.25 * TILE);
  const wbGymY = Math.round(14.55 * TILE);
  const wbGymW = Math.round(1.55 * TILE);
  const wbGymH = Math.round(0.9 * TILE);
  pxRect(ctx, wbGymX + 2, wbGymY + wbGymH - 1, wbGymW - 4, 5, 'rgba(14, 18, 22, 0.28)');
  // Steel bench legs & support bar
  pxRect(ctx, wbGymX + 4, wbGymY + 10, wbGymW - 8, 6, '#334155');
  // Main backrest cushion + seat pad (rich dark charcoal leather with subtle warm seam)
  pxRect(ctx, wbGymX + 1, wbGymY + 5, 31, 16, '#1E2229');
  pxRect(ctx, wbGymX + 3, wbGymY + 7, 27, 12, '#2F3640');
  pxRect(ctx, wbGymX + 4, wbGymY + 8, 25, 2, '#47515E');
  pxRect(ctx, wbGymX + 34, wbGymY + 6, 14, 14, '#1E2229');
  pxRect(ctx, wbGymX + 36, wbGymY + 8, 10, 10, '#2F3640');
  // Pair of compact hex dumbbells resting on floor next to bench
  pxRect(ctx, wbGymX + 12, wbGymY + 23, 12, 4, '#94A3B8');
  pxRect(ctx, wbGymX + 10, wbGymY + 22, 4, 6, '#181C22');
  pxRect(ctx, wbGymX + 22, wbGymY + 22, 4, 6, '#181C22');

  // 7c. Two-Tier Dumbbell & Kettlebell Rack (cols 25.5..27.4, rows 14.0..14.85)
  const drX = Math.round(25.5 * TILE);
  const drY = Math.round(14.0 * TILE);
  const drW = Math.round(1.9 * TILE);
  const drH = Math.round(0.85 * TILE);
  pxRect(ctx, drX + 2, drY + drH - 1, drW - 4, 5, 'rgba(14, 18, 22, 0.28)');
  pxRect(ctx, drX, drY, drW, drH, '#1F242C');
  pxRect(ctx, drX + 2, drY + 2, drW - 4, 10, '#2F3642'); // Upper dumbbell tier
  pxRect(ctx, drX + 2, drY + 14, drW - 4, 11, '#282E38'); // Lower kettlebell tier
  // Graduated pairs of chrome-handled dumbbells on upper tier
  for (let i = 0; i < 4; i++) {
    const dbx = drX + 5 + i * 13;
    pxRect(ctx, dbx, drY + 4, 3, 7, '#11151B');
    pxRect(ctx, dbx + 3, drY + 6, 4, 3, '#CBD5E1');
    pxRect(ctx, dbx + 7, drY + 4, 3, 7, '#11151B');
  }
  // Colorful cast-iron kettlebells on lower tier
  const kbColors = ['#5E8A78', '#D97736', '#3B82F6', '#EAB308'];
  kbColors.forEach((col, i) => {
    const kbx = drX + 7 + i * 13;
    pxRect(ctx, kbx + 1, drY + 15, 6, 3, '#181C22'); // Kettlebell handle
    pxRect(ctx, kbx, drY + 17, 8, 7, col);
    pxRect(ctx, kbx + 2, drY + 18, 3, 2, 'rgba(255,255,255,0.3)');
  });

  // 7d. Commercial Motorized Running Treadmill (SW corner: cols 20.25..22.65, rows 17.75..19.35)
  const tmGymX = Math.round(20.25 * TILE);
  const tmGymY = Math.round(17.75 * TILE);
  const tmGymW = Math.round(2.4 * TILE);
  const tmGymH = Math.round(1.6 * TILE);
  pxRect(ctx, tmGymX + 2, tmGymY + tmGymH - 2, tmGymW - 4, 6, 'rgba(14, 18, 22, 0.3)');
  // Base deck frame & side foot rails
  pxRect(ctx, tmGymX, tmGymY + 4, tmGymW, tmGymH - 6, '#262B33');
  pxRect(ctx, tmGymX + 3, tmGymY + 6, tmGymW - 6, 5, '#4B5563'); // Top rail
  pxRect(ctx, tmGymX + 3, tmGymY + tmGymH - 11, tmGymW - 6, 5, '#4B5563'); // Bottom rail
  // Wide dark running belt with subtle tread chevrons
  pxRect(ctx, tmGymX + 4, tmGymY + 11, tmGymW - 22, tmGymH - 22, '#1A1E24');
  for (let bx = tmGymX + 10; bx < tmGymX + tmGymW - 24; bx += 12) {
    pxRect(ctx, bx, tmGymY + 13, 2, tmGymH - 26, '#272D36');
  }
  // Front motor hood & upright console deck (right end, facing left/west onto belt)
  pxRect(ctx, tmGymX + tmGymW - 19, tmGymY + 3, 18, tmGymH - 4, '#323945');
  pxRect(ctx, tmGymX + tmGymW - 16, tmGymY + 7, 12, tmGymH - 12, '#1E242E');
  // Glowing blue-mint LCD console display + safety red stop button
  const ledPulse = Math.floor(tick / 20) % 2 === 0;
  pxRect(ctx, tmGymX + tmGymW - 14, tmGymY + 12, 8, 16, '#132A3E');
  pxRect(ctx, tmGymX + tmGymW - 12, tmGymY + 15, 4, 2, '#38BDF8');
  pxRect(ctx, tmGymX + tmGymW - 12, tmGymY + 20, 4, 2, ledPulse ? '#34D399' : '#10B981');
  pxRect(ctx, tmGymX + tmGymW - 12, tmGymY + 32, 4, 4, '#EF4444'); // Emergency stop key
  // Side ergonomic handle grips
  pxRect(ctx, tmGymX + tmGymW - 27, tmGymY + 6, 12, 4, '#94A3B8');
  pxRect(ctx, tmGymX + tmGymW - 27, tmGymY + tmGymH - 10, 12, 4, '#94A3B8');

  // 7e. Upright Exercise Spin Bike (South-center: cols 23.5..24.85, rows 17.8..19.3)
  const sbGymX = Math.round(23.5 * TILE);
  const sbGymY = Math.round(17.8 * TILE);
  const sbGymW = Math.round(1.35 * TILE);
  const sbGymH = Math.round(1.5 * TILE);
  pxRect(ctx, sbGymX + 4, sbGymY + sbGymH - 2, sbGymW - 8, 5, 'rgba(14, 18, 22, 0.28)');
  // Stabilizer floor feet (front & rear)
  pxRect(ctx, sbGymX + 7, sbGymY + 4, sbGymW - 14, 4, '#262B33');
  pxRect(ctx, sbGymX + 7, sbGymY + sbGymH - 8, sbGymW - 14, 4, '#262B33');
  // Main frame spine & weighted front flywheel (pointing north)
  pxRect(ctx, sbGymX + 16, sbGymY + 7, 10, 14, '#181C22'); // Flywheel
  pxRect(ctx, sbGymX + 18, sbGymY + 9, 6, 10, '#D97736'); // Terracotta flywheel accent
  pxRect(ctx, sbGymX + 19, sbGymY + 12, 4, 24, '#334155'); // Central frame beam
  // Left & right pedals
  pxRect(ctx, sbGymX + 9, sbGymY + 24, 10, 4, '#64748B');
  pxRect(ctx, sbGymX + 23, sbGymY + 26, 10, 4, '#64748B');
  // Bullhorn handlebars & compact LCD display (north)
  pxRect(ctx, sbGymX + 10, sbGymY + 14, 22, 4, '#1F242C');
  pxRect(ctx, sbGymX + 17, sbGymY + 11, 8, 5, '#1E3A4C');
  pxRect(ctx, sbGymX + 19, sbGymY + 13, 4, 1, '#38BDF8');
  // Ergonomic sport saddle (south)
  pxRect(ctx, sbGymX + 15, sbGymY + 32, 12, 10, '#1C2026');
  pxRect(ctx, sbGymX + 17, sbGymY + 34, 8, 6, '#3B424E');

  // 7f. Ash-Wood Water Rowing Machine (cols 25.55..27.65, rows 18.25..19.35)
  const rwX = Math.round(25.55 * TILE);
  const rwY = Math.round(18.25 * TILE);
  const rwW = Math.round(2.1 * TILE);
  const rwH = Math.round(1.1 * TILE);
  pxRect(ctx, rwX + 2, rwY + rwH - 2, rwW - 4, 5, 'rgba(14, 18, 22, 0.25)');
  // Dual warm ash-wood monorail beams
  pxRect(ctx, rwX + 2, rwY + 9, rwW - 4, 5, '#8F633E');
  pxRect(ctx, rwX + 2, rwY + 21, rwW - 4, 5, '#8F633E');
  pxRect(ctx, rwX + 4, rwY + 10, rwW - 8, 2, '#B6875D');
  pxRect(ctx, rwX + 4, rwY + 22, rwW - 8, 2, '#B6875D');
  // Circular transparent aqua water-resistance flywheel tank (west end)
  pxRect(ctx, rwX + 4, rwY + 5, 22, 24, '#334155');
  pxRect(ctx, rwX + 6, rwY + 7, 18, 20, '#38BDF8');
  pxRect(ctx, rwX + 8, rwY + 9, 14, 16, '#0EA5E9');
  pxRect(ctx, rwX + 13, rwY + 11, 4, 12, '#E0F2FE'); // Spinning paddle blade
  pxRect(ctx, rwX + 9, rwY + 15, 12, 4, '#BAE6FD');
  // Ergonomic sliding black rowing seat & foot stretcher
  pxRect(ctx, rwX + 38, rwY + 8, 15, 18, '#1E232A');
  pxRect(ctx, rwX + 40, rwY + 10, 11, 14, '#343C47');
  pxRect(ctx, rwX + 28, rwY + 10, 4, 14, '#CBD5E1'); // Rowing handle bar

  // 7g. Hydration Chilled Water Dispenser & Towel Basket Station (NE corner: cols 30.35..31.75, rows 14.05..15.75)
  const hyX = Math.round(30.35 * TILE);
  const hyY = Math.round(14.05 * TILE);
  // Chilled water cooler with blue 5-gallon jug
  pxRect(ctx, hyX + 2, hyY + 24, 20, 5, 'rgba(18, 22, 26, 0.24)');
  pxRect(ctx, hyX + 2, hyY + 2, 20, 24, '#CBD5E1');
  pxRect(ctx, hyX + 4, hyY + 4, 16, 20, '#F1F5F9');
  pxRect(ctx, hyX + 5, hyY + 1, 14, 12, '#60A5FA'); // Water jug
  pxRect(ctx, hyX + 7, hyY + 3, 10, 8, '#93C5FD');
  pxRect(ctx, hyX + 7, hyY + 16, 4, 3, '#3B82F6'); // Cold tap
  pxRect(ctx, hyX + 13, hyY + 16, 4, 3, '#EF4444'); // Hot tap
  // Compact oak towel & gear cabinet beside cooler
  pxRect(ctx, hyX + 24, hyY + 2, 19, 25, '#593A24');
  pxRect(ctx, hyX + 26, hyY + 4, 15, 21, '#8C5F3C');
  pxRect(ctx, hyX + 28, hyY + 6, 11, 6, '#FAF6F0'); // Rolled white towels
  pxRect(ctx, hyX + 28, hyY + 14, 11, 6, '#6F9486'); // Rolled sage towels
  // Woven storage basket with yoga blocks & jump rope below cooler
  pxRect(ctx, hyX + 10, hyY + 31, 28, 20, '#8A633C');
  pxRect(ctx, hyX + 12, hyY + 33, 24, 16, '#B88D5E');
  pxRect(ctx, hyX + 14, hyY + 35, 8, 10, '#5E8A78'); // Yoga block 1
  pxRect(ctx, hyX + 24, hyY + 35, 8, 10, '#C86D51'); // Yoga block 2

  // 7h. Anti-Burst Stability Swiss Ball & Tall Potted Snake Plant (SE corner: cols 30.85..31.8, rows 18.45..19.65)
  const swX = Math.round(30.85 * TILE);
  const swY = Math.round(18.45 * TILE);
  // Sage-mint Swiss stability ball
  pxRect(ctx, swX + 2, swY + 22, 24, 5, 'rgba(18, 22, 26, 0.24)');
  pxRect(ctx, swX + 4, swY + 2, 20, 22, '#4A7C6F');
  pxRect(ctx, swX + 2, swY + 5, 24, 16, '#5D9889');
  pxRect(ctx, swX + 6, swY + 5, 14, 12, '#75B5A4');
  pxRect(ctx, swX + 8, swY + 7, 6, 4, '#A7DFD0'); // Soft rubber highlight
  // Tall terracotta potted snake plant tucked right beside it
  const spY = swY + 24;
  pxRect(ctx, swX + 7, spY + 4, 16, 12, '#A85639');
  pxRect(ctx, swX + 9, spY + 5, 12, 9, '#C46C4B');
  pxRect(ctx, swX + 10, spY - 6, 3, 12, '#2D6A4F');
  pxRect(ctx, swX + 14, spY - 9, 3, 15, '#40916C');
  pxRect(ctx, swX + 18, spY - 5, 3, 11, '#2D6A4F');
}

/**
 * Draws the Front Porch south wooden railings, family mailbox, 2-Car Garage overhead
 * rolled-up sectional bay lintel, and cast-iron streetlamps for crisp depth layering.
 */
export function drawSouthRoomsForeground(ctx: CanvasRenderingContext2D, tick = 0) {
  const railY = Math.round(30.78 * TILE);

  const drawRailingSpan = (startCol: number, endCol: number) => {
    const rx = startCol * TILE;
    const rw = (endCol - startCol + 1) * TILE;
    pxRect(ctx, rx, railY + 11, rw, 4, 'rgba(20, 14, 8, 0.25)');
    for (let bx = rx + 6; bx < rx + rw - 4; bx += 9) {
      pxRect(ctx, bx, railY + 3, 4, 10, '#D9CBB7');
      pxRect(ctx, bx + 1, railY + 3, 1, 10, '#F5EFE6');
    }
    pxRect(ctx, rx, railY + 10, rw, 3, '#6B462B');
    pxRect(ctx, rx, railY, rw, 5, '#593821');
    pxRect(ctx, rx + 1, railY + 1, rw - 2, 2, '#8F603D');
    pxRect(ctx, rx - 1, railY - 4, 8, 18, '#4E311D');
    pxRect(ctx, rx, railY - 3, 6, 15, '#7A5032');
    pxRect(ctx, rx - 2, railY - 5, 10, 3, '#9E6B46');

    pxRect(ctx, rx + rw - 7, railY - 4, 8, 18, '#4E311D');
    pxRect(ctx, rx + rw - 6, railY - 3, 6, 15, '#7A5032');
    pxRect(ctx, rx + rw - 8, railY - 5, 10, 3, '#9E6B46');
  };

  // Left porch railing (cols 10..12) and right porch railing (cols 16..18), leaving cols 13..15 stone steps open
  drawRailingSpan(WEST_DIVIDER_COL + 1, FRONT_DOOR_COL_START - 1);
  drawRailingSpan(FRONT_DOOR_COL_END + 1, LOWER_EAST_WALL_COL - 1);

  // 2-Car Garage Wide Overhead Open Sectional Door Lintel Header (cols 20.85..31.15, row 30.0)
  const bayX = Math.round(20.85 * TILE);
  const bayW = Math.round(10.3 * TILE);
  const bayY = GARAGE_BAY_OPENING_ROW * TILE;
  pxRect(ctx, bayX, bayY, bayW, 11, '#3B281E');
  pxRect(ctx, bayX + 2, bayY + 2, bayW - 4, 7, '#EAE4DA'); // Rolled-up white sectional door bottom slat
  pxRect(ctx, bayX + 2, bayY + 6, bayW - 4, 1, '#C5BEB2');
  pxRect(ctx, bayX + Math.floor(bayW / 2) - 2, bayY + 1, 4, 9, '#948B7F'); // Double-bay center track seam

  // Classic Warm Cast-Iron Neighborhood Streetlamps along the pushed-back sidewalk border (row 38.85)
  const lampPulse = Math.floor(tick / 18) % 2 === 0 ? '#FFF3BE' : '#FDE68A';
  const lampBaseY = Math.round((SIDEWALK_ROW_START - 0.15) * TILE);
  for (const lampCol of [4.8, 11.4, 17.6, 31.95]) {
    const lx = Math.round(lampCol * TILE);
    pxRect(ctx, lx - 5, lampBaseY - 2, 10, 6, '#262930');
    pxRect(ctx, lx - 2, lampBaseY - 42, 4, 41, '#313640');
    pxRect(ctx, lx - 1, lampBaseY - 42, 1, 41, '#525A68');
    pxRect(ctx, lx - 6, lampBaseY - 52, 12, 11, '#262930');
    pxRect(ctx, lx - 4, lampBaseY - 50, 8, 7, lampPulse);
    pxRect(ctx, lx - 2, lampBaseY - 49, 4, 5, '#FFFBEB');
    pxRect(ctx, lx - 7, lampBaseY - 54, 14, 3, '#1F2228');
    pxRect(ctx, lx - 2, lampBaseY - 56, 4, 2, '#3B414D');
  }
}

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
