import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({ root, configFile: false, resolve: { alias: { "@dev-mockups": fileURLToPath(new URL("../src/app/dev-mockups.production.jsx", import.meta.url)) } }, plugins: [{
  name: "hero-fixture-apis", enforce: "pre", load(id) {
    if (id.replaceAll("\\", "/").endsWith("/features/activity/api/archive.js")) return "export const fetchActivityArchive = async () => window.phase1.archive; export const saveActivityArchiveItem = async () => {}; export const deleteActivityArchiveItem = async () => {};";
    if (id.replaceAll("\\", "/").endsWith("/features/calendar-connection/api/google-calendar.js")) return "export const fetchActivities = async () => window.phase1.cycleActivities;";
  },
}, react()], server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Bangkok" });
try {
  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/activity-phase1.html`);
  await page.locator(".activity-summary-hero").waitFor();
  await page.locator("main").evaluate((element) => { element.classList.add("dashboard", "activity-dashboard", "has-summary-hero"); element.style.height = "800px"; });
  await page.evaluate(() => window.phase1.set({ activitiesLoading: true }));
  await page.getByRole("status").filter({ hasText: "กำลังโหลดกิจกรรม" }).waitFor();
  assert.equal(await page.locator(".activity-summary-hero-stats").count(), 0);
  await page.evaluate(() => window.phase1.set({ activitiesLoading: false }));
  await page.locator(".activity-summary-hero-stats").waitFor();
  assert.deepEqual(await page.locator(".activity-summary-hero-stats strong").allTextContents(), ["4", "6", "6"]);
  const activity = page.locator('.week-spine-block[title="Activity B"]');
  await activity.scrollIntoViewIfNeeded();
  const activityBox = await activity.boundingBox();
  await page.mouse.move(activityBox.x + activityBox.width / 2, activityBox.y + 5);
  await page.mouse.down();
  await page.mouse.move(activityBox.x + activityBox.width / 2, activityBox.y + 65, { steps: 8 });
  await page.mouse.up();
  await page.locator(".week-spine-save-bar").waitFor();
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await page.evaluate(() => window.phase1.setActivities([
    { id: "night", summary: "Night", start: { dateTime: new Date(2026, 8, 7, 23).toISOString() }, end: { dateTime: new Date(2026, 8, 8, 1).toISOString() } },
    { id: "all-day", summary: "All day", start: { date: "2026-09-07" }, end: { date: "2026-09-08" } },
  ]));
  await page.waitForFunction(() => document.querySelector(".activity-summary-hero-stats strong")?.textContent === "2");
  assert.deepEqual(await page.locator(".activity-summary-hero-stats strong").allTextContents(), ["2", "2", "2"]);
  assert.deepEqual(await page.locator(".activity-summary-hero-bars button span").allTextContents(), ["0", "1", "1", "0", "0", "0", "0"]);
  const tuesday = page.locator(".activity-summary-hero-bars button").nth(2);
  await tuesday.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.phase1.calls.some((call) => call.type === "select-day"));
  assert.equal(await page.locator(".week-spine-day").nth(2).getAttribute("aria-pressed"), "true");
  assert.match(await tuesday.getAttribute("aria-label"), /1 กิจกรรม, 1 ชั่วโมง/);
  await page.evaluate(() => window.phase1.set({ viewMode: "four-weeks" }));
  await page.waitForFunction(() => !document.querySelector(".activity-summary-hero"));
  await page.evaluate(() => window.phase1.set({ viewMode: "week" }));
  await page.locator(".activity-summary-hero").waitFor();
  const geometry = await page.evaluate(() => {
    const hours = document.querySelector(".week-spine-hours").getBoundingClientRect();
    const track = document.querySelector(".week-spine-track").getBoundingClientRect();
    return { hours: hours.top, track: track.top };
  });
  assert.ok(Math.abs(geometry.hours - geometry.track) < 3, `time axis must align with the grid: ${JSON.stringify(geometry)}`);
  const tracks = await page.locator(".week-spine-track").evaluateAll((elements) => elements.map((element) => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width }; }));
  assert.ok(tracks.every((track) => Math.abs(track.width - tracks[0].width) < 1), "all seven day columns should have equal width");
  assert.ok(tracks.slice(1).every((track, index) => Math.abs(track.left - tracks[index].right) < 1), "day columns should meet without gaps");
  assert.equal(await page.locator(".week-spine-track").first().evaluate((element) => element.getBoundingClientRect().height), 1440, "24 hourly cells should each be 60px tall");
  const scrolling = await page.locator(".week-spine-timeline-surface").evaluate((element) => {
    const width = element.clientWidth;
    const dayWidth = element.querySelector(".week-spine-track").getBoundingClientRect().width;
    const initial = element.scrollLeft;
    const verticalOverflow = element.scrollHeight > element.clientHeight;
    element.scrollLeft = element.scrollWidth;
    element.scrollTop = 200;
    return { width, dayWidth, initial, moved: element.scrollLeft, top: element.scrollTop, direction: getComputedStyle(element).direction, verticalOverflow };
  });
  assert.ok(Math.abs(scrolling.dayWidth - (scrolling.width - 52) / 5) < 2, "five day columns should fit in the viewport");
  assert.equal(scrolling.direction, "ltr", "vertical scrollbar should be on the right");
  assert.ok(scrolling.initial === 0 && scrolling.moved > 0 && scrolling.top > 0 && scrolling.verticalOverflow, "both scroll directions must work");
  assert.equal(await page.locator(".week-spine-timeline-surface").evaluate((element) => getComputedStyle(element).scrollbarWidth), "thin");
  await page.locator("main").evaluate((main) => {
    const panel = document.createElement("aside");
    panel.className = "summary-column has-selected-day";
    panel.textContent = "รายละเอียดวัน";
    main.prepend(panel);
  });
  const desktopLayout = await page.evaluate(() => {
    const panel = document.querySelector(".summary-column").getBoundingClientRect();
    const spine = document.querySelector(".week-spine").getBoundingClientRect();
    return { panelTop: panel.top, spineBottom: spine.bottom, heroBackground: getComputedStyle(document.querySelector(".activity-summary-hero")).backgroundColor, spineBackground: getComputedStyle(document.querySelector(".week-spine")).getPropertyValue("--bg-muted").trim() };
  });
  assert.ok(desktopLayout.panelTop >= desktopLayout.spineBottom, "day details should follow the calendar on desktop");
  assert.equal(desktopLayout.heroBackground, "rgb(15, 26, 46)");
  assert.equal(desktopLayout.spineBackground, "#fff");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await page.evaluate(() => ({ panel: document.querySelector(".summary-column").getBoundingClientRect().top, spine: document.querySelector(".week-spine").getBoundingClientRect().bottom }));
  assert.ok(mobileLayout.panel >= mobileLayout.spine, "day details should follow the calendar on narrow screens");
  assert.equal(await page.locator(".activity-summary-hero-bars button").count(), 7);
  assert.equal(await page.locator(".week-spine-timeline-surface").evaluate((el) => el.scrollWidth > el.clientWidth), true, "remaining days should be reachable by horizontal scrolling");
  assert.equal(await page.locator(".week-spine-hours span").first().textContent(), "00:00");
  assert.equal(await page.locator(".week-spine-hours span").last().textContent(), "24:00");
  assert.equal(await page.locator(".week-spine-hours span").count(), 25);
  assert.equal(await page.locator(".week-spine-density-control").count(), 0);
  await page.evaluate(() => {
    window.phase1.set({ anchorDate: new Date(2027, 0, 1) });
    window.phase1.setActivities([
      { id: "year-boundary", summary: "Year boundary", start: { dateTime: new Date(2026, 11, 31, 23).toISOString() }, end: { dateTime: new Date(2027, 0, 1, 1).toISOString() } },
    ]);
  });
  await page.waitForFunction(() => document.querySelector(".activity-summary-hero-stats strong")?.textContent === "1");
  assert.deepEqual(await page.locator(".activity-summary-hero-stats strong").allTextContents(), ["1", "1", "1"]);
  assert.deepEqual(await page.locator(".activity-summary-hero-bars button span").allTextContents(), ["0", "0", "0", "0", "0", "1", "0"]);
  assert.equal(await page.locator(".activity-summary-hero-bars button:disabled").count(), 5);
  assert.equal(await page.locator(".week-spine-fullscreen-btn").count(), 0);
  console.log("PASS: Summary Hero totals, year boundary, timeline alignment and narrow screen scrolling");
} finally {
  await browser.close();
  await server.close();
}
