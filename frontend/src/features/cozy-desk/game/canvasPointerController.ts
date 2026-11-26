import type React from 'react';
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
  GYM_SQUAT_RACK_STAND_POS,
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
import {
  clampCameraCenter,
  getViewportMetrics,
  isPlayerInsideAgyRadius,
  isPlayerInsideAiStudioRadius,
  isPlayerInsideMinaRadius,
  viewportToWorld,
  worldToViewportNorm,
} from './cameraAndProximity';


export function createCanvasPointerHandlers(ctx: any) {
  const {
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
  } = ctx;

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
      player.workoutElapsed = 0;
      player.workoutReps = 0;
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
      } else if (prevSeat === 'gym_barbell') {
        player.x = GYM_SQUAT_RACK_STAND_POS.x;
        player.y = GYM_SQUAT_RACK_STAND_POS.y;
        player.facing = 'down';
        soundEngine.playBarbellRack();
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
                : effectiveClickedObj.id === 'gym_barbell'
                  ? { x: GYM_SQUAT_RACK_STAND_POS.x, y: GYM_SQUAT_RACK_STAND_POS.y }
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

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handleContextMenu,
    handleCanvasClick,
  };
}
