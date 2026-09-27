import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("../", import.meta.url));
const devMockupsAlias = fileURLToPath(new URL("../src/app/dev-mockups.production.jsx", import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  resolve: { alias: { "@dev-mockups": devMockupsAlias } },
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0 },
  logLevel: "error"
});
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const url = server.resolvedUrls.local[0] + "tests/fixtures/i18n-provider.html";

try {
  await page.goto(url);
  assert.equal(await page.getByTestId("language").textContent(), "th");
  assert.equal(await page.getByTestId("today").textContent(), "วันนี้");
  assert.equal(await page.locator("html").getAttribute("lang"), "th");

  await page.getByRole("button", { name: "English" }).click();
  assert.equal(await page.getByTestId("language").textContent(), "en");
  assert.equal(await page.getByTestId("today").textContent(), "Today");
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(await page.evaluate(() => localStorage.getItem("language")), "en");

  await page.reload();
  assert.equal(await page.getByTestId("language").textContent(), "en");
  await page.getByRole("button", { name: "Invalid" }).click();
  assert.equal(await page.getByTestId("language").textContent(), "en", "unsupported setter value is ignored");

  await page.evaluate(() => localStorage.setItem("language", "unsupported"));
  await page.reload();
  assert.equal(await page.getByTestId("language").textContent(), "th", "invalid stored value falls back to Thai");
  assert.deepEqual(errors, []);
  console.log("PASS browser: i18n default, language switch, html lang, persistence and invalid fallback");
} finally {
  await browser.close();
  await server.close();
}
