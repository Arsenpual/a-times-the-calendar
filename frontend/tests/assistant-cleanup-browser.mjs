import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({
  root, configFile: false, plugins: [react()],
  resolve: { alias: { "@dev-mockups": fileURLToPath(new URL("../src/app/dev-mockups.production.jsx", import.meta.url)) } },
  optimizeDeps: { include: ["react", "react-dom/client"] },
  server: { host: "127.0.0.1", port: 0 }, logLevel: "error"
});
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/cleanup-fixture", route => route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div></body></html>' }));
  await page.goto(server.resolvedUrls.local[0] + "cleanup-fixture");
  await page.evaluate(async () => {
    const refresh = await import("/@react-refresh");
    refresh.default.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const { default: React } = await import("/node_modules/.vite/deps/react.js");
    const { default: ReactDOM } = await import("/node_modules/.vite/deps/react-dom_client.js");
    const { default: Candidate } = await import("/src/features/settings/components/assistant-preference-candidate.jsx");
    window.calls = 0;
    ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Candidate, {
      field: { key: "homeworkDefaultStart", label: "เวลาเริ่มทำการบ้าน", type: "time" },
      candidate: { value: "18:30", count: 2 },
      onSave: () => { window.calls++; return new Promise((resolve, reject) => { window.rejectSave = reject; window.resolveSave = resolve; }); },
      onDismiss: async () => {}
    }));
  });
  const accept = page.getByRole("button", { name: "ใช้เป็นค่าเริ่มต้น" });
  await accept.click();
  assert.equal(await accept.isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "ไม่ใช้", exact: true }).isDisabled(), true);
  await page.evaluate(() => window.rejectSave(new Error("ลองใหม่ภายหลัง")));
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByRole("alert").textContent(), "ลองใหม่ภายหลัง");
  assert.equal(await accept.isEnabled(), true);
  await accept.click();
  assert.equal(await page.evaluate(() => window.calls), 2);
  await page.evaluate(() => window.resolveSave());
  await page.waitForFunction(() => !document.querySelector("button").disabled);
  assert.deepEqual(errors, []);
  console.log("PASS: preference candidate pending, failure message and retry");
} finally {
  await browser.close();
  await server.close();
}
