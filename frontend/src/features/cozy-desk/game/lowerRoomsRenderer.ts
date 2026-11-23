import type { PlayerState, TimeOfDay } from '../types/game';
import {
  BATH_DOOR_ROW_END,
  BATH_DOOR_ROW_START,
  CORE_OFFSET_X,
  DIVIDER_COL,
  FOYER_KITCHEN_DOOR_COL_END,
  FOYER_KITCHEN_DOOR_COL_START,
  KITCHEN_DINING_RECT,
  KITCHEN_DOOR_COL_END,
  KITCHEN_DOOR_COL_START,
  LOWER_FLOOR_ROW_END,
  LOWER_FLOOR_ROW_START,
  MID_WALL_ROW,
  SOUTH_WALL_ROW,
  TILE,
  WEST_DIVIDER_COL,
} from './houseMap';

export function isSoapInHolder(player?: PlayerState): boolean {
  if (!player || !player.isShowering || !player.showerPhase) {
    return true;
  }
  if (player.showerPhase === 'wetting' || player.showerPhase === 'rinse') {
    return true;
  }
  if (player.showerPhase === 'grab_soap') {
    return player.showerPhaseElapsed < 0.72;
  }
  if (player.showerPhase === 'return_soap') {
    return player.showerPhaseElapsed >= 0.75;
  }
  // 'scrub_soap' -> soap is in player's hand
  return false;
}

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

export function drawLowerRoomFloors(ctx: CanvasRenderingContext2D) {
  // 1. West Bathroom crisp porcelain ceramic tiles (cols 1..8, rows 14..21 — left of Kitchen, below Master Bedroom)
  for (let row = LOWER_FLOOR_ROW_START; row <= LOWER_FLOOR_ROW_END; row++) {
    for (let col = 1; col < WEST_DIVIDER_COL; col++) {
      const x = col * TILE;
      const y = row * TILE;
      const isAlt = (col + row) % 2 === 0;
      const grout = '#A4B5B3';
      const tileA = isAlt ? '#D2DDDD' : '#C8D6D6';
      const tileB = isAlt ? '#DAE5E5' : '#D0DCDC';

      pxRect(ctx, x, y, TILE, TILE, grout);
      pxRect(ctx, x + 1, y + 1, 14, 14, tileA);
      pxRect(ctx, x + 17, y + 1, 14, 14, tileB);
      pxRect(ctx, x + 1, y + 17, 14, 14, tileB);
      pxRect(ctx, x + 17, y + 17, 14, 14, tileA);
      pxRect(ctx, x + 2, y + 2, 10, 1, 'rgba(255,255,255,0.42)');
      pxRect(ctx, x + 18, y + 18, 10, 1, 'rgba(255,255,255,0.36)');
    }
  }

  // 2. Integrated Glass Shower Room Recessed Wet-Zone Aqua Mosaic Floor (NW corner: cols 1.02..4.48, rows 14.0..18.02)
  const shX = Math.round(1.02 * TILE);
  const shY = LOWER_FLOOR_ROW_START * TILE;
  const shW = Math.round(4.48 * TILE) - shX;
  const shH = Math.round(18.02 * TILE) - shY;
  pxRect(ctx, shX, shY, shW, shH, '#7E9FA6');
  const mSize = 8;
  for (let my = shY + 1; my < shY + shH - 2; my += mSize) {
    for (let mx = shX + 1; mx < shX + shW - 2; mx += mSize) {
      const idx = ((mx / mSize) | 0) + ((my / mSize) | 0);
      const col = idx % 3 === 0 ? '#9DC0C7' : idx % 3 === 1 ? '#92B6BE' : '#A6C8CF';
      pxRect(ctx, mx, my, mSize - 1, mSize - 1, col);
      pxRect(ctx, mx, my, mSize - 2, 1, 'rgba(255,255,255,0.22)');
    }
  }
  // Subtle recessed inner drop shadow along shower perimeter
  pxRect(ctx, shX, shY, shW, 3, 'rgba(32, 56, 64, 0.2)');
  pxRect(ctx, shX, shY, 3, shH, 'rgba(32, 56, 64, 0.16)');

  // Gleaming stainless steel square shower floor drain (center-west inside NW shower)
  const drainX = Math.round(2.55 * TILE);
  const drainY = Math.round(15.9 * TILE);
  pxRect(ctx, drainX - 7, drainY - 7, 14, 14, '#5D7075');
  pxRect(ctx, drainX - 6, drainY - 6, 12, 12, '#B6C5C9');
  pxRect(ctx, drainX - 4, drainY - 4, 8, 2, '#4A5A5E');
  pxRect(ctx, drainX - 4, drainY - 1, 8, 2, '#4A5A5E');
  pxRect(ctx, drainX - 4, drainY + 2, 8, 2, '#4A5A5E');

  // 3. Center Kitchen warm checkerboard ceramic tiles (cols 10..18, rows 14..21)
  for (let row = LOWER_FLOOR_ROW_START; row <= LOWER_FLOOR_ROW_END; row++) {
    for (let col = WEST_DIVIDER_COL + 1; col < DIVIDER_COL; col++) {
      const x = col * TILE;
      const y = row * TILE;
      const isAlt = (col + row) % 2 === 0;
      const base = isAlt ? '#DDD0BA' : '#CEC0A8';
      const inner = isAlt ? '#E4D8C4' : '#D5C7AF';
      const grout = '#B4A48B';

      pxRect(ctx, x, y, TILE, TILE, grout);
      pxRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, base);
      // 2x2 sub-tile ceramic grid for refined architectural scale
      pxRect(ctx, x + 1, y + 1, 14, 14, inner);
      pxRect(ctx, x + 17, y + 17, 14, 14, inner);
      pxRect(ctx, x + 15, y, 2, TILE, grout);
      pxRect(ctx, x, y + 15, TILE, 2, grout);
      // Crisp subtle top-left ceramic sheen
      pxRect(ctx, x + 2, y + 2, 11, 1, 'rgba(255, 250, 240, 0.35)');
      pxRect(ctx, x + 18, y + 18, 11, 1, 'rgba(255, 250, 240, 0.3)');
    }
  }

  // 4. Doorway floor thresholds
  // (a) Living Lounge <-> Kitchen open archway (cols 14..15, rows 12..13)
  const kDoorX = KITCHEN_DOOR_COL_START * TILE;
  const kDoorW = (KITCHEN_DOOR_COL_END - KITCHEN_DOOR_COL_START + 1) * TILE;
  const midY = MID_WALL_ROW * TILE;
  pxRect(ctx, kDoorX, midY, kDoorW, TILE, '#C29663');
  pxRect(ctx, kDoorX, midY + 15, kDoorW, 1, '#9F7446');
  pxRect(ctx, kDoorX, midY + 1, kDoorW, 1, '#D4AB7A');
  pxRect(ctx, kDoorX, midY + TILE, kDoorW, TILE, '#D8CBB4');
  pxRect(ctx, kDoorX, midY + TILE + 15, kDoorW, 2, '#B4A48B');
  pxRect(ctx, kDoorX + 31, midY + TILE, 2, TILE, '#B4A48B');
  // Oak doorway threshold beam across middle of passage
  pxRect(ctx, kDoorX, midY + 26, kDoorW, 12, '#7D5432');
  pxRect(ctx, kDoorX + 2, midY + 28, kDoorW - 4, 8, '#9A6B44');
  pxRect(ctx, kDoorX + 4, midY + 29, kDoorW - 8, 2, '#B38258');

  // (b) Bathroom (left) <-> Kitchen (right) vertical doorway threshold on col 9 (rows 16..17)
  const bDoorX = WEST_DIVIDER_COL * TILE;
  const bDoorY = BATH_DOOR_ROW_START * TILE;
  const bDoorH = (BATH_DOOR_ROW_END - BATH_DOOR_ROW_START + 1) * TILE;
  pxRect(ctx, bDoorX, bDoorY, 16, bDoorH, '#CDDADA'); // Bathroom porcelain half (west)
  pxRect(ctx, bDoorX + 16, bDoorY, 16, bDoorH, '#D8CBB4'); // Kitchen ceramic half (east)
  // Vertical timber frame + cream marble bathroom sill strip
  pxRect(ctx, bDoorX + 10, bDoorY, 12, bDoorH, '#6A472D');
  pxRect(ctx, bDoorX + 12, bDoorY + 2, 8, bDoorH - 4, '#E8E4DC');
  pxRect(ctx, bDoorX + 13, bDoorY + 4, 2, bDoorH - 8, '#FAF8F4');

  // 5. Cozy floor mats & flat floor props (non-colliding)
  // Kitchen woven terracotta runner mat in front of stove & prep area
  const krx = Math.round(2.65 * TILE + CORE_OFFSET_X);
  const kry = Math.round(15.35 * TILE);
  pxRect(ctx, krx, kry, 68, 22, '#A86245');
  pxRect(ctx, krx + 3, kry + 3, 62, 16, '#C98360');
  pxRect(ctx, krx + 7, kry + 6, 54, 10, '#E3C9AE');
  pxRect(ctx, krx + 11, kry + 9, 46, 4, '#C98360');

  // Small striped mat in front of kitchen sink
  const smx = Math.round(7.25 * TILE + CORE_OFFSET_X);
  const smy = Math.round(15.35 * TILE);
  pxRect(ctx, smx, smy, 50, 20, '#5E7F72');
  pxRect(ctx, smx + 3, smy + 3, 44, 14, '#799D8E');
  pxRect(ctx, smx + 6, smy + 6, 38, 8, '#DDE7E2');

  // Plush sage bath mat right outside the glass shower sliding door (east of NW shower)
  const bmx = Math.round(4.78 * TILE);
  const bmy = Math.round(16.35 * TILE);
  pxRect(ctx, bmx + 1, bmy + 1, 38, 46, 'rgba(30, 45, 48, 0.14)');
  pxRect(ctx, bmx, bmy, 38, 45, '#597D74');
  pxRect(ctx, bmx + 3, bmy + 3, 32, 39, '#739A90');
  pxRect(ctx, bmx + 6, bmy + 6, 26, 33, '#88AEA4');
  for (let sy = bmy + 9; sy < bmy + 36; sy += 5) {
    pxRect(ctx, bmx + 8, sy, 22, 1, '#6C9288');
  }

  // Soft cream bath mat in front of north-east family vanity sink
  const vmx = Math.round(5.95 * TILE);
  const vmy = Math.round(15.22 * TILE);
  pxRect(ctx, vmx, vmy, 64, 18, '#B8ACA0');
  pxRect(ctx, vmx + 3, vmy + 3, 58, 12, '#ECE5DA');
  pxRect(ctx, vmx + 6, vmy + 6, 52, 6, '#DFD5C7');

  // Minimal white digital bathroom scale resting neatly in dry zone
  const scx = Math.round(6.75 * TILE);
  const scy = Math.round(18.8 * TILE);
  pxRect(ctx, scx + 1, scy + 2, 22, 20, 'rgba(30, 45, 48, 0.14)');
  pxRect(ctx, scx, scy, 22, 20, '#8FA1A3');
  pxRect(ctx, scx + 2, scy + 2, 18, 16, '#F2F6F6');
  pxRect(ctx, scx + 6, scy + 4, 10, 4, '#3B4B50');
  pxRect(ctx, scx + 8, scy + 5, 6, 2, '#99E2D0');
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

