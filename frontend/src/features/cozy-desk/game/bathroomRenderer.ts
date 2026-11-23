import type { PlayerState } from '../types/game';
import { MID_WALL_ROW, TILE } from './houseMap';

export function isSoapInHolder(player?: PlayerState): boolean {
  if (!player || !player.isShowering || !player.showerPhase) {
    return true;
  }
  if (player.showerPhase === 'wetting' || player.showerPhase === 'rinse') {
    return true;
  }
  if (player.showerPhase === 'grab_soap') {
    return player.showerPhaseElapsed < 0.72;
  }
  if (player.showerPhase === 'return_soap') {
    return player.showerPhaseElapsed >= 0.75;
  }
  return false;
}

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

export function drawBathroomFurniture(
  ctx: CanvasRenderingContext2D,
  tick: number,
  player?: PlayerState
) {
  // 1. Wide Family Vanity Sink Cabinet (NE of West Bathroom: cols 5.3..8.65, rows 13.85..15.1)
  const vx = Math.round(5.3 * TILE);
  const vy = Math.round(13.85 * TILE);
  const vw = Math.round(3.35 * TILE);
  const vh = Math.round(1.25 * TILE);
  pxRect(ctx, vx + 2, vy + vh - 1, vw - 4, 5, 'rgba(30, 45, 48, 0.22)');
  pxRect(ctx, vx, vy, vw, vh, '#5C3D28');
  pxRect(ctx, vx + 2, vy + 2, vw - 4, vh - 11, '#EFECE6');
  pxRect(ctx, vx + 3, vy + 3, vw - 6, 2, '#FFFFFF');
  pxRect(ctx, vx + 3, vy + vh - 9, 31, 7, '#875D3E');
  pxRect(ctx, vx + 37, vy + vh - 9, 33, 7, '#875D3E');
  pxRect(ctx, vx + 73, vy + vh - 9, 31, 7, '#875D3E');
  pxRect(ctx, vx + 16, vy + vh - 7, 5, 2, '#E8C57B');
  pxRect(ctx, vx + 51, vy + vh - 7, 5, 2, '#E8C57B');
  pxRect(ctx, vx + 86, vy + vh - 7, 5, 2, '#E8C57B');

  pxRect(ctx, vx + 7, vy + 10, 10, 10, '#C97B56');
  pxRect(ctx, vx + 6, vy + 5, 12, 7, '#4D8461');
  pxRect(ctx, vx + 8, vy + 3, 8, 4, '#6AA67F');
  pxRect(ctx, vx + 21, vy + 11, 10, 11, '#FAF6F0');
  pxRect(ctx, vx + 22, vy + 15, 8, 2, '#D8CEBF');

  pxRect(ctx, vx + 37, vy + 7, 34, 18, '#B8C6CA');
  pxRect(ctx, vx + 39, vy + 9, 30, 14, '#FFFFFF');
  pxRect(ctx, vx + 42, vy + 11, 24, 10, '#E7F1F3');
  pxRect(ctx, vx + 52, vy + 15, 4, 4, '#7E9095');
  pxRect(ctx, vx + 52, vy + 3, 4, 7, '#BCCAD0');
  pxRect(ctx, vx + 53, vy + 4, 2, 5, '#FAFDFE');

  pxRect(ctx, vx + 77, vy + 9, 7, 9, '#6B9080');
  pxRect(ctx, vx + 79, vy + 6, 3, 3, '#E2E8F0');
  pxRect(ctx, vx + 90, vy + 10, 8, 9, '#DFD4C4');
  pxRect(ctx, vx + 91, vy + 5, 2, 6, '#38BDF8');
  pxRect(ctx, vx + 95, vy + 6, 2, 5, '#FB7185');

  // 2. Corner Shower Glass Caddy Shelf with Shampoo & Soap Bottles (NW corner inside shower)
  const cx = Math.round(1.05 * TILE);
  const cy = Math.round(14.0 * TILE);
  pxRect(ctx, cx, cy, 22, 22, 'rgba(180, 225, 235, 0.45)');
  pxRect(ctx, cx, cy + 20, 22, 2, '#6A838A');
  pxRect(ctx, cx + 20, cy, 2, 22, '#6A838A');
  pxRect(ctx, cx + 3, cy + 4, 5, 11, '#3B82A0');
  pxRect(ctx, cx + 4, cy + 2, 3, 2, '#FAF6F0');
  pxRect(ctx, cx + 10, cy + 6, 5, 9, '#E8A85A');
  pxRect(ctx, cx + 16, cy + 11, 4, 6, '#F4E29C');

  // 2b. Dedicated Wall-Mounted Soap Dish / Soap Holder (ที่เก็บสบู่) on WEST shower wall
  const shx = Math.round(1.12 * TILE);
  const shy = Math.round(14.95 * TILE);
  pxRect(ctx, shx + 1, shy + 11, 18, 3, 'rgba(30, 45, 48, 0.22)');
  pxRect(ctx, shx, shy, 19, 12, '#647C84');
  pxRect(ctx, shx + 2, shy + 2, 15, 8, '#E6F0F2');
  pxRect(ctx, shx + 4, shy + 4, 11, 4, '#C6D9DD');
  if (isSoapInHolder(player)) {
    pxRect(ctx, shx + 4, shy + 2, 11, 6, '#F48C72');
    pxRect(ctx, shx + 5, shy + 3, 9, 4, '#FDA890');
    pxRect(ctx, shx + 6, shy + 3, 4, 1, '#FFF3EE');
  } else {
    pxRect(ctx, shx + 6, shy + 5, 3, 2, 'rgba(255, 255, 255, 0.78)');
    pxRect(ctx, shx + 11, shy + 4, 2, 2, 'rgba(255, 255, 255, 0.65)');
  }

  // 3. East Wall Towel Rack & Small Shelf (SE below Bathroom <-> Kitchen doorway: cols 8.2..8.92, rows 18.35..19.55)
  const trx = Math.round(8.2 * TILE);
  const tryY = Math.round(18.35 * TILE);
  pxRect(ctx, trx + 2, tryY + 36, 18, 4, 'rgba(30, 45, 48, 0.2)');
  pxRect(ctx, trx, tryY, 20, 38, '#6B4930');
  pxRect(ctx, trx + 2, tryY + 2, 16, 34, '#8D6344');
  pxRect(ctx, trx + 3, tryY + 5, 13, 11, '#F4EFE6');
  pxRect(ctx, trx + 3, tryY + 13, 13, 2, '#D8CEBF');
  pxRect(ctx, trx + 3, tryY + 20, 13, 13, '#739A90');
  pxRect(ctx, trx + 3, tryY + 29, 13, 2, '#587A71');

  // 4. Tall Wooden Linen & Towel Storage Cabinet (SE corner: cols 7.55..8.9, rows 19.95..21.8)
  const lcx = Math.round(7.55 * TILE);
  const lcy = Math.round(19.95 * TILE);
  const lcw = Math.round(1.35 * TILE);
  const lch = Math.round(1.85 * TILE);
  pxRect(ctx, lcx + 2, lcy + lch - 1, lcw - 4, 5, 'rgba(30, 45, 48, 0.24)');
  pxRect(ctx, lcx, lcy, lcw, lch, '#5B3E2A');
  pxRect(ctx, lcx + 3, lcy + 3, lcw - 6, lch - 6, '#8B6244');
  pxRect(ctx, lcx + 5, lcy + 7, lcw - 10, 14, '#4B3222');
  pxRect(ctx, lcx + 7, lcy + 14, 15, 5, '#FAF6F0');
  pxRect(ctx, lcx + 7, lcy + 9, 14, 5, '#739A90');
  pxRect(ctx, lcx + 25, lcy + 11, 9, 8, '#FAF6F0');
  pxRect(ctx, lcx + 5, lcy + 25, lcw - 10, lch - 30, '#785237');
  for (let sy = lcy + 29; sy < lcy + lch - 8; sy += 5) {
    pxRect(ctx, lcx + 8, sy, lcw - 16, 2, '#62412A');
  }
  pxRect(ctx, lcx + 28, lcy + 1, 9, 7, '#C97B56');
  pxRect(ctx, lcx + 27, lcy - 4, 11, 6, '#4D8461');
  pxRect(ctx, lcx + 29, lcy - 6, 7, 4, '#6AA67F');

  // 5. Ceramic Flush Toilet, Toilet Paper Holder & Chrome Bidet Sprayer (south-center: cols 5.35..6.7, rows 20.35..21.8)
  const wcx = Math.round(5.35 * TILE);
  const wcy = Math.round(20.35 * TILE);
  const wcw = Math.round(1.35 * TILE);
  const wch = Math.round(1.45 * TILE);
  pxRect(ctx, wcx + 4, wcy + wch - 2, wcw - 8, 5, 'rgba(30, 45, 48, 0.22)');
  pxRect(ctx, wcx + 7, wcy + 2, 29, 28, '#B8C6CA');
  pxRect(ctx, wcx + 9, wcy + 4, 25, 24, '#FFFFFF');
  pxRect(ctx, wcx + 12, wcy + 7, 19, 18, '#EDF4F5');
  pxRect(ctx, wcx + 11, wcy, 21, 4, '#E2ECEE');
  pxRect(ctx, wcx + 3, wcy + 29, 37, 16, '#BAC8CC');
  pxRect(ctx, wcx + 5, wcy + 31, 33, 12, '#F7FAFA');
  pxRect(ctx, wcx + 18, wcy + 35, 7, 3, '#94A6AB');
  pxRect(ctx, wcx - 4, wcy + 31, 7, 10, '#FAF6F0');
  pxRect(ctx, wcx - 3, wcy + 34, 4, 4, '#D6CFC4');
  pxRect(ctx, wcx + 40, wcy + 32, 5, 9, '#9AAAB0');
  pxRect(ctx, wcx + 41, wcy + 33, 3, 6, '#E2ECEF');

  // 6. Covered Bamboo-Lid Bathroom Pedal Bin (beside toilet: cols 4.55..5.2, rows 21.0..21.72)
  const bbx = Math.round(4.55 * TILE);
  const bby = Math.round(21.0 * TILE);
  pxRect(ctx, bbx + 2, bby + 20, 17, 4, 'rgba(30, 45, 48, 0.2)');
  pxRect(ctx, bbx + 1, bby + 1, 18, 20, '#C6C1B8');
  pxRect(ctx, bbx + 3, bby + 3, 14, 16, '#EFECE6');
  pxRect(ctx, bbx + 3, bby + 3, 14, 6, '#C49A6C');

  // 7. Woven Rattan Laundry Hamper (cols 2.9..3.95, rows 20.25..21.65)
  const hx = Math.round(2.9 * TILE);
  const hy = Math.round(20.25 * TILE);
  const hw = Math.round(1.05 * TILE);
  const hh = Math.round(1.4 * TILE);
  pxRect(ctx, hx + 2, hy + hh - 1, hw - 4, 5, 'rgba(30, 45, 48, 0.22)');
  pxRect(ctx, hx, hy, hw, hh, '#7A5434');
  pxRect(ctx, hx + 2, hy + 2, hw - 4, hh - 4, '#B58455');
  for (let wy = hy + 14; wy < hy + hh - 3; wy += 5) {
    pxRect(ctx, hx + 3, wy, hw - 6, 2, '#9A6C42');
  }
  pxRect(ctx, hx + 4, hy + 4, hw - 8, 9, '#EDE7DC');
  pxRect(ctx, hx + 7, hy + 5, 11, 6, '#93B8C4');
  pxRect(ctx, hx + 18, hy + 6, 8, 6, '#F4EFE6');

  // 8. Front-Load Washing Machine (SW corner: cols 1.1..2.7, rows 19.95..21.8)
  const wmx = Math.round(1.1 * TILE);
  const wmy = Math.round(19.95 * TILE);
  const wmw = Math.round(1.6 * TILE);
  const wmh = Math.round(1.85 * TILE);
  pxRect(ctx, wmx + 2, wmy + wmh - 1, wmw - 4, 5, 'rgba(30, 45, 48, 0.26)');
  pxRect(ctx, wmx, wmy, wmw, wmh, '#8B9BA0');
  pxRect(ctx, wmx + 2, wmy + 2, wmw - 4, wmh - 4, '#F1F5F6');
  pxRect(ctx, wmx + 3, wmy + 3, wmw - 6, 18, '#E4ECEE');
  pxRect(ctx, wmx + 6, wmy + 5, 10, 12, '#3B82B8');
  pxRect(ctx, wmx + 8, wmy + 3, 6, 3, '#FAF6F0');
  pxRect(ctx, wmx + 22, wmy + 6, 20, 11, '#E8DFD1');
  pxRect(ctx, wmx + 24, wmy + 8, 16, 7, '#739A90');
  pxRect(ctx, wmx + 2, wmy + 22, wmw - 4, 9, '#D5E0E3');
  pxRect(ctx, wmx + 5, wmy + 24, 11, 5, '#F8FAFC');
  pxRect(ctx, wmx + 23, wmy + 24, 6, 5, '#596A70');
  pxRect(ctx, wmx + 35, wmy + 25, 8, 3, '#253137');
  pxRect(ctx, wmx + 37, wmy + 26, 4, 1, Math.floor(tick / 24) % 2 === 0 ? '#4ADE80' : '#22C55E');
  pxRect(ctx, wmx + 13, wmy + 33, 25, 21, '#687980');
  pxRect(ctx, wmx + 16, wmy + 35, 19, 17, '#2A3942');
  pxRect(ctx, wmx + 19, wmy + 38, 13, 11, '#3B5260');
  pxRect(ctx, wmx + 20, wmy + 39, 4, 3, 'rgba(219, 244, 255, 0.55)');
}

