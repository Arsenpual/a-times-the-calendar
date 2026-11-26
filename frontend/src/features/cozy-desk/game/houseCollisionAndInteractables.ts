import type { GreenCarState, InteractableObject, Rect, RoomZone } from '../types/game';
import {
  AISTUDIO_DESK_RECT,
  BEDROOM_BED_RECT,
  CENTER_TABLE_RECT,
  COLLIDERS,
  CORE_OFFSET_X,
  DIVIDER_COL,
  DRIVEWAY_COL_END,
  GARAGE_BAY_OPENING_ROW,
  GARAGE_FLOOR_COL_START,
  GARAGE_FLOOR_ROW_START,
  GYM_SQUAT_RACK_RECT,
  KITCHEN_DINING_RECT,
  LOWER_EAST_WALL_COL,
  LOWER_MID_WALL_ROW,
  MAILBOX_RECT,
  MID_WALL_ROW,
  OFFICE_EAST_WALL_COL,
  PORCH_PLANTER_RECT,
  ROAD_ROW_START,
  SHOWER_WET_ZONE_RECT,
  SIDEWALK_ROW_END,
  SIDEWALK_ROW_START,
  SLEEP_STATION_RECT,
  TILE,
  WEST_DIVIDER_COL,
  WORLD_H,
  WORLD_W,
} from './houseLayout';