export function drawLowerRoomWalls(
  ctx: CanvasRenderingContext2D,
  timeOfDay: TimeOfDay,
  tick: number,
  isShowerRunning = false
) {
  const midY = MID_WALL_ROW * TILE;
  const wallFaceY = midY + 18;
  const wallFaceH = 2 * TILE - 18; // 46px tall north interior wall face for middle rooms

  // 1. Horizontal dividing wall #1 top timber structural beam (rows 12..13)
  // Solid between Master Bedroom & Bathroom (cols 1..9) and Kitchen west (cols 10..13), open ONLY at Living <-> Kitchen (cols 14..15)
  drawWallSegmentTopBeam(ctx, TILE - 5, midY, (KITCHEN_DOOR_COL_START - 1) * TILE + 5, 18);
  drawWallSegmentTopBeam(
    ctx,
    (KITCHEN_DOOR_COL_END + 1) * TILE,
    midY,
    (DIVIDER_COL - KITCHEN_DOOR_COL_END - 1) * TILE + 5,
    18
  );

  // Door jamb trim posts flanking the Living <-> Kitchen archway
  pxRect(ctx, KITCHEN_DOOR_COL_START * TILE - 4, midY, 4, 2 * TILE, '#5B3E2B');
  pxRect(ctx, (KITCHEN_DOOR_COL_END + 1) * TILE, midY, 4, 2 * TILE, '#5B3E2B');

  // 2. West Bathroom Unbroken North Interior Wall (cols 1..8 — directly below Master Bedroom)
  const bathWallX = TILE;
  const bathWallW = (WEST_DIVIDER_COL - 1) * TILE; // 8 tiles
  pxRect(ctx, bathWallX, wallFaceY, bathWallW, 14, '#E6EFEF');
  pxRect(ctx, bathWallX, wallFaceY + 14, bathWallW, wallFaceH - 14, '#D6E4E4');
  for (let ty = wallFaceY + 14; ty < midY + 2 * TILE; ty += 8) {
    pxRect(ctx, bathWallX, ty, bathWallW, 1, '#B8CCCC');
    for (let tx = bathWallX; tx < bathWallX + bathWallW; tx += 12) {
      pxRect(ctx, tx, ty, 1, 8, '#B8CCCC');
    }
  }
  pxRect(ctx, bathWallX, wallFaceY + 13, bathWallW, 2, '#9BB5B5');
  pxRect(ctx, bathWallX, midY + 2 * TILE - 2, bathWallW, 2, '#7D9999');

  // (a) Chrome Rain Shower Head, Vertical Riser Pipe, Handheld Wand & Mixer (NW shower: cols 1.9..2.9)
  const shPipeX = Math.round(2.3 * TILE);
  pxRect(ctx, shPipeX, wallFaceY + 5, 3, 32, '#8F9EA3');
  pxRect(ctx, shPipeX + 1, wallFaceY + 5, 1, 32, '#E2ECEF');
  pxRect(ctx, shPipeX - 6, wallFaceY + 4, 15, 3, '#9BAAB0');
  pxRect(ctx, shPipeX - 8, wallFaceY + 7, 19, 5, '#77878C');
  pxRect(ctx, shPipeX - 7, wallFaceY + 8, 17, 3, '#CFDCE0');
  if (isShowerRunning) {
    const streamShift = tick % 5;
    for (let sx = shPipeX - 6; sx <= shPipeX + 8; sx += 3) {
      pxRect(ctx, sx, wallFaceY + 12, 1, 2, '#E0F7FF');
      for (let sy = wallFaceY + 14 + ((sx + streamShift) % 4); sy < wallFaceY + 42; sy += 6) {
        pxRect(ctx, sx, sy, 1, 4, 'rgba(186, 238, 255, 0.85)');
      }
    }
  } else if (Math.floor(tick / 18) % 2 === 0) {
    pxRect(ctx, shPipeX - 3, wallFaceY + 13, 2, 2, 'rgba(220, 248, 255, 0.7)');
    pxRect(ctx, shPipeX + 4, wallFaceY + 14, 2, 2, 'rgba(220, 248, 255, 0.6)');
  }
  pxRect(ctx, shPipeX - 7, wallFaceY + 32, 17, 5, '#77878C');
  pxRect(ctx, shPipeX - 6, wallFaceY + 33, 15, 3, '#D5E1E5');
  pxRect(
    ctx,
    shPipeX - 1,
    wallFaceY + 34,
    3,
    2,
    isShowerRunning ? '#38BDF8' : '#64748B'
  );
  // Handheld wand mounted beside mixer
  pxRect(ctx, shPipeX + 9, wallFaceY + 31, 4, 2, '#5F6E73');
  pxRect(ctx, shPipeX + 11, wallFaceY + 20, 4, 10, '#CFDCE0');
  pxRect(ctx, shPipeX + 10, wallFaceY + 18, 6, 3, '#8F9EA3');
  pxRect(ctx, shPipeX + 12, wallFaceY + 30, 1, 8, '#8F9EA3');
  pxRect(ctx, shPipeX + 7, wallFaceY + 37, 6, 1, '#8F9EA3');

  // (b) Frosted Bathroom Ventilation Window inside shower wall (cols 3.05..4.2)
  const fwX = Math.round(3.05 * TILE);
  const fwY = wallFaceY + 5;
  const fwW = 36;
  const fwH = 22;
  const frostTint =
    timeOfDay === 'morning' ? '#CBEAF2' : timeOfDay === 'afternoon' ? '#F3DEC0' : '#4C5F75';
  pxRect(ctx, fwX, fwY, fwW, fwH, '#6F8084');
  pxRect(ctx, fwX + 2, fwY + 2, fwW - 4, fwH - 4, frostTint);
  for (let sy = fwY + 5; sy < fwY + fwH - 2; sy += 4) {
    pxRect(ctx, fwX + 2, sy, fwW - 4, 1, 'rgba(255,255,255,0.5)');
  }
  pxRect(ctx, fwX + fwW / 2 - 1, fwY + 2, 2, fwH - 4, '#7B8D91');

  // (c) Large Illuminated Family Vanity Mirror & Warm Brass Wall Sconces (NE: cols 5.72..8.22)
  const mirX = Math.round(5.72 * TILE);
  const mirY = wallFaceY + 4;
  const mirW = 80;
  const mirH = 30;
  pxRect(ctx, mirX - 8, mirY + 8, 5, 10, '#C8A872');
  pxRect(ctx, mirX - 7, mirY + 6, 3, 6, '#FFF5CC');
  pxRect(ctx, mirX + mirW + 3, mirY + 8, 5, 10, '#C8A872');
  pxRect(ctx, mirX + mirW + 4, mirY + 6, 3, 6, '#FFF5CC');
  pxRect(ctx, mirX, mirY, mirW, mirH, '#5E4432');
  pxRect(ctx, mirX + 2, mirY + 2, mirW - 4, mirH - 4, '#C5E1E8');
  pxRect(ctx, mirX + 3, mirY + 3, mirW - 6, mirH - 6, '#D9EEF3');
  pxRect(ctx, mirX + 10, mirY + 5, 5, 19, 'rgba(255,255,255,0.65)');
  pxRect(ctx, mirX + 19, mirY + 7, 3, 14, 'rgba(255,255,255,0.45)');
  pxRect(ctx, mirX + 54, mirY + 6, 4, 15, 'rgba(255,255,255,0.42)');
  pxRect(ctx, mirX + 61, mirY + 8, 2, 11, 'rgba(255,255,255,0.32)');
  pxRect(ctx, mirX + 4, mirY + mirH + 1, mirW - 8, 3, '#A7C3C9');

  // 3. Center Kitchen North Interior Wall (cols 10..13 & cols 16..18)
  const kitchenWallSegments = [
    {
      x: (WEST_DIVIDER_COL + 1) * TILE,
      w: (KITCHEN_DOOR_COL_START - WEST_DIVIDER_COL - 1) * TILE,
    },
    {
      x: (KITCHEN_DOOR_COL_END + 1) * TILE,
      w: (DIVIDER_COL - KITCHEN_DOOR_COL_END - 1) * TILE,
    },
  ];

  for (const seg of kitchenWallSegments) {
    pxRect(ctx, seg.x, wallFaceY, seg.w, 22, '#EFE6D5');
    pxRect(ctx, seg.x, wallFaceY + 22, seg.w, wallFaceH - 22, '#F4F0E6');
    for (let ty = wallFaceY + 22; ty < midY + 2 * TILE; ty += 6) {
      pxRect(ctx, seg.x, ty, seg.w, 1, '#D8D0C2');
      const offset = ((ty - wallFaceY) / 6) % 2 === 0 ? 0 : 6;
      for (let tx = seg.x + offset; tx < seg.x + seg.w; tx += 12) {
        pxRect(ctx, tx, ty, 1, 6, '#D8D0C2');
      }
    }
    pxRect(ctx, seg.x, midY + 2 * TILE - 2, seg.w, 2, '#7A5438');
  }

  // Kitchen Wall Fixtures (shifted +CORE_OFFSET_X into Center Core cols 10..18):
  // (a) Upper oak wall cabinet over left prep counter
  const lCabX = Math.round(2.45 * TILE + CORE_OFFSET_X);
  pxRect(ctx, lCabX, wallFaceY + 2, 22, 22, '#5E3D26');
  pxRect(ctx, lCabX + 2, wallFaceY + 4, 18, 18, '#8B5E3C');
  pxRect(ctx, lCabX + 4, wallFaceY + 6, 14, 14, '#7C5233');
  pxRect(ctx, lCabX + 15, wallFaceY + 12, 2, 4, '#E8C57B');

  // (b) Stainless Steel Range Hood above 4-burner stove
  const hoodX = Math.round(3.22 * TILE + CORE_OFFSET_X);
  pxRect(ctx, hoodX + 12, wallFaceY, 24, 12, '#8F99A0');
  pxRect(ctx, hoodX + 15, wallFaceY, 6, 12, '#B6C0C7');
  pxRect(ctx, hoodX, wallFaceY + 11, 48, 12, '#737E86');
  pxRect(ctx, hoodX + 2, wallFaceY + 13, 44, 6, '#AEB8BF');
  pxRect(ctx, hoodX + 2, wallFaceY + 19, 44, 3, '#535D64');
  pxRect(ctx, hoodX + 8, wallFaceY + 22, 32, 2, '#FFF3BE');

  // Hanging utensil bar & colorful spice jars on left kitchen backsplash
  pxRect(ctx, Math.round(2.55 * TILE + CORE_OFFSET_X), wallFaceY + 28, 20, 2, '#6E7378');
  pxRect(ctx, Math.round(2.65 * TILE + CORE_OFFSET_X), wallFaceY + 30, 3, 8, '#B88952');
  pxRect(ctx, Math.round(2.85 * TILE + CORE_OFFSET_X), wallFaceY + 30, 3, 7, '#94A3B8');
  pxRect(ctx, Math.round(3.02 * TILE + CORE_OFFSET_X), wallFaceY + 30, 3, 8, '#D97736');

  // (c) Wide double-door upper oak dish cabinets above sink & microwave
  const rCabX = Math.round(7.15 * TILE + CORE_OFFSET_X);
  const rCabW = Math.round(2.68 * TILE);
  pxRect(ctx, rCabX, wallFaceY + 2, rCabW, 22, '#5E3D26');
  const doorW = Math.floor((rCabW - 8) / 3);
  for (let i = 0; i < 3; i++) {
    const dx = rCabX + 2 + i * (doorW + 2);
    pxRect(ctx, dx, wallFaceY + 4, doorW, 18, '#8B5E3C');
    pxRect(ctx, dx + 2, wallFaceY + 6, doorW - 4, 14, '#7D5334');
    pxRect(ctx, dx + doorW - 5, wallFaceY + 13, 2, 4, '#E8C57B');
  }
  pxRect(ctx, rCabX + 8, wallFaceY + 29, 34, 3, '#6F492D');
  pxRect(ctx, rCabX + 11, wallFaceY + 24, 5, 5, '#D96B43');
  pxRect(ctx, rCabX + 18, wallFaceY + 24, 5, 5, '#5E9C74');
  pxRect(ctx, rCabX + 25, wallFaceY + 24, 5, 5, '#E9C46A');
  pxRect(ctx, rCabX + 32, wallFaceY + 24, 5, 5, '#FAF6F0');

  // 4. Middle Vertical Dividing Wall (col 9, rows 12..22) with Bathroom <-> Kitchen doorway at rows 16..17
  const dx = WEST_DIVIDER_COL * TILE;
  const upperDoorY = BATH_DOOR_ROW_START * TILE;
  pxRect(ctx, dx, midY, TILE, upperDoorY - midY, '#4B3224');
  pxRect(ctx, dx + 3, midY + 4, TILE - 6, upperDoorY - midY - 10, '#6E4A33');
  pxRect(ctx, dx + 4, upperDoorY - 8, TILE - 8, 8, '#8D6042');
  const lowerDoorY = (BATH_DOOR_ROW_END + 1) * TILE;
  const lowerSegH = SOUTH_WALL_ROW * TILE - lowerDoorY;
  pxRect(ctx, dx, lowerDoorY, TILE, lowerSegH, '#4B3224');
  pxRect(ctx, dx + 3, lowerDoorY + 4, TILE - 6, lowerSegH - 4, '#6E4A33');
  pxRect(ctx, dx + 4, lowerDoorY, TILE - 8, 4, '#8D6042');

  // South wall baseboard trim along Bathroom (cols 1..9) & Kitchen (cols 10..18, leaving Kitchen <-> Entryway archway cols 12..13 open)
  pxRect(
    ctx,
    TILE - 5,
    SOUTH_WALL_ROW * TILE,
    (FOYER_KITCHEN_DOOR_COL_START - 1) * TILE + 5,
    6,
    '#5B3E2B'
  );
  pxRect(
    ctx,
    (FOYER_KITCHEN_DOOR_COL_END + 1) * TILE,
    SOUTH_WALL_ROW * TILE,
    (DIVIDER_COL - FOYER_KITCHEN_DOOR_COL_END - 1) * TILE + 5,
    6,
    '#5B3E2B'
  );
}

