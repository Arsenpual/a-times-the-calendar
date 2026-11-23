import type { TimeOfDay } from '../types/game';
import {
  CORE_OFFSET_X,
  DIVIDER_COL,
  DRIVEWAY_COL_END,
  DRIVEWAY_COL_START,
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
  GARAGE_NORTH_WALL_ROW,
  GYM_DOOR_COL_END,
  GYM_DOOR_COL_START,
  GYM_FLOOR_COL_END,
  GYM_FLOOR_COL_START,
  LOWER_EAST_WALL_COL,
  LOWER_MID_WALL_ROW,
  MAP_COLS,
  MID_WALL_ROW,
  OFFICE_EAST_WALL_COL,
  SIDEWALK_ROW_START,
  TILE,
  WEST_DIVIDER_COL,
  WORLD_W,
} from './houseMap';
import {
  drawGardenShrub,
  drawGardenTree,
  drawWallSegmentTopBeam,
  pxRect,
} from './westBedroomRenderer';

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
