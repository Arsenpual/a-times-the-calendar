// Generated derivatives share the exact master paths; no font or image dependency.
// Run from frontend with: node scripts/generate-brand-assets.mjs
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createTimePortalSvg } from "./time-portal-geometry.mjs";

const assets = new URL("../public/logo/", import.meta.url);
const master = createTimePortalSvg();
await writeFile(new URL("time-portal.svg", assets), master);
await writeFile(new URL("time-portal-favicon.svg", assets), createTimePortalSvg({ compact: true }));
const dark = master.replaceAll("#D85A30", "#E8703F");
const mono = master.replaceAll("#D85A30", "#1C1C1A");
await writeFile(new URL("time-portal-dark.svg", assets), dark);
await writeFile(new URL("time-portal-mono.svg", assets), mono);
// The compact SVG preserves the straight portal with fewer lines and wider strokes.

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const svgImage = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  async function render(name, width, height, svg, background, imageWidth = width) {
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:${background}}body{display:grid;place-items:center}img{display:block;width:${imageWidth}px;max-width:100%}</style><img alt="Time portal" src="${svgImage(svg)}">`);
    await page.locator("img").evaluate((img) => img.decode());
    await page.screenshot({ path: new URL(name, assets).pathname.replace(/^\/(?=[A-Za-z]:)/, ""), omitBackground: background === "transparent" });
  }
  for (const size of [180, 192, 512]) await render(`time-portal-icon-${size}.png`, size, size, master, "#F2F1ED");
  await render("time-portal-social.png", 1200, 630, dark, "#1C1C1A", 460);
  console.log("Generated the lettering-free time portal SVG variants, OS icons and social image in public/logo.");
} finally {
  await browser.close();
}
