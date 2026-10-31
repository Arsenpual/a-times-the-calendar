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
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.clock.setFixedTime(new Date('2026-09-07T05:30:00Z'));
  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/activity-phase1.html`);
  await page.locator('.week-spine').waitFor();
  await page.locator('main').evaluate(el => el.classList.add('dashboard', 'activity-dashboard', 'has-summary-hero'));
  await page.evaluate(() => window.phase1.setActivities([
    { id: 'long', summary: 'Design', start: { dateTime: new Date(2026, 8, 7, 9).toISOString() }, end: { dateTime: new Date(2026, 8, 7, 11).toISOString() } },
    { id: 'overlap', summary: 'Meeting', start: { dateTime: new Date(2026, 8, 7, 10).toISOString() }, end: { dateTime: new Date(2026, 8, 7, 12).toISOString() } },
    { id: 'night', summary: 'Night', start: { dateTime: new Date(2026, 8, 7, 23).toISOString() }, end: { dateTime: new Date(2026, 8, 8, 1).toISOString() } },
    { id: 'all-day', summary: 'All day', start: { date: '2026-09-07' }, end: { date: '2026-09-08' } },
  ]));
  const launcher = page.locator('.week-spine-day').nth(1).locator('.week-spine-planner-open');
  await launcher.click();
  const monday = page.getByRole('region', { name: 'รายละเอียดวัน 7 กันยายน', exact: true });
  await monday.waitFor();
  assert.equal(await page.locator('.week-spine-day').count(), 7, 'week remains visible');
  assert.equal(await page.locator('.week-spine-day').nth(1).locator('.week-spine-activity-list').count(), 0, 'timeline replaces the summary cards');
  const aligned = await monday.evaluate(el => Math.abs(el.getBoundingClientRect().top - el.parentElement.querySelector('.week-spine-day-heading').getBoundingClientRect().top) < 1);
  assert.equal(aligned, true, 'timeline shares the original day row');
  assert.equal(await monday.locator('.daily-planner-axis span').count(), 25);
  assert.equal(await monday.locator('.daily-planner-axis span').first().textContent(), '00:00');
  assert.equal(await monday.locator('.daily-planner-axis span').last().textContent(), '24:00');
  assert.equal(await monday.locator('.daily-planner-lane').count(), 3);
  assert.equal(await monday.locator('textarea').count(), 0, 'no planning forms in compact drawer');
  assert.ok(await monday.evaluate(el => el.getBoundingClientRect().height < 240));
  const bars = await monday.locator('.daily-planner-event').evaluateAll(elements => elements.map(el => ({ text: el.title, width: parseFloat(el.style.width), top: el.getBoundingClientRect().top })));
  assert.ok(Math.abs(bars.find(item => item.text.startsWith('Design')).width - 100 / 12) < .001);
  assert.notEqual(bars.find(item => item.text.startsWith('Design')).top, bars.find(item => item.text.startsWith('Meeting')).top);
  assert.match(bars.find(item => item.text.startsWith('Night')).text, /24:00/);
  assert.equal(bars[0].width, 100, 'all-day activity spans the full clock axis');
  assert.ok(bars.slice(1).every(item => item.top > bars[0].top), 'all-day activity is above every timed event');
  assert.equal(await monday.locator('.daily-planner-all-day').count(), 0);
  await monday.locator('.daily-planner-event').filter({ hasText: 'Design' }).click();
  assert.equal(await monday.locator('select').count(), 0);
  await monday.getByRole('button', { name: 'All day ทั้งวัน 00:00 ถึง 24:00', exact: true }).click();
  assert.ok(await page.evaluate(() => window.phase1.calls.some(call => call.type === 'edit' && call.value === 'all-day')));
  assert.ok(await page.evaluate(() => window.phase1.calls.some(call => call.type === 'edit' && call.value === 'long')));
  await monday.getByRole('button', { name: '+ เพิ่มกิจกรรม', exact: true }).click();
  assert.ok(await page.evaluate(() => window.phase1.calls.some(call => call.type === 'add')));
  await page.locator('.week-spine-day').nth(2).locator('.week-spine-planner-open').click();
  const tuesday = page.getByRole('region', { name: 'รายละเอียดวัน 8 กันยายน', exact: true });
  assert.equal(await monday.isVisible(), true);
  assert.equal(await tuesday.isVisible(), true);
  assert.equal(await page.locator('.daily-planner').count(), 2, 'independent day drawers');
  // Pointer manipulation stays local until an explicit Save, with shared history.
  const design = monday.locator('.daily-planner-event').filter({ hasText: 'Design' });
  const drag = async (locator, dx, targetY) => {
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, targetY ?? box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
  };
  const axisWidth = (await monday.locator('.daily-planner-lanes').boundingBox()).width;
  const savesBefore = await page.evaluate(() => window.phase1.calls.filter(c => c.type === 'save').length);
  await drag(design, axisWidth / 24);
  assert.match(await design.getAttribute('title'), /10:00–12:00/);
  assert.equal(await page.evaluate(() => window.phase1.calls.filter(c => c.type === 'save').length), savesBefore);
  await monday.getByRole('button', { name: '↶ ย้อนกลับ', exact: true }).click();
  assert.match(await design.getAttribute('title'), /09:00–11:00/);
  await tuesday.getByRole('button', { name: '↷ ทำซ้ำ', exact: true }).click();
  assert.match(await design.getAttribute('title'), /10:00–12:00/);
  await drag(design.locator('.planner-resize.end'), axisWidth / 24);
  assert.match(await design.getAttribute('title'), /10:00–13:00/);
  await drag(design.locator('.planner-resize.start'), axisWidth / 24);
  assert.match(await design.getAttribute('title'), /11:00–13:00/);
  const tueBox = await tuesday.locator('.daily-planner-lanes').boundingBox();
  await drag(design, 0, tueBox.y + 15);
  assert.equal(await design.count(), 0);
  const movedDesign = tuesday.locator('.daily-planner-event').filter({ hasText: 'Design' });
  assert.match(await movedDesign.getAttribute('title'), /11:00–13:00/);
  assert.equal(await page.evaluate(() => window.phase1.calls.filter(c => c.type === 'save').length), savesBefore);
  await tuesday.getByRole('button', { name: 'บันทึก', exact: true }).click();
  assert.equal(await page.evaluate(() => window.phase1.calls.filter(c => c.type === 'save').length), savesBefore + 1);
  assert.equal(await monday.getByRole('button', { name: '↶ ย้อนกลับ', exact: true }).isDisabled(), true);
  // Escape cancels the next gesture.
  const movedBox = await movedDesign.boundingBox();
  await page.mouse.move(movedBox.x + movedBox.width / 2, movedBox.y + 14);
  await page.mouse.down();
  await page.mouse.move(movedBox.x + movedBox.width / 2 + axisWidth / 24, movedBox.y + 14);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  assert.match(await movedDesign.getAttribute('title'), /11:00–13:00/);
  assert.equal(await tuesday.getByRole('button', { name: 'บันทึก', exact: true }).isDisabled(), true);
  const allDay = monday.locator('.daily-planner-event.is-all-day');
  const allDayTarget = await tuesday.locator('.daily-planner-lanes').boundingBox();
  await drag(allDay, 0, allDayTarget.y + 15);
  assert.equal(await allDay.count(), 0);
  assert.equal(await tuesday.locator('.daily-planner-event.is-all-day').count(), 1);
  await page.evaluate(() => { window.phase1.failSave = true; });
  await tuesday.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'บันทึกการปรับเวลาไม่สำเร็จ' }).waitFor();
  assert.equal(await tuesday.getByRole('button', { name: 'บันทึก', exact: true }).isEnabled(), true);
  await page.evaluate(() => { window.phase1.failSave = false; });
  await tuesday.getByRole('button', { name: 'บันทึก', exact: true }).click();
  assert.equal(await tuesday.locator('.daily-planner-event.is-all-day').count(), 1, 'saved event preserves all-day type');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await monday.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `timeline fits at ${width}px`);
    assert.equal(await monday.locator('.daily-planner-axis span').count(), 25);
  }
  await tuesday.getByRole('button', { name: 'ปิดรายละเอียดวัน 8 กันยายน' }).click();
  assert.equal(await tuesday.count(), 0);
  assert.equal(await monday.isVisible(), true, 'closing Tuesday does not close Monday');
  await page.waitForFunction(() => document.activeElement?.classList.contains('week-spine-planner-open'));
  assert.equal(await page.locator('.week-spine-day').nth(2).locator('.week-spine-planner-open').evaluate(el => el === document.activeElement), true);
  await monday.getByRole('button', { name: 'ปิดรายละเอียดวัน 7 กันยายน' }).click();
  assert.equal(await monday.count(), 0);
  assert.equal(await page.locator('.week-spine-day').nth(1).locator('.week-spine-activity-list').count(), 1);
  assert.equal(await launcher.getAttribute('aria-expanded'), 'false');
  await launcher.click();
  await page.evaluate(() => window.phase1.setActivities(Array.from({ length: 8 }, (_, index) => ({
    id: `full-${index}`, summary: `Full ${index}`,
    start: { dateTime: new Date(2026, 8, 7, index + 8).toISOString() },
    end: { dateTime: new Date(2026, 8, 7, index + 9).toISOString() },
  }))));
  await page.waitForFunction(() => document.querySelectorAll('.daily-planner-event').length === 8);
  assert.equal(await page.locator('.week-spine-day').nth(1).locator('.week-spine-block').count(), 0);
  await monday.getByRole('button', { name: 'ปิดรายละเอียดวัน 7 กันยายน' }).click();
  assert.equal(await page.locator('.week-spine-day').nth(1).locator('.week-spine-block').count(), 5);
  assert.equal(await page.locator('.week-spine-day').nth(1).locator('.week-spine-list-more').textContent(), '+3');
  await launcher.click();
  await page.evaluate(() => window.phase1.set({ anchorDate: new Date(2026, 8, 14) }));
  await page.waitForFunction(() => !document.querySelector('.daily-planner'));
  assert.deepEqual(errors, []);
  console.log('PASS: compact inline day drawers, multiple days, 24-hour geometry, edit/add, independent close, focus and responsive layout');
} finally {
  await browser.close();
  await server.close();
}
