import type {
  DiningChairSeatId,
  FacingDirection,
  GreenCarState,
  InteractableObject,
  Rect,
  RoomZone,
} from '../types/game';

export const TILE = 32;

// 3-Wing Family Home + Long Front Walkway + 2-Car Garage + Front Street Layout:
// - West Wing (cols 1..8): Master Bedroom (rows 2..11) directly above Bathroom (rows 14..21)
// - Center Core (cols 10..18): Living Room (rows 2..11), Kitchen (rows 14..21), Entryway/Foyer & Front Porch (rows 24..31), Long Front Garden Walkway (rows 32..38)
// - East Wing (cols 20..31): +50% Expanded Home Office (rows 2..11), Home Gym (rows 14..19, entered from Home Office), Attached 2-Car Garage (rows 22..29) & Concrete Driveway (rows 31..38)
// - South Street Frontage (cols 0..32, rows 39..44): Concrete Sidewalk & 2-Lane Neighborhood Road
export const CORE_OFFSET_COLS = 9;
export const CORE_OFFSET_X = CORE_OFFSET_COLS * TILE; // 288px shift for Center Core & East Wing

export const WEST_DIVIDER_COL = 9; // Vertical wall separating Bedroom/Bathroom (cols 1..8) and Living/Kitchen (cols 10..18)
export const DIVIDER_COL = 10 + CORE_OFFSET_COLS; // 19 — separates Living/Kitchen/Entryway and Home Office/Garage
export const LOWER_EAST_WALL_COL = 19; // Shared wall between Kitchen/Entryway and Backyard/2-Car Garage
export const OFFICE_EAST_WALL_COL = 23 + CORE_OFFSET_COLS; // 32 — East exterior wall of Home Office & 2-Car Garage

export const MAP_COLS = OFFICE_EAST_WALL_COL + 1; // 33
export const MAP_ROWS = 45;
export const WORLD_W = MAP_COLS * TILE; // 1056
export const LOWER_WORLD_W = (LOWER_EAST_WALL_COL + 1) * TILE; // 640
export const WORLD_H = MAP_ROWS * TILE; // 1440

// Widescreen camera viewport (1.5x base resolution for crisp pixel & overview rendering)
export const VIEW_W = 960;
export const VIEW_H = 624;
export const CAMERA_BASE_SCALE = 1.5;
export const CAMERA_MIN_ZOOM = Math.min(
  VIEW_W / (WORLD_W * CAMERA_BASE_SCALE),
  VIEW_H / (WORLD_H * CAMERA_BASE_SCALE)
); // Fits entire family house, long front walkway, 2-car garage & front road cleanly
export const CAMERA_MAX_ZOOM = 2.0;
export const CAMERA_DEFAULT_ZOOM = 1.12;

// Crisp 2x full-map viewport dimensions
export const FULLMAP_VIEW_W = WORLD_W * 2;
export const FULLMAP_VIEW_H = WORLD_H * 2;
export const FULLMAP_BASE_SCALE = 2;
export const FULLMAP_MIN_ZOOM = 1.0;

export const ROOM_CAMERA_TARGETS = {
  overview: { x: WORLD_W / 2, y: WORLD_H / 2, zoom: CAMERA_MIN_ZOOM },
  bedroom: { x: 4.9 * TILE, y: 6.5 * TILE, zoom: 1.2 },
  living: { x: (5.2 + CORE_OFFSET_COLS) * TILE, y: 6.3 * TILE, zoom: 1.2 },
  office: { x: (16.8 + CORE_OFFSET_COLS) * TILE, y: 6.4 * TILE, zoom: 1.08 },
  gym: { x: 26.0 * TILE, y: 16.6 * TILE, zoom: 1.15 },
  bathroom: { x: 4.9 * TILE, y: 17.5 * TILE, zoom: 1.28 },
  kitchen: { x: (5.2 + CORE_OFFSET_COLS) * TILE, y: 17.5 * TILE, zoom: 1.28 },
  entryway: { x: 15.0 * TILE, y: 33.8 * TILE, zoom: 0.86 },
  garage: { x: 26.0 * TILE, y: 28.5 * TILE, zoom: 1.0 },
} as const;

// Upper wing vertical doorways (rows 6..8 = 96px tall)
export const BEDROOM_DOOR_ROW_START = 6;
export const BEDROOM_DOOR_ROW_END = 8; // col 9 open doorway connecting Master Bedroom <-> Living Room
export const DOOR_ROW_START = 6;
export const DOOR_ROW_END = 8; // col 19 open doorway connecting Living Room <-> Home Office

// Horizontal dividing wall #1 separating Upper Wing (Bedroom/Living/Office) and Middle Wing (Bathroom/Kitchen)
export const MID_WALL_ROW = 12; // occupies rows 12..13 (2 tiles tall for 3/4 north wall face in middle rooms)
export const LOWER_FLOOR_ROW_START = 14;
export const LOWER_FLOOR_ROW_END = 21;
export const SOUTH_WALL_ROW = 22;

// Middle wing doorways (2 tiles wide/tall = 64px each)
export const KITCHEN_DOOR_COL_START = 5 + CORE_OFFSET_COLS; // 14
export const KITCHEN_DOOR_COL_END = 6 + CORE_OFFSET_COLS; // 15 — open archway between Living Lounge & Kitchen
export const BATH_DOOR_ROW_START = 16;
export const BATH_DOOR_ROW_END = 17; // col 9 doorway connecting Bathroom (left) <-> Kitchen (right)

