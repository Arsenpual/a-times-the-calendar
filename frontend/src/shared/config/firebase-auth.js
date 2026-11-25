import { getAuth } from "firebase/auth";
import { firebaseApp, isFirebaseConfigured } from "./firebase-config.js";

function createSandboxFallbackAuth() {
  const listeners = new Set();
  const sandboxUser = {
    uid: "sandbox-preview-user",
    displayName: "AI Studio Preview",
    email: "preview@localhost",
    photoURL: null,
    getIdToken: async () => "sandbox-preview-token"
  };
  const stub = {
    currentUser: sandboxUser,
    _notify() {
      for (const cb of listeners) {
        try {
          cb(stub.currentUser);
        } catch {
          // Ignore listener errors
        }
      }
    },
    _subscribe(cb) {
      listeners.add(cb);
      Promise.resolve().then(() => cb(stub.currentUser));
      return () => listeners.delete(cb);
    },
    _signIn() {
      stub.currentUser = sandboxUser;
      stub._notify();
      return { user: sandboxUser };
    },
    _signOut() {
      stub.currentUser = null;
      stub._notify();
    }
  };
  return stub;
}

export const auth = isFirebaseConfigured && firebaseApp ? getAuth(firebaseApp) : createSandboxFallbackAuth();
