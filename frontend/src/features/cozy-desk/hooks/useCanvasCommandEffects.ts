import { useEffect } from 'react';
import {
  BEDROOM_BED_SEAT_POS,
  BEDROOM_BED_STAND_POS,
  CAMERA_BASE_SCALE,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  collidesWithWorld,
  DINING_CHAIR_SPOTS,
  findSafeCarExitPos,
  isDiningChairSeatId,
  MINA_GREET_STOP_DIST,
  MINA_PINBOARD_SPOT,
  PORCH_PLANTER_RECT,
  PORCH_PLANTER_STAND_POS,
  ROOM_CAMERA_TARGETS,
  SOFA_SEAT_POS,
  SOFA_STAND_POS,
  VIEW_H,
  VIEW_W,
  WORK_SEAT_POS,
  WORK_STAND_POS,
  WORLD_H,
  WORLD_W,
} from '../game/houseMap';
import {
  buildMinaToPinboardPath,
  clampCameraCenter,
  clampZoom,
  faceToward,
  getEffectiveNearestInteractable,
  getViewportMetrics,
  viewportToWorld,
} from '../game/cameraAndProximity';
import { findMeetingPathForMina, findWalkablePath } from '../game/pathfinding';
import { soundEngine } from '../lib/sound';


export function useCanvasCommandEffects(ctx: any) {
  const {
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
  } = ctx;

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

}
