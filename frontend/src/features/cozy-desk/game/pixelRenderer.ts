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
import {
  drawBathroomFurniture,
  drawGlassShowerEnclosure,
  drawKitchenDiningNorthChairs,
  drawKitchenDiningSouthChairBackrests,
  drawKitchenDiningSouthChairSeatPads,
  drawKitchenDiningTable,
  drawKitchenFurniture,
  drawLowerRoomFloors,
  drawLowerRoomWalls,
} from './lowerRoomsRenderer';
import {
  drawBedroomSleepDarkness,
  drawBedroomSleepQuestBadge,
  drawGreenCar,
  drawPorchPlantQuestBadge,
  drawRoadsideMailbox,
  drawRoadsideMailboxNotification,
  drawSouthRoomsFloors,
  drawSouthRoomsForeground,
  drawSouthRoomsFurniture,
  drawSouthRoomsWalls,
  drawWestBedroomFloor,
  drawWestBedroomFurniture,
  drawWestBedroomWalls,
} from './southRoomsRenderer';

import {
  drawAiStudioProximityZone,
  drawAntigravityProximityZone,
  drawFireplace,
  drawMinaProximityZone,
  drawPendulumClockAnnouncement,
  drawPinboard,
  drawRugs,
  drawWalls,
  drawWoodFloor,
  pxRect,
} from './upperRoomsArchitectureRenderer';
import {
  drawBookshelf,
  drawCenterDriveTable,
  drawChristmasTree,
  drawLivingFurniture,
  drawOfficeFurniture,
  drawPottedPlant,
} from './upperRoomsFurnitureRenderer';
import {
  drawActiveCharacterOverlay,
  drawAiStudioNpc,
  drawAntigravityNpc,
  drawMinaNpc,
  drawPlayer,
  drawShoweringPlayerSilhouette,
} from './characterRenderer';

export interface RenderContextState {
  player: PlayerState;
  mina: MinaNpcState;
  antigravityNpc?: RovingAssistantNpcState;
  aiStudioNpc?: RovingAssistantNpcState;
  deliveryBubble?: { assistantId: TaskAssistantId; text: string } | null;
  greenCar?: GreenCarState;
  extraPinCount: number;
  pinboardGlowTick: number;
  timeOfDay: TimeOfDay;
  assistantMood: AssistantMood;
  minaBubbleText: string | null;
  nearestInteractable: InteractableObject | null;
  clickTarget: { x: number; y: number; ttl: number } | null;
  tick: number;
  isWorking: boolean;
  isTvOn: boolean;
  isDriveOpen: boolean;
  isAntigravityOpen?: boolean;
  isAiStudioOpen?: boolean;
  isMailboxOpen?: boolean;
  mailboxUnreadCount?: number;
  mailboxFreshArrival?: boolean;
  isSleepLogOpen?: boolean;
  hasLoggedTodaySleep?: boolean;
  todaySleepLabel?: string | null;
  hasWateredPlantsToday?: boolean;
  todayPlantWaterLabel?: string | null;
  plantWateringProgress?: number;
  characterStatuses?: CharacterStatusMap;
  clockAnnouncement?: { title: string; startTimeLabel: string; triggeredAt: number } | null;
  camera: CameraTransform;
  inspectHover?: InspectHoverRenderState | null;
  viewW?: number;
  viewH?: number;
  baseScale?: number;
}

