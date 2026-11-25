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

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

// Keep access token strictly in memory (never in localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initYouTubeAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const maybeStub = auth as unknown as {
    _subscribe?: (cb: (u: User | null) => void) => () => void;
  };
  if (typeof maybeStub?._subscribe === 'function') {
    return maybeStub._subscribe((user: User | null) => {
      if (user && cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else {
        onAuthFailure?.();
      }
    });
  }
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const signInWithGoogleForYouTube = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่ได้รับสิทธิ์เข้าถึงบัญชี Google กรุณาลองเข้าสู่ระบบอีกครั้ง');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
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
  driveWriteProvider.setCustomParameters({
    prompt: 'consent',
  });

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, driveWriteProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่ได้รับสิทธิ์เขียนไฟล์ลง Google Drive กรุณาลองใหม่อีกครั้ง');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getYouTubeAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const clearYouTubeAccessToken = () => {
  cachedAccessToken = null;
};

/**
 * Disconnects Cozy Desk's in-memory Google API token without logging out of the main T.i.M.E.S. Firebase session.
 */
export const signOutGoogle = async (): Promise<void> => {
  cachedAccessToken = null;
};
