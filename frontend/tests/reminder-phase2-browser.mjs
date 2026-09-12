import { createServer } from "../node_modules/vite/dist/node/index.js";
import react from "../node_modules/@vitejs/plugin-react/dist/index.js";
import { pathToFileURL, fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const { chromium } = await import(pathToFileURL(join(tmpdir(), "times-reminder-sync-tests/node_modules/playwright/index.mjs")).href);
const root = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({ root, configFile: false, plugins: [react()], server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/reminder-composer.html");
  await page.locator(".composer-card").waitFor();
  await page.locator("#reminder-title").fill("เตรียมเอกสาร");
  assert.equal(await page.evaluate(() => window.composerFixture.draft.title), "เตรียมเอกสาร");
  await page.locator("#reminder-type").selectOption("weekly");
  await page.getByRole("button", { name: "ศ" }).click();
  await page.getByRole("button", { name: "เพิ่มเวลา" }).click();
  assert.equal((await page.locator(".weekly-time-row").count()), 2);
  await page.getByRole("switch", { name: "เริ่ม Countdown ก่อนเวลาหลัก" }).click();
  await page.locator(".notification-buffer-inputs input").fill("15");
  assert.equal(await page.evaluate(() => window.composerFixture.draft.eventAnchorCountdownAmount), "15");
  await page.locator("#reminder-type").selectOption("interval");
  await page.getByRole("switch").click();
  assert.equal(await page.locator('input[type="time"]').count(), 2);
  await page.locator("#reminder-type").selectOption("countdown");
  await page.locator("#countdown-minutes").fill("45");
  await page.getByRole("button", { name: "น้ำเงิน" }).click();
  assert.equal(await page.evaluate(() => window.composerFixture.draft.lineColor), "#4285f4");
  await page.getByRole("button", { name: "เพิ่ม Reminder" }).click();
  assert.equal(await page.evaluate(() => window.composerFixture.submitCount), 1);
  await page.locator(".composer-backdrop").click({ position: { x: 2, y: 2 } });
  assert.equal(await page.evaluate(() => window.composerFixture.open), false);
  assert.deepEqual(errors, []);
  console.log("PASS browser: composer field variants, preview surface, submit and backdrop cancel; no uncaught errors");
} finally {
  await browser.close();
  await server.close();
}