function drawInteractableHighlight(
  ctx: CanvasRenderingContext2D,
  item: InteractableObject,
  tick: number,
  suppressFloatingLabel = false
) {
  const pulse = 0.55 + Math.sin(tick * 0.12) * 0.25;
  ctx.save();
  ctx.strokeStyle = `rgba(245, 184, 65, ${pulse.toFixed(2)})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(
    Math.round(item.x) - 2,
    Math.round(item.y) - 2,
    Math.round(item.w) + 4,
    Math.round(item.h) + 4
  );

  if (suppressFloatingLabel) {
    ctx.restore();
    return;
  }

  // Floating [E] prompt tag above non-character furniture objects
  const cx = item.x + item.w / 2;
  const cy = Math.max(26, item.y - 8);
  const label = `[E] ${item.actionLabel}`;
  ctx.font = '600 11px "IBM Plex Sans Thai", sans-serif';
  const w = Math.ceil(ctx.measureText(label).width) + 14;
  const h = 20;
  let bx = Math.round(cx - w / 2);
  bx = Math.max(10, Math.min(WORLD_W - w - 10, bx));
  const by = Math.round(cy - h);

  pxRect(ctx, bx - 1, by - 1, w + 2, h + 2, '#D97736');
  pxRect(ctx, bx, by, w, h, '#231D19');
  ctx.fillStyle = '#FAF6F0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + w / 2, by + h / 2 + 0.5);
  ctx.restore();
}

function drawInspectHighlight(
  ctx: CanvasRenderingContext2D,
  inspect: InspectHoverRenderState,
  tick: number
) {
  const { object, progress, revealed } = inspect;
  if (!revealed && progress <= 0) return;

  const rx = Math.round(object.x) - 1;
  const ry = Math.round(object.y) - 1;
  const rw = Math.round(object.w) + 2;
  const rh = Math.round(object.h) + 2;

  ctx.save();
  if (revealed) {
    const pulse = 0.78 + Math.sin(tick * 0.14) * 0.16;
    ctx.fillStyle = 'rgba(153, 226, 208, 0.13)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = `rgba(153, 226, 208, ${pulse.toFixed(2)})`;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  } else {
    const alpha = 0.25 + progress * 0.45;
    ctx.fillStyle = `rgba(153, 226, 208, ${(0.04 + progress * 0.06).toFixed(3)})`;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = `rgba(153, 226, 208, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  }
  ctx.restore();
}

