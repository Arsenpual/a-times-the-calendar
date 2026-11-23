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

export function drawWallSegmentTopBeam(
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

export function drawBedroomPictureWindow(
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

export function drawGardenTree(
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

export function drawGardenShrub(
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

