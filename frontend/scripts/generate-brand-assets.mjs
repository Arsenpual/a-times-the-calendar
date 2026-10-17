// Generated derivatives share the exact master paths; no font or image dependency.
// Run from frontend with: node scripts/generate-brand-assets.mjs
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const assets = new URL("../public/logo/", import.meta.url);
const master = await readFile(new URL("txph-wordmark.svg", assets), "utf8");
const dark = master.replaceAll("#1C1C1A", "#F2F1ED");
const mono = master.replaceAll("#D85A30", "#1C1C1A");
await writeFile(new URL("txph-wordmark-dark.svg", assets), dark);
await writeFile(new URL("txph-wordmark-mono.svg", assets), mono);
// Keep all four letters in square OS surfaces, with no separate symbol or enclosure.
const square = dark.replace('viewBox="0 0 352 108"', 'viewBox="0 0 352 352"')
  .replace('<g fill=', '<g transform="translate(0 122)"><g fill=')
  .replace('</svg>', '</g></svg>');
// tx-favicon.svg is a separate, optically adjusted TX master for browser tabs.
// Keep it as SVG rather than deriving a four-letter raster favicon here.

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const svgImage = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  async function render(name, width, height, svg, background, imageWidth = width) {
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:${background}}body{display:grid;place-items:center}img{display:block;width:${imageWidth}px;max-width:100%}</style><img alt="TXph" src="${svgImage(svg)}">`);
    await page.locator("img").evaluate((img) => img.decode());
    await page.screenshot({ path: new URL(name, assets).pathname.replace(/^\/(?=[A-Za-z]:)/, ""), omitBackground: background === "transparent" });
  }
  for (const size of [180, 192, 512]) await render(`txph-icon-${size}.png`, size, size, square, "#1C1C1A");
  await render("txph-social.png", 1200, 630, dark, "#1C1C1A", 900);
  console.log("Generated TXph light, dark, monochrome, OS icons and social image in public/logo.");
} finally {
  await browser.close();
}
