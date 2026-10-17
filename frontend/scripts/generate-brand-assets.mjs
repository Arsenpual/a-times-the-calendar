// Generated derivatives share the exact master paths; no font or image dependency.
// Run from frontend with: node scripts/generate-brand-assets.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
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
const adaptive = mono.replace('role="img"', 'style="color-scheme:light dark" role="img"')
  .replace('<g fill="#1C1C1A">', '<style>@media(prefers-color-scheme:dark){.ink{fill:#F2F1ED}}</style><g class="ink" fill="#1C1C1A">')
  .replace('<path fill="#1C1C1A"', '<path class="ink" fill="#1C1C1A"');
await writeFile(new URL("txph-favicon.svg", assets), adaptive);

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
  for (const size of [16, 32]) await render(`txph-favicon-${size}.png`, size, size, mono, "#F2F1ED");
  for (const size of [180, 192, 512]) await render(`txph-icon-${size}.png`, size, size, square, "#1C1C1A");
  await render("txph-social.png", 1200, 630, dark, "#1C1C1A", 900);
  const preview = new URL("../branding/preview/", import.meta.url);
  await mkdir(preview, { recursive: true });
  await page.setViewportSize({ width: 960, height: 600 });
  await page.setContent(`<style>body{margin:0;font:14px Arial;background:#F2F1ED;color:#1C1C1A}.row{padding:32px;display:flex;align-items:center;gap:48px;height:236px;box-sizing:border-box}.dark{background:#1C1C1A;color:#F2F1ED}.sizes{display:grid;gap:24px}img{display:block}</style>${[[master,""],[dark,"dark"]].map(([svg,cls])=>`<div class="row ${cls}"><img alt="TXph display" width="460" src="${svgImage(svg)}"><div class="sizes">${[154,120,80].map(w=>`<div>${w}px<img alt="TXph ${w}px" width="${w}" src="${svgImage(svg)}"></div>`).join("")}</div></div>`).join("")}<div class="row" style="height:128px">${[16,32].map(s=>`<img alt="favicon ${s}" width="${s}" src="${svgImage(mono)}">`).join("")}<span>TXph · wordmark / UI / favicon</span></div>`);
  await page.screenshot({ path: new URL("txph-brand-sheet.png", preview).pathname.replace(/^\/(?=[A-Za-z]:)/, "") });
  console.log("Generated TXph light, dark, monochrome, favicon, OS icons, social image and preview.");
} finally {
  await browser.close();
}