function drawInspectDwellRing(
  ctx: CanvasRenderingContext2D,
  inspect: InspectHoverRenderState,
  viewW: number,
  viewH: number
) {
  if (inspect.revealed || inspect.progress <= 0) return;

  const cx = Math.max(16, Math.min(viewW - 16, inspect.pointerVx + 15));
  const cy = Math.max(16, Math.min(viewH - 16, inspect.pointerVy + 15));
  const r = 7;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * Math.min(1, inspect.progress);

  ctx.save();
  // Subtle dark disc backdrop for contrast against light ceramic tiles
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(28, 24, 21, 0.76)';
  ctx.fill();

  // Track ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(250, 246, 240, 0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Active fill arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = '#99E2D0';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawAtmosphereLighting(
  ctx: CanvasRenderingContext2D,
  timeOfDay: TimeOfDay,
  tick: number,
  isTvOn: boolean,
  mailboxUnreadCount = 0,
  isSleepingInBed = false
) {
  ctx.save();

  // Sunlight diagonal beams through windows during morning & afternoon
  if (timeOfDay === 'morning' || timeOfDay === 'afternoon') {
    const beamColor =
      timeOfDay === 'morning' ? 'rgba(255, 248, 220, 0.13)' : 'rgba(255, 198, 120, 0.16)';
    ctx.fillStyle = beamColor;

    // Master Bedroom (Upper-West Wing) twin north window sunbeams (omitted when bedroom is in night sleep mode)
    if (!isSleepingInBed) {
      ctx.beginPath();
      ctx.moveTo(1.35 * TILE, 50);
      ctx.lineTo(2.8 * TILE, 50);
      ctx.lineTo(3.3 * TILE, 138);
      ctx.lineTo(1.65 * TILE, 138);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(6.8 * TILE, 50);
      ctx.lineTo(8.25 * TILE, 50);
      ctx.lineTo(8.75 * TILE, 138);
      ctx.lineTo(7.1 * TILE, 138);
      ctx.closePath();
      ctx.fill();
    }

    // Living room window sunbeam (shifted +CORE_OFFSET_X)
    ctx.beginPath();
    ctx.moveTo(2.3 * TILE + CORE_OFFSET_X, 54);
    ctx.lineTo(4.9 * TILE + CORE_OFFSET_X, 54);
    ctx.lineTo(5.8 * TILE + CORE_OFFSET_X, 148);
    ctx.lineTo(2.9 * TILE + CORE_OFFSET_X, 148);
    ctx.closePath();
    ctx.fill();

    // Expanded Office Executive window sunbeam
    ctx.beginPath();
    ctx.moveTo(16.55 * TILE + CORE_OFFSET_X, 52);
    ctx.lineTo(18.85 * TILE + CORE_OFFSET_X, 52);
    ctx.lineTo(19.35 * TILE + CORE_OFFSET_X, 138);
    ctx.lineTo(16.85 * TILE + CORE_OFFSET_X, 138);
    ctx.closePath();
    ctx.fill();

    // Expanded Office East Library window sunbeam
    ctx.beginPath();
    ctx.moveTo(20.2 * TILE + CORE_OFFSET_X, 52);
    ctx.lineTo(21.85 * TILE + CORE_OFFSET_X, 52);
    ctx.lineTo(22.25 * TILE + CORE_OFFSET_X, 130);
    ctx.lineTo(20.45 * TILE + CORE_OFFSET_X, 130);
    ctx.closePath();
    ctx.fill();
  }

  // Full neighborhood lot atmospheric tint (house + side yards + front street)
  if (timeOfDay === 'evening') {
    ctx.fillStyle = 'rgba(18, 22, 38, 0.34)';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  } else if (timeOfDay === 'afternoon') {
    ctx.fillStyle = 'rgba(230, 140, 60, 0.06)';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  // Warm radial glow pools across all 6 rooms, front porch & streetlamps
  const glowAlpha = timeOfDay === 'evening' ? 0.32 : 0.16;
  const streetGlowAlpha = timeOfDay === 'evening' ? 0.44 : 0.12;
  const lampFlicker = 1 + Math.sin(tick * 0.1) * 0.03;

  const lights = [
    // Master Bedroom (Upper-West Wing) warm nightstand & reading lamps (turned off while sleeping on King Bed)
    ...(!isSleepingInBed
      ? [
          { x: 2.3 * TILE, y: 2.3 * TILE, r: 84 * lampFlicker, color: `rgba(255, 204, 118, ${glowAlpha * 0.92})` },
          { x: 7.2 * TILE, y: 2.3 * TILE, r: 84 * lampFlicker, color: `rgba(255, 204, 118, ${glowAlpha * 0.92})` },
          { x: 8.1 * TILE, y: 9.7 * TILE, r: 78 * lampFlicker, color: `rgba(255, 212, 132, ${glowAlpha * 0.85})` },
        ]
      : []),
    // Living Room & Expanded Home Office (shifted +CORE_OFFSET_X)
    { x: 1.85 * TILE + CORE_OFFSET_X, y: 2.75 * TILE, r: 84 * lampFlicker, color: `rgba(255, 208, 110, ${glowAlpha * 0.95})` },
    { x: 13.65 * TILE + CORE_OFFSET_X, y: 2.4 * TILE, r: 78 * lampFlicker, color: `rgba(255, 212, 128, ${glowAlpha * 0.82})` },
    { x: 16.2 * TILE + CORE_OFFSET_X, y: 3.45 * TILE, r: 96 * lampFlicker, color: `rgba(255, 190, 92, ${glowAlpha})` },
    { x: 16.65 * TILE + CORE_OFFSET_X, y: 8.2 * TILE, r: 94 * lampFlicker, color: `rgba(255, 204, 118, ${glowAlpha * 0.78})` },
    { x: 22.1 * TILE + CORE_OFFSET_X, y: 6.55 * TILE, r: 90 * lampFlicker, color: `rgba(255, 196, 108, ${glowAlpha * 0.95})` },
    { x: 12.1 * TILE + CORE_OFFSET_X, y: 10.5 * TILE, r: 74 * lampFlicker, color: `rgba(125, 211, 252, ${glowAlpha * 0.65})` },
    { x: 16.88 * TILE + CORE_OFFSET_X, y: 11.1 * TILE, r: 78 * lampFlicker, color: `rgba(96, 165, 250, ${glowAlpha * 0.72})` },
    { x: 7.9 * TILE + CORE_OFFSET_X, y: 1.9 * TILE, r: 80 * lampFlicker, color: `rgba(244, 120, 56, ${glowAlpha * 0.95})` },
    // Middle-West Bathroom vanity sconces & NW glass shower overhead
    { x: 7.0 * TILE, y: 14.2 * TILE, r: 94, color: `rgba(244, 248, 255, ${glowAlpha * 0.88})` },
    { x: 2.5 * TILE, y: 15.6 * TILE, r: 78, color: `rgba(218, 244, 252, ${glowAlpha * 0.65})` },
    // Middle-Center Kitchen range hood & dining pendant
    { x: 3.95 * TILE + CORE_OFFSET_X, y: 14.1 * TILE, r: 78, color: `rgba(255, 214, 138, ${glowAlpha * 0.85})` },
    { x: 6.3 * TILE + CORE_OFFSET_X, y: 19.1 * TILE, r: 106, color: `rgba(255, 206, 122, ${glowAlpha * 0.9})` },
    // South-Center Entryway console lamp & twin Front Porch lanterns
    { x: 1.65 * TILE + CORE_OFFSET_X, y: 24.2 * TILE, r: 82 * lampFlicker, color: `rgba(255, 210, 126, ${glowAlpha * 0.88})` },
    { x: 3.65 * TILE + CORE_OFFSET_X, y: 28.9 * TILE, r: 76 * lampFlicker, color: `rgba(255, 205, 115, ${glowAlpha * 0.92})` },
    { x: 7.35 * TILE + CORE_OFFSET_X, y: 28.9 * TILE, r: 76 * lampFlicker, color: `rgba(255, 205, 115, ${glowAlpha * 0.92})` },
    // Middle-East Home Gym warm-neutral studio overhead track lights
    { x: 22.2 * TILE, y: 16.5 * TILE, r: 96, color: `rgba(244, 248, 252, ${glowAlpha * 0.82})` },
    { x: 26.2 * TILE, y: 16.5 * TILE, r: 96, color: `rgba(255, 244, 220, ${glowAlpha * 0.85})` },
    { x: 30.2 * TILE, y: 16.5 * TILE, r: 90, color: `rgba(255, 236, 196, ${glowAlpha * 0.88})` },
    // Attached 2-Car Garage overhead shop lights & exterior double-bay coach lanterns
    { x: 23.7 * TILE, y: 24.5 * TILE, r: 105, color: `rgba(232, 244, 255, ${glowAlpha * 0.85})` },
    { x: 28.5 * TILE, y: 24.5 * TILE, r: 105, color: `rgba(232, 244, 255, ${glowAlpha * 0.85})` },
    { x: 20.4 * TILE, y: 30.8 * TILE, r: 78 * lampFlicker, color: `rgba(255, 205, 115, ${glowAlpha * 0.88})` },
    { x: 31.4 * TILE, y: 30.8 * TILE, r: 78 * lampFlicker, color: `rgba(255, 205, 115, ${glowAlpha * 0.88})` },
    // Warm solar garden path lights lining the Long Front Walkway (rows 33..37.5)
    { x: 14.5 * TILE, y: 33.2 * TILE, r: 66 * lampFlicker, color: `rgba(255, 212, 128, ${streetGlowAlpha * 0.72})` },
    { x: 14.5 * TILE, y: 35.6 * TILE, r: 66 * lampFlicker, color: `rgba(255, 212, 128, ${streetGlowAlpha * 0.72})` },
    { x: 14.5 * TILE, y: 37.8 * TILE, r: 72 * lampFlicker, color: `rgba(255, 212, 128, ${streetGlowAlpha * 0.82})` },
    // Pushed-Back Front Sidewalk & Neighborhood Streetlamps (row 39.0)
    { x: 4.8 * TILE, y: 39.0 * TILE, r: 96 * lampFlicker, color: `rgba(255, 204, 112, ${streetGlowAlpha})` },
    { x: 11.4 * TILE, y: 39.0 * TILE, r: 96 * lampFlicker, color: `rgba(255, 204, 112, ${streetGlowAlpha})` },
    { x: 17.6 * TILE, y: 39.0 * TILE, r: 96 * lampFlicker, color: `rgba(255, 204, 112, ${streetGlowAlpha})` },
    { x: 31.95 * TILE, y: 39.0 * TILE, r: 96 * lampFlicker, color: `rgba(255, 204, 112, ${streetGlowAlpha})` },
  ];

  if (isTvOn) {
    const tvTwinkle = 0.19 + Math.sin(tick * 0.21) * 0.055 + Math.sin(tick * 0.47) * 0.025;
    const tvRadius = 80 + Math.sin(tick * 0.16) * 6;
    lights.push({
      x: 3.7 * TILE + CORE_OFFSET_X,
      y: 10.15 * TILE,
      r: tvRadius,
      color: `rgba(148, 210, 238, ${tvTwinkle.toFixed(3)})`,
    });
    // Secondary warm-tinted micro twinkle pulse near screen center
    lights.push({
      x: 3.7 * TILE + CORE_OFFSET_X,
      y: 10.45 * TILE,
      r: 34 + Math.cos(tick * 0.31) * 5,
      color: `rgba(255, 240, 200, ${(0.1 + Math.abs(Math.sin(tick * 0.28)) * 0.09).toFixed(3)})`,
    });
  }

  if (mailboxUnreadCount > 0) {
    const mailPulse = 0.2 + Math.abs(Math.sin(tick * 0.1)) * 0.14;
    lights.push({
      x: MAILBOX_RECT.x + MAILBOX_RECT.w / 2,
      y: MAILBOX_RECT.y + 4,
      r: 44 + Math.sin(tick * 0.12) * 4,
      color: `rgba(248, 113, 113, ${mailPulse.toFixed(3)})`,
    });
  }

  for (const l of lights) {
    const grad = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, l.r);
    grad.addColorStop(0, l.color);
    grad.addColorStop(1, 'rgba(255, 190, 92, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle floor zone labels painted near bottom of each zone
  ctx.font = '600 10px "Prompt", "IBM Plex Sans Thai", sans-serif';
  ctx.fillStyle = timeOfDay === 'evening' ? 'rgba(250, 246, 240, 0.55)' : 'rgba(65, 42, 26, 0.45)';
  ctx.textAlign = 'left';
  ctx.fillText('ห้องนอนใหญ่', 1.4 * TILE, 11.65 * TILE);
  ctx.fillText('ห้องพักผ่อน', 1.4 * TILE + CORE_OFFSET_X, 11.65 * TILE);
  ctx.fillText('ห้องครัว', 13.15 * TILE, 21.65 * TILE);
  ctx.fillText('โถงทางเข้า · ชานหน้าบ้าน', 11.45 * TILE, 27.65 * TILE);
  ctx.fillStyle = timeOfDay === 'evening' ? 'rgba(232, 246, 248, 0.58)' : 'rgba(42, 68, 72, 0.48)';
  ctx.fillText('ห้องน้ำ · ห้องอาบน้ำ', 1.4 * TILE, 21.65 * TILE);
  ctx.fillStyle = timeOfDay === 'evening' ? 'rgba(250, 246, 240, 0.55)' : 'rgba(65, 42, 26, 0.45)';
  ctx.textAlign = 'right';
  ctx.fillText('ห้องทำงาน (+50%) · โต๊ะของมีน่า', 22.55 * TILE + CORE_OFFSET_X, 11.65 * TILE);
  ctx.fillStyle = timeOfDay === 'evening' ? 'rgba(236, 244, 242, 0.58)' : 'rgba(244, 240, 232, 0.62)';
  ctx.textAlign = 'center';
  ctx.fillText('ห้องออกกำลังกาย', 24.8 * TILE, 19.72 * TILE);
  ctx.fillStyle = timeOfDay === 'evening' ? 'rgba(236, 242, 248, 0.58)' : 'rgba(54, 62, 72, 0.52)';
  ctx.fillText('โรงจอดรถ (2 คัน)', 26.0 * TILE, 29.7 * TILE);
  ctx.fillStyle = timeOfDay === 'evening' ? 'rgba(236, 240, 246, 0.55)' : 'rgba(244, 240, 232, 0.58)';
  ctx.fillText('ถนนหน้าบ้าน', 14.5 * TILE, 43.8 * TILE);

  ctx.restore();
}

export function renderHouseScene(
  ctx: CanvasRenderingContext2D,
  state: RenderContextState
) {
  const viewW = state.viewW ?? VIEW_W;
  const viewH = state.viewH ?? VIEW_H;
  const baseScale = state.baseScale ?? CAMERA_BASE_SCALE;

  ctx.imageSmoothingEnabled = false;
  // Cozy warm dark architectural backdrop outside neighborhood lot boundaries
  ctx.fillStyle = '#1B1612';
  ctx.fillRect(0, 0, viewW, viewH);

  const scale = state.camera.zoom * baseScale;
  ctx.save();
  ctx.translate(viewW / 2, viewH / 2);
  ctx.scale(scale, scale);
  ctx.translate(-state.camera.x, -state.camera.y);

  // Clean outer frame drop shadow around the full 33x38 house lot & street
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(6, 6, WORLD_W, WORLD_H);

  // TV turns on visually either when the YouTube modal is open or when the player clicks the remote on the sofa
  const sofaWatchingTv =
    state.player.isSitting &&
    state.player.seat === 'sofa' &&
    state.player.sofaActivity === 'tv_remote' &&
    state.player.sofaActivityElapsed >= 0.85;
  const tvScreenActive = state.isTvOn || sofaWatchingTv;

  // 1. Floors, Rugs & Assistant Proximity Zones
  drawWestBedroomFloor(ctx);
  ctx.save();
  ctx.translate(CORE_OFFSET_X, 0);
  drawWoodFloor(ctx);
  ctx.restore();
  drawLowerRoomFloors(ctx);
  drawSouthRoomsFloors(ctx, state.timeOfDay, state.tick);
  ctx.save();
  ctx.translate(CORE_OFFSET_X, 0);
  drawRugs(ctx);
  ctx.restore();
  drawMinaProximityZone(ctx, state.player, state.isWorking, state.tick);
  drawAntigravityProximityZone(
    ctx,
    state.player,
    Boolean(state.isAntigravityOpen),
    state.tick
  );
  drawAiStudioProximityZone(
    ctx,
    state.player,
    Boolean(state.isAiStudioOpen),
    state.tick
  );

  // 2. Architectural Walls across all 6 rooms, side yards & front porch
  const isSleepingInBed =
    state.player.isSitting && state.player.seat === 'bedroom_bed';
  const windowSkyTime: TimeOfDay = isSleepingInBed ? 'evening' : state.timeOfDay;
  const isPinboardActive =
    state.mina.phase === 'pinning' || state.pinboardGlowTick > 0;
  const isShowerRunning =
    state.player.isShowering || state.player.showerPrivacyProgress > 0.05;
  ctx.save();
  ctx.translate(CORE_OFFSET_X, 0);
  drawWalls(
    ctx,
    windowSkyTime,
    state.tick,
    state.extraPinCount,
    isPinboardActive,
    Boolean(state.clockAnnouncement)
  );
  ctx.restore();
  drawWestBedroomWalls(ctx, windowSkyTime, state.tick, isSleepingInBed);
  drawLowerRoomWalls(ctx, state.timeOfDay, state.tick, isShowerRunning);
  drawSouthRoomsWalls(ctx, state.timeOfDay, state.tick);

  // 3. Click-to-move waypoint ring
  if (state.clickTarget && state.clickTarget.ttl > 0) {
    const alpha = Math.min(0.85, state.clickTarget.ttl / 25);
    ctx.save();
    ctx.strokeStyle = `rgba(245, 184, 65, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 2;
    const radius = 5 + Math.sin(state.tick * 0.25) * 2;
    ctx.beginPath();
    ctx.arc(state.clickTarget.x, state.clickTarget.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Furniture & depth-sorted characters
  drawWestBedroomFurniture(
    ctx,
    state.tick,
    Boolean(state.hasLoggedTodaySleep),
    Boolean(state.isSleepLogOpen),
    isSleepingInBed
  );
  ctx.save();
  ctx.translate(CORE_OFFSET_X, 0);
  drawLivingFurniture(ctx, state.tick, tvScreenActive);
  ctx.restore();
  drawKitchenFurniture(ctx, state.tick);
  drawBathroomFurniture(ctx, state.tick, state.player);
  const isLiftingBarbell = state.player.isSitting && state.player.seat === 'gym_barbell';
  drawSouthRoomsFurniture(
    ctx,
    state.tick,
    Boolean(state.hasWateredPlantsToday),
    state.plantWateringProgress ?? 0,
    isLiftingBarbell
  );

  const minaBehindDesk = state.mina.x > DIVIDER_COL * TILE && state.mina.y < 3.4 * TILE;
  if (minaBehindDesk) {
    drawMinaNpc(ctx, state.mina, state.assistantMood, state.tick);
  }

  ctx.save();
  ctx.translate(CORE_OFFSET_X, 0);
  drawOfficeFurniture(
    ctx,
    state.assistantMood,
    state.mina.phase,
    state.tick,
    state.player.isSitting && state.player.seat === 'workdesk'
  );
  ctx.restore();

  const centerTableSortY = CENTER_TABLE_RECT.y + CENTER_TABLE_RECT.h * 0.55;
  const kitchenDiningNorthChairsSortY = KITCHEN_DINING_RECT.y - 4;
  const kitchenDiningTableSortY = KITCHEN_DINING_RECT.y + KITCHEN_DINING_RECT.h * 0.55;
  const kitchenDiningSouthSeatSortY = KITCHEN_DINING_RECT.y + KITCHEN_DINING_RECT.h - 2;
  const kitchenDiningSouthBackrestSortY = KITCHEN_DINING_RECT.y + KITCHEN_DINING_RECT.h + 14;
  const showerGlassSortY = 18.02 * TILE;
  const porchRailingSortY = 30.88 * TILE;

  const drawList: Array<{ y: number; draw: () => void }> = [
    { y: state.player.y, draw: () => drawPlayer(ctx, state.player, state.tick) },
    {
      y: centerTableSortY,
      draw: () => drawCenterDriveTable(ctx, state.tick, state.isDriveOpen),
    },
    {
      y: kitchenDiningNorthChairsSortY,
      draw: () => drawKitchenDiningNorthChairs(ctx),
    },
    {
      y: kitchenDiningTableSortY,
      draw: () => drawKitchenDiningTable(ctx, state.tick),
    },
    {
      y: kitchenDiningSouthSeatSortY,
      draw: () => drawKitchenDiningSouthChairSeatPads(ctx),
    },
    {
      y: kitchenDiningSouthBackrestSortY,
      draw: () => drawKitchenDiningSouthChairBackrests(ctx),
    },
    {
      y: showerGlassSortY,
      draw: () => drawGlassShowerEnclosure(ctx, state.tick, state.player),
    },
    {
      y: porchRailingSortY,
      draw: () => drawSouthRoomsForeground(ctx, state.tick),
    },
    {
      y: MAILBOX_RECT.y + MAILBOX_RECT.h - 2,
      draw: () =>
        drawRoadsideMailbox(
          ctx,
          state.tick,
          state.mailboxUnreadCount ?? 0,
          Boolean(state.isMailboxOpen),
          Boolean(state.mailboxFreshArrival)
        ),
    },
    {
      y: state.antigravityNpc?.y ?? AGY_POS.y,
      draw: () =>
        drawAntigravityNpc(
          ctx,
          state.player,
          state.tick,
          Boolean(state.isAntigravityOpen),
          state.antigravityNpc
        ),
    },
    {
      y: state.aiStudioNpc?.y ?? AISTUDIO_POS.y,
      draw: () =>
        drawAiStudioNpc(
          ctx,
          state.player,
          state.tick,
          Boolean(state.isAiStudioOpen),
          state.characterStatuses?.ai_studio,
          state.aiStudioNpc
        ),
    },
  ];
  if (!minaBehindDesk) {
    drawList.push({
      y: state.mina.y,
      draw: () => drawMinaNpc(ctx, state.mina, state.assistantMood, state.tick),
    });
  }
  if (state.greenCar) {
    const carSnap = state.greenCar;
    drawList.push({
      y: carSnap.y + 18,
      draw: () => drawGreenCar(ctx, carSnap, state.timeOfDay, state.tick),
    });
  }
  drawList.sort((a, b) => a.y - b.y);
  for (const item of drawList) {
    item.draw();
  }

  // 6. Cozy dynamic lighting
  drawAtmosphereLighting(
    ctx,
    state.timeOfDay,
    state.tick,
    tvScreenActive,
    state.mailboxUnreadCount ?? 0,
    isSleepingInBed
  );

  // 6b. Bedroom-only lights-off dimming + window moonlight + Zzz when sleeping in bed
  if (isSleepingInBed) {
    drawBedroomSleepDarkness(ctx, state.tick);
  }

  // 7. Interactable highlight (suppresses duplicate floating [E] tag for AI characters whose plate includes [E])
  const mailboxUnread = state.mailboxUnreadCount ?? 0;
  const isNearMailbox =
    Boolean(state.nearestInteractable) &&
    state.nearestInteractable?.id === 'mailbox' &&
    !state.isWorking &&
    !state.isTvOn;
  const isNearSleepLog =
    Boolean(state.nearestInteractable) &&
    state.nearestInteractable?.id === 'sleep_log' &&
    !state.isWorking &&
    !state.isTvOn;
  const isNearPorchPlants =
    Boolean(state.nearestInteractable) &&
    state.nearestInteractable?.id === 'porch_plants' &&
    !state.isWorking &&
    !state.isTvOn;

  if (state.nearestInteractable && !state.isWorking && !state.isTvOn) {
    const isCharacterStation =
      state.nearestInteractable.id === 'mina_desk' ||
      state.nearestInteractable.id === 'antigravity_desk' ||
      state.nearestInteractable.id === 'ai_studio_desk';
    const displayItem =
      state.nearestInteractable.id === 'mailbox' && mailboxUnread > 0
        ? {
            ...state.nearestInteractable,
            actionLabel: `เปิดอ่าน Gmail (${mailboxUnread > 99 ? '99+' : mailboxUnread} ใหม่)`,
          }
        : state.nearestInteractable.id === 'sleep_log'
          ? {
              ...state.nearestInteractable,
              actionLabel: state.hasLoggedTodaySleep
                ? state.todaySleepLabel
                  ? `${state.todaySleepLabel} · ดูผล/อัปโหลดเพิ่ม`
                  : 'บันทึกการนอนแล้ว · ดูผล (.json)'
                : 'ยังไม่ได้บันทึกการนอนวันนี้ (อัปโหลด .json)',
            }
          : state.nearestInteractable.id === 'porch_plants'
            ? {
                ...state.nearestInteractable,
                actionLabel: state.hasWateredPlantsToday
                  ? 'รดน้ำแล้ววันนี้ · รดน้ำเพิ่มอีกครั้ง'
                  : 'รดน้ำต้นไม้ทั้ง 5 ต้น (ภารกิจประจำวัน)',
              }
            : state.nearestInteractable;
    drawInteractableHighlight(ctx, displayItem, state.tick, isCharacterStation);
  }

  // 7b. Roadside Mailbox incoming Gmail notification badge (merges cleanly when player is adjacent)
  drawRoadsideMailboxNotification(
    ctx,
    state.tick,
    mailboxUnread,
    Boolean(state.mailboxFreshArrival),
    isNearMailbox
  );

  // 7c. Master Bedroom Daily Sleep Quest badge (merges cleanly when player is adjacent)
  drawBedroomSleepQuestBadge(
    ctx,
    state.tick,
    Boolean(state.hasLoggedTodaySleep),
    state.todaySleepLabel ?? null,
    isNearSleepLog
  );

  // 7d. Front Porch 5 Potted Plants Daily Watering Quest badge (merges cleanly when player is adjacent)
  drawPorchPlantQuestBadge(
    ctx,
    state.tick,
    Boolean(state.hasWateredPlantsToday),
    state.todayPlantWaterLabel ?? null,
    isNearPorchPlants || (state.plantWateringProgress ?? 0) > 0
  );

  // 7e. Living Room antique grandfather pendulum clock Activity Mode chime nameplate
  if (state.clockAnnouncement) {
    drawPendulumClockAnnouncement(
      ctx,
      CORE_OFFSET_X + 6.12 * TILE,
      14,
      state.clockAnnouncement.title,
      state.clockAnnouncement.startTimeLabel,
      state.tick,
      Math.max(0, Date.now() - state.clockAnnouncement.triggeredAt)
    );
  }

  // 8. Proximity-only, single-character, bottom-to-top non-overlapping overhead status plate & bubble
  drawActiveCharacterOverlay(ctx, state);

  // 9. World-space hover inspect highlight outline
  if (state.inspectHover) {
    drawInspectHighlight(ctx, state.inspectHover, state.tick);
  }

  ctx.restore();

  // 10. Screen-space subtle dwell progress ring near cursor during 2-second hover
  if (state.inspectHover && !state.inspectHover.revealed && state.inspectHover.progress > 0) {
    drawInspectDwellRing(ctx, state.inspectHover, viewW, viewH);
  }
}
