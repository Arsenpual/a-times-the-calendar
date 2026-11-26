// Firebase client SDK config + init — Phase 2 (Firebase Authentication).
//
// These VITE_FIREBASE_* values come from Firebase Console > Project
// settings > General > Your apps > Web app config. They're safe to expose
// client-side (this is the standard/documented way Firebase web apps work —
// access control happens via Firebase Auth + Security Rules, not by
// hiding this config), but still live in .env rather than being hardcoded
// so they're easy to swap between dev/prod Firebase projects.
//
// Docs: https://firebase.google.com/docs/web/setup
import { initializeApp, getApps } from "firebase/app";

function normalizeFirebaseClientValue(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || /^(your[-_]|replace[-_]|example|<.+>|\.\.\.)/i.test(trimmed)) {
    return "";
  }
  return trimmed;
}

export const firebaseConfig = {
  apiKey: normalizeFirebaseClientValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: normalizeFirebaseClientValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: normalizeFirebaseClientValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: normalizeFirebaseClientValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: normalizeFirebaseClientValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: normalizeFirebaseClientValue(import.meta.env.VITE_FIREBASE_APP_ID)
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

if (!isFirebaseConfigured && typeof console !== "undefined") {
  console.log(
    "[firebase-config] ยังไม่พบค่า VITE_FIREBASE_* ที่สมบูรณ์ — กำลังทำงานในโหมด Sandbox / AI Studio Preview"
  );
}

// getApps().length check กันเรียก initializeApp() ซ้ำ — สำคัญเป็นพิเศษกับ
// Vite dev server ที่ hot-reload โมดูลได้โดยไม่ reload หน้าเว็บทั้งหมด ถ้า
// ไม่เช็คจะได้ error "Firebase App named '[DEFAULT]' already exists"
export const firebaseApp = isFirebaseConfigured
  ? getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0]
  : null;