export const INTERACTABLES: InteractableObject[] = [
  {
    id: 'coffee',
    zone: 'living',
    label: 'โต๊ะกาแฟ',
    actionLabel: 'จิบกาแฟอุ่นๆ',
    x: 2.5 * TILE + CORE_OFFSET_X,
    y: 6.7 * TILE,
    w: 2.3 * TILE,
    h: 1.1 * TILE,
    interactRadius: 56,
  },
  {
    id: 'sofa',
    zone: 'living',
    label: 'โซฟาห้องนั่งเล่น',
    actionLabel: 'นั่งพักบนโซฟา',
    x: 2.1 * TILE + CORE_OFFSET_X,
    y: 4.5 * TILE,
    w: 3.1 * TILE,
    h: 1.25 * TILE,
    interactRadius: 60,
  },
  {
    id: 'window',
    zone: 'living',
    label: 'หน้าต่างรับแสง',
    actionLabel: 'เปลี่ยนช่วงเวลาแสง',
    x: 2.2 * TILE + CORE_OFFSET_X,
    y: 0.4 * TILE,
    w: 2.8 * TILE,
    h: 1.6 * TILE,
    interactRadius: 68,
  },
  {
    id: 'bookshelf',
    zone: 'living',
    label: 'ชั้นหนังสือ',
    actionLabel: 'หยิบอ่านโน้ตแรงบันดาลใจ',
    x: 8.9 * TILE + CORE_OFFSET_X,
    y: 2.0 * TILE,
    w: 1.0 * TILE,
    h: 1.5 * TILE,
    interactRadius: 56,
  },
  {
    id: 'clock',
    zone: 'living',
    label: 'นาฬิกาลูกตุ้มโบราณ',
    actionLabel: 'ดูกิจกรรมทั้งวัน (Activity Mode)',
    x: 6.12 * TILE + CORE_OFFSET_X,
    y: 0.45 * TILE,
    w: 0.72 * TILE,
    h: 2.1 * TILE,
    interactRadius: 62,
  },
  {
    id: 'tv',
    zone: 'living',
    label: 'ทีวีห้องพักผ่อน',
    actionLabel: 'เปิดฟีด YouTube',
    x: 2.5 * TILE + CORE_OFFSET_X,
    y: 10.55 * TILE,
    w: 2.4 * TILE,
    h: 1.15 * TILE,
    interactRadius: 68,
  },
  {
    id: 'pinboard',
    zone: 'office',
    label: 'กระดานโน้ตห้องทำงาน',
    actionLabel: 'เปิด Google Tasks',
    x: 12.15 * TILE + CORE_OFFSET_X,
    y: 15,
    w: 3.0 * TILE,
    h: 29,
    interactRadius: 88,
  },
  {
    id: 'workdesk',
    zone: 'office',
    label: 'โต๊ะทำงานส่วนตัว',
    actionLabel: 'นั่งหน้าคอมพิวเตอร์',
    x: 15.65 * TILE + CORE_OFFSET_X,
    y: 2.95 * TILE,
    w: 4.1 * TILE,
    h: 2.35 * TILE,
    interactRadius: 74,
  },
  {
    id: 'drive_table',
    zone: 'office',
    label: 'โต๊ะเอกสารกลางห้อง',
    actionLabel: 'เปิด Google Drive',
    x: CENTER_TABLE_RECT.x,
    y: CENTER_TABLE_RECT.y,
    w: CENTER_TABLE_RECT.w,
    h: CENTER_TABLE_RECT.h,
    interactRadius: 76,
  },
  {
    id: 'mina_desk',
    zone: 'office',
    label: 'มีน่า (ผู้ช่วย AI)',
    actionLabel: 'คุยงานกับมีน่า',
    x: 20.2 * TILE + CORE_OFFSET_X,
    y: 6.15 * TILE,
    w: 2.65 * TILE,
    h: 3.25 * TILE,
    interactRadius: 76,
  },
  {
    id: 'antigravity_desk',
    zone: 'office',
    label: 'Antigravity (Localhost Agent)',
    actionLabel: 'เปิดคอนโซล Antigravity',
    x: 11.15 * TILE + CORE_OFFSET_X,
    y: 9.65 * TILE,
    w: 2.35 * TILE,
    h: 1.95 * TILE,
    interactRadius: 76,
  },
  {
    id: 'ai_studio_desk',
    zone: 'office',
    label: 'Google AI Studio',
    actionLabel: 'เปิดเวิร์กเบนช์ AI Studio',
    x: AISTUDIO_DESK_RECT.x,
    y: AISTUDIO_DESK_RECT.y - 0.65 * TILE,
    w: AISTUDIO_DESK_RECT.w,
    h: AISTUDIO_DESK_RECT.h + 0.65 * TILE,
    interactRadius: 76,
  },
  {
    id: 'dining_chair_nw',
    zone: 'kitchen',
    label: 'เก้าอี้โต๊ะอาหาร (บนซ้าย)',
    actionLabel: 'นั่งเก้าอี้โต๊ะอาหาร',
    x: Math.round(KITCHEN_DINING_RECT.x) + 12,
    y: Math.round(KITCHEN_DINING_RECT.y) - 13,
    w: 26,
    h: 22,
    interactRadius: 56,
  },
  {
    id: 'dining_chair_ne',
    zone: 'kitchen',
    label: 'เก้าอี้โต๊ะอาหาร (บนขวา)',
    actionLabel: 'นั่งเก้าอี้โต๊ะอาหาร',
    x: Math.round(KITCHEN_DINING_RECT.x) + Math.round(KITCHEN_DINING_RECT.w) - 38,
    y: Math.round(KITCHEN_DINING_RECT.y) - 13,
    w: 26,
    h: 22,
    interactRadius: 56,
  },
  {
    id: 'dining_chair_sw',
    zone: 'kitchen',
    label: 'เก้าอี้โต๊ะอาหาร (ล่างซ้าย)',
    actionLabel: 'นั่งเก้าอี้โต๊ะอาหาร',
    x: Math.round(KITCHEN_DINING_RECT.x) + 12,
    y: Math.round(KITCHEN_DINING_RECT.y) + Math.round(KITCHEN_DINING_RECT.h) - 10,
    w: 26,
    h: 23,
    interactRadius: 56,
  },
  {
    id: 'dining_chair_se',
    zone: 'kitchen',
    label: 'เก้าอี้โต๊ะอาหาร (ล่างขวา)',
    actionLabel: 'นั่งเก้าอี้โต๊ะอาหาร',
    x: Math.round(KITCHEN_DINING_RECT.x) + Math.round(KITCHEN_DINING_RECT.w) - 38,
    y: Math.round(KITCHEN_DINING_RECT.y) + Math.round(KITCHEN_DINING_RECT.h) - 10,
    w: 26,
    h: 23,
    interactRadius: 56,
  },
  {
    id: 'dining_table',
    zone: 'kitchen',
    label: 'โต๊ะอาหารคริสต์มาสครอบครัว',
    actionLabel: 'ฉลองมื้อไก่งวงคริสต์มาส',
    x: KITCHEN_DINING_RECT.x,
    y: KITCHEN_DINING_RECT.y,
    w: KITCHEN_DINING_RECT.w,
    h: KITCHEN_DINING_RECT.h,
    interactRadius: 72,
  },
  {
    id: 'mailbox',
    zone: 'entryway',
    label: 'ตู้ไปรษณีย์ริมถนน',
    actionLabel: 'เปิดอ่าน Gmail',
    x: MAILBOX_RECT.x,
    y: MAILBOX_RECT.y - 10,
    w: MAILBOX_RECT.w,
    h: MAILBOX_RECT.h + 10,
    interactRadius: 72,
  },
  {
    id: 'sleep_log',
    zone: 'bedroom',
    label: 'โต๊ะข้างเตียง · บันทึกการนอน',
    actionLabel: 'ทำภารกิจบันทึกการนอน (.json)',
    x: SLEEP_STATION_RECT.x - 2,
    y: SLEEP_STATION_RECT.y - 4,
    w: SLEEP_STATION_RECT.w + 4,
    h: SLEEP_STATION_RECT.h + 8,
    interactRadius: 68,
  },
  {
    id: 'bedroom_bed',
    zone: 'bedroom',
    label: 'เตียงคิงไซส์ (ห้องนอนใหญ่)',
    actionLabel: 'นอนพักผ่อน (ปิดไฟห้องนอน)',
    x: BEDROOM_BED_RECT.x,
    y: BEDROOM_BED_RECT.y - 6,
    w: BEDROOM_BED_RECT.w,
    h: BEDROOM_BED_RECT.h + 6,
    interactRadius: 88,
  },
  {
    id: 'porch_plants',
    zone: 'entryway',
    label: 'กระถางต้นไม้ 5 ต้น (โถงทางเข้า)',
    actionLabel: 'รดน้ำต้นไม้ทั้ง 5 ต้น',
    x: PORCH_PLANTER_RECT.x - 2,
    y: PORCH_PLANTER_RECT.y - 4,
    w: PORCH_PLANTER_RECT.w + 4,
    h: PORCH_PLANTER_RECT.h + 6,
    interactRadius: 76,
  },
  {
    id: 'gym_barbell',
    zone: 'gym',
    label: 'แร็คยกน้ำหนักบาร์เบล',
    actionLabel: 'ยกน้ำหนักบาร์เบล',
    x: GYM_SQUAT_RACK_RECT.x - 4,
    y: GYM_SQUAT_RACK_RECT.y,
    w: GYM_SQUAT_RACK_RECT.w + 8,
    h: GYM_SQUAT_RACK_RECT.h,
    interactRadius: 88,
  },
];

