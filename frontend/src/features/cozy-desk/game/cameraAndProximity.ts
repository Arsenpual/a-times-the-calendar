import type {
  CameraFocusMode,
  CameraPresetId,
  GreenCarState,
  InteractableObject,
  MinaNpcState,
  PlayerState,
  SofaActivity,
} from '../types/game';
import {
  AGY_APPROACH_RADIUS,
  AGY_LEAVE_RADIUS,
  AGY_POS,
  AISTUDIO_APPROACH_RADIUS,
  AISTUDIO_LEAVE_RADIUS,
  AISTUDIO_POS,
  CAMERA_BASE_SCALE,
  CAMERA_MAX_ZOOM,
  DIVIDER_COL,
  findNearestInteractable,
  getGreenCarInteractable,
  getRoomZone,
  INTERACTABLES,
  MINA_APPROACH_RADIUS,
  MINA_LEAVE_RADIUS,
  MINA_PINBOARD_SPOT,
  MINA_POS,
  TILE,
  VIEW_H,
  VIEW_W,
  WORLD_H,
  WORLD_W,
} from './houseMap';
import { findWalkablePath } from './pathfinding';

export interface CameraInternalState {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
  focusMode: CameraFocusMode;
  activePreset: CameraPresetId | null;
}

export interface ViewportMetrics {
  viewW: number;
  viewH: number;
  baseScale: number;
  minZoom: number;
}

export function getViewportMetrics(
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

export function clampZoom(z: number, vp: ViewportMetrics): number {
  return Math.max(vp.minZoom, Math.min(CAMERA_MAX_ZOOM, z));
}

export function clampCameraCenter(
  x: number,
  y: number,
  zoom: number,
  vp: ViewportMetrics
): { x: number; y: number } {
  const scale = zoom * vp.baseScale;
  const halfW = vp.viewW / (2 * scale);
  const halfH = vp.viewH / (2 * scale);

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

export function viewportToWorld(
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

export function worldToViewportNorm(
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

export const MOVE_SPEED = 128;
export const MINA_MOVE_SPEED = 98;
export const MINA_SUMMON_SPEED = 118;
export const MINA_PIN_DURATION = 2.1;
export const MINA_MIN_OFFICE_X = (DIVIDER_COL + 1.35) * TILE;
export const INSPECT_HINT_DELAY = 0.35;
export const INSPECT_REVEAL_DELAY = 2.0;

export const MINA_DESK_INTERACTABLE = INTERACTABLES.find((i) => i.id === 'mina_desk') ?? null;
export const AGY_DESK_INTERACTABLE = INTERACTABLES.find((i) => i.id === 'antigravity_desk') ?? null;
export const AISTUDIO_DESK_INTERACTABLE = INTERACTABLES.find((i) => i.id === 'ai_studio_desk') ?? null;

const ALL_SOFA_ACTIVITIES: SofaActivity[] = ['tea', 'newspaper', 'tv_remote'];

export function createShuffledSofaBag(avoidFirst: SofaActivity | null): SofaActivity[] {
  const bag: SofaActivity[] = [...ALL_SOFA_ACTIVITIES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  if (avoidFirst && bag[0] === avoidFirst && bag.length > 1) {
    const swapIdx = 1 + Math.floor(Math.random() * (bag.length - 1));
    [bag[0], bag[swapIdx]] = [bag[swapIdx], bag[0]];
  }
  return bag;
}

export function randomSofaActivityDuration(activity: SofaActivity): number {
  if (activity === 'tv_remote') {
    return 7.5 + Math.random() * 2.5;
  }
  return 6.0 + Math.random() * 2.5;
}

export function faceToward(fromX: number, fromY: number, toX: number, toY: number): MinaNpcState['facing'] {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'down' : 'up';
}

export function buildMinaReturnToDeskPath(fromX: number, fromY: number): Array<{ x: number; y: number }> {
  const path = findWalkablePath(fromX, fromY, MINA_POS.x, MINA_POS.y);
  return path.length > 0 ? path : [{ ...MINA_POS }];
}

export function buildMinaToPinboardPath(fromX: number, fromY: number): Array<{ x: number; y: number }> {
  const path = findWalkablePath(fromX, fromY, MINA_PINBOARD_SPOT.x, MINA_PINBOARD_SPOT.y);
  return path.length > 0 ? path : [{ ...MINA_PINBOARD_SPOT }];
}

export function isPlayerInsideMinaRadius(player: PlayerState, mina: MinaNpcState): boolean {
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

export function isPlayerInsideAgyRadius(player: PlayerState, isAlreadyEngaged: boolean): boolean {
  if (getRoomZone(player.x, player.y) !== 'office') return false;
  const distToAgy = Math.hypot(player.x - AGY_POS.x, player.y - AGY_POS.y);
  if (distToAgy <= AGY_APPROACH_RADIUS) return true;
  if (isAlreadyEngaged && distToAgy <= AGY_LEAVE_RADIUS) return true;
  return false;
}

export function isPlayerInsideAiStudioRadius(player: PlayerState, isAlreadyEngaged: boolean): boolean {
  if (getRoomZone(player.x, player.y) !== 'office') return false;
  const distToStudio = Math.hypot(player.x - AISTUDIO_POS.x, player.y - AISTUDIO_POS.y);
  if (distToStudio <= AISTUDIO_APPROACH_RADIUS) return true;
  if (isAlreadyEngaged && distToStudio <= AISTUDIO_LEAVE_RADIUS) return true;
  return false;
}

export function getEffectiveNearestInteractable(
  player: PlayerState,
  mina: MinaNpcState,
  greenCar: GreenCarState,
  isAgyEngaged = false,
  isAiStudioEngaged = false
): InteractableObject | null {
  const staticNearest = findNearestInteractable(player.x, player.y);
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