// Horizontal dividing wall #2 separating Middle Wing (Bathroom/Kitchen) and South Wing (Entryway/Porch)
export const LOWER_MID_WALL_ROW = 22; // occupies rows 22..23 (Bathroom south outer wall cols 0..9 + Kitchen/Entryway divider cols 10..19)
export const FOYER_KITCHEN_DOOR_COL_START = 3 + CORE_OFFSET_COLS; // 12
export const FOYER_KITCHEN_DOOR_COL_END = 4 + CORE_OFFSET_COLS; // 13 — open archway connecting Kitchen <-> Entryway/Foyer
export const FOYER_FLOOR_ROW_START = 24;
export const FOYER_FLOOR_ROW_END = 27;
export const FOYER_SOUTH_WALL_ROW = 28; // Entryway front exterior wall with grand double doorway
export const FRONT_DOOR_COL_START = 4 + CORE_OFFSET_COLS; // 13
export const FRONT_DOOR_COL_END = 6 + CORE_OFFSET_COLS; // 15 — open grand front doorway onto Front Porch (96px wide)
export const PORCH_ROW_START = 29;
export const PORCH_ROW_END = 31;

// Master Bedroom bounds (upper-west wing, cols 1..8, rows 2..11 — left of Living Room, above Bathroom)
export const BEDROOM_FLOOR_COL_START = 1;
export const BEDROOM_FLOOR_COL_END = 8;
export const BEDROOM_FLOOR_ROW_START = 2;
export const BEDROOM_FLOOR_ROW_END = 11;

// Home Gym (middle-east wing, cols 20..31, rows 14..19 — directly below Home Office, entered via Office south archway)
export const GYM_FLOOR_COL_START = 20;
export const GYM_FLOOR_COL_END = 31;
export const GYM_FLOOR_ROW_START = 14;
export const GYM_FLOOR_ROW_END = 19;
export const GYM_DOOR_COL_START = 19 + CORE_OFFSET_COLS; // 28 — open archway connecting Home Office <-> Home Gym
export const GYM_DOOR_COL_END = 20 + CORE_OFFSET_COLS; // 29

// Attached 2-Car Family Garage (east wing, cols 20..31, rows 22..29) + Concrete Driveway (cols 21..30, rows 31..38)
export const GARAGE_NORTH_WALL_ROW = 20; // occupies rows 20..21 (2 tiles tall for 3/4 north wall face inside garage)
export const GARAGE_FLOOR_COL_START = 20;
export const GARAGE_FLOOR_COL_END = 31;
export const GARAGE_FLOOR_ROW_START = 22;
export const GARAGE_FLOOR_ROW_END = 29;
export const GARAGE_BAY_OPENING_ROW = 30; // Wide double-bay roller door header opening onto concrete driveway
export const GARAGE_DOOR_ROW_START = 25;
export const GARAGE_DOOR_ROW_END = 26; // col 19 interior access doorway connecting Entryway <-> 2-Car Garage
export const DRIVEWAY_COL_START = 21;
export const DRIVEWAY_COL_END = 30;

// Extended Front Garden Walkway (rows 32..38), Concrete Sidewalk (rows 39..40) & 2-Lane Asphalt Street (rows 41..44)
export const WALKWAY_ROW_START = 32;
export const WALKWAY_ROW_END = 38;
export const SIDEWALK_ROW_START = 39;
export const SIDEWALK_ROW_END = 40;
export const ROAD_ROW_START = 41;
export const ROAD_ROW_END = 44;

// Roadside Family Mailbox mounted at the concrete sidewalk curb beside the front crosswalk & street
export const MAILBOX_RECT: Rect = {
  x: Math.round(16.55 * TILE),
  y: Math.round(39.72 * TILE),
  w: Math.round(0.95 * TILE),
  h: Math.round(0.95 * TILE),
};
export const MAILBOX_STAND_POS = {
  x: Math.round(16.05 * TILE),
  y: Math.round(39.95 * TILE),
};

// Master Bedroom right-side oak nightstand upgraded as the Daily Sleep Quest Station (Sleep JSON & AI Analysis)
export const SLEEP_STATION_RECT: Rect = {
  x: Math.round(6.75 * TILE),
  y: Math.round(2.0 * TILE),
  w: TILE,
  h: TILE,
};
export const SLEEP_STATION_STAND_POS = {
  x: Math.round(7.25 * TILE),
  y: Math.round(3.55 * TILE),
};

// Master Bedroom Grand King Bed (interactive sleep spot — dims bedroom lights & switches window sky to night)
export const BEDROOM_BED_RECT: Rect = {
  x: Math.round(3.0 * TILE),
  y: Math.round(2.0 * TILE),
  w: Math.round(3.6 * TILE),
  h: Math.round(3.1 * TILE),
};
export const BEDROOM_BED_SEAT_POS = {
  x: Math.round(4.15 * TILE),
  y: Math.round(3.3 * TILE),
};
export const BEDROOM_BED_STAND_POS = {
  x: Math.round(2.35 * TILE),
  y: Math.round(4.35 * TILE),
};

// Front Porch / Entryway 5 Blooming Terracotta Potted Plants (daily watering quest — resets at midnight)
export const PORCH_PLANTER_RECT: Rect = {
  x: Math.round(7.55 * TILE + CORE_OFFSET_X),
  y: Math.round(29.18 * TILE),
  w: Math.round(2.15 * TILE),
  h: Math.round(0.9 * TILE),
};
export const PORCH_PLANTER_STAND_POS = {
  x: Math.round(16.05 * TILE),
  y: Math.round(30.15 * TILE),
};

