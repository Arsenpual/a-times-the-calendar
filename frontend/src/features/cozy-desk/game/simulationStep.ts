import type {
  GreenCarState,
  PlayerState,
  RovingAssistantNpcState,
  TaskAssistantId,
} from '../types/game';
import {
  carCollidesWithWorld,
  collidesWithWorld,
  isPointInShowerWetZone,
  SHOWER_STAND_POS,
  TILE,
} from './houseMap';
import { findMeetingPathForMina, findWalkablePath } from './pathfinding';
import { faceToward, MINA_MOVE_SPEED, MINA_SUMMON_SPEED } from './cameraAndProximity';
import { soundEngine } from '../lib/sound';

export function stepPlayerShowerCycle(
  player: PlayerState,
  keys: Set<string>,
  vx: number,
  waypointsRef: { current: Array<{ x: number; y: number }> },
  dt: number
) {
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

export function stepGreenCarDriving(
  greenCar: GreenCarState,
  keys: Set<string>,
  dt: number
) {
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
}

export function stepRovingAssistantNpc(
  assistantId: 'antigravity' | 'ai_studio',
  npc: RovingAssistantNpcState,
  player: PlayerState,
  wpRef: { current: Array<{ x: number; y: number }> },
  targetRef: { current: { x: number; y: number } | null },
  repathRef: { current: number },
  homePos: { x: number; y: number },
  homeFacing: 'left' | 'down',
  isChatOpen: boolean,
  activeDeliveryRef: { current: { id: number; assistantId: TaskAssistantId; bubbleText: string } | null },
  onAssistantDeliveryArrived: ((commandId: number, assistantId: TaskAssistantId) => void) | undefined,
  dt: number
) {
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
        onAssistantDeliveryArrived?.(deliveredCmdId, assistantId);
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
}
