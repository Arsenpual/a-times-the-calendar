import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../../../shared/config/firebase-auth.js";

/**
 * Provider สำหรับ Firebase Login เท่านั้น; สิทธิ์ Calendar ระยะยาวถูกขอ
 * แยกผ่าน backend OAuth flow หลังผู้ใช้กดเชื่อมต่อ Calendar โดยตรง.
 * prompt: "select_account" forces Google's account picker to show every
 * time, even if the browser only has one Google session — this matters
 * here because a first sign-in is exactly the moment someone with multiple
 * Google accounts (e.g. work + personal) needs to consciously pick the
 * right one; silently defaulting to "whichever Google account is most
 * recently active in this browser" risks connecting the wrong account's
 * calendar without the person noticing until later. Calendar permission is
 * deliberately absent here. It is requested only by
 * the server-side Calendar OAuth flow after the person explicitly chooses
 * to connect their Calendar.
 */
function googleProviderForSignIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

/**
 * Opens the Firebase identity sign-in popup. Calendar permission is not
 * requested here, so signing in never grants long-lived calendar access by
 * accident.
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProviderForSignIn());
    const idToken = await result.user.getIdToken();
    return { idToken };
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("หน้าต่างเข้าสู่ระบบถูกปิดก่อนทำรายการเสร็จสิ้น");
    }
    if (error.code === "auth/popup-blocked") {
      throw new Error("เบราว์เซอร์บล็อกหน้าต่าง Popup กรุณาอนุญาตให้เปิด Popup สำหรับเว็บนี้");
    }
    throw error;
  }
}

/**
 * Subscribes to Firebase auth state changes.
 * @param {(user: import("firebase/auth").User | null) => void} callback
 */
export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Signs out of Firebase entirely. */
export async function signOut() {
  await firebaseSignOut(auth);
}
