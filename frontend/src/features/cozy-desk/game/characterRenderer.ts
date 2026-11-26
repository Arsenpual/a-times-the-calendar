import type {
  AssistantMood,
  MinaNpcState,
  PlayerState,
  RovingAssistantNpcState,
} from '../types/game';
import {
  AGY_APPROACH_RADIUS,
  AGY_POS,
  AISTUDIO_APPROACH_RADIUS,
  AISTUDIO_POS,
  getRoomZone,
  MINA_APPROACH_RADIUS,
  MINA_POS,
  TILE,
  WORLD_W,
} from './houseMap';

export function pxRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  text: string,
  bgColor: string,
  borderColor: string
) {
  ctx.save();
  ctx.font = '600 11px "IBM Plex Sans Thai", sans-serif';
  const truncated = text.length > 26 ? `${text.slice(0, 25)}…` : text;
  const metrics = ctx.measureText(truncated);
  const padX = 8;
  const bw = Math.min(200, Math.max(58, Math.ceil(metrics.width) + padX * 2));
  const bh = 22;

  let bx = Math.round(anchorX - bw / 2);
  if (bx < 12) bx = 12;
  if (bx + bw > WORLD_W - 12) bx = WORLD_W - 12 - bw;
  const by = Math.max(8, Math.round(anchorY - bh));

  // Crisp pixel border box
  pxRect(ctx, bx - 1, by - 1, bw + 2, bh + 2, borderColor);
  pxRect(ctx, bx, by, bw, bh, bgColor);
  // Pointer notch
  pxRect(ctx, anchorX - 3, by + bh, 6, 3, borderColor);
  pxRect(ctx, anchorX - 2, by + bh - 1, 4, 3, bgColor);

  ctx.fillStyle = '#29221D';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(truncated, bx + bw / 2, by + bh / 2 + 0.5);
  ctx.restore();
}

