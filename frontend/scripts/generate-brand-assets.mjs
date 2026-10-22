// Active identity: original wordmark + calendar/clock icon (never the old solo i).
// The original light/dark wordmarks remain in public/logo/times-original.
// Run from frontend with: node scripts/generate-brand-assets.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const assets = new URL("../public/logo/", import.meta.url);
const master = await readFile(new URL("capsule-favicon.svg", assets), "utf8");
const dark = await readFile(new URL("times-original/times-wordmark-dark.svg", assets), "utf8");

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const svgImage = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  async function render(name, width, height, svg, background, imageWidth = width) {
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:${background}}body{display:grid;place-items:center}img{display:block;width:${imageWidth}px;max-width:100%}</style><img alt="T.i.M.E.S." src="${svgImage(svg)}">`);
    await page.locator("img").evaluate((img) => img.decode());
    await page.screenshot({ path: fileURLToPath(new URL(name, assets)), omitBackground: background === "transparent" });
  }
  for (const size of [32, 180, 512]) await render(`times-icon-${size}.png`, size, size, master, "transparent");
  await render("times-social.png", 1200, 630, dark, "#1C1C1A", 1100);
  console.log("Generated the active calendar/clock PNG sizes and original wordmark social image.");
} finally {
  await browser.close();
}
