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

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

function assertConfigured() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `ไม่พบค่า Firebase config ต่อไปนี้ใน .env: ${missing
        .map((key) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`)
        .join(", ")} — ดูวิธีตั้งค่าใน README (คัดลอกจาก Firebase Console > Project settings > General > Your apps)`
    );
  }
}

assertConfigured();

// getApps().length check กันเรียก initializeApp() ซ้ำ — สำคัญเป็นพิเศษกับ
// Vite dev server ที่ hot-reload โมดูลได้โดยไม่ reload หน้าเว็บทั้งหมด ถ้า
// ไม่เช็คจะได้ error "Firebase App named '[DEFAULT]' already exists"
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