export function drawMinaNpc(
  ctx: CanvasRenderingContext2D,
  mina: MinaNpcState,
  mood: AssistantMood,
  tick: number
) {
  const x = Math.round(mina.x);
  const y = Math.round(mina.y);
  const isSeatedWorking = mina.phase === 'working_at_desk' && !mina.isMoving;
  const stepPhase = mina.isMoving ? Math.floor(mina.walkFrame) % 4 : 0;
  const walkBob = mina.isMoving && (stepPhase === 1 || stepPhase === 3) ? -2 : 0;
  const legOffset = stepPhase === 1 ? 2 : stepPhase === 3 ? -2 : 0;
  const breathe = isSeatedWorking && Math.sin(tick * 0.08) > 0.35 ? 1 : 0;
  const bodyYOffset = mina.isMoving ? walkBob : breathe;
  const blink = tick % 190 > 183;

  // Floor shadow & walking/standing legs whenever she is up out of her swivel chair
  if (!isSeatedWorking) {
    pxRect(ctx, x - 9, y + 7, 18, 5, 'rgba(28,20,15,0.26)');
    pxRect(ctx, x - 6, y + 2 + (legOffset > 0 ? 1 : 0), 5, 7, '#4B3E36');
    pxRect(ctx, x + 1, y + 2 + (legOffset < 0 ? 1 : 0), 5, 7, '#4B3E36');
  }

  // Torso: cream knit cardigan + sage blouse underneath
  pxRect(ctx, x - 8, y - 8 + bodyYOffset, 16, 13, '#EFE5D5');
  if (mina.facing !== 'up') {
    const blouseShift = mina.facing === 'right' ? 2 : mina.facing === 'left' ? -2 : 0;
    pxRect(ctx, x - 3 + blouseShift, y - 7 + bodyYOffset, 6, 11, '#6B9080');
  } else {
    pxRect(ctx, x - 6, y - 7 + bodyYOffset, 12, 11, '#E5D8C5');
  }

  // Arms: seated typing at computer, pinning, carrying sticky note, waving greeting, thinking, or walking
  if (isSeatedWorking) {
    // Actively typing toward her computer keyboard on the right
    const typeShift = Math.floor(tick / 6) % 2;
    pxRect(ctx, x - 9, y - 5 + bodyYOffset, 3, 8, '#E5D8C5');
    pxRect(ctx, x + 6, y - 6 + typeShift, 11, 4, '#EFE5D5');
    pxRect(ctx, x + 16, y - 5 + typeShift, 4, 3, '#F4C6A3');
    pxRect(ctx, x + 6, y - 1 + (1 - typeShift), 11, 4, '#EFE5D5');
    pxRect(ctx, x + 16, y + (1 - typeShift), 4, 3, '#F4C6A3');
  } else if (mina.phase === 'pinning') {
    const reachUp = Math.floor(tick / 8) % 2 === 0 ? -15 : -12;
    pxRect(ctx, x - 11, y - 6, 3, 9, '#EFE5D5');
    pxRect(ctx, x + 8, y + reachUp, 4, 10, '#EFE5D5');
    pxRect(ctx, x + 8, y + reachUp - 2, 4, 3, '#F4C6A3');
    if (mina.pinProgress < 0.55) {
      pxRect(ctx, x + 6, y + reachUp - 6, 7, 5, '#FEF08A');
    }
  } else if (mina.isMoving) {
    pxRect(ctx, x - 11, y - 7 + bodyYOffset + (legOffset > 0 ? -1 : 0), 3, 9, '#EFE5D5');
    pxRect(ctx, x + 8, y - 7 + bodyYOffset + (legOffset < 0 ? -1 : 0), 3, 9, '#EFE5D5');
    if (mina.phase === 'walking_to_board') {
      pxRect(ctx, x + 9, y - 2 + bodyYOffset, 6, 5, '#FEF08A');
      pxRect(ctx, x + 11, y - 2 + bodyYOffset, 2, 1, '#DC2626');
    }
  } else if (mood === 'greeting') {
    const waveY = Math.floor(tick / 8) % 2 === 0 ? -12 : -9;
    pxRect(ctx, x - 11, y - 7 + bodyYOffset, 3, 9, '#EFE5D5');
    pxRect(ctx, x + 8, y + waveY, 4, 8, '#EFE5D5');
    pxRect(ctx, x + 8, y + waveY - 2, 4, 3, '#F4C6A3');
  } else if (mood === 'thinking') {
    const typeShift = Math.floor(tick / 6) % 2;
    pxRect(ctx, x - 10, y - 9 + typeShift, 4, 7, '#EFE5D5');
    pxRect(ctx, x + 6, y - 9 + (1 - typeShift), 4, 7, '#EFE5D5');
  } else if (mood === 'speaking') {
    // Expressive standing conversation gesture
    const talkShift = Math.floor(tick / 10) % 2 === 0 ? -2 : 0;
    pxRect(ctx, x - 11, y - 6 + bodyYOffset, 3, 9, '#EFE5D5');
    pxRect(ctx, x + 8, y - 8 + talkShift, 4, 8, '#EFE5D5');
    pxRect(ctx, x + 9, y - 9 + talkShift, 3, 3, '#F4C6A3');
  } else {
    pxRect(ctx, x - 11, y - 6 + bodyYOffset, 3, 9, '#EFE5D5');
    pxRect(ctx, x + 8, y - 6 + bodyYOffset, 3, 9, '#EFE5D5');
  }

  // Head & warm chestnut hair bun
  pxRect(ctx, x - 8, y - 22 + bodyYOffset, 16, 14, '#5B3420');
  if (mina.facing === 'up') {
    pxRect(ctx, x - 7, y - 21 + bodyYOffset, 14, 12, '#6E4027');
    pxRect(ctx, x - 3, y - 19 + bodyYOffset, 6, 6, '#4A2817');
    pxRect(ctx, x - 2, y - 18 + bodyYOffset, 4, 4, '#5B3420');
  } else {
    const eyeShift = mina.facing === 'left' ? -2 : mina.facing === 'right' ? 2 : 0;
    // Put hair bun behind her head when facing right/left
    const bunX = mina.facing === 'right' ? x - 10 : x + 5;
    pxRect(ctx, bunX, y - 17 + bodyYOffset, 5, 6, '#5B3420');
    pxRect(ctx, x - 6, y - 19 + bodyYOffset, 12, 11, '#F6CCB0'); // Face
    pxRect(ctx, x - 7, y - 22 + bodyYOffset, 14, 5, '#6E4027'); // Fringe

    // Round glasses & eyes
    if (!blink) {
      pxRect(ctx, x - 5 + eyeShift, y - 15 + bodyYOffset, 4, 4, '#3B281E');
      pxRect(ctx, x + 1 + eyeShift, y - 15 + bodyYOffset, 4, 4, '#3B281E');
      pxRect(ctx, x - 4 + eyeShift, y - 14 + bodyYOffset, 2, 2, '#FAF6F0');
      pxRect(ctx, x + 2 + eyeShift, y - 14 + bodyYOffset, 2, 2, '#FAF6F0');
      pxRect(ctx, x - 1 + eyeShift, y - 14 + bodyYOffset, 2, 1, '#3B281E');
    } else {
      pxRect(ctx, x - 4 + eyeShift, y - 13 + bodyYOffset, 3, 1, '#3B281E');
      pxRect(ctx, x + 1 + eyeShift, y - 13 + bodyYOffset, 3, 1, '#3B281E');
    }
    // Rosy cheeks
    pxRect(ctx, x - 5 + eyeShift, y - 11 + bodyYOffset, 2, 1, '#E89B8B');
    pxRect(ctx, x + 3 + eyeShift, y - 11 + bodyYOffset, 2, 1, '#E89B8B');
  }
}