export function drawKitchenFurniture(ctx: CanvasRenderingContext2D, tick: number) {
  // 1. Double-door Retro-Modern Refrigerator (cols 10.12..11.5, rows 13.75..15.2)
  const fx = Math.round(1.12 * TILE + CORE_OFFSET_X);
  const fy = Math.round(13.15 * TILE);
  const fw = Math.round(1.38 * TILE);
  const fh = Math.round(2.05 * TILE);
  pxRect(ctx, fx + 2, fy + fh - 1, fw - 2, 6, 'rgba(28, 20, 15, 0.25)');
  pxRect(ctx, fx, fy, fw, fh, '#8E8B82');
  pxRect(ctx, fx + 2, fy + 2, fw - 4, fh - 4, '#E8E3D5');
  pxRect(ctx, fx + 3, fy + 3, fw - 6, 6, '#F6F2E8');
  pxRect(ctx, fx + 2, fy + 27, fw - 4, 2, '#9A958B');
  pxRect(ctx, fx + 3, fy + 29, fw - 6, fh - 32, '#DFD9C9');
  pxRect(ctx, fx + fw - 8, fy + 11, 3, 13, '#6F777E');
  pxRect(ctx, fx + fw - 7, fy + 12, 1, 11, '#E2E8F0');
  pxRect(ctx, fx + fw - 8, fy + 33, 3, 18, '#6F777E');
  pxRect(ctx, fx + fw - 7, fy + 34, 1, 16, '#E2E8F0');
  pxRect(ctx, fx + 7, fy + 34, 10, 11, '#FEF08A');
  pxRect(ctx, fx + 11, fy + 34, 2, 2, '#DC2626');
  pxRect(ctx, fx + 9, fy + 38, 6, 1, '#92400E');
  pxRect(ctx, fx + 9, fy + 41, 5, 1, '#92400E');
  pxRect(ctx, fx + 21, fy + 36, 4, 4, '#5E9C74');
  pxRect(ctx, fx + 8, fy + 14, 5, 5, '#E07A5F');

  // 2. North-Left Counter + 4-Burner Stove & Oven (cols 11.55..13.9, rows 13.9..15.15)
  const sx = Math.round(2.55 * TILE + CORE_OFFSET_X);
  const sy = Math.round(13.9 * TILE);
  const sw = Math.round(2.35 * TILE);
  const sh = Math.round(1.25 * TILE);
  pxRect(ctx, sx + 2, sy + sh - 1, sw - 4, 5, 'rgba(28, 20, 15, 0.24)');
  pxRect(ctx, sx, sy, sw, sh, '#5B3A23');
  pxRect(ctx, sx + 2, sy + 2, 22, sh - 10, '#C79F70');
  pxRect(ctx, sx + 3, sy + 3, 20, 2, '#DCBA90');
  pxRect(ctx, sx + 3, sy + sh - 8, 19, 6, '#7E5436');
  pxRect(ctx, sx + 10, sy + sh - 6, 5, 2, '#E8C57B');

  const stx = sx + 24;
  const stw = sw - 26;
  pxRect(ctx, stx, sy + 1, stw, sh - 2, '#4A4E54');
  pxRect(ctx, stx + 2, sy + 3, stw - 4, sh - 12, '#2B2E33');
  const burners = [
    { bx: stx + 7, by: sy + 6 },
    { bx: stx + 27, by: sy + 6 },
    { bx: stx + 7, by: sy + 18 },
    { bx: stx + 27, by: sy + 18 },
  ];
  for (const b of burners) {
    pxRect(ctx, b.bx, b.by, 12, 9, '#1A1C1F');
    pxRect(ctx, b.bx + 2, b.by + 2, 8, 5, '#464B52');
    pxRect(ctx, b.bx + 4, b.by + 3, 4, 3, '#25282C');
  }
  pxRect(ctx, stx + 5, sy + 4, 15, 11, '#A65532');
  pxRect(ctx, stx + 7, sy + 6, 11, 7, '#C97248');
  pxRect(ctx, stx + 10, sy + 8, 5, 3, '#E8A57B');
  const potSteam = Math.floor(tick / 14) % 4;
  pxRect(ctx, stx + 11 + (potSteam % 2), sy - 1 - potSteam, 2, 3, 'rgba(255,250,240,0.65)');
  pxRect(ctx, stx + 14 - (potSteam % 2), sy - 4 - ((potSteam + 2) % 4), 2, 2, 'rgba(255,250,240,0.45)');

  pxRect(ctx, stx + 26, sy + 16, 13, 10, '#1D1F22');
  pxRect(ctx, stx + 28, sy + 18, 9, 6, '#383C42');
  pxRect(ctx, stx + 38, sy + 20, 7, 2, '#26292E');
  pxRect(ctx, stx + 2, sy + sh - 8, stw - 4, 6, '#B8C0C7');
  pxRect(ctx, stx + 5, sy + sh - 6, 3, 2, '#2B2E33');
  pxRect(ctx, stx + 10, sy + sh - 6, 3, 2, '#2B2E33');
  pxRect(ctx, stx + 16, sy + sh - 6, 22, 2, '#4A5158');
  pxRect(ctx, stx + 41, sy + sh - 6, 3, 2, '#D97736');

  // 3. North-Right Counter: Kitchen Sink, Dish Drying Rack & Microwave (cols 16.1..18.95, rows 13.9..15.15)
  const kx = Math.round(7.1 * TILE + CORE_OFFSET_X);
  const ky = Math.round(13.9 * TILE);
  const kw = Math.round(2.85 * TILE);
  const kh = Math.round(1.25 * TILE);
  pxRect(ctx, kx + 2, ky + kh - 1, kw - 4, 5, 'rgba(28, 20, 15, 0.24)');
  pxRect(ctx, kx, ky, kw, kh, '#5B3A23');
  pxRect(ctx, kx + 2, ky + 2, kw - 4, kh - 10, '#E8E0D1');
  pxRect(ctx, kx + 3, ky + 3, kw - 6, 2, '#F7F3EA');
  pxRect(ctx, kx + 3, ky + kh - 8, 26, 6, '#7E5436');
  pxRect(ctx, kx + 32, ky + kh - 8, 26, 6, '#7E5436');
  pxRect(ctx, kx + 61, ky + kh - 8, 26, 6, '#7E5436');
  pxRect(ctx, kx + 14, ky + kh - 6, 4, 2, '#E8C57B');
  pxRect(ctx, kx + 43, ky + kh - 6, 4, 2, '#E8C57B');
  pxRect(ctx, kx + 72, ky + kh - 6, 4, 2, '#E8C57B');

  pxRect(ctx, kx + 6, ky + 6, 28, 20, '#7F8C93');
  pxRect(ctx, kx + 8, ky + 8, 24, 16, '#A9B6BD');
  pxRect(ctx, kx + 10, ky + 10, 20, 12, '#8F9EA6');
  pxRect(ctx, kx + 18, ky + 15, 4, 4, '#4E5A60');
  pxRect(ctx, kx + 18, ky + 2, 4, 8, '#D5DFE4');
  pxRect(ctx, kx + 19, ky + 3, 2, 6, '#FAFDFE');
  pxRect(ctx, kx + 28, ky + 3, 4, 4, '#5E9C74');
  pxRect(ctx, kx + 10, ky + 4, 5, 3, '#F6CF71');

  pxRect(ctx, kx + 38, ky + 6, 18, 20, '#8E9AA0');
  pxRect(ctx, kx + 40, ky + 8, 14, 16, '#CFD7DC');
  pxRect(ctx, kx + 42, ky + 10, 2, 12, '#FAF6F0');
  pxRect(ctx, kx + 46, ky + 10, 2, 12, '#FAF6F0');
  pxRect(ctx, kx + 50, ky + 10, 2, 12, '#FAF6F0');

  pxRect(ctx, kx + 59, ky + 5, 28, 21, '#3D4247');
  pxRect(ctx, kx + 61, ky + 7, 17, 15, '#1D2226');
  pxRect(ctx, kx + 63, ky + 9, 5, 3, 'rgba(186, 230, 253, 0.25)');
  pxRect(ctx, kx + 80, ky + 8, 5, 4, '#22C55E');
  pxRect(ctx, kx + 80, ky + 14, 5, 7, '#64748B');

  // 4. East Wall L-Prep Counter (cols 17.75..18.9, rows 15.2..18.55 — keeps West Bathroom doorway wide open!)
  const ex = Math.round(8.75 * TILE + CORE_OFFSET_X);
  const ey = Math.round(15.2 * TILE);
  const ew = Math.round(1.15 * TILE);
  const eh = Math.round(3.35 * TILE);
  pxRect(ctx, ex + 2, ey + eh - 1, ew - 2, 5, 'rgba(28, 20, 15, 0.24)');
  pxRect(ctx, ex, ey, ew, eh, '#5B3A23');
  pxRect(ctx, ex + 4, ey + 2, ew - 6, eh - 6, '#E8E0D1');
  pxRect(ctx, ex + 1, ey + 2, 3, eh - 4, '#7E5436'); // West-facing cabinet front bevel
  pxRect(ctx, ex + 5, ey + 3, 2, eh - 8, '#F7F3EA');

  // Electric Rice Cooker (top of east counter)
  pxRect(ctx, ex + 10, ey + 8, 20, 19, '#FAF6F0');
  pxRect(ctx, ex + 12, ey + 10, 16, 13, '#E2DDD5');
  pxRect(ctx, ex + 15, ey + 13, 10, 7, '#CFD5DB');
  pxRect(ctx, ex + 11, ey + 16, 3, 3, '#F59E0B');

  // Wooden Cutting Board + Knife + Fresh Tomatoes & Herbs
  pxRect(ctx, ex + 9, ey + 35, 22, 26, '#B88452');
  pxRect(ctx, ex + 11, ey + 37, 18, 22, '#CFA06E');
  pxRect(ctx, ex + 13, ey + 40, 5, 5, '#DC4C3E');
  pxRect(ctx, ex + 20, ey + 42, 6, 4, '#4D8461');
  pxRect(ctx, ex + 13, ey + 50, 12, 3, '#CBD5E1');
  pxRect(ctx, ex + 24, ey + 50, 5, 3, '#3B281E');

  // Two-Slice Toaster & Ceramic Fruit Bowl
  pxRect(ctx, ex + 11, ey + 68, 17, 13, '#9BA5AD');
  pxRect(ctx, ex + 13, ey + 70, 13, 2, '#2B2E33');
  pxRect(ctx, ex + 13, ey + 74, 13, 2, '#2B2E33');
  pxRect(ctx, ex + 9, ey + 73, 2, 4, '#3B281E');
  pxRect(ctx, ex + 10, ey + 86, 18, 15, '#D8C7B0');
  pxRect(ctx, ex + 12, ey + 88, 14, 11, '#EFE7DA');
  pxRect(ctx, ex + 13, ey + 90, 5, 5, '#D9483B');
  pxRect(ctx, ex + 19, ey + 89, 5, 5, '#F4A236');
  pxRect(ctx, ex + 16, ey + 94, 5, 4, '#84B852');

  // 5. South-West Kitchen Pantry Cupboard (cols 10.15..11.7, rows 19.85..21.8)
  const px = Math.round(1.15 * TILE + CORE_OFFSET_X);
  const py = Math.round(19.85 * TILE);
  const pw = Math.round(1.55 * TILE);
  const ph = Math.round(1.95 * TILE);
  pxRect(ctx, px + 2, py + ph - 1, pw - 4, 5, 'rgba(28, 20, 15, 0.25)');
  pxRect(ctx, px, py, pw, ph, '#5B3A23');
  pxRect(ctx, px + 3, py + 3, pw - 6, ph - 6, '#875A38');
  pxRect(ctx, px + 4, py + 4, pw - 8, 3, '#A4714A');
  pxRect(ctx, px + 5, py + 9, pw - 10, 18, '#4A2F1C');
  pxRect(ctx, px + 7, py + 12, 7, 12, '#E9C46A');
  pxRect(ctx, px + 16, py + 14, 7, 10, '#FAF6F0');
  pxRect(ctx, px + 25, py + 13, 6, 11, '#B85D3B');
  pxRect(ctx, px + 33, py + 15, 7, 9, '#6B9080');
  pxRect(ctx, px + 5, py + 31, 18, ph - 36, '#744B2E');
  pxRect(ctx, px + 26, py + 31, 18, ph - 36, '#744B2E');
  pxRect(ctx, px + 20, py + 41, 2, 5, '#E8C57B');
  pxRect(ctx, px + 28, py + 41, 2, 5, '#E8C57B');

  // 6. Stainless Step Pedal Kitchen Trash Bin (SE corner: cols 18.05..18.77, rows 20.65..21.6)
  const bx = Math.round(9.05 * TILE + CORE_OFFSET_X);
  const by = Math.round(20.65 * TILE);
  pxRect(ctx, bx + 2, by + 26, 20, 5, 'rgba(28, 20, 15, 0.24)');
  pxRect(ctx, bx + 2, by + 2, 19, 25, '#68737A');
  pxRect(ctx, bx + 4, by + 4, 15, 21, '#9BA6AE');
  pxRect(ctx, bx + 4, by + 4, 15, 7, '#CFD7DD');
  pxRect(ctx, bx + 6, by + 2, 11, 2, '#535D63');
  pxRect(ctx, bx + 8, by + 25, 7, 3, '#2E3236');
}

