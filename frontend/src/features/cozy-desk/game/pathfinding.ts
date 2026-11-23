import type { Rect } from '../types/game';
import {
  COLLIDERS,
  collidesWithWorld,
  MAP_COLS,
  MAP_ROWS,
  rectsOverlap,
  TILE,
  WORLD_H,
  WORLD_W,
} from './houseMap';

export interface Point {
  x: number;
  y: number;
}

const CELL = 8;
const GRID_COLS = Math.floor(WORLD_W / CELL); // 80
const GRID_ROWS = Math.floor(WORLD_H / CELL); // 52
const GRID_SIZE = GRID_COLS * GRID_ROWS; // 4160

// Precompute static walkability & soft clearance penalty once for instant (<0.5ms) A* queries
const walkableGrid = new Uint8Array(GRID_SIZE);
const clearancePenalty = new Float32Array(GRID_SIZE);

function initNavigationGrid() {
  for (let row = 0; row < GRID_ROWS; row++) {
    const cy = row * CELL + CELL / 2;
    for (let col = 0; col < GRID_COLS; col++) {
      const cx = col * CELL + CELL / 2;
      const idx = row * GRID_COLS + col;
      walkableGrid[idx] = collidesWithWorld(cx, cy) ? 0 : 1;
    }
  }

  // Add a mild soft cost for cells directly touching obstacles so characters glide naturally
  // down the center of aisles & doorways without blocking narrow valid passages.
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const idx = row * GRID_COLS + col;
      if (walkableGrid[idx] === 0) continue;
      let touchesWall = false;
      for (let dr = -1; dr <= 1 && !touchesWall; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (
            nr < 0 ||
            nr >= GRID_ROWS ||
            nc < 0 ||
            nc >= GRID_COLS ||
            walkableGrid[nr * GRID_COLS + nc] === 0
          ) {
            touchesWall = true;
            break;
          }
        }
      }
      clearancePenalty[idx] = touchesWall ? 0.32 : 0;
    }
  }
}

initNavigationGrid();

function clampCol(col: number): number {
  return Math.max(0, Math.min(GRID_COLS - 1, col));
}

function clampRow(row: number): number {
  return Math.max(0, Math.min(GRID_ROWS - 1, row));
}

function cellCenterX(col: number): number {
  return col * CELL + CELL / 2;
}

function cellCenterY(row: number): number {
  return row * CELL + CELL / 2;
}

function worldToCell(x: number, y: number): { col: number; row: number } {
  return {
    col: clampCol(Math.floor(x / CELL)),
    row: clampRow(Math.floor(y / CELL)),
  };
}

