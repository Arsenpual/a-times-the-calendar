import type { PlayerState } from '../types/game';

function pxRect(
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

export function drawShoweringPlayerSilhouette(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  tick: number
) {
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const phase = player.showerPhase ?? 'wetting';
  const elapsed = player.showerPhaseElapsed;
  const bob = Math.sin(tick * 0.14) > 0.3 ? -1 : 0;

  // Wet floor ripple shadow around feet
  pxRect(ctx, x - 9, y + 6, 18, 5, 'rgba(38, 74, 84, 0.28)');

  // Soft diffused lower/mid silhouette (no clothes, no explicit details; censored behind frosted glass)
  pxRect(ctx, x - 5, y + 1, 4, 7, 'rgba(205, 162, 136, 0.55)');
  pxRect(ctx, x + 1, y + 1, 4, 7, 'rgba(205, 162, 136, 0.55)');
  pxRect(ctx, x - 7, y - 9 + bob, 14, 11, 'rgba(218, 174, 148, 0.58)');

  // Arms based on shower phase (west wall soap holder -> reach left)
  if (phase === 'grab_soap' || phase === 'return_soap') {
    const t = Math.min(1, elapsed / 1.5);
    const reach = Math.round((t < 0.5 ? t * 2 : (1 - t) * 2) * 14);
    pxRect(ctx, x - 11 - reach, y - 8 + bob, 4 + reach, 4, 'rgba(218, 174, 148, 0.68)');
    pxRect(ctx, x + 7, y - 7 + bob, 3, 8, 'rgba(218, 174, 148, 0.62)');
  } else if (phase === 'scrub_soap') {
    const scrubShift = Math.round(Math.sin(tick * 0.35) * 3);
    pxRect(ctx, x - 11 + scrubShift, y - 9 + bob, 4, 8, 'rgba(218, 174, 148, 0.68)');
    pxRect(ctx, x + 7 - scrubShift, y - 9 + bob, 4, 8, 'rgba(218, 174, 148, 0.68)');
  } else {
    // Rinsing / wetting under shower water stream
    const rinseLift = Math.floor(tick / 10) % 2;
    pxRect(ctx, x - 10, y - 10 + bob + rinseLift, 3, 9, 'rgba(218, 174, 148, 0.62)');
    pxRect(ctx, x + 7, y - 10 + bob + (1 - rinseLift), 3, 9, 'rgba(218, 174, 148, 0.62)');
  }

  // Head & wet hair silhouette (remains recognizable near top of frosted glass)
  pxRect(ctx, x - 8, y - 22 + bob, 16, 13, 'rgba(90, 55, 36, 0.78)');
  pxRect(ctx, x - 6, y - 19 + bob, 12, 10, 'rgba(232, 190, 162, 0.75)');
  pxRect(ctx, x - 7, y - 22 + bob, 14, 5, 'rgba(106, 66, 43, 0.82)');
  // Closed/relaxed eyes while showering
  pxRect(ctx, x - 4, y - 14 + bob, 3, 1, 'rgba(45, 30, 22, 0.65)');
  pxRect(ctx, x + 1, y - 14 + bob, 3, 1, 'rgba(45, 30, 22, 0.65)');

  // Shampoo/soap foam cap on head & shoulders during scrub_soap
  if (phase === 'scrub_soap') {
    pxRect(ctx, x - 7, y - 23 + bob, 14, 4, 'rgba(255, 255, 255, 0.78)');
    pxRect(ctx, x - 5, y - 25 + bob, 10, 3, 'rgba(255, 255, 255, 0.72)');
  }
}

function drawWeightliftingPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  tick: number
) {
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const cycleSec = 2.2;
  const phase = (player.workoutElapsed % cycleSec) / cycleSec;

  // Smooth overhead press cycle: brace dip -> drive overhead -> lockout hold -> controlled lower
  let liftRatio = 0; // 0 = front-rack at shoulders, 1 = full overhead lockout
  let bodyDip = 0;
  let isLockout = false;

  if (phase < 0.18) {
    const t = phase / 0.18;
    bodyDip = Math.round(Math.sin(t * Math.PI) * 2);
    liftRatio = 0;
  } else if (phase < 0.46) {
    const t = (phase - 0.18) / 0.28;
    liftRatio = 1 - (1 - t) * (1 - t);
    bodyDip = Math.round((1 - t) * 1);
  } else if (phase < 0.68) {
    liftRatio = 1;
    bodyDip = -1;
    isLockout = true;
  } else {
    const t = (phase - 0.68) / 0.32;
    const smooth = t * t * (3 - 2 * t);
    liftRatio = 1 - smooth;
    bodyDip = Math.round(Math.sin(t * Math.PI) * 1);
  }

  const tremor = isLockout && Math.floor(tick / 4) % 2 === 0 ? -1 : 0;
  const barY = Math.round(y - 10 + bodyDip - liftRatio * 20 + tremor);
  const shoulderY = y - 8 + bodyDip;

  // Wide athletic stance floor shadow on Olympic lifting platform
  pxRect(ctx, x - 12, y + 7, 24, 6, 'rgba(20, 18, 16, 0.32)');

  // Planted wide athletic legs & sneakers (slight knee bend during brace dip)
  pxRect(ctx, x - 8, y + 1 + Math.max(0, bodyDip), 5, 7 - Math.max(0, bodyDip), '#3E4C59');
  pxRect(ctx, x + 3, y + 1 + Math.max(0, bodyDip), 5, 7 - Math.max(0, bodyDip), '#3E4C59');
  pxRect(ctx, x - 9, y + 7, 6, 2, '#2B231E');
  pxRect(ctx, x + 3, y + 7, 6, 2, '#2B231E');

  // Torso: olive sage knit sweater
  pxRect(ctx, x - 8, y - 9 + bodyDip, 16, 12, '#6A7B53');
  pxRect(ctx, x - 6, y - 9 + bodyDip, 12, 3, '#7C8F62');

  // Arms dynamically extending from shoulders to barbell grip points
  const armTopY = Math.min(shoulderY, barY + 1);
  const armBotY = Math.max(shoulderY + 5, barY + 4);
  const armHeight = Math.max(6, armBotY - armTopY);
  const armOutShift = liftRatio > 0.35 ? 1 : 0;
  pxRect(ctx, x - 11 - armOutShift, armTopY, 4, armHeight, '#5C6C47');
  pxRect(ctx, x + 7 + armOutShift, armTopY, 4, armHeight, '#5C6C47');

  // Head & focused lifting expression
  pxRect(ctx, x - 8, y - 22 + bodyDip, 16, 14, '#5A3724');
  pxRect(ctx, x - 6, y - 19 + bodyDip, 12, 11, '#F6CCB0');
  pxRect(ctx, x - 7, y - 22 + bodyDip, 14, 5, '#6A422B');

  // Determined eyes & warm rosy effort cheeks during drive/lockout
  const straining = liftRatio > 0.5;
  if (straining) {
    pxRect(ctx, x - 4, y - 15 + bodyDip, 3, 2, '#2D1E16');
    pxRect(ctx, x + 1, y - 15 + bodyDip, 3, 2, '#2D1E16');
    pxRect(ctx, x - 5, y - 11 + bodyDip, 2, 1, '#E07A6B');
    pxRect(ctx, x + 3, y - 11 + bodyDip, 2, 1, '#E07A6B');
    // Tiny cyan sweat drop on temple
    pxRect(ctx, x + 5, y - 17 + bodyDip + (Math.floor(tick / 8) % 2), 2, 3, '#7DD3FC');
  } else {
    pxRect(ctx, x - 4, y - 15 + bodyDip, 2, 3, '#2D1E16');
    pxRect(ctx, x + 2, y - 15 + bodyDip, 2, 3, '#2D1E16');
  }

  // Loaded Olympic Barbell (matching squat rack palette: chrome shaft + 25kg red & 20kg blue bumper plates)
  // Chrome barbell shaft + knurled center
  pxRect(ctx, x - 25, barY, 50, 3, '#CBD5E1');
  pxRect(ctx, x - 11, barY, 22, 3, '#94A3B8');
  pxRect(ctx, x - 25, barY, 50, 1, '#F1F5F9');

  // Outer 25kg Red Bumper Plates
  pxRect(ctx, x - 24, barY - 6, 4, 15, '#B91C1C');
  pxRect(ctx, x - 23, barY - 5, 2, 13, '#EF4444');
  pxRect(ctx, x + 20, barY - 6, 4, 15, '#B91C1C');
  pxRect(ctx, x + 21, barY - 5, 2, 13, '#EF4444');

  // Inner 20kg Blue Bumper Plates
  pxRect(ctx, x - 19, barY - 4, 3, 11, '#1D4ED8');
  pxRect(ctx, x - 18, barY - 3, 1, 9, '#60A5FA');
  pxRect(ctx, x + 16, barY - 4, 3, 11, '#1D4ED8');
  pxRect(ctx, x + 17, barY - 3, 1, 9, '#60A5FA');

  // Hands gripping the barbell shaft
  pxRect(ctx, x - 12 - armOutShift, barY - 1, 4, 4, '#F6CCB0');
  pxRect(ctx, x + 8 + armOutShift, barY - 1, 4, 4, '#F6CCB0');

  // Subtle golden lockout sparkle pixels at top of press
  if (isLockout) {
    const sp = Math.floor(tick / 6) % 2;
    pxRect(ctx, x - 28, barY - 9 - sp, 2, 2, '#FDE68A');
    pxRect(ctx, x + 26, barY - 9 - (1 - sp), 2, 2, '#FDE68A');
  }

  // Compact floating rep badge above the barbell once at least 1 rep is completed
  if (player.workoutReps > 0) {
    ctx.save();
    const label = `×${player.workoutReps}`;
    ctx.font = '700 9px "IBM Plex Sans Thai", monospace';
    const tw = Math.ceil(ctx.measureText(label).width);
    const bw = Math.max(24, tw + 10);
    const bh = 14;
    const bx = Math.round(x - bw / 2);
    const by = Math.round(Math.min(barY - 22, y - 42));
    pxRect(ctx, bx - 1, by - 1, bw + 2, bh + 2, '#D97736');
    pxRect(ctx, bx, by, bw, bh, 'rgba(28, 22, 18, 0.9)');
    ctx.fillStyle = '#FDE68A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + 0.5);
    ctx.restore();
  }
}