/**
 * Draws the frameless tempered glass walls, automatic shower water streams,
 * and smart opaque/frosted privacy glass enclosure for the NW West Bathroom Glass Shower.
 * Rendered after characters so walking inside the shower places the player behind the privacy glass.
 */
export function drawGlassShowerEnclosure(
  ctx: CanvasRenderingContext2D,
  tick: number,
  player?: PlayerState
) {
  const gxLeft = Math.round(1.02 * TILE); // Meets west outer wall
  const gxEast = Math.round(4.35 * TILE); // East glass partition X
  const gyTop = Math.round(13.9 * TILE); // Top meets bathroom north wall
  const gyDoorTop = Math.round(16.12 * TILE); // Top of sliding door opening
  const gyBot = Math.round(17.98 * TILE); // South glass curb Y
  const southW = gxEast + 7 - gxLeft;

  const privacy = Math.max(0, Math.min(1, player?.showerPrivacyProgress ?? 0));
  const isShowering = Boolean(player?.isShowering || privacy > 0.02);
  const shPipeX = Math.round(2.3 * TILE);
  const wallFaceY = MID_WALL_ROW * TILE + 18;
  const drainX = Math.round(2.55 * TILE);
  const drainY = Math.round(15.9 * TILE);

  // 0. Automatic Rain Shower Water Streams & Floor Splash
  if (isShowering) {
    const streamTopY = wallFaceY + 13;
    const streamBotY = Math.round(16.05 * TILE);
    const phase = tick % 6;
    const columns = [-8, -5, -2, 1, 4, 7, 10];
    for (let c = 0; c < columns.length; c++) {
      const sx = shPipeX + columns[c];
      const sway = (c + Math.floor(tick / 4)) % 2 === 0 ? 0 : 1;
      for (let sy = streamTopY + ((c * 3 + phase) % 6); sy < streamBotY; sy += 7) {
        const len = sy < gyTop ? 4 : 5;
        const alpha = sy < gyTop ? 0.86 : 0.62;
        pxRect(
          ctx,
          sx + sway,
          sy,
          1,
          len,
          `rgba(195, 242, 255, ${(alpha * Math.max(0.35, privacy)).toFixed(2)})`
        );
      }
    }

    const splashStep = Math.floor(tick / 4) % 3;
    pxRect(ctx, drainX - 9 - splashStep, drainY - 2, 4, 1, 'rgba(210, 248, 255, 0.72)');
    pxRect(ctx, drainX + 6 + splashStep, drainY + 1, 4, 1, 'rgba(210, 248, 255, 0.72)');
    pxRect(ctx, drainX - 4, drainY + 6 + splashStep, 6, 1, 'rgba(210, 248, 255, 0.65)');
    pxRect(ctx, drainX - 3, drainY - 7 - splashStep, 5, 1, 'rgba(210, 248, 255, 0.6)');
  }

  // 1. Smart Privacy Frosted Glass Screen covering the NW shower zone ONLY while showering
  if (privacy > 0.01 && player) {
    const stallX = gxLeft;
    const stallY = gyTop;
    const stallW = gxEast - stallX;
    const stallH = gyBot - stallY;

    const baseFrostAlpha = (0.58 * privacy).toFixed(3);
    pxRect(ctx, stallX, stallY, stallW, stallH, `rgba(186, 216, 223, ${baseFrostAlpha})`);

    for (let fy = stallY + 3; fy < gyBot - 2; fy += 5) {
      pxRect(
        ctx,
        stallX + 2,
        fy,
        stallW - 4,
        2,
        `rgba(226, 244, 248, ${(0.28 * privacy).toFixed(3)})`
      );
      pxRect(
        ctx,
        stallX + 2,
        fy + 2,
        stallW - 4,
        1,
        `rgba(134, 168, 176, ${(0.22 * privacy).toFixed(3)})`
      );
    }
    for (let fx = stallX + 10; fx < gxEast - 6; fx += 14) {
      pxRect(
        ctx,
        fx,
        stallY + 2,
        1,
        stallH - 4,
        `rgba(240, 252, 255, ${(0.2 * privacy).toFixed(3)})`
      );
    }

    // High-opacity pixel-frosted privacy censor grid directly over character's mid/lower body
    const px = Math.round(player.x);
    const py = Math.round(player.y);
    const censorX = Math.max(stallX + 2, px - 12);
    const censorY = Math.max(stallY + 4, py - 11);
    const censorW = Math.min(24, gxEast - censorX - 2);
    const censorH = 18;
    for (let cy = 0; cy < censorH; cy += 3) {
      for (let cx = 0; cx < censorW; cx += 3) {
        const isLight = ((cx / 3 + cy / 3 + Math.floor(tick / 10)) | 0) % 2 === 0;
        const blockColor = isLight
          ? `rgba(206, 231, 236, ${(0.84 * privacy).toFixed(3)})`
          : `rgba(176, 208, 216, ${(0.88 * privacy).toFixed(3)})`;
        pxRect(ctx, censorX + cx, censorY + cy, 3, 3, blockColor);
      }
    }

    // Faint through-glass silhouette & action indicators (reaching LEFT to west wall soap dish)
    const phase = player.showerPhase ?? 'wetting';
    const elapsed = player.showerPhaseElapsed;
    const shx = Math.round(1.12 * TILE);
    const shy = Math.round(14.95 * TILE);

    pxRect(ctx, shx, shy, 18, 10, `rgba(110, 142, 150, ${(0.45 * privacy).toFixed(2)})`);
    if (isSoapInHolder(player)) {
      pxRect(ctx, shx + 4, shy + 2, 10, 5, `rgba(248, 150, 126, ${(0.62 * privacy).toFixed(2)})`);
    }

    if (phase === 'grab_soap') {
      const t = Math.min(1, elapsed / 1.5);
      const reachT = t < 0.5 ? t * 2 : (1 - t) * 2;
      const handX = Math.round(px - 6 + (shx + 12 - (px - 6)) * reachT);
      const handY = Math.round(py - 7 + (shy + 3 - (py - 7)) * reachT);
      const armX = Math.min(px - 5, handX);
      const armW = Math.max(4, px - 4 - armX);
      pxRect(ctx, armX, handY, armW, 4, `rgba(165, 132, 114, ${(0.46 * privacy).toFixed(2)})`);
      if (t >= 0.45) {
        pxRect(ctx, handX - 2, handY - 1, 7, 5, `rgba(250, 154, 130, ${(0.68 * privacy).toFixed(2)})`);
        pxRect(ctx, handX - 1, handY, 5, 3, `rgba(255, 224, 212, ${(0.55 * privacy).toFixed(2)})`);
      }
    } else if (phase === 'scrub_soap') {
      const scrubWave = Math.sin(tick * 0.35);
      const soapX = Math.round(px - 2 + scrubWave * 7);
      const soapY = Math.round(py - 9 + Math.cos(tick * 0.25) * 3);
      pxRect(ctx, soapX - 2, soapY, 9, 5, `rgba(165, 132, 114, ${(0.45 * privacy).toFixed(2)})`);
      pxRect(ctx, soapX, soapY - 1, 7, 5, `rgba(250, 154, 130, ${(0.65 * privacy).toFixed(2)})`);
      const foamSpots = [
        { dx: -8, dy: -18, s: 5 },
        { dx: 3, dy: -19, s: 4 },
        { dx: -9, dy: -9, s: 6 },
        { dx: 4, dy: -8, s: 5 },
        { dx: -4, dy: -12, s: 6 },
        { dx: -6, dy: -4, s: 5 },
        { dx: 3, dy: -4, s: 5 },
      ];
      foamSpots.forEach((f, idx) => {
        const bob = Math.sin(tick * 0.2 + idx * 1.3) * 1.5;
        pxRect(
          ctx,
          Math.round(px + f.dx + bob),
          Math.round(py + f.dy),
          f.s,
          f.s - 1,
          `rgba(255, 255, 255, ${(0.66 * privacy).toFixed(2)})`
        );
      });
      const b1Y = py - 20 - ((tick + 5) % 16);
      const b2Y = py - 16 - ((tick + 13) % 16);
      pxRect(ctx, px - 11 + (tick % 3), b1Y, 3, 3, `rgba(255, 255, 255, ${(0.72 * privacy).toFixed(2)})`);
      pxRect(ctx, px + 9 - (tick % 3), b2Y, 3, 3, `rgba(240, 253, 255, ${(0.68 * privacy).toFixed(2)})`);
    } else if (phase === 'return_soap') {
      const t = Math.min(1, elapsed / 1.5);
      const reachT = t < 0.5 ? t * 2 : (1 - t) * 2;
      const handX = Math.round(px - 6 + (shx + 12 - (px - 6)) * reachT);
      const handY = Math.round(py - 7 + (shy + 3 - (py - 7)) * reachT);
      const armX = Math.min(px - 5, handX);
      const armW = Math.max(4, px - 4 - armX);
      pxRect(ctx, armX, handY, armW, 4, `rgba(165, 132, 114, ${(0.46 * privacy).toFixed(2)})`);
      if (t < 0.52) {
        pxRect(ctx, handX - 2, handY - 1, 7, 5, `rgba(250, 154, 130, ${(0.68 * privacy).toFixed(2)})`);
      }
    } else if (phase === 'rinse') {
      const fade = Math.max(0, 1 - elapsed / 2.0);
      if (fade > 0.1) {
        const dropY = Math.round((elapsed * 10) % 12);
        pxRect(ctx, px - 6, py - 10 + dropY, 4, 3, `rgba(255, 255, 255, ${(0.5 * fade * privacy).toFixed(2)})`);
        pxRect(ctx, px + 3, py - 8 + dropY, 4, 3, `rgba(255, 255, 255, ${(0.45 * fade * privacy).toFixed(2)})`);
      }
    }

    for (let c = -6; c <= 8; c += 4) {
      const wy = stallY + 4 + ((tick * 2 + c * 7 + 40) % (stallH - 18));
      pxRect(ctx, shPipeX + c, wy, 1, 5, `rgba(230, 250, 255, ${(0.52 * privacy).toFixed(2)})`);
    }

    const steamDrift = Math.floor(tick / 12) % 6;
    pxRect(ctx, stallX + 12 + (steamDrift % 3), stallY + 6 - steamDrift, 18, 5, `rgba(245, 252, 255, ${(0.34 * privacy).toFixed(2)})`);
    pxRect(ctx, stallX + 46 - (steamDrift % 3), stallY + 10 - ((steamDrift + 3) % 6), 20, 5, `rgba(245, 252, 255, ${(0.3 * privacy).toFixed(2)})`);

    pxRect(ctx, stallX + 14, stallY + 18, 18, 3, `rgba(255, 255, 255, ${(0.36 * privacy).toFixed(2)})`);
    pxRect(ctx, stallX + 22, stallY + 24, 12, 3, `rgba(255, 255, 255, ${(0.24 * privacy).toFixed(2)})`);
    pxRect(ctx, stallX + 58, stallY + 68, 20, 3, `rgba(255, 255, 255, ${(0.32 * privacy).toFixed(2)})`);
    pxRect(ctx, stallX + 66, stallY + 74, 14, 3, `rgba(255, 255, 255, ${(0.22 * privacy).toFixed(2)})`);
  }

  // 2. East fixed tempered glass partition panel (rows 13.9..16.12)
  const eastPanelH = gyDoorTop - gyTop;
  const eastGlassColor =
    privacy > 0.05
      ? `rgba(176, 212, 220, ${(0.44 + 0.44 * privacy).toFixed(2)})`
      : 'rgba(182, 226, 236, 0.44)';
  pxRect(ctx, gxEast, gyTop, 7, eastPanelH, eastGlassColor);
  pxRect(ctx, gxEast + 5, gyTop, 2, eastPanelH, '#4E636A');
  pxRect(ctx, gxEast, gyTop, 2, eastPanelH, '#678088');
  pxRect(ctx, gxEast + 2, gyTop + 12, 3, 10, 'rgba(255, 255, 255, 0.52)');
  pxRect(ctx, gxEast + 2, gyTop + 42, 3, 8, 'rgba(255, 255, 255, 0.4)');

  // 3. Sliding glass door across east doorway opening (rows 16.12..17.98) — closes & turns opaque when showering
  const doorFullH = gyBot - gyDoorTop;
  const closedDoorH = Math.round(doorFullH * privacy);
  pxRect(ctx, gxEast + 1, gyDoorTop, 4, doorFullH, 'rgba(198, 234, 242, 0.16)');
  if (closedDoorH > 2) {
    pxRect(ctx, gxEast, gyDoorTop, 7, closedDoorH, 'rgba(172, 208, 216, 0.92)');
    pxRect(ctx, gxEast + 5, gyDoorTop, 2, closedDoorH, '#455A61');
    pxRect(ctx, gxEast, gyDoorTop, 2, closedDoorH, '#5F7880');
    for (let dy = gyDoorTop + 4; dy < gyDoorTop + closedDoorH - 3; dy += 6) {
      pxRect(ctx, gxEast + 2, dy, 3, 2, 'rgba(235, 248, 252, 0.65)');
    }
    const handleY = Math.max(gyDoorTop + 4, gyDoorTop + closedDoorH - 18);
    pxRect(ctx, gxEast - 2, handleY, 2, 12, '#E2EEF2');
    pxRect(ctx, gxEast + 7, handleY, 2, 12, '#E2EEF2');
  } else {
    pxRect(ctx, gxEast - 2, gyDoorTop - 16, 2, 12, '#D8E5E9');
    pxRect(ctx, gxEast + 7, gyDoorTop - 16, 2, 12, '#D8E5E9');
  }
  pxRect(ctx, gxEast + 2, gyDoorTop, 2, 4, '#5E747C');
  pxRect(ctx, gxEast + 2, gyBot - 4, 2, 4, '#5E747C');

  // 4. South tempered glass wall & raised tiled water curb (cols 1.02..4.57, y=17.98*TILE)
  pxRect(ctx, gxLeft, gyBot + 7, southW, 4, 'rgba(30, 45, 48, 0.18)');
  pxRect(ctx, gxLeft, gyBot + 2, southW, 6, '#8FA5AA');
  pxRect(ctx, gxLeft + 2, gyBot + 3, southW - 4, 4, '#E8F0F1');
  const southGlassColor =
    privacy > 0.05
      ? `rgba(176, 212, 220, ${(0.34 + 0.56 * privacy).toFixed(2)})`
      : 'rgba(182, 226, 236, 0.34)';
  pxRect(ctx, gxLeft, gyBot - 16, southW, 19, southGlassColor);
  pxRect(ctx, gxLeft, gyBot - 16, southW, 2, '#536A72');
  pxRect(ctx, gxLeft, gyBot - 14, southW, 1, 'rgba(255, 255, 255, 0.55)');
  const shimmer = Math.floor(tick / 45) % 2;
  pxRect(ctx, gxLeft + 16 + shimmer * 2, gyBot - 13, 12, 3, 'rgba(255, 255, 255, 0.42)');
  pxRect(ctx, gxLeft + 24 + shimmer * 2, gyBot - 9, 10, 3, 'rgba(255, 255, 255, 0.28)');
  pxRect(ctx, gxLeft + 68, gyBot - 13, 14, 3, 'rgba(255, 255, 255, 0.38)');
  pxRect(ctx, gxLeft + 76, gyBot - 9, 10, 3, 'rgba(255, 255, 255, 0.25)');
  // Matte-charcoal corner bracket joining east & south glass panels
  pxRect(ctx, gxEast, gyBot - 17, 7, 25, '#4A5F66');
  pxRect(ctx, gxEast + 2, gyBot - 15, 3, 21, '#78929B');

  // 5. Floating action status pill above the frosted shower booth while showering
  if (player?.isShowering && privacy > 0.25) {
    const phase = player.showerPhase ?? 'wetting';
    const statusText =
      phase === 'grab_soap'
        ? 'หยิบสบู่จากที่เก็บสบู่'
        : phase === 'scrub_soap'
          ? 'กำลังถูสบู่...'
          : phase === 'return_soap'
            ? 'วางเก็บสบู่กลับที่เก็บสบู่'
            : phase === 'rinse'
              ? 'ล้างตัวใต้น้ำฝักบัวอัตโนมัติ'
              : 'อาบน้ำอัตโนมัติ · ปิดกระจกทึบ';

    ctx.save();
    ctx.font = '600 10px "IBM Plex Sans Thai", sans-serif';
    const textW = Math.ceil(ctx.measureText(statusText).width);
    const bw = textW + 16;
    const bh = 18;
    const bx = Math.max(8, Math.round(gxLeft + (southW - bw) / 2));
    const by = Math.round(gyTop - 44);

    pxRect(ctx, bx - 1, by - 1, bw + 2, bh + 2, '#5B8E9B');
    pxRect(ctx, bx, by, bw, bh, 'rgba(24, 38, 42, 0.92)');
    pxRect(ctx, bx + 5, by + 7, 4, 4, '#7DD3FC');
    ctx.fillStyle = '#F0F9FF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusText, bx + 12, by + bh / 2 + 0.5);
    ctx.restore();
  }
}