export function drawDiningChair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: 'south' | 'north'
) {
  pxRect(ctx, x + 2, y + 18, 20, 4, 'rgba(28, 20, 15, 0.2)');
  pxRect(ctx, x + 2, y + 4, 20, 14, '#7E5333');
  pxRect(ctx, x + 4, y + 6, 16, 10, '#C7B49B');
  if (facing === 'south') {
    pxRect(ctx, x + 1, y, 22, 6, '#5A3820');
    pxRect(ctx, x + 3, y + 1, 18, 3, '#8D5F3D');
  } else {
    pxRect(ctx, x + 1, y + 14, 22, 6, '#5A3820');
    pxRect(ctx, x + 3, y + 15, 18, 3, '#8D5F3D');
  }
}

export function drawKitchenDiningNorthChairs(ctx: CanvasRenderingContext2D) {
  const tx = Math.round(KITCHEN_DINING_RECT.x);
  const ty = Math.round(KITCHEN_DINING_RECT.y);
  const tw = Math.round(KITCHEN_DINING_RECT.w);
  drawDiningChair(ctx, tx + 13, ty - 11, 'south');
  drawDiningChair(ctx, tx + tw - 37, ty - 11, 'south');
}

export function drawKitchenDiningSouthChairSeatPads(ctx: CanvasRenderingContext2D) {
  const tx = Math.round(KITCHEN_DINING_RECT.x);
  const ty = Math.round(KITCHEN_DINING_RECT.y);
  const tw = Math.round(KITCHEN_DINING_RECT.w);
  const th = Math.round(KITCHEN_DINING_RECT.h);
  for (const cx of [tx + 13, tx + tw - 37]) {
    const cy = ty + th - 9;
    pxRect(ctx, cx + 2, cy + 18, 20, 4, 'rgba(28, 20, 15, 0.2)');
    pxRect(ctx, cx + 2, cy + 4, 20, 14, '#7E5333');
    pxRect(ctx, cx + 4, cy + 6, 16, 10, '#C7B49B');
  }
}

