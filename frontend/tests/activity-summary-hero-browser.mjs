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
  assert.equal(await page.locator('.week-spine-hours').count(), 0);
  assert.equal(await page.locator('.week-spine-resize-handle').count(), 0);
  await page.locator('.week-spine-block[title="Activity B"]').click();
  assert.ok(await page.evaluate(() => window.phase1.calls.some(call => call.type === 'edit' && call.value === 'Activity B')));
  const initialCards = await page.locator('.week-spine-block').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
  assert.ok(initialCards.every(height => height === 60), 'timed and all-day cards must all be 60px');
  await page.evaluate(() => window.phase1.setActivities([
    { id: "night", summary: "Night", start: { dateTime: new Date(2026, 8, 7, 23).toISOString() }, end: { dateTime: new Date(2026, 8, 8, 1).toISOString() } },
    { id: "all-day", summary: "All day", start: { date: "2026-09-07" }, end: { date: "2026-09-08" } },
  ]));
  await page.waitForFunction(() => document.querySelector(".activity-summary-hero-stats strong")?.textContent === "2");
  assert.deepEqual(await page.locator(".activity-summary-hero-stats strong").allTextContents(), ["2", "2", "2"]);
  assert.equal(await page.locator(".activity-summary-hero-days").count(), 0);
  assert.equal(await page.locator(".activity-summary-hero-categories").count(), 0);
  await page.evaluate(() => window.phase1.set({ viewMode: "four-weeks" }));
  await page.waitForFunction(() => !document.querySelector(".activity-summary-hero"));
  await page.evaluate(() => window.phase1.set({ viewMode: "week" }));
  await page.locator(".activity-summary-hero").waitFor();
  await page.evaluate(() => window.phase1.setActivities([
    { id: 'all-day-list', summary: 'All day list', start: { date: '2026-09-07' }, end: { date: '2026-09-08' } },
    ...Array.from({ length: 15 }, (_, index) => ({
      id: `overlap-${index}`, summary: `Overlap ${index}`,
      start: { dateTime: new Date(2026, 8, 7, 9).toISOString() },
      end: { dateTime: new Date(2026, 8, 7, 9, 5 + index * 30).toISOString() },
    })),
  ]));
  await page.waitForFunction(() => document.querySelectorAll('.week-spine-block').length === 5);
  const cards = await page.locator('.week-spine-block').evaluateAll(elements => elements.map(el => {
    const rect = el.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height, width: rect.width };
  }));
  assert.ok(cards.every(card => card.height === 60 && Math.abs(card.width - cards[0].width) < 1));
  assert.ok(cards.every(card => card.top === cards[0].top), 'all five cards must stay on one row');
  assert.equal(await page.locator('.week-spine-list-more').textContent(), '+11');
  assert.equal(await page.locator('.week-spine-activity-list').nth(1).locator('.week-spine-list-add').count(), 0);
  await page.locator('.week-spine-list-more').click();
  await page.waitForFunction(() => document.querySelectorAll('.week-spine-block').length === 16);
  assert.equal(await page.locator('.week-spine-list-more').getAttribute('aria-expanded'), 'true');
  const expandedCards = await page.locator('.week-spine-block').evaluateAll(items => items.map(item => {
    const rect = item.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height };
  }));
  assert.ok(expandedCards.every(card => card.height === 60));
  assert.ok(expandedCards.every((card, i) => expandedCards.slice(i + 1).every(other => card.right <= other.left || other.right <= card.left || card.bottom <= other.top || other.bottom <= card.top)), 'expanded cards must not overlap');
  assert.equal(await page.locator('.week-spine-block').last().isVisible(), true);
  const expandedAdd = page.locator('.week-spine-activity-list').nth(1).locator('.week-spine-list-add');
  assert.equal(await expandedAdd.evaluate(el => getComputedStyle(el).gridColumnStart), '2');
  assert.equal(await expandedAdd.evaluate(el => getComputedStyle(el).gridRowStart), '4');
  await page.locator('.week-spine-block').last().click();
  assert.ok(await page.evaluate(() => window.phase1.calls.some(call => call.type === 'edit' && call.value === 'overlap-9')));
  await page.locator('.week-spine-list-more').click();
  await page.waitForFunction(() => document.querySelectorAll('.week-spine-block').length === 5);
  assert.equal(await page.locator('.week-spine-list-more').textContent(), '+11');
  assert.ok(cards.every((card, index) => cards.slice(index + 1).every(other => card.right <= other.left || other.right <= card.left || card.bottom <= other.top || other.bottom <= card.top)), 'wrapped activities must never overlap');
  assert.equal(await page.locator('.week-spine-overflow-count').count(), 0);
  assert.equal(await page.locator('.week-spine-block-time').first().textContent(), 'ทั้งวัน');
  assert.equal(await page.locator('.week-spine-block-time').first().isVisible(), true);
  assert.ok(await page.locator('.week-spine-day-heading').first().evaluate(element => element.getBoundingClientRect().height >= 63), 'date and daily counts must remain visible above the cards');
  await page.locator('.week-spine-block').nth(1).click({ button: 'right' });
  assert.ok(await page.locator('.activity-popup').count() > 0, 'context menu stays available');
  await page.keyboard.press('Escape');
  const rows = await page.locator('.week-spine-day').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width };
  }));
  assert.equal(rows.length, 7);
  assert.ok(rows.every(row => Math.abs(row.width - rows[0].width) < 1 && row.left === rows[0].left), 'each day uses the full width');
  assert.ok(rows.slice(1).every((row, index) => row.top >= rows[index].bottom), 'seven days run down the page');
  const surface = page.locator('.week-spine-timeline-surface');
  assert.ok(await surface.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1), 'all days and activities fit without an inner scrollbar');
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
  assert.equal(await page.locator(".week-spine-timeline-surface").evaluate((el) => el.scrollWidth > el.clientWidth + 1), false, "mobile rows must wrap without horizontal overflow");
  assert.equal(await page.locator(".week-spine-hours").count(), 0);
  assert.ok((await page.locator(".week-spine-block").evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height))).every(height => height === 60));
  assert.equal(await page.locator(".week-spine-density-control").count(), 0);
  for (const count of [8, 5, 4, 0]) {
    await page.evaluate(count => window.phase1.setActivities(Array.from({ length: count }, (_, i) => ({
      id: `limit-${i}`, summary: `Activity ${i}`,
      start: { dateTime: new Date(2026, 8, 7, 9).toISOString() },
      end: { dateTime: new Date(2026, 8, 7, 10).toISOString() },
    }))), count);
    await page.waitForFunction(count => document.querySelectorAll('.week-spine-block').length === Math.min(5, count), count);
    if (count > 5) assert.equal(await page.locator('.week-spine-list-more').textContent(), '+3');
    else assert.equal(await page.locator('.week-spine-list-more').count(), 0);
    const add = page.locator('.week-spine-activity-list').nth(1).locator('.week-spine-list-add');
    if (count > 5) assert.equal(await add.count(), 0);
    else assert.equal(await add.evaluate(el => getComputedStyle(el).gridColumnStart), String(count + 1));
  }
  await page.evaluate(() => {
    window.phase1.set({ anchorDate: new Date(2027, 0, 1) });
    window.phase1.setActivities([
      { id: "year-boundary", summary: "Year boundary", start: { dateTime: new Date(2026, 11, 31, 23).toISOString() }, end: { dateTime: new Date(2027, 0, 1, 1).toISOString() } },
    ]);
  });
  await page.waitForFunction(() => document.querySelector(".activity-summary-hero-stats strong")?.textContent === "1");
  assert.deepEqual(await page.locator(".activity-summary-hero-stats strong").allTextContents(), ["1", "1", "1"]);
  assert.equal(await page.locator(".week-spine-fullscreen-btn").count(), 0);
  // Today remains highlighted in its full-width row for every weekday.
  for (let offset = 0; offset < 7; offset += 1) {
    await page.clock.setFixedTime(new Date(Date.UTC(2026, 9, 25 + offset, 5)));
    await page.evaluate(offset => window.phase1.set({ anchorDate: new Date(2026, 9, 25 + offset), userId: `today-${offset}` }), offset);
    await page.waitForFunction(() => {
      const surface = document.querySelector('.week-spine-timeline-surface');
      const day = surface?.querySelector('.week-spine-day.is-today');
      if (!day) return false;
      const viewport = surface.getBoundingClientRect();
      const rect = day.getBoundingClientRect();
      return rect.left >= viewport.left - 1 && rect.right <= viewport.left + surface.clientWidth + 1;
    });
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(() => {
      const surface = document.querySelector('.week-spine-timeline-surface');
      const rect = surface.querySelector('.week-spine-day.is-today').getBoundingClientRect();
      const left = surface.getBoundingClientRect().left;
      return rect.left >= left - 1 && rect.right <= left + surface.clientWidth + 1;
    });
  }
  await page.evaluate(() => window.phase1.set({ anchorDate: new Date(2026, 10, 8) }));
  await page.waitForFunction(() => !document.querySelector('.week-spine-day.is-today') && document.querySelector('.week-spine-timeline-surface').scrollLeft === 0);
  console.log("PASS: Summary Hero totals, year boundary, horizontal seven-day rows, five-card limit, remaining count, non-overlap, editing and responsive layout");
} finally {
  await browser.close();
  await server.close();
}