export function drawAntigravityNpc(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  tick: number,
  isAntigravityOpen: boolean,
  npc?: RovingAssistantNpcState
) {
  const x = Math.round(npc?.x ?? AGY_POS.x);
  const y = Math.round(npc?.y ?? AGY_POS.y);
  const isRoving = Boolean(npc && npc.phase !== 'at_desk');
  const distToPlayer = Math.hypot(player.x - x, player.y - y);
  const isEngaged =
    isRoving ||
    isAntigravityOpen ||
    (getRoomZone(player.x, player.y) === 'office' && distToPlayer <= AGY_APPROACH_RADIUS);
  const walkBob = npc?.isMoving ? Math.abs(Math.sin(npc.walkFrame)) * 1.5 : 0;
  const breathe = npc?.isMoving ? Math.round(-walkBob) : Math.sin(tick * 0.09) > 0.3 ? 1 : 0;
  const blink = tick % 175 > 168;

  // Floor shadow & legs when standing/walking or turned to greet player
  if (isEngaged) {
    pxRect(ctx, x - 9, y + 7, 18, 5, 'rgba(20, 24, 36, 0.28)');
    const legSwing = npc?.isMoving ? Math.sin(npc.walkFrame) * 2.5 : 0;
    pxRect(ctx, x - 6, y + 2 + Math.round(legSwing), 5, 7, '#1E2436');
    pxRect(ctx, x + 1, y + 2 - Math.round(legSwing), 5, 7, '#1E2436');
  }

  // Torso: Sleek Antigravity dark-indigo tech hoodie with cyan chest core accent
  pxRect(ctx, x - 8, y - 8 + breathe, 16, 13, '#252F4C');
  pxRect(ctx, x - 6, y - 7 + breathe, 12, 11, '#313E63');
  const coreColor = Math.floor(tick / 15) % 2 === 0 ? '#38BDF8' : '#818CF8';
  const emblemShift = isEngaged ? 0 : -2;
  pxRect(ctx, x - 2 + emblemShift, y - 4 + breathe, 4, 3, coreColor);

  // Arms: typing left at terminal when idle, or friendly wave/gesture when player approaches
  if (!isEngaged) {
    const typeShift = Math.floor(tick / 5) % 2;
    pxRect(ctx, x + 6, y - 5 + breathe, 3, 8, '#252F4C');
    pxRect(ctx, x - 17, y - 6 + typeShift, 11, 4, '#313E63');
    pxRect(ctx, x - 20, y - 5 + typeShift, 4, 3, '#F1C5A2');
    pxRect(ctx, x - 17, y - 1 + (1 - typeShift), 11, 4, '#252F4C');
    pxRect(ctx, x - 20, y + (1 - typeShift), 4, 3, '#F1C5A2');
  } else {
    const waveY = Math.floor(tick / 9) % 2 === 0 ? -12 : -9;
    pxRect(ctx, x - 11, y - 6 + breathe, 3, 9, '#252F4C');
    pxRect(ctx, x + 8, y + waveY, 4, 8, '#313E63');
    pxRect(ctx, x + 8, y + waveY - 2, 4, 3, '#F1C5A2');
  }

  // Head & face
  pxRect(ctx, x - 7, y - 21 + breathe, 14, 13, '#F1C5A2');
  pxRect(ctx, x - 6, y - 10 + breathe, 12, 2, '#DFAD87');

  // Stylish silver-indigo spiky tech hair
  pxRect(ctx, x - 8, y - 25 + breathe, 16, 5, '#1E243B');
  pxRect(ctx, x - 7, y - 26 + breathe, 14, 2, '#3B4975');
  pxRect(ctx, x - 9, y - 22 + breathe, 3, 7, '#1E243B');
  pxRect(ctx, x + 6, y - 22 + breathe, 3, 7, '#1E243B');

  // Headphones earcups (cyan/slate)
  pxRect(ctx, x - 9, y - 17 + breathe, 2, 5, '#38BDF8');
  pxRect(ctx, x + 7, y - 17 + breathe, 2, 5, '#38BDF8');

  // Eyes & sleek tech visor glasses
  const eyeShift = isEngaged ? (player.x >= x ? 1 : -1) : -2;
  pxRect(ctx, x - 6 + eyeShift, y - 16 + breathe, 12, 4, 'rgba(30, 41, 59, 0.85)');
  if (!blink) {
    pxRect(ctx, x - 5 + eyeShift, y - 15 + breathe, 4, 2, '#38BDF8');
    pxRect(ctx, x + 1 + eyeShift, y - 15 + breathe, 4, 2, '#38BDF8');
  } else {
    pxRect(ctx, x - 5 + eyeShift, y - 15 + breathe, 4, 1, '#7DD3FC');
    pxRect(ctx, x + 1 + eyeShift, y - 15 + breathe, 4, 1, '#7DD3FC');
  }
  pxRect(ctx, x - 2 + eyeShift, y - 11 + breathe, 4, 1, '#A16E54');
}