// Home Gym NW Power Squat Rack & Loaded Olympic Barbell (interactive weightlifting station)
export const GYM_SQUAT_RACK_RECT: Rect = {
  x: Math.round(20.25 * TILE),
  y: Math.round(14.05 * TILE),
  w: Math.round(2.0 * TILE),
  h: Math.round(1.45 * TILE),
};
export const GYM_SQUAT_RACK_LIFT_POS = {
  x: Math.round(21.35 * TILE),
  y: Math.round(16.15 * TILE),
};
export const GYM_SQUAT_RACK_STAND_POS = {
  x: Math.round(21.35 * TILE),
  y: Math.round(16.55 * TILE),
};

export const PLAYER_START = {
  x: (6.1 + CORE_OFFSET_COLS) * TILE,
  y: 9.2 * TILE,
};

// Player's own Home Office computer desk seat & stand-up coordinates (aligned dead-center with monitor)
export const WORK_SEAT_POS = {
  x: (17.56 + CORE_OFFSET_COLS) * TILE,
  y: 4.92 * TILE,
};
export const WORK_STAND_POS = {
  x: (17.56 + CORE_OFFSET_COLS) * TILE,
  y: 5.72 * TILE,
};

// Living Room cozy sofa seat & stand-up coordinates
export const SOFA_SEAT_POS = {
  x: (3.65 + CORE_OFFSET_COLS) * TILE,
  y: 5.38 * TILE,
};
export const SOFA_STAND_POS = {
  x: (3.65 + CORE_OFFSET_COLS) * TILE,
  y: 6.18 * TILE,
};

// West Bathroom wet-zone glass shower room bounds & automatic showering coordinates (NW corner: cols 1.05..4.38)
export const SHOWER_WET_ZONE_RECT: Rect = {
  x: 1.05 * TILE,
  y: 14.0 * TILE,
  w: (4.38 - 1.05) * TILE,
  h: (17.95 - 14.0) * TILE,
};

export const SHOWER_STAND_POS = {
  x: 2.58 * TILE,
  y: 15.65 * TILE,
};

export const SHOWER_SOAP_HOLDER_POS = {
  x: 1.78 * TILE,
  y: 15.1 * TILE,
};

// Large central Home Office document & reference work table (centered in expanded 12-col office)
export const CENTER_TABLE_RECT: Rect = {
  x: (15.0 + CORE_OFFSET_COLS) * TILE,
  y: 7.25 * TILE,
  w: 3.35 * TILE,
  h: 2.05 * TILE,
};

// Family Kitchen wooden dining table & tucked chairs footprint (positioned for open corridor to west Bathroom & south Entryway)
export const KITCHEN_DINING_RECT: Rect = {
  x: (4.35 + CORE_OFFSET_COLS) * TILE,
  y: 18.25 * TILE,
  w: 2.95 * TILE,
  h: 1.85 * TILE,
};

export interface DiningChairSpot {
  seatPos: { x: number; y: number };
  standPos: { x: number; y: number };
  facing: FacingDirection;
}

export const DINING_CHAIR_SPOTS: Record<DiningChairSeatId, DiningChairSpot> = {
  dining_chair_nw: {
    seatPos: {
      x: Math.round(KITCHEN_DINING_RECT.x) + 25,
      y: Math.round(KITCHEN_DINING_RECT.y) - 1,
    },
    standPos: {
      x: Math.round(KITCHEN_DINING_RECT.x) + 25,
      y: Math.round(KITCHEN_DINING_RECT.y) - 24,
    },
    facing: 'down',
  },
  dining_chair_ne: {
    seatPos: {
      x: Math.round(KITCHEN_DINING_RECT.x) + Math.round(KITCHEN_DINING_RECT.w) - 25,
      y: Math.round(KITCHEN_DINING_RECT.y) - 1,
    },
    standPos: {
      x: Math.round(KITCHEN_DINING_RECT.x) + Math.round(KITCHEN_DINING_RECT.w) - 25,
      y: Math.round(KITCHEN_DINING_RECT.y) - 24,
    },
    facing: 'down',
  },
  dining_chair_sw: {
    seatPos: {
      x: Math.round(KITCHEN_DINING_RECT.x) + 25,
      y: Math.round(KITCHEN_DINING_RECT.y) + Math.round(KITCHEN_DINING_RECT.h) + 1,
    },
    standPos: {
      x: Math.round(KITCHEN_DINING_RECT.x) + 25,
      y: Math.round(KITCHEN_DINING_RECT.y) + Math.round(KITCHEN_DINING_RECT.h) + 24,
    },
    facing: 'up',
  },
  dining_chair_se: {
    seatPos: {
      x: Math.round(KITCHEN_DINING_RECT.x) + Math.round(KITCHEN_DINING_RECT.w) - 25,
      y: Math.round(KITCHEN_DINING_RECT.y) + Math.round(KITCHEN_DINING_RECT.h) + 1,
    },
    standPos: {
      x: Math.round(KITCHEN_DINING_RECT.x) + Math.round(KITCHEN_DINING_RECT.w) - 25,
      y: Math.round(KITCHEN_DINING_RECT.y) + Math.round(KITCHEN_DINING_RECT.h) + 24,
    },
    facing: 'up',
  },
};

export function isDiningChairSeatId(id: string | null | undefined): id is DiningChairSeatId {
  return (
    id === 'dining_chair_nw' ||
    id === 'dining_chair_ne' ||
    id === 'dining_chair_sw' ||
    id === 'dining_chair_se'
  );
}

