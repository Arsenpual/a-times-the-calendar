import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));

const unitTests = [
  "tests/activity-collections.test.mjs",
  "tests/activity-phase1.test.mjs",
  "tests/app-lifecycle.test.mjs",
  "tests/app-mode-boundaries.test.mjs",
  "tests/cycle-data.test.mjs",
  "tests/event-anchor-session.test.mjs",
  "tests/loading-performance.test.mjs",
  "tests/reminder-phase2.test.mjs",
  "tests/reminder-sync.test.mjs",
  "src/features/activity/assistant/tests/activity-popup-handoff.test.js",
  "src/features/reminder/hooks/reminder-timeline-export.test.mjs",
];

const browserTests = [
  "tests/activity-phase1-browser.mjs",
  "tests/activity-view-browser.mjs",
  "tests/app-navigation-browser.mjs",
  "tests/dev-mockups-browser.mjs",
  "tests/reminder-phase2-browser.mjs",
  "tests/reminder-shell-browser.mjs",
];

const flags = new Set(process.argv.slice(2));
const selectedTests = flags.has("--all")
  ? [...unitTests, ...browserTests]
  : flags.has("--browser")
    ? browserTests
    : unitTests;

for (const testFile of selectedTests) {
  console.log(`\n[test] ${testFile}`);
  const result = spawnSync(process.execPath, [testFile], {
    cwd: frontendRoot,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n[test] ผ่าน ${selectedTests.length} ชุด`);
