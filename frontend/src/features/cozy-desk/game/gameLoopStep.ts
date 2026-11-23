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
import {
  clampCameraCenter,
  faceToward,
  getEffectiveNearestInteractable,
  getViewportMetrics,
  INSPECT_HINT_DELAY,
  INSPECT_REVEAL_DELAY,
  isPlayerInsideAgyRadius,
  isPlayerInsideAiStudioRadius,
  MOVE_SPEED,
  viewportToWorld,
} from './cameraAndProximity';
import {
  stepGreenCarDriving,
  stepPlayerShowerCycle,
  stepRovingAssistantNpc,
} from './simulationStep';
import { stepMinaNpcSimulation } from './minaNpcSimulation';


export function stepGameCanvasFrame(stateCtx: any, dt: number, tick: number) {
  const {
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
  } = stateCtx;


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

        stepPlayerShowerCycle(player, keys, vx, waypointsRef, dt);
      }

      if (state === 'PLAYING' && !modalOpen && player.isSitting && player.seat === 'green_car') {
        stepGreenCarDriving(greenCar, keysRef.current, dt);

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

      stepMinaNpcSimulation({
        state,
        modalOpen,
        player,
        mina,
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
        propsRef,
      }, dt);

      stepRovingAssistantNpc(
        'antigravity',
        agyNpcRef.current,
        player,
        agyWaypointsRef,
        agyTargetRef,
        agyRepathTimerRef,
        AGY_POS,
        'left',
        Boolean(propsRef.current.isAntigravityOpen),
        activeDeliveryRef,
        propsRef.current.onAssistantDeliveryArrived,
        dt
      );
      stepRovingAssistantNpc(
        'ai_studio',
        aiStudioNpcRef.current,
        player,
        aiStudioWaypointsRef,
        aiStudioTargetRef,
        aiStudioRepathTimerRef,
        AISTUDIO_POS,
        'down',
        Boolean(propsRef.current.isAiStudioOpen),
        activeDeliveryRef,
        propsRef.current.onAssistantDeliveryArrived,
        dt
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

}
