import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), configFile: false, resolve: { alias: { "@dev-mockups": fileURLToPath(new URL("../src/app/dev-mockups.production.jsx", import.meta.url)) } }, plugins: [react()], server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ timezoneId: "Asia/Bangkok", viewport: { width: 390, height: 844 } });
  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/header-summary.html`);
  await page.getByRole("button", { name: "วัน", exact: true }).waitFor();
  assert.match(await page.locator(".header-summary-content").innerText(), /2\s*กิจกรรม/);
  assert.match(await page.locator(".header-summary-content").innerText(), /1\s*ชั่วโมงรวม/);
  await page.getByRole("button", { name: "สัปดาห์", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "สัปดาห์", exact: true }).getAttribute("aria-pressed"), "true");
  assert.match(await page.locator(".header-summary-content").innerText(), /4\s*กิจกรรม/);
  await page.getByRole("button", { name: "Cycle", exact: true }).click();
  assert.match(await page.locator(".header-summary-content").innerText(), /วันที่มีกิจกรรม/);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.locator(".header-summary").evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
    assert.ok(layout.scrollWidth <= layout.clientWidth, `summary should fit at ${width}px`);
    assert.ok(layout.height <= 160, `summary should remain compact at ${width}px`);
  }
  console.log("PASS: Header summary period switching, day overlap, all-day and archive handling");
} finally { await browser.close(); await server.close(); }