// Mina's own workstation swivel chair in the dedicated East AI Suite of the expanded Home Office
export const MINA_POS = {
  x: (20.72 + CORE_OFFSET_COLS) * TILE,
  y: 7.75 * TILE,
};

// Antigravity Localhost Coding Agent position & player interaction spot (south-west tech zone of Home Office)
export const AGY_POS = {
  x: (13.0 + CORE_OFFSET_COLS) * TILE,
  y: 10.6 * TILE,
};
export const AGY_STAND_POS = {
  x: (13.95 + CORE_OFFSET_COLS) * TILE,
  y: 10.6 * TILE,
};

// Google AI Studio Lab Station & character position (south-center bay of expanded Home Office)
export const AISTUDIO_DESK_RECT: Rect = {
  x: (15.6 + CORE_OFFSET_COLS) * TILE,
  y: 10.75 * TILE,
  w: 2.55 * TILE,
  h: 1.05 * TILE,
};
export const AISTUDIO_POS = {
  x: (16.88 + CORE_OFFSET_COLS) * TILE,
  y: 10.38 * TILE,
};
export const AISTUDIO_STAND_POS = {
  x: (16.88 + CORE_OFFSET_COLS) * TILE,
  y: 9.82 * TILE,
};

// Tight proximity thresholds around Mina's desk (must be inside radius to access Mina)
export const MINA_APPROACH_RADIUS = 52;
export const MINA_LEAVE_RADIUS = 64;
export const MINA_MAX_ROAM_RADIUS = 40;
export const MINA_GREET_STOP_DIST = 28;

// Tight proximity thresholds around Antigravity's localhost station
export const AGY_APPROACH_RADIUS = 52;
export const AGY_LEAVE_RADIUS = 64;

// Tight proximity thresholds around Google AI Studio's lab station
export const AISTUDIO_APPROACH_RADIUS = 52;
export const AISTUDIO_LEAVE_RADIUS = 64;

// Clear walkable route to stand directly in front of the unobstructed north-west Office Pinboard
export const MINA_AISLE_X = (19.65 + CORE_OFFSET_COLS) * TILE;
export const MINA_PINBOARD_SPOT = { x: (13.65 + CORE_OFFSET_COLS) * TILE, y: 2.52 * TILE };

export const MINA_TO_PINBOARD_WAYPOINTS = [
  { x: MINA_AISLE_X, y: 5.55 * TILE },
  { x: (14.5 + CORE_OFFSET_COLS) * TILE, y: 5.55 * TILE },
  MINA_PINBOARD_SPOT,
];

export const MINA_RETURN_DESK_WAYPOINTS = [
  { x: (14.5 + CORE_OFFSET_COLS) * TILE, y: 5.55 * TILE },
  { x: MINA_AISLE_X, y: 5.55 * TILE },
  { x: MINA_POS.x, y: MINA_POS.y },
];

