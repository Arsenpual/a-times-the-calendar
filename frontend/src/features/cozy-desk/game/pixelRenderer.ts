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
  camera: CameraTransform;
  inspectHover?: InspectHoverRenderState | null;
  viewW?: number;
  viewH?: number;
  baseScale?: number;
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

// Local column constants for the Living Room + Home Office core (drawn translated by +CORE_OFFSET_X)
const LOCAL_DIVIDER_COL = 10;
const LOCAL_OFFICE_EAST_COL = 23;
const LOCAL_UPPER_W = 24 * TILE;

function drawWoodFloor(ctx: CanvasRenderingContext2D) {
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

function drawWalls(
  ctx: CanvasRenderingContext2D,
  timeOfDay: TimeOfDay,
  tick: number,
  extraPinCount: number,
  isPinboardActive: boolean
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
  drawPendulumClock(ctx, 6.12 * TILE, 14, tick);

  // Cozy fireplace in living room (cols 7..8.8)
  drawFireplace(ctx, 7.0 * TILE, 16, tick);

  // Unobstructed Cork Pinboard in North-West Planning Zone of expanded Home Office (cols 12.15..15.15)
  drawPinboard(ctx, 12.15 * TILE, 15, 3.0 * TILE, 29, extraPinCount, isPinboardActive, tick);
}

function drawPendulumClock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tick: number
) {
  const cx = Math.round(x + 11);
  // Floor drop shadow at base
  pxRect(ctx, x + 1, y + 64, 21, 5, 'rgba(28,20,15,0.28)');

  // Ornate carved swan-neck crown & golden brass finial
  pxRect(ctx, x + 3, y + 2, 17, 5, '#4A2818');
  pxRect(ctx, x + 5, y + 1, 5, 3, '#6B3D24');
  pxRect(ctx, x + 13, y + 1, 5, 3, '#6B3D24');
  pxRect(ctx, x + 10, y - 2, 3, 4, '#E9C46A'); // Brass top finial
  pxRect(ctx, x + 11, y - 3, 1, 2, '#FFF3BE');

  // Upper clock hood housing
  pxRect(ctx, x + 1, y + 6, 21, 20, '#4E2B19');
  pxRect(ctx, x + 3, y + 8, 17, 16, '#6E4027');

  // Ornate gold bezel & ivory clock face
  pxRect(ctx, x + 4, y + 9, 15, 14, '#C99A49');
  pxRect(ctx, x + 5, y + 10, 13, 12, '#FAF6F0');
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
  const swingAngle = Math.sin(tick * 0.065) * 0.28;
  const pivotX = cx + 0.5;
  const pivotY = y + 30;
  const rodLen = 17;
  const bobX = pivotX + Math.sin(swingAngle) * rodLen;
  const bobY = pivotY + Math.cos(swingAngle) * rodLen;

  ctx.save();
  ctx.strokeStyle = '#C99A49';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(bobX, bobY);
  ctx.stroke();
  ctx.restore();

  const bx = Math.round(bobX) - 2;
  const by = Math.round(bobY) - 2;
  pxRect(ctx, bx, by, 5, 5, '#D4A03E'); // Brass bob disc
  pxRect(ctx, bx + 1, by + 1, 3, 3, '#F5CB69');
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

function drawChristmasWallGarland(
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

function drawWindow(
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

function drawFireplace(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number) {
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

function drawPinboard(
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

function drawRugs(ctx: CanvasRenderingContext2D) {
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

function drawMinaProximityZone(
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

function drawAntigravityProximityZone(
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

function drawAiStudioProximityZone(
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

function drawPottedPlant(ctx: CanvasRenderingContext2D, x: number, y: number, variant: 'monstera' | 'fern') {
  // Shadow
  pxRect(ctx, x + 3, y + 22, 22, 6, 'rgba(30,20,14,0.25)');
  // Terracotta pot
  pxRect(ctx, x + 6, y + 14, 16, 12, '#B65D3B');
  pxRect(ctx, x + 4, y + 12, 20, 4, '#CC6E4A');
  pxRect(ctx, x + 7, y + 14, 14, 2, '#4A3121');
  // Leaves
  if (variant === 'monstera') {
    pxRect(ctx, x + 2, y + 3, 10, 10, '#3D6B4F');
    pxRect(ctx, x + 13, y + 1, 12, 11, '#4D8461');
    pxRect(ctx, x + 8, y + 6, 11, 9, '#5E9C74');
    pxRect(ctx, x + 4, y + 5, 4, 3, '#72B389');
  } else {
    pxRect(ctx, x + 3, y + 4, 22, 9, '#4D7C6F');
    pxRect(ctx, x + 6, y + 1, 16, 10, '#629888');
    pxRect(ctx, x + 10, y + 3, 8, 5, '#7BB3A2');
  }
}

function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  pxRect(ctx, x, y + h - 4, 32, 6, 'rgba(28,20,15,0.28)');
  pxRect(ctx, x, y, 32, h, '#5D3C27');
  pxRect(ctx, x + 3, y + 3, 26, h - 6, '#3F2718');

  const shelfColors = ['#C85A3F', '#5E8C7A', '#E2A84B', '#4B6B8A', '#D9C5A3', '#8C5E58'];
  const shelves = Math.floor((h - 8) / 14);
  for (let s = 0; s < shelves; s++) {
    const sy = y + 5 + s * 14;
    pxRect(ctx, x + 3, sy + 11, 26, 3, '#6F4930');
    for (let b = 0; b < 5; b++) {
      const bx = x + 5 + b * 5;
      const bh = 8 + ((s + b) % 3);
      pxRect(ctx, bx, sy + (11 - bh), 4, bh, shelfColors[(s * 3 + b) % shelfColors.length]);
    }
  }
}

function drawChristmasTree(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number) {
  // Soft festive tree skirt & drop shadow on floor
  pxRect(ctx, x + 2, y + 40, 42, 10, 'rgba(28, 20, 15, 0.26)');
  pxRect(ctx, x + 5, y + 38, 36, 9, '#B91C1C'); // Red tree skirt
  pxRect(ctx, x + 7, y + 39, 32, 7, '#DC2626');
  pxRect(ctx, x + 9, y + 40, 28, 5, '#FDE047'); // Gold trim inner ring

  // Sturdy wooden trunk
  pxRect(ctx, x + 19, y + 32, 8, 9, '#5C3A21');
  pxRect(ctx, x + 21, y + 32, 3, 9, '#7A4E2D');

  // Layered evergreen pine tiers (bottom to top) with snowy tips
  // Tier 1 (bottom)
  pxRect(ctx, x + 4, y + 25, 38, 10, '#1B4332');
  pxRect(ctx, x + 6, y + 24, 34, 9, '#2D6A4F');
  pxRect(ctx, x + 5, y + 33, 7, 2, '#F1F5F9');
  pxRect(ctx, x + 34, y + 33, 7, 2, '#F1F5F9');

  // Tier 2
  pxRect(ctx, x + 7, y + 17, 32, 10, '#1B4332');
  pxRect(ctx, x + 9, y + 16, 28, 9, '#2D6A4F');
  pxRect(ctx, x + 11, y + 17, 24, 6, '#40916C');
  pxRect(ctx, x + 8, y + 25, 6, 2, '#F1F5F9');
  pxRect(ctx, x + 32, y + 25, 6, 2, '#F1F5F9');

  // Tier 3
  pxRect(ctx, x + 11, y + 9, 24, 10, '#1B4332');
  pxRect(ctx, x + 13, y + 8, 20, 9, '#2D6A4F');
  pxRect(ctx, x + 15, y + 9, 16, 6, '#40916C');
  pxRect(ctx, x + 12, y + 17, 5, 2, '#F1F5F9');
  pxRect(ctx, x + 29, y + 17, 5, 2, '#F1F5F9');

  // Tier 4 (crown)
  pxRect(ctx, x + 15, y + 2, 16, 8, '#2D6A4F');
  pxRect(ctx, x + 17, y + 0, 12, 7, '#40916C');
  pxRect(ctx, x + 19, y - 3, 8, 5, '#52B788');

  // Golden tinsel garland ribbons draping diagonally across boughs
  pxRect(ctx, x + 15, y + 12, 15, 2, '#E9C46A');
  pxRect(ctx, x + 11, y + 21, 23, 2, '#E9C46A');
  pxRect(ctx, x + 8, y + 30, 29, 2, '#E9C46A');

  // Glowing golden star topper
  const starPulse = Math.floor(tick / 10) % 2 === 0;
  pxRect(ctx, x + 20, y - 8, 6, 6, '#F59E0B');
  pxRect(ctx, x + 21, y - 9, 4, 8, '#FACC15');
  pxRect(ctx, x + 19, y - 7, 8, 4, '#FACC15');
  pxRect(ctx, x + 22, y - 6, 2, 2, '#FEF9C3');
  if (starPulse) {
    pxRect(ctx, x + 17, y - 10, 12, 10, 'rgba(254, 240, 138, 0.25)');
  }

  // Colorful ornaments & twinkling fairy lights
  const ornaments = [
    { ox: 18, oy: 4, c: '#EF4444' },
    { ox: 26, oy: 6, c: '#38BDF8' },
    { ox: 14, oy: 14, c: '#FACC15' },
    { ox: 23, oy: 15, c: '#EF4444' },
    { ox: 30, oy: 13, c: '#FB923C' },
    { ox: 10, oy: 23, c: '#38BDF8' },
    { ox: 19, oy: 24, c: '#F472B6' },
    { ox: 27, oy: 22, c: '#FACC15' },
    { ox: 34, oy: 24, c: '#EF4444' },
    { ox: 9, oy: 31, c: '#FACC15' },
    { ox: 17, oy: 32, c: '#EF4444' },
    { ox: 26, oy: 31, c: '#60A5FA' },
    { ox: 35, oy: 32, c: '#4ADE80' },
  ];
  const phase = Math.floor(tick / 9);
  ornaments.forEach((o, i) => {
    const twinkle = (i + phase) % 3 === 0;
    pxRect(ctx, x + o.ox, y + o.oy, 3, 3, twinkle ? '#FEF9C3' : o.c);
  });

  // Wrapped Christmas gift boxes tucked under the tree
  // Gift 1: Red box with gold ribbon (left)
  pxRect(ctx, x + 2, y + 38, 11, 9, '#DC2626');
  pxRect(ctx, x + 6, y + 38, 2, 9, '#FACC15');
  pxRect(ctx, x + 2, y + 41, 11, 2, '#FACC15');
  pxRect(ctx, x + 5, y + 36, 4, 2, '#FDE047');

  // Gift 2: Emerald box with red ribbon (right)
  pxRect(ctx, x + 31, y + 37, 12, 10, '#15803D');
  pxRect(ctx, x + 36, y + 37, 2, 10, '#EF4444');
  pxRect(ctx, x + 31, y + 41, 12, 2, '#EF4444');
  pxRect(ctx, x + 35, y + 35, 4, 2, '#F87171');

  // Gift 3: Small blue gift box (center-front)
  pxRect(ctx, x + 17, y + 41, 9, 7, '#2563EB');
  pxRect(ctx, x + 21, y + 41, 2, 7, '#F8FAFC');
  pxRect(ctx, x + 17, y + 44, 9, 2, '#F8FAFC');
}

function drawLivingFurniture(ctx: CanvasRenderingContext2D, tick: number, isTvOn: boolean) {
  // Top-left potted plant replaced with festive decorated Christmas Tree & gifts
  drawChristmasTree(ctx, 1.15 * TILE, 2.0 * TILE, tick);
  drawPottedPlant(ctx, 1.2 * TILE, 10.1 * TILE, 'monstera');
  // Red holiday bow on bottom-left potted plant
  pxRect(ctx, 1.2 * TILE + 11, 10.1 * TILE + 15, 6, 3, '#DC2626');
  pxRect(ctx, 1.2 * TILE + 13, 10.1 * TILE + 18, 2, 3, '#B91C1C');

  // Bookshelf with miniature holiday topper accents
  drawBookshelf(ctx, 8.9 * TILE, 2.0 * TILE, 48);
  pxRect(ctx, 8.9 * TILE + 4, 2.0 * TILE - 5, 7, 5, '#DC2626'); // Tiny gift on bookshelf
  pxRect(ctx, 8.9 * TILE + 7, 2.0 * TILE - 5, 1, 5, '#FACC15');
  pxRect(ctx, 8.9 * TILE + 20, 2.0 * TILE - 6, 6, 6, '#2D6A4F'); // Tiny mini pine tree

  // Cozy cream sofa (x: 2.1*32, y: 4.5*32, w: 3.1*32, h: 1.25*32)
  const sx = 2.1 * TILE;
  const sy = 4.5 * TILE;
  const sw = 3.1 * TILE;
  const sh = 1.25 * TILE;
  pxRect(ctx, sx + 2, sy + sh - 2, sw - 4, 6, 'rgba(30,20,14,0.25)');
  // Wooden sofa legs & frame
  pxRect(ctx, sx, sy, sw, sh, '#C8B9A3');
  pxRect(ctx, sx + 3, sy + 3, sw - 6, 12, '#DFD2BE'); // Backrest
  pxRect(ctx, sx, sy + 4, 10, sh - 6, '#D6C8B2'); // Left arm
  pxRect(ctx, sx + sw - 10, sy + 4, 10, sh - 6, '#D6C8B2'); // Right arm
  // Seat cushions
  pxRect(ctx, sx + 11, sy + 15, (sw - 24) / 2, sh - 19, '#EFE6D8');
  pxRect(ctx, sx + 13 + (sw - 24) / 2, sy + 15, (sw - 24) / 2, sh - 19, '#EFE6D8');
  // Christmas accent pillows (pine green & holiday crimson with gold stripe)
  pxRect(ctx, sx + 13, sy + 9, 14, 10, '#2D6A4F');
  pxRect(ctx, sx + 19, sy + 9, 2, 10, '#E9C46A');
  pxRect(ctx, sx + sw - 29, sy + 9, 14, 10, '#C53030');
  pxRect(ctx, sx + sw - 29, sy + 13, 14, 2, '#F8FAFC');
  // Festive red-and-gold tartan throw blanket on arm
  pxRect(ctx, sx + sw - 11, sy + 12, 11, 18, '#B91C1C');
  pxRect(ctx, sx + sw - 11, sy + 16, 11, 3, '#2D6A4F');
  pxRect(ctx, sx + sw - 11, sy + 22, 11, 2, '#E9C46A');

  // Coffee table (x: 2.5*32, y: 6.7*32, w: 2.3*32, h: 1.1*32)
  const tx = 2.5 * TILE;
  const ty = 6.7 * TILE;
  const tw = 2.3 * TILE;
  const th = 1.1 * TILE;
  pxRect(ctx, tx + 3, ty + th, tw - 6, 5, 'rgba(30,20,14,0.25)');
  pxRect(ctx, tx, ty, tw, th, '#6A442A');
  pxRect(ctx, tx + 3, ty + 3, tw - 6, th - 8, '#855838');
  pxRect(ctx, tx + 4, ty + 4, tw - 8, 2, '#9E6B47');
  // Festive crimson & gold table runner
  pxRect(ctx, tx + 10, ty + 6, tw - 20, th - 14, '#9B2C2C');
  pxRect(ctx, tx + 12, ty + 8, tw - 24, th - 18, '#B91C1C');
  // Holiday plate with gingerbread cookies & candy cane on table
  pxRect(ctx, tx + 42, ty + 9, 18, 13, '#FAF6F0');
  pxRect(ctx, tx + 44, ty + 11, 14, 9, '#E2DDD5');
  pxRect(ctx, tx + 45, ty + 12, 5, 5, '#B46938'); // Gingerbread cookie
  pxRect(ctx, tx + 51, ty + 13, 5, 3, '#DC2626'); // Candy cane
  pxRect(ctx, tx + 53, ty + 13, 2, 3, '#FFFFFF');
  // Small glowing holiday candle centerpiece
  pxRect(ctx, tx + 31, ty + 11, 5, 7, '#FAF6F0');
  pxRect(ctx, tx + 30, ty + 16, 7, 3, '#2D6A4F');
  pxRect(ctx, tx + 33, ty + 8, 2, 3, '#FACC15');
  // Steaming festive red hot cocoa mug with marshmallows
  const mugX = tx + 14;
  const mugY = ty + 11;
  pxRect(ctx, mugX, mugY, 10, 10, '#DC2626');
  pxRect(ctx, mugX + 2, mugY + 2, 6, 5, '#593722');
  pxRect(ctx, mugX + 3, mugY + 3, 2, 2, '#FAF6F0'); // Mini marshmallow
  pxRect(ctx, mugX + 6, mugY + 4, 2, 2, '#FAF6F0');
  pxRect(ctx, mugX + 10, mugY + 3, 3, 5, '#DC2626');
  // Animated rising pixel steam
  const steamOffset = Math.floor(tick / 14) % 4;
  pxRect(ctx, mugX + 3 + (steamOffset % 2), mugY - 3 - steamOffset, 2, 3, 'rgba(255,250,240,0.65)');
  pxRect(ctx, mugX + 6 - (steamOffset % 2), mugY - 6 - ((steamOffset + 2) % 4), 2, 3, 'rgba(255,250,240,0.5)');

  // Living room walnut TV media console & retro-modern pixel TV (x: 2.5*32, y: 10.55*32, w: 2.4*32, h: 1.15*32)
  const tvx = 2.5 * TILE;
  const tvy = 10.55 * TILE;
  const tvw = 2.4 * TILE;
  const tvh = 1.15 * TILE;
  // Floor shadow
  pxRect(ctx, tvx + 2, tvy + tvh - 1, tvw - 4, 5, 'rgba(28,20,15,0.28)');
  // Walnut lowboard cabinet
  pxRect(ctx, tvx, tvy + 10, tvw, tvh - 10, '#5A3A24');
  pxRect(ctx, tvx + 2, tvy + 12, tvw - 4, tvh - 14, '#7A5033');
  pxRect(ctx, tvx + 3, tvy + 12, tvw - 6, 2, '#966544');
  // Cabinet shelf dividers & tiny media box
  pxRect(ctx, tvx + 6, tvy + 22, 24, 10, '#462C1B');
  pxRect(ctx, tvx + 46, tvy + 22, 24, 10, '#462C1B');
  pxRect(ctx, tvx + 33, tvy + 23, 10, 6, '#2D2825');
  // TV stand & bezel facing north/sofa
  pxRect(ctx, tvx + 28, tvy + 14, 20, 4, '#2A2522');
  pxRect(ctx, tvx + 10, tvy - 2, 56, 20, '#24201D');
  pxRect(ctx, tvx + 12, tvy, 52, 16, '#342F2C');
  // TV screen surface (animated cozy colors + subtle twinkling sparkles when on, dimmed standby when off)
  const framePhase = Math.floor(tick / 14) % 3;
  const twinklePhase = Math.floor(tick / 6) % 6;
  if (isTvOn) {
    pxRect(ctx, tvx + 14, tvy + 2, 48, 12, '#24455E');
    pxRect(ctx, tvx + 16, tvy + 4, 20, 8, framePhase === 0 ? '#E88D4F' : framePhase === 1 ? '#F2B866' : '#D96B43');
    pxRect(ctx, tvx + 38, tvy + 4, 22, 4, framePhase === 1 ? '#A5D8F3' : '#8ECAE6');
    pxRect(ctx, tvx + 38, tvy + 9, 16, 3, framePhase === 2 ? '#C2E8D8' : '#A7D7C5');
    // Subtle twinkling pixel glints across the TV screen
    if (twinklePhase % 2 === 0) {
      pxRect(ctx, tvx + 19 + (twinklePhase * 5) % 36, tvy + 3 + (twinklePhase % 3) * 3, 2, 2, 'rgba(255, 250, 225, 0.85)');
    }
    if (twinklePhase === 1 || twinklePhase === 4) {
      pxRect(ctx, tvx + 48 - (twinklePhase * 3), tvy + 5, 2, 2, 'rgba(186, 230, 253, 0.9)');
    }
    // Soft luminous screen shimmer halo above TV rim
    const rimAlpha = (0.14 + Math.sin(tick * 0.22) * 0.06).toFixed(3);
    pxRect(ctx, tvx + 13, tvy - 3, 50, 3, `rgba(186, 230, 253, ${rimAlpha})`);
    // Active power LED
    pxRect(ctx, tvx + 60, tvy + 15, 3, 2, '#4ADE80');
  } else {
    pxRect(ctx, tvx + 14, tvy + 2, 48, 12, '#1E252B');
    // Subtle YouTube play glyph on standby screen
    pxRect(ctx, tvx + 32, tvy + 5, 12, 6, '#B84233');
    pxRect(ctx, tvx + 37, tvy + 6, 3, 4, '#FAF6F0');
    // Standby LED
    pxRect(ctx, tvx + 60, tvy + 15, 3, 2, '#E06D53');
  }
}

function drawOfficeFurniture(
  ctx: CanvasRenderingContext2D,
  assistantMood: AssistantMood,
  minaPhase: MinaNpcState['phase'],
  tick: number,
  isPlayerAtOwnDesk: boolean
) {
  // 1. North-West Office Potted Fern & North-East Double Reference Bookcase Library
  drawPottedPlant(ctx, 11.18 * TILE, 2.08 * TILE, 'fern');
  drawBookshelf(ctx, 20.55 * TILE, 2.08 * TILE, 68);
  drawBookshelf(ctx, 21.75 * TILE, 2.08 * TILE, 68);
  // Decorative brass globe & reference archive box atop the double library bookcases
  pxRect(ctx, 20.55 * TILE + 8, 2.08 * TILE - 6, 12, 6, '#D4A359');
  pxRect(ctx, 21.75 * TILE + 10, 2.08 * TILE - 7, 8, 7, '#4D7C6F');

  // 2. West-Wall Walnut Refreshment & Reference Credenza (cols 11.15..12.1, rows 3.45..5.3)
  const crX = Math.round(11.15 * TILE);
  const crY = Math.round(3.45 * TILE);
  const crW = Math.round(0.95 * TILE); // ~30px
  const crH = Math.round(1.85 * TILE); // ~59px
  pxRect(ctx, crX + 2, crY + crH - 1, crW - 3, 5, 'rgba(28,20,15,0.25)');
  pxRect(ctx, crX, crY, crW, crH, '#563621');
  pxRect(ctx, crX + 2, crY + 2, crW - 5, crH - 6, '#875937');
  pxRect(ctx, crX + crW - 4, crY + 2, 2, crH - 6, '#A6724A');
  // Compact office espresso brewer & glass carafe on top of credenza
  pxRect(ctx, crX + 5, crY + 6, 14, 15, '#2B2826');
  pxRect(ctx, crX + 7, crY + 8, 10, 5, '#4A4542');
  pxRect(ctx, crX + 9, crY + 14, 6, 5, '#7C4A2D'); // Coffee pot
  pxRect(ctx, crX + 16, crY + 9, 2, 2, '#4ADE80'); // Ready indicator LED
  // Ceramic mugs & reference binders on lower part of credenza
  pxRect(ctx, crX + 7, crY + 26, 6, 6, '#FAF6F0');
  pxRect(ctx, crX + 15, crY + 28, 6, 6, '#E2A84B');
  pxRect(ctx, crX + 6, crY + 39, 16, 12, '#3B5B7C');
  pxRect(ctx, crX + 8, crY + 42, 12, 6, '#C85A3F');

  // 3. Player Ergonomic Swivel Chair (tucked closely in front of executive desk, centered on monitor)
  const chX = Math.round(WORK_SEAT_POS.x - CORE_OFFSET_X) - 14;
  const chY = Math.round(WORK_SEAT_POS.y) - 14;
  pxRect(ctx, chX + 4, chY + 18, 20, 5, 'rgba(28,20,15,0.24)');
  pxRect(ctx, chX + 6, chY + 13, 16, 8, '#4A3F38');
  pxRect(ctx, chX + 5, chY + 3, 18, 12, '#7D5A44');
  pxRect(ctx, chX + 7, chY + 5, 14, 8, '#9A7259');

  // 4. Player Wide Oak Executive Work Desk (north-center bay: x: 15.65*32, y: 2.95*32, w: 4.1*32, h: 1.55*32)
  const dx = 15.65 * TILE;
  const dy = 2.95 * TILE;
  const dw = 4.1 * TILE;
  const dh = 1.55 * TILE;
  pxRect(ctx, dx + 2, dy + dh, dw - 4, 6, 'rgba(28,20,15,0.28)');
  pxRect(ctx, dx, dy, dw, dh, '#5C3A22');
  pxRect(ctx, dx + 3, dy + 3, dw - 6, dh - 10, '#8C5C38');
  pxRect(ctx, dx + 4, dy + 4, dw - 8, 3, '#A6724A');
  // Front drawers detail
  pxRect(ctx, dx + 4, dy + dh - 7, 28, 5, '#6D462B');
  pxRect(ctx, dx + dw - 32, dy + dh - 7, 28, 5, '#6D462B');

  // Warm brass desk lamp on left edge of player desk
  pxRect(ctx, dx + 9, dy + 22, 12, 6, '#593C28');
  pxRect(ctx, dx + 13, dy + 12, 3, 11, '#B08948');
  pxRect(ctx, dx + 7, dy + 5, 16, 10, '#F5B841');
  pxRect(ctx, dx + 9, dy + 7, 12, 6, '#FFF1B8');

  // Player Personal Computer Monitor (centered on WORK_SEAT_POS.x)
  const mx = dx + 42;
  const my = dy + 4;
  pxRect(ctx, mx + 12, my + 22, 14, 5, '#3E3A37');
  pxRect(ctx, mx, my, 38, 23, '#2E2B29');
  const screenBg = isPlayerAtOwnDesk ? '#1D3B52' : '#26343B';
  pxRect(ctx, mx + 3, my + 3, 32, 17, screenBg);
  const pulse = Math.floor(tick / 10) % 4;
  pxRect(ctx, mx + 6, my + 6, 14 + (isPlayerAtOwnDesk ? (pulse % 2) * 3 : 0), 2, '#7DD3FC');
  pxRect(ctx, mx + 6, my + 10, 22 - (isPlayerAtOwnDesk ? pulse * 2 : 0), 2, '#FDE68A');
  pxRect(ctx, mx + 6, my + 14, 18, 2, '#86EFAC');
  if (isPlayerAtOwnDesk && pulse % 2 === 0) {
    pxRect(ctx, mx + 26, my + 14, 4, 2, '#FAF6F0');
  }

  // Player keyboard & mouse
  pxRect(ctx, mx + 5, dy + 31, 24, 7, '#3D3733');
  pxRect(ctx, mx + 7, dy + 33, 20, 3, '#D6CEC4');
  pxRect(ctx, mx + 33, dy + 32, 6, 7, '#D6CEC4');

  // Notepad & pen on right side of player desk
  pxRect(ctx, dx + 93, dy + 16, 18, 14, '#FAF6F0');
  pxRect(ctx, dx + 96, dy + 19, 12, 2, '#94A3B8');
  pxRect(ctx, dx + 96, dy + 23, 9, 2, '#94A3B8');
  pxRect(ctx, dx + 114, dy + 18, 3, 12, '#D97736');

  // =========================================================================
  // MINA'S EAST-WING AI ASSISTANT SUITE & FULL OFFICE EQUIPMENT
  // =========================================================================

  // 1. Office Multifunction Printer & Scanner Stand (north side of Mina's desk)
  const px = 21.55 * TILE;
  const py = 4.8 * TILE;
  const pw = 1.3 * TILE;
  const ph = 1.1 * TILE;
  pxRect(ctx, px + 2, py + ph - 1, pw - 4, 5, 'rgba(28,20,15,0.25)');
  // Wooden printer cart
  pxRect(ctx, px, py + 4, pw, ph - 4, '#5E3D27');
  pxRect(ctx, px + 3, py + 6, pw - 6, ph - 9, '#7C5337');
  // Reams of white A4 paper tucked on lower shelf
  pxRect(ctx, px + 6, py + ph - 9, 14, 5, '#FAF6F0');
  pxRect(ctx, px + 22, py + ph - 9, 12, 5, '#E2DDD5');
  // Printer body & flatbed scanner lid
  pxRect(ctx, px + 4, py + 2, pw - 8, 18, '#DDD6CA');
  pxRect(ctx, px + 6, py + 4, pw - 12, 10, '#3D3936'); // Scanner cover
  pxRect(ctx, px + 8, py + 6, pw - 16, 2, '#57524E');
  // Protruding white printed sheet & status LED
  pxRect(ctx, px + 1, py + 11, 7, 7, '#FAF6F0');
  pxRect(ctx, px + 3, py + 13, 3, 1, '#94A3B8');
  pxRect(ctx, px + 3, py + 15, 3, 1, '#94A3B8');
  pxRect(ctx, px + pw - 9, py + 15, 3, 2, Math.floor(tick / 25) % 2 === 0 ? '#4ADE80' : '#22C55E');

  // 2. Mina's Ergonomic Swivel Office Chair (at MINA_POS, facing right toward her computer)
  const mcX = Math.round(MINA_POS.x - CORE_OFFSET_X);
  const mcY = Math.round(MINA_POS.y);
  pxRect(ctx, mcX - 10, mcY + 8, 20, 6, 'rgba(28,20,15,0.26)');
  // Rolling caster base
  pxRect(ctx, mcX - 7, mcY + 7, 14, 3, '#3B342F');
  pxRect(ctx, mcX - 2, mcY + 5, 4, 6, '#2D2723');
  // Seat cushion (warm sage-teal office chair)
  pxRect(ctx, mcX - 8, mcY - 3, 16, 11, '#3D6358');
  pxRect(ctx, mcX - 6, mcY - 1, 12, 7, '#4F7E70');
  // Ergonomic backrest on the LEFT side (Mina faces right toward her desk)
  pxRect(ctx, mcX - 11, mcY - 7, 5, 16, '#2E4C43');
  pxRect(ctx, mcX - 10, mcY - 5, 3, 12, '#5C8F80');

  // 3. Mina's Dedicated Oak & Walnut AI Workstation Desk (East wall, vertical orientation)
  const mdx = 21.25 * TILE;
  const mdy = 6.15 * TILE;
  const mdw = 1.6 * TILE;
  const mdh = 3.25 * TILE;
  pxRect(ctx, mdx + 2, mdy + mdh, mdw - 3, 6, 'rgba(28,20,15,0.28)');
  // Desk frame & walnut top
  pxRect(ctx, mdx, mdy, mdw, mdh, '#563621');
  pxRect(ctx, mdx + 3, mdy + 3, mdw - 6, mdh - 8, '#875937');
  pxRect(ctx, mdx + 3, mdy + 3, 3, mdh - 8, '#A16E48'); // Left bevel highlight
  // Under-desk side drawer edge
  pxRect(ctx, mdx + 4, mdy + mdh - 6, mdw - 8, 4, '#6A4429');

  // Desk Lamp (top-right corner of Mina's desk)
  pxRect(ctx, mdx + mdw - 16, mdy + 6, 10, 10, '#593C28');
  pxRect(ctx, mdx + mdw - 13, mdy + 9, 4, 4, '#B08948');
  pxRect(ctx, mdx + mdw - 22, mdy + 5, 12, 11, '#F5B841');
  pxRect(ctx, mdx + mdw - 20, mdy + 7, 8, 7, '#FFF3BE');

  // Stationery Organizer / Pen Cup & Sticky Notes (upper-left of Mina's desk)
  pxRect(ctx, mdx + 6, mdy + 7, 9, 9, '#EFE5D5');
  pxRect(ctx, mdx + 7, mdy + 4, 2, 5, '#DC2626'); // Red pen
  pxRect(ctx, mdx + 10, mdy + 3, 2, 6, '#2563EB'); // Blue pen
  pxRect(ctx, mdx + 13, mdy + 5, 2, 4, '#D97706'); // Highlighter
  pxRect(ctx, mdx + 6, mdy + 19, 10, 8, '#FEF08A'); // Yellow sticky note pad
  pxRect(ctx, mdx + 7, mdy + 21, 7, 1, '#B45309');

  // Secondary Tablet / Reference Screen (upper-right, angled beside monitor)
  pxRect(ctx, mdx + 26, mdy + 19, 16, 12, '#2B2826');
  pxRect(ctx, mdx + 28, mdy + 21, 12, 8, '#1E3A4C');
  pxRect(ctx, mdx + 30, mdy + 23, 8, 2, '#93C5FD');
  pxRect(ctx, mdx + 30, mdy + 26, 6, 2, '#86EFAC');

  // Main Widescreen Computer Monitor (center-right of Mina's desk, facing left toward Mina)
  const monX = mdx + 28;
  const monY = mdy + 35;
  pxRect(ctx, monX + 9, monY + 11, 7, 12, '#3C3733'); // Monitor stand arm
  pxRect(ctx, monX, monY, 13, 34, '#24211F'); // Monitor bezel
  const minaScreenActive = minaPhase === 'working_at_desk' || assistantMood === 'thinking';
  pxRect(ctx, monX + 2, monY + 2, 8, 30, minaScreenActive ? '#1D3B52' : '#243138');
  // Animated screen lines scrolling while Mina works at her desk
  const codePulse = Math.floor(tick / 8) % 4;
  pxRect(ctx, monX + 3, monY + 5, 5, 4 + (minaScreenActive ? (codePulse % 2) * 2 : 0), '#7DD3FC');
  pxRect(ctx, monX + 3, monY + 13, 5, 6, '#FDE68A');
  pxRect(ctx, monX + 3, monY + 22, 5, 5 + (minaScreenActive && codePulse > 1 ? 2 : 0), '#86EFAC');
  // Subtle monitor glow cast onto desk toward Mina
  if (minaScreenActive) {
    pxRect(ctx, monX - 4, monY + 3, 4, 28, 'rgba(125, 211, 252, 0.16)');
  }

  // Desk Mat + Mechanical Keyboard & Mouse (directly in front of Mina's chair)
  pxRect(ctx, mdx + 5, mdy + 34, 18, 36, '#47695D'); // Sage desk mat
  pxRect(ctx, mdx + 8, mdy + 39, 9, 20, '#2F2B28'); // Keyboard housing
  pxRect(ctx, mdx + 10, mdy + 41, 5, 16, '#E7E0D5'); // Keycaps
  pxRect(ctx, mdx + 9, mdy + 62, 6, 5, '#E7E0D5'); // Wireless mouse

  // Document Inbox Paper Tray & Warm Ceramic Mug (lower part of Mina's desk)
  pxRect(ctx, mdx + 22, mdy + 74, 22, 18, '#5C3C24'); // Wooden inbox tray
  pxRect(ctx, mdx + 24, mdy + 76, 18, 13, '#FAF6F0'); // Stacked docs
  pxRect(ctx, mdx + 26, mdy + 79, 13, 1, '#94A3B8');
  pxRect(ctx, mdx + 26, mdy + 82, 11, 1, '#94A3B8');
  pxRect(ctx, mdx + 26, mdy + 85, 9, 1, '#D97736');
  // Mina's ceramic teacup with gentle steam
  pxRect(ctx, mdx + 8, mdy + 78, 8, 8, '#FAF6F0');
  pxRect(ctx, mdx + 10, mdy + 80, 4, 4, '#7C4A2D');
  const cupSteam = Math.floor(tick / 16) % 3;
  pxRect(ctx, mdx + 11, mdy + 74 - cupSteam, 2, 2, 'rgba(255,250,240,0.55)');

  // 4. Rolling 3-Drawer Wooden Filing Cabinet + Office Binders (south side of Mina's desk)
  const fcx = 21.45 * TILE;
  const fcy = 9.55 * TILE;
  const fcw = 1.4 * TILE;
  const fch = 1.4 * TILE;
  pxRect(ctx, fcx + 2, fcy + fch - 1, fcw - 4, 5, 'rgba(28,20,15,0.26)');
  pxRect(ctx, fcx, fcy, fcw, fch, '#5B3A24');
  pxRect(ctx, fcx + 3, fcy + 3, fcw - 6, fch - 6, '#7C5336');
  // 3 Drawer fronts with brass handles
  pxRect(ctx, fcx + 4, fcy + 14, fcw - 8, 8, '#6D472D');
  pxRect(ctx, fcx + 4, fcy + 24, fcw - 8, 8, '#6D472D');
  pxRect(ctx, fcx + 4, fcy + 34, fcw - 8, 8, '#6D472D');
  pxRect(ctx, fcx + 16, fcy + 17, 10, 2, '#E2C69E');
  pxRect(ctx, fcx + 16, fcy + 27, 10, 2, '#E2C69E');
  pxRect(ctx, fcx + 16, fcy + 37, 10, 2, '#E2C69E');
  // Upright colorful binders & mini succulent on top of cabinet
  pxRect(ctx, fcx + 5, fcy + 3, 5, 10, '#C85A3F');
  pxRect(ctx, fcx + 11, fcy + 2, 5, 11, '#4D7C6F');
  pxRect(ctx, fcx + 17, fcy + 3, 5, 10, '#3B5B7C');
  pxRect(ctx, fcx + 23, fcy + 4, 5, 9, '#E2A84B');
  // Tiny potted succulent on corner
  pxRect(ctx, fcx + 31, fcy + 6, 7, 6, '#B65D3B');
  pxRect(ctx, fcx + 32, fcy + 3, 5, 4, '#5E9C74');

  // 5. Small Office Wastebasket tucked neatly beside the printer stand
  const bx = 20.92 * TILE;
  const by = 4.95 * TILE;
  pxRect(ctx, bx + 1, by + 14, 15, 4, 'rgba(28,20,15,0.22)');
  pxRect(ctx, bx + 1, by + 1, 15, 15, '#5C534C');
  pxRect(ctx, bx + 3, by + 3, 11, 11, '#3D3732');
  pxRect(ctx, bx + 5, by + 5, 4, 4, '#FAF6F0'); // Crumpled paper
  pxRect(ctx, bx + 9, by + 8, 3, 3, '#E8DFD3');

  // 5b. South-Wall Office Potted Monstera Plant (positioned neatly between Antigravity & AI Studio, clear of Gym doorway)
  drawPottedPlant(ctx, 14.55 * TILE, 10.85 * TILE, 'monstera');

  // =========================================================================
  // 6. ANTIGRAVITY LOCALHOST DEV STATION (south-west tech corner of Home Office)
  // =========================================================================
  const agx = Math.round(11.15 * TILE);
  const agy = Math.round(9.75 * TILE);
  const agw = Math.round(1.48 * TILE); // ~47
  const agh = Math.round(1.8 * TILE); // ~58

  // Swivel cyber-indigo developer chair at AGY_POS (facing left toward dual monitors)
  const acX = Math.round(AGY_POS.x - CORE_OFFSET_X);
  const acY = Math.round(AGY_POS.y);
  pxRect(ctx, acX - 10, acY + 8, 20, 6, 'rgba(28,20,15,0.26)');
  pxRect(ctx, acX - 7, acY + 7, 14, 3, '#2D3039');
  pxRect(ctx, acX - 2, acY + 5, 4, 6, '#1F2229');
  pxRect(ctx, acX - 8, acY - 3, 16, 11, '#313B5E');
  pxRect(ctx, acX - 6, acY - 1, 12, 7, '#435282');
  // Backrest on the RIGHT side (Antigravity faces left toward his localhost terminal desk)
  pxRect(ctx, acX + 6, acY - 7, 5, 16, '#232B47');
  pxRect(ctx, acX + 7, acY - 5, 3, 12, '#566BA8');

  // Dark slate & walnut developer terminal desk
  pxRect(ctx, agx + 2, agy + agh, agw - 4, 5, 'rgba(28,20,15,0.28)');
  pxRect(ctx, agx, agy, agw, agh, '#252936');
  pxRect(ctx, agx + 3, agy + 3, agw - 6, agh - 7, '#343A4D');
  pxRect(ctx, agx + agw - 5, agy + 3, 2, agh - 7, '#4D5775'); // Right edge highlight

  // Mini Localhost Server Tower on top-left corner with blinking activity LEDs
  pxRect(ctx, agx + 5, agy + 5, 14, 14, '#181B24');
  pxRect(ctx, agx + 7, agy + 7, 10, 2, '#38BDF8');
  const srvBlink = Math.floor(tick / 12) % 2 === 0;
  pxRect(ctx, agx + 7, agy + 11, 3, 2, srvBlink ? '#34D399' : '#10B981');
  pxRect(ctx, agx + 12, agy + 11, 3, 2, !srvBlink ? '#A78BFA' : '#6366F1');
  pxRect(ctx, agx + 7, agy + 15, 8, 1, '#475569');

  // Vertical Dual-Screen Dark Mode Terminal Monitor (facing right toward Antigravity)
  const tmx = agx + 6;
  const tmy = agy + 22;
  pxRect(ctx, tmx - 2, tmy + 9, 4, 10, '#1E222D'); // Stand arm
  pxRect(ctx, tmx, tmy, 12, 27, '#141720'); // Monitor bezel
  pxRect(ctx, tmx + 2, tmy + 2, 8, 23, '#0F172A'); // Terminal screen
  const agPulse = Math.floor(tick / 7) % 4;
  pxRect(ctx, tmx + 3, tmy + 4, 5, 2, '#38BDF8'); // Cyan code line
  pxRect(ctx, tmx + 3, tmy + 8, 4 + (agPulse % 2), 2, '#A78BFA'); // Violet code line
  pxRect(ctx, tmx + 3, tmy + 12, 6, 2, '#34D399'); // Emerald localhost status line
  pxRect(ctx, tmx + 3, tmy + 16, 3 + (agPulse > 1 ? 2 : 0), 2, '#F472B6');
  pxRect(ctx, tmx + 3, tmy + 20, 5, 2, '#7DD3FC');
  // Subtle cyan monitor glow onto desk surface
  pxRect(ctx, tmx + 12, tmy + 2, 4, 23, 'rgba(56, 189, 248, 0.16)');

  // Dark Desk Mat + Compact RGB Mechanical Keyboard & Mouse (right side of desk)
  pxRect(ctx, agx + 23, agy + 20, 18, 29, '#1E2433');
  pxRect(ctx, agx + 26, agy + 24, 9, 17, '#12151E');
  pxRect(ctx, agx + 28, agy + 26, 5, 13, '#CBD5E1');
  pxRect(ctx, agx + 27, agy + 43, 6, 4, '#94A3B8');

  // Energy Drink / Dark Espresso Tumbler on top-right corner
  pxRect(ctx, agx + 28, agy + 7, 8, 9, '#1E293B');
  pxRect(ctx, agx + 29, agy + 6, 6, 2, '#38BDF8');

  // =========================================================================
  // 7. GOOGLE AI STUDIO PROMPT LAB STATION (south-center bay of Home Office)
  // =========================================================================
  const stx = Math.round(AISTUDIO_DESK_RECT.x - CORE_OFFSET_X);
  const sty = Math.round(AISTUDIO_DESK_RECT.y);
  const stw = Math.round(AISTUDIO_DESK_RECT.w); // ~82
  const sth = Math.round(AISTUDIO_DESK_RECT.h); // ~34

  // Ergonomic Cobalt Studio Swivel Chair at AISTUDIO_POS (facing south toward AI Studio workbench)
  const scX = Math.round(AISTUDIO_POS.x - CORE_OFFSET_X);
  const scY = Math.round(AISTUDIO_POS.y);
  pxRect(ctx, scX - 10, scY + 6, 20, 5, 'rgba(20, 24, 38, 0.25)');
  pxRect(ctx, scX - 7, scY + 4, 14, 3, '#2D3448');
  pxRect(ctx, scX - 8, scY - 4, 16, 10, '#1D4ED8');
  pxRect(ctx, scX - 6, scY - 2, 12, 6, '#3B82F6');
  // Sleek backrest on NORTH side (character sits facing south toward studio screens)
  pxRect(ctx, scX - 8, scY - 8, 16, 4, '#1E3A8A');
  pxRect(ctx, scX - 6, scY - 7, 12, 2, '#60A5FA');

  // Sleek Brushed-Slate & Cobalt Lab Desk against south office wall
  pxRect(ctx, stx + 2, sty + sth - 1, stw - 4, 5, 'rgba(18, 22, 34, 0.3)');
  pxRect(ctx, stx, sty, stw, sth, '#1C2538');
  pxRect(ctx, stx + 3, sty + 3, stw - 6, sth - 7, '#273552');
  pxRect(ctx, stx + 3, sty + 3, stw - 6, 2, '#4285F4'); // Signature Google blue edge trim

  // Compact Keyboard & Prompt Pad on north-center edge (in front of AI Studio character)
  pxRect(ctx, stx + 26, sty + 5, 28, 7, '#111827');
  pxRect(ctx, stx + 28, sty + 7, 24, 3, '#DBEAFE');
  pxRect(ctx, stx + 56, sty + 6, 6, 5, '#93C5FD');

  // Dual Studio Monitor Bar along south edge (angled slightly toward character)
  pxRect(ctx, stx + 20, sty + 15, 42, 13, '#0F172A');
  pxRect(ctx, stx + 22, sty + 17, 38, 9, '#172554');
  const sparkPhase = Math.floor(tick / 10) % 4;
  pxRect(ctx, stx + 25, sty + 19, 12 + (sparkPhase % 2) * 3, 2, '#60A5FA');
  pxRect(ctx, stx + 25, sty + 22, 18 - (sparkPhase % 2) * 2, 2, '#93C5FD');
  pxRect(ctx, stx + 48, sty + 19, 9, 5, sparkPhase % 2 === 0 ? '#38BDF8' : '#818CF8');
  // Subtle blue screen glow cast north onto desk
  pxRect(ctx, stx + 22, sty + 12, 38, 3, 'rgba(96, 165, 250, 0.16)');

  // Mini Gemini 4-point Spark Hologram Pedestal on left corner of desk
  pxRect(ctx, stx + 6, sty + 11, 10, 10, '#111827');
  pxRect(ctx, stx + 8, sty + 13, 6, 6, '#1E3A8A');
  const holoColor = Math.floor(tick / 12) % 2 === 0 ? '#93C5FD' : '#60A5FA';
  pxRect(ctx, stx + 10, sty + 12, 2, 8, holoColor);
  pxRect(ctx, stx + 7, sty + 15, 8, 2, holoColor);
  pxRect(ctx, stx + 10, sty + 15, 2, 2, '#EFF6FF');

  // Studio Reference Notebook & Stylus on right corner
  pxRect(ctx, stx + 65, sty + 12, 12, 14, '#E2E8F0');
  pxRect(ctx, stx + 67, sty + 14, 8, 2, '#2563EB');
  pxRect(ctx, stx + 67, sty + 18, 7, 1, '#64748B');
  pxRect(ctx, stx + 67, sty + 21, 6, 1, '#64748B');
}

function drawCenterDriveTable(
  ctx: CanvasRenderingContext2D,
  tick: number,
  isDriveOpen: boolean
) {
  const tx = Math.round(CENTER_TABLE_RECT.x);
  const ty = Math.round(CENTER_TABLE_RECT.y);
  const tw = Math.round(CENTER_TABLE_RECT.w); // ~94
  const th = Math.round(CENTER_TABLE_RECT.h); // ~65

  // Soft floor drop shadow & sturdy oak table legs
  pxRect(ctx, tx + 3, ty + th - 2, tw - 4, 7, 'rgba(28,20,15,0.28)');
  pxRect(ctx, tx + 5, ty + th - 6, 6, 9, '#4B2E1B');
  pxRect(ctx, tx + tw - 11, ty + th - 6, 6, 9, '#4B2E1B');

  // Main warm oak drafting / reference tabletop with subtle organic wood grain planks
  pxRect(ctx, tx, ty, tw, th - 4, '#5B3922'); // Outer timber rim
  pxRect(ctx, tx + 3, ty + 3, tw - 6, th - 12, '#8F603B'); // Tabletop surface
  pxRect(ctx, tx + 3, ty + 3, tw - 6, 3, '#AA774E'); // Top rim highlight
  pxRect(ctx, tx + 3, ty + th - 9, tw - 6, 5, '#6C4529'); // Front wooden apron
  // Subtle wood plank join lines
  pxRect(ctx, tx + 4, ty + 18, tw - 8, 1, 'rgba(72,44,24,0.22)');
  pxRect(ctx, tx + 4, ty + 35, tw - 8, 1, 'rgba(72,44,24,0.22)');
  pxRect(ctx, tx + 4, ty + 48, tw - 8, 1, 'rgba(72,44,24,0.18)');

  // Gentle warm glow around central documents when Google Drive modal is open
  if (isDriveOpen) {
    const glowA = 0.14 + Math.sin(tick * 0.12) * 0.04;
    pxRect(ctx, tx + 5, ty + 5, tw - 10, th - 16, `rgba(245, 196, 81, ${glowA.toFixed(2)})`);
  }

  // 1. Neatly stacked hardcover books (upper-left corner — orderly anchor)
  pxRect(ctx, tx + 7, ty + 7, 19, 13, '#3F6A57'); // Bottom forest-green hardcover
  pxRect(ctx, tx + 24, ty + 8, 2, 11, '#EFE5D5'); // Cream pages edge
  pxRect(ctx, tx + 8, ty + 9, 15, 10, '#A84A38'); // Middle terracotta book (slightly offset)
  pxRect(ctx, tx + 22, ty + 10, 2, 8, '#FAF6F0');
  pxRect(ctx, tx + 10, ty + 11, 13, 8, '#D49A42'); // Top ochre notebook
  pxRect(ctx, tx + 12, ty + 13, 7, 2, '#FAF6F0'); // Spine label

  // 2. Manila project dossier folder with subtle tri-color index tabs (upper-center, slightly angled)
  ctx.save();
  ctx.translate(tx + 46, ty + 15);
  ctx.rotate(0.06);
  pxRect(ctx, -14, -9, 28, 19, '#C99B58'); // Folder back
  pxRect(ctx, -12, -11, 8, 3, '#4D7C6F'); // Green index tab
  pxRect(ctx, -3, -11, 7, 3, '#E2A84B'); // Gold index tab
  pxRect(ctx, 5, -11, 7, 3, '#4E82B4'); // Sky-blue index tab
  pxRect(ctx, -13, -8, 26, 17, '#E6C68E'); // Folder front cover
  pxRect(ctx, -10, -5, 18, 12, '#FAF6F0'); // Peeking white sheet
  pxRect(ctx, -8, -2, 13, 1, '#94A3B8');
  pxRect(ctx, -8, 1, 10, 1, '#94A3B8');
  pxRect(ctx, -8, 4, 12, 1, '#D97736');
  // Tiny silver paperclip
  pxRect(ctx, 9, -7, 2, 5, '#CBD5E1');
  ctx.restore();

  // 3. Thick hardcover reference book lying casually askew (upper-right)
  ctx.save();
  ctx.translate(tx + 76, ty + 16);
  ctx.rotate(-0.11);
  pxRect(ctx, -11, -9, 21, 15, '#334E68'); // Deep navy hardcover
  pxRect(ctx, -9, -7, 17, 11, '#486581');
  pxRect(ctx, 8, -7, 2, 11, '#F5EFE6'); // Page thickness
  pxRect(ctx, -6, -4, 11, 2, '#E2C69E'); // Gold embossed title
  pxRect(ctx, -4, 6, 3, 5, '#DC6B54'); // Trailing bookmark ribbon
  ctx.restore();

  // 4. Open spiral notebook with handwritten notes & diagonal pencil (lower-left, lived-in angle)
  ctx.save();
  ctx.translate(tx + 21, ty + 39);
  ctx.rotate(-0.13);
  pxRect(ctx, -14, -10, 28, 19, '#57463A'); // Dark leather cover edges
  pxRect(ctx, -13, -9, 12, 17, '#FAF6F0'); // Left page
  pxRect(ctx, 1, -9, 12, 17, '#F5EFE6'); // Right page
  // Spiral wire spine dots
  pxRect(ctx, -1, -7, 2, 2, '#94A3B8');
  pxRect(ctx, -1, -2, 2, 2, '#94A3B8');
  pxRect(ctx, -1, 3, 2, 2, '#94A3B8');
  // Handwritten ink lines & highlighter streak
  pxRect(ctx, -11, -6, 8, 1, '#64748B');
  pxRect(ctx, -11, -3, 9, 1, '#64748B');
  pxRect(ctx, -11, 0, 7, 2, '#FDE68A'); // Yellow highlight
  pxRect(ctx, -11, 4, 8, 1, '#64748B');
  pxRect(ctx, 3, -6, 8, 1, '#64748B');
  pxRect(ctx, 3, -3, 6, 1, '#D97736');
  pxRect(ctx, 3, 0, 8, 1, '#64748B');
  pxRect(ctx, 3, 3, 7, 1, '#64748B');
  // Diagonal wooden pencil resting across right page
  pxRect(ctx, 4, -7, 3, 15, '#E29E3B');
  pxRect(ctx, 4, -9, 3, 2, '#E89B8B'); // Pink eraser
  pxRect(ctx, 5, 8, 1, 2, '#3B281E'); // Graphite tip
  ctx.restore();

  // 5. Overlapping loose A4 documents & crooked yellow sticky note (center-bottom — slightly messy!)
  ctx.save();
  ctx.translate(tx + 51, ty + 40);
  ctx.rotate(0.15);
  pxRect(ctx, -11, -8, 20, 15, '#EFE7DB'); // Bottom loose page
  pxRect(ctx, -9, -5, 14, 1, '#94A3B8');
  pxRect(ctx, -9, -2, 11, 1, '#94A3B8');
  ctx.restore();

  ctx.save();
  ctx.translate(tx + 56, ty + 37);
  ctx.rotate(-0.08);
  pxRect(ctx, -10, -8, 20, 16, '#FAF6F0'); // Top crisp sheet
  pxRect(ctx, -8, -5, 11, 2, '#4D7C6F'); // Header accent
  pxRect(ctx, -8, -1, 15, 1, '#94A3B8');
  pxRect(ctx, -8, 2, 13, 1, '#94A3B8');
  pxRect(ctx, -8, 5, 9, 1, '#94A3B8');
  // Crooked sticky note stuck onto top-right corner
  pxRect(ctx, 5, -9, 7, 7, '#FEF08A');
  pxRect(ctx, 6, -7, 4, 1, '#B45309');
  ctx.restore();

  // 6. Small paperback notebook + ceramic coffee cup + pen accent (lower-right)
  pxRect(ctx, tx + 72, ty + 33, 14, 10, '#C86D51'); // Small coral pocket notebook
  pxRect(ctx, tx + 74, ty + 35, 10, 2, '#FAF6F0');
  pxRect(ctx, tx + 81, ty + 34, 2, 8, '#3B281E'); // Elastic band

  // Cozy ceramic coffee mug with gentle steam
  pxRect(ctx, tx + 76, ty + 46, 9, 8, '#FAF6F0');
  pxRect(ctx, tx + 84, ty + 48, 2, 4, '#E8DFD3'); // Mug handle
  pxRect(ctx, tx + 78, ty + 48, 5, 4, '#6F4226'); // Coffee inside
  const steamRise = Math.floor(tick / 18) % 3;
  pxRect(ctx, tx + 79, ty + 43 - steamRise, 2, 2, 'rgba(255,250,240,0.48)');

  // Tiny stray pen near bottom-left edge
  pxRect(ctx, tx + 35, ty + 50, 9, 2, '#2563EB');
  pxRect(ctx, tx + 43, ty + 50, 2, 2, '#CBD5E1');
}

function drawMinaNpc(
  ctx: CanvasRenderingContext2D,
  mina: MinaNpcState,
  mood: AssistantMood,
  tick: number
) {
  const x = Math.round(mina.x);
  const y = Math.round(mina.y);
  const isSeatedWorking = mina.phase === 'working_at_desk' && !mina.isMoving;
  const stepPhase = mina.isMoving ? Math.floor(mina.walkFrame) % 4 : 0;
  const walkBob = mina.isMoving && (stepPhase === 1 || stepPhase === 3) ? -2 : 0;
  const legOffset = stepPhase === 1 ? 2 : stepPhase === 3 ? -2 : 0;
  const breathe = isSeatedWorking && Math.sin(tick * 0.08) > 0.35 ? 1 : 0;
  const bodyYOffset = mina.isMoving ? walkBob : breathe;
  const blink = tick % 190 > 183;

  // Floor shadow & walking/standing legs whenever she is up out of her swivel chair
  if (!isSeatedWorking) {
    pxRect(ctx, x - 9, y + 7, 18, 5, 'rgba(28,20,15,0.26)');
    pxRect(ctx, x - 6, y + 2 + (legOffset > 0 ? 1 : 0), 5, 7, '#4B3E36');
    pxRect(ctx, x + 1, y + 2 + (legOffset < 0 ? 1 : 0), 5, 7, '#4B3E36');
  }

  // Torso: cream knit cardigan + sage blouse underneath
  pxRect(ctx, x - 8, y - 8 + bodyYOffset, 16, 13, '#EFE5D5');
  if (mina.facing !== 'up') {
    const blouseShift = mina.facing === 'right' ? 2 : mina.facing === 'left' ? -2 : 0;
    pxRect(ctx, x - 3 + blouseShift, y - 7 + bodyYOffset, 6, 11, '#6B9080');
  } else {
    pxRect(ctx, x - 6, y - 7 + bodyYOffset, 12, 11, '#E5D8C5');
  }

  // Arms: seated typing at computer, pinning, carrying sticky note, waving greeting, thinking, or walking
  if (isSeatedWorking) {
    // Actively typing toward her computer keyboard on the right
    const typeShift = Math.floor(tick / 6) % 2;
    pxRect(ctx, x - 9, y - 5 + bodyYOffset, 3, 8, '#E5D8C5');
    pxRect(ctx, x + 6, y - 6 + typeShift, 11, 4, '#EFE5D5');
    pxRect(ctx, x + 16, y - 5 + typeShift, 4, 3, '#F4C6A3');
    pxRect(ctx, x + 6, y - 1 + (1 - typeShift), 11, 4, '#EFE5D5');
    pxRect(ctx, x + 16, y + (1 - typeShift), 4, 3, '#F4C6A3');
  } else if (mina.phase === 'pinning') {
    const reachUp = Math.floor(tick / 8) % 2 === 0 ? -15 : -12;
    pxRect(ctx, x - 11, y - 6, 3, 9, '#EFE5D5');
    pxRect(ctx, x + 8, y + reachUp, 4, 10, '#EFE5D5');
    pxRect(ctx, x + 8, y + reachUp - 2, 4, 3, '#F4C6A3');
    if (mina.pinProgress < 0.55) {
      pxRect(ctx, x + 6, y + reachUp - 6, 7, 5, '#FEF08A');
    }
  } else if (mina.isMoving) {
    pxRect(ctx, x - 11, y - 7 + bodyYOffset + (legOffset > 0 ? -1 : 0), 3, 9, '#EFE5D5');
    pxRect(ctx, x + 8, y - 7 + bodyYOffset + (legOffset < 0 ? -1 : 0), 3, 9, '#EFE5D5');
    if (mina.phase === 'walking_to_board') {
      pxRect(ctx, x + 9, y - 2 + bodyYOffset, 6, 5, '#FEF08A');
      pxRect(ctx, x + 11, y - 2 + bodyYOffset, 2, 1, '#DC2626');
    }
  } else if (mood === 'greeting') {
    const waveY = Math.floor(tick / 8) % 2 === 0 ? -12 : -9;
    pxRect(ctx, x - 11, y - 7 + bodyYOffset, 3, 9, '#EFE5D5');
    pxRect(ctx, x + 8, y + waveY, 4, 8, '#EFE5D5');
    pxRect(ctx, x + 8, y + waveY - 2, 4, 3, '#F4C6A3');
  } else if (mood === 'thinking') {
    const typeShift = Math.floor(tick / 6) % 2;
    pxRect(ctx, x - 10, y - 9 + typeShift, 4, 7, '#EFE5D5');
    pxRect(ctx, x + 6, y - 9 + (1 - typeShift), 4, 7, '#EFE5D5');
  } else if (mood === 'speaking') {
    // Expressive standing conversation gesture
    const talkShift = Math.floor(tick / 10) % 2 === 0 ? -2 : 0;
    pxRect(ctx, x - 11, y - 6 + bodyYOffset, 3, 9, '#EFE5D5');
    pxRect(ctx, x + 8, y - 8 + talkShift, 4, 8, '#EFE5D5');
    pxRect(ctx, x + 9, y - 9 + talkShift, 3, 3, '#F4C6A3');
  } else {
    pxRect(ctx, x - 11, y - 6 + bodyYOffset, 3, 9, '#EFE5D5');
    pxRect(ctx, x + 8, y - 6 + bodyYOffset, 3, 9, '#EFE5D5');
  }

  // Head & warm chestnut hair bun
  pxRect(ctx, x - 8, y - 22 + bodyYOffset, 16, 14, '#5B3420');
  if (mina.facing === 'up') {
    pxRect(ctx, x - 7, y - 21 + bodyYOffset, 14, 12, '#6E4027');
    pxRect(ctx, x - 3, y - 19 + bodyYOffset, 6, 6, '#4A2817');
    pxRect(ctx, x - 2, y - 18 + bodyYOffset, 4, 4, '#5B3420');
  } else {
    const eyeShift = mina.facing === 'left' ? -2 : mina.facing === 'right' ? 2 : 0;
    // Put hair bun behind her head when facing right/left
    const bunX = mina.facing === 'right' ? x - 10 : x + 5;
    pxRect(ctx, bunX, y - 17 + bodyYOffset, 5, 6, '#5B3420');
    pxRect(ctx, x - 6, y - 19 + bodyYOffset, 12, 11, '#F6CCB0'); // Face
    pxRect(ctx, x - 7, y - 22 + bodyYOffset, 14, 5, '#6E4027'); // Fringe

    // Round glasses & eyes
    if (!blink) {
      pxRect(ctx, x - 5 + eyeShift, y - 15 + bodyYOffset, 4, 4, '#3B281E');
      pxRect(ctx, x + 1 + eyeShift, y - 15 + bodyYOffset, 4, 4, '#3B281E');
      pxRect(ctx, x - 4 + eyeShift, y - 14 + bodyYOffset, 2, 2, '#FAF6F0');
      pxRect(ctx, x + 2 + eyeShift, y - 14 + bodyYOffset, 2, 2, '#FAF6F0');
      pxRect(ctx, x - 1 + eyeShift, y - 14 + bodyYOffset, 2, 1, '#3B281E');
    } else {
      pxRect(ctx, x - 4 + eyeShift, y - 13 + bodyYOffset, 3, 1, '#3B281E');
      pxRect(ctx, x + 1 + eyeShift, y - 13 + bodyYOffset, 3, 1, '#3B281E');
    }
    // Rosy cheeks
    pxRect(ctx, x - 5 + eyeShift, y - 11 + bodyYOffset, 2, 1, '#E89B8B');
    pxRect(ctx, x + 3 + eyeShift, y - 11 + bodyYOffset, 2, 1, '#E89B8B');
  }
}

function drawAntigravityNpc(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  tick: number,
  isAntigravityOpen: boolean,
  npc?: RovingAssistantNpcState
) {
  const x = Math.round(npc?.x ?? AGY_POS.x);
  const y = Math.round(npc?.y ?? AGY_POS.y);
  const isRoving = Boolean(npc && npc.phase !== 'at_desk');
  const distToPlayer = Math.hypot(player.x - x, player.y - y);
  const isEngaged =
    isRoving ||
    isAntigravityOpen ||
    (getRoomZone(player.x, player.y) === 'office' && distToPlayer <= AGY_APPROACH_RADIUS);
  const walkBob = npc?.isMoving ? Math.abs(Math.sin(npc.walkFrame)) * 1.5 : 0;
  const breathe = npc?.isMoving ? Math.round(-walkBob) : Math.sin(tick * 0.09) > 0.3 ? 1 : 0;
  const blink = tick % 175 > 168;

  // Floor shadow & legs when standing/walking or turned to greet player
  if (isEngaged) {
    pxRect(ctx, x - 9, y + 7, 18, 5, 'rgba(20, 24, 36, 0.28)');
    const legSwing = npc?.isMoving ? Math.sin(npc.walkFrame) * 2.5 : 0;
    pxRect(ctx, x - 6, y + 2 + Math.round(legSwing), 5, 7, '#1E2436');
    pxRect(ctx, x + 1, y + 2 - Math.round(legSwing), 5, 7, '#1E2436');
  }

  // Torso: Sleek Antigravity dark-indigo tech hoodie with cyan chest core accent
  pxRect(ctx, x - 8, y - 8 + breathe, 16, 13, '#252F4C');
  pxRect(ctx, x - 6, y - 7 + breathe, 12, 11, '#313E63');
  const coreColor = Math.floor(tick / 15) % 2 === 0 ? '#38BDF8' : '#818CF8';
  const emblemShift = isEngaged ? 0 : -2;
  pxRect(ctx, x - 2 + emblemShift, y - 4 + breathe, 4, 3, coreColor);

  // Arms: typing left at terminal when idle, or friendly wave/gesture when player approaches
  if (!isEngaged) {
    const typeShift = Math.floor(tick / 5) % 2;
    pxRect(ctx, x + 6, y - 5 + breathe, 3, 8, '#252F4C');
    pxRect(ctx, x - 17, y - 6 + typeShift, 11, 4, '#313E63');
    pxRect(ctx, x - 20, y - 5 + typeShift, 4, 3, '#F1C5A2');
    pxRect(ctx, x - 17, y - 1 + (1 - typeShift), 11, 4, '#252F4C');
    pxRect(ctx, x - 20, y + (1 - typeShift), 4, 3, '#F1C5A2');
  } else {
    const waveY = Math.floor(tick / 9) % 2 === 0 ? -12 : -9;
    pxRect(ctx, x - 11, y - 6 + breathe, 3, 9, '#252F4C');
    pxRect(ctx, x + 8, y + waveY, 4, 8, '#313E63');
    pxRect(ctx, x + 8, y + waveY - 2, 4, 3, '#F1C5A2');
  }

  // Head & face
  pxRect(ctx, x - 7, y - 21 + breathe, 14, 13, '#F1C5A2');
  pxRect(ctx, x - 6, y - 10 + breathe, 12, 2, '#DFAD87');

  // Stylish silver-indigo spiky tech hair
  pxRect(ctx, x - 8, y - 25 + breathe, 16, 5, '#1E243B');
  pxRect(ctx, x - 7, y - 26 + breathe, 14, 2, '#3B4975');
  pxRect(ctx, x - 9, y - 22 + breathe, 3, 7, '#1E243B');
  pxRect(ctx, x + 6, y - 22 + breathe, 3, 7, '#1E243B');

  // Headphones earcups (cyan/slate)
  pxRect(ctx, x - 9, y - 17 + breathe, 2, 5, '#38BDF8');
  pxRect(ctx, x + 7, y - 17 + breathe, 2, 5, '#38BDF8');

  // Eyes & sleek tech visor glasses
  const eyeShift = isEngaged ? (player.x >= x ? 1 : -1) : -2;
  pxRect(ctx, x - 6 + eyeShift, y - 16 + breathe, 12, 4, 'rgba(30, 41, 59, 0.85)');
  if (!blink) {
    pxRect(ctx, x - 5 + eyeShift, y - 15 + breathe, 4, 2, '#38BDF8');
    pxRect(ctx, x + 1 + eyeShift, y - 15 + breathe, 4, 2, '#38BDF8');
  } else {
    pxRect(ctx, x - 5 + eyeShift, y - 15 + breathe, 4, 1, '#7DD3FC');
    pxRect(ctx, x + 1 + eyeShift, y - 15 + breathe, 4, 1, '#7DD3FC');
  }
  pxRect(ctx, x - 2 + eyeShift, y - 11 + breathe, 4, 1, '#A16E54');
}

function drawAiStudioNpc(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  tick: number,
  isAiStudioOpen: boolean,
  status?: CharacterStatusSnapshot,
  npc?: RovingAssistantNpcState
) {
  const x = Math.round(npc?.x ?? AISTUDIO_POS.x);
  const y = Math.round(npc?.y ?? AISTUDIO_POS.y);
  const isRoving = Boolean(npc && npc.phase !== 'at_desk');
  const distToPlayer = Math.hypot(player.x - x, player.y - y);
  const isEngaged =
    isRoving ||
    isAiStudioOpen ||
    (getRoomZone(player.x, player.y) === 'office' && distToPlayer <= AISTUDIO_APPROACH_RADIUS);
  const isBusy = status?.status === 'busy';
  const isUnavailable = status?.status === 'unavailable';
  const walkBob = npc?.isMoving ? Math.abs(Math.sin(npc.walkFrame)) * 1.5 : 0;
  const breathe = npc?.isMoving ? Math.round(-walkBob) : Math.sin(tick * 0.085) > 0.35 ? 1 : 0;
  const blink = tick % 185 > 179;

  // Floor shadow & legs when standing/walking or turned to greet player
  if (isEngaged) {
    pxRect(ctx, x - 9, y + 6, 18, 5, 'rgba(18, 24, 42, 0.28)');
    const legSwing = npc?.isMoving ? Math.sin(npc.walkFrame) * 2.5 : 0;
    pxRect(ctx, x - 6, y + 2 + Math.round(legSwing), 5, 6, '#1E293B');
    pxRect(ctx, x + 1, y + 2 - Math.round(legSwing), 5, 6, '#1E293B');
  }

  // Torso: crisp Google AI Studio cobalt-blue & alabaster lab jacket
  pxRect(ctx, x - 8, y - 8 + breathe, 16, 12, '#EFF6FF');
  pxRect(ctx, x - 7, y - 7 + breathe, 4, 10, '#2563EB');
  pxRect(ctx, x + 3, y - 7 + breathe, 4, 10, '#2563EB');
  // Luminous Gemini spark chest badge
  const badgeColor = isUnavailable
    ? '#F87171'
    : isBusy
      ? Math.floor(tick / 6) % 2 === 0
        ? '#FBBF24'
        : '#60A5FA'
      : Math.floor(tick / 16) % 2 === 0
        ? '#3B82F6'
        : '#60A5FA';
  pxRect(ctx, x - 1, y - 5 + breathe, 2, 4, badgeColor);
  pxRect(ctx, x - 2, y - 4 + breathe, 4, 2, badgeColor);

  // Arms: typing toward studio keyboard when seated/busy, or welcoming gesture when player enters radius
  if (!isEngaged) {
    const speed = isBusy ? 4 : 7;
    const typeShift = Math.floor(tick / speed) % 2;
    pxRect(ctx, x - 10, y - 3 + typeShift, 4, 8, '#2563EB');
    pxRect(ctx, x - 9, y + 4 + typeShift, 3, 3, '#F4C6A3');
    pxRect(ctx, x + 6, y - 3 + (1 - typeShift), 4, 8, '#2563EB');
    pxRect(ctx, x + 6, y + 4 + (1 - typeShift), 3, 3, '#F4C6A3');
  } else {
    const waveY = Math.floor(tick / 9) % 2 === 0 ? -12 : -9;
    pxRect(ctx, x - 11, y - 6 + breathe, 3, 9, '#2563EB');
    pxRect(ctx, x + 8, y + waveY, 4, 8, '#2563EB');
    pxRect(ctx, x + 8, y + waveY - 2, 4, 3, '#F4C6A3');
  }

  // Head & face
  pxRect(ctx, x - 7, y - 21 + breathe, 14, 13, '#F6CCB0');
  pxRect(ctx, x - 6, y - 10 + breathe, 12, 2, '#E5B492');

  // Sleek cobalt-slate modern hair with bright sky highlight
  pxRect(ctx, x - 8, y - 25 + breathe, 16, 6, '#1E3A8A');
  pxRect(ctx, x - 7, y - 26 + breathe, 14, 2, '#3B82F6');
  pxRect(ctx, x - 9, y - 22 + breathe, 3, 7, '#1E3A8A');
  pxRect(ctx, x + 6, y - 22 + breathe, 3, 7, '#1E3A8A');
  // Signature twin blue spark hairclip accent
  pxRect(ctx, x + 4, y - 23 + breathe, 2, 2, '#93C5FD');

  // Eyes (glancing toward player when engaged, or focused down at studio screens)
  const eyeShift = isEngaged ? (player.x > x + 8 ? 1 : player.x < x - 8 ? -1 : 0) : 0;
  if (!blink) {
    pxRect(ctx, x - 5 + eyeShift, y - 16 + breathe, 3, 3, '#1E293B');
    pxRect(ctx, x + 2 + eyeShift, y - 16 + breathe, 3, 3, '#1E293B');
    pxRect(ctx, x - 4 + eyeShift, y - 15 + breathe, 1, 1, '#93C5FD');
    pxRect(ctx, x + 3 + eyeShift, y - 15 + breathe, 1, 1, '#93C5FD');
  } else {
    pxRect(ctx, x - 5 + eyeShift, y - 14 + breathe, 3, 1, '#1E293B');
    pxRect(ctx, x + 2 + eyeShift, y - 14 + breathe, 3, 1, '#1E293B');
  }
  // Subtle friendly smile
  pxRect(ctx, x - 2 + eyeShift, y - 11 + breathe, 4, 1, '#A16E54');
}

function formatCompactTokensShort(n: number): string {
  const safe = Math.max(0, Math.round(n));
  if (safe >= 1_000_000) {
    const m = safe / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (safe >= 1_000) {
    const k = safe / 1_000;
    return `${k >= 100 || k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return String(safe);
}

function formatResetClockShort(resetAtMs: number): string {
  const d = new Date(resetAtMs);
  if (Number.isNaN(d.getTime())) return '00:00 น.';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.`;
}

function truncateText(raw: string, maxChars: number): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars - 1)}…`;
}

interface ActiveOverlayCandidate {
  id: CharacterId;
  x: number;
  y: number;
  dist: number;
  priority: number;
  interactableId: 'mina_desk' | 'antigravity_desk' | 'ai_studio_desk';
  fallbackName: string;
  accentColor: string;
}

/**
 * Renders AT MOST ONE character's overhead status card (only when player is inside that
 * character's proximity radius or actively interacting with them), stacking any speech
 * bubble strictly bottom-to-top with zero overlapping layers.
 */
function drawActiveCharacterOverlay(
  ctx: CanvasRenderingContext2D,
  state: RenderContextState
) {
  const inOffice = getRoomZone(state.player.x, state.player.y) === 'office';
  const candidates: ActiveOverlayCandidate[] = [];

  const minaDistToPlayer = Math.hypot(state.player.x - state.mina.x, state.player.y - state.mina.y);
  const minaDistToDesk = Math.hypot(state.player.x - MINA_POS.x, state.player.y - MINA_POS.y);
  const minaEngaged =
    state.isWorking ||
    (inOffice && (minaDistToDesk <= MINA_APPROACH_RADIUS || minaDistToPlayer <= MINA_APPROACH_RADIUS));
  if (minaEngaged) {
    candidates.push({
      id: 'mina',
      x: Math.round(state.mina.x),
      y: Math.round(state.mina.y),
      dist: Math.min(minaDistToPlayer, minaDistToDesk),
      priority: state.isWorking ? 3 : 1,
      interactableId: 'mina_desk',
      fallbackName: 'มีน่า',
      accentColor: '#6B9080',
    });
  }

  const agyDist = Math.hypot(state.player.x - AGY_POS.x, state.player.y - AGY_POS.y);
  const agyEngaged =
    Boolean(state.isAntigravityOpen) || (inOffice && agyDist <= AGY_APPROACH_RADIUS);
  if (agyEngaged) {
    candidates.push({
      id: 'antigravity',
      x: Math.round(AGY_POS.x),
      y: Math.round(AGY_POS.y),
      dist: agyDist,
      priority: state.isAntigravityOpen ? 3 : 1,
      interactableId: 'antigravity_desk',
      fallbackName: 'Antigravity',
      accentColor: '#38BDF8',
    });
  }

  const aiStudioDist = Math.hypot(state.player.x - AISTUDIO_POS.x, state.player.y - AISTUDIO_POS.y);
  const aiStudioEngaged =
    Boolean(state.isAiStudioOpen) || (inOffice && aiStudioDist <= AISTUDIO_APPROACH_RADIUS);
  if (aiStudioEngaged) {
    candidates.push({
      id: 'ai_studio',
      x: Math.round(AISTUDIO_POS.x),
      y: Math.round(AISTUDIO_POS.y),
      dist: aiStudioDist,
      priority: state.isAiStudioOpen ? 3 : 1,
      interactableId: 'ai_studio_desk',
      fallbackName: 'Google AI Studio',
      accentColor: '#60A5FA',
    });
  }

  // If player is outside every character's radius, show active delivery / mission bubble when walking
  if (candidates.length === 0) {
    if (state.deliveryBubble?.text) {
      const db = state.deliveryBubble;
      const bx =
        db.assistantId === 'antigravity'
          ? Math.round(state.antigravityNpc?.x ?? AGY_POS.x)
          : db.assistantId === 'ai_studio'
            ? Math.round(state.aiStudioNpc?.x ?? AISTUDIO_POS.x)
            : Math.round(state.mina.x);
      const by =
        db.assistantId === 'antigravity'
          ? Math.round(state.antigravityNpc?.y ?? AGY_POS.y)
          : db.assistantId === 'ai_studio'
            ? Math.round(state.aiStudioNpc?.y ?? AISTUDIO_POS.y)
            : Math.round(state.mina.y);
      const border =
        db.assistantId === 'antigravity'
          ? '#38BDF8'
          : db.assistantId === 'ai_studio'
            ? '#60A5FA'
            : '#D97736';
      drawSpeechBubble(ctx, bx, by - 30, db.text, '#FAF6F0', border);
      return;
    }
    if (
      (state.mina.phase === 'walking_to_board' || state.mina.phase === 'pinning' || state.mina.phase === 'summoned_to_player') &&
      state.minaBubbleText
    ) {
      drawSpeechBubble(
        ctx,
        Math.round(state.mina.x),
        Math.round(state.mina.y) - 30,
        state.minaBubbleText,
        '#FAF6F0',
        '#D97736'
      );
    }
    return;
  }

  // Strictly pick ONE active character (highest priority, then closest to player)
  candidates.sort((a, b) => b.priority - a.priority || a.dist - b.dist);
  const active = candidates[0];
  const snapshot = state.characterStatuses?.[active.id];

  // Bottom-to-top stacking cursor anchored cleanly above character head
  let stackBottomY = active.y - 29;

  // Build compact 2-line status plate content
  const charName = snapshot?.name || active.fallbackName;
  const statusKind = snapshot?.status ?? 'ready';
  const showInlineInteractCue =
    !state.isWorking &&
    !state.isTvOn &&
    !state.isAntigravityOpen &&
    !state.isAiStudioOpen &&
    state.nearestInteractable?.id === active.interactableId;

  let dotColor = '#34D399';
  let borderColor = active.accentColor;
  let detailText = '';
  let detailColor = '#CBD5E1';

  if (statusKind === 'unavailable') {
    dotColor = '#F87171';
    borderColor = '#EF4444';
    const reason = truncateText(snapshot?.unavailableReason || 'ระบบไม่พร้อมใช้งาน', 30);
    detailText = `ใช้งานไม่ได้: ${reason}`;
    detailColor = '#FCA5A5';
  } else if (statusKind === 'busy') {
    dotColor = Math.floor(state.tick / 12) % 2 === 0 ? '#FBBF24' : '#F59E0B';
    borderColor = '#F59E0B';
    const task = truncateText(snapshot?.currentTask || 'กำลังประมวลผลคำสั่ง', 28);
    detailText = `กำลังทำ: ${task}`;
    detailColor = '#FDE68A';
  } else if (snapshot) {
    dotColor = '#34D399';
    borderColor = active.accentColor;
    detailText = `Token เหลือ ${formatCompactTokensShort(snapshot.tokensRemaining)} · รีเซ็ต ${formatResetClockShort(snapshot.resetAt)}`;
    detailColor = '#BAE6FD';
  } else {
    detailText = 'พร้อมใช้งาน';
    detailColor = '#BAE6FD';
  }

  ctx.save();
  ctx.font = '700 9.5px "IBM Plex Sans Thai", sans-serif';
  const nameW = Math.ceil(ctx.measureText(charName).width);
  const cueText = showInlineInteractCue ? '[E]' : '';
  ctx.font = '700 8.5px monospace';
  const cueW = cueText ? Math.ceil(ctx.measureText(cueText).width) + 8 : 0;

  ctx.font = '500 9px "IBM Plex Sans Thai", sans-serif';
  const detailW = Math.ceil(ctx.measureText(detailText).width);

  const headerRowW = 8 + nameW + (cueW > 0 ? 10 + cueW : 0);
  const plateW = Math.min(224, Math.max(118, Math.max(headerRowW, detailW) + 16));
  const plateH = 31;

  let plateX = Math.round(active.x - plateW / 2);
  plateX = Math.max(8, Math.min(WORLD_W - plateW - 8, plateX));
  const plateTopY = Math.max(8, Math.round(stackBottomY - plateH));

  // Crisp pixel card backdrop & border
  pxRect(ctx, plateX - 1, plateTopY - 1, plateW + 2, plateH + 2, borderColor);
  pxRect(ctx, plateX, plateTopY, plateW, plateH, 'rgba(18, 22, 32, 0.94)');
  // Pointer notch centered over character
  const notchX = Math.max(plateX + 6, Math.min(plateX + plateW - 10, active.x - 2));
  pxRect(ctx, notchX - 1, plateTopY + plateH, 6, 3, borderColor);
  pxRect(ctx, notchX, plateTopY + plateH - 1, 4, 3, '#121620');

  // Row 1: status dot + character name + optional inline [E] badge
  pxRect(ctx, plateX + 7, plateTopY + 7, 4, 4, dotColor);
  ctx.font = '700 9.5px "IBM Plex Sans Thai", sans-serif';
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(charName, plateX + 14, plateTopY + 9.5);

  if (cueText) {
    const badgeW = cueW;
    const badgeX = plateX + plateW - badgeW - 5;
    pxRect(ctx, badgeX, plateTopY + 3.5, badgeW, 11, '#D97736');
    ctx.font = '700 8px monospace';
    ctx.fillStyle = '#FAF6F0';
    ctx.textAlign = 'center';
    ctx.fillText(cueText, badgeX + badgeW / 2, plateTopY + 9.2);
  }

  // Row 2: single concise status line (token+reset / busy task / unavailable reason)
  ctx.font = '500 9px "IBM Plex Sans Thai", sans-serif';
  ctx.fillStyle = detailColor;
  ctx.textAlign = 'left';
  ctx.fillText(detailText, plateX + 7, plateTopY + 22.5, plateW - 14);
  ctx.restore();

  // Advance bottom-to-top cursor strictly above the status plate (5px gap — zero layer overlap)
  stackBottomY = plateTopY - 6;

  // Layer 2 (only if active character is Mina & she has an active bubble/thinking text)
  if (active.id === 'mina' && stackBottomY >= 26) {
    if (state.assistantMood === 'thinking') {
      const dots = '.'.repeat((Math.floor(state.tick / 14) % 3) + 1);
      drawSpeechBubble(ctx, active.x, stackBottomY, `กำลังคิด${dots}`, '#FAF6F0', '#D97736');
    } else if (state.minaBubbleText) {
      const bubbleBorder =
        state.mina.phase === 'walking_to_board' || state.mina.phase === 'pinning'
          ? '#D97736'
          : '#4D7C6F';
      drawSpeechBubble(ctx, active.x, stackBottomY, state.minaBubbleText, '#FAF6F0', bubbleBorder);
    }
  }
}

function drawShoweringPlayerSilhouette(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  tick: number
) {
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const phase = player.showerPhase ?? 'wetting';
  const elapsed = player.showerPhaseElapsed;
  const bob = Math.sin(tick * 0.14) > 0.3 ? -1 : 0;

  // Wet floor ripple shadow around feet
  pxRect(ctx, x - 9, y + 6, 18, 5, 'rgba(38, 74, 84, 0.28)');

  // Soft diffused lower/mid silhouette (no clothes, no explicit details; censored behind frosted glass)
  pxRect(ctx, x - 5, y + 1, 4, 7, 'rgba(205, 162, 136, 0.55)');
  pxRect(ctx, x + 1, y + 1, 4, 7, 'rgba(205, 162, 136, 0.55)');
  pxRect(ctx, x - 7, y - 9 + bob, 14, 11, 'rgba(218, 174, 148, 0.58)');

  // Arms based on shower phase (west wall soap holder -> reach left)
  if (phase === 'grab_soap' || phase === 'return_soap') {
    const t = Math.min(1, elapsed / 1.5);
    const reach = Math.round((t < 0.5 ? t * 2 : (1 - t) * 2) * 14);
    pxRect(ctx, x - 11 - reach, y - 8 + bob, 4 + reach, 4, 'rgba(218, 174, 148, 0.68)');
    pxRect(ctx, x + 7, y - 7 + bob, 3, 8, 'rgba(218, 174, 148, 0.62)');
  } else if (phase === 'scrub_soap') {
    const scrubShift = Math.round(Math.sin(tick * 0.35) * 3);
    pxRect(ctx, x - 11 + scrubShift, y - 9 + bob, 4, 8, 'rgba(218, 174, 148, 0.68)');
    pxRect(ctx, x + 7 - scrubShift, y - 9 + bob, 4, 8, 'rgba(218, 174, 148, 0.68)');
  } else {
    // Rinsing / wetting under shower water stream
    const rinseLift = Math.floor(tick / 10) % 2;
    pxRect(ctx, x - 10, y - 10 + bob + rinseLift, 3, 9, 'rgba(218, 174, 148, 0.62)');
    pxRect(ctx, x + 7, y - 10 + bob + (1 - rinseLift), 3, 9, 'rgba(218, 174, 148, 0.62)');
  }

  // Head & wet hair silhouette (remains recognizable near top of frosted glass)
  pxRect(ctx, x - 8, y - 22 + bob, 16, 13, 'rgba(90, 55, 36, 0.78)');
  pxRect(ctx, x - 6, y - 19 + bob, 12, 10, 'rgba(232, 190, 162, 0.75)');
  pxRect(ctx, x - 7, y - 22 + bob, 14, 5, 'rgba(106, 66, 43, 0.82)');
  // Closed/relaxed eyes while showering
  pxRect(ctx, x - 4, y - 14 + bob, 3, 1, 'rgba(45, 30, 22, 0.65)');
  pxRect(ctx, x + 1, y - 14 + bob, 3, 1, 'rgba(45, 30, 22, 0.65)');

  // Shampoo/soap foam cap on head & shoulders during scrub_soap
  if (phase === 'scrub_soap') {
    pxRect(ctx, x - 7, y - 23 + bob, 14, 4, 'rgba(255, 255, 255, 0.78)');
    pxRect(ctx, x - 5, y - 25 + bob, 10, 3, 'rgba(255, 255, 255, 0.72)');
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerState, tick: number) {
  if (player.isShowering) {
    drawShoweringPlayerSilhouette(ctx, player, tick);
    return;
  }
  // When sleeping on the Master Bedroom King Bed or driving the green car, the player is rendered inside it
  if (player.isSitting && (player.seat === 'bedroom_bed' || player.seat === 'green_car')) {
    return;
  }
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const stepPhase = player.isMoving ? Math.floor(player.walkFrame) % 4 : 0;
  const bob = player.isMoving && (stepPhase === 1 || stepPhase === 3) ? -2 : 0;
  const legOffset = stepPhase === 1 ? 2 : stepPhase === 3 ? -2 : 0;
  const breathe = player.isSitting && Math.sin(tick * 0.06) > 0.45 ? 1 : 0;
  const yOff = player.isMoving ? bob : breathe;

  const isOnSofa = player.isSitting && player.seat === 'sofa';
  const sofaAct = isOnSofa ? player.sofaActivity : null;
  const sofaElapsed = isOnSofa ? player.sofaActivityElapsed : 0;
  // Tea sip timing: lift teacup smoothly for ~1.1s every ~3.4s
  const teaCycle = sofaElapsed % 3.4;
  const isSippingTea = sofaAct === 'tea' && teaCycle > 1.0 && teaCycle < 2.25;
  // Newspaper page-rustle timing
  const paperRustle = sofaAct === 'newspaper' && (sofaElapsed % 2.8) > 2.35 ? -1 : 0;
  // TV remote pointing timing (first 1.35s aims remote down and blinks IR LED)
  const isAimingRemote = sofaAct === 'tv_remote' && sofaElapsed < 1.35;

  // Shadow (subtle when seated on chair/sofa)
  if (!player.isSitting) {
    pxRect(ctx, x - 9, y + 7, 18, 6, 'rgba(28,20,15,0.28)');
  } else {
    pxRect(ctx, x - 8, y + 4, 16, 4, 'rgba(28,20,15,0.18)');
  }

  // Legs / shoes (tucked knees on sofa, hidden under desk, or walking legs)
  if (!player.isSitting) {
    pxRect(ctx, x - 6, y + 2 + (legOffset > 0 ? 1 : 0), 5, 7, '#3E4C59');
    pxRect(ctx, x + 1, y + 2 + (legOffset < 0 ? 1 : 0), 5, 7, '#3E4C59');
  } else if (isOnSofa) {
    // Relaxed seated knees & shoes resting at the front edge of the sofa cushion
    pxRect(ctx, x - 7, y + 2, 6, 5, '#3E4C59');
    pxRect(ctx, x + 1, y + 2, 6, 5, '#3E4C59');
    pxRect(ctx, x - 6, y + 6, 5, 2, '#2B231E');
    pxRect(ctx, x + 1, y + 6, 5, 2, '#2B231E');
  }

  // Torso: olive sage knit sweater (matching generated portrait)
  pxRect(ctx, x - 8, y - 9 + yOff, 16, 12, '#6A7B53');
  pxRect(ctx, x - 6, y - 9 + yOff, 12, 3, '#7C8F62');

  // Arms (drawn behind held sofa props when reading/drinking)
  if (player.isSitting && player.seat === 'workdesk') {
    const typeShift = Math.floor(tick / 7) % 2;
    pxRect(ctx, x - 10, y - 16 + typeShift, 4, 11, '#5C6C47');
    pxRect(ctx, x - 9, y - 18 + typeShift, 3, 3, '#F6CCB0');
    pxRect(ctx, x + 6, y - 16 + (1 - typeShift), 4, 11, '#5C6C47');
    pxRect(ctx, x + 6, y - 18 + (1 - typeShift), 3, 3, '#F6CCB0');
  } else if (isOnSofa) {
    if (sofaAct === 'tea') {
      // Left arm relaxed, right arm holds warm teacup (raises to sip!)
      pxRect(ctx, x - 11, y - 6 + yOff, 3, 7, '#5C6C47');
      pxRect(ctx, x - 10, y + yOff, 3, 2, '#F6CCB0');
      const cupLift = isSippingTea ? -5 : 0;
      pxRect(ctx, x + 7, y - 7 + yOff + Math.min(0, cupLift + 2), 4, 7, '#5C6C47');
      pxRect(ctx, x + 4, y - 5 + yOff + cupLift, 4, 3, '#F6CCB0');
    } else if (sofaAct === 'newspaper') {
      // Both arms forward holding open newspaper
      pxRect(ctx, x - 11, y - 7 + yOff + paperRustle, 4, 7, '#5C6C47');
      pxRect(ctx, x + 7, y - 7 + yOff + paperRustle, 4, 7, '#5C6C47');
    } else if (sofaAct === 'tv_remote') {
      // Left arm relaxed, right arm points TV remote down toward TV
      pxRect(ctx, x - 11, y - 6 + yOff, 3, 7, '#5C6C47');
      pxRect(ctx, x - 10, y + yOff, 3, 2, '#F6CCB0');
      const aimExtend = isAimingRemote ? 3 : 0;
      pxRect(ctx, x + 7, y - 6 + yOff, 4, 7 + aimExtend, '#5C6C47');
      pxRect(ctx, x + 7, y + yOff + aimExtend, 4, 3, '#F6CCB0');
    } else {
      pxRect(ctx, x - 11, y - 6 + yOff, 3, 7, '#5C6C47');
      pxRect(ctx, x + 8, y - 6 + yOff, 3, 7, '#5C6C47');
      pxRect(ctx, x - 10, y + yOff, 3, 2, '#F6CCB0');
      pxRect(ctx, x + 7, y + yOff, 3, 2, '#F6CCB0');
    }
  } else {
    pxRect(ctx, x - 11, y - 7 + yOff + (legOffset > 0 ? -1 : 0), 3, 9, '#5C6C47');
    pxRect(ctx, x + 8, y - 7 + yOff + (legOffset < 0 ? -1 : 0), 3, 9, '#5C6C47');
  }

  // Head & hair
  pxRect(ctx, x - 8, y - 22 + yOff, 16, 14, '#5A3724');
  if (player.facing !== 'up') {
    pxRect(ctx, x - 6, y - 19 + yOff, 12, 11, '#F6CCB0');
    pxRect(ctx, x - 7, y - 22 + yOff, 14, 5, '#6A422B');
    // Eyes based on facing direction & sofa reading glance
    let eyeShift = player.facing === 'left' ? -2 : player.facing === 'right' ? 2 : 0;
    if (sofaAct === 'newspaper') {
      eyeShift = Math.floor(sofaElapsed * 1.4) % 2 === 0 ? -1 : 1;
    }
    const blink = tick % 230 > 224 || isSippingTea;
    if (!blink) {
      pxRect(ctx, x - 4 + eyeShift, y - 15 + yOff, 2, 3, '#2D1E16');
      pxRect(ctx, x + 2 + eyeShift, y - 15 + yOff, 2, 3, '#2D1E16');
    } else {
      pxRect(ctx, x - 4 + eyeShift, y - 13 + yOff, 3, 1, '#2D1E16');
      pxRect(ctx, x + 1 + eyeShift, y - 13 + yOff, 3, 1, '#2D1E16');
    }
  } else {
    // Facing away (looking at monitor/north wall)
    pxRect(ctx, x - 7, y - 21 + yOff, 14, 12, '#6A422B');
    pxRect(ctx, x - 5, y - 10 + yOff, 10, 2, '#5A3724');
  }

  // Foreground sofa activity props (drawn cleanly in front of player torso/hands)
  if (sofaAct === 'tea') {
    const cupX = isSippingTea ? x - 1 : x + 3;
    const cupY = isSippingTea ? y - 11 + yOff : y - 6 + yOff;
    pxRect(ctx, cupX, cupY, 7, 6, '#FAF6F0'); // Cream ceramic teacup
    pxRect(ctx, cupX + 1, cupY + 1, 5, 2, '#B46938'); // Warm amber tea
    pxRect(ctx, cupX + 7, cupY + 1, 2, 3, '#EFE5D5'); // Cup handle
    // Gentle rising pixel steam from hot teacup
    const steam = Math.floor(tick / 12) % 4;
    pxRect(ctx, cupX + 2 + (steam % 2), cupY - 3 - steam, 2, 2, 'rgba(255,250,240,0.7)');
    if (steam > 1) {
      pxRect(ctx, cupX + 4, cupY - 6 - (steam % 2), 1, 2, 'rgba(255,250,240,0.45)');
    }
  } else if (sofaAct === 'newspaper') {
    const nx = x - 11;
    const ny = y - 10 + yOff + paperRustle;
    // Open broadsheet newspaper (left & right folded pages)
    pxRect(ctx, nx, ny, 22, 13, '#C7BBA8');
    pxRect(ctx, nx + 1, ny + 1, 9, 11, '#F5EFE6');
    pxRect(ctx, nx + 12, ny + 1, 9, 11, '#EFE7DC');
    pxRect(ctx, nx + 10, ny + 1, 2, 11, '#B3A490'); // Center fold crease
    // Tiny headline & news column pixel lines
    pxRect(ctx, nx + 2, ny + 2, 7, 2, '#3B312B');
    pxRect(ctx, nx + 2, ny + 5, 6, 1, '#7A6E63');
    pxRect(ctx, nx + 2, ny + 7, 7, 1, '#7A6E63');
    pxRect(ctx, nx + 2, ny + 9, 5, 1, '#7A6E63');
    pxRect(ctx, nx + 13, ny + 2, 7, 3, '#9BA8B4'); // Photo thumbnail
    pxRect(ctx, nx + 13, ny + 7, 7, 1, '#7A6E63');
    pxRect(ctx, nx + 13, ny + 9, 6, 1, '#7A6E63');
    // Hands gripping left & right edges of newspaper
    pxRect(ctx, nx - 1, ny + 5, 3, 3, '#F6CCB0');
    pxRect(ctx, nx + 20, ny + 5, 3, 3, '#F6CCB0');
  } else if (sofaAct === 'tv_remote') {
    const rx = x + 7;
    const ry = y + (isAimingRemote ? 2 : -1) + yOff;
    pxRect(ctx, rx, ry, 4, 8, '#262321'); // Sleek dark remote body
    pxRect(ctx, rx + 1, ry + 2, 2, 1, '#94A3B8'); // Tiny buttons
    pxRect(ctx, rx + 1, ry + 4, 2, 1, '#CBD5E1');
    // Red IR transmitter pulse when pressing button to turn on TV
    if (isAimingRemote && Math.floor(tick / 5) % 2 === 0) {
      pxRect(ctx, rx + 1, ry + 8, 2, 2, '#EF4444');
      pxRect(ctx, rx, ry + 11, 4, 1, 'rgba(252, 165, 165, 0.75)');
    }
  }
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  text: string,
  bgColor: string,
  borderColor: string
) {
  ctx.save();
  ctx.font = '600 11px "IBM Plex Sans Thai", sans-serif';
  const truncated = text.length > 26 ? `${text.slice(0, 25)}…` : text;
  const metrics = ctx.measureText(truncated);
  const padX = 8;
  const bw = Math.min(200, Math.max(58, Math.ceil(metrics.width) + padX * 2));
  const bh = 22;

  let bx = Math.round(anchorX - bw / 2);
  if (bx < 12) bx = 12;
  if (bx + bw > WORLD_W - 12) bx = WORLD_W - 12 - bw;
  const by = Math.max(8, Math.round(anchorY - bh));

  // Crisp pixel border box
  pxRect(ctx, bx - 1, by - 1, bw + 2, bh + 2, borderColor);
  pxRect(ctx, bx, by, bw, bh, bgColor);
  // Pointer notch
  pxRect(ctx, anchorX - 3, by + bh, 6, 3, borderColor);
  pxRect(ctx, anchorX - 2, by + bh - 1, 4, 3, bgColor);

  ctx.fillStyle = '#29221D';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(truncated, bx + bw / 2, by + bh / 2 + 0.5);
  ctx.restore();
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
  drawWalls(ctx, windowSkyTime, state.tick, state.extraPinCount, isPinboardActive);
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
  drawSouthRoomsFurniture(
    ctx,
    state.tick,
    Boolean(state.hasWateredPlantsToday),
    state.plantWateringProgress ?? 0
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
