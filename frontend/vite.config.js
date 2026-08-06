import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
  plugins: [react()],
  server: {
    port: 5173,
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
});