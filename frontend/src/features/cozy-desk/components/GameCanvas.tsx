import { useEffect, useRef, useState } from 'react';
import type {
  AssistantDeliveryWalkCommand,
  AssistantMood,
  CameraCommand,
  CameraFocusMode,
  CameraPresetId,
  CameraUiState,
  CharacterStatusMap,
  DrivingHudState,
  GameState,
  GreenCarState,
  InspectableObject,
  InspectHoverRenderState,
  InteractableId,
  InteractableObject,
  MinaActionMenuAnchor,
  MinaNpcState,
  MinaPinMission,
  MinaSummonCommand,
  MinaSummonMode,
  PlayerSeatId,
  PlayerState,
  RoomZone,
  RovingAssistantNpcState,
  SofaActivity,
  TaskAssistantId,
  TimeOfDay,
} from '../types/game';
import {
  AGY_APPROACH_RADIUS,
  AGY_LEAVE_RADIUS,
  AGY_POS,
  AGY_STAND_POS,
  AISTUDIO_APPROACH_RADIUS,
  AISTUDIO_LEAVE_RADIUS,
  AISTUDIO_POS,
  AISTUDIO_STAND_POS,
  BEDROOM_BED_SEAT_POS,
  BEDROOM_BED_STAND_POS,
  CAMERA_BASE_SCALE,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  carCollidesWithWorld,
  collidesWithWorld,
  createInitialGreenCar,
  DINING_CHAIR_SPOTS,
  DIVIDER_COL,
  findNearestInteractable,
  findSafeCarExitPos,
  getGreenCarInteractable,
  getInteractableAtPoint,
  getRoomZone,
  INTERACTABLES,
  isDiningChairSeatId,
  isPointInsideCar,
  isPointInShowerWetZone,
  MAILBOX_RECT,
  MAP_COLS,
  MAP_ROWS,
  MINA_APPROACH_RADIUS,
  MINA_GREET_STOP_DIST,
  MINA_LEAVE_RADIUS,
  MINA_MAX_ROAM_RADIUS,
  MINA_PINBOARD_SPOT,
  MINA_POS,
  PLAYER_START,
  PORCH_PLANTER_RECT,
  PORCH_PLANTER_STAND_POS,
  ROAD_ROW_START,
  ROOM_CAMERA_TARGETS,
  SHOWER_STAND_POS,
  SLEEP_STATION_RECT,
  SOFA_SEAT_POS,
  SOFA_STAND_POS,
  TILE,
  VIEW_H,
  VIEW_W,
  WORK_SEAT_POS,
  WORK_STAND_POS,
  WORLD_H,
  WORLD_W,
} from '../game/houseMap';
import { getInspectableAtPoint } from '../game/inspectableObjects';
import { findMeetingPathForMina, findWalkablePath } from '../game/pathfinding';
import { renderHouseScene } from '../game/pixelRenderer';
import { soundEngine } from '../utils/sound';

interface GameCanvasProps {
  gameState: GameState;
  playerSeat: PlayerSeatId | null;
  timeOfDay: TimeOfDay;
  assistantMood: AssistantMood;
  minaBubbleText: string | null;
  minaMission: MinaPinMission | null;
  minaSummonCommand: MinaSummonCommand | null;
  deliveryWalkCommand?: AssistantDeliveryWalkCommand | null;
  cameraCommand: CameraCommand | null;
  isMinaMenuOpen: boolean;
  extraPinCount: number;
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
  plantWateringTriggerId?: number;
  characterStatuses?: CharacterStatusMap;
  isModalOpen: boolean;
  isFullscreenMap?: boolean;
  onZoneChange: (zone: RoomZone) => void;
  onNearestChange: (item: InteractableObject | null) => void;
  onInteract: (id: InteractableId) => void;
  onStandUp: () => void;
  onRequestMinaMenu: (anchor: MinaActionMenuAnchor) => void;
  onDismissMinaMenu: () => void;
  onMinaSummonArrived: (mode: MinaSummonMode) => void;
  onAssistantDeliveryArrived?: (commandId: number, assistantId: TaskAssistantId) => void;
  onMinaMissionEvent?: (event: 'started' | 'pinned' | 'returned', taskTitle: string) => void;
  onMinaProximityEvent?: (event: 'approached' | 'returning') => void;
  onAntigravityProximityEvent?: (event: 'approached' | 'returning') => void;
  onAiStudioProximityEvent?: (event: 'approached' | 'returning') => void;
  onCameraChange?: (cameraState: CameraUiState) => void;
  onCarWrapHome?: (direction: 'left' | 'right') => void;
  onDrivingHudChange?: (hud: DrivingHudState | null) => void;
}

interface CameraInternalState {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
  focusMode: CameraFocusMode;
  activePreset: CameraPresetId | null;
}

interface ViewportMetrics {
  viewW: number;
  viewH: number;
  baseScale: number;
  minZoom: number;
}

function getViewportMetrics(
  _isFullscreenMap: boolean,
  dynamicSize?: { viewW: number; viewH: number }
): ViewportMetrics {
  const viewW = dynamicSize?.viewW ?? VIEW_W;
  const viewH = dynamicSize?.viewH ?? VIEW_H;
  const minZoom = Math.min(
    viewW / (WORLD_W * CAMERA_BASE_SCALE),
    viewH / (WORLD_H * CAMERA_BASE_SCALE)
  );
  return {
    viewW,
    viewH,
    baseScale: CAMERA_BASE_SCALE,
    minZoom,
  };
}

function clampZoom(z: number, vp: ViewportMetrics): number {
  return Math.max(vp.minZoom, Math.min(CAMERA_MAX_ZOOM, z));
}

function clampCameraCenter(
  x: number,
  y: number,
  zoom: number,
  vp: ViewportMetrics
): { x: number; y: number } {
  const scale = zoom * vp.baseScale;
  const halfW = vp.viewW / (2 * scale);
  const halfH = vp.viewH / (2 * scale);

  // Smooth zoom-scaled edge overscan (0 at full-house overview, generous when zoomed in)
  // so follow-player mode stays centered on the character even near Kitchen & Bathroom walls/corners.
  const overscanT = Math.max(0, Math.min(1, (zoom - vp.minZoom) / 0.4));
  const padX = overscanT * Math.min(halfW * 0.72, 220);
  const padY = overscanT * Math.min(halfH * 0.72, 180);

  const minX = halfW - padX;
  const maxX = WORLD_W - halfW + padX;
  const minY = halfH - padY;
  const maxY = WORLD_H - halfH + padY;

  const clampedX = minX >= maxX ? WORLD_W / 2 : Math.max(minX, Math.min(maxX, x));
  const clampedY = minY >= maxY ? WORLD_H / 2 : Math.max(minY, Math.min(maxY, y));

  return { x: clampedX, y: clampedY };
}

function viewportToWorld(
  vx: number,
  vy: number,
  camX: number,
  camY: number,
  zoom: number,
  vp: ViewportMetrics
): { wx: number; wy: number } {
  const scale = zoom * vp.baseScale;
  return {
    wx: camX + (vx - vp.viewW / 2) / scale,
    wy: camY + (vy - vp.viewH / 2) / scale,
  };
}

function worldToViewportNorm(
  wx: number,
  wy: number,
  cam: CameraInternalState,
  vp: ViewportMetrics
): { normX: number; normY: number } {
  const scale = cam.zoom * vp.baseScale;
  const vx = vp.viewW / 2 + (wx - cam.x) * scale;
  const vy = vp.viewH / 2 + (wy - cam.y) * scale;
  return {
    normX: Math.max(0.08, Math.min(0.92, vx / vp.viewW)),
    normY: Math.max(0.14, Math.min(0.86, vy / vp.viewH)),
  };
}

const MOVE_SPEED = 128; // pixels per second in virtual 640x416 coordinates
const MINA_MOVE_SPEED = 98; // responsive cozy walking speed for Mina
const MINA_SUMMON_SPEED = 118; // brisk obstacle-avoiding walk when summoned to the player
const MINA_PIN_DURATION = 2.1; // seconds spent pinning at drawPinboard
const MINA_MIN_OFFICE_X = (DIVIDER_COL + 1.35) * TILE;
const INSPECT_HINT_DELAY = 0.35; // seconds before subtle dwell progress cue appears
const INSPECT_REVEAL_DELAY = 2.0; // seconds of hover dwell to reveal object tooltip

const MINA_DESK_INTERACTABLE = INTERACTABLES.find((i) => i.id === 'mina_desk') ?? null;
const AGY_DESK_INTERACTABLE = INTERACTABLES.find((i) => i.id === 'antigravity_desk') ?? null;
const AISTUDIO_DESK_INTERACTABLE = INTERACTABLES.find((i) => i.id === 'ai_studio_desk') ?? null;

const ALL_SOFA_ACTIVITIES: SofaActivity[] = ['tea', 'newspaper', 'tv_remote'];

