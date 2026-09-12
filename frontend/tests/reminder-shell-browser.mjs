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

  await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/reminder-shell.html");
  await page.locator(".topbar-omnibar").fill("test");
  await page.locator(".topbar-omnibar").press("Enter");
  await page.locator(".topbar-telegram-btn").click();
  await page.locator(".telegram-connection-toast-close").click();
  assert.equal(await page.locator(".telegram-connection-toast").count(), 0);
  await page.locator(".btn-snooze").click();
  await page.getByRole("menuitem", { name: "5", exact: true }).click();
  assert.equal(await page.locator(".snooze-menu").count(), 0);
  await page.locator(".btn-snooze").click();
  await page.locator(".dropdown-backdrop").click({ force: true });
  assert.equal(await page.locator(".snooze-menu").count(), 0);
  await page.locator(".btn-mark-done").click();
  await page.getByText("Update handler").click();
  await page.locator(".event-chip").click();
  assert.deepEqual(await page.evaluate(() => window.calls), [
    ["submit", "test"], ["telegram"], ["schedule", "r", 5], ["complete", "r"], ["edit", "r", 1]
  ]);
  const values = await page.evaluate(() => ({
    fields: window.helpers.extractScheduleFields({type:"routine", title:"x", groupId:null, nextDueAt:Infinity, completionCount:3, startedAt:123}),
    draft: window.helpers.createBlankDraft(),
    clock: window.helpers.formatDurationClock(3661),
    snooze: window.helpers.describeReminder({snoozedUntil:61000, nextDueAt:61000}, 1000)
  }));
  assert.deepEqual(values.fields, {type:"routine",title:"x",groupId:null,nextDueAt:null,completedAt:null,completionCount:3});
  assert.equal(values.draft.lineColor, "#fbbc04");
  assert.equal(values.clock, "1:01:01");
  assert.equal(values.snooze, "เลื่อนเตือน · เหลือ 1:00");
  assert.deepEqual(errors, []);
  console.log("PASS: topbar, toast dismissal, snooze, backdrop, complete, fresh timeline callback, sync fields and formatters");

} finally {
  await browser.close();
  await server.close();
}
