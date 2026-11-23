import { apiRequest } from '../../../shared/api/client.js';
import { auth } from '../../../shared/config/firebase-auth.js';

export function cozyStorageKey(baseKey: string): string {
  const uid = auth.currentUser?.uid;
  return uid ? `${baseKey}:${uid}` : baseKey;
}

export async function cozyApiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const normalized = path.startsWith('/api/cozy-desk')
    ? path
    : path.replace(/^\/api\//, '/api/cozy-desk/');
  return apiRequest(normalized, options);
}