// Static collision boxes in world coordinates
export const COLLIDERS: Rect[] = [
  // =========================================================================
  // 1. OUTER STRUCTURAL WALLS & DECORATIVE SIDE YARD BOUNDARIES
  // =========================================================================
  { x: 0, y: 0, w: WORLD_W, h: 2 * TILE }, // Full North outer wall (rows 0..1, cols 0..32)
  { x: 0, y: 0, w: TILE, h: (LOWER_MID_WALL_ROW + 1) * TILE }, // West outer wall of Master Bedroom & Bathroom (col 0, rows 0..22)
  { x: OFFICE_EAST_WALL_COL * TILE, y: 0, w: TILE, h: (MID_WALL_ROW + 1) * TILE }, // Office East outer wall (col 32, rows 0..12)

  // West Front Garden decorative yard (cols 0..9, rows 22..38.8 — south of Bathroom & west of Entryway/Porch/Walkway)
  {
    x: 0,
    y: LOWER_MID_WALL_ROW * TILE,
    w: (WEST_DIVIDER_COL + 1) * TILE,
    h: (SIDEWALK_ROW_START - LOWER_MID_WALL_ROW) * TILE,
  },
  // Shared Kitchen <-> Home Gym vertical dividing wall (col 19, rows 12..21 — solid; Gym is entered exclusively via Home Office)
  {
    x: LOWER_EAST_WALL_COL * TILE,
    y: MID_WALL_ROW * TILE,
    w: TILE,
    h: (GARAGE_FLOOR_ROW_START - MID_WALL_ROW) * TILE,
  },
  // Home Gym East outer wall (col 32, rows 12..21 — seamlessly connects Home Office & 2-Car Garage east walls)
  {
    x: OFFICE_EAST_WALL_COL * TILE,
    y: MID_WALL_ROW * TILE,
    w: TILE,
    h: (GARAGE_FLOOR_ROW_START - MID_WALL_ROW) * TILE,
  },
  // Shared Home Gym <-> 2-Car Garage horizontal dividing wall (cols 20..31, rows 20..21)
  {
    x: GYM_FLOOR_COL_START * TILE,
    y: GARAGE_NORTH_WALL_ROW * TILE,
    w: (GYM_FLOOR_COL_END - GYM_FLOOR_COL_START + 1) * TILE,
    h: 2 * TILE,
  },
  // 2-Car Garage East outer wall (col 32, rows 22..30)
  {
    x: OFFICE_EAST_WALL_COL * TILE,
    y: GARAGE_FLOOR_ROW_START * TILE,
    w: TILE,
    h: (GARAGE_BAY_OPENING_ROW - GARAGE_FLOOR_ROW_START + 1) * TILE,
  },
  // East front garden strip right of the 2-Car Driveway (cols 31.15..33, rows 31..38.8)
  {
    x: (DRIVEWAY_COL_END + 1.15) * TILE,
    y: (GARAGE_BAY_OPENING_ROW + 1) * TILE,
    w: (MAP_COLS - DRIVEWAY_COL_END - 1.15) * TILE,
    h: (SIDEWALK_ROW_START - GARAGE_BAY_OPENING_ROW - 1) * TILE,
  },

  // Street perimeter stops (left, right, and south edge of the 2-lane neighborhood road)
  { x: 0, y: SIDEWALK_ROW_START * TILE, w: 0.45 * TILE, h: (MAP_ROWS - SIDEWALK_ROW_START) * TILE }, // Left road edge
  {
    x: (MAP_COLS - 0.45) * TILE,
    y: SIDEWALK_ROW_START * TILE,
    w: 0.45 * TILE,
    h: (MAP_ROWS - SIDEWALK_ROW_START) * TILE,
  }, // Right road edge
  { x: 0, y: (MAP_ROWS - 0.35) * TILE, w: WORLD_W, h: 0.5 * TILE }, // Bottom road edge

  // =========================================================================
  // 2. INTERIOR DIVIDING WALLS & DOORWAYS
  // =========================================================================
  // West vertical dividing wall (col 9) — Upper Wing: Master Bedroom <-> Living Room doorway at rows 6..8
  { x: WEST_DIVIDER_COL * TILE, y: 2 * TILE, w: TILE, h: (BEDROOM_DOOR_ROW_START - 2) * TILE }, // rows 2..5
  {
    x: WEST_DIVIDER_COL * TILE,
    y: (BEDROOM_DOOR_ROW_END + 1) * TILE,
    w: TILE,
    h: (MID_WALL_ROW - BEDROOM_DOOR_ROW_END - 1) * TILE,
  }, // rows 9..11

  // West vertical dividing wall (col 9) — Middle Wing: Bathroom <-> Kitchen doorway at rows 16..17
  {
    x: WEST_DIVIDER_COL * TILE,
    y: LOWER_FLOOR_ROW_START * TILE,
    w: TILE,
    h: (BATH_DOOR_ROW_START - LOWER_FLOOR_ROW_START) * TILE,
  }, // rows 14..15
  {
    x: WEST_DIVIDER_COL * TILE,
    y: (BATH_DOOR_ROW_END + 1) * TILE,
    w: TILE,
    h: (LOWER_MID_WALL_ROW - BATH_DOOR_ROW_END - 1) * TILE,
  }, // rows 18..21

  // Center-East vertical dividing wall (col 19) — Upper Wing: Living Room <-> Home Office doorway at rows 6..8
  { x: DIVIDER_COL * TILE, y: 2 * TILE, w: TILE, h: (DOOR_ROW_START - 2) * TILE }, // rows 2..5
  {
    x: DIVIDER_COL * TILE,
    y: (DOOR_ROW_END + 1) * TILE,
    w: TILE,
    h: (MID_WALL_ROW - DOOR_ROW_END - 1) * TILE,
  }, // rows 9..11

  // Horizontal dividing wall #1 (rows 12..13): open at Living <-> Kitchen (cols 14..15) AND Home Office <-> Home Gym (cols 28..29)
  // Solid between Master Bedroom & Bathroom (cols 1..13), between Living/Office-west & Kitchen/Gym-west (cols 16..27), and Gym-east (cols 30..31)
  {
    x: 1 * TILE,
    y: MID_WALL_ROW * TILE,
    w: (KITCHEN_DOOR_COL_START - 1) * TILE,
    h: 2 * TILE,
  }, // cols 1..13
  {
    x: (KITCHEN_DOOR_COL_END + 1) * TILE,
    y: MID_WALL_ROW * TILE,
    w: (GYM_DOOR_COL_START - KITCHEN_DOOR_COL_END - 1) * TILE,
    h: 2 * TILE,
  }, // cols 16..27
  {
    x: (GYM_DOOR_COL_END + 1) * TILE,
    y: MID_WALL_ROW * TILE,
    w: (OFFICE_EAST_WALL_COL - GYM_DOOR_COL_END - 1) * TILE,
    h: 2 * TILE,
  }, // cols 30..31

  // Horizontal dividing wall #2 (rows 22..23): Kitchen <-> Entryway archway ONLY at cols 12..13
  {
    x: (WEST_DIVIDER_COL + 1) * TILE,
    y: LOWER_MID_WALL_ROW * TILE,
    w: (FOYER_KITCHEN_DOOR_COL_START - WEST_DIVIDER_COL - 1) * TILE,
    h: 2 * TILE,
  }, // cols 10..11
  {
    x: (FOYER_KITCHEN_DOOR_COL_END + 1) * TILE,
    y: LOWER_MID_WALL_ROW * TILE,
    w: (LOWER_EAST_WALL_COL - FOYER_KITCHEN_DOOR_COL_END - 1) * TILE,
    h: 2 * TILE,
  }, // cols 14..18

  // Entryway / Foyer south exterior wall (row 28) with open Front Double Doorway at cols 13..15
  {
    x: (WEST_DIVIDER_COL + 1) * TILE,
    y: FOYER_SOUTH_WALL_ROW * TILE,
    w: (FRONT_DOOR_COL_START - WEST_DIVIDER_COL - 1) * TILE,
    h: TILE,
  }, // cols 10..12
  {
    x: (FRONT_DOOR_COL_END + 1) * TILE,
    y: FOYER_SOUTH_WALL_ROW * TILE,
    w: (LOWER_EAST_WALL_COL - FRONT_DOOR_COL_END - 1) * TILE,
    h: TILE,
  }, // cols 16..18

  // Shared Entryway <-> 2-Car Garage vertical wall (col 19, rows 22..30) with open interior doorway at rows 25..26
  {
    x: LOWER_EAST_WALL_COL * TILE,
    y: LOWER_MID_WALL_ROW * TILE,
    w: TILE,
    h: (GARAGE_DOOR_ROW_START - LOWER_MID_WALL_ROW) * TILE,
  }, // rows 22..24
  {
    x: LOWER_EAST_WALL_COL * TILE,
    y: (GARAGE_DOOR_ROW_END + 1) * TILE,
    w: TILE,
    h: (GARAGE_BAY_OPENING_ROW - GARAGE_DOOR_ROW_END) * TILE,
  }, // rows 27..30

  // 2-Car Garage south double-bay corner piers (row 30 — leaving cols 20.85..31.15 wide open onto Driveway!)
  { x: LOWER_EAST_WALL_COL * TILE, y: GARAGE_BAY_OPENING_ROW * TILE, w: 1.85 * TILE, h: TILE }, // Left garage pier
  { x: (DRIVEWAY_COL_END + 1.15) * TILE, y: GARAGE_BAY_OPENING_ROW * TILE, w: 1.85 * TILE, h: TILE }, // Right garage pier

  // Front Porch south railings & Extended Front Lawn beds flanking the Long Front Walkway (cols 13..15)
  // West front porch railing + manicured lawn bed left of walkway (cols 10..12.85, rows 30.85..38.8)
  {
    x: (WEST_DIVIDER_COL + 1) * TILE,
    y: 30.85 * TILE,
    w: (FRONT_DOOR_COL_START - WEST_DIVIDER_COL - 1.15) * TILE,
    h: (SIDEWALK_ROW_START - 30.85) * TILE,
  },
  // Upper middle pocket lawn + right porch railing (cols 16.15..20.85, rows 30.85..32.85)
  // Leaves horizontal garden connector path WIDE OPEN at rows 32.85..34.45 between Long Walkway & 2-Car Driveway!
  {
    x: (FRONT_DOOR_COL_END + 1.15) * TILE,
    y: 30.85 * TILE,
    w: (DRIVEWAY_COL_START - FRONT_DOOR_COL_END - 1.3) * TILE,
    h: 2.0 * TILE,
  },
  // Lower middle pocket lawn + picket fence between Long Walkway & 2-Car Driveway (cols 16.15..20.85, rows 34.45..38.8)
  {
    x: (FRONT_DOOR_COL_END + 1.15) * TILE,
    y: 34.45 * TILE,
    w: (DRIVEWAY_COL_START - FRONT_DOOR_COL_END - 1.3) * TILE,
    h: (SIDEWALK_ROW_START - 34.45) * TILE,
  },

  // =========================================================================
  // 3. UPPER-WEST ROOM: MASTER BEDROOM FURNITURE (cols 1..8, rows 2..11 — non-interactable)
  // =========================================================================
  { x: 1.85 * TILE, y: 2.0 * TILE, w: 1.0 * TILE, h: 1.0 * TILE }, // Left oak nightstand & bedside lamp
  { x: 3.0 * TILE, y: 2.0 * TILE, w: 3.6 * TILE, h: 3.1 * TILE }, // Grand King Bed
  { x: 6.75 * TILE, y: 2.0 * TILE, w: 1.0 * TILE, h: 1.0 * TILE }, // Right oak nightstand & bedside lamp
  { x: 3.35 * TILE, y: 5.35 * TILE, w: 2.75 * TILE, h: 0.78 * TILE }, // End-of-bed upholstered bench
  { x: 1.1 * TILE, y: 6.2 * TILE, w: 1.3 * TILE, h: 2.95 * TILE }, // Large Oak Double-Door Wardrobe
  { x: 1.15 * TILE, y: 10.15 * TILE, w: 0.9 * TILE, h: 1.0 * TILE }, // Potted Fiddle-Leaf Fig
  { x: 2.55 * TILE, y: 10.55 * TILE, w: 2.6 * TILE, h: 1.1 * TILE }, // Dressing Vanity & Stool
  { x: 6.45 * TILE, y: 9.45 * TILE, w: 2.2 * TILE, h: 2.15 * TILE }, // Cozy Reading Armchair, Side Table & Floor Lamp

  // =========================================================================
  // 4. UPPER-CENTER ROOM: LIVING LOUNGE FURNITURE (shifted +CORE_OFFSET_X)
  // =========================================================================
  { x: 1.15 * TILE + CORE_OFFSET_X, y: 2.0 * TILE, w: 1.45 * TILE, h: 1.65 * TILE }, // Festive Christmas tree & gifts
  { x: 6.12 * TILE + CORE_OFFSET_X, y: 1.95 * TILE, w: 0.72 * TILE, h: 0.65 * TILE }, // Classic grandfather pendulum clock
  { x: 7.0 * TILE + CORE_OFFSET_X, y: 1.9 * TILE, w: 1.8 * TILE, h: 0.8 * TILE }, // Fireplace hearth
  { x: 8.9 * TILE + CORE_OFFSET_X, y: 2.0 * TILE, w: 1.0 * TILE, h: 1.5 * TILE }, // Living bookshelf
  { x: 2.1 * TILE + CORE_OFFSET_X, y: 4.5 * TILE, w: 3.1 * TILE, h: 1.25 * TILE }, // Cozy sofa
  { x: 2.5 * TILE + CORE_OFFSET_X, y: 6.7 * TILE, w: 2.3 * TILE, h: 1.1 * TILE }, // Coffee table
  { x: 1.2 * TILE + CORE_OFFSET_X, y: 10.2 * TILE, w: 0.9 * TILE, h: 1.0 * TILE }, // Bottom-left potted plant
  { x: 2.5 * TILE + CORE_OFFSET_X, y: 10.55 * TILE, w: 2.4 * TILE, h: 1.15 * TILE }, // Living room TV console

  // =========================================================================
  // 5. UPPER-EAST ROOM: EXPANDED HOME OFFICE FURNITURE (shifted +CORE_OFFSET_X)
  // =========================================================================
  { x: 11.18 * TILE + CORE_OFFSET_X, y: 2.08 * TILE, w: 0.85 * TILE, h: 0.95 * TILE }, // North-west office potted fern
  { x: 11.15 * TILE + CORE_OFFSET_X, y: 3.45 * TILE, w: 0.95 * TILE, h: 1.85 * TILE }, // West-wall walnut credenza
  { x: 15.65 * TILE + CORE_OFFSET_X, y: 2.95 * TILE, w: 4.1 * TILE, h: 1.55 * TILE }, // Player executive computer work desk
  { ...CENTER_TABLE_RECT }, // Large central document & book work table (Google Drive island)
  { x: 20.55 * TILE + CORE_OFFSET_X, y: 2.08 * TILE, w: 1.0 * TILE, h: 2.15 * TILE }, // Reference library bookcase (left)
  { x: 21.75 * TILE + CORE_OFFSET_X, y: 2.08 * TILE, w: 1.05 * TILE, h: 2.15 * TILE }, // Reference library bookcase (right)
  { x: 20.92 * TILE + CORE_OFFSET_X, y: 4.95 * TILE, w: 0.55 * TILE, h: 0.55 * TILE }, // Office wastebasket
  { x: 21.55 * TILE + CORE_OFFSET_X, y: 4.8 * TILE, w: 1.3 * TILE, h: 1.1 * TILE }, // Multifunction printer & scanner
  { x: 21.25 * TILE + CORE_OFFSET_X, y: 6.15 * TILE, w: 1.6 * TILE, h: 3.25 * TILE }, // Mina's AI workstation desk
  { x: 21.45 * TILE + CORE_OFFSET_X, y: 9.55 * TILE, w: 1.4 * TILE, h: 1.4 * TILE }, // Rolling filing cabinet
  { x: 14.55 * TILE + CORE_OFFSET_X, y: 10.85 * TILE, w: 0.8 * TILE, h: 0.9 * TILE }, // Potted monstera plant (shifted clear of Gym doorway)
  { x: 11.15 * TILE + CORE_OFFSET_X, y: 9.75 * TILE, w: 1.48 * TILE, h: 1.8 * TILE }, // Antigravity localhost terminal desk
  { ...AISTUDIO_DESK_RECT }, // Google AI Studio Prompt Lab & App Builder desk

  // =========================================================================
  // 6. MIDDLE-WEST ROOM: FAMILY BATHROOM & GLASS SHOWER (cols 1..8, rows 14..21 — left of Kitchen, below Master Bedroom)
  // =========================================================================
  { x: 5.3 * TILE, y: 13.85 * TILE, w: 3.35 * TILE, h: 1.25 * TILE }, // Wide family vanity sink & mirror cabinet (north-east)
  { x: 4.35 * TILE, y: 13.9 * TILE, w: 0.22 * TILE, h: 2.25 * TILE }, // Glass shower east upper partition (open entry rows 16.15..17.98)
  { x: 1.02 * TILE, y: 17.98 * TILE, w: 3.55 * TILE, h: 0.25 * TILE }, // Glass shower south partition & marble curb
  { x: 1.05 * TILE, y: 14.0 * TILE, w: 0.7 * TILE, h: 0.7 * TILE }, // Corner shower shampoo caddy (NW corner)
  { x: 8.2 * TILE, y: 18.35 * TILE, w: 0.72 * TILE, h: 1.2 * TILE }, // East wall towel rack & shelf (below doorway)
  { x: 7.55 * TILE, y: 19.95 * TILE, w: 1.35 * TILE, h: 1.85 * TILE }, // Tall wooden linen & towel cabinet (SE corner)
  { x: 5.35 * TILE, y: 20.35 * TILE, w: 1.35 * TILE, h: 1.45 * TILE }, // Ceramic flush toilet & bidet (south wall)
  { x: 4.55 * TILE, y: 21.0 * TILE, w: 0.65 * TILE, h: 0.72 * TILE }, // Covered bamboo-lid pedal bin
  { x: 2.9 * TILE, y: 20.25 * TILE, w: 1.05 * TILE, h: 1.4 * TILE }, // Woven rattan laundry hamper
  { x: 1.1 * TILE, y: 19.95 * TILE, w: 1.6 * TILE, h: 1.85 * TILE }, // Front-load washing machine (SW corner)

  // =========================================================================
  // 7. MIDDLE-CENTER ROOM: FAMILY KITCHEN & DINING (cols 10..18, rows 14..21)
  // =========================================================================
  { x: 1.12 * TILE + CORE_OFFSET_X, y: 13.75 * TILE, w: 1.38 * TILE, h: 1.45 * TILE }, // Double-door refrigerator
  { x: 2.55 * TILE + CORE_OFFSET_X, y: 13.9 * TILE, w: 2.35 * TILE, h: 1.25 * TILE }, // 4-burner gas stove, oven & north counter
  { x: 7.1 * TILE + CORE_OFFSET_X, y: 13.9 * TILE, w: 2.85 * TILE, h: 1.25 * TILE }, // Kitchen sink, dish rack & microwave counter
  { x: 8.75 * TILE + CORE_OFFSET_X, y: 15.2 * TILE, w: 1.15 * TILE, h: 3.35 * TILE }, // East prep counter (rice cooker, cutting board, toaster, fruit bowl)
  {
    x: KITCHEN_DINING_RECT.x,
    y: KITCHEN_DINING_RECT.y - 0.25 * TILE,
    w: KITCHEN_DINING_RECT.w,
    h: KITCHEN_DINING_RECT.h + 0.5 * TILE,
  }, // Family dining table & tucked chairs
  { x: 1.15 * TILE + CORE_OFFSET_X, y: 19.85 * TILE, w: 1.55 * TILE, h: 1.95 * TILE }, // Kitchen pantry cupboard (SW corner)
  { x: 9.05 * TILE + CORE_OFFSET_X, y: 20.65 * TILE, w: 0.72 * TILE, h: 0.95 * TILE }, // Kitchen step trash bin (SE corner)

  // =========================================================================
  // 8. SOUTH-CENTER ROOM: ENTRYWAY / FOYER & FRONT PORCH (cols 10..18, rows 24..31 — non-interactable)
  // =========================================================================
  { x: 5.55 * TILE + CORE_OFFSET_X, y: 23.95 * TILE, w: 2.25 * TILE, h: 0.95 * TILE }, // Foyer walnut console table (NE under oval mirror)
  { x: 1.1 * TILE + CORE_OFFSET_X, y: 25.35 * TILE, w: 1.15 * TILE, h: 2.3 * TILE }, // Cushioned wooden shoe bench & shoe rack (west)
  { x: 7.45 * TILE + CORE_OFFSET_X, y: 26.85 * TILE, w: 1.85 * TILE, h: 0.9 * TILE }, // Entryway coat stand & ceramic umbrella stand (SE)
  { x: 1.25 * TILE + CORE_OFFSET_X, y: 29.18 * TILE, w: 1.55 * TILE, h: 1.25 * TILE }, // Front porch wicker chair & side table
  {
    x: PORCH_PLANTER_RECT.x,
    y: PORCH_PLANTER_RECT.y,
    w: PORCH_PLANTER_RECT.w,
    h: PORCH_PLANTER_RECT.h,
  }, // Front porch 5 blooming terracotta potted plants (daily watering quest)

  // =========================================================================
  // 9. ATTACHED 2-CAR FAMILY GARAGE PROPS (cols 20..31, rows 22..29)
  //    (Bay 1 left green car uses live dynamic collision; Bay 2 right red car is currently out on a drive!)
  // =========================================================================
  { x: 22.3 * TILE, y: 22.0 * TILE, w: 3.1 * TILE, h: 0.85 * TILE }, // Garage wooden workbench & vise
  { x: 25.8 * TILE, y: 22.0 * TILE, w: 1.4 * TILE, h: 0.85 * TILE }, // Rolling red mechanic tool chest
  { x: 27.6 * TILE, y: 22.0 * TILE, w: 2.6 * TILE, h: 0.85 * TILE }, // Heavy-duty metal storage shelves
  { x: 30.7 * TILE, y: 22.1 * TILE, w: 1.15 * TILE, h: 2.2 * TILE }, // NE bicycle & spare tire rack

  // =========================================================================
  // 10. HOME GYM / FITNESS STUDIO EQUIPMENT (cols 20..31, rows 14..19 — entered via Home Office)
  // =========================================================================
  { ...GYM_SQUAT_RACK_RECT }, // Power Squat Rack & Olympic Barbell (NW)
  { x: 23.25 * TILE, y: 14.55 * TILE, w: 1.55 * TILE, h: 0.9 * TILE }, // Adjustable Weight Bench (North-center)
  { x: 25.5 * TILE, y: 14.0 * TILE, w: 1.9 * TILE, h: 0.85 * TILE }, // Two-Tier Dumbbell & Kettlebell Rack
  { x: 30.35 * TILE, y: 14.05 * TILE, w: 1.4 * TILE, h: 1.7 * TILE }, // Hydration Water Cooler & Towel Station (NE)
  { x: 20.25 * TILE, y: 17.75 * TILE, w: 2.4 * TILE, h: 1.6 * TILE }, // Motorized Running Treadmill (SW)
  { x: 23.5 * TILE, y: 17.8 * TILE, w: 1.35 * TILE, h: 1.5 * TILE }, // Upright Exercise Spin Bike (South-center)
  { x: 25.55 * TILE, y: 18.25 * TILE, w: 2.1 * TILE, h: 1.1 * TILE }, // Ash-Wood Water Rowing Machine
  { x: 30.85 * TILE, y: 18.45 * TILE, w: 0.95 * TILE, h: 1.2 * TILE }, // Stability Swiss Ball & Potted Snake Plant (SE)

  // =========================================================================
  // 11. ROADSIDE FAMILY MAILBOX POST (sidewalk curb beside front walkway & street)
  // =========================================================================
  {
    x: MAILBOX_RECT.x + 6,
    y: MAILBOX_RECT.y + 13,
    w: MAILBOX_RECT.w - 12,
    h: MAILBOX_RECT.h - 14,
  },
];
