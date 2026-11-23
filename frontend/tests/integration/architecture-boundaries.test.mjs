import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("../../", import.meta.url)).replaceAll("\\", "/");
const repoRoot = path.posix.normalize(`${frontendRoot}/..`);
const srcRoot = `${frontendRoot}src`;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(srcRoot);
const importRegex = /(?:from\s+|import\s*\(\s*|import\s+|@import\s+)["'](\.[^"']+)["']/g;
const violations = [];

for (const f of files) {
  const ext = path.extname(f);
  if (![".js", ".jsx", ".ts", ".tsx", ".css"].includes(ext)) continue;
  const content = fs.readFileSync(f, "utf8");
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const rel = match[1];
    const resolved = path.posix.normalize(`${path.posix.dirname(f)}/${rel}`);
    if (!resolved.startsWith(`${srcRoot}/`)) continue;
    const srcRel = f.slice(srcRoot.length + 1);
    const dstRel = resolved.slice(srcRoot.length + 1);
    const srcTop = srcRel.split("/")[0];
    const dstTop = dstRel.split("/")[0];

    if (srcTop === "shared" && dstTop !== "shared") {
      violations.push(`[shared -> ${dstTop}] ${srcRel} imports ${dstRel}`);
    } else if (srcTop === "features" && dstTop === "features") {
      const srcFeature = srcRel.split("/")[1];
      const dstFeature = dstRel.split("/")[1];
      if (srcFeature !== dstFeature) {
        violations.push(`[feature ${srcFeature} -> feature ${dstFeature}] ${srcRel} imports ${dstRel}`);
      }
    } else if (srcTop === "features" && dstTop === "app") {
      violations.push(`[features -> app] ${srcRel} imports ${dstRel}`);
    }
  }
}

assert.deepEqual(
  violations,
  [],
  `Architecture boundary violations detected:\n${violations.join("\n")}`
);

// Verify feature subfolder conventions (no legacy utils/ directory inside features)
for (const featureEntry of fs.readdirSync(`${srcRoot}/features`, { withFileTypes: true })) {
  if (!featureEntry.isDirectory()) continue;
  const featurePath = `${srcRoot}/features/${featureEntry.name}`;
  assert.equal(
    fs.existsSync(`${featurePath}/utils`),
    false,
    `Feature "${featureEntry.name}" must use api/ and lib/ instead of utils/`
  );
}

// Verify backend root has no loose .js modules outside index.js
const backendRootJs = fs
  .readdirSync(`${repoRoot}/backend`, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => entry.name);

assert.deepEqual(
  backendRootJs,
  ["index.js"],
  `Backend root must only contain index.js; move service modules to backend/lib/: ${backendRootJs.join(", ")}`
);

// Verify reminder domain logic remains single-source re-exported from functions/domain
const dueWrapper = fs.readFileSync(`${srcRoot}/features/reminder/lib/reminder-due-logic.js`, "utf8");
const intervalWrapper = fs.readFileSync(`${srcRoot}/features/reminder/lib/interval-schedule.js`, "utf8");
assert.match(dueWrapper, /functions\/domain\/reminder-due-logic\.js/);
assert.match(intervalWrapper, /functions\/domain\/interval-schedule\.js/);

// Verify no file in features/cozy-desk exceeds 800 lines
const cozyDeskFiles = walk(`${srcRoot}/features/cozy-desk`);
const oversizedCozyFiles = [];
for (const f of cozyDeskFiles) {
  const ext = path.extname(f);
  if (![".js", ".jsx", ".ts", ".tsx", ".css"].includes(ext)) continue;
  const lineCount = fs.readFileSync(f, "utf8").split(/\r?\n/).length;
  if (lineCount > 800) {
    oversizedCozyFiles.push(`${f.slice(srcRoot.length + 1)} (${lineCount} lines)`);
  }
}
assert.deepEqual(
  oversizedCozyFiles,
  [],
  `Cozy Desk files must not exceed 800 lines:\n${oversizedCozyFiles.join("\n")}`
);

// Verify zero runtime circular imports within features/cozy-desk
const cozyGraph = new Map();
const cozyFileSet = new Set(cozyDeskFiles.filter((f) => [".js", ".jsx", ".ts", ".tsx"].includes(path.extname(f))));
const runtimeImportRegex = /^(?!\s*import\s+type\b)(?:\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["'](\.[^"']+)["'])/gm;

for (const f of cozyFileSet) {
  const content = fs.readFileSync(f, "utf8");
  const deps = [];
  let m;
  while ((m = runtimeImportRegex.exec(content)) !== null) {
    const base = path.posix.normalize(`${path.posix.dirname(f)}/${m[1]}`);
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`]) {
      if (cozyFileSet.has(candidate)) {
        deps.push(candidate);
        break;
      }
    }
  }
  cozyGraph.set(f, deps);
}

const cycles = [];
const visited = new Set();
const inStack = new Set();
function dfs(node, trail) {
  visited.add(node);
  inStack.add(node);
  for (const next of cozyGraph.get(node) ?? []) {
    if (inStack.has(next)) {
      const cycleStart = trail.indexOf(next);
      cycles.push([...trail.slice(cycleStart), next].map((p) => p.slice(srcRoot.length + 1)).join(" -> "));
    } else if (!visited.has(next)) {
      dfs(next, [...trail, next]);
    }
  }
  inStack.delete(node);
}
for (const f of cozyFileSet) {
  if (!visited.has(f)) dfs(f, [f]);
}
assert.deepEqual(cycles, [], `Circular runtime imports detected in cozy-desk:\n${cycles.join("\n")}`);

// Verify zero undefined runtime references (no-undef) across all cozy-desk modules
const frontendRequire = createRequire(`${frontendRoot}package.json`);
const esbuild = frontendRequire("esbuild");
const { Linter } = frontendRequire("eslint");
const globals = frontendRequire("globals");
const linter = new Linter();
const undefErrors = [];
for (const f of cozyFileSet) {
  const ext = path.extname(f).slice(1);
  const transformed = esbuild.transformSync(fs.readFileSync(f, "utf8"), {
    loader: ext,
    jsx: "automatic",
    format: "esm",
    target: "es2022",
  });
  const messages = linter.verify(transformed.code, [
    {
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        globals: { ...globals.browser, ...globals.es2022, React: "readonly" },
      },
      rules: { "no-undef": "error" },
    },
  ]);
  for (const msg of messages) {
    undefErrors.push(`${f.slice(srcRoot.length + 1)}:${msg.line} ${msg.message}`);
  }
}
assert.deepEqual(undefErrors, [], `Undefined references detected in cozy-desk:\n${undefErrors.join("\n")}`);

console.log("PASS: Feature boundaries, zero cross-feature imports, standard folders, <=800 lines, zero circular imports & zero no-undef in cozy-desk, backend root hygiene, and domain single-source parity");