export function getRoomZone(x: number, y = 0): RoomZone {
  if (
    y >= GARAGE_FLOOR_ROW_START * TILE &&
    y < SIDEWALK_ROW_START * TILE &&
    x >= (LOWER_EAST_WALL_COL + 0.5) * TILE
  ) {
    return 'garage';
  }
  if (y >= (LOWER_MID_WALL_ROW + 1) * TILE) {
    return 'entryway';
  }
  const isWestWing = x < (WEST_DIVIDER_COL + 0.5) * TILE;
  if (y >= (MID_WALL_ROW + 1) * TILE) {
    if (x >= (LOWER_EAST_WALL_COL + 0.5) * TILE) {
      return 'gym';
    }
    return isWestWing ? 'bathroom' : 'kitchen';
  }
  if (isWestWing) {
    return 'bedroom';
  }
  const isEastOffice = x >= (DIVIDER_COL + 0.45) * TILE;
  return isEastOffice ? 'office' : 'living';
}

export function isPointInShowerWetZone(x: number, y: number): boolean {
  return (
    x >= SHOWER_WET_ZONE_RECT.x &&
    x <= SHOWER_WET_ZONE_RECT.x + SHOWER_WET_ZONE_RECT.w &&
    y >= SHOWER_WET_ZONE_RECT.y &&
    y <= SHOWER_WET_ZONE_RECT.y + SHOWER_WET_ZONE_RECT.h
  );
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function collidesWithWorld(cx: number, cy: number): boolean {
  // Player foot hitbox (smaller than visual sprite so walking feels smooth)
  const hitbox: Rect = {
    x: cx - 9,
    y: cy - 6,
    w: 18,
    h: 14,
  };
  for (const col of COLLIDERS) {
    if (rectsOverlap(hitbox, col)) {
      return true;
    }
  }
  return false;
}

export function findNearestInteractable(px: number, py: number): InteractableObject | null {
  let closest: InteractableObject | null = null;
  let bestDist = Infinity;

  for (const item of INTERACTABLES) {
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist <= item.interactRadius && dist < bestDist) {
      bestDist = dist;
      closest = item;
    }
  }
  return closest;
}