export function drawKitchenDiningSouthChairBackrests(ctx: CanvasRenderingContext2D) {
  const tx = Math.round(KITCHEN_DINING_RECT.x);
  const ty = Math.round(KITCHEN_DINING_RECT.y);
  const tw = Math.round(KITCHEN_DINING_RECT.w);
  const th = Math.round(KITCHEN_DINING_RECT.h);
  for (const cx of [tx + 13, tx + tw - 37]) {
    const cy = ty + th - 9;
    pxRect(ctx, cx + 1, cy + 14, 22, 6, '#5A3820');
    pxRect(ctx, cx + 3, cy + 15, 18, 3, '#8D5F3D');
  }
}

export function drawKitchenDiningTable(ctx: CanvasRenderingContext2D, tick = 0) {
  const tx = Math.round(KITCHEN_DINING_RECT.x);
  const ty = Math.round(KITCHEN_DINING_RECT.y);
  const tw = Math.round(KITCHEN_DINING_RECT.w);
  const th = Math.round(KITCHEN_DINING_RECT.h);

  pxRect(ctx, tx + 3, ty + th - 2, tw - 6, 7, 'rgba(28, 20, 15, 0.25)');
  pxRect(ctx, tx + 5, ty + th - 6, 6, 9, '#4D2F1B');
  pxRect(ctx, tx + tw - 11, ty + th - 6, 6, 9, '#4D2F1B');

  pxRect(ctx, tx, ty, tw, th - 4, '#5B3922');
  pxRect(ctx, tx + 3, ty + 3, tw - 6, th - 11, '#9A6942');
  pxRect(ctx, tx + 4, ty + 4, tw - 8, 3, '#B58056');
  pxRect(ctx, tx + 3, ty + th - 8, tw - 6, 4, '#6E462A');

  // Festive Christmas table runner
  pxRect(ctx, tx + 4, ty + 18, tw - 8, 20, '#E8C57B');
  pxRect(ctx, tx + 4, ty + 20, tw - 8, 16, '#9B2C2C');
  pxRect(ctx, tx + 4, ty + 23, tw - 8, 10, '#B91C1C');
  pxRect(ctx, tx + 4, ty + 27, tw - 8, 2, '#2D6A4F');

  // 4 Family ceramic place settings
  const plates = [
    { px: tx + 16, py: ty + 6 },
    { px: tx + tw - 28, py: ty + 6 },
    { px: tx + 16, py: ty + th - 21 },
    { px: tx + tw - 28, py: ty + th - 21 },
  ];
  for (const p of plates) {
    pxRect(ctx, p.px, p.py, 12, 9, '#FAF6F0');
    pxRect(ctx, p.px + 2, p.py + 2, 8, 5, '#ECE4D8');
    pxRect(ctx, p.px - 3, p.py + 2, 2, 5, '#CBD5E1');
    pxRect(ctx, p.px + 13, p.py + 2, 3, 5, '#B91C1C');
    pxRect(ctx, p.px + 14, p.py + 4, 1, 1, '#2D6A4F');
  }

  // Grand Christmas Roast Turkey Centerpiece
  const cx = tx + Math.floor(tw / 2);
  const cy = ty + Math.floor(th / 2) - 2;

  pxRect(ctx, cx - 17, cy - 8, 34, 17, 'rgba(35, 22, 14, 0.28)');
  pxRect(ctx, cx - 16, cy - 9, 32, 17, '#CBD5E1');
  pxRect(ctx, cx - 14, cy - 10, 28, 19, '#E2E8F0');
  pxRect(ctx, cx - 13, cy - 8, 26, 15, '#F8FAFC');

  const herbs = [
    { hx: cx - 13, hy: cy - 4 },
    { hx: cx - 12, hy: cy + 3 },
    { hx: cx - 7, hy: cy + 5 },
    { hx: cx + 4, hy: cy + 5 },
    { hx: cx + 10, hy: cy + 2 },
    { hx: cx + 10, hy: cy - 5 },
    { hx: cx - 8, hy: cy - 8 },
    { hx: cx + 5, hy: cy - 8 },
  ];
  for (const h of herbs) {
    pxRect(ctx, h.hx, h.hy, 4, 3, '#2D6A4F');
    pxRect(ctx, h.hx + 1, h.hy + 1, 2, 1, '#52B788');
  }
  pxRect(ctx, cx - 11, cy + 1, 2, 2, '#DC2626');
  pxRect(ctx, cx - 4, cy + 6, 2, 2, '#DC2626');
  pxRect(ctx, cx + 8, cy + 4, 2, 2, '#DC2626');
  pxRect(ctx, cx + 11, cy - 2, 2, 2, '#DC2626');
  pxRect(ctx, cx - 10, cy - 6, 3, 2, '#FACC15');
  pxRect(ctx, cx + 7, cy + 5, 3, 2, '#F59E0B');

  pxRect(ctx, cx - 10, cy - 7, 19, 13, '#7C3F19');
  pxRect(ctx, cx - 9, cy - 8, 17, 13, '#9A5223');
  pxRect(ctx, cx - 8, cy - 7, 15, 11, '#B8682E');
  pxRect(ctx, cx - 6, cy - 6, 11, 8, '#D4833B');
  pxRect(ctx, cx - 4, cy - 5, 7, 3, '#EBA254');
  pxRect(ctx, cx - 2, cy - 4, 4, 1, '#FDE68A');

  pxRect(ctx, cx - 7, cy - 8, 8, 2, '#8C471D');
  pxRect(ctx, cx - 6, cy + 3, 8, 3, '#8C471D');
  pxRect(ctx, cx - 5, cy + 3, 6, 2, '#AD5F29');

  pxRect(ctx, cx + 5, cy - 6, 7, 4, '#8C471D');
  pxRect(ctx, cx + 5, cy - 5, 6, 2, '#B8682E');
  pxRect(ctx, cx + 11, cy - 6, 3, 3, '#FAF6F0');
  pxRect(ctx, cx + 13, cy - 5, 2, 2, '#E2E8F0');

  pxRect(ctx, cx + 5, cy, 7, 5, '#8C471D');
  pxRect(ctx, cx + 5, cy + 1, 6, 3, '#C27133');
  pxRect(ctx, cx + 11, cy + 1, 3, 3, '#FAF6F0');
  pxRect(ctx, cx + 13, cy + 2, 2, 2, '#E2E8F0');

  pxRect(ctx, tx + 6, cy - 2, 5, 6, '#FAF6F0');
  pxRect(ctx, tx + 5, cy + 3, 7, 2, '#E8C57B');
  pxRect(ctx, tx + 8, cy - 5, 2, 3, Math.floor(tick / 9) % 2 === 0 ? '#FACC15' : '#FB923C');
  pxRect(ctx, tx + tw - 13, cy - 1, 7, 6, '#FAF6F0');
  pxRect(ctx, tx + tw - 12, cy, 5, 3, '#991B1B');

  const steamPhase = Math.floor(tick / 12) % 4;
  pxRect(ctx, cx - 4 + (steamPhase % 2), cy - 12 - steamPhase, 2, 3, 'rgba(255, 250, 240, 0.72)');
  pxRect(ctx, cx + 2 - (steamPhase % 2), cy - 14 - ((steamPhase + 2) % 4), 2, 3, 'rgba(255, 250, 240, 0.58)');
  pxRect(ctx, cx + 7, cy - 11 - ((steamPhase + 1) % 3), 2, 2, 'rgba(255, 250, 240, 0.48)');
}

