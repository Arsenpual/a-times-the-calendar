const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function parseJsonOrBase64Object(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return null;
  let trimmed = rawValue.trim();
  if (!trimmed) return null;

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
  return null;
}

const bundledBackendConfig = parseJsonOrBase64Object(process.env.TIMES_BACKEND_CONFIG_JSON);
if (bundledBackendConfig) {
  for (const [key, value] of Object.entries(bundledBackendConfig)) {
    if (!key || value === undefined || value === null) continue;
    if (!process.env[key] || !String(process.env[key]).trim()) {
      process.env[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
  }
}

const bundledWebConfig = parseJsonOrBase64Object(
  process.env.FIREBASE_WEB_CONFIG_JSON || process.env.VITE_FIREBASE_CONFIG_JSON
);
if (bundledWebConfig) {
  const projectId = bundledWebConfig.projectId || bundledWebConfig.VITE_FIREBASE_PROJECT_ID || bundledWebConfig.FIREBASE_PROJECT_ID;
  if (projectId && !process.env.FIREBASE_PROJECT_ID) {
    process.env.FIREBASE_PROJECT_ID = String(projectId);
  }
}

module.exports = { parseJsonOrBase64Object };