function findNearestWalkableCell(
  startCol: number,
  startRow: number,
  maxRadius = 12
): { col: number; row: number } | null {
  if (walkableGrid[startRow * GRID_COLS + startCol] === 1) {
    return { col: startCol, row: startRow };
  }

  let best: { col: number; row: number } | null = null;
  let bestDistSq = Infinity;

  for (let r = 1; r <= maxRadius; r++) {
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (Math.abs(dr) !== r && Math.abs(dc) !== r) continue;
        const nr = startRow + dr;
        const nc = startCol + dc;
        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
        if (walkableGrid[nr * GRID_COLS + nc] === 1) {
          const distSq = dr * dr + dc * dc;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            best = { col: nc, row: nr };
          }
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * Checks if a character hitbox can travel in a straight line from A to B
 * without touching any static furniture or wall collider.
 */
export function hasWalkableLineOfSight(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  safetyMargin = 1
): boolean {
  const dist = Math.hypot(bx - ax, by - ay);
  if (dist < 1) return !collidesWithWorld(bx, by);

  const steps = Math.max(2, Math.ceil(dist / 2.5));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const sx = ax + (bx - ax) * t;
    const sy = ay + (by - ay) * t;
    if (collidesWithWorld(sx, sy)) {
      return false;
    }
    // Keep a slight corner buffer along interior segment points so string-pulling never grazes edges
    if (safetyMargin > 0 && i > 1 && i < steps) {
      if (
        collidesWithWorld(sx + safetyMargin, sy) ||
        collidesWithWorld(sx - safetyMargin, sy) ||
        collidesWithWorld(sx, sy + safetyMargin) ||
        collidesWithWorld(sx, sy - safetyMargin)
      ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Checks if two characters standing at A and B have a clear conversational sightline
 * (no solid wall or furniture blocking between them).
 */
function hasClearSightBetween(ax: number, ay: number, bx: number, by: number): boolean {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(3, Math.ceil(dist / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = ax + (bx - ax) * t;
    const sy = ay + (by - ay) * t;
    const probe: Rect = { x: sx - 3, y: sy - 3, w: 6, h: 6 };
    for (const col of COLLIDERS) {
      if (rectsOverlap(probe, col)) {
        return false;
      }
    }
  }
  return true;
}

const DIRS: ReadonlyArray<{ dc: number; dr: number; cost: number }> = [
  { dc: 1, dr: 0, cost: 1 },
  { dc: -1, dr: 0, cost: 1 },
  { dc: 0, dr: 1, cost: 1 },
  { dc: 0, dr: -1, cost: 1 },
  { dc: 1, dr: 1, cost: Math.SQRT2 },
  { dc: 1, dr: -1, cost: Math.SQRT2 },
  { dc: -1, dr: 1, cost: Math.SQRT2 },
  { dc: -1, dr: -1, cost: Math.SQRT2 },
];

function octileHeuristic(c1: number, r1: number, c2: number, r2: number): number {
  const dx = Math.abs(c1 - c2);
  const dy = Math.abs(r1 - r2);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

class MinHeap {
  private nodes: number[] = [];
  private scores: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, score: number) {
    this.nodes.push(node);
    this.scores.push(score);
    this.bubbleUp(this.nodes.length - 1);
  }

  pop(): number {
    const top = this.nodes[0];
    const lastNode = this.nodes.pop()!;
    const lastScore = this.scores.pop()!;
    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode;
      this.scores[0] = lastScore;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.scores[i] >= this.scores[parent]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private sinkDown(i: number) {
    const len = this.nodes.length;
    while (true) {
      const left = (i << 1) + 1;
      const right = left + 1;
      let smallest = i;
      if (left < len && this.scores[left] < this.scores[smallest]) {
        smallest = left;
      }
      if (right < len && this.scores[right] < this.scores[smallest]) {
        smallest = right;
      }
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number) {
    const tn = this.nodes[a];
    this.nodes[a] = this.nodes[b];
    this.nodes[b] = tn;
    const ts = this.scores[a];
    this.scores[a] = this.scores[b];
    this.scores[b] = ts;
  }
}

function smoothPath(origin: Point, rawWaypoints: Point[]): Point[] {
  if (rawWaypoints.length <= 1) return rawWaypoints;

  const smoothed: Point[] = [];
  let anchor = origin;
  let i = 0;

  while (i < rawWaypoints.length) {
    let farthest = i;
    for (let j = rawWaypoints.length - 1; j > i; j--) {
      if (hasWalkableLineOfSight(anchor.x, anchor.y, rawWaypoints[j].x, rawWaypoints[j].y, 1)) {
        farthest = j;
        break;
      }
    }
    const chosen = rawWaypoints[farthest];
    smoothed.push(chosen);
    anchor = chosen;
    i = farthest + 1;
  }

  return smoothed;
}

/**
 * Computes an obstacle-free, corner-safe, line-of-sight smoothed path between any two points
 * in the house (including routing cleanly around furniture and through the dividing doorway).
 */
export function findWalkablePath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): Point[] {
  const goalCellRaw = worldToCell(toX, toY);
  const goalCell = findNearestWalkableCell(goalCellRaw.col, goalCellRaw.row, 14);
  if (!goalCell) return [];

  const exactGoalWalkable = !collidesWithWorld(toX, toY);
  const finalGoal: Point = exactGoalWalkable
    ? { x: toX, y: toY }
    : { x: cellCenterX(goalCell.col), y: cellCenterY(goalCell.row) };

  // Fast direct-line check when unobstructed
  if (
    !collidesWithWorld(fromX, fromY) &&
    hasWalkableLineOfSight(fromX, fromY, finalGoal.x, finalGoal.y, 1)
  ) {
    return [finalGoal];
  }

  const startCellRaw = worldToCell(fromX, fromY);
  const startCell = findNearestWalkableCell(startCellRaw.col, startCellRaw.row, 10);
  if (!startCell) return [];

  const startIdx = startCell.row * GRID_COLS + startCell.col;
  const goalIdx = goalCell.row * GRID_COLS + goalCell.col;

  if (startIdx === goalIdx) {
    return [finalGoal];
  }

  const gScore = new Float32Array(GRID_SIZE);
  gScore.fill(Infinity);
  const cameFrom = new Int32Array(GRID_SIZE);
  cameFrom.fill(-1);
  const closed = new Uint8Array(GRID_SIZE);

  gScore[startIdx] = 0;
  const open = new MinHeap();
  open.push(startIdx, octileHeuristic(startCell.col, startCell.row, goalCell.col, goalCell.row));

  let found = false;

  while (open.size > 0) {
    const current = open.pop();
    if (closed[current]) continue;
    closed[current] = 1;

    if (current === goalIdx) {
      found = true;
      break;
    }

    const curRow = Math.floor(current / GRID_COLS);
    const curCol = current - curRow * GRID_COLS;
    const curG = gScore[current];

    for (const dir of DIRS) {
      const nc = curCol + dir.dc;
      const nr = curRow + dir.dr;
      if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;

      const nextIdx = nr * GRID_COLS + nc;
      if (closed[nextIdx] || walkableGrid[nextIdx] === 0) continue;

      // Prevent diagonal corner cutting across furniture or wall edges
      if (dir.dc !== 0 && dir.dr !== 0) {
        if (
          walkableGrid[curRow * GRID_COLS + nc] === 0 ||
          walkableGrid[nr * GRID_COLS + curCol] === 0
        ) {
          continue;
        }
      }

      const tentativeG = curG + dir.cost + clearancePenalty[nextIdx];
      if (tentativeG < gScore[nextIdx]) {
        gScore[nextIdx] = tentativeG;
        cameFrom[nextIdx] = current;
        const f = tentativeG + octileHeuristic(nc, nr, goalCell.col, goalCell.row);
        open.push(nextIdx, f);
      }
    }
  }

  if (!found) {
    return [];
  }

  // Reconstruct cell-center path from start -> goal
  const reversed: Point[] = [];
  let trace = goalIdx;
  while (trace !== -1 && trace !== startIdx) {
    const tr = Math.floor(trace / GRID_COLS);
    const tc = trace - tr * GRID_COLS;
    reversed.push({ x: cellCenterX(tc), y: cellCenterY(tr) });
    trace = cameFrom[trace];
  }
  reversed.reverse();

  if (reversed.length > 0) {
    reversed[reversed.length - 1] = finalGoal;
  } else {
    reversed.push(finalGoal);
  }

  // If the starting point was slightly colliding, prepend the snapped start cell center first
  const origin: Point = collidesWithWorld(fromX, fromY)
    ? { x: cellCenterX(startCell.col), y: cellCenterY(startCell.row) }
    : { x: fromX, y: fromY };

  const smoothed = smoothPath(origin, reversed);
  if (collidesWithWorld(fromX, fromY)) {
    return [origin, ...smoothed];
  }
  return smoothed;
}

export function measurePathLength(startX: number, startY: number, path: Point[]): number {
  let total = 0;
  let px = startX;
  let py = startY;
  for (const pt of path) {
    total += Math.hypot(pt.x - px, pt.y - py);
    px = pt.x;
    py = pt.y;
  }
  return total;
}

const MEETING_ANGLES = [
  0,
  Math.PI,
  Math.PI / 2,
  -Math.PI / 2,
  Math.PI / 4,
  (3 * Math.PI) / 4,
  -Math.PI / 4,
  (-3 * Math.PI) / 4,
  Math.PI / 8,
  (3 * Math.PI) / 8,
  (5 * Math.PI) / 8,
  (7 * Math.PI) / 8,
  -Math.PI / 8,
  (-3 * Math.PI) / 8,
  (-5 * Math.PI) / 8,
  (-7 * Math.PI) / 8,
];

/**
 * Finds the shortest obstacle-free A* path for Mina to walk from her current position
 * to a comfortable face-to-face standing spot right beside the player anywhere in the house.
 */
export function findMeetingPathForMina(
  minaX: number,
  minaY: number,
  playerX: number,
  playerY: number
): Point[] {
  const currentDist = Math.hypot(playerX - minaX, playerY - minaY);
  if (
    currentDist >= 22 &&
    currentDist <= 38 &&
    !collidesWithWorld(minaX, minaY) &&
    hasClearSightBetween(minaX, minaY, playerX, playerY)
  ) {
    return [];
  }

  const candidates: Array<{ x: number; y: number; approxCost: number; cardinalBonus: number }> = [];
  const radii = [29, 35, 42];

  for (const radius of radii) {
    for (let i = 0; i < MEETING_ANGLES.length; i++) {
      const angle = MEETING_ANGLES[i];
      const tx = playerX + Math.cos(angle) * radius;
      const ty = playerY + Math.sin(angle) * radius;

      if (
        tx < 0.8 * TILE ||
        tx > (MAP_COLS - 0.8) * TILE ||
        ty < 2.25 * TILE ||
        ty > (MAP_ROWS - 0.8) * TILE
      ) {
        continue;
      }
      if (collidesWithWorld(tx, ty)) continue;
      if (!hasClearSightBetween(tx, ty, playerX, playerY)) continue;

      const cardinalBonus = i < 4 ? -8 : 0;
      const approxCost = Math.hypot(tx - minaX, ty - minaY) + (radius - 29) * 0.8 + cardinalBonus;
      candidates.push({ x: tx, y: ty, approxCost, cardinalBonus });
    }
  }

  candidates.sort((a, b) => a.approxCost - b.approxCost);

  let bestPath: Point[] | null = null;
  let bestScore = Infinity;

  const limit = Math.min(candidates.length, 6);
  for (let i = 0; i < limit; i++) {
    const c = candidates[i];
    const path = findWalkablePath(minaX, minaY, c.x, c.y);
    if (path.length === 0) continue;
    const score = measurePathLength(minaX, minaY, path) + c.cardinalBonus;
    if (score < bestScore) {
      bestScore = score;
      bestPath = path;
    }
  }

  if (bestPath) {
    return bestPath;
  }

  // Graceful fallback: path directly toward player and stop short by ~26px
  const fallback = findWalkablePath(minaX, minaY, playerX, playerY);
  if (fallback.length === 0) return [];

  const last = fallback[fallback.length - 1];
  const prev = fallback.length >= 2 ? fallback[fallback.length - 2] : { x: minaX, y: minaY };
  const segLen = Math.hypot(last.x - prev.x, last.y - prev.y);
  if (segLen > 28) {
    const ratio = (segLen - 26) / segLen;
    fallback[fallback.length - 1] = {
      x: prev.x + (last.x - prev.x) * ratio,
      y: prev.y + (last.y - prev.y) * ratio,
    };
  }
  return fallback;
}