export function drawAiStudioNpc(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  tick: number,
  isAiStudioOpen: boolean,
  status?: CharacterStatusSnapshot,
  npc?: RovingAssistantNpcState
) {
  const x = Math.round(npc?.x ?? AISTUDIO_POS.x);
  const y = Math.round(npc?.y ?? AISTUDIO_POS.y);
  const isRoving = Boolean(npc && npc.phase !== 'at_desk');
  const distToPlayer = Math.hypot(player.x - x, player.y - y);
  const isEngaged =
    isRoving ||
    isAiStudioOpen ||
    (getRoomZone(player.x, player.y) === 'office' && distToPlayer <= AISTUDIO_APPROACH_RADIUS);
  const isBusy = status?.status === 'busy';
  const isUnavailable = status?.status === 'unavailable';
  const walkBob = npc?.isMoving ? Math.abs(Math.sin(npc.walkFrame)) * 1.5 : 0;
  const breathe = npc?.isMoving ? Math.round(-walkBob) : Math.sin(tick * 0.085) > 0.35 ? 1 : 0;
  const blink = tick % 185 > 179;

  // Floor shadow & legs when standing/walking or turned to greet player
  if (isEngaged) {
    pxRect(ctx, x - 9, y + 6, 18, 5, 'rgba(18, 24, 42, 0.28)');
    const legSwing = npc?.isMoving ? Math.sin(npc.walkFrame) * 2.5 : 0;
    pxRect(ctx, x - 6, y + 2 + Math.round(legSwing), 5, 6, '#1E293B');
    pxRect(ctx, x + 1, y + 2 - Math.round(legSwing), 5, 6, '#1E293B');
  }

  // Torso: crisp Google AI Studio cobalt-blue & alabaster lab jacket
  pxRect(ctx, x - 8, y - 8 + breathe, 16, 12, '#EFF6FF');
  pxRect(ctx, x - 7, y - 7 + breathe, 4, 10, '#2563EB');
  pxRect(ctx, x + 3, y - 7 + breathe, 4, 10, '#2563EB');
  // Luminous Gemini spark chest badge
  const badgeColor = isUnavailable
    ? '#F87171'
    : isBusy
      ? Math.floor(tick / 6) % 2 === 0
        ? '#FBBF24'
        : '#60A5FA'
      : Math.floor(tick / 16) % 2 === 0
        ? '#3B82F6'
        : '#60A5FA';
  pxRect(ctx, x - 1, y - 5 + breathe, 2, 4, badgeColor);
  pxRect(ctx, x - 2, y - 4 + breathe, 4, 2, badgeColor);

  // Arms: typing toward studio keyboard when seated/busy, or welcoming gesture when player enters radius
  if (!isEngaged) {
    const speed = isBusy ? 4 : 7;
    const typeShift = Math.floor(tick / speed) % 2;
    pxRect(ctx, x - 10, y - 3 + typeShift, 4, 8, '#2563EB');
    pxRect(ctx, x - 9, y + 4 + typeShift, 3, 3, '#F4C6A3');
    pxRect(ctx, x + 6, y - 3 + (1 - typeShift), 4, 8, '#2563EB');
    pxRect(ctx, x + 6, y + 4 + (1 - typeShift), 3, 3, '#F4C6A3');
  } else {
    const waveY = Math.floor(tick / 9) % 2 === 0 ? -12 : -9;
    pxRect(ctx, x - 11, y - 6 + breathe, 3, 9, '#2563EB');
    pxRect(ctx, x + 8, y + waveY, 4, 8, '#2563EB');
    pxRect(ctx, x + 8, y + waveY - 2, 4, 3, '#F4C6A3');
  }

  // Head & face
  pxRect(ctx, x - 7, y - 21 + breathe, 14, 13, '#F6CCB0');
  pxRect(ctx, x - 6, y - 10 + breathe, 12, 2, '#E5B492');

  // Sleek cobalt-slate modern hair with bright sky highlight
  pxRect(ctx, x - 8, y - 25 + breathe, 16, 6, '#1E3A8A');
  pxRect(ctx, x - 7, y - 26 + breathe, 14, 2, '#3B82F6');
  pxRect(ctx, x - 9, y - 22 + breathe, 3, 7, '#1E3A8A');
  pxRect(ctx, x + 6, y - 22 + breathe, 3, 7, '#1E3A8A');
  // Signature twin blue spark hairclip accent
  pxRect(ctx, x + 4, y - 23 + breathe, 2, 2, '#93C5FD');

  // Eyes (glancing toward player when engaged, or focused down at studio screens)
  const eyeShift = isEngaged ? (player.x > x + 8 ? 1 : player.x < x - 8 ? -1 : 0) : 0;
  if (!blink) {
    pxRect(ctx, x - 5 + eyeShift, y - 16 + breathe, 3, 3, '#1E293B');
    pxRect(ctx, x + 2 + eyeShift, y - 16 + breathe, 3, 3, '#1E293B');
    pxRect(ctx, x - 4 + eyeShift, y - 15 + breathe, 1, 1, '#93C5FD');
    pxRect(ctx, x + 3 + eyeShift, y - 15 + breathe, 1, 1, '#93C5FD');
  } else {
    pxRect(ctx, x - 5 + eyeShift, y - 14 + breathe, 3, 1, '#1E293B');
    pxRect(ctx, x + 2 + eyeShift, y - 14 + breathe, 3, 1, '#1E293B');
  }
  // Subtle friendly smile
  pxRect(ctx, x - 2 + eyeShift, y - 11 + breathe, 4, 1, '#A16E54');
}

