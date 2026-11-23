import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));

const unitTests = [
  "tests/integration/activity-collections.test.mjs",
  "tests/integration/activity-phase1.test.mjs",
  "tests/integration/app-lifecycle.test.mjs",
  "tests/integration/app-mode-boundaries.test.mjs",
  "tests/integration/cycle-data.test.mjs",
  "tests/integration/event-anchor-session.test.mjs",
  "tests/integration/loading-performance.test.mjs",
  "tests/integration/reminder-phase2.test.mjs",
  "tests/integration/reminder-sync.test.mjs",
  "tests/integration/quota-polling.test.mjs",
  "src/features/activity/lib/activity-modal-logic.test.mjs",
  "src/features/activity/lib/activity-mutation-logic.test.mjs",
  "src/features/activity/lib/activity-popup-logic.test.mjs",
  "src/features/activity/services/activity-metadata-actions.test.mjs",
  "src/features/activity/services/activity-calendar-actions.test.mjs",
  "src/shared/i18n/i18n-catalog.test.mjs",
  "src/shared/lib/lonth-engine.test.mjs",
  "src/features/settings/lib/data-lab-export-window.test.mjs",
  "src/features/settings/lib/data-lab-insight-report.test.mjs",
  "src/features/activity/assistant/tests/activity-popup-handoff.test.mjs",
  "src/features/activity/assistant/tests/assistant-boundaries.test.mjs",
  "src/features/activity/assistant/tests/assistant-source-label.test.mjs",
  "src/features/activity/assistant/tests/guided-activity-validation.test.mjs",
  "src/features/activity/assistant/tests/validate-plan-draft.test.mjs",
  "src/features/activity/assistant/tests/weather-slot-validation.test.mjs",
  "src/features/reminder/hooks/reminder-timeline-export.test.mjs",
  "tests/integration/app-header-view-mode.test.mjs",
  "tests/integration/architecture-boundaries.test.mjs",
];

const browserTests = [
  "tests/browser/popup-layer-browser.mjs",
  "tests/browser/app-taskbar-browser.mjs",
  "tests/browser/assistant-review-browser.mjs",
  "tests/browser/assistant-tool-restore-browser.mjs",
  "tests/browser/assistant-weather-browser.mjs",
  "tests/browser/assistant-cleanup-browser.mjs",
  "tests/browser/activity-phase1-browser.mjs",
  "tests/browser/activity-summary-hero-browser.mjs",
  "tests/browser/activity-daily-planner-browser.mjs",
  "tests/browser/header-summary-browser.mjs",
  "tests/browser/activity-view-browser.mjs",
  "tests/browser/app-navigation-browser.mjs",
  "tests/browser/dev-mockups-browser.mjs",
  "tests/browser/i18n-provider-browser.mjs",
  "tests/browser/reminder-phase2-browser.mjs",
  "tests/browser/reminder-shell-browser.mjs",
  "tests/browser/reminder-header-browser.mjs",
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