function createShuffledSofaBag(avoidFirst: SofaActivity | null): SofaActivity[] {
  const bag: SofaActivity[] = [...ALL_SOFA_ACTIVITIES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  // Guarantee the next activity never repeats the immediately preceding activity
  if (avoidFirst && bag[0] === avoidFirst && bag.length > 1) {
    const swapIdx = 1 + Math.floor(Math.random() * (bag.length - 1));
    [bag[0], bag[swapIdx]] = [bag[swapIdx], bag[0]];
  }
  return bag;
}

function randomSofaActivityDuration(activity: SofaActivity): number {
  if (activity === 'tv_remote') {
    return 7.5 + Math.random() * 2.5; // 7.5..10s watching TV after clicking remote
  }
  return 6.0 + Math.random() * 2.5; // 6..8.5s drinking tea or reading newspaper
}

function faceToward(fromX: number, fromY: number, toX: number, toY: number): MinaNpcState['facing'] {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'down' : 'up';
}

function buildMinaReturnToDeskPath(fromX: number, fromY: number): Array<{ x: number; y: number }> {
  const path = findWalkablePath(fromX, fromY, MINA_POS.x, MINA_POS.y);
  return path.length > 0 ? path : [{ ...MINA_POS }];
}

function buildMinaToPinboardPath(fromX: number, fromY: number): Array<{ x: number; y: number }> {
  const path = findWalkablePath(fromX, fromY, MINA_PINBOARD_SPOT.x, MINA_PINBOARD_SPOT.y);
  return path.length > 0 ? path : [{ ...MINA_PINBOARD_SPOT }];
}

function isPlayerInsideMinaRadius(player: PlayerState, mina: MinaNpcState): boolean {
  if (getRoomZone(player.x, player.y) !== 'office') return false;
  const distToDesk = Math.hypot(player.x - MINA_POS.x, player.y - MINA_POS.y);
  if (distToDesk <= MINA_APPROACH_RADIUS) return true;
  if (
    (mina.phase === 'approaching_player' || mina.phase === 'greeting_player') &&
    distToDesk <= MINA_LEAVE_RADIUS
  ) {
    return true;
  }
  return false;
}

function isPlayerInsideAgyRadius(player: PlayerState, isAlreadyEngaged: boolean): boolean {
  if (getRoomZone(player.x, player.y) !== 'office') return false;
  const distToAgy = Math.hypot(player.x - AGY_POS.x, player.y - AGY_POS.y);
  if (distToAgy <= AGY_APPROACH_RADIUS) return true;
  if (isAlreadyEngaged && distToAgy <= AGY_LEAVE_RADIUS) return true;
  return false;
}

function isPlayerInsideAiStudioRadius(player: PlayerState, isAlreadyEngaged: boolean): boolean {
  if (getRoomZone(player.x, player.y) !== 'office') return false;
  const distToStudio = Math.hypot(player.x - AISTUDIO_POS.x, player.y - AISTUDIO_POS.y);
  if (distToStudio <= AISTUDIO_APPROACH_RADIUS) return true;
  if (isAlreadyEngaged && distToStudio <= AISTUDIO_LEAVE_RADIUS) return true;
  return false;
}

function getEffectiveNearestInteractable(
  player: PlayerState,
  mina: MinaNpcState,
  greenCar: GreenCarState,
  isAgyEngaged = false,
  isAiStudioEngaged = false
): InteractableObject | null {
  const staticNearest = findNearestInteractable(player.x, player.y);
  // Strictly gate access to AI characters to their proximity radii
  const filteredStatic =
    staticNearest?.id === 'mina_desk' ||
    staticNearest?.id === 'antigravity_desk' ||
    staticNearest?.id === 'ai_studio_desk'
      ? null
      : staticNearest;

  const canTalkToMina =
    Boolean(MINA_DESK_INTERACTABLE) &&
    isPlayerInsideMinaRadius(player, mina) &&
    mina.phase !== 'walking_to_board' &&
    mina.phase !== 'pinning';

  if (canTalkToMina && MINA_DESK_INTERACTABLE) {
    return {
      ...MINA_DESK_INTERACTABLE,
      label: 'มีน่า (ผู้ช่วย AI)',
      actionLabel: 'คุยงานกับมีน่า',
    };
  }

  if (AGY_DESK_INTERACTABLE && isPlayerInsideAgyRadius(player, isAgyEngaged)) {
    return AGY_DESK_INTERACTABLE;
  }

  if (AISTUDIO_DESK_INTERACTABLE && isPlayerInsideAiStudioRadius(player, isAiStudioEngaged)) {
    return AISTUDIO_DESK_INTERACTABLE;
  }

  // Dynamic drivable green car proximity check
  const carObj = getGreenCarInteractable(greenCar);
  const distToCar = Math.hypot(player.x - greenCar.x, player.y - greenCar.y);
  if (distToCar <= carObj.interactRadius) {
    if (!filteredStatic) {
      return carObj;
    }
    const staticDist = Math.hypot(
      player.x - (filteredStatic.x + filteredStatic.w / 2),
      player.y - (filteredStatic.y + filteredStatic.h / 2)
    );
    if (distToCar <= staticDist) {
      return carObj;
    }
  }

  return filteredStatic;
}

export function GameCanvas({
  gameState,
  playerSeat,
  timeOfDay,
  assistantMood,
  minaBubbleText,
  minaMission,
  minaSummonCommand,
  deliveryWalkCommand = null,
  cameraCommand,
  isMinaMenuOpen,
  extraPinCount,
  isTvOn,
  isDriveOpen,
  isAntigravityOpen = false,
  isAiStudioOpen = false,
  isMailboxOpen = false,
  mailboxUnreadCount = 0,
  mailboxFreshArrival = false,
  isSleepLogOpen = false,
  hasLoggedTodaySleep = false,
  todaySleepLabel = null,
  hasWateredPlantsToday = false,
  todayPlantWaterLabel = null,
  plantWateringTriggerId = 0,
  characterStatuses,
  isModalOpen,
  isFullscreenMap = false,
  onZoneChange,
  onNearestChange,
  onInteract,
  onStandUp,
  onRequestMinaMenu,
  onDismissMinaMenu,
  onMinaSummonArrived,
  onAssistantDeliveryArrived,
  onMinaMissionEvent,
  onMinaProximityEvent,
  onAntigravityProximityEvent,
  onAiStudioProximityEvent,
  onCameraChange,
  onCarWrapHome,
  onDrivingHudChange,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dynamicViewRef = useRef<{ viewW: number; viewH: number }>({ viewW: VIEW_W, viewH: VIEW_H });
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({
    w: VIEW_W,
    h: VIEW_H,
  });
  const [isPanningUi, setIsPanningUi] = useState(false);
  const [revealedInspect, setRevealedInspect] = useState<{
    object: InspectableObject;
    normX: number;
    normY: number;
    preferBelow: boolean;
  } | null>(null);

  // Mutable refs for 60fps loop without triggering React re-renders per frame
  const playerRef = useRef<PlayerState>({
    x: PLAYER_START.x,
    y: PLAYER_START.y,
    facing: 'down',
    isMoving: false,
    walkFrame: 0,
    isSitting: false,
    seat: null,
    sofaActivity: null,
    sofaActivityElapsed: 0,
    isShowering: false,
    showerPhase: null,
    showerPhaseElapsed: 0,
    showerPrivacyProgress: 0,
  });

  const sofaBagRef = useRef<SofaActivity[]>([]);
  const lastSofaActivityRef = useRef<SofaActivity | null>(null);
  const sofaActivityDurationRef = useRef(0);
  const sofaRemoteClickedRef = useRef(false);

  const pickNextSofaActivity = () => {
    if (sofaBagRef.current.length === 0) {
      sofaBagRef.current = createShuffledSofaBag(lastSofaActivityRef.current);
    }
    const next = sofaBagRef.current.shift()!;
    lastSofaActivityRef.current = next;
    sofaActivityDurationRef.current = randomSofaActivityDuration(next);
    sofaRemoteClickedRef.current = false;
    playerRef.current.sofaActivity = next;
    playerRef.current.sofaActivityElapsed = 0;
  };

  const minaRef = useRef<MinaNpcState>({
    x: MINA_POS.x,
    y: MINA_POS.y,
    facing: 'right',
    isMoving: false,
    walkFrame: 0,
    phase: 'working_at_desk',
    pinProgress: 0,
  });

  const minaWaypointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const minaReturningFromMissionRef = useRef(false);
  const minaSummonModeRef = useRef<MinaSummonMode | null>(null);
  const minaSummonTargetRef = useRef<{ x: number; y: number } | null>(null);
  const minaSummonRepathTimerRef = useRef(0);
  const lastSummonIdRef = useRef<number | null>(null);
  const minaPinTimerRef = useRef(0);
  const minaPinnedNotifiedRef = useRef(false);
  const activeMissionTitleRef = useRef('');
  const lastMissionIdRef = useRef<number | null>(null);
  const pinboardGlowTickRef = useRef(0);

  // Delivery walk state for all 3 AI assistants (Mina, Antigravity, AI Studio)
  const activeDeliveryRef = useRef<AssistantDeliveryWalkCommand | null>(null);
  const lastDeliveryCmdIdRef = useRef<number | null>(null);
  const agyNpcRef = useRef<RovingAssistantNpcState>({
    x: AGY_POS.x,
    y: AGY_POS.y,
    facing: 'left',
    isMoving: false,
    walkFrame: 0,
    phase: 'at_desk',
  });
  const agyWaypointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const agyTargetRef = useRef<{ x: number; y: number } | null>(null);
  const agyRepathTimerRef = useRef(0);

  const aiStudioNpcRef = useRef<RovingAssistantNpcState>({
    x: AISTUDIO_POS.x,
    y: AISTUDIO_POS.y,
    facing: 'down',
    isMoving: false,
    walkFrame: 0,
    phase: 'at_desk',
  });
  const aiStudioWaypointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const aiStudioTargetRef = useRef<{ x: number; y: number } | null>(null);
  const aiStudioRepathTimerRef = useRef(0);

  const keysRef = useRef<Set<string>>(new Set());
  const waypointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const pendingInteractRef = useRef<InteractableId | null>(null);
  const clickMarkerRef = useRef<{ x: number; y: number; ttl: number } | null>(null);
  const currentZoneRef = useRef<RoomZone>('living');
  const nearestKeyRef = useRef<string | null>(null);
  const agyEngagedRef = useRef(false);
  const aiStudioEngagedRef = useRef(false);
  const greenCarRef = useRef<GreenCarState>(createInitialGreenCar());
  const wrapToastCooldownRef = useRef(0);
  const lastDrivingHudKeyRef = useRef('');
  const plantWateringAnimRef = useRef<{ active: boolean; elapsed: number; duration: number }>({
    active: false,
    elapsed: 0,
    duration: 2.2,
  });
  const lastPlantWaterTriggerRef = useRef(plantWateringTriggerId);

  // Smooth 2D camera state (follows player dead-center by default; user can pan, zoom, or pick room focus)
  const cameraRef = useRef<CameraInternalState>({
    x: PLAYER_START.x,
    y: PLAYER_START.y,
    zoom: CAMERA_DEFAULT_ZOOM,
    targetX: PLAYER_START.x,
    targetY: PLAYER_START.y,
    targetZoom: CAMERA_DEFAULT_ZOOM,
    focusMode: 'follow',
    activePreset: 'follow',
  });
  const lastCameraCommandIdRef = useRef<number | null>(null);
  const lastCameraUiKeyRef = useRef<string>('');
  const dragStateRef = useRef<{
    pointerId: number | null;
    button: number;
    startClientX: number;
    startClientY: number;
    startCamX: number;
    startCamY: number;
    isDragging: boolean;
  }>({
    pointerId: null,
    button: 0,
    startClientX: 0,
    startClientY: 0,
    startCamX: 0,
    startCamY: 0,
    isDragging: false,
  });
  const suppressNextClickRef = useRef(false);

  // 2-second hover inspection state (tracked in refs at 60fps; React updates only when revealed tooltip changes)
  const hoverPointerRef = useRef<{ inside: boolean; vx: number; vy: number }>({
    inside: false,
    vx: 0,
    vy: 0,
  });
  const inspectDwellRef = useRef<{
    objectId: string | null;
    elapsed: number;
    revealed: boolean;
  }>({
    objectId: null,
    elapsed: 0,
    revealed: false,
  });
  const lastRevealedInspectKeyRef = useRef<string>('');

  // Latest prop values synced into refs for RAF access
  const propsRef = useRef({
    gameState,
    playerSeat,
    timeOfDay,
    assistantMood,
    minaBubbleText,
    isMinaMenuOpen,
    extraPinCount,
    isTvOn,
    isDriveOpen,
    isAntigravityOpen,
    isAiStudioOpen,
    isMailboxOpen,
    mailboxUnreadCount,
    mailboxFreshArrival,
    isSleepLogOpen,
    hasLoggedTodaySleep,
    todaySleepLabel,
    hasWateredPlantsToday,
    todayPlantWaterLabel,
    characterStatuses,
    isModalOpen,
    isFullscreenMap,
    onZoneChange,
    onNearestChange,
    onInteract,
    onStandUp,
    onRequestMinaMenu,
    onDismissMinaMenu,
    onMinaSummonArrived,
    onAssistantDeliveryArrived,
    onMinaMissionEvent,
    onMinaProximityEvent,
    onAntigravityProximityEvent,
    onAiStudioProximityEvent,
    onCameraChange,
    onCarWrapHome,
    onDrivingHudChange,
  });
  propsRef.current = {
    gameState,
    playerSeat,
    timeOfDay,
    assistantMood,
    minaBubbleText,
    isMinaMenuOpen,
    extraPinCount,
    isTvOn,
    isDriveOpen,
    isAntigravityOpen,
    isAiStudioOpen,
    isMailboxOpen,
    mailboxUnreadCount,
    mailboxFreshArrival,
    isSleepLogOpen,
    hasLoggedTodaySleep,
    todaySleepLabel,
    hasWateredPlantsToday,
    todayPlantWaterLabel,
    characterStatuses,
    isModalOpen,
    isFullscreenMap,
    onZoneChange,
    onNearestChange,
    onInteract,
    onStandUp,
    onRequestMinaMenu,
    onDismissMinaMenu,
    onMinaSummonArrived,
    onAssistantDeliveryArrived,
    onMinaMissionEvent,
    onMinaProximityEvent,
    onAntigravityProximityEvent,
    onAiStudioProximityEvent,
    onCameraChange,
    onCarWrapHome,
    onDrivingHudChange,
  };

  // Match canvas internal aspect ratio to the widescreen desktop container (both normal & fullscreen)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nextH = VIEW_H;
      const nextW = Math.max(480, Math.min(1920, Math.round(nextH * (rect.width / rect.height))));
      dynamicViewRef.current = { viewW: nextW, viewH: nextH };
      setCanvasSize((prev) => (prev.w === nextW && prev.h === nextH ? prev : { w: nextW, h: nextH }));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFullscreenMap]);

  // Handle external camera zoom & focus preset commands from the UI bar
  useEffect(() => {
    if (!cameraCommand || cameraCommand.id === lastCameraCommandIdRef.current) {
      return;
    }
    lastCameraCommandIdRef.current = cameraCommand.id;
    const cam = cameraRef.current;
    const vp = getViewportMetrics(propsRef.current.isFullscreenMap, dynamicViewRef.current);

    if (propsRef.current.isMinaMenuOpen) {
      propsRef.current.onDismissMinaMenu();
    }

    if (cameraCommand.type === 'preset') {
      const preset = cameraCommand.preset;
      if (preset === 'follow') {
        cam.focusMode = 'follow';
        cam.activePreset = 'follow';
        if (cam.targetZoom < 0.85) {
          cam.targetZoom = CAMERA_DEFAULT_ZOOM;
        }
        cam.targetZoom = clampZoom(cam.targetZoom, vp);
        const player = playerRef.current;
        cam.targetX = player.x;
        cam.targetY = player.y;
      } else {
        const target = ROOM_CAMERA_TARGETS[preset];
        cam.focusMode = 'free';
        cam.activePreset = preset;
        cam.targetZoom = clampZoom(target.zoom, vp);
        const clamped = clampCameraCenter(target.x, target.y, cam.targetZoom, vp);
        cam.targetX = clamped.x;
        cam.targetY = clamped.y;
      }
    } else if (cameraCommand.type === 'zoom_step') {
      const nextZoom = clampZoom(cam.targetZoom + cameraCommand.delta, vp);
      cam.targetZoom = nextZoom;
      if (cam.activePreset === 'overview' && nextZoom > vp.minZoom + 0.04) {
        cam.activePreset = null;
      }
      if (cam.focusMode !== 'follow') {
        const clamped = clampCameraCenter(cam.targetX, cam.targetY, nextZoom, vp);
        cam.targetX = clamped.x;
        cam.targetY = clamped.y;
      }
    } else if (cameraCommand.type === 'reset_zoom') {
      cam.targetZoom = clampZoom(1.0, vp);
      if (cam.activePreset === 'overview') {
        cam.activePreset = null;
      }
      if (cam.focusMode !== 'follow') {
        const clamped = clampCameraCenter(cam.targetX, cam.targetY, cam.targetZoom, vp);
        cam.targetX = clamped.x;
        cam.targetY = clamped.y;
      }
    }
  }, [cameraCommand]);

  // Mouse wheel cursor-anchored zoom listener (non-passive so scrolling zooms cleanly without moving page)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (propsRef.current.isModalOpen) return;
      e.preventDefault();

      if (propsRef.current.isMinaMenuOpen) {
        propsRef.current.onDismissMinaMenu();
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const vp = getViewportMetrics(propsRef.current.isFullscreenMap, dynamicViewRef.current);
      const vx = ((e.clientX - rect.left) / rect.width) * vp.viewW;
      const vy = ((e.clientY - rect.top) / rect.height) * vp.viewH;

      const cam = cameraRef.current;
      const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const prevZoom = cam.targetZoom;
      const nextZoom = clampZoom(prevZoom * zoomFactor, vp);
      if (Math.abs(nextZoom - prevZoom) < 0.001) return;

      if (cam.focusMode === 'free') {
        // Keep the world point directly under the mouse cursor anchored while zooming
        const anchor = viewportToWorld(vx, vy, cam.targetX, cam.targetY, prevZoom, vp);
        const nextScale = nextZoom * vp.baseScale;
        const desiredX = anchor.wx - (vx - vp.viewW / 2) / nextScale;
        const desiredY = anchor.wy - (vy - vp.viewH / 2) / nextScale;
        const clamped = clampCameraCenter(desiredX, desiredY, nextZoom, vp);
        cam.targetX = clamped.x;
        cam.targetY = clamped.y;
        cam.activePreset =
          nextZoom <= vp.minZoom + 0.02 ? 'overview' : null;
      }
      cam.targetZoom = nextZoom;
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // Start or restart Mina's autonomous walk to drawPinboard when a task is confirmed
  useEffect(() => {
    if (!minaMission || minaMission.id === lastMissionIdRef.current) {
      return;
    }
    lastMissionIdRef.current = minaMission.id;
    activeMissionTitleRef.current = minaMission.taskTitle;
    minaPinTimerRef.current = 0;
    minaPinnedNotifiedRef.current = false;
    minaReturningFromMissionRef.current = false;

    const mina = minaRef.current;
    if (mina.phase === 'pinning') {
      mina.pinProgress = 0;
      propsRef.current.onMinaMissionEvent?.('started', minaMission.taskTitle);
      return;
    }

    minaWaypointsRef.current = buildMinaToPinboardPath(mina.x, mina.y);
    minaSummonModeRef.current = null;
    minaSummonTargetRef.current = null;
    mina.phase = 'walking_to_board';
    mina.pinProgress = 0;
    propsRef.current.onMinaMissionEvent?.('started', minaMission.taskTitle);
  }, [minaMission]);

  // Trigger obstacle-free A* walk when user summons Mina from her computer desk
  useEffect(() => {
    if (!minaSummonCommand || minaSummonCommand.id === lastSummonIdRef.current) {
      return;
    }
    lastSummonIdRef.current = minaSummonCommand.id;

    const player = playerRef.current;
    const mina = minaRef.current;

    // Ensure player stands cleanly on walkable floor before computing meeting coordinates
    if (player.isSitting) {
      const prevSeat = player.seat;
      player.isSitting = false;
      player.seat = null;
      player.sofaActivity = null;
      player.sofaActivityElapsed = 0;
      if (prevSeat === 'workdesk') {
        player.x = WORK_STAND_POS.x;
        player.y = WORK_STAND_POS.y;
      } else if (prevSeat === 'sofa') {
        player.x = SOFA_STAND_POS.x;
        player.y = SOFA_STAND_POS.y;
      } else if (prevSeat === 'bedroom_bed') {
        player.x = BEDROOM_BED_STAND_POS.x;
        player.y = BEDROOM_BED_STAND_POS.y;
      } else if (prevSeat === 'green_car') {
        const car = greenCarRef.current;
        car.isDriving = false;
        car.speed = 0;
        car.braking = false;
        car.reversing = false;
        car.steerAngle = 0;
        const exitPos = findSafeCarExitPos(car);
        player.x = exitPos.x;
        player.y = exitPos.y;
      } else if (isDiningChairSeatId(prevSeat)) {
        const spot = DINING_CHAIR_SPOTS[prevSeat];
        player.x = spot.standPos.x;
        player.y = spot.standPos.y;
      }
      player.facing = 'down';
    }

    waypointsRef.current = [];
    pendingInteractRef.current = null;
    keysRef.current.clear();

    if (mina.phase === 'walking_to_board' || mina.phase === 'pinning') {
      return;
    }

    const path = findMeetingPathForMina(mina.x, mina.y, player.x, player.y);
    minaReturningFromMissionRef.current = false;

    if (path.length === 0) {
      minaWaypointsRef.current = [];
      minaSummonModeRef.current = null;
      minaSummonTargetRef.current = null;
      mina.isMoving = false;
      mina.walkFrame = 0;
      mina.phase = 'greeting_player';
      mina.facing = faceToward(mina.x, mina.y, player.x, player.y);
      player.facing = faceToward(player.x, player.y, mina.x, mina.y);
      propsRef.current.onMinaSummonArrived(minaSummonCommand.mode);
      return;
    }

    minaWaypointsRef.current = path;
    minaSummonModeRef.current = minaSummonCommand.mode;
    minaSummonTargetRef.current = { x: player.x, y: player.y };
    minaSummonRepathTimerRef.current = 0;
    mina.phase = 'summoned_to_player';
    mina.isMoving = true;
    mina.facing = faceToward(mina.x, mina.y, path[0].x, path[0].y);
    player.facing = faceToward(player.x, player.y, mina.x, mina.y);
  }, [minaSummonCommand]);

  // Trigger A* walk-and-deliver when an AI assistant finishes a Google Task and comes to open chat
  useEffect(() => {
    if (!deliveryWalkCommand || deliveryWalkCommand.id === lastDeliveryCmdIdRef.current) {
      return;
    }
    lastDeliveryCmdIdRef.current = deliveryWalkCommand.id;

    const player = playerRef.current;
    activeDeliveryRef.current = deliveryWalkCommand;

    if (deliveryWalkCommand.assistantId === 'mina') {
      const mina = minaRef.current;
      minaReturningFromMissionRef.current = false;
      minaPinTimerRef.current = 0;
      mina.pinProgress = 0;

      const path = findMeetingPathForMina(mina.x, mina.y, player.x, player.y);
      if (path.length === 0) {
        minaWaypointsRef.current = [];
        minaSummonModeRef.current = null;
        minaSummonTargetRef.current = null;
        mina.isMoving = false;
        mina.walkFrame = 0;
        mina.phase = 'greeting_player';
        mina.facing = faceToward(mina.x, mina.y, player.x, player.y);
        player.facing = faceToward(player.x, player.y, mina.x, mina.y);
        activeDeliveryRef.current = null;
        propsRef.current.onAssistantDeliveryArrived?.(deliveryWalkCommand.id, 'mina');
        return;
      }

      minaWaypointsRef.current = path;
      minaSummonModeRef.current = 'walk_then_chat';
      minaSummonTargetRef.current = { x: player.x, y: player.y };
      minaSummonRepathTimerRef.current = 0;
      mina.phase = 'summoned_to_player';
      mina.isMoving = true;
      mina.facing = faceToward(mina.x, mina.y, path[0].x, path[0].y);
      return;
    }

    const isAgy = deliveryWalkCommand.assistantId === 'antigravity';
    const npc = isAgy ? agyNpcRef.current : aiStudioNpcRef.current;
    const wpRef = isAgy ? agyWaypointsRef : aiStudioWaypointsRef;
    const targetRef = isAgy ? agyTargetRef : aiStudioTargetRef;
    const repathRef = isAgy ? agyRepathTimerRef : aiStudioRepathTimerRef;

    const path = findMeetingPathForMina(npc.x, npc.y, player.x, player.y);
    if (path.length === 0) {
      wpRef.current = [];
      targetRef.current = null;
      npc.isMoving = false;
      npc.walkFrame = 0;
      npc.phase = 'waiting_with_player';
      npc.facing = faceToward(npc.x, npc.y, player.x, player.y);
      player.facing = faceToward(player.x, player.y, npc.x, npc.y);
      activeDeliveryRef.current = null;
      propsRef.current.onAssistantDeliveryArrived?.(
        deliveryWalkCommand.id,
        deliveryWalkCommand.assistantId
      );
      return;
    }

    wpRef.current = path;
    targetRef.current = { x: player.x, y: player.y };
    repathRef.current = 0;
    npc.phase = 'walking_to_player';
    npc.isMoving = true;
    npc.facing = faceToward(npc.x, npc.y, path[0].x, path[0].y);
  }, [deliveryWalkCommand]);

  useEffect(() => {
    if (isModalOpen) {
      keysRef.current.clear();
      waypointsRef.current = [];
      pendingInteractRef.current = null;
      playerRef.current.isMoving = false;
      dragStateRef.current.pointerId = null;
      dragStateRef.current.isDragging = false;
      suppressNextClickRef.current = false;
      setIsPanningUi(false);
    }
  }, [isModalOpen]);

  // Snap player neatly onto their personal computer chair, Living Room sofa, or Kitchen dining chairs when sitting
  useEffect(() => {
    const player = playerRef.current;
    if (playerSeat === 'workdesk') {
      player.x = WORK_SEAT_POS.x;
      player.y = WORK_SEAT_POS.y;
      player.facing = 'up';
      player.isMoving = false;
      player.walkFrame = 0;
      player.isSitting = true;
      player.seat = 'workdesk';
      player.sofaActivity = null;
      player.sofaActivityElapsed = 0;
      waypointsRef.current = [];
      pendingInteractRef.current = null;
      keysRef.current.clear();
    } else if (playerSeat === 'sofa') {
      player.x = SOFA_SEAT_POS.x;
      player.y = SOFA_SEAT_POS.y;
      player.facing = 'down';
      player.isMoving = false;
      player.walkFrame = 0;
      player.isSitting = true;
      player.seat = 'sofa';
      pickNextSofaActivity();
      waypointsRef.current = [];
      pendingInteractRef.current = null;
      keysRef.current.clear();
    } else if (playerSeat === 'bedroom_bed') {
      player.x = BEDROOM_BED_SEAT_POS.x;
      player.y = BEDROOM_BED_SEAT_POS.y;
      player.facing = 'down';
      player.isMoving = false;
      player.walkFrame = 0;
      player.isSitting = true;
      player.seat = 'bedroom_bed';
      player.sofaActivity = null;
      player.sofaActivityElapsed = 0;
      waypointsRef.current = [];
      pendingInteractRef.current = null;
      keysRef.current.clear();
    } else if (playerSeat === 'green_car') {
      const car = greenCarRef.current;
      car.isDriving = true;
      car.speed = 0;
      car.braking = false;
      car.reversing = false;
      player.x = car.x;
      player.y = car.y;
      player.isMoving = false;
      player.walkFrame = 0;
      player.isSitting = true;
      player.seat = 'green_car';
      player.sofaActivity = null;
      player.sofaActivityElapsed = 0;
      waypointsRef.current = [];
      pendingInteractRef.current = null;
      keysRef.current.clear();
    } else if (isDiningChairSeatId(playerSeat)) {
      const spot = DINING_CHAIR_SPOTS[playerSeat];
      player.x = spot.seatPos.x;
      player.y = spot.seatPos.y;
      player.facing = spot.facing;
      player.isMoving = false;
      player.walkFrame = 0;
      player.isSitting = true;
      player.seat = playerSeat;
      player.sofaActivity = null;
      player.sofaActivityElapsed = 0;
      waypointsRef.current = [];
      pendingInteractRef.current = null;
      keysRef.current.clear();
    } else if (player.isSitting) {
      const prevSeat = player.seat;
      player.isSitting = false;
      player.seat = null;
      player.sofaActivity = null;
      player.sofaActivityElapsed = 0;
      if (prevSeat === 'workdesk') {
        player.x = WORK_STAND_POS.x;
        player.y = WORK_STAND_POS.y;
        player.facing = 'down';
      } else if (prevSeat === 'sofa') {
        player.x = SOFA_STAND_POS.x;
        player.y = SOFA_STAND_POS.y;
        player.facing = 'down';
      } else if (prevSeat === 'bedroom_bed') {
        player.x = BEDROOM_BED_STAND_POS.x;
        player.y = BEDROOM_BED_STAND_POS.y;
        player.facing = 'right';
      } else if (prevSeat === 'green_car') {
        const car = greenCarRef.current;
        car.isDriving = false;
        car.speed = 0;
        car.braking = false;
        car.reversing = false;
        car.steerAngle = 0;
        const exitPos = findSafeCarExitPos(car);
        player.x = exitPos.x;
        player.y = exitPos.y;
        player.facing = 'down';
      } else if (isDiningChairSeatId(prevSeat)) {
        const spot = DINING_CHAIR_SPOTS[prevSeat];
        player.x = spot.standPos.x;
        player.y = spot.standPos.y;
        player.facing = prevSeat === 'dining_chair_nw' || prevSeat === 'dining_chair_ne' ? 'up' : 'down';
      }
    }
  }, [playerSeat]);

  // Standing face-to-face conversation stance when entering WORKING state (both player & Mina stand facing each other)
  useEffect(() => {
    const player = playerRef.current;
    const mina = minaRef.current;

    if (gameState === 'WORKING') {
      player.isSitting = false;
      player.seat = null;
      player.isMoving = false;
      player.walkFrame = 0;
      waypointsRef.current = [];
      pendingInteractRef.current = null;
      keysRef.current.clear();

      // Ensure clear standing separation if player walked directly onto Mina's tile
      if (Math.hypot(player.x - mina.x, player.y - mina.y) < 22) {
        const nudgedX = player.x - 24;
        if (!collidesWithWorld(nudgedX, player.y)) {
          player.x = nudgedX;
        }
      }

      // Immediately stand Mina up from her chair to stand face-to-face ready to converse
      // (preserve active A* walk if summoned via chat_then_walk or on a pinboard mission)
      if (
        mina.phase !== 'walking_to_board' &&
        mina.phase !== 'pinning' &&
        mina.phase !== 'summoned_to_player'
      ) {
        minaWaypointsRef.current = [];
        minaReturningFromMissionRef.current = false;
        const dist = Math.hypot(player.x - mina.x, player.y - mina.y);
        if (mina.phase === 'working_at_desk' || dist > MINA_GREET_STOP_DIST + 4) {
          mina.phase = 'approaching_player';
        } else {
          mina.phase = 'greeting_player';
          mina.isMoving = false;
          mina.walkFrame = 0;
        }
      }

      player.facing = faceToward(player.x, player.y, mina.x, mina.y);
      if (mina.phase !== 'summoned_to_player') {
        mina.facing = faceToward(mina.x, mina.y, player.x, player.y);
      }
    }
  }, [gameState]);

  // Keyboard listeners with input focus guard
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };

    const standUpImmediately = () => {
      const player = playerRef.current;
      if (!player.isSitting) return;
      const prevSeat = player.seat;
      player.isSitting = false;
      player.seat = null;
      player.sofaActivity = null;
      player.sofaActivityElapsed = 0;
      if (prevSeat === 'workdesk') {
        player.x = WORK_STAND_POS.x;
        player.y = WORK_STAND_POS.y;
        player.facing = 'down';
      } else if (prevSeat === 'sofa') {
        player.x = SOFA_STAND_POS.x;
        player.y = SOFA_STAND_POS.y;
        player.facing = 'down';
      } else if (prevSeat === 'bedroom_bed') {
        player.x = BEDROOM_BED_STAND_POS.x;
        player.y = BEDROOM_BED_STAND_POS.y;
        player.facing = 'right';
      } else if (prevSeat === 'green_car') {
        const car = greenCarRef.current;
        car.isDriving = false;
        car.speed = 0;
        car.braking = false;
        car.reversing = false;
        car.steerAngle = 0;
        const exitPos = findSafeCarExitPos(car);
        player.x = exitPos.x;
        player.y = exitPos.y;
        player.facing = 'down';
      } else if (isDiningChairSeatId(prevSeat)) {
        const spot = DINING_CHAIR_SPOTS[prevSeat];
        player.x = spot.standPos.x;
        player.y = spot.standPos.y;
        player.facing = prevSeat === 'dining_chair_nw' || prevSeat === 'dining_chair_ne' ? 'up' : 'down';
      }
      propsRef.current.onStandUp();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) {
        return;
      }
      if (propsRef.current.gameState !== 'PLAYING' || propsRef.current.isModalOpen) {
        return;
      }

      const key = e.key.toLowerCase();
      const isDrivingCar =
        playerRef.current.isSitting && playerRef.current.seat === 'green_car';

      if (isDrivingCar) {
        if (
          ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(
            key
          )
        ) {
          e.preventDefault();
          if (propsRef.current.isMinaMenuOpen) {
            propsRef.current.onDismissMinaMenu();
          }
          // Keep full-map overview if active; otherwise follow the moving car smoothly
          if (
            cameraRef.current.focusMode !== 'follow' &&
            cameraRef.current.activePreset !== 'overview'
          ) {
            cameraRef.current.focusMode = 'follow';
            cameraRef.current.activePreset = 'follow';
          }
          keysRef.current.add(key);
          return;
        }
        if (key === 'h') {
          e.preventDefault();
          if (!e.repeat) {
            greenCarRef.current.hornTick = 18;
            soundEngine.playCarHorn();
          }
          return;
        }
        if (key === 'e') {
          e.preventDefault();
          soundEngine.playInteract();
          standUpImmediately();
          return;
        }
      }

      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        if (propsRef.current.isMinaMenuOpen) {
          propsRef.current.onDismissMinaMenu();
        }
        if (playerRef.current.isSitting) {
          standUpImmediately();
        }
        // Walking with keyboard smoothly re-engages follow-player camera so character stays centered
        if (cameraRef.current.focusMode !== 'follow') {
          cameraRef.current.focusMode = 'follow';
          cameraRef.current.activePreset = 'follow';
          if (cameraRef.current.targetZoom < 0.85) {
            cameraRef.current.targetZoom = CAMERA_DEFAULT_ZOOM;
          }
        }
        keysRef.current.add(key);
        waypointsRef.current = [];
        pendingInteractRef.current = null;
      } else if (key === 'e' || key === ' ') {
        if (playerRef.current.isSitting) {
          e.preventDefault();
          standUpImmediately();
          return;
        }
        const nearest = getEffectiveNearestInteractable(
          playerRef.current,
          minaRef.current,
          greenCarRef.current,
          agyEngagedRef.current,
          aiStudioEngagedRef.current
        );
        if (nearest) {
          e.preventDefault();
          propsRef.current.onInteract(nearest.id);
        }
      } else if (key === '=' || key === '+') {
        e.preventDefault();
        const cam = cameraRef.current;
        const vp = getViewportMetrics(propsRef.current.isFullscreenMap, dynamicViewRef.current);
        cam.targetZoom = clampZoom(cam.targetZoom + 0.16, vp);
        if (cam.focusMode !== 'follow') {
          const clamped = clampCameraCenter(cam.targetX, cam.targetY, cam.targetZoom, vp);
          cam.targetX = clamped.x;
          cam.targetY = clamped.y;
        }
      } else if (key === '-' || key === '_') {
        e.preventDefault();
        const cam = cameraRef.current;
        const vp = getViewportMetrics(propsRef.current.isFullscreenMap, dynamicViewRef.current);
        cam.targetZoom = clampZoom(cam.targetZoom - 0.16, vp);
        if (cam.focusMode !== 'follow') {
          const clamped = clampCameraCenter(cam.targetX, cam.targetY, cam.targetZoom, vp);
          cam.targetX = clamped.x;
          cam.targetY = clamped.y;
        }
      } else if (key === '0') {
        e.preventDefault();
        const cam = cameraRef.current;
        const vp = getViewportMetrics(propsRef.current.isFullscreenMap, dynamicViewRef.current);
        cam.focusMode = 'free';
        cam.activePreset = 'overview';
        cam.targetZoom = vp.minZoom;
        cam.targetX = WORLD_W / 2;
        cam.targetY = WORLD_H / 2;
      } else if (key === 'c') {
        e.preventDefault();
        const cam = cameraRef.current;
        cam.focusMode = 'follow';
        cam.activePreset = 'follow';
        if (cam.targetZoom < 0.85) {
          cam.targetZoom = CAMERA_DEFAULT_ZOOM;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const handleBlur = () => {
      keysRef.current.clear();
      hoverPointerRef.current.inside = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Trigger 5-plant watering can + droplet splash animation whenever player waters the porch planters
  useEffect(() => {
    if (plantWateringTriggerId > lastPlantWaterTriggerRef.current) {
      lastPlantWaterTriggerRef.current = plantWateringTriggerId;
      plantWateringAnimRef.current = {
        active: true,
        elapsed: 0,
        duration: 2.2,
      };
      // Gently orient player toward the 5 potted plants when standing beside them
      const player = playerRef.current;
      const centerX = PORCH_PLANTER_RECT.x + PORCH_PLANTER_RECT.w / 2;
      const centerY = PORCH_PLANTER_RECT.y + PORCH_PLANTER_RECT.h / 2;
      if (Math.hypot(player.x - centerX, player.y - centerY) <= 110 && !player.isSitting) {
        player.facing =
          Math.abs(centerX - player.x) >= Math.abs(centerY - player.y)
            ? centerX >= player.x
              ? 'right'
              : 'left'
            : centerY >= player.y
              ? 'down'
              : 'up';
      }
    }
  }, [plantWateringTriggerId]);

  // Main 60fps update + render loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let tick = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      tick += 1;

      if (plantWateringAnimRef.current.active) {
        plantWateringAnimRef.current.elapsed += dt;
        if (plantWateringAnimRef.current.elapsed >= plantWateringAnimRef.current.duration) {
          plantWateringAnimRef.current.active = false;
          plantWateringAnimRef.current.elapsed = 0;
        }
      }

      const {
        gameState: state,
        timeOfDay: tod,
        assistantMood: mood,
        minaBubbleText: bubble,
        extraPinCount: pinCount,
        isTvOn: tvOn,
        isModalOpen: modalOpen,
      } = propsRef.current;

      const player = playerRef.current;
      const mina = minaRef.current;
      const greenCar = greenCarRef.current;

      if (greenCar.hornTick > 0) {
        greenCar.hornTick -= 1;
      }
      if (wrapToastCooldownRef.current > 0) {
        wrapToastCooldownRef.current = Math.max(0, wrapToastCooldownRef.current - dt);
      }

      if (state === 'PLAYING' && !modalOpen && !player.isSitting) {
        let vx = 0;
        let vy = 0;
        const keys = keysRef.current;

        if (keys.has('w') || keys.has('arrowup')) vy -= 1;
        if (keys.has('s') || keys.has('arrowdown')) vy += 1;
        if (keys.has('a') || keys.has('arrowleft')) vx -= 1;
        if (keys.has('d') || keys.has('arrowright')) vx += 1;

        // Smooth doorway exit assist when pressing Right inside the upper NW shower wet zone
        if (
          vx > 0 &&
          vy === 0 &&
          isPointInShowerWetZone(player.x, player.y) &&
          player.y < 16.45 * TILE
        ) {
          vy = 0.85;
        }

        if (vx !== 0 || vy !== 0) {
          const len = Math.hypot(vx, vy);
          vx /= len;
          vy /= len;
        } else if (waypointsRef.current.length > 0) {
          const nextWp = waypointsRef.current[0];
          const dx = nextWp.x - player.x;
          const dy = nextWp.y - player.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 6) {
            waypointsRef.current.shift();
            if (waypointsRef.current.length === 0 && pendingInteractRef.current) {
              const targetId = pendingInteractRef.current;
              pendingInteractRef.current = null;
              propsRef.current.onInteract(targetId);
            }
          } else {
            vx = dx / dist;
            vy = dy / dist;
          }
        }

        if (vx !== 0 || vy !== 0) {
          const stepX = vx * MOVE_SPEED * dt;
          const stepY = vy * MOVE_SPEED * dt;

          let moved = false;
          if (
            !collidesWithWorld(player.x + stepX, player.y) &&
            !isPointInsideCar(player.x + stepX, player.y, greenCar, 6)
          ) {
            player.x += stepX;
            moved = true;
          }
          if (
            !collidesWithWorld(player.x, player.y + stepY) &&
            !isPointInsideCar(player.x, player.y + stepY, greenCar, 6)
          ) {
            player.y += stepY;
            moved = true;
          }

          // Cancel stuck click waypoint if blocked completely
          if (!moved && waypointsRef.current.length > 0) {
            waypointsRef.current = [];
            if (pendingInteractRef.current) {
              const nearest = getEffectiveNearestInteractable(
                player,
                mina,
                greenCar,
                agyEngagedRef.current,
                aiStudioEngagedRef.current
              );
              if (nearest && nearest.id === pendingInteractRef.current) {
                propsRef.current.onInteract(pendingInteractRef.current);
              }
              pendingInteractRef.current = null;
            }
          }

          if (Math.abs(vx) > Math.abs(vy)) {
            player.facing = vx > 0 ? 'right' : 'left';
          } else {
            player.facing = vy > 0 ? 'down' : 'up';
          }

          player.isMoving = moved;
          if (moved) {
            player.walkFrame += dt * 9.5;
            soundEngine.playStep();
          }
        } else {
          player.isMoving = false;
          player.walkFrame = 0;
        }

        // Zone change detection
        const nextZone = getRoomZone(player.x, player.y);
        if (nextZone !== currentZoneRef.current) {
          currentZoneRef.current = nextZone;
          propsRef.current.onZoneChange(nextZone);
        }

        // Automatic Bathroom Shower Wet-Zone Controller:
        // Walking into the wet zone automatically closes the privacy frosted glass, turns on the rain shower,
        // and cycles through wetting -> grab_soap -> scrub_soap -> return_soap -> rinse.
        const inShowerWetZone = isPointInShowerWetZone(player.x, player.y);
        const lastWp =
          waypointsRef.current.length > 0
            ? waypointsRef.current[waypointsRef.current.length - 1]
            : null;
        const isWalkingOutOfShower =
          (keys.size > 0 && vx > 0) ||
          (lastWp !== null && !isPointInShowerWetZone(lastWp.x, lastWp.y));

        if (inShowerWetZone && !isWalkingOutOfShower) {
          if (!player.isShowering) {
            player.isShowering = true;
            player.showerPhase = 'wetting';
            player.showerPhaseElapsed = 0;
            soundEngine.playInteract();
          }

          player.showerPrivacyProgress = Math.min(1, player.showerPrivacyProgress + dt * 4.5);

          // If player walked in and has no manual keys pressed, settle under the rain shower head
          if (keys.size === 0) {
            if (lastWp && isPointInShowerWetZone(lastWp.x, lastWp.y) && player.x <= 3.85 * TILE) {
              waypointsRef.current = [];
            }
            const phase = player.showerPhase ?? 'wetting';
            const reachOffset = phase === 'grab_soap' || phase === 'return_soap' ? -7 : 0;
            const targetX = SHOWER_STAND_POS.x + reachOffset;
            const targetY =
              SHOWER_STAND_POS.y + (phase === 'grab_soap' || phase === 'return_soap' ? -4 : 0);
            const dx = targetX - player.x;
            const dy = targetY - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 1.5 && waypointsRef.current.length === 0) {
              const glideStep = Math.min(dist, 76 * dt);
              const nx = player.x + (dx / dist) * glideStep;
              const ny = player.y + (dy / dist) * glideStep;
              if (!collidesWithWorld(nx, player.y)) player.x = nx;
              if (!collidesWithWorld(player.x, ny)) player.y = ny;
            }
          }

          // Advance automatic shower & soap cycle phases
          player.showerPhaseElapsed += dt;
          const phase = player.showerPhase ?? 'wetting';
          if (phase === 'wetting') {
            player.facing = 'down';
            if (player.showerPhaseElapsed >= 1.4) {
              player.showerPhase = 'grab_soap';
              player.showerPhaseElapsed = 0;
            }
          } else if (phase === 'grab_soap') {
            player.facing = 'left';
            if (player.showerPhaseElapsed >= 1.5) {
              player.showerPhase = 'scrub_soap';
              player.showerPhaseElapsed = 0;
            }
          } else if (phase === 'scrub_soap') {
            player.facing = 'down';
            if (player.showerPhaseElapsed >= 3.4) {
              player.showerPhase = 'return_soap';
              player.showerPhaseElapsed = 0;
            }
          } else if (phase === 'return_soap') {
            player.facing = 'left';
            if (player.showerPhaseElapsed >= 1.5) {
              player.showerPhase = 'rinse';
              player.showerPhaseElapsed = 0;
            }
          } else if (phase === 'rinse') {
            player.facing = 'down';
            if (player.showerPhaseElapsed >= 2.2) {
              player.showerPhase = 'grab_soap';
              player.showerPhaseElapsed = 0;
            }
          }
        } else if (!inShowerWetZone) {
          if (player.isShowering) {
            player.isShowering = false;
            player.showerPhase = null;
            player.showerPhaseElapsed = 0;
          }
          player.showerPrivacyProgress = Math.max(0, player.showerPrivacyProgress - dt * 4.5);
        }
      }

      // Top-down arcade driving physics for the left green car (Garage, Driveway & 2-Lane Road with Wrap-Around!)
      if (state === 'PLAYING' && !modalOpen && player.isSitting && player.seat === 'green_car') {
        const keys = keysRef.current;
        const up = keys.has('w') || keys.has('arrowup');
        const down = keys.has('s') || keys.has('arrowdown');
        const left = keys.has('a') || keys.has('arrowleft');
        const right = keys.has('d') || keys.has('arrowright');
        const handbrake = keys.has(' ');

        const MAX_FWD = 250;
        const MAX_REV = -115;
        const ACCEL = 300;
        const REV_ACCEL = 215;
        const BRAKE_DECEL = 520;
        const HANDBRAKE_DECEL = 640;
        const COAST_DECEL = 165;
        const MAX_TURN_RATE = 2.65;

        const steerInput = (right ? 1 : 0) - (left ? 1 : 0);
        const targetSteerAngle = steerInput * 0.44;
        greenCar.steerAngle += (targetSteerAngle - greenCar.steerAngle) * Math.min(1, dt * 14);

        let braking = false;
        if (handbrake) {
          braking = true;
          if (greenCar.speed > 0) {
            greenCar.speed = Math.max(0, greenCar.speed - HANDBRAKE_DECEL * dt);
          } else if (greenCar.speed < 0) {
            greenCar.speed = Math.min(0, greenCar.speed + HANDBRAKE_DECEL * dt);
          }
        } else if (up && !down) {
          if (greenCar.speed < -6) {
            braking = true;
            greenCar.speed = Math.min(0, greenCar.speed + BRAKE_DECEL * dt);
          } else {
            greenCar.speed = Math.min(MAX_FWD, greenCar.speed + ACCEL * dt);
          }
        } else if (down && !up) {
          if (greenCar.speed > 6) {
            braking = true;
            greenCar.speed = Math.max(0, greenCar.speed - BRAKE_DECEL * dt);
          } else {
            greenCar.speed = Math.max(MAX_REV, greenCar.speed - REV_ACCEL * dt);
          }
        } else {
          if (greenCar.speed > 0) {
            greenCar.speed = Math.max(0, greenCar.speed - COAST_DECEL * dt);
          } else if (greenCar.speed < 0) {
            greenCar.speed = Math.min(0, greenCar.speed + COAST_DECEL * dt);
          }
        }

        if (!up && !down && Math.abs(greenCar.speed) < 2) {
          greenCar.speed = 0;
        }

        greenCar.braking = braking;
        greenCar.reversing = greenCar.speed < -4 || (down && !up && !handbrake && greenCar.speed <= 4);

        let nextAngle = greenCar.angle;
        if (Math.abs(greenCar.speed) > 4 && steerInput !== 0) {
          const turnScale = Math.min(1, Math.abs(greenCar.speed) / 62);
          const dirSign = greenCar.speed >= 0 ? 1 : -1;
          nextAngle = greenCar.angle + steerInput * MAX_TURN_RATE * turnScale * dirSign * dt;
        }

        const nx = greenCar.x + Math.cos(nextAngle) * greenCar.speed * dt;
        const ny = greenCar.y + Math.sin(nextAngle) * greenCar.speed * dt;

        if (!carCollidesWithWorld(nx, ny, nextAngle)) {
          greenCar.x = nx;
          greenCar.y = ny;
          greenCar.angle = nextAngle;
        } else if (!carCollidesWithWorld(nx, greenCar.y, greenCar.angle)) {
          greenCar.x = nx;
          greenCar.speed *= 0.55;
        } else if (!carCollidesWithWorld(greenCar.x, ny, greenCar.angle)) {
          greenCar.y = ny;
          greenCar.speed *= 0.55;
        } else if (!carCollidesWithWorld(greenCar.x, greenCar.y, nextAngle)) {
          greenCar.angle = nextAngle;
          greenCar.speed *= 0.35;
        } else {
          greenCar.speed = 0;
        }

        // Seamless road edge wrap-around ("ขับทะลุอีกฝั่งเพื่อกลับบ้าน")
        const onRoad = greenCar.y >= (ROAD_ROW_START - 0.65) * TILE;
        if (onRoad) {
          const camNow = cameraRef.current;
          if (greenCar.x > WORLD_W) {
            greenCar.x -= WORLD_W;
            if (camNow.focusMode === 'follow') {
              camNow.x -= WORLD_W;
              camNow.targetX -= WORLD_W;
            }
            if (wrapToastCooldownRef.current <= 0) {
              wrapToastCooldownRef.current = 3.2;
              propsRef.current.onCarWrapHome?.('right');
            }
          } else if (greenCar.x < 0) {
            greenCar.x += WORLD_W;
            if (camNow.focusMode === 'follow') {
              camNow.x += WORLD_W;
              camNow.targetX += WORLD_W;
            }
            if (wrapToastCooldownRef.current <= 0) {
              wrapToastCooldownRef.current = 3.2;
              propsRef.current.onCarWrapHome?.('left');
            }
          }
        }

        player.x = greenCar.x;
        player.y = greenCar.y;

        const nextZone = getRoomZone(player.x, player.y);
        if (nextZone !== currentZoneRef.current) {
          currentZoneRef.current = nextZone;
          propsRef.current.onZoneChange(nextZone);
        }

        const speedKmh = Math.round(Math.abs(greenCar.speed) * 0.24);
        const gear: DrivingHudState['gear'] =
          greenCar.speed > 4 ? 'D' : greenCar.speed < -4 ? 'R' : 'P';
        const hudKey = `${gear}:${speedKmh}`;
        if (hudKey !== lastDrivingHudKeyRef.current) {
          lastDrivingHudKeyRef.current = hudKey;
          propsRef.current.onDrivingHudChange?.({ speedKmh, gear });
        }
      } else if (lastDrivingHudKeyRef.current !== '') {
        lastDrivingHudKeyRef.current = '';
        propsRef.current.onDrivingHudChange?.(null);
      }

      // Advance non-repeating cozy idle activity while seated on the Living Room sofa
      if (state === 'PLAYING' && !modalOpen && player.isSitting && player.seat === 'sofa') {
        if (!player.sofaActivity) {
          pickNextSofaActivity();
        } else {
          player.sofaActivityElapsed += dt;
          if (
            player.sofaActivity === 'tv_remote' &&
            !sofaRemoteClickedRef.current &&
            player.sofaActivityElapsed >= 0.85
          ) {
            sofaRemoteClickedRef.current = true;
            soundEngine.playInteract();
          }
          if (player.sofaActivityElapsed >= sofaActivityDurationRef.current) {
            pickNextSofaActivity();
          }
        }
      }

      // Keep player standing and facing Mina continuously during active conversation
      if (state === 'WORKING' && !modalOpen) {
        player.isSitting = false;
        player.isMoving = false;
        player.walkFrame = 0;
        player.facing = faceToward(player.x, player.y, mina.x, mina.y);
      }

      // Autonomous Mina NPC behavior: seated working, tight-radius standing greeting/conversation, and pinboard missions
      if (!modalOpen) {
        const playerInOffice = getRoomZone(player.x, player.y) === 'office';
        const distPlayerToMinaDesk = Math.hypot(player.x - MINA_POS.x, player.y - MINA_POS.y);
        const distPlayerToMina = Math.hypot(player.x - mina.x, player.y - mina.y);
        const isConversing = state === 'WORKING';

        if (mina.phase === 'working_at_desk') {
          mina.x = MINA_POS.x;
          mina.y = MINA_POS.y;
          mina.facing = 'right';
          mina.isMoving = false;
          mina.walkFrame = 0;

          // Stand up immediately when player enters tight desk radius or starts conversing
          if (
            isConversing ||
            (state === 'PLAYING' && playerInOffice && distPlayerToMinaDesk <= MINA_APPROACH_RADIUS)
          ) {
            mina.phase = 'approaching_player';
            minaWaypointsRef.current = [];
            minaReturningFromMissionRef.current = false;
            if (!isConversing) {
              propsRef.current.onMinaProximityEvent?.('approached');
            }
          }
        } else if (mina.phase === 'approaching_player') {
          const playerLeftRadius =
            !isConversing && (!playerInOffice || distPlayerToMinaDesk > MINA_LEAVE_RADIUS);

          if (playerLeftRadius) {
            // Return immediately to her desk chair — never follow player out of the radius
            minaReturningFromMissionRef.current = false;
            minaWaypointsRef.current = buildMinaReturnToDeskPath(mina.x, mina.y);
            mina.phase = 'walking_back';
            if (state === 'PLAYING') {
              propsRef.current.onMinaProximityEvent?.('returning');
            }
          } else if (distPlayerToMina <= MINA_GREET_STOP_DIST) {
            mina.isMoving = false;
            mina.walkFrame = 0;
            mina.facing = faceToward(mina.x, mina.y, player.x, player.y);
            mina.phase = 'greeting_player';
          } else {
            const dx = player.x - mina.x;
            const dy = player.y - mina.y;
            const vx = dx / distPlayerToMina;
            const vy = dy / distPlayerToMina;
            const stepX = vx * MINA_MOVE_SPEED * dt;
            const stepY = vy * MINA_MOVE_SPEED * dt;

            let moved = false;
            const nextX = mina.x + stepX;
            const nextY = mina.y + stepY;

            // Enforce hard roam radius around MINA_POS so Mina never leaves her desk zone
            if (
              nextX >= MINA_MIN_OFFICE_X &&
              Math.hypot(nextX - MINA_POS.x, mina.y - MINA_POS.y) <= MINA_MAX_ROAM_RADIUS &&
              !collidesWithWorld(nextX, mina.y)
            ) {
              mina.x = nextX;
              moved = true;
            }
            if (
              Math.hypot(mina.x - MINA_POS.x, nextY - MINA_POS.y) <= MINA_MAX_ROAM_RADIUS &&
              !collidesWithWorld(mina.x, nextY)
            ) {
              mina.y = nextY;
              moved = true;
            }

            if (moved) {
              mina.facing = faceToward(0, 0, vx, vy);
              mina.isMoving = true;
              mina.walkFrame += dt * 8.8;
            } else {
              // Reached roam boundary or furniture — stop and stand face-to-face ready to converse
              mina.isMoving = false;
              mina.walkFrame = 0;
              mina.facing = faceToward(mina.x, mina.y, player.x, player.y);
              mina.phase = 'greeting_player';
            }
          }
        } else if (mina.phase === 'summoned_to_player') {
          // If user closed chat while Mina was walking over in chat_then_walk mode, return neatly to her desk
          if (minaSummonModeRef.current === 'chat_then_walk' && !isConversing) {
            const wasPinMission = minaReturningFromMissionRef.current;
            minaSummonModeRef.current = null;
            minaSummonTargetRef.current = null;
            if (!playerInOffice || distPlayerToMinaDesk > MINA_LEAVE_RADIUS) {
              minaWaypointsRef.current = buildMinaReturnToDeskPath(mina.x, mina.y);
              mina.phase = 'walking_back';
              if (!wasPinMission && state === 'PLAYING') {
                propsRef.current.onMinaProximityEvent?.('returning');
              }
            } else {
              minaWaypointsRef.current = [];
              mina.isMoving = false;
              mina.walkFrame = 0;
              mina.phase = 'greeting_player';
              mina.facing = faceToward(mina.x, mina.y, player.x, player.y);
            }
          } else {
            // Recompute A* path cleanly if the player moved significantly while Mina is walking over
            if (minaSummonModeRef.current === 'walk_then_chat' && minaSummonTargetRef.current) {
              minaSummonRepathTimerRef.current += dt;
              if (minaSummonRepathTimerRef.current >= 0.3) {
                minaSummonRepathTimerRef.current = 0;
                const movedDist = Math.hypot(
                  player.x - minaSummonTargetRef.current.x,
                  player.y - minaSummonTargetRef.current.y
                );
                if (movedDist > 28) {
                  minaWaypointsRef.current = findMeetingPathForMina(
                    mina.x,
                    mina.y,
                    player.x,
                    player.y
                  );
                  minaSummonTargetRef.current = { x: player.x, y: player.y };
                }
              }
            }

            // Advance smoothly along precomputed A* waypoints with zero obstacle snagging
            let remainingStep = MINA_SUMMON_SPEED * dt;
            let moved = false;
            while (remainingStep > 0 && minaWaypointsRef.current.length > 0) {
              const nextWp = minaWaypointsRef.current[0];
              const dx = nextWp.x - mina.x;
              const dy = nextWp.y - mina.y;
              const dist = Math.hypot(dx, dy);

              if (dist <= remainingStep + 1.2) {
                mina.x = nextWp.x;
                mina.y = nextWp.y;
                remainingStep = Math.max(0, remainingStep - dist);
                minaWaypointsRef.current.shift();
                moved = true;
              } else {
                const vx = dx / dist;
                const vy = dy / dist;
                mina.x += vx * remainingStep;
                mina.y += vy * remainingStep;
                mina.facing = faceToward(0, 0, vx, vy);
                remainingStep = 0;
                moved = true;
              }
            }

            if (minaWaypointsRef.current.length > 0) {
              mina.isMoving = moved;
              mina.walkFrame += dt * 9.5;
            } else {
              // Arrived cleanly beside the player!
              const arrivedMode = minaSummonModeRef.current ?? 'walk_then_chat';
              const wasPinMission = minaReturningFromMissionRef.current;
              minaReturningFromMissionRef.current = false;
              minaSummonModeRef.current = null;
              minaSummonTargetRef.current = null;
              mina.isMoving = false;
              mina.walkFrame = 0;
              mina.phase = 'greeting_player';
              mina.facing = faceToward(mina.x, mina.y, player.x, player.y);
              player.facing = faceToward(player.x, player.y, mina.x, mina.y);

              if (activeDeliveryRef.current?.assistantId === 'mina') {
                const deliveredCmdId = activeDeliveryRef.current.id;
                activeDeliveryRef.current = null;
                propsRef.current.onAssistantDeliveryArrived?.(deliveredCmdId, 'mina');
              } else if (wasPinMission) {
                propsRef.current.onMinaMissionEvent?.('returned', activeMissionTitleRef.current);
              } else {
                propsRef.current.onMinaSummonArrived(arrivedMode);
              }
            }
          }
        } else if (mina.phase === 'greeting_player') {
          mina.isMoving = false;
          mina.walkFrame = 0;
          mina.facing = faceToward(mina.x, mina.y, player.x, player.y);

          const playerLeftRadius =
            !isConversing && (!playerInOffice || distPlayerToMinaDesk > MINA_LEAVE_RADIUS);

          // Immediately return to her computer chair via A* as soon as player walks out of radius
          if (playerLeftRadius) {
            minaReturningFromMissionRef.current = false;
            minaWaypointsRef.current = buildMinaReturnToDeskPath(mina.x, mina.y);
            mina.phase = 'walking_back';
            if (state === 'PLAYING') {
              propsRef.current.onMinaProximityEvent?.('returning');
            }
          }
        } else if (mina.phase === 'walking_to_board' || mina.phase === 'walking_back') {
          // If Mina is casually walking back to her chair and player steps back inside the radius, greet again
          if (
            mina.phase === 'walking_back' &&
            !minaReturningFromMissionRef.current &&
            (isConversing || (state === 'PLAYING' && playerInOffice && distPlayerToMinaDesk <= MINA_APPROACH_RADIUS))
          ) {
            minaWaypointsRef.current = [];
            mina.phase = 'approaching_player';
            if (!isConversing) {
              propsRef.current.onMinaProximityEvent?.('approached');
            }
          } else {
            const nextWp = minaWaypointsRef.current[0];
            if (nextWp) {
              const dx = nextWp.x - mina.x;
              const dy = nextWp.y - mina.y;
              const dist = Math.hypot(dx, dy);
              const maxStep = MINA_MOVE_SPEED * dt;

              if (dist <= maxStep + 1.5) {
                mina.x = nextWp.x;
                mina.y = nextWp.y;
                minaWaypointsRef.current.shift();
              } else {
                const vx = dx / dist;
                const vy = dy / dist;
                mina.x += vx * maxStep;
                mina.y += vy * maxStep;
                mina.facing = faceToward(0, 0, vx, vy);
              }
              mina.isMoving = true;
              mina.walkFrame += dt * 8.5;
            }

            if (minaWaypointsRef.current.length === 0) {
              mina.isMoving = false;
              mina.walkFrame = 0;

              if (mina.phase === 'walking_to_board') {
                mina.phase = 'pinning';
                mina.facing = 'up';
                mina.pinProgress = 0;
                minaPinTimerRef.current = 0;
                minaPinnedNotifiedRef.current = false;
                pinboardGlowTickRef.current = 90;
              } else {
                const wasPinMission = minaReturningFromMissionRef.current;
                minaReturningFromMissionRef.current = false;
                mina.pinProgress = 0;
                mina.x = MINA_POS.x;
                mina.y = MINA_POS.y;

                if (isConversing) {
                  // Still conversing with player: step back to stand face-to-face ready to talk
                  mina.phase = 'approaching_player';
                  mina.facing = faceToward(mina.x, mina.y, player.x, player.y);
                } else {
                  mina.facing = 'right';
                  mina.phase = 'working_at_desk';
                }

                if (wasPinMission) {
                  propsRef.current.onMinaMissionEvent?.('returned', activeMissionTitleRef.current);
                }
              }
            }
          }
        } else if (mina.phase === 'pinning') {
          mina.facing = 'up';
          mina.isMoving = false;
          minaPinTimerRef.current += dt;
          mina.pinProgress = Math.min(1, minaPinTimerRef.current / MINA_PIN_DURATION);

          if (!minaPinnedNotifiedRef.current && mina.pinProgress >= 0.45) {
            minaPinnedNotifiedRef.current = true;
            pinboardGlowTickRef.current = 80;
            soundEngine.playInteract();
            propsRef.current.onMinaMissionEvent?.('pinned', activeMissionTitleRef.current);
          }

          if (minaPinTimerRef.current >= MINA_PIN_DURATION) {
            mina.pinProgress = 0;
            minaReturningFromMissionRef.current = true;
            if (isConversing) {
              // Return directly to where the player is standing (even in the Living Room!) via A*
              minaWaypointsRef.current = findMeetingPathForMina(
                mina.x,
                mina.y,
                player.x,
                player.y
              );
              minaSummonModeRef.current = 'chat_then_walk';
              minaSummonTargetRef.current = { x: player.x, y: player.y };
              mina.phase = 'summoned_to_player';
            } else {
              mina.phase = 'walking_back';
              minaWaypointsRef.current = buildMinaReturnToDeskPath(mina.x, mina.y);
            }
          }
        }
      }

      // Roving delivery walk & return-to-desk updates for Antigravity & Google AI Studio
      const stepRovingAssistant = (
        assistantId: 'antigravity' | 'ai_studio',
        npc: RovingAssistantNpcState,
        wpRef: { current: Array<{ x: number; y: number }> },
        targetRef: { current: { x: number; y: number } | null },
        repathRef: { current: number },
        homePos: { x: number; y: number },
        homeFacing: 'left' | 'down',
        isChatOpen: boolean
      ) => {
        if (npc.phase === 'walking_to_player') {
          if (targetRef.current) {
            repathRef.current += dt;
            if (repathRef.current >= 0.3) {
              repathRef.current = 0;
              const movedDist = Math.hypot(
                player.x - targetRef.current.x,
                player.y - targetRef.current.y
              );
              if (movedDist > 28) {
                wpRef.current = findMeetingPathForMina(npc.x, npc.y, player.x, player.y);
                targetRef.current = { x: player.x, y: player.y };
              }
            }
          }

          let remainingStep = MINA_SUMMON_SPEED * dt;
          let moved = false;
          while (remainingStep > 0 && wpRef.current.length > 0) {
            const nextWp = wpRef.current[0];
            const dx = nextWp.x - npc.x;
            const dy = nextWp.y - npc.y;
            const dist = Math.hypot(dx, dy);
            if (dist <= remainingStep + 1.2) {
              npc.x = nextWp.x;
              npc.y = nextWp.y;
              remainingStep = Math.max(0, remainingStep - dist);
              wpRef.current.shift();
              moved = true;
            } else {
              const vx = dx / dist;
              const vy = dy / dist;
              npc.x += vx * remainingStep;
              npc.y += vy * remainingStep;
              npc.facing = faceToward(0, 0, vx, vy);
              remainingStep = 0;
              moved = true;
            }
          }

          if (wpRef.current.length > 0) {
            npc.isMoving = moved;
            npc.walkFrame += dt * 9.5;
          } else {
            targetRef.current = null;
            npc.isMoving = false;
            npc.walkFrame = 0;
            npc.phase = 'waiting_with_player';
            npc.facing = faceToward(npc.x, npc.y, player.x, player.y);
            player.facing = faceToward(player.x, player.y, npc.x, npc.y);

            if (activeDeliveryRef.current?.assistantId === assistantId) {
              const deliveredCmdId = activeDeliveryRef.current.id;
              activeDeliveryRef.current = null;
              propsRef.current.onAssistantDeliveryArrived?.(deliveredCmdId, assistantId);
            }
          }
        } else if (npc.phase === 'waiting_with_player') {
          npc.isMoving = false;
          npc.walkFrame = 0;
          npc.facing = faceToward(npc.x, npc.y, player.x, player.y);
          const playerNearNpc = Math.hypot(player.x - npc.x, player.y - npc.y) <= 72;
          if (!isChatOpen && !playerNearNpc && activeDeliveryRef.current?.assistantId !== assistantId) {
            wpRef.current = findWalkablePath(npc.x, npc.y, homePos.x, homePos.y);
            npc.phase = 'walking_back';
          }
        } else if (npc.phase === 'walking_back') {
          const nextWp = wpRef.current[0];
          if (nextWp) {
            const dx = nextWp.x - npc.x;
            const dy = nextWp.y - npc.y;
            const dist = Math.hypot(dx, dy);
            const maxStep = MINA_MOVE_SPEED * dt;
            if (dist <= maxStep + 1.5) {
              npc.x = nextWp.x;
              npc.y = nextWp.y;
              wpRef.current.shift();
            } else {
              const vx = dx / dist;
              const vy = dy / dist;
              npc.x += vx * maxStep;
              npc.y += vy * maxStep;
              npc.facing = faceToward(0, 0, vx, vy);
            }
            npc.isMoving = true;
            npc.walkFrame += dt * 8.2;
          } else {
            npc.x = homePos.x;
            npc.y = homePos.y;
            npc.facing = homeFacing;
            npc.isMoving = false;
            npc.walkFrame = 0;
            npc.phase = 'at_desk';
          }
        }
      };

      stepRovingAssistant(
        'antigravity',
        agyNpcRef.current,
        agyWaypointsRef,
        agyTargetRef,
        agyRepathTimerRef,
        AGY_POS,
        'left',
        Boolean(propsRef.current.isAntigravityOpen)
      );
      stepRovingAssistant(
        'ai_studio',
        aiStudioNpcRef.current,
        aiStudioWaypointsRef,
        aiStudioTargetRef,
        aiStudioRepathTimerRef,
        AISTUDIO_POS,
        'down',
        Boolean(propsRef.current.isAiStudioOpen)
      );

      // Autonomous Antigravity & Google AI Studio proximity tracking
      if (!modalOpen) {
        const nextAgyEngaged = isPlayerInsideAgyRadius(player, agyEngagedRef.current);
        if (nextAgyEngaged !== agyEngagedRef.current) {
          agyEngagedRef.current = nextAgyEngaged;
          if (state === 'PLAYING') {
            propsRef.current.onAntigravityProximityEvent?.(
              nextAgyEngaged ? 'approached' : 'returning'
            );
          }
        }

        const nextAiStudioEngaged = isPlayerInsideAiStudioRadius(
          player,
          aiStudioEngagedRef.current
        );
        if (nextAiStudioEngaged !== aiStudioEngagedRef.current) {
          aiStudioEngagedRef.current = nextAiStudioEngaged;
          if (state === 'PLAYING') {
            propsRef.current.onAiStudioProximityEvent?.(
              nextAiStudioEngaged ? 'approached' : 'returning'
            );
          }
        }
      }

      // Nearest interactable detection (hidden while seated; standing up clears seat)
      if (state === 'PLAYING' && !modalOpen) {
        const nearest = player.isSitting
          ? null
          : getEffectiveNearestInteractable(
              player,
              mina,
              greenCar,
              agyEngagedRef.current,
              aiStudioEngagedRef.current
            );
        const nextKey = nearest ? `${nearest.id}:${nearest.label}` : null;
        if (nextKey !== nearestKeyRef.current) {
          nearestKeyRef.current = nextKey;
          propsRef.current.onNearestChange(nearest);
        }
      }

      if (pinboardGlowTickRef.current > 0) {
        pinboardGlowTickRef.current -= 1;
      }

      if (clickMarkerRef.current) {
        clickMarkerRef.current.ttl -= 1;
        if (clickMarkerRef.current.ttl <= 0) {
          clickMarkerRef.current = null;
        }
      }

      // Update smooth 2D camera target & interpolation
      const cam = cameraRef.current;
      const vp = getViewportMetrics(propsRef.current.isFullscreenMap, dynamicViewRef.current);
      const isDraggingMap = dragStateRef.current.isDragging;

      if (!isDraggingMap) {
        if (cam.focusMode === 'follow') {
          if (player.isSitting && player.seat === 'green_car') {
            // Subtle velocity look-ahead while driving so the road & driveway stay comfortably visible
            cam.targetX = greenCar.x + Math.cos(greenCar.angle) * greenCar.speed * 0.16;
            cam.targetY = greenCar.y + Math.sin(greenCar.angle) * greenCar.speed * 0.16;
          } else {
            // Keep the player character dead-center on screen in follow mode
            cam.targetX = state === 'WORKING' ? (player.x + mina.x) / 2 : player.x;
            cam.targetY = state === 'WORKING' ? (player.y + mina.y) / 2 : player.y;
          }
        } else {
          const clampedTarget = clampCameraCenter(cam.targetX, cam.targetY, cam.targetZoom, vp);
          cam.targetX = clampedTarget.x;
          cam.targetY = clampedTarget.y;
        }
      }

      const smoothSpeed = isDraggingMap ? 26 : 9.5;
      const lerpFactor = 1 - Math.exp(-dt * smoothSpeed);
      cam.zoom += (cam.targetZoom - cam.zoom) * lerpFactor;
      if (Math.abs(cam.targetZoom - cam.zoom) < 0.001) {
        cam.zoom = cam.targetZoom;
      }
      cam.x += (cam.targetX - cam.x) * lerpFactor;
      cam.y += (cam.targetY - cam.y) * lerpFactor;
      if (!isDraggingMap && cam.focusMode !== 'follow') {
        const clampedCurrent = clampCameraCenter(cam.x, cam.y, cam.zoom, vp);
        cam.x = clampedCurrent.x;
        cam.y = clampedCurrent.y;
      }

      const zoomPercent = Math.round(cam.targetZoom * 100);
      const nextCameraUiKey = `${zoomPercent}:${cam.focusMode}:${cam.activePreset ?? 'custom'}`;
      if (nextCameraUiKey !== lastCameraUiKeyRef.current) {
        lastCameraUiKeyRef.current = nextCameraUiKey;
        propsRef.current.onCameraChange?.({
          zoomPercent,
          focusMode: cam.focusMode,
          activePreset: cam.activePreset,
        });
      }

      // 2-second hover object inspection (currently active for bathroom objects)
      let inspectHover: InspectHoverRenderState | null = null;
      const canInspect =
        (state === 'PLAYING' || state === 'WORKING') &&
        !modalOpen &&
        !dragStateRef.current.isDragging &&
        hoverPointerRef.current.inside;

      if (canInspect) {
        const { vx: pVx, vy: pVy } = hoverPointerRef.current;
        const { wx, wy } = viewportToWorld(pVx, pVy, cam.x, cam.y, cam.zoom, vp);
        const hitInspectable = getInspectableAtPoint(wx, wy);

        if (hitInspectable) {
          if (inspectDwellRef.current.objectId === hitInspectable.id) {
            inspectDwellRef.current.elapsed += dt;
          } else {
            inspectDwellRef.current = {
              objectId: hitInspectable.id,
              elapsed: 0,
              revealed: false,
            };
          }

          const elapsed = inspectDwellRef.current.elapsed;
          const revealed = elapsed >= INSPECT_REVEAL_DELAY;
          inspectDwellRef.current.revealed = revealed;

          const progress =
            elapsed <= INSPECT_HINT_DELAY
              ? 0
              : Math.min(
                  1,
                  (elapsed - INSPECT_HINT_DELAY) / (INSPECT_REVEAL_DELAY - INSPECT_HINT_DELAY)
                );

          inspectHover = {
            object: hitInspectable,
            progress,
            revealed,
            pointerVx: pVx,
            pointerVy: pVy,
          };

          if (revealed) {
            const scale = cam.zoom * vp.baseScale;
            const objCenterVx = vp.viewW / 2 + (hitInspectable.x + hitInspectable.w / 2 - cam.x) * scale;
            const objTopVy = vp.viewH / 2 + (hitInspectable.y - cam.y) * scale;
            const objBotVy = vp.viewH / 2 + (hitInspectable.y + hitInspectable.h - cam.y) * scale;
            const preferBelow = objTopVy < 96;
            const anchorVy = preferBelow ? objBotVy + 10 : objTopVy - 10;
            const normX = Math.max(0.14, Math.min(0.86, objCenterVx / vp.viewW));
            const normY = Math.max(0.06, Math.min(0.94, anchorVy / vp.viewH));
            const nextKey = `${hitInspectable.id}:${Math.round(normX * 200)}:${Math.round(normY * 200)}:${preferBelow ? 1 : 0}`;
            if (nextKey !== lastRevealedInspectKeyRef.current) {
              lastRevealedInspectKeyRef.current = nextKey;
              setRevealedInspect({
                object: hitInspectable,
                normX,
                normY,
                preferBelow,
              });
            }
          } else if (lastRevealedInspectKeyRef.current !== '') {
            lastRevealedInspectKeyRef.current = '';
            setRevealedInspect(null);
          }
        } else {
          inspectDwellRef.current = { objectId: null, elapsed: 0, revealed: false };
          if (lastRevealedInspectKeyRef.current !== '') {
            lastRevealedInspectKeyRef.current = '';
            setRevealedInspect(null);
          }
        }
      } else {
        inspectDwellRef.current = { objectId: null, elapsed: 0, revealed: false };
        if (lastRevealedInspectKeyRef.current !== '') {
          lastRevealedInspectKeyRef.current = '';
          setRevealedInspect(null);
        }
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        const nearest =
          state === 'PLAYING' && !modalOpen && !player.isSitting
            ? getEffectiveNearestInteractable(
                player,
                mina,
                greenCar,
                agyEngagedRef.current,
                aiStudioEngagedRef.current
              )
            : null;
        renderHouseScene(ctx, {
          player,
          mina,
          antigravityNpc: agyNpcRef.current,
          aiStudioNpc: aiStudioNpcRef.current,
          deliveryBubble: activeDeliveryRef.current
            ? {
                assistantId: activeDeliveryRef.current.assistantId,
                text: activeDeliveryRef.current.bubbleText,
              }
            : null,
          greenCar,
          extraPinCount: pinCount,
          pinboardGlowTick: pinboardGlowTickRef.current,
          timeOfDay: tod,
          assistantMood: mood,
          minaBubbleText: bubble,
          nearestInteractable: nearest,
          clickTarget: clickMarkerRef.current,
          tick,
          isWorking: state === 'WORKING',
          isTvOn: tvOn,
          isDriveOpen: propsRef.current.isDriveOpen,
          isAntigravityOpen: propsRef.current.isAntigravityOpen,
          isAiStudioOpen: propsRef.current.isAiStudioOpen,
          isMailboxOpen: propsRef.current.isMailboxOpen,
          mailboxUnreadCount: propsRef.current.mailboxUnreadCount,
          mailboxFreshArrival: propsRef.current.mailboxFreshArrival,
          isSleepLogOpen: propsRef.current.isSleepLogOpen,
          hasLoggedTodaySleep: propsRef.current.hasLoggedTodaySleep,
          todaySleepLabel: propsRef.current.todaySleepLabel,
          hasWateredPlantsToday: propsRef.current.hasWateredPlantsToday,
          todayPlantWaterLabel: propsRef.current.todayPlantWaterLabel,
          plantWateringProgress: plantWateringAnimRef.current.active
            ? Math.min(
                0.999,
                plantWateringAnimRef.current.elapsed / plantWateringAnimRef.current.duration
              )
            : 0,
          characterStatuses: propsRef.current.characterStatuses,
          camera: { x: cam.x, y: cam.y, zoom: cam.zoom },
          inspectHover,
          viewW: vp.viewW,
          viewH: vp.viewH,
          baseScale: vp.baseScale,
        });
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Left-click (or middle-click) and drag anywhere on the canvas to pull/pan the map;
  // releasing the mouse button smoothly snaps focus back to the player character.
  // Short clicks (< dragThreshold) still walk or interact normally via handleCanvasClick.
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (document.activeElement instanceof HTMLButtonElement) {
      document.activeElement.blur();
    }
    if (propsRef.current.isModalOpen) return;
    if (e.button !== 0 && e.button !== 1) return;

    const cam = cameraRef.current;

    dragStateRef.current = {
      pointerId: e.pointerId,
      button: e.button,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCamX: cam.x,
      startCamY: cam.y,
      isDragging: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const vp = getViewportMetrics(propsRef.current.isFullscreenMap, dynamicViewRef.current);
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        hoverPointerRef.current = {
          inside: true,
          vx: ((e.clientX - rect.left) / rect.width) * vp.viewW,
          vy: ((e.clientY - rect.top) / rect.height) * vp.viewH,
        };
      }
    }

    const drag = dragStateRef.current;
    if (drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    const cam = cameraRef.current;
    const dragThreshold = 6;

    if (!drag.isDragging && Math.hypot(dx, dy) >= dragThreshold) {
      drag.isDragging = true;
      suppressNextClickRef.current = true;
      setIsPanningUi(true);
      if (propsRef.current.isMinaMenuOpen) {
        propsRef.current.onDismissMinaMenu();
      }
    }

    if (drag.isDragging) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const scale = cam.zoom * vp.baseScale;
      const worldDx = ((dx / rect.width) * vp.viewW) / scale;
      const worldDy = ((dy / rect.height) * vp.viewH) / scale;
      const marginX = WORLD_W * 0.25;
      const marginY = WORLD_H * 0.25;
      cam.targetX = Math.max(-marginX, Math.min(WORLD_W + marginX, drag.startCamX - worldDx));
      cam.targetY = Math.max(-marginY, Math.min(WORLD_H + marginY, drag.startCamY - worldDy));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    if (drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const wasDragging = drag.isDragging;
    drag.pointerId = null;
    drag.isDragging = false;
    if (wasDragging) {
      setIsPanningUi(false);
      // Smoothly return camera focus back to the player character upon mouse release
      const cam = cameraRef.current;
      cam.focusMode = 'follow';
      cam.activePreset = 'follow';
    }
  };

  const handlePointerLeave = () => {
    hoverPointerRef.current.inside = false;
  };

  // Right-click on open floor/map to glide camera focus directly to that exact spot
  // (in follow mode, accidental right-clicks over interactables or Mina do not cancel follow focus)
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (propsRef.current.isModalOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const vp = getViewportMetrics(propsRef.current.isFullscreenMap, dynamicViewRef.current);
    const vx = ((e.clientX - rect.left) / rect.width) * vp.viewW;
    const vy = ((e.clientY - rect.top) / rect.height) * vp.viewH;
    const cam = cameraRef.current;
    const { wx, wy } = viewportToWorld(vx, vy, cam.x, cam.y, cam.zoom, vp);

    if (cam.focusMode === 'follow') {
      const mina = minaRef.current;
      const hitInteractable = Boolean(getInteractableAtPoint(wx, wy));
      const hitMina = Math.hypot(wx - mina.x, wy - (mina.y - 8)) <= 24;
      if (hitInteractable || hitMina) {
        return;
      }
    }

    if (propsRef.current.isMinaMenuOpen) {
      propsRef.current.onDismissMinaMenu();
    }

    cam.focusMode = 'free';
    cam.activePreset = null;
    if (cam.targetZoom < 0.9) {
      cam.targetZoom = 1.15;
    }
    const clamped = clampCameraCenter(wx, wy, cam.targetZoom, vp);
    cam.targetX = clamped.x;
    cam.targetY = clamped.y;
  };

  // Click-to-move and click-to-interact handler (projected through live 2D camera transform)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    if (propsRef.current.isModalOpen) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const vp = getViewportMetrics(propsRef.current.isFullscreenMap, dynamicViewRef.current);
    const vx = ((e.clientX - rect.left) / rect.width) * vp.viewW;
    const vy = ((e.clientY - rect.top) / rect.height) * vp.viewH;
    const cam = cameraRef.current;
    const { wx, wy } = viewportToWorld(vx, vy, cam.x, cam.y, cam.zoom, vp);

    // Ignore clicks landing on the dark margin outside the house perimeter
    if (wx < 0 || wx > WORLD_W || wy < 0 || wy > WORLD_H) {
      return;
    }

    const clickedObj = getInteractableAtPoint(wx, wy);

    // Roadside Mailbox (or its floating incoming Gmail badge) can always be clicked directly to open & read immediately
    const clickedMailboxBadge =
      (propsRef.current.mailboxUnreadCount ?? 0) > 0 &&
      wx >= MAILBOX_RECT.x - 16 &&
      wx <= MAILBOX_RECT.x + MAILBOX_RECT.w + 16 &&
      wy >= MAILBOX_RECT.y - 44 &&
      wy <= MAILBOX_RECT.y + MAILBOX_RECT.h + 6;
    if (
      (clickedObj?.id === 'mailbox' || clickedMailboxBadge) &&
      (propsRef.current.gameState === 'PLAYING' || propsRef.current.gameState === 'WORKING')
    ) {
      if (propsRef.current.isMinaMenuOpen) {
        propsRef.current.onDismissMinaMenu();
      }
      propsRef.current.onInteract('mailbox');
      return;
    }

    // Master Bedroom Daily Sleep Quest Station (or its floating badge) can also be clicked directly
    const clickedSleepBadge =
      wx >= SLEEP_STATION_RECT.x - 28 &&
      wx <= SLEEP_STATION_RECT.x + SLEEP_STATION_RECT.w + 28 &&
      wy >= SLEEP_STATION_RECT.y - 34 &&
      wy <= SLEEP_STATION_RECT.y + SLEEP_STATION_RECT.h + 6;
    if (
      (clickedObj?.id === 'sleep_log' || clickedSleepBadge) &&
      (propsRef.current.gameState === 'PLAYING' || propsRef.current.gameState === 'WORKING')
    ) {
      if (propsRef.current.isMinaMenuOpen) {
        propsRef.current.onDismissMinaMenu();
      }
      propsRef.current.onInteract('sleep_log');
      return;
    }

    // Allow clicking office stations directly while conversing with Mina
    if (propsRef.current.gameState === 'WORKING') {
      if (
        clickedObj?.id === 'pinboard' ||
        clickedObj?.id === 'drive_table' ||
        clickedObj?.id === 'antigravity_desk' ||
        clickedObj?.id === 'ai_studio_desk'
      ) {
        propsRef.current.onInteract(clickedObj.id);
      }
      return;
    }

    if (propsRef.current.gameState !== 'PLAYING') {
      return;
    }

    const player = playerRef.current;
    const mina = minaRef.current;

    const clickedMina = Math.hypot(wx - mina.x, wy - (mina.y - 8)) <= 24;
    const clickedMinaStation = clickedMina || clickedObj?.id === 'mina_desk';

    // When clicking Mina while she is seated working at her computer desk,
    // open the 2-option choice menu projected accurately onto the current camera viewport
    if (clickedMinaStation && mina.phase === 'working_at_desk') {
      soundEngine.playInteract();
      propsRef.current.onRequestMinaMenu(worldToViewportNorm(mina.x, mina.y, cam, vp));
      return;
    }

    // Clicking anywhere else dismisses the Mina choice menu if open
    if (propsRef.current.isMinaMenuOpen) {
      propsRef.current.onDismissMinaMenu();
    }

    // If Mina is already walking over in Mode 1 and user clicks her again, open chat immediately while she walks
    if (clickedMina && mina.phase === 'summoned_to_player') {
      minaSummonModeRef.current = 'chat_then_walk';
      propsRef.current.onInteract('mina_desk');
      return;
    }

    const clickedGreenCar = isPointInsideCar(wx, wy, greenCarRef.current, 10);

    // Handle clicks while seated on personal workdesk, Living Room sofa, Kitchen dining chairs, or driving the green car
    if (player.isSitting) {
      if (player.seat === 'green_car') {
        // While driving, clicking the car parks & exits cleanly; stray floor clicks won't accidentally eject the driver
        if (clickedGreenCar) {
          const car = greenCarRef.current;
          car.isDriving = false;
          car.speed = 0;
          car.braking = false;
          car.reversing = false;
          car.steerAngle = 0;
          const exitPos = findSafeCarExitPos(car);
          player.isSitting = false;
          player.seat = null;
          player.x = exitPos.x;
          player.y = exitPos.y;
          player.facing = 'down';
          soundEngine.playInteract();
          propsRef.current.onStandUp();
        }
        return;
      }
      if (player.seat === 'sofa' && clickedObj?.id === 'tv') {
        propsRef.current.onInteract('tv');
        return;
      }
      if (player.seat === 'workdesk' && clickedObj?.id === 'pinboard') {
        propsRef.current.onInteract('pinboard');
        return;
      }
      if (isDiningChairSeatId(player.seat) && clickedObj?.id === 'dining_table') {
        propsRef.current.onInteract('dining_table');
        return;
      }
      const prevSeat = player.seat;
      player.isSitting = false;
      player.seat = null;
      player.sofaActivity = null;
      player.sofaActivityElapsed = 0;
      if (prevSeat === 'workdesk') {
        player.x = WORK_STAND_POS.x;
        player.y = WORK_STAND_POS.y;
        player.facing = 'down';
      } else if (prevSeat === 'sofa') {
        player.x = SOFA_STAND_POS.x;
        player.y = SOFA_STAND_POS.y;
        player.facing = 'down';
      } else if (prevSeat === 'bedroom_bed') {
        player.x = BEDROOM_BED_STAND_POS.x;
        player.y = BEDROOM_BED_STAND_POS.y;
        player.facing = 'right';
      } else if (isDiningChairSeatId(prevSeat)) {
        const spot = DINING_CHAIR_SPOTS[prevSeat];
        player.x = spot.standPos.x;
        player.y = spot.standPos.y;
        player.facing = prevSeat === 'dining_chair_nw' || prevSeat === 'dining_chair_ne' ? 'up' : 'down';
      }
      propsRef.current.onStandUp();
      // Clicking the same seat again simply stands the player up
      if (clickedObj?.id === prevSeat) {
        return;
      }
    }

    // Clicking the parked green car: get in immediately if close, else walk smoothly beside the door and get in
    if (clickedGreenCar) {
      const car = greenCarRef.current;
      const distToCar = Math.hypot(player.x - car.x, player.y - car.y);
      if (distToCar <= 92) {
        propsRef.current.onInteract('green_car');
        return;
      }
      const doorSpot = findSafeCarExitPos(car);
      waypointsRef.current = findWalkablePath(player.x, player.y, doorSpot.x, doorSpot.y);
      pendingInteractRef.current = 'green_car';
      clickMarkerRef.current = { x: doorSpot.x, y: doorSpot.y, ttl: 35 };
      return;
    }

    // Clicking Mina when she is already standing near her desk
    if (clickedMinaStation) {
      if (isPlayerInsideMinaRadius(player, mina)) {
        propsRef.current.onInteract('mina_desk');
        return;
      }
      const targetSpot = {
        x: MINA_POS.x - 1.35 * TILE,
        y: MINA_POS.y,
      };
      waypointsRef.current = findWalkablePath(player.x, player.y, targetSpot.x, targetSpot.y);
      pendingInteractRef.current = 'mina_desk';
      clickMarkerRef.current = { x: targetSpot.x, y: targetSpot.y, ttl: 35 };
      return;
    }

    // Clicking Antigravity station or NPC sprite: open only if inside tight radius, else walk up to AGY_STAND_POS
    const clickedAgy = Math.hypot(wx - AGY_POS.x, wy - (AGY_POS.y - 8)) <= 24;
    if (clickedAgy || clickedObj?.id === 'antigravity_desk') {
      if (isPlayerInsideAgyRadius(player, agyEngagedRef.current)) {
        propsRef.current.onInteract('antigravity_desk');
        return;
      }
      const path = findWalkablePath(player.x, player.y, AGY_STAND_POS.x, AGY_STAND_POS.y);
      waypointsRef.current = path;
      pendingInteractRef.current = 'antigravity_desk';
      clickMarkerRef.current = { x: AGY_STAND_POS.x, y: AGY_STAND_POS.y, ttl: 35 };
      return;
    }

    // Clicking Google AI Studio station or NPC sprite: open only if inside tight radius, else walk up to AISTUDIO_STAND_POS
    const clickedAiStudio = Math.hypot(wx - AISTUDIO_POS.x, wy - (AISTUDIO_POS.y - 8)) <= 24;
    if (clickedAiStudio || clickedObj?.id === 'ai_studio_desk') {
      if (isPlayerInsideAiStudioRadius(player, aiStudioEngagedRef.current)) {
        propsRef.current.onInteract('ai_studio_desk');
        return;
      }
      const path = findWalkablePath(player.x, player.y, AISTUDIO_STAND_POS.x, AISTUDIO_STAND_POS.y);
      waypointsRef.current = path;
      pendingInteractRef.current = 'ai_studio_desk';
      clickMarkerRef.current = { x: AISTUDIO_STAND_POS.x, y: AISTUDIO_STAND_POS.y, ttl: 35 };
      return;
    }

    const clickedPlantBadge =
      wx >= PORCH_PLANTER_RECT.x - 24 &&
      wx <= PORCH_PLANTER_RECT.x + PORCH_PLANTER_RECT.w + 24 &&
      wy >= PORCH_PLANTER_RECT.y - 32 &&
      wy <= PORCH_PLANTER_RECT.y + PORCH_PLANTER_RECT.h + 6;
    const effectiveClickedObj =
      clickedObj ??
      (clickedPlantBadge
        ? INTERACTABLES.find((item) => item.id === 'porch_plants') ?? null
        : null);

    if (effectiveClickedObj) {
      const dist = Math.hypot(
        player.x - (effectiveClickedObj.x + effectiveClickedObj.w / 2),
        player.y - (effectiveClickedObj.y + effectiveClickedObj.h / 2)
      );
      if (
        dist <= effectiveClickedObj.interactRadius + 16 ||
        (effectiveClickedObj.id === 'pinboard' && getRoomZone(player.x, player.y) === 'office')
      ) {
        propsRef.current.onInteract(effectiveClickedObj.id);
        return;
      }

      // Walk to a clear spot in front of the clicked interactable using obstacle-free A* pathfinding
      const targetSpot =
        effectiveClickedObj.id === 'workdesk'
          ? { x: WORK_STAND_POS.x, y: WORK_STAND_POS.y }
          : effectiveClickedObj.id === 'sofa'
            ? { x: SOFA_STAND_POS.x, y: SOFA_STAND_POS.y }
            : effectiveClickedObj.id === 'bedroom_bed'
              ? { x: BEDROOM_BED_STAND_POS.x, y: BEDROOM_BED_STAND_POS.y }
              : effectiveClickedObj.id === 'porch_plants'
                ? { x: PORCH_PLANTER_STAND_POS.x, y: PORCH_PLANTER_STAND_POS.y }
                : isDiningChairSeatId(effectiveClickedObj.id)
                  ? {
                      x: DINING_CHAIR_SPOTS[effectiveClickedObj.id].standPos.x,
                      y: DINING_CHAIR_SPOTS[effectiveClickedObj.id].standPos.y,
                    }
                  : effectiveClickedObj.id === 'dining_table'
                    ? {
                        x: effectiveClickedObj.x + effectiveClickedObj.w / 2,
                        y:
                          player.y < effectiveClickedObj.y + effectiveClickedObj.h / 2
                            ? effectiveClickedObj.y - 24
                            : effectiveClickedObj.y + effectiveClickedObj.h + 24,
                      }
                    : effectiveClickedObj.id === 'pinboard'
                      ? { x: MINA_PINBOARD_SPOT.x, y: 2.85 * TILE }
                      : effectiveClickedObj.id === 'drive_table'
                        ? {
                            x: effectiveClickedObj.x + effectiveClickedObj.w / 2,
                            y:
                              player.y < effectiveClickedObj.y + effectiveClickedObj.h / 2
                                ? effectiveClickedObj.y - 18
                                : effectiveClickedObj.y + effectiveClickedObj.h + 18,
                          }
                        : effectiveClickedObj.id === 'tv'
                          ? {
                              x: effectiveClickedObj.x + effectiveClickedObj.w / 2,
                              y: effectiveClickedObj.y - 22,
                            }
                          : {
                              x: effectiveClickedObj.x + effectiveClickedObj.w / 2,
                              y: Math.min(11 * TILE, effectiveClickedObj.y + effectiveClickedObj.h + 18),
                            };

      const path = findWalkablePath(player.x, player.y, targetSpot.x, targetSpot.y);
      waypointsRef.current = path;
      pendingInteractRef.current = effectiveClickedObj.id;
      clickMarkerRef.current = { x: targetSpot.x, y: targetSpot.y, ttl: 35 };
      return;
    }

    // Clamp clicked floor target inside playable neighborhood lot (6 rooms, porch, sidewalk & front road)
    // Clicking inside the NW bathroom shower wet-zone routes directly to the automatic shower spot
    const clickedInShower = isPointInShowerWetZone(wx, wy);
    const clampedX = clickedInShower
      ? SHOWER_STAND_POS.x
      : Math.max(0.65 * TILE, Math.min((MAP_COLS - 0.65) * TILE, wx));
    const clampedY = clickedInShower
      ? SHOWER_STAND_POS.y
      : Math.max(2.35 * TILE, Math.min((MAP_ROWS - 0.55) * TILE, wy));
    const path = findWalkablePath(player.x, player.y, clampedX, clampedY);
    waypointsRef.current = path;
    pendingInteractRef.current = null;
    clickMarkerRef.current = { x: clampedX, y: clampedY, ttl: 35 };
  };

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        onClick={handleCanvasClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
        aria-label="แผนที่บ้านจำลอง 2D ห้องนอนใหญ่ ห้องพักผ่อน ห้องทำงาน ห้องออกกำลังกาย ห้องน้ำ ห้องครัว โถงทางเข้า ทางเดินหน้าบ้าน โรงจอดรถ 2 คัน และถนนหน้าบ้าน"
        className={`pixelated block h-full w-full touch-none select-none bg-[#1B1612] ${
          isFullscreenMap ? 'rounded-none border-0' : 'rounded-xl border border-[#3B3129] shadow-2xl'
        } ${isPanningUi ? 'cursor-grabbing' : 'cursor-pointer'}`}
      />

      {revealedInspect && !isModalOpen && (
        <div
          role="tooltip"
          style={{
            left: `${(revealedInspect.normX * 100).toFixed(2)}%`,
            top: `${(revealedInspect.normY * 100).toFixed(2)}%`,
          }}
          className={`pointer-events-none absolute z-20 w-max max-w-[236px] -translate-x-1/2 select-none rounded-lg border border-[#5B7571] bg-[#1E1A17]/95 px-3 py-2 text-left shadow-xl backdrop-blur-xs ${
            revealedInspect.preferBelow ? 'translate-y-0' : '-translate-y-full'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-[#99E2D0]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#99E2D0]" />
            <span>{revealedInspect.object.areaLabel}</span>
          </div>
          <div className="font-display mt-0.5 text-xs font-semibold text-[#FAF6F0]">
            {revealedInspect.object.name}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-[#CFC4B6]">
            {revealedInspect.object.detail}
          </p>
        </div>
      )}
    </div>
  );
}
