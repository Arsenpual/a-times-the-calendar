import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../../../shared/config/firebase-auth.js';

export const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
] as const;

export const COZY_GOOGLE_TOKEN_STORAGE_KEY = 'cozy_desk_google_oauth_token_v1';
// Google OAuth access tokens minted via Firebase signInWithPopup last ~60 minutes.
// Keep a conservative 55-minute client TTL so reloads/updates reuse the valid token without prompting again.
const GOOGLE_ACCESS_TOKEN_TTL_MS = 55 * 60 * 1000;

interface PersistedGoogleToken {
  accessToken: string;
  uid: string;
  expiresAt: number;
}

function readPersistedToken(expectedUid?: string | null): PersistedGoogleToken | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COZY_GOOGLE_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedGoogleToken> | null;
    if (
      !parsed ||
      typeof parsed.accessToken !== 'string' ||
      !parsed.accessToken ||
      typeof parsed.uid !== 'string' ||
      !parsed.uid ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      window.localStorage.removeItem(COZY_GOOGLE_TOKEN_STORAGE_KEY);
      return null;
    }
    if (Date.now() >= parsed.expiresAt) {
      window.localStorage.removeItem(COZY_GOOGLE_TOKEN_STORAGE_KEY);
      return null;
    }
    const targetUid = expectedUid ?? auth.currentUser?.uid ?? null;
    if (targetUid && parsed.uid !== targetUid) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      uid: parsed.uid,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

function writePersistedToken(accessToken: string, uid: string): number {
  const expiresAt = Date.now() + GOOGLE_ACCESS_TOKEN_TTL_MS;
  if (typeof window !== 'undefined') {
    try {
      const payload: PersistedGoogleToken = {
        accessToken,
        uid,
        expiresAt,
      };
      window.localStorage.setItem(COZY_GOOGLE_TOKEN_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota / private-browsing errors and keep in-memory cache working
    }
  }
  return expiresAt;
}

function clearPersistedToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(COZY_GOOGLE_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
}

function createCozyGoogleProvider(): GoogleAuthProvider {
  const googleProvider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    googleProvider.addScope(scope);
  }
  const email = auth.currentUser?.email;
  if (email) {
    googleProvider.setCustomParameters({ login_hint: email });
  }
  return googleProvider;
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedTokenUid: string | null = null;
let cachedTokenExpiresAt: number | null = null;

function setCachedToken(accessToken: string, uid: string): void {
  cachedAccessToken = accessToken;
  cachedTokenUid = uid;
  cachedTokenExpiresAt = writePersistedToken(accessToken, uid);
}

export const initYouTubeAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const handleUserChange = (user: User | null) => {
    if (user) {
      const token = getYouTubeAccessToken(user.uid);
      if (token) {
        onAuthSuccess?.(user, token);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        cachedTokenUid = null;
        cachedTokenExpiresAt = null;
        onAuthFailure?.();
      }
    } else {
      clearYouTubeAccessToken();
      onAuthFailure?.();
    }
  };

  const maybeStub = auth as unknown as {
    _subscribe?: (cb: (u: User | null) => void) => () => void;
  };
  if (typeof maybeStub?._subscribe === 'function') {
    return maybeStub._subscribe(handleUserChange);
  }
  return onAuthStateChanged(auth, handleUserChange);
};

export const signInWithGoogleForYouTube = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, createCozyGoogleProvider());
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่ได้รับสิทธิ์เข้าถึงบัญชี Google กรุณาลองเข้าสู่ระบบอีกครั้ง');
    }
    setCachedToken(credential.accessToken, result.user.uid);
    return { user: result.user, accessToken: credential.accessToken };
  } finally {
    isSigningIn = false;
  }
};

/**
 * Requests incremental Google Drive write scope (`https://www.googleapis.com/auth/drive`) only when saving documents.
 * Uses `auth/drive` (replacing `drive.readonly`) instead of `drive.file` because Firebase Auth's
 * `/__/auth/handler` attaches `context_uri=http://localhost:5173`, which Google OAuth rejects with
 * `400: invalid_request` for origin-bound `drive.file` requests unless the localhost origin is manually
 * added to the auto-created Firebase OAuth Web client's Authorized JavaScript origins.
 */
export const requestGoogleDriveWriteAccess = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  const driveWriteProvider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    if (scope === 'https://www.googleapis.com/auth/drive.readonly') {
      driveWriteProvider.addScope('https://www.googleapis.com/auth/drive');
    } else {
      driveWriteProvider.addScope(scope);
    }
  }
  const customParams: Record<string, string> = {
    prompt: 'consent',
  };
  if (auth.currentUser?.email) {
    customParams.login_hint = auth.currentUser.email;
  }
  driveWriteProvider.setCustomParameters(customParams);

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, driveWriteProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่ได้รับสิทธิ์เขียนไฟล์ลง Google Drive กรุณาลองใหม่อีกครั้ง');
    }
    setCachedToken(credential.accessToken, result.user.uid);
    return { user: result.user, accessToken: credential.accessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getYouTubeAccessToken = (expectedUid?: string | null): string | null => {
  const targetUid = expectedUid ?? auth.currentUser?.uid ?? null;
  if (cachedAccessToken) {
    if (cachedTokenExpiresAt && Date.now() >= cachedTokenExpiresAt) {
      clearYouTubeAccessToken();
      return null;
    }
    if (!targetUid || !cachedTokenUid || cachedTokenUid === targetUid) {
      return cachedAccessToken;
    }
  }

  const persisted = readPersistedToken(targetUid);
  if (persisted) {
    cachedAccessToken = persisted.accessToken;
    cachedTokenUid = persisted.uid;
    cachedTokenExpiresAt = persisted.expiresAt;
    return persisted.accessToken;
  }

  return null;
};

export const clearYouTubeAccessToken = () => {
  cachedAccessToken = null;
  cachedTokenUid = null;
  cachedTokenExpiresAt = null;
  clearPersistedToken();
};

/**
 * Disconnects Cozy Desk's Google API token without logging out of the main T.i.M.E.S. Firebase session.
 */
export const signOutGoogle = async (): Promise<void> => {
  clearYouTubeAccessToken();
};
