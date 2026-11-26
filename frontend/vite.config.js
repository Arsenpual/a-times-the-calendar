import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(frontendDir, "..");

function rejectDevMockupsInProduction() {
  return {
    name: "reject-dev-mockups-in-production",
    generateBundle(_options, bundle) {
      const leakedModules = Object.values(bundle)
        .filter((output) => output.type === "chunk")
        .flatMap((chunk) => Object.keys(chunk.modules))
        .filter((moduleId) => moduleId.replaceAll("\\", "/").includes("/src/dev/mockups/"));

      if (leakedModules.length > 0) {
        this.error(`Production bundle contains development mockups:\n${leakedModules.join("\n")}`);
      }
    },
  };
}

function parseBundledWebConfig(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return {};
  let trimmed = rawValue.trim();
  if (!trimmed) return {};
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  for (const candidate of [trimmed, Buffer.from(trimmed, "base64").toString("utf8")]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Try next candidate
    }
  }
  return {};
}

export default defineConfig(({ command, mode }) => {
  const rootEnv = loadEnv(mode, rootDir, "");
  const localEnv = loadEnv(mode, frontendDir, "");
  const mergedEnv = { ...rootEnv, ...localEnv, ...process.env };

  const bundledWebConfig = parseBundledWebConfig(
    mergedEnv.FIREBASE_WEB_CONFIG_JSON || mergedEnv.VITE_FIREBASE_CONFIG_JSON
  );

  const resolvePublicFirebaseVar = (viteKey, plainKey, camelKey) =>
    mergedEnv[viteKey] ||
    mergedEnv[plainKey] ||
    bundledWebConfig[viteKey] ||
    bundledWebConfig[plainKey] ||
    bundledWebConfig[camelKey] ||
    "";

  const firebaseDefines = {};
  const publicPairs = [
    ["VITE_FIREBASE_API_KEY", "FIREBASE_API_KEY", "apiKey"],
    ["VITE_FIREBASE_AUTH_DOMAIN", "FIREBASE_AUTH_DOMAIN", "authDomain"],
    ["VITE_FIREBASE_PROJECT_ID", "FIREBASE_PROJECT_ID", "projectId"],
    ["VITE_FIREBASE_STORAGE_BUCKET", "FIREBASE_STORAGE_BUCKET", "storageBucket"],
    ["VITE_FIREBASE_MESSAGING_SENDER_ID", "FIREBASE_MESSAGING_SENDER_ID", "messagingSenderId"],
    ["VITE_FIREBASE_APP_ID", "FIREBASE_APP_ID", "appId"],
    ["VITE_FIREBASE_VAPID_KEY", "FIREBASE_VAPID_KEY", "vapidKey"],
  ];
  for (const [viteKey, plainKey, camelKey] of publicPairs) {
    const val = resolvePublicFirebaseVar(viteKey, plainKey, camelKey);
    if (val) {
      firebaseDefines[`import.meta.env.${viteKey}`] = JSON.stringify(val);
    }
  }

  return {
    base: mergedEnv.VITE_BASE_PATH || "/",
    plugins: [react(), ...(command === "build" ? [rejectDevMockupsInProduction()] : [])],
    resolve: {
      alias: {
        "@dev-mockups": fileURLToPath(new URL(
          command === "serve" ? "./src/dev/mockups/dev-mockups-entry.jsx" : "./src/app/dev-mockups.production.jsx",
          import.meta.url,
        )),
      },
    },
    define: firebaseDefines,
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: "all",
      proxy: {
        "/api": {
          target: mergedEnv.VITE_BACKEND_PROXY_TARGET || "http://localhost:4000",
          changeOrigin: true,
        },
        "/oauth": {
          target: mergedEnv.VITE_BACKEND_PROXY_TARGET || "http://localhost:4000",
          changeOrigin: true,
        },
      },
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
      }
    }
  };
});
