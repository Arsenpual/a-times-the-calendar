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
  buildMinaReturnToDeskPath,
  faceToward,
  MINA_MIN_OFFICE_X,
  MINA_MOVE_SPEED,
  MINA_PIN_DURATION,
  MINA_SUMMON_SPEED,
} from './cameraAndProximity';


export function stepMinaNpcSimulation(ctx: any, dt: number) {
  const {
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
  } = ctx;

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

}
