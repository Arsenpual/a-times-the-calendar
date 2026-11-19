import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import esbuild from "../node_modules/esbuild/lib/main.js";

const reactUrl = import.meta.resolve("react");
const { default: React } = await import(reactUrl);
const { default: Renderer } = await import("react-test-renderer");
const { act } = Renderer;

const rawSource = readFileSync(new URL("../src/app/components/app-header.jsx", import.meta.url), "utf8")
  .replace('from "react"', 'from "' + reactUrl + '"')
  .replace('import BrandWordmark from "../../shared/ui/brand-wordmark.jsx";', 'const BrandWordmark = () => React.createElement("div", { className: "app-logo" });');

const transformed = esbuild.transformSync(rawSource, { loader: "jsx" });
const { default: AppHeader } = await import("data:text/javascript;base64," + Buffer.from(transformed.code).toString("base64"));

const baseProps = {
  firebaseUser: { displayName: "User", email: "user@example.com" },
  navigationExpanded: false,
  onToggleNavigation: () => {},
  reminderHeaderRef: () => {},
  aiHeaderRef: () => {},
  mode: "activity",
  goToday: () => {},
  navigateDay: () => {},
  navigateWeek: () => {},
  activityHeaderTitle: { date: "18 พฤศจิกายน 2026", period: "สัปดาห์ที่ 47" },
  weekSpineViewMode: "week",
  setWeekSpineView: () => {},
  cycleAnchorDate: new Date(2026, 0, 1),
  onNavigateCycle: () => {},
  onSelectLonthDate: () => {},
  tagSearchTerms: [],
  setTagSearchTerms: () => {},
  tagSearchDraft: "",
  setTagSearchDraft: () => {},
  openAddActivity: () => {},
  cursorDate: new Date(),
  calendarAccessToken: "valid-token",
  accountMenuRef: { current: null },
  accountMenuOpen: false,
  setAccountMenuOpen: () => {},
  setSettingsOpen: () => {},
  handleLogout: () => {},
};

let renderer;
await act(async () => {
  renderer = Renderer.create(React.createElement(AppHeader, baseProps));
});

const root = renderer.root;

// In week mode:
// 1. tag-search-wrap and "+ เพิ่มกิจกรรม" button should be present
assert.equal(root.findAllByProps({ className: "tag-search-wrap" }).length, 1, "Week view should display tag search");
assert.equal(root.findAll((el) => el.type === "button" && el.props.children === "+ เพิ่มกิจกรรม").length, 1, "Week view should display + เพิ่มกิจกรรม button");
// 2. btn btn-outline ("วันนี้") should be present
assert.equal(root.findAll((el) => el.type === "button" && el.props.className?.includes("btn-outline")).length, 1, "Week view should display วันนี้ (btn btn-outline)");
// 3. app-title should be present
assert.equal(root.findAllByProps({ className: "app-title" }).length, 1, "Week view should display app-title");
// 4. lonth-nav-bar should NOT be present in week view
assert.equal(root.findAllByProps({ className: "lonth-nav-bar" }).length, 0, "Week view should NOT display lonth-nav-bar in header");

// View switch should have 1 สัปดาห์, เดือน, Lonth
assert.equal(root.findAll((el) => el.type === "button" && el.props.children === "1 สัปดาห์").length, 1, "Should have 1 สัปดาห์ view button");
assert.equal(root.findAll((el) => el.type === "button" && el.props.children === "เดือน").length, 1, "Should have เดือน view button");
assert.equal(root.findAll((el) => el.type === "button" && el.props.children === "Lonth").length, 1, "Should have Lonth view button");

// Switch to month mode (header should be clean/empty like Lonth mode)
await act(async () => {
  renderer.update(React.createElement(AppHeader, {
    ...baseProps,
    weekSpineViewMode: "month",
    activityHeaderTitle: { date: "พฤศจิกายน 2026", period: "รายเดือน" }
  }));
});

assert.equal(root.findAllByProps({ className: "tag-search-wrap" }).length, 0, "Month view should NOT display tag search");
assert.equal(root.findAll((el) => el.type === "button" && el.props.children === "+ เพิ่มกิจกรรม").length, 0, "Month view should NOT display + เพิ่มกิจกรรม button");
assert.equal(root.findAll((el) => el.type === "button" && el.props.className?.includes("btn-outline")).length, 0, "Month view should NOT display วันนี้ (btn btn-outline)");
assert.equal(root.findAllByProps({ className: "app-title" }).length, 0, "Month view should NOT display app-title");
assert.ok(root.findByType("header").props.className.includes("app-header--lonth"), "Month view should have app-header--lonth class");

// Switch to four-weeks (Lonth) mode
await act(async () => {
  renderer.update(React.createElement(AppHeader, { ...baseProps, weekSpineViewMode: "four-weeks" }));
});

// In Lonth mode:
// 1. search and + เพิ่มกิจกรรม should be cleared out
assert.equal(root.findAllByProps({ className: "tag-search-wrap" }).length, 0, "Lonth view should NOT display tag search");
assert.equal(root.findAll((el) => el.type === "button" && el.props.children === "+ เพิ่มกิจกรรม").length, 0, "Lonth view should NOT display + เพิ่มกิจกรรม button");

// 2. btn btn-outline and app-title should be cleared out
assert.equal(root.findAll((el) => el.type === "button" && el.props.className?.includes("btn-outline")).length, 0, "Lonth view should NOT display วันนี้ (btn btn-outline)");
assert.equal(root.findAllByProps({ className: "app-title" }).length, 0, "Lonth view should NOT display app-title");

// 3. lonth-nav-bar was moved to the bottom of Lonth view, so it should NOT be in header
assert.equal(root.findAllByProps({ className: "lonth-nav-bar" }).length, 0, "Lonth view should NOT display lonth-nav-bar in header");

// 4. app-header--lonth class should be on header
const headerElement = root.findByType("header");
assert.ok(headerElement.props.className.includes("app-header--lonth"), "Lonth view should have app-header--lonth class");

console.log("PASS: AppHeader supports week, month, and lonth view modes without lonth-nav-bar in header");
