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


  await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/activity-view.html");
  await page.waitForFunction(() => Boolean(window.viewFixture));
  const result = await page.evaluate(() => {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const action = (name, arg) => window.viewFixture.flushSync(() => window.viewFixture.view[name](arg));
    const f = () => window.viewFixture;
    const initialCursor = f().cursorDate.getTime();
    check(f().view.weekSpineViewMode === "week", "initial week");
    action("setWeekSpineView", "four-weeks");
    check(f().view.cycleAnchorDate.getTime() === f().getYearCycle(f().cursorDate).start.getTime(), "correct year cycle");
    check(f().view.summaryPanelMode === "cycle", "cycle summary selected");
    const firstAnchor = f().view.cycleAnchorDate.getTime();
    action("navigateCycle", 1);
    check(f().cursorDate.getTime() === initialCursor, "browsing must preserve focused week");
    const nextAnchor = f().view.cycleAnchorDate.getTime();
    check(nextAnchor > firstAnchor, "next cycle");
    const selected = new Date(nextAnchor); selected.setDate(selected.getDate() + 7);
    action("selectCycleWeek", selected);
    check(f().view.cycleAnchorDate.getTime() === nextAnchor && f().cursorDate.getTime() === selected.getTime(), "select week without moving cycle");
    action("focusCycleSummary");
    check(!f().dayOpen && f().view.summaryPanelMode === "cycle", "summary closes selected day");
    action("openCycleWeekEditor", selected);
    check(f().view.weekSpineViewMode === "week" && f().view.weekSpineFullscreenRequest === 1, "request fullscreen");
    action("handleTimelineFullscreenChange", true);
    check(f().view.weekSpineViewMode === "week", "enter fullscreen");
    action("handleTimelineFullscreenChange", false);
    check(f().view.weekSpineViewMode === "four-weeks" && f().view.cycleAnchorDate.getTime() === nextAnchor, "restore cycle");
    action("openCycleWeekView", selected);
    check(f().view.weekSpineViewMode === "week" && f().view.summaryPanelMode === "week", "double-click opens week");
    action("handleTimelineFullscreenChange", false);
    check(f().view.weekSpineViewMode === "week", "restore reference consumed");
    action("setWeekSpineView", "four-weeks");
    action("openCycleWeekEditor", selected);
    check(f().view.weekSpineFullscreenRequest === 2, "repeat editor request");
    f().flushSync(() => f().navigation.focusDate(new Date(2025, 0, 5)));
    f().flushSync(() => f().setUserId("account-b"));
    check(f().view.weekSpineViewMode === "week", "new account starts in week view");
    check(f().view.weekSpineFullscreenRequest === 0, "new account cannot replay fullscreen");
    check(f().view.summaryPanelMode === "week", "new account summary reset");
    check(f().navigation.expandedDate === null, "new account day reset");
    check(f().navigation.cursorDate.toDateString() === new Date().toDateString(), "new account week reset");
    action("handleTimelineFullscreenChange", false);
    check(f().view.weekSpineViewMode === "week", "old cycle return cleared");
    action("setWeekSpineView", "four-weeks");
    action("openCycleWeekEditor", selected);
    f().flushSync(() => f().setUserId(null));
    check(f().view.weekSpineFullscreenRequest === 0 && f().view.summaryPanelMode === "week", "logout clears editor request");
    action("handleTimelineFullscreenChange", false);
    check(f().view.weekSpineViewMode === "week", "logout clears cycle restoration");
    return true;
  });
  assert.equal(result, true);
  assert.deepEqual(errors, []);
  console.log("PASS: Activity Week/Cycle selection, summary, fullscreen restoration and repeated editor requests");

} finally {
  await browser.close();
  await server.close();
}
