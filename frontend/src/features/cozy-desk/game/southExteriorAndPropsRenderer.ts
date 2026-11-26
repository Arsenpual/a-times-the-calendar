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

import { drawGardenShrub, drawGardenTree, pxRect } from './westBedroomRenderer';

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
  plantWateringProgress = 0,
  isLiftingBarbell = false
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
  // 7. HOME GYM / FITNESS STUDIO EQUIPMENT (cols 20..31, rows 14..19)
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
  // Steel J-hook brackets on uprights
  pxRect(ctx, srX + 3, srY + 21, 7, 5, '#64748B');
  pxRect(ctx, srX + srW - 10, srY + 21, 7, 5, '#64748B');
  // Chrome Olympic Barbell & bumper plates (hidden while player unracks and lifts them)
  if (!isLiftingBarbell) {
    pxRect(ctx, srX - 3, srY + 22, srW + 6, 3, '#CBD5E1');
    pxRect(ctx, srX + 12, srY + 22, srW - 24, 3, '#94A3B8'); // Knurled center shaft
    // Loaded colorful Olympic bumper weight plates (left & right sleeves)
    pxRect(ctx, srX - 2, srY + 15, 4, 17, '#B91C1C'); // 25kg red bumper
    pxRect(ctx, srX + 3, srY + 17, 3, 13, '#2563EB'); // 20kg blue bumper
    pxRect(ctx, srX + srW - 2, srY + 15, 4, 17, '#B91C1C');
    pxRect(ctx, srX + srW - 6, srY + 17, 3, 13, '#2563EB');
  }

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

export {
  drawBedroomSleepDarkness,
  drawBedroomSleepQuestBadge,
  drawPorchPlantQuestBadge,
  drawRoadsideMailbox,
  drawRoadsideMailboxNotification,
} from './southBadgesAndMailboxRenderer';
