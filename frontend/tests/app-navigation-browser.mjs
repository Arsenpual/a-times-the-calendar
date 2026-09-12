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



  await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/app-navigation.html");
  await page.evaluate(() => {
    localStorage.removeItem("times-summary-panel-glass");
    localStorage.setItem("times-weekly-summary-glass", "true");
    localStorage.setItem("times-week-spine-hours-per-cell", "invalid");
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.fixture));
  await page.evaluate(() => {
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const run = fn => window.fixture.flushSync(fn);
    const f = () => window.fixture;
    const arrow = () => document.dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowRight", bubbles:true}));
    check(f().app.mode === "activity" && !f().app.settingsOpen && f().app.showLoginGuide, "defaults");
    check(f().preferences.summaryPanelGlassEnabled === true, "legacy glass preference");
    check(f().preferences.weekSpineHoursPerCell === 2, "invalid grid defaults to two hours");
    run(() => {
      f().preferences.setSummaryPanelGlassEnabled(false);
      f().preferences.setWeekSpineHoursPerCell(4);
    });
    check(localStorage.getItem("times-summary-panel-glass") === "false", "glass persisted");
    check(localStorage.getItem("times-week-spine-hours-per-cell") === "4", "grid persisted");
    run(() => f().nav.selectWeek(new Date(2026, 8, 6)));
    const start = f().nav.cursorDate.getTime();
    run(arrow);
    check(f().nav.cursorDate.getDate() === 13, "activity arrow navigation");
    run(() => { f().app.setMode("reminder"); f().app.setSettingsOpen(true); f().app.setShowLoginGuide(false); });
    const parked = f().nav.cursorDate.getTime();
    run(arrow);
    check(f().nav.cursorDate.getTime() === parked, "no shortcuts in reminder");
    run(() => f().app.setMode("activity"));
    document.querySelector("input").focus();
    run(arrow);
    check(f().nav.cursorDate.getTime() === parked, "typing must not navigate");
    document.querySelector("input").blur();
    run(arrow);
    check(f().nav.cursorDate.getDate() === 20, "restored one keyboard listener");
    run(() => { f().preferences.setTheme("dark"); f().preferences.setReminderTimelineColors({nowIndicator:"#123456"}); });
    check(document.documentElement.dataset.theme === "dark", "theme applied");
    check(localStorage.getItem("theme") === "dark", "theme persisted");
    check(JSON.parse(localStorage.getItem("reminder-timeline-colors")).nowIndicator === "#123456", "color persisted");
    check(f().app.settingsOpen && !f().app.showLoginGuide, "overlay state survives mode change");
    window.unmountFixture();
    arrow();
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.fixture));
  assert.deepEqual(await page.evaluate(() => ({
    theme: window.fixture.preferences.theme,
    color: window.fixture.preferences.reminderTimelineColors.nowIndicator,
    mode: window.fixture.app.mode,
    settings: window.fixture.app.settingsOpen,
    guide: window.fixture.app.showLoginGuide,
    glass: window.fixture.preferences.summaryPanelGlassEnabled,
    grid: window.fixture.preferences.weekSpineHoursPerCell
  })), {theme:"dark",color:"#123456",mode:"activity",settings:false,guide:true,glass:false,grid:4});
  await page.evaluate(() => {
    window.fixture.flushSync(() => window.fixture.preferences.setWeekSpineHoursPerCell(1));
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.fixture));
  assert.equal(await page.evaluate(() => window.fixture.preferences.weekSpineHoursPerCell), 1);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error("Storage disabled"); };
    Storage.prototype.setItem = () => { throw new Error("Storage disabled"); };
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.fixture));
  assert.deepEqual(await page.evaluate(() => ({
    glass: window.fixture.preferences.summaryPanelGlassEnabled,
    grid: window.fixture.preferences.weekSpineHoursPerCell
  })), {glass:false,grid:2});
  await page.evaluate(() => window.fixture.flushSync(() => {
    window.fixture.preferences.setSummaryPanelGlassEnabled(true);
    window.fixture.preferences.setWeekSpineHoursPerCell(4);
  }));
  assert.deepEqual(await page.evaluate(() => ({
    glass: window.fixture.preferences.summaryPanelGlassEnabled,
    grid: window.fixture.preferences.weekSpineHoursPerCell
  })), {glass:true,grid:4});
  assert.deepEqual(errors, []);
  console.log("PASS: mode shortcuts, theme/color/glass/grid persistence, legacy migration, invalid values and unavailable storage");

} finally {
  await browser.close();
  await server.close();
}
