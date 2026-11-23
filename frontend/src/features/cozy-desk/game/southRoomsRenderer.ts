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

import {
  drawBedroomPictureWindow,
  drawGardenShrub,
  drawGardenTree,
  drawWallSegmentTopBeam,
  drawWestBedroomFloor,
  drawWestBedroomFurniture,
  drawWestBedroomWalls,
  pxRect,
} from './westBedroomRenderer';
import {
  drawBedroomSleepDarkness,
  drawBedroomSleepQuestBadge,
  drawGreenCar,
  drawPorchPlantQuestBadge,
  drawRoadsideMailbox,
  drawRoadsideMailboxNotification,
  drawSouthRoomsForeground,
  drawSouthRoomsFurniture,
} from './southExteriorAndPropsRenderer';

export {
  drawBedroomSleepDarkness,
  drawBedroomSleepQuestBadge,
  drawGreenCar,
  drawPorchPlantQuestBadge,
  drawRoadsideMailbox,
  drawRoadsideMailboxNotification,
  drawSouthRoomsForeground,
  drawSouthRoomsFurniture,
  drawWestBedroomFloor,
  drawWestBedroomFurniture,
  drawWestBedroomWalls,
};

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

export { drawSouthRoomsWalls } from './southWallsRenderer';
