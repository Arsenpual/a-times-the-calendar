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

export function drawPottedPlant(ctx: CanvasRenderingContext2D, x: number, y: number, variant: 'monstera' | 'fern') {
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

export function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
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

export function drawChristmasTree(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number) {
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

export function drawLivingFurniture(ctx: CanvasRenderingContext2D, tick: number, isTvOn: boolean) {
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

export function drawOfficeFurniture(
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

export function drawCenterDriveTable(
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

