// Straight perspective geometry shared by the portal asset family.
const outer = { l: 56, t: 56, r: 456, b: 456 };
const inner = { l: 96, t: 220, r: 168, b: 292 };
const round = value => Number(value.toFixed(2));
const frame = t => {
  const r = Object.fromEntries(Object.keys(outer).map(key => [key, round(outer[key] + (inner[key] - outer[key]) * t)]));
  return `M${r.l} ${r.t}H${r.r}V${r.b}H${r.l}Z`;
};

export function createTimePortalSvg({ compact = false } = {}) {
  if (compact) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-labelledby="title">
  <title id="title">Time portal</title>
  <!-- Fewer depth planes and wider strokes preserve the doorway at tab size. -->
  <g fill="none" stroke="#D85A30" stroke-width="3" stroke-linejoin="miter">
    <path d="M6 6H58V58H6Z M9.3 17H39.3V47H9.3Z M12 26H24V38H12Z"/>
    <path stroke-width="2.5" d="M6 6L12 26 M58 6L24 26 M58 58L24 38 M6 58L12 38"/>
  </g>
</svg>\n`;
  }
  const rays = [];
  for (const u of [.2, .4, .6, .8]) {
    rays.push(
      `M${round(56 + 400 * u)} 56L${round(96 + 72 * u)} 220`,
      `M${round(56 + 400 * u)} 456L${round(96 + 72 * u)} 292`,
      `M56 ${round(56 + 400 * u)}L96 ${round(220 + 72 * u)}`,
      `M456 ${round(56 + 400 * u)}L168 ${round(220 + 72 * u)}`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">
  <title id="title">T.i.M.E.S. — Time portal</title>
  <desc id="desc">An open wireframe passage with four perspective planes converging on a square doorway to the left. No lettering or clock symbols.</desc>
  <!-- A finite grid draws the eye into the empty doorway; no gradients or fonts. -->
  <g fill="none" stroke="#D85A30" stroke-linejoin="miter" stroke-linecap="butt">
    <g stroke-width="3" opacity=".62">
      <path d="${[.24, .44, .62, .76, .88].map(frame).join(' ')}"/>
      <path d="${rays.join(' ')}"/>
    </g>
    <path stroke-width="5" d="M56 56L96 220 M456 56L168 220 M456 456L168 292 M56 456L96 292"/>
    <path stroke-width="7" d="${frame(0)}"/>
    <path stroke-width="8" d="${frame(1)}"/>
  </g>
</svg>\n`;
}
