import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

function runProcess(label, cwd, args, extraEnv = {}) {
  const child = spawn(npmCmd, args, {
    cwd,
    stdio: "inherit",
    shell: isWin,
    env: { ...process.env, ...extraEnv },
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
    }
  });
  return child;
}

const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");

const children = [
  runProcess("backend", backendDir, ["run", "dev"]),
  runProcess("frontend", frontendDir, ["run", "dev"]),
];
console.log("[T.i.M.E.S.] Starting Backend API (port 4000) + Frontend Vite Server (port 5173)...");

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
