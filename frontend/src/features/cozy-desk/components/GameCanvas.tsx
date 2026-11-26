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
import { soundEngine } from '../lib/sound';

import { useCanvasCommandEffects } from '../hooks/useCanvasCommandEffects';
import { stepMinaNpcSimulation } from '../game/minaNpcSimulation';
import { createCanvasPointerHandlers } from '../game/canvasPointerController';

import { stepGameCanvasFrame } from '../game/gameLoopStep';
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
  clockAnnouncement?: { title: string; startTimeLabel: string; triggeredAt: number } | null;
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
  onWorkoutRepsChange?: (reps: number) => void;
}

import {
  buildMinaReturnToDeskPath,
  buildMinaToPinboardPath,
  type CameraInternalState,
  clampCameraCenter,
  clampZoom,
  createShuffledSofaBag,
  faceToward,
  getEffectiveNearestInteractable,
  getViewportMetrics,
  INSPECT_HINT_DELAY,
  INSPECT_REVEAL_DELAY,
  isPlayerInsideAgyRadius,
  isPlayerInsideAiStudioRadius,
  isPlayerInsideMinaRadius,
  MINA_MIN_OFFICE_X,
  MINA_MOVE_SPEED,
  MINA_PIN_DURATION,
  MINA_SUMMON_SPEED,
  MOVE_SPEED,
  randomSofaActivityDuration,
  viewportToWorld,
  worldToViewportNorm,
} from '../game/cameraAndProximity';
import {
  stepGreenCarDriving,
  stepPlayerShowerCycle,
  stepRovingAssistantNpc,
} from '../game/simulationStep';

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
  onWorkoutRepsChange,
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
    workoutElapsed: 0,
    workoutReps: 0,
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
  const lastWorkoutRepsRef = useRef(0);
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
    onWorkoutRepsChange,
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
    onWorkoutRepsChange,
  };

  useCanvasCommandEffects({
    containerRef,
    canvasRef,
    dynamicViewRef,
    setCanvasSize,
    setIsPanningUi,
    isFullscreenMap,
    cameraCommand,
    lastCameraCommandIdRef,
    cameraRef,
    propsRef,
    playerRef,
    minaMission,
    lastMissionIdRef,
    activeMissionTitleRef,
    minaPinTimerRef,
    minaPinnedNotifiedRef,
    minaReturningFromMissionRef,
    minaRef,
    minaWaypointsRef,
    minaSummonModeRef,
    minaSummonTargetRef,
    minaSummonRepathTimerRef,
    minaSummonCommand,
    lastSummonIdRef,
    greenCarRef,
    waypointsRef,
    pendingInteractRef,
    keysRef,
    deliveryWalkCommand,
    lastDeliveryCmdIdRef,
    activeDeliveryRef,
    agyNpcRef,
    aiStudioNpcRef,
    agyWaypointsRef,
    aiStudioWaypointsRef,
    agyTargetRef,
    aiStudioTargetRef,
    agyRepathTimerRef,
    aiStudioRepathTimerRef,
    isModalOpen,
    dragStateRef,
    suppressNextClickRef,
    playerSeat,
    pickNextSofaActivity,
    gameState,
    agyEngagedRef,
    aiStudioEngagedRef,
    hoverPointerRef,
    plantWateringTriggerId,
    lastPlantWaterTriggerRef,
    plantWateringAnimRef,
  });

  // Main 60fps update + render loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let tick = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      tick += 1;
      stepGameCanvasFrame({
        plantWateringAnimRef,
        propsRef,
        playerRef,
        minaRef,
        greenCarRef,
        wrapToastCooldownRef,
        keysRef,
        waypointsRef,
        pendingInteractRef,
        agyEngagedRef,
        aiStudioEngagedRef,
        currentZoneRef,
        cameraRef,
        lastDrivingHudKeyRef,
        lastWorkoutRepsRef,
        pickNextSofaActivity,
        sofaRemoteClickedRef,
        sofaActivityDurationRef,
        minaWaypointsRef,
        minaReturningFromMissionRef,
        minaSummonModeRef,
        minaSummonTargetRef,
        minaSummonRepathTimerRef,
        minaPinTimerRef,
        minaPinnedNotifiedRef,
        pinboardGlowTickRef,
        activeDeliveryRef,
        activeMissionTitleRef,
        agyNpcRef,
        agyWaypointsRef,
        agyTargetRef,
        agyRepathTimerRef,
        aiStudioNpcRef,
        aiStudioWaypointsRef,
        aiStudioTargetRef,
        aiStudioRepathTimerRef,
        nearestKeyRef,
        clickMarkerRef,
        dynamicViewRef,
        dragStateRef,
        lastCameraUiKeyRef,
        hoverPointerRef,
        inspectDwellRef,
        lastRevealedInspectKeyRef,
        setRevealedInspect,
        canvasRef,
      }, dt, tick);
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handleContextMenu,
    handleCanvasClick,
  } = createCanvasPointerHandlers({
    propsRef,
    cameraRef,
    dragStateRef,
    dynamicViewRef,
    canvasRef,
    hoverPointerRef,
    suppressNextClickRef,
    setIsPanningUi,
    minaRef,
    playerRef,
    minaSummonModeRef,
    greenCarRef,
    waypointsRef,
    pendingInteractRef,
    clickMarkerRef,
    agyEngagedRef,
    aiStudioEngagedRef,
  });

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
