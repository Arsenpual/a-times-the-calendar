import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import esbuild from "../node_modules/esbuild/lib/main.js";

const reactUrl = import.meta.resolve("react");
const { default: React } = await import(reactUrl);
const { default: Renderer } = await import("react-test-renderer");
const { act } = Renderer;

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
  },
};

const loadJsxModule = (relativePath, replacements = []) => {
  let source = readFileSync(new URL(relativePath, import.meta.url), "utf8")
    .replace('from "react"', 'from "' + reactUrl + '"');
  for (const [target, replacement] of replacements) {
    source = source.replace(target, replacement);
  }
  const transformed = esbuild.transformSync(source, { loader: "jsx" });
  return "data:text/javascript;base64," + Buffer.from(transformed.code).toString("base64");
};

const dateUtilsUrl = new URL("../src/shared/lib/date-utils.js", import.meta.url).href;
const useWeekNamesUrl = loadJsxModule("../src/features/activity/hooks/use-week-names.js", [
  ['from "../../../shared/lib/date-utils.js"', `from "${dateUtilsUrl}"`],
]);
const weekNameFieldUrl = loadJsxModule("../src/features/activity/components/week-name-field.jsx", [
  ['from "../hooks/use-week-names.js"', `from "${useWeekNamesUrl}"`],
]);
const weekNavBarUrl = loadJsxModule("../src/features/activity/components/week-nav-bar.jsx", [
  ['from "../../../shared/lib/date-utils.js"', `from "${dateUtilsUrl}"`],
  ['from "./week-name-field.jsx"', `from "${weekNameFieldUrl}"`],
]);
const appHeaderUrl = loadJsxModule("../src/app/components/app-header.jsx", [
  ['import BrandWordmark from "../../shared/ui/brand-wordmark.jsx";', 'const BrandWordmark = () => React.createElement("div", { className: "app-logo" });'],
  ['from "../../features/activity/components/week-name-field.jsx"', `from "${weekNameFieldUrl}"`],
]);

const { useWeekNames } = await import(useWeekNamesUrl);
const { default: AppHeader } = await import(appHeaderUrl);
const { default: WeekNavBar } = await import(weekNavBarUrl);

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
// 1. tag-search-wrap should be present and "+ เพิ่มกิจกรรม" button should be removed
assert.equal(root.findAllByProps({ className: "tag-search-wrap" }).length, 1, "Week view should display tag search");
assert.equal(root.findAll((el) => el.type === "button" && el.props.children === "+ เพิ่มกิจกรรม").length, 0, "Week view should NOT display + เพิ่มกิจกรรม button");
// 2. header-calendar-tools moved out of AppHeader to the bottom WeekNavBar
assert.equal(root.findAllByProps({ className: "header-calendar-tools" }).length, 0, "AppHeader should NOT display header-calendar-tools");
// 3. lonth-nav-bar should NOT be present in AppHeader
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

assert.equal(root.findAllByProps({ className: "tag-search-wrap" }).length, 0, "Lonth view should NOT display tag search");
assert.equal(root.findAll((el) => el.type === "button" && el.props.children === "+ เพิ่มกิจกรรม").length, 0, "Lonth view should NOT display + เพิ่มกิจกรรม button");
assert.equal(root.findAll((el) => el.type === "button" && el.props.className?.includes("btn-outline")).length, 0, "Lonth view should NOT display วันนี้ (btn btn-outline)");
assert.equal(root.findAllByProps({ className: "app-title" }).length, 0, "Lonth view should NOT display app-title");
assert.equal(root.findAllByProps({ className: "lonth-nav-bar" }).length, 0, "Lonth view should NOT display lonth-nav-bar in header");
assert.ok(root.findByType("header").props.className.includes("app-header--lonth"), "Lonth view should have app-header--lonth class");

// Interactive test: clicking app-title-date week name edits and persists the week name inside bottom WeekNavBar
function HeaderWithWeekName() {
  const weekNamesState = useWeekNames("user-1");
  return React.createElement(WeekNavBar, {
    weekStart: new Date(2026, 10, 16),
    activityHeaderTitle: { date: "16 พฤศจิกายน 2026", period: "สัปดาห์ที่ 47" },
    weekNames: weekNamesState.weekNames,
    editingWeekKey: weekNamesState.editingWeekKey,
    weekNameDraft: weekNamesState.weekNameDraft,
    onStartEditingWeekName: weekNamesState.startEditingWeekName,
    onWeekNameDraftChange: weekNamesState.setWeekNameDraft,
    onCommitWeekName: weekNamesState.commitWeekName,
    onCancelWeekNameEdit: weekNamesState.cancelWeekNameEdit,
    onGoToday: () => {},
    onNavigateDay: () => {},
    onNavigateWeek: () => {},
  });
}

let interactiveRenderer;
await act(async () => {
  interactiveRenderer = Renderer.create(React.createElement(HeaderWithWeekName));
});

const interactiveRoot = interactiveRenderer.root;
const titleDateSpan = interactiveRoot.findByProps({ className: "app-title-date" });
const initialButton = titleDateSpan.findByType("button");
assert.ok(initialButton.props.className.includes("app-title-week-name"), "app-title-date should render editable week name button");
assert.match(initialButton.props.children, /^สัปดาห์ที่ \d+ ของปี 2026$/);

// Click to start editing
await act(async () => {
  initialButton.props.onClick({ stopPropagation: () => {} });
});

const editInput = titleDateSpan.findByType("input");
assert.ok(editInput.props.className.includes("is-editing"), "Clicking week name should switch to editing input");

await act(async () => {
  editInput.props.onChange({ target: { value: "สัปดาห์เร่งปิดโปรเจกต์" } });
});
await act(async () => {
  editInput.props.onBlur();
});

const updatedButton = titleDateSpan.findByType("button");
assert.equal(updatedButton.props.children, "สัปดาห์เร่งปิดโปรเจกต์", "Committed week name should display in app-title-date");
assert.equal(JSON.parse(storage.get("times-activity-week-names:user-1"))["2026-11-16"], "สัปดาห์เร่งปิดโปรเจกต์");

// Click again to verify it can be renamed repeatedly at any time
await act(async () => {
  updatedButton.props.onClick({ stopPropagation: () => {} });
});
const secondInput = titleDateSpan.findByType("input");
await act(async () => {
  secondInput.props.onChange({ target: { value: "สัปดาห์พักผ่อน" } });
});
await act(async () => {
  secondInput.props.onBlur();
});
assert.equal(titleDateSpan.findByType("button").props.children, "สัปดาห์พักผ่อน", "Should allow renaming week name again anytime");

console.log("PASS: AppHeader supports week, month, lonth view modes and editable week name in app-title-date");
