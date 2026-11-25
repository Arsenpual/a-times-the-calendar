import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

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

export default defineConfig(({ command }) => ({
  // GitHub Pages เสิร์ฟ repo ที่ไม่ใช่ <username>.github.io จาก subpath
  // /<repo-name>/ เสมอ (ไม่ใช่ root domain) — ถ้าไม่ตั้ง base ให้ตรง ไฟล์ JS/CSS
  // ที่ build ออกมาจะอ้าง path แบบ "/assets/..." (root) ผิดที่ทำให้หน้าเว็บ
  // ขึ้นขาว 404 ทุกไฟล์ทันทีที่เปิดจริงบน Pages (ถึงแม้ npm run dev ในเครื่อง
  // จะทำงานปกติก็ตาม เพราะ dev server เสิร์ฟจาก root เสมอ)
  //
  // ตั้งผ่าน env var แทนที่จะ hardcode ชื่อ repo ตรงๆ เพื่อให้ build ในเครื่อง
  // (npm run dev/build ปกติ) ไม่ต้องรู้จักชื่อ repo เลย — ตั้งค่าจริงแค่ตอน
  // GitHub Actions build เท่านั้น (ดู .github/workflows/deploy-frontend.yml)
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), ...(command === "build" ? [rejectDevMockupsInProduction()] : [])],
  resolve: {
    alias: {
      "@dev-mockups": fileURLToPath(new URL(
        command === "serve" ? "./src/dev/mockups/dev-mockups-entry.jsx" : "./src/app/dev-mockups.production.jsx",
        import.meta.url,
      )),
    },
  },
  // Map safe public Firebase Web Client identifiers if provided in AI Studio Secrets
  // without VITE_ prefix. NEVER expose server-only secrets (GEMINI_API_KEY,
  // GOOGLE_APPLICATION_CREDENTIALS_JSON, TELEGRAM_BOT_TOKEN, etc.) into the client bundle.
  define: {
    ...(process.env.FIREBASE_API_KEY && !process.env.VITE_FIREBASE_API_KEY
      ? { "import.meta.env.VITE_FIREBASE_API_KEY": JSON.stringify(process.env.FIREBASE_API_KEY) }
      : {}),
    ...(process.env.FIREBASE_AUTH_DOMAIN && !process.env.VITE_FIREBASE_AUTH_DOMAIN
      ? { "import.meta.env.VITE_FIREBASE_AUTH_DOMAIN": JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN) }
      : {}),
    ...(process.env.FIREBASE_PROJECT_ID && !process.env.VITE_FIREBASE_PROJECT_ID
      ? { "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify(process.env.FIREBASE_PROJECT_ID) }
      : {}),
    ...(process.env.FIREBASE_STORAGE_BUCKET && !process.env.VITE_FIREBASE_STORAGE_BUCKET
      ? { "import.meta.env.VITE_FIREBASE_STORAGE_BUCKET": JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET) }
      : {}),
    ...(process.env.FIREBASE_MESSAGING_SENDER_ID && !process.env.VITE_FIREBASE_MESSAGING_SENDER_ID
      ? { "import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID) }
      : {}),
    ...(process.env.FIREBASE_APP_ID && !process.env.VITE_FIREBASE_APP_ID
      ? { "import.meta.env.VITE_FIREBASE_APP_ID": JSON.stringify(process.env.FIREBASE_APP_ID) }
      : {}),
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_PROXY_TARGET || "http://localhost:4000",
        changeOrigin: true,
      },
      "/oauth": {
        target: process.env.VITE_BACKEND_PROXY_TARGET || "http://localhost:4000",
        changeOrigin: true,
      },
    },
    // Phase 2 (Firebase Auth): Chrome's default Cross-Origin-Opener-Policy
    // blocks Firebase's internal poll of the sign-in popup's window.closed
    // state during signInWithPopup()/reauthenticateWithPopup() — this is a
    // known, harmless warning (sign-in still completes normally either
    // way; see firebase/firebase-js-sdk#8295, #8541) but the header below
    // silences it cleanly by explicitly allowing same-origin popups rather
    // than leaving the browser's stricter default in place.
    //
    // Note: a signInWithRedirect-based flow was tried as an alternative
    // (avoids this warning entirely) but broke sign-in outright on
    // localhost — getRedirectResult() reliably returned null due to
    // third-party storage partitioning between Firebase's auth domain and
    // localhost. Popup + this cosmetic warning is the reliable option; see
    // google-calendar.js's module comment for the full story.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
    }
  }
}));