export function getInteractableAtPoint(wx: number, wy: number): InteractableObject | null {
  let best: InteractableObject | null = null;
  let bestArea = Infinity;

  for (const item of INTERACTABLES) {
    if (wx >= item.x - 4 && wx <= item.x + item.w + 4 && wy >= item.y - 4 && wy <= item.y + item.h + 4) {
      const area = item.w * item.h;
      if (area < bestArea) {
        bestArea = area;
        best = item;
      }
    }
  }
  if (best) return best;

  for (const item of INTERACTABLES) {
    if (wx >= item.x - 8 && wx <= item.x + item.w + 8 && wy >= item.y - 8 && wy <= item.y + item.h + 8) {
      return item;
    }
  }
  return null;
}

// =========================================================================
// DRIVABLE LEFT GARAGE CAR (SAGE-TEAL COMPACT HATCHBACK) GEOMETRY & PHYSICS
// =========================================================================
export const GREEN_CAR_W = 56; // Width across axles (fits cleanly inside Bay 1 & 64px road lane)
export const GREEN_CAR_L = 104; // Bumper-to-bumper length
export const GREEN_CAR_HALF_W = 22; // Collision half-width
export const GREEN_CAR_HALF_L = 44; // Collision half-length

export const GREEN_CAR_INITIAL: Omit<
  GreenCarState,
  'speed' | 'steerAngle' | 'isDriving' | 'braking' | 'reversing' | 'hornTick'
> = {
  x: Math.round(23.6 * TILE), // Centered neatly in Bay 1 (cols 21.95..25.25)
  y: Math.round(26.35 * TILE), // Centered vertically inside Bay 1 (rows 23.65..29.05)
  angle: -Math.PI / 2, // Nose pointing UP (north toward garage workbench)
};

export function createInitialGreenCar(): GreenCarState {
  return {
    x: GREEN_CAR_INITIAL.x,
    y: GREEN_CAR_INITIAL.y,
    angle: GREEN_CAR_INITIAL.angle,
    speed: 0,
    steerAngle: 0,
    isDriving: false,
    braking: false,
    reversing: false,
    hornTick: 0,
  };
}

/**
 * Checks whether a world point (px, py) lies inside the oriented bounding box
 * of the drivable green car (expanded by `pad` pixels).
 */
export function isPointInsideCar(
  px: number,
  py: number,
  car: Pick<GreenCarState, 'x' | 'y' | 'angle'>,
  pad = 6
): boolean {
  const dx = px - car.x;
  const dy = py - car.y;
  const cos = Math.cos(-car.angle);
  const sin = Math.sin(-car.angle);
  // localX runs along car forward/backward axis; localY runs left/right across width
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return (
    Math.abs(localX) <= GREEN_CAR_HALF_L + pad &&
    Math.abs(localY) <= GREEN_CAR_HALF_W + pad
  );
}

function isRoadEdgeStopCollider(col: Rect): boolean {
  return col.y >= SIDEWALK_ROW_START * TILE && col.w <= TILE;
}

/**
 * Checks whether the green car at (x, y, angle) collides with walls, garage props,
 * yard boundaries, mailbox, or non-drivable pedestrian zones.
 * On the 2-lane asphalt road (y >= (ROAD_ROW_START - 0.55) * TILE), horizontal
 * map edges are intentionally open so the car wraps seamlessly around to the opposite side!
 */
