import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");
const distDir = path.join(frontendDir, "dist");
const distIndexHtml = path.join(distDir, "index.html");
const envHashFile = path.join(distDir, ".public-env-hash");

const useSinglePortServer =
  process.env.AI_STUDIO_SINGLE_PORT === "1" ||
  process.env.PORT === "8080" ||
  Boolean(process.env.APP_URL) ||
  Boolean(process.env.K_SERVICE);

function computePublicEnvHash() {
  const keys = [
    "VITE_FIREBASE_API_KEY",
    "FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
    "FIREBASE_APP_ID",
    "VITE_FIREBASE_VAPID_KEY",
    "FIREBASE_VAPID_KEY",
    "FIREBASE_WEB_CONFIG_JSON",
    "VITE_FIREBASE_CONFIG_JSON",
    "VITE_API_BASE_URL",
    "VITE_BASE_PATH"
  ];
  const payload = keys.map((k) => `${k}=${process.env[k] || ""}`).join("\n");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function ensureFrontendBuilt() {
  const currentHash = computePublicEnvHash();
  const previousHash = existsSync(envHashFile) ? readFileSync(envHashFile, "utf8").trim() : "";
  if (existsSync(distIndexHtml) && previousHash === currentHash) {
    return;
  }

  console.log("[T.i.M.E.S.] Building frontend bundle with active runtime environment...");
  const result = spawnSync(npmCmd, ["run", "build", "--workspace=times-the-calendar-frontend"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: isWin,
    env: { ...process.env }
  });
  if (result.status !== 0) {
    console.error(`[T.i.M.E.S.] Frontend build exited with code ${result.status}`);
    process.exit(result.status || 1);
  }
  mkdirSync(distDir, { recursive: true });
  writeFileSync(envHashFile, currentHash, "utf8");
}

function runProcess(label, cmd, cwd, args, extraEnv = {}) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: isWin && cmd === npmCmd,
    env: { ...process.env, ...extraEnv }
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
    }
  });
  return child;
}

const children = [];

if (useSinglePortServer) {
  ensureFrontendBuilt();
  const appPort = process.env.APP_PORT || "3000";
  console.log(`[T.i.M.E.S.] Starting unified server on http://0.0.0.0:${appPort}...`);
  const backendChild = runProcess("backend", process.execPath, rootDir, ["backend/index.js"], {
    APP_PORT: appPort
  });
  backendChild.on("exit", (code) => {
    process.exit(code ?? 0);
  });
  children.push(backendChild);
} else {
  children.push(
    runProcess("backend", npmCmd, backendDir, ["run", "dev"]),
    runProcess("frontend", npmCmd, frontendDir, ["run", "dev"])
  );
  console.log("[T.i.M.E.S.] Starting Backend API (port 4000) + Frontend Vite Server (port 5173)...");
}

function shutdown() {
  for (const child of children) {
    try {
      child.kill("SIGINT");
    } catch {
      // Ignore already exited child
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