export function drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerState, tick: number) {
  if (player.isShowering) {
    drawShoweringPlayerSilhouette(ctx, player, tick);
    return;
  }
  if (player.isSitting && player.seat === 'gym_barbell') {
    drawWeightliftingPlayer(ctx, player, tick);
    return;
  }
  // When sleeping on the Master Bedroom King Bed or driving the green car, the player is rendered inside it
  if (player.isSitting && (player.seat === 'bedroom_bed' || player.seat === 'green_car')) {
    return;
  }
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const stepPhase = player.isMoving ? Math.floor(player.walkFrame) % 4 : 0;
  const bob = player.isMoving && (stepPhase === 1 || stepPhase === 3) ? -2 : 0;
  const legOffset = stepPhase === 1 ? 2 : stepPhase === 3 ? -2 : 0;
  const breathe = player.isSitting && Math.sin(tick * 0.06) > 0.45 ? 1 : 0;
  const yOff = player.isMoving ? bob : breathe;

  const isOnSofa = player.isSitting && player.seat === 'sofa';
  const sofaAct = isOnSofa ? player.sofaActivity : null;
  const sofaElapsed = isOnSofa ? player.sofaActivityElapsed : 0;
  // Tea sip timing: lift teacup smoothly for ~1.1s every ~3.4s
  const teaCycle = sofaElapsed % 3.4;
  const isSippingTea = sofaAct === 'tea' && teaCycle > 1.0 && teaCycle < 2.25;
  // Newspaper page-rustle timing
  const paperRustle = sofaAct === 'newspaper' && (sofaElapsed % 2.8) > 2.35 ? -1 : 0;
  // TV remote pointing timing (first 1.35s aims remote down and blinks IR LED)
  const isAimingRemote = sofaAct === 'tv_remote' && sofaElapsed < 1.35;

  // Shadow (subtle when seated on chair/sofa)
  if (!player.isSitting) {
    pxRect(ctx, x - 9, y + 7, 18, 6, 'rgba(28,20,15,0.28)');
  } else {
    pxRect(ctx, x - 8, y + 4, 16, 4, 'rgba(28,20,15,0.18)');
  }

  // Legs / shoes (tucked knees on sofa, hidden under desk, or walking legs)
  if (!player.isSitting) {
    pxRect(ctx, x - 6, y + 2 + (legOffset > 0 ? 1 : 0), 5, 7, '#3E4C59');
    pxRect(ctx, x + 1, y + 2 + (legOffset < 0 ? 1 : 0), 5, 7, '#3E4C59');
  } else if (isOnSofa) {
    // Relaxed seated knees & shoes resting at the front edge of the sofa cushion
    pxRect(ctx, x - 7, y + 2, 6, 5, '#3E4C59');
    pxRect(ctx, x + 1, y + 2, 6, 5, '#3E4C59');
    pxRect(ctx, x - 6, y + 6, 5, 2, '#2B231E');
    pxRect(ctx, x + 1, y + 6, 5, 2, '#2B231E');
  }

  // Torso: olive sage knit sweater (matching generated portrait)
  pxRect(ctx, x - 8, y - 9 + yOff, 16, 12, '#6A7B53');
  pxRect(ctx, x - 6, y - 9 + yOff, 12, 3, '#7C8F62');

  // Arms (drawn behind held sofa props when reading/drinking)
  if (player.isSitting && player.seat === 'workdesk') {
    const typeShift = Math.floor(tick / 7) % 2;
    pxRect(ctx, x - 10, y - 16 + typeShift, 4, 11, '#5C6C47');
    pxRect(ctx, x - 9, y - 18 + typeShift, 3, 3, '#F6CCB0');
    pxRect(ctx, x + 6, y - 16 + (1 - typeShift), 4, 11, '#5C6C47');
    pxRect(ctx, x + 6, y - 18 + (1 - typeShift), 3, 3, '#F6CCB0');
  } else if (isOnSofa) {
    if (sofaAct === 'tea') {
      // Left arm relaxed, right arm holds warm teacup (raises to sip!)
      pxRect(ctx, x - 11, y - 6 + yOff, 3, 7, '#5C6C47');
      pxRect(ctx, x - 10, y + yOff, 3, 2, '#F6CCB0');
      const cupLift = isSippingTea ? -5 : 0;
      pxRect(ctx, x + 7, y - 7 + yOff + Math.min(0, cupLift + 2), 4, 7, '#5C6C47');
      pxRect(ctx, x + 4, y - 5 + yOff + cupLift, 4, 3, '#F6CCB0');
    } else if (sofaAct === 'newspaper') {
      // Both arms forward holding open newspaper
      pxRect(ctx, x - 11, y - 7 + yOff + paperRustle, 4, 7, '#5C6C47');
      pxRect(ctx, x + 7, y - 7 + yOff + paperRustle, 4, 7, '#5C6C47');
    } else if (sofaAct === 'tv_remote') {
      // Left arm relaxed, right arm points TV remote down toward TV
      pxRect(ctx, x - 11, y - 6 + yOff, 3, 7, '#5C6C47');
      pxRect(ctx, x - 10, y + yOff, 3, 2, '#F6CCB0');
      const aimExtend = isAimingRemote ? 3 : 0;
      pxRect(ctx, x + 7, y - 6 + yOff, 4, 7 + aimExtend, '#5C6C47');
      pxRect(ctx, x + 7, y + yOff + aimExtend, 4, 3, '#F6CCB0');
    } else {
      pxRect(ctx, x - 11, y - 6 + yOff, 3, 7, '#5C6C47');
      pxRect(ctx, x + 8, y - 6 + yOff, 3, 7, '#5C6C47');
      pxRect(ctx, x - 10, y + yOff, 3, 2, '#F6CCB0');
      pxRect(ctx, x + 7, y + yOff, 3, 2, '#F6CCB0');
    }
  } else {
    pxRect(ctx, x - 11, y - 7 + yOff + (legOffset > 0 ? -1 : 0), 3, 9, '#5C6C47');
    pxRect(ctx, x + 8, y - 7 + yOff + (legOffset < 0 ? -1 : 0), 3, 9, '#5C6C47');
  }

  // Head & hair
  pxRect(ctx, x - 8, y - 22 + yOff, 16, 14, '#5A3724');
  if (player.facing !== 'up') {
    pxRect(ctx, x - 6, y - 19 + yOff, 12, 11, '#F6CCB0');
    pxRect(ctx, x - 7, y - 22 + yOff, 14, 5, '#6A422B');
    // Eyes based on facing direction & sofa reading glance
    let eyeShift = player.facing === 'left' ? -2 : player.facing === 'right' ? 2 : 0;
    if (sofaAct === 'newspaper') {
      eyeShift = Math.floor(sofaElapsed * 1.4) % 2 === 0 ? -1 : 1;
    }
    const blink = tick % 230 > 224 || isSippingTea;
    if (!blink) {
      pxRect(ctx, x - 4 + eyeShift, y - 15 + yOff, 2, 3, '#2D1E16');
      pxRect(ctx, x + 2 + eyeShift, y - 15 + yOff, 2, 3, '#2D1E16');
    } else {
      pxRect(ctx, x - 4 + eyeShift, y - 13 + yOff, 3, 1, '#2D1E16');
      pxRect(ctx, x + 1 + eyeShift, y - 13 + yOff, 3, 1, '#2D1E16');
    }
  } else {
    // Facing away (looking at monitor/north wall)
    pxRect(ctx, x - 7, y - 21 + yOff, 14, 12, '#6A422B');
    pxRect(ctx, x - 5, y - 10 + yOff, 10, 2, '#5A3724');
  }

  // Foreground sofa activity props (drawn cleanly in front of player torso/hands)
  if (sofaAct === 'tea') {
    const cupX = isSippingTea ? x - 1 : x + 3;
    const cupY = isSippingTea ? y - 11 + yOff : y - 6 + yOff;
    pxRect(ctx, cupX, cupY, 7, 6, '#FAF6F0'); // Cream ceramic teacup
    pxRect(ctx, cupX + 1, cupY + 1, 5, 2, '#B46938'); // Warm amber tea
    pxRect(ctx, cupX + 7, cupY + 1, 2, 3, '#EFE5D5'); // Cup handle
    // Gentle rising pixel steam from hot teacup
    const steam = Math.floor(tick / 12) % 4;
    pxRect(ctx, cupX + 2 + (steam % 2), cupY - 3 - steam, 2, 2, 'rgba(255,250,240,0.7)');
    if (steam > 1) {
      pxRect(ctx, cupX + 4, cupY - 6 - (steam % 2), 1, 2, 'rgba(255,250,240,0.45)');
    }
  } else if (sofaAct === 'newspaper') {
    const nx = x - 11;
    const ny = y - 10 + yOff + paperRustle;
    // Open broadsheet newspaper (left & right folded pages)
    pxRect(ctx, nx, ny, 22, 13, '#C7BBA8');
    pxRect(ctx, nx + 1, ny + 1, 9, 11, '#F5EFE6');
    pxRect(ctx, nx + 12, ny + 1, 9, 11, '#EFE7DC');
    pxRect(ctx, nx + 10, ny + 1, 2, 11, '#B3A490'); // Center fold crease
    // Tiny headline & news column pixel lines
    pxRect(ctx, nx + 2, ny + 2, 7, 2, '#3B312B');
    pxRect(ctx, nx + 2, ny + 5, 6, 1, '#7A6E63');
    pxRect(ctx, nx + 2, ny + 7, 7, 1, '#7A6E63');
    pxRect(ctx, nx + 2, ny + 9, 5, 1, '#7A6E63');
    pxRect(ctx, nx + 13, ny + 2, 7, 3, '#9BA8B4'); // Photo thumbnail
    pxRect(ctx, nx + 13, ny + 7, 7, 1, '#7A6E63');
    pxRect(ctx, nx + 13, ny + 9, 6, 1, '#7A6E63');
    // Hands gripping left & right edges of newspaper
    pxRect(ctx, nx - 1, ny + 5, 3, 3, '#F6CCB0');
    pxRect(ctx, nx + 20, ny + 5, 3, 3, '#F6CCB0');
  } else if (sofaAct === 'tv_remote') {
    const rx = x + 7;
    const ry = y + (isAimingRemote ? 2 : -1) + yOff;
    pxRect(ctx, rx, ry, 4, 8, '#262321'); // Sleek dark remote body
    pxRect(ctx, rx + 1, ry + 2, 2, 1, '#94A3B8'); // Tiny buttons
    pxRect(ctx, rx + 1, ry + 4, 2, 1, '#CBD5E1');
    // Red IR transmitter pulse when pressing button to turn on TV
    if (isAimingRemote && Math.floor(tick / 5) % 2 === 0) {
      pxRect(ctx, rx + 1, ry + 8, 2, 2, '#EF4444');
      pxRect(ctx, rx, ry + 11, 4, 1, 'rgba(252, 165, 165, 0.75)');
    }
  }
}