export function carCollidesWithWorld(x: number, y: number, angle: number): boolean {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = GREEN_CAR_HALF_W;
  const hl = GREEN_CAR_HALF_L;

  // Sample 8 perimeter points + center in car-local coordinates (lx along nose, ly across width)
  const samples: Array<[number, number]> = [
    [hl, hw],
    [hl, -hw],
    [-hl, hw],
    [-hl, -hw],
    [hl, 0],
    [-hl, 0],
    [0, hw],
    [0, -hw],
    [0, 0],
  ];

  const roadApronY = (SIDEWALK_ROW_END + 0.35) * TILE; // ~40.35 * TILE — dipped apron into street
  const roadZoneY = (ROAD_ROW_START - 0.55) * TILE; // ~40.45 * TILE — full-width drivable road
  const garageWestLimitX = (GARAGE_FLOOR_COL_START + 0.08) * TILE; // Keep car out of Entryway & Walkway
  const drivewayEastLimitX = (DRIVEWAY_COL_END + 1.15) * TILE;
  const garageNorthLimitY = (GARAGE_FLOOR_ROW_START + 0.05) * TILE;
  const roadSouthLimitY = WORLD_H - 12;

  for (const [lx, ly] of samples) {
    const px = x + lx * cos - ly * sin;
    const py = y + lx * sin + ly * cos;

    // Never drive north of the garage north interior wall or south off the road curb
    if (py < garageNorthLimitY || py > roadSouthLimitY) {
      return true;
    }

    // Above the street lane, keep the car strictly inside the 2-Car Garage & Driveway corridor
    // (blocks entering the Entryway pedestrian door, front walkway connector path, and side lawns)
    if (py < roadApronY) {
      if (px < garageWestLimitX) {
        return true;
      }
      if (py >= (GARAGE_BAY_OPENING_ROW + 0.65) * TILE && px > drivewayEastLimitX) {
        return true;
      }
      if (px > OFFICE_EAST_WALL_COL * TILE - 2) {
        return true;
      }
    }

    // Check against world static colliders (skip left/right road perimeter stops when on the road!)
    const onRoadBand = py >= roadZoneY;
    for (const col of COLLIDERS) {
      if (onRoadBand && isRoadEdgeStopCollider(col)) {
        continue;
      }
      if (
        px >= col.x - 2 &&
        px <= col.x + col.w + 2 &&
        py >= col.y - 2 &&
        py <= col.y + col.h + 2
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Finds the cleanest walkable spot right beside the parked green car (preferring
 * the driver's side door first) so the player can step out without getting stuck.
 */
export function findSafeCarExitPos(
  car: Pick<GreenCarState, 'x' | 'y' | 'angle'>
): { x: number; y: number } {
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);

  // Local offsets: [forward/back, left/right]
  const candidates: Array<[number, number]> = [
    [0, -44],
    [0, 44],
    [-16, -46],
    [-16, 46],
    [16, -46],
    [16, 46],
    [-60, 0],
    [60, 0],
    [0, -58],
    [0, 58],
    [-64, -36],
    [-64, 36],
    [64, -36],
    [64, 36],
  ];

  const minX = 18;
  const maxX = WORLD_W - 18;
  const minY = 2.2 * TILE;
  const maxY = WORLD_H - 18;

  for (const [lx, ly] of candidates) {
    const px = Math.round(car.x + lx * cos - ly * sin);
    const py = Math.round(car.y + lx * sin + ly * cos);
    if (px < minX || px > maxX || py < minY || py > maxY) continue;
    if (!collidesWithWorld(px, py) && !isPointInsideCar(px, py, car, 7)) {
      return { x: px, y: py };
    }
  }

  // Fallback inside clamped bounds
  return {
    x: Math.max(minX, Math.min(maxX, Math.round(car.x))),
    y: Math.max(minY, Math.min(maxY, Math.round(car.y))),
  };
}

/**
 * Builds a live dynamic InteractableObject centered on the green car's current position.
 */
export function getGreenCarInteractable(
  car: Pick<GreenCarState, 'x' | 'y' | 'angle'>
): InteractableObject {
  const absCos = Math.abs(Math.cos(car.angle));
  const absSin = Math.abs(Math.sin(car.angle));
  const halfW = GREEN_CAR_HALF_L * absCos + GREEN_CAR_HALF_W * absSin + 4;
  const halfH = GREEN_CAR_HALF_L * absSin + GREEN_CAR_HALF_W * absCos + 4;
  return {
    id: 'green_car',
    zone: getRoomZone(car.x, car.y),
    label: 'รถคันสีเขียว',
    actionLabel: 'ขึ้นขับรถ',
    x: Math.round(car.x - halfW),
    y: Math.round(car.y - halfH),
    w: Math.round(halfW * 2),
    h: Math.round(halfH * 2),
    interactRadius: 78,
  };
}