export function drawBathroomFurniture(
  ctx: CanvasRenderingContext2D,
  tick: number,
  player?: PlayerState
) {
  // 1. Wide Family Vanity Sink Cabinet (NE of West Bathroom: cols 5.3..8.65, rows 13.85..15.1)
  const vx = Math.round(5.3 * TILE);
  const vy = Math.round(13.85 * TILE);
  const vw = Math.round(3.35 * TILE);
  const vh = Math.round(1.25 * TILE);
  pxRect(ctx, vx + 2, vy + vh - 1, vw - 4, 5, 'rgba(30, 45, 48, 0.22)');
  pxRect(ctx, vx, vy, vw, vh, '#5C3D28');
  pxRect(ctx, vx + 2, vy + 2, vw - 4, vh - 11, '#EFECE6');
  pxRect(ctx, vx + 3, vy + 3, vw - 6, 2, '#FFFFFF');
  pxRect(ctx, vx + 3, vy + vh - 9, 31, 7, '#875D3E');
  pxRect(ctx, vx + 37, vy + vh - 9, 33, 7, '#875D3E');
  pxRect(ctx, vx + 73, vy + vh - 9, 31, 7, '#875D3E');
  pxRect(ctx, vx + 16, vy + vh - 7, 5, 2, '#E8C57B');
  pxRect(ctx, vx + 51, vy + vh - 7, 5, 2, '#E8C57B');
  pxRect(ctx, vx + 86, vy + vh - 7, 5, 2, '#E8C57B');

  pxRect(ctx, vx + 7, vy + 10, 10, 10, '#C97B56');
  pxRect(ctx, vx + 6, vy + 5, 12, 7, '#4D8461');
  pxRect(ctx, vx + 8, vy + 3, 8, 4, '#6AA67F');
  pxRect(ctx, vx + 21, vy + 11, 10, 11, '#FAF6F0');
  pxRect(ctx, vx + 22, vy + 15, 8, 2, '#D8CEBF');

  pxRect(ctx, vx + 37, vy + 7, 34, 18, '#B8C6CA');
  pxRect(ctx, vx + 39, vy + 9, 30, 14, '#FFFFFF');
  pxRect(ctx, vx + 42, vy + 11, 24, 10, '#E7F1F3');
  pxRect(ctx, vx + 52, vy + 15, 4, 4, '#7E9095');
  pxRect(ctx, vx + 52, vy + 3, 4, 7, '#BCCAD0');
  pxRect(ctx, vx + 53, vy + 4, 2, 5, '#FAFDFE');

  pxRect(ctx, vx + 77, vy + 9, 7, 9, '#6B9080');
  pxRect(ctx, vx + 79, vy + 6, 3, 3, '#E2E8F0');
  pxRect(ctx, vx + 90, vy + 10, 8, 9, '#DFD4C4');
  pxRect(ctx, vx + 91, vy + 5, 2, 6, '#38BDF8');
  pxRect(ctx, vx + 95, vy + 6, 2, 5, '#FB7185');

  // 2. Corner Shower Glass Caddy Shelf with Shampoo & Soap Bottles (NW corner inside shower)
  const cx = Math.round(1.05 * TILE);
  const cy = Math.round(14.0 * TILE);
  pxRect(ctx, cx, cy, 22, 22, 'rgba(180, 225, 235, 0.45)');
  pxRect(ctx, cx, cy + 20, 22, 2, '#6A838A');
  pxRect(ctx, cx + 20, cy, 2, 22, '#6A838A');
  pxRect(ctx, cx + 3, cy + 4, 5, 11, '#3B82A0');
  pxRect(ctx, cx + 4, cy + 2, 3, 2, '#FAF6F0');
  pxRect(ctx, cx + 10, cy + 6, 5, 9, '#E8A85A');
  pxRect(ctx, cx + 16, cy + 11, 4, 6, '#F4E29C');

  // 2b. Dedicated Wall-Mounted Soap Dish / Soap Holder (ที่เก็บสบู่) on WEST shower wall
  const shx = Math.round(1.12 * TILE);
  const shy = Math.round(14.95 * TILE);
  pxRect(ctx, shx + 1, shy + 11, 18, 3, 'rgba(30, 45, 48, 0.22)');
  pxRect(ctx, shx, shy, 19, 12, '#647C84');
  pxRect(ctx, shx + 2, shy + 2, 15, 8, '#E6F0F2');
  pxRect(ctx, shx + 4, shy + 4, 11, 4, '#C6D9DD');
  if (isSoapInHolder(player)) {
    pxRect(ctx, shx + 4, shy + 2, 11, 6, '#F48C72');
    pxRect(ctx, shx + 5, shy + 3, 9, 4, '#FDA890');
    pxRect(ctx, shx + 6, shy + 3, 4, 1, '#FFF3EE');
  } else {
    pxRect(ctx, shx + 6, shy + 5, 3, 2, 'rgba(255, 255, 255, 0.78)');
    pxRect(ctx, shx + 11, shy + 4, 2, 2, 'rgba(255, 255, 255, 0.65)');
  }

  // 3. East Wall Towel Rack & Small Shelf (SE below Bathroom <-> Kitchen doorway: cols 8.2..8.92, rows 18.35..19.55)
  const trx = Math.round(8.2 * TILE);
  const tryY = Math.round(18.35 * TILE);
  pxRect(ctx, trx + 2, tryY + 36, 18, 4, 'rgba(30, 45, 48, 0.2)');
  pxRect(ctx, trx, tryY, 20, 38, '#6B4930');
  pxRect(ctx, trx + 2, tryY + 2, 16, 34, '#8D6344');
  pxRect(ctx, trx + 3, tryY + 5, 13, 11, '#F4EFE6');
  pxRect(ctx, trx + 3, tryY + 13, 13, 2, '#D8CEBF');
  pxRect(ctx, trx + 3, tryY + 20, 13, 13, '#739A90');
  pxRect(ctx, trx + 3, tryY + 29, 13, 2, '#587A71');

  // 4. Tall Wooden Linen & Towel Storage Cabinet (SE corner: cols 7.55..8.9, rows 19.95..21.8)
  const lcx = Math.round(7.55 * TILE);
  const lcy = Math.round(19.95 * TILE);
  const lcw = Math.round(1.35 * TILE);
  const lch = Math.round(1.85 * TILE);
  pxRect(ctx, lcx + 2, lcy + lch - 1, lcw - 4, 5, 'rgba(30, 45, 48, 0.24)');
  pxRect(ctx, lcx, lcy, lcw, lch, '#5B3E2A');
  pxRect(ctx, lcx + 3, lcy + 3, lcw - 6, lch - 6, '#8B6244');
  pxRect(ctx, lcx + 5, lcy + 7, lcw - 10, 14, '#4B3222');
  pxRect(ctx, lcx + 7, lcy + 14, 15, 5, '#FAF6F0');
  pxRect(ctx, lcx + 7, lcy + 9, 14, 5, '#739A90');
  pxRect(ctx, lcx + 25, lcy + 11, 9, 8, '#FAF6F0');
  pxRect(ctx, lcx + 5, lcy + 25, lcw - 10, lch - 30, '#785237');
  for (let sy = lcy + 29; sy < lcy + lch - 8; sy += 5) {
    pxRect(ctx, lcx + 8, sy, lcw - 16, 2, '#62412A');
  }
  pxRect(ctx, lcx + 28, lcy + 1, 9, 7, '#C97B56');
  pxRect(ctx, lcx + 27, lcy - 4, 11, 6, '#4D8461');
  pxRect(ctx, lcx + 29, lcy - 6, 7, 4, '#6AA67F');

  // 5. Ceramic Flush Toilet, Toilet Paper Holder & Chrome Bidet Sprayer (south-center: cols 5.35..6.7, rows 20.35..21.8)
  const wcx = Math.round(5.35 * TILE);
  const wcy = Math.round(20.35 * TILE);
  const wcw = Math.round(1.35 * TILE);
  const wch = Math.round(1.45 * TILE);
  pxRect(ctx, wcx + 4, wcy + wch - 2, wcw - 8, 5, 'rgba(30, 45, 48, 0.22)');
  pxRect(ctx, wcx + 7, wcy + 2, 29, 28, '#B8C6CA');
  pxRect(ctx, wcx + 9, wcy + 4, 25, 24, '#FFFFFF');
  pxRect(ctx, wcx + 12, wcy + 7, 19, 18, '#EDF4F5');
  pxRect(ctx, wcx + 11, wcy, 21, 4, '#E2ECEE');
  pxRect(ctx, wcx + 3, wcy + 29, 37, 16, '#BAC8CC');
  pxRect(ctx, wcx + 5, wcy + 31, 33, 12, '#F7FAFA');
  pxRect(ctx, wcx + 18, wcy + 35, 7, 3, '#94A6AB');
  pxRect(ctx, wcx - 4, wcy + 31, 7, 10, '#FAF6F0');
  pxRect(ctx, wcx - 3, wcy + 34, 4, 4, '#D6CFC4');
  pxRect(ctx, wcx + 40, wcy + 32, 5, 9, '#9AAAB0');
  pxRect(ctx, wcx + 41, wcy + 33, 3, 6, '#E2ECEF');

  // 6. Covered Bamboo-Lid Bathroom Pedal Bin (beside toilet: cols 4.55..5.2, rows 21.0..21.72)
  const bbx = Math.round(4.55 * TILE);
  const bby = Math.round(21.0 * TILE);
  pxRect(ctx, bbx + 2, bby + 20, 17, 4, 'rgba(30, 45, 48, 0.2)');
  pxRect(ctx, bbx + 1, bby + 1, 18, 20, '#C6C1B8');
  pxRect(ctx, bbx + 3, bby + 3, 14, 16, '#EFECE6');
  pxRect(ctx, bbx + 3, bby + 3, 14, 6, '#C49A6C');

  // 7. Woven Rattan Laundry Hamper (cols 2.9..3.95, rows 20.25..21.65)
  const hx = Math.round(2.9 * TILE);
  const hy = Math.round(20.25 * TILE);
  const hw = Math.round(1.05 * TILE);
  const hh = Math.round(1.4 * TILE);
  pxRect(ctx, hx + 2, hy + hh - 1, hw - 4, 5, 'rgba(30, 45, 48, 0.22)');
  pxRect(ctx, hx, hy, hw, hh, '#7A5434');
  pxRect(ctx, hx + 2, hy + 2, hw - 4, hh - 4, '#B58455');
  for (let wy = hy + 14; wy < hy + hh - 3; wy += 5) {
    pxRect(ctx, hx + 3, wy, hw - 6, 2, '#9A6C42');
  }
  pxRect(ctx, hx + 4, hy + 4, hw - 8, 9, '#EDE7DC');
  pxRect(ctx, hx + 7, hy + 5, 11, 6, '#93B8C4');
  pxRect(ctx, hx + 18, hy + 6, 8, 6, '#F4EFE6');

  // 8. Front-Load Washing Machine (SW corner: cols 1.1..2.7, rows 19.95..21.8)
  const wmx = Math.round(1.1 * TILE);
  const wmy = Math.round(19.95 * TILE);
  const wmw = Math.round(1.6 * TILE);
  const wmh = Math.round(1.85 * TILE);
  pxRect(ctx, wmx + 2, wmy + wmh - 1, wmw - 4, 5, 'rgba(30, 45, 48, 0.26)');
  pxRect(ctx, wmx, wmy, wmw, wmh, '#8B9BA0');
  pxRect(ctx, wmx + 2, wmy + 2, wmw - 4, wmh - 4, '#F1F5F6');
  pxRect(ctx, wmx + 3, wmy + 3, wmw - 6, 18, '#E4ECEE');
  pxRect(ctx, wmx + 6, wmy + 5, 10, 12, '#3B82B8');
  pxRect(ctx, wmx + 8, wmy + 3, 6, 3, '#FAF6F0');
  pxRect(ctx, wmx + 22, wmy + 6, 20, 11, '#E8DFD1');
  pxRect(ctx, wmx + 24, wmy + 8, 16, 7, '#739A90');
  pxRect(ctx, wmx + 2, wmy + 22, wmw - 4, 9, '#D5E0E3');
  pxRect(ctx, wmx + 5, wmy + 24, 11, 5, '#F8FAFC');
  pxRect(ctx, wmx + 23, wmy + 24, 6, 5, '#596A70');
  pxRect(ctx, wmx + 35, wmy + 25, 8, 3, '#253137');
  pxRect(ctx, wmx + 37, wmy + 26, 4, 1, Math.floor(tick / 24) % 2 === 0 ? '#4ADE80' : '#22C55E');
  pxRect(ctx, wmx + 13, wmy + 33, 25, 21, '#687980');
  pxRect(ctx, wmx + 16, wmy + 35, 19, 17, '#2A3942');
  pxRect(ctx, wmx + 19, wmy + 38, 13, 11, '#3B5260');
  pxRect(ctx, wmx + 20, wmy + 39, 4, 3, 'rgba(219, 244, 255, 0.55)');
}