function formatCompactTokensShort(n: number): string {
  const safe = Math.max(0, Math.round(n));
  if (safe >= 1_000_000) {
    const m = safe / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (safe >= 1_000) {
    const k = safe / 1_000;
    return `${k >= 100 || k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return String(safe);
}

function formatResetClockShort(resetAtMs: number): string {
  const d = new Date(resetAtMs);
  if (Number.isNaN(d.getTime())) return '00:00 น.';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.`;
}

function truncateText(raw: string, maxChars: number): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars - 1)}…`;
}

interface ActiveOverlayCandidate {
  id: CharacterId;
  x: number;
  y: number;
  dist: number;
  priority: number;
  interactableId: 'mina_desk' | 'antigravity_desk' | 'ai_studio_desk';
  fallbackName: string;
  accentColor: string;
}

/**
 * Renders AT MOST ONE character's overhead status card (only when player is inside that
 * character's proximity radius or actively interacting with them), stacking any speech
 * bubble strictly bottom-to-top with zero overlapping layers.
 */
export function drawActiveCharacterOverlay(
  ctx: CanvasRenderingContext2D,
  state: RenderContextState
) {
  const inOffice = getRoomZone(state.player.x, state.player.y) === 'office';
  const candidates: ActiveOverlayCandidate[] = [];

  const minaDistToPlayer = Math.hypot(state.player.x - state.mina.x, state.player.y - state.mina.y);
  const minaDistToDesk = Math.hypot(state.player.x - MINA_POS.x, state.player.y - MINA_POS.y);
  const minaEngaged =
    state.isWorking ||
    (inOffice && (minaDistToDesk <= MINA_APPROACH_RADIUS || minaDistToPlayer <= MINA_APPROACH_RADIUS));
  if (minaEngaged) {
    candidates.push({
      id: 'mina',
      x: Math.round(state.mina.x),
      y: Math.round(state.mina.y),
      dist: Math.min(minaDistToPlayer, minaDistToDesk),
      priority: state.isWorking ? 3 : 1,
      interactableId: 'mina_desk',
      fallbackName: 'มีน่า',
      accentColor: '#6B9080',
    });
  }

  const agyDist = Math.hypot(state.player.x - AGY_POS.x, state.player.y - AGY_POS.y);
  const agyEngaged =
    Boolean(state.isAntigravityOpen) || (inOffice && agyDist <= AGY_APPROACH_RADIUS);
  if (agyEngaged) {
    candidates.push({
      id: 'antigravity',
      x: Math.round(AGY_POS.x),
      y: Math.round(AGY_POS.y),
      dist: agyDist,
      priority: state.isAntigravityOpen ? 3 : 1,
      interactableId: 'antigravity_desk',
      fallbackName: 'Antigravity',
      accentColor: '#38BDF8',
    });
  }

  const aiStudioDist = Math.hypot(state.player.x - AISTUDIO_POS.x, state.player.y - AISTUDIO_POS.y);
  const aiStudioEngaged =
    Boolean(state.isAiStudioOpen) || (inOffice && aiStudioDist <= AISTUDIO_APPROACH_RADIUS);
  if (aiStudioEngaged) {
    candidates.push({
      id: 'ai_studio',
      x: Math.round(AISTUDIO_POS.x),
      y: Math.round(AISTUDIO_POS.y),
      dist: aiStudioDist,
      priority: state.isAiStudioOpen ? 3 : 1,
      interactableId: 'ai_studio_desk',
      fallbackName: 'Google AI Studio',
      accentColor: '#60A5FA',
    });
  }

  // If player is outside every character's radius, show active delivery / mission bubble when walking
  if (candidates.length === 0) {
    if (state.deliveryBubble?.text) {
      const db = state.deliveryBubble;
      const bx =
        db.assistantId === 'antigravity'
          ? Math.round(state.antigravityNpc?.x ?? AGY_POS.x)
          : db.assistantId === 'ai_studio'
            ? Math.round(state.aiStudioNpc?.x ?? AISTUDIO_POS.x)
            : Math.round(state.mina.x);
      const by =
        db.assistantId === 'antigravity'
          ? Math.round(state.antigravityNpc?.y ?? AGY_POS.y)
          : db.assistantId === 'ai_studio'
            ? Math.round(state.aiStudioNpc?.y ?? AISTUDIO_POS.y)
            : Math.round(state.mina.y);
      const border =
        db.assistantId === 'antigravity'
          ? '#38BDF8'
          : db.assistantId === 'ai_studio'
            ? '#60A5FA'
            : '#D97736';
      drawSpeechBubble(ctx, bx, by - 30, db.text, '#FAF6F0', border);
      return;
    }
    if (
      (state.mina.phase === 'walking_to_board' || state.mina.phase === 'pinning' || state.mina.phase === 'summoned_to_player') &&
      state.minaBubbleText
    ) {
      drawSpeechBubble(
        ctx,
        Math.round(state.mina.x),
        Math.round(state.mina.y) - 30,
        state.minaBubbleText,
        '#FAF6F0',
        '#D97736'
      );
    }
    return;
  }

  // Strictly pick ONE active character (highest priority, then closest to player)
  candidates.sort((a, b) => b.priority - a.priority || a.dist - b.dist);
  const active = candidates[0];
  const snapshot = state.characterStatuses?.[active.id];

  // Bottom-to-top stacking cursor anchored cleanly above character head
  let stackBottomY = active.y - 29;

  // Build compact 2-line status plate content
  const charName = snapshot?.name || active.fallbackName;
  const statusKind = snapshot?.status ?? 'ready';
  const showInlineInteractCue =
    !state.isWorking &&
    !state.isTvOn &&
    !state.isAntigravityOpen &&
    !state.isAiStudioOpen &&
    state.nearestInteractable?.id === active.interactableId;

  let dotColor = '#34D399';
  let borderColor = active.accentColor;
  let detailText = '';
  let detailColor = '#CBD5E1';

  if (statusKind === 'unavailable') {
    dotColor = '#F87171';
    borderColor = '#EF4444';
    const reason = truncateText(snapshot?.unavailableReason || 'ระบบไม่พร้อมใช้งาน', 30);
    detailText = `ใช้งานไม่ได้: ${reason}`;
    detailColor = '#FCA5A5';
  } else if (statusKind === 'busy') {
    dotColor = Math.floor(state.tick / 12) % 2 === 0 ? '#FBBF24' : '#F59E0B';
    borderColor = '#F59E0B';
    const task = truncateText(snapshot?.currentTask || 'กำลังประมวลผลคำสั่ง', 28);
    detailText = `กำลังทำ: ${task}`;
    detailColor = '#FDE68A';
  } else if (snapshot) {
    dotColor = '#34D399';
    borderColor = active.accentColor;
    detailText = `Token เหลือ ${formatCompactTokensShort(snapshot.tokensRemaining)} · รีเซ็ต ${formatResetClockShort(snapshot.resetAt)}`;
    detailColor = '#BAE6FD';
  } else {
    detailText = 'พร้อมใช้งาน';
    detailColor = '#BAE6FD';
  }

  ctx.save();
  ctx.font = '700 9.5px "IBM Plex Sans Thai", sans-serif';
  const nameW = Math.ceil(ctx.measureText(charName).width);
  const cueText = showInlineInteractCue ? '[E]' : '';
  ctx.font = '700 8.5px monospace';
  const cueW = cueText ? Math.ceil(ctx.measureText(cueText).width) + 8 : 0;

  ctx.font = '500 9px "IBM Plex Sans Thai", sans-serif';
  const detailW = Math.ceil(ctx.measureText(detailText).width);

  const headerRowW = 8 + nameW + (cueW > 0 ? 10 + cueW : 0);
  const plateW = Math.min(224, Math.max(118, Math.max(headerRowW, detailW) + 16));
  const plateH = 31;

  let plateX = Math.round(active.x - plateW / 2);
  plateX = Math.max(8, Math.min(WORLD_W - plateW - 8, plateX));
  const plateTopY = Math.max(8, Math.round(stackBottomY - plateH));

  // Crisp pixel card backdrop & border
  pxRect(ctx, plateX - 1, plateTopY - 1, plateW + 2, plateH + 2, borderColor);
  pxRect(ctx, plateX, plateTopY, plateW, plateH, 'rgba(18, 22, 32, 0.94)');
  // Pointer notch centered over character
  const notchX = Math.max(plateX + 6, Math.min(plateX + plateW - 10, active.x - 2));
  pxRect(ctx, notchX - 1, plateTopY + plateH, 6, 3, borderColor);
  pxRect(ctx, notchX, plateTopY + plateH - 1, 4, 3, '#121620');

  // Row 1: status dot + character name + optional inline [E] badge
  pxRect(ctx, plateX + 7, plateTopY + 7, 4, 4, dotColor);
  ctx.font = '700 9.5px "IBM Plex Sans Thai", sans-serif';
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(charName, plateX + 14, plateTopY + 9.5);

  if (cueText) {
    const badgeW = cueW;
    const badgeX = plateX + plateW - badgeW - 5;
    pxRect(ctx, badgeX, plateTopY + 3.5, badgeW, 11, '#D97736');
    ctx.font = '700 8px monospace';
    ctx.fillStyle = '#FAF6F0';
    ctx.textAlign = 'center';
    ctx.fillText(cueText, badgeX + badgeW / 2, plateTopY + 9.2);
  }

  // Row 2: single concise status line (token+reset / busy task / unavailable reason)
  ctx.font = '500 9px "IBM Plex Sans Thai", sans-serif';
  ctx.fillStyle = detailColor;
  ctx.textAlign = 'left';
  ctx.fillText(detailText, plateX + 7, plateTopY + 22.5, plateW - 14);
  ctx.restore();

  // Advance bottom-to-top cursor strictly above the status plate (5px gap — zero layer overlap)
  stackBottomY = plateTopY - 6;

  // Layer 2 (only if active character is Mina & she has an active bubble/thinking text)
  if (active.id === 'mina' && stackBottomY >= 26) {
    if (state.assistantMood === 'thinking') {
      const dots = '.'.repeat((Math.floor(state.tick / 14) % 3) + 1);
      drawSpeechBubble(ctx, active.x, stackBottomY, `กำลังคิด${dots}`, '#FAF6F0', '#D97736');
    } else if (state.minaBubbleText) {
      const bubbleBorder =
        state.mina.phase === 'walking_to_board' || state.mina.phase === 'pinning'
          ? '#D97736'
          : '#4D7C6F';
      drawSpeechBubble(ctx, active.x, stackBottomY, state.minaBubbleText, '#FAF6F0', bubbleBorder);
    }
  }
}

export { drawPlayer, drawShoweringPlayerSilhouette } from './playerRenderer';


