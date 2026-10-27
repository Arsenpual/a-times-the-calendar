import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../", import.meta.url));
const devMockupsAlias = fileURLToPath(new URL("../src/app/dev-mockups.production.jsx", import.meta.url));
const server = await createServer({ root, configFile: false, resolve: { alias: { "@dev-mockups": devMockupsAlias } }, plugins: [react()], server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/reminder-header.html");
  const header = page.locator(".app-header");
  const input = header.locator(".topbar-omnibar");
  await input.waitFor();
  assert.equal(await header.count(), 1);
  assert.equal(await page.locator(".app-topbar").count(), 0, "no second Reminder header");
  assert.equal(await page.locator(".brand-wordmark").count(), 1, "one brand mark");
  await input.fill("ทดสอบ Reminder");
  await input.press("Enter");
  assert.deepEqual(await page.evaluate(() => window.headerFixture.submits), ["ทดสอบ Reminder"]);

  await header.getByRole("button", { name: "เมนู Telegram", exact: true }).click();
  await header.getByRole("menuitem", { name: "ปิดการแจ้งเตือน", exact: true }).click();
  assert.equal(await page.evaluate(() => window.headerFixture.alerts), 1);
  await header.getByRole("button", { name: "เมนู Telegram", exact: true }).click();
  await header.getByRole("menuitem", { name: "เปิดแชต", exact: true }).click();
  assert.equal(await page.evaluate(() => window.headerFixture.chats), 1);
  await header.locator(".topbar-actions > .topbar-icon-btn:not(:disabled)").click();
  assert.equal(await page.evaluate(() => window.headerFixture.stats), 1);
  await header.getByRole("button", { name: "เปิดเมนูบัญชีผู้ใช้" }).click();
  await header.getByRole("menuitem", { name: /การตั้งค่า/ }).click();
  assert.equal(await page.evaluate(() => window.headerFixture.settings), 1);
  assert.equal(await header.locator(".topbar-actions > button:disabled").count(), 1, "paused Push stays disabled");

  await header.getByRole("button", { name: "เปิดเมนูฟีเจอร์" }).click();
  await page.getByRole("navigation", { name: "ฟีเจอร์หลัก" }).getByRole("button", { name: "Activity", exact: true }).click();
  assert.equal(await page.locator(".reminder-header-tools").count(), 0, "portal does not leak into Activity");
  const ticks = await page.evaluate(() => window.headerFixture.ticks);
  await page.waitForFunction(previous => window.headerFixture.ticks > previous, ticks);
  await header.getByRole("button", { name: "เปิดเมนูฟีเจอร์" }).click();
  await page.getByRole("navigation", { name: "ฟีเจอร์หลัก" }).getByRole("button", { name: "Reminder", exact: true }).click();
  await input.waitFor();
  assert.equal(await input.inputValue(), "ทดสอบ Reminder", "draft survives switching modes");
  assert.equal(await page.evaluate(() => window.headerFixture.mounts), 1, "Reminder runtime remains mounted");

  for (const width of [1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      const layout = await header.evaluate(el => ({
        height: el.getBoundingClientRect().height,
        clipped: [...el.querySelectorAll("button, input")].filter(control => {
          const r = control.getBoundingClientRect();
          return r.width > 0 && (r.left < -.5 || r.right > innerWidth + .5);
        }).map(control => control.getAttribute("aria-label") || control.textContent),
      }));
      assert.deepEqual(layout.clipped, [], `${width}px ${theme}: header controls remain reachable`);
      assert(layout.height < (width <= 390 ? 220 : 160), `${width}px ${theme}: one compact header region (${layout.height}px)`);
      assert.equal(await input.isVisible(), true, "omnibar remains available on mobile");
      assert.equal(await input.evaluate(el => getComputedStyle(el).color), theme === "dark" ? "rgb(242, 241, 237)" : "rgb(28, 28, 26)");
    }
  }
  assert.deepEqual(errors, []);
  console.log("PASS: one shared header, one logo, omnibar/Telegram/stats/account actions, mode isolation and draft/runtime persistence; light/dark at 320/390/900/1440px");
} finally {
  await browser.close();
  await server.close();
}