/**
 * Draws the frameless tempered glass walls, automatic shower water streams,
 * and smart opaque/frosted privacy glass enclosure for the NW West Bathroom Glass Shower.
 * Rendered after characters so walking inside the shower places the player behind the privacy glass.
 */
export function drawGlassShowerEnclosure(
  ctx: CanvasRenderingContext2D,
  tick: number,
  player?: PlayerState
) {
  const gxLeft = Math.round(1.02 * TILE); // Meets west outer wall
  const gxEast = Math.round(4.35 * TILE); // East glass partition X
  const gyTop = Math.round(13.9 * TILE); // Top meets bathroom north wall
  const gyDoorTop = Math.round(16.12 * TILE); // Top of sliding door opening
  const gyBot = Math.round(17.98 * TILE); // South glass curb Y
  const southW = gxEast + 7 - gxLeft;

  const privacy = Math.max(0, Math.min(1, player?.showerPrivacyProgress ?? 0));
  const isShowering = Boolean(player?.isShowering || privacy > 0.02);
  const shPipeX = Math.round(2.3 * TILE);
  const wallFaceY = MID_WALL_ROW * TILE + 18;
  const drainX = Math.round(2.55 * TILE);
  const drainY = Math.round(15.9 * TILE);

  // 0. Automatic Rain Shower Water Streams & Floor Splash
  if (isShowering) {
    const streamTopY = wallFaceY + 13;
    const streamBotY = Math.round(16.05 * TILE);
    const phase = tick % 6;
    const columns = [-8, -5, -2, 1, 4, 7, 10];
    for (let c = 0; c < columns.length; c++) {
      const sx = shPipeX + columns[c];
      const sway = (c + Math.floor(tick / 4)) % 2 === 0 ? 0 : 1;
      for (let sy = streamTopY + ((c * 3 + phase) % 6); sy < streamBotY; sy += 7) {
        const len = sy < gyTop ? 4 : 5;
        const alpha = sy < gyTop ? 0.86 : 0.62;
        pxRect(
          ctx,
          sx + sway,
          sy,
          1,
          len,
          `rgba(195, 242, 255, ${(alpha * Math.max(0.35, privacy)).toFixed(2)})`
        );
      }
    }

    const splashStep = Math.floor(tick / 4) % 3;
    pxRect(ctx, drainX - 9 - splashStep, drainY - 2, 4, 1, 'rgba(210, 248, 255, 0.72)');
    pxRect(ctx, drainX + 6 + splashStep, drainY + 1, 4, 1, 'rgba(210, 248, 255, 0.72)');
    pxRect(ctx, drainX - 4, drainY + 6 + splashStep, 6, 1, 'rgba(210, 248, 255, 0.65)');
    pxRect(ctx, drainX - 3, drainY - 7 - splashStep, 5, 1, 'rgba(210, 248, 255, 0.6)');
  }

  // 1. Smart Privacy Frosted Glass Screen covering the NW shower zone ONLY while showering
  if (privacy > 0.01 && player) {
    const stallX = gxLeft;
    const stallY = gyTop;
    const stallW = gxEast - stallX;
    const stallH = gyBot - stallY;

    const baseFrostAlpha = (0.58 * privacy).toFixed(3);
    pxRect(ctx, stallX, stallY, stallW, stallH, `rgba(186, 216, 223, ${baseFrostAlpha})`);

    for (let fy = stallY + 3; fy < gyBot - 2; fy += 5) {
      pxRect(
        ctx,
        stallX + 2,
        fy,
        stallW - 4,
        2,
        `rgba(226, 244, 248, ${(0.28 * privacy).toFixed(3)})`
      );
      pxRect(
        ctx,
        stallX + 2,
        fy + 2,
        stallW - 4,
        1,
        `rgba(134, 168, 176, ${(0.22 * privacy).toFixed(3)})`
      );
    }
    for (let fx = stallX + 10; fx < gxEast - 6; fx += 14) {
      pxRect(
        ctx,
        fx,
        stallY + 2,
        1,
        stallH - 4,
        `rgba(240, 252, 255, ${(0.2 * privacy).toFixed(3)})`
      );
    }

    // High-opacity pixel-frosted privacy censor grid directly over character's mid/lower body
    const px = Math.round(player.x);
    const py = Math.round(player.y);
    const censorX = Math.max(stallX + 2, px - 12);
    const censorY = Math.max(stallY + 4, py - 11);
    const censorW = Math.min(24, gxEast - censorX - 2);
    const censorH = 18;
    for (let cy = 0; cy < censorH; cy += 3) {
      for (let cx = 0; cx < censorW; cx += 3) {
        const isLight = ((cx / 3 + cy / 3 + Math.floor(tick / 10)) | 0) % 2 === 0;
        const blockColor = isLight
          ? `rgba(206, 231, 236, ${(0.84 * privacy).toFixed(3)})`
          : `rgba(176, 208, 216, ${(0.88 * privacy).toFixed(3)})`;
        pxRect(ctx, censorX + cx, censorY + cy, 3, 3, blockColor);
      }
    }

    // Faint through-glass silhouette & action indicators (reaching LEFT to west wall soap dish)
    const phase = player.showerPhase ?? 'wetting';
    const elapsed = player.showerPhaseElapsed;
    const shx = Math.round(1.12 * TILE);
    const shy = Math.round(14.95 * TILE);

    pxRect(ctx, shx, shy, 18, 10, `rgba(110, 142, 150, ${(0.45 * privacy).toFixed(2)})`);
    if (isSoapInHolder(player)) {
      pxRect(ctx, shx + 4, shy + 2, 10, 5, `rgba(248, 150, 126, ${(0.62 * privacy).toFixed(2)})`);
    }

    if (phase === 'grab_soap') {
      const t = Math.min(1, elapsed / 1.5);
      const reachT = t < 0.5 ? t * 2 : (1 - t) * 2;
      const handX = Math.round(px - 6 + (shx + 12 - (px - 6)) * reachT);
      const handY = Math.round(py - 7 + (shy + 3 - (py - 7)) * reachT);
      const armX = Math.min(px - 5, handX);
      const armW = Math.max(4, px - 4 - armX);
      pxRect(ctx, armX, handY, armW, 4, `rgba(165, 132, 114, ${(0.46 * privacy).toFixed(2)})`);
      if (t >= 0.45) {
        pxRect(ctx, handX - 2, handY - 1, 7, 5, `rgba(250, 154, 130, ${(0.68 * privacy).toFixed(2)})`);
        pxRect(ctx, handX - 1, handY, 5, 3, `rgba(255, 224, 212, ${(0.55 * privacy).toFixed(2)})`);
      }
    } else if (phase === 'scrub_soap') {
      const scrubWave = Math.sin(tick * 0.35);
      const soapX = Math.round(px - 2 + scrubWave * 7);
      const soapY = Math.round(py - 9 + Math.cos(tick * 0.25) * 3);
      pxRect(ctx, soapX - 2, soapY, 9, 5, `rgba(165, 132, 114, ${(0.45 * privacy).toFixed(2)})`);
      pxRect(ctx, soapX, soapY - 1, 7, 5, `rgba(250, 154, 130, ${(0.65 * privacy).toFixed(2)})`);
      const foamSpots = [
        { dx: -8, dy: -18, s: 5 },
        { dx: 3, dy: -19, s: 4 },
        { dx: -9, dy: -9, s: 6 },
        { dx: 4, dy: -8, s: 5 },
        { dx: -4, dy: -12, s: 6 },
        { dx: -6, dy: -4, s: 5 },
        { dx: 3, dy: -4, s: 5 },
      ];
      foamSpots.forEach((f, idx) => {
        const bob = Math.sin(tick * 0.2 + idx * 1.3) * 1.5;
        pxRect(
          ctx,
          Math.round(px + f.dx + bob),
          Math.round(py + f.dy),
          f.s,
          f.s - 1,
          `rgba(255, 255, 255, ${(0.66 * privacy).toFixed(2)})`
        );
      });
      const b1Y = py - 20 - ((tick + 5) % 16);
      const b2Y = py - 16 - ((tick + 13) % 16);
      pxRect(ctx, px - 11 + (tick % 3), b1Y, 3, 3, `rgba(255, 255, 255, ${(0.72 * privacy).toFixed(2)})`);
      pxRect(ctx, px + 9 - (tick % 3), b2Y, 3, 3, `rgba(240, 253, 255, ${(0.68 * privacy).toFixed(2)})`);
    } else if (phase === 'return_soap') {
      const t = Math.min(1, elapsed / 1.5);
      const reachT = t < 0.5 ? t * 2 : (1 - t) * 2;
      const handX = Math.round(px - 6 + (shx + 12 - (px - 6)) * reachT);
      const handY = Math.round(py - 7 + (shy + 3 - (py - 7)) * reachT);
      const armX = Math.min(px - 5, handX);
      const armW = Math.max(4, px - 4 - armX);
      pxRect(ctx, armX, handY, armW, 4, `rgba(165, 132, 114, ${(0.46 * privacy).toFixed(2)})`);
      if (t < 0.52) {
        pxRect(ctx, handX - 2, handY - 1, 7, 5, `rgba(250, 154, 130, ${(0.68 * privacy).toFixed(2)})`);
      }
    } else if (phase === 'rinse') {
      const fade = Math.max(0, 1 - elapsed / 2.0);
      if (fade > 0.1) {
        const dropY = Math.round((elapsed * 10) % 12);
        pxRect(ctx, px - 6, py - 10 + dropY, 4, 3, `rgba(255, 255, 255, ${(0.5 * fade * privacy).toFixed(2)})`);
        pxRect(ctx, px + 3, py - 8 + dropY, 4, 3, `rgba(255, 255, 255, ${(0.45 * fade * privacy).toFixed(2)})`);
      }
    }

    for (let c = -6; c <= 8; c += 4) {
      const wy = stallY + 4 + ((tick * 2 + c * 7 + 40) % (stallH - 18));
      pxRect(ctx, shPipeX + c, wy, 1, 5, `rgba(230, 250, 255, ${(0.52 * privacy).toFixed(2)})`);
    }

    const steamDrift = Math.floor(tick / 12) % 6;
    pxRect(ctx, stallX + 12 + (steamDrift % 3), stallY + 6 - steamDrift, 18, 5, `rgba(245, 252, 255, ${(0.34 * privacy).toFixed(2)})`);
    pxRect(ctx, stallX + 46 - (steamDrift % 3), stallY + 10 - ((steamDrift + 3) % 6), 20, 5, `rgba(245, 252, 255, ${(0.3 * privacy).toFixed(2)})`);

    pxRect(ctx, stallX + 14, stallY + 18, 18, 3, `rgba(255, 255, 255, ${(0.36 * privacy).toFixed(2)})`);
    pxRect(ctx, stallX + 22, stallY + 24, 12, 3, `rgba(255, 255, 255, ${(0.24 * privacy).toFixed(2)})`);
    pxRect(ctx, stallX + 58, stallY + 68, 20, 3, `rgba(255, 255, 255, ${(0.32 * privacy).toFixed(2)})`);
    pxRect(ctx, stallX + 66, stallY + 74, 14, 3, `rgba(255, 255, 255, ${(0.22 * privacy).toFixed(2)})`);
  }

  // 2. East fixed tempered glass partition panel (rows 13.9..16.12)
  const eastPanelH = gyDoorTop - gyTop;
  const eastGlassColor =
    privacy > 0.05
      ? `rgba(176, 212, 220, ${(0.44 + 0.44 * privacy).toFixed(2)})`
      : 'rgba(182, 226, 236, 0.44)';
  pxRect(ctx, gxEast, gyTop, 7, eastPanelH, eastGlassColor);
  pxRect(ctx, gxEast + 5, gyTop, 2, eastPanelH, '#4E636A');
  pxRect(ctx, gxEast, gyTop, 2, eastPanelH, '#678088');
  pxRect(ctx, gxEast + 2, gyTop + 12, 3, 10, 'rgba(255, 255, 255, 0.52)');
  pxRect(ctx, gxEast + 2, gyTop + 42, 3, 8, 'rgba(255, 255, 255, 0.4)');

  // 3. Sliding glass door across east doorway opening (rows 16.12..17.98) — closes & turns opaque when showering
  const doorFullH = gyBot - gyDoorTop;
  const closedDoorH = Math.round(doorFullH * privacy);
  pxRect(ctx, gxEast + 1, gyDoorTop, 4, doorFullH, 'rgba(198, 234, 242, 0.16)');
  if (closedDoorH > 2) {
    pxRect(ctx, gxEast, gyDoorTop, 7, closedDoorH, 'rgba(172, 208, 216, 0.92)');
    pxRect(ctx, gxEast + 5, gyDoorTop, 2, closedDoorH, '#455A61');
    pxRect(ctx, gxEast, gyDoorTop, 2, closedDoorH, '#5F7880');
    for (let dy = gyDoorTop + 4; dy < gyDoorTop + closedDoorH - 3; dy += 6) {
      pxRect(ctx, gxEast + 2, dy, 3, 2, 'rgba(235, 248, 252, 0.65)');
    }
    const handleY = Math.max(gyDoorTop + 4, gyDoorTop + closedDoorH - 18);
    pxRect(ctx, gxEast - 2, handleY, 2, 12, '#E2EEF2');
    pxRect(ctx, gxEast + 7, handleY, 2, 12, '#E2EEF2');
  } else {
    pxRect(ctx, gxEast - 2, gyDoorTop - 16, 2, 12, '#D8E5E9');
    pxRect(ctx, gxEast + 7, gyDoorTop - 16, 2, 12, '#D8E5E9');
  }
  pxRect(ctx, gxEast + 2, gyDoorTop, 2, 4, '#5E747C');
  pxRect(ctx, gxEast + 2, gyBot - 4, 2, 4, '#5E747C');

  // 4. South tempered glass wall & raised tiled water curb (cols 1.02..4.57, y=17.98*TILE)
  pxRect(ctx, gxLeft, gyBot + 7, southW, 4, 'rgba(30, 45, 48, 0.18)');
  pxRect(ctx, gxLeft, gyBot + 2, southW, 6, '#8FA5AA');
  pxRect(ctx, gxLeft + 2, gyBot + 3, southW - 4, 4, '#E8F0F1');
  const southGlassColor =
    privacy > 0.05
      ? `rgba(176, 212, 220, ${(0.34 + 0.56 * privacy).toFixed(2)})`
      : 'rgba(182, 226, 236, 0.34)';
  pxRect(ctx, gxLeft, gyBot - 16, southW, 19, southGlassColor);
  pxRect(ctx, gxLeft, gyBot - 16, southW, 2, '#536A72');
  pxRect(ctx, gxLeft, gyBot - 14, southW, 1, 'rgba(255, 255, 255, 0.55)');
  const shimmer = Math.floor(tick / 45) % 2;
  pxRect(ctx, gxLeft + 16 + shimmer * 2, gyBot - 13, 12, 3, 'rgba(255, 255, 255, 0.42)');
  pxRect(ctx, gxLeft + 24 + shimmer * 2, gyBot - 9, 10, 3, 'rgba(255, 255, 255, 0.28)');
  pxRect(ctx, gxLeft + 68, gyBot - 13, 14, 3, 'rgba(255, 255, 255, 0.38)');
  pxRect(ctx, gxLeft + 76, gyBot - 9, 10, 3, 'rgba(255, 255, 255, 0.25)');
  // Matte-charcoal corner bracket joining east & south glass panels
  pxRect(ctx, gxEast, gyBot - 17, 7, 25, '#4A5F66');
  pxRect(ctx, gxEast + 2, gyBot - 15, 3, 21, '#78929B');

  // 5. Floating action status pill above the frosted shower booth while showering
  if (player?.isShowering && privacy > 0.25) {
    const phase = player.showerPhase ?? 'wetting';
    const statusText =
      phase === 'grab_soap'
        ? 'หยิบสบู่จากที่เก็บสบู่'
        : phase === 'scrub_soap'
          ? 'กำลังถูสบู่...'
          : phase === 'return_soap'
            ? 'วางเก็บสบู่กลับที่เก็บสบู่'
            : phase === 'rinse'
              ? 'ล้างตัวใต้น้ำฝักบัวอัตโนมัติ'
              : 'อาบน้ำอัตโนมัติ · ปิดกระจกทึบ';

    ctx.save();
    ctx.font = '600 10px "IBM Plex Sans Thai", sans-serif';
    const textW = Math.ceil(ctx.measureText(statusText).width);
    const bw = textW + 16;
    const bh = 18;
    const bx = Math.max(8, Math.round(gxLeft + (southW - bw) / 2));
    const by = Math.round(gyTop - 44);

    pxRect(ctx, bx - 1, by - 1, bw + 2, bh + 2, '#5B8E9B');
    pxRect(ctx, bx, by, bw, bh, 'rgba(24, 38, 42, 0.92)');
    pxRect(ctx, bx + 5, by + 7, 4, 4, '#7DD3FC');
    ctx.fillStyle = '#F0F9FF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusText, bx + 12, by + bh / 2 + 0.5);
    ctx.restore();
  }
}
