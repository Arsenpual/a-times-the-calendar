import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "../node_modules/vite/dist/node/index.js";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({
  root,
  server: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
await server.listen();

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(`${server.resolvedUrls.local[0]}?activity-mode-mockup=1`);
  await page.locator(".mockup-preview-toggle").waitFor();
  await page.locator(".mockup-preview-toggle").click();

  const options = page.locator(".mockup-preview-picker option");
  assert.ok(await options.count() >= 2, "dev preview should discover mockups lazily");

  await page.waitForFunction(() => {
    const canvas = document.querySelector(".mockup-preview-canvas");
    return canvas && !canvas.textContent.includes("กำลังโหลด mockup");
  });
  assert.deepEqual(errors, []);
  console.log("PASS: dev-only mockup route, picker discovery and lazy component load");
} finally {
  await browser.close();
  await server.close();
}
